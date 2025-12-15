/**
 * Physics-Based Ultrasound Rendering Engine
 * Implements realistic B-mode and Doppler imaging with full acoustic simulation
 */

import { AnatomyLayer } from '@/types/ultrasoundAdvanced';
import { UltrasoundInclusionConfig, getAcousticMedium } from '@/types/acousticMedia';

export interface UltrasoundEngineConfig {
  layers: AnatomyLayer[];
  inclusions: UltrasoundInclusionConfig[];
  transducerType: 'linear' | 'convex' | 'microconvex';
  frequency: number; // MHz
  depth: number; // cm
  focus: number; // cm
  gain: number; // 0-100
  dynamicRange: number; // dB
  mode: 'b-mode' | 'color-doppler';
  features: {
    showStructuralBMode: boolean;
    showBeamOverlay: boolean;
    showDepthScale: boolean;
    showFocusMarker: boolean;
    showPhysicsPanel: boolean;
    enablePosteriorEnhancement: boolean;
    enableAcousticShadow: boolean;
    enableReverberation: boolean;
    enableNearFieldClutter: boolean;
    showFieldLines: boolean;
    showAttenuationMap: boolean;
    enableColorDoppler: boolean;
    showAnatomyLabels: boolean;
  };
  time: number;
}

export class PhysicsUltrasoundEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: UltrasoundEngineConfig;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  private imageData: ImageData;
  private lastFrameTime: number = 0;
  private targetFPS: number = 30;
  
  // Cached data for performance
  private noiseCache: Float32Array;
  private velocityField: Float32Array | null = null;

  constructor(canvas: HTMLCanvasElement, config: UltrasoundEngineConfig) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Cannot get 2D context');
    this.ctx = ctx;
    this.config = config;
    
    this.imageData = this.ctx.createImageData(canvas.width, canvas.height);
    this.noiseCache = new Float32Array(canvas.width * canvas.height);
    this.generateNoiseCache();
  }

  private generateNoiseCache(): void {
    for (let i = 0; i < this.noiseCache.length; i++) {
      this.noiseCache[i] = this.rayleighNoise();
    }
  }

  public updateConfig(newConfig: Partial<UltrasoundEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Regenerate velocity field if Doppler mode or inclusions changed
    if (newConfig.mode === 'color-doppler' || newConfig.inclusions) {
      this.generateVelocityField();
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public destroy(): void {
    this.stop();
  }

  private animate = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    const frameInterval = 1000 / this.targetFPS;

    if (deltaTime >= frameInterval) {
      this.config.time = now / 1000;
      this.renderFrame();
      this.lastFrameTime = now - (deltaTime % frameInterval);
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  private renderFrame(): void {
    if (this.config.mode === 'b-mode') {
      this.renderBMode();
    } else if (this.config.mode === 'color-doppler') {
      this.renderBMode(); // Base B-mode
      this.renderDopplerOverlay(); // Overlay Doppler colors
    }

    // Draw overlays
    if (this.config.features.showBeamOverlay) this.drawBeamOverlay();
    if (this.config.features.showDepthScale) this.drawDepthScale();
    if (this.config.features.showFocusMarker) this.drawFocusMarker();
    if (this.config.features.showAnatomyLabels) this.drawAnatomyLabels();
  }

  private renderBMode(): void {
    const { width, height } = this.canvas;
    const data = this.imageData.data;
    
    const gainFactor = Math.pow(10, this.config.gain / 20); // dB to linear
    const depthCm = this.config.depth;
    const focusCm = this.config.focus;
    const freqMHz = this.config.frequency;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Convert pixel to physical coordinates
        const { depth, lateral } = this.pixelToPhysical(x, y, width, height);
        
        if (depth > depthCm) {
          // Beyond scan depth - black
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 255;
          continue;
        }

        // Get layer at this position
        const layer = this.getLayerAtDepth(depth / depthCm); // normalized depth
        
        // Base echogenicity from layer
        let intensity = this.getEchogenicityValue(layer.echogenicity) * layer.reflectivity;
        
        // Add Rayleigh-distributed speckle noise
        const noiseIdx = y * width + x;
        const speckle = this.noiseCache[noiseIdx] * 0.3;
        intensity *= (1 + speckle);
        
        // Frequency-dependent attenuation
        const attenuation = Math.exp(-layer.attenuationCoeff * freqMHz * depth);
        intensity *= attenuation;
        
        // Focal zone enhancement
        const focalDistance = Math.abs(depth - focusCm);
        const focalGain = 1 + Math.exp(-focalDistance * 2) * 0.5;
        intensity *= focalGain;
        
        // Apply gain
        intensity *= gainFactor;
        
        // Check for inclusions and their effects
        const inclusionEffect = this.getInclusionEffect(depth, lateral);
        intensity *= inclusionEffect.intensity;
        
        // Acoustic shadow
        if (this.config.features.enableAcousticShadow && inclusionEffect.shadow > 0) {
          intensity *= (1 - inclusionEffect.shadow * 0.9);
        }
        
        // Posterior enhancement
        if (this.config.features.enablePosteriorEnhancement && inclusionEffect.enhancement > 0) {
          intensity *= (1 + inclusionEffect.enhancement * 0.5);
        }
        
        // Reverberation artifacts
        if (this.config.features.enableReverberation) {
          const reverberation = this.calculateReverberation(depth, lateral);
          intensity += reverberation * 0.2;
        }
        
        // Near-field clutter
        if (this.config.features.enableNearFieldClutter && depth < 0.5) {
          const clutter = Math.random() * 0.3 * (1 - depth * 2);
          intensity += clutter;
        }
        
        // Beam geometry - lateral falloff
        const beamWidth = this.getBeamWidth(depth);
        const lateralDist = Math.abs(lateral);
        if (lateralDist > beamWidth / 2) {
          const falloff = Math.exp(-Math.pow((lateralDist - beamWidth / 2) / 0.5, 2));
          intensity *= falloff;
        }
        
        // Dynamic range compression
        intensity = Math.pow(intensity, 1 / this.config.dynamicRange * 50);
        
        // Clamp and convert to grayscale
        const gray = Math.max(0, Math.min(255, intensity * 255));
        
        data[idx] = gray;
        data[idx + 1] = gray;
        data[idx + 2] = gray;
        data[idx + 3] = 255;
      }
    }
    
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  private renderDopplerOverlay(): void {
    if (!this.config.features.enableColorDoppler) return;
    if (!this.velocityField) this.generateVelocityField();
    if (!this.velocityField) return;

    const { width, height } = this.canvas;
    const overlayData = this.ctx.createImageData(width, height);
    const data = overlayData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const velIdx = y * width + x;
        const velocity = this.velocityField[velIdx];

        if (Math.abs(velocity) < 0.01) {
          // No flow - transparent
          data[idx + 3] = 0;
          continue;
        }

        // Color mapping: blue = away (-), red = toward (+)
        const velNorm = Math.max(-1, Math.min(1, velocity * 50));
        let r = 0, g = 0, b = 0;

        if (velNorm > 0) {
          // Toward probe - red/yellow
          r = 255;
          g = Math.floor(200 * (1 - velNorm));
          b = 0;
        } else {
          // Away from probe - blue/cyan
          r = 0;
          g = Math.floor(200 * (1 + velNorm));
          b = 255;
        }

        // Add noise
        const noise = (Math.random() - 0.5) * 30;
        r = Math.max(0, Math.min(255, r + noise));
        g = Math.max(0, Math.min(255, g + noise));
        b = Math.max(0, Math.min(255, b + noise));

        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 180; // Semi-transparent overlay
      }
    }

    this.ctx.putImageData(overlayData, 0, 0);
  }

  private getLayerAtDepth(normalizedDepth: number): AnatomyLayer {
    // If no layers configured, return default
    if (!this.config.layers || this.config.layers.length === 0) {
      return {
        name: 'Generic Tissue',
        depthRange: [0, 1],
        reflectivity: 0.5,
        echogenicity: 'isoechoic',
        texture: 'homogeneous',
        attenuationCoeff: 0.7
      };
    }

    // Find layer that contains this normalized depth (0-1)
    for (const layer of this.config.layers) {
      if (normalizedDepth >= layer.depthRange[0] && normalizedDepth <= layer.depthRange[1]) {
        return layer;
      }
    }

    // Return first layer if no match (shouldn't happen but safe)
    return this.config.layers[0] || {
      name: 'Generic Tissue',
      depthRange: [0, 1],
      reflectivity: 0.5,
      echogenicity: 'isoechoic',
      texture: 'homogeneous',
      attenuationCoeff: 0.7
    };
  }

  private getEchogenicityValue(echogenicity: string): number {
    switch (echogenicity) {
      case 'anechoic': return 0.0;
      case 'hypoechoic': return 0.3;
      case 'isoechoic': return 0.5;
      case 'hyperechoic': return 0.8;
      default: return 0.5;
    }
  }

  private isPointInInclusion(depthCm: number, lateralCm: number, inclusion: UltrasoundInclusionConfig): boolean {
    const dx = lateralCm - inclusion.centerLateralPos * 2;
    const dy = depthCm - inclusion.centerDepthCm;
    const rx = inclusion.sizeCm.width / 2;
    const ry = inclusion.sizeCm.height / 2;

    if (inclusion.shape === 'ellipse') {
      return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
    } else if (inclusion.shape === 'capsule' || inclusion.shape === 'vessel_ascending' || inclusion.shape === 'vessel_descending') {
      // Capsule/Vessel with rotation and irregularity
      const capsuleRadius = ry;
      const rectHalfWidth = rx - capsuleRadius;
      
      // Apply shape-based default rotation
      let rotationDeg = inclusion.rotationDegrees ?? 0;
      if (inclusion.shape === 'vessel_ascending' && inclusion.rotationDegrees === undefined) {
        rotationDeg = 12;
      } else if (inclusion.shape === 'vessel_descending' && inclusion.rotationDegrees === undefined) {
        rotationDeg = -12;
      }
      
      const rotationRad = (rotationDeg * Math.PI) / 180;
      const cosR = Math.cos(rotationRad);
      const sinR = Math.sin(rotationRad);
      const dxLocal = dx * cosR + dy * sinR;
      const dyLocal = -dx * sinR + dy * cosR;
      
      const irregularity = inclusion.wallIrregularity || 0;
      const radiusMod = irregularity > 0 ? irregularity * Math.sin(dxLocal * 8.0) * 0.5 : 0;
      const effectiveRadius = capsuleRadius + radiusMod;
      
      if (Math.abs(dxLocal) <= rectHalfWidth) {
        return Math.abs(dyLocal) <= effectiveRadius;
      } else {
        const endCenterX = Math.sign(dxLocal) * rectHalfWidth;
        const localDxEnd = dxLocal - endCenterX;
        return Math.sqrt(localDxEnd * localDxEnd + dyLocal * dyLocal) <= effectiveRadius;
      }
    } else if (inclusion.shape === 'rectangle') {
      return Math.abs(dx) <= rx && Math.abs(dy) <= ry;
    }

    return false;
  }

  private getInclusionEffect(depthCm: number, lateralCm: number): { 
    intensity: number; 
    shadow: number; 
    enhancement: number; 
  } {
    let intensity = 1.0;
    let shadow = 0;
    let enhancement = 0;

    for (const inclusion of this.config.inclusions) {
      // Check if we're in the shadow zone (behind inclusion)
      if (depthCm > inclusion.centerDepthCm + inclusion.sizeCm.height / 2) {
        const dx = lateralCm - inclusion.centerLateralPos * 2;
        if (Math.abs(dx) < inclusion.sizeCm.width / 2) {
          if (inclusion.hasStrongShadow) {
            shadow = Math.max(shadow, 0.8 * Math.exp(-(depthCm - inclusion.centerDepthCm) * 0.5));
          }
          if (inclusion.posteriorEnhancement) {
            enhancement = Math.max(enhancement, 0.6 * Math.exp(-(depthCm - inclusion.centerDepthCm) * 0.5));
          }
        }
      }

      // If inside inclusion, modify intensity based on medium
      if (this.isPointInInclusion(depthCm, lateralCm, inclusion)) {
        const medium = getAcousticMedium(inclusion.mediumInsideId);
        const echogenicity = this.getEchogenicityValue(medium.baseEchogenicity);
        intensity *= echogenicity;
        
        // Sharp vs soft border
        if (inclusion.borderEchogenicity === 'soft') {
          const centerDist = Math.sqrt(
            Math.pow(lateralCm - inclusion.centerLateralPos * 2, 2) +
            Math.pow(depthCm - inclusion.centerDepthCm, 2)
          );
          const maxDist = inclusion.sizeCm.width / 2;
          const edgeFactor = 1 - Math.pow(centerDist / maxDist, 2);
          intensity *= (0.7 + edgeFactor * 0.3);
        }
      }
    }

    return { intensity, shadow, enhancement };
  }

  private calculateReverberation(depthCm: number, _lateralCm: number): number {
    // Simple reverberation model - multiple reflections
    let reverberation = 0;
    const intervals = [0.5, 1.0, 1.5]; // cm intervals

    for (const interval of intervals) {
      if (depthCm % interval < 0.1) {
        reverberation += 0.1 * Math.exp(-depthCm * 0.5);
      }
    }

    return reverberation;
  }

  private getBeamWidth(depthCm: number): number {
    // Beam width depends on transducer type and depth
    const { transducerType, frequency } = this.config;
    
    let baseWidth = 0;
    if (transducerType === 'linear') {
      baseWidth = 0.5 + depthCm * 0.1;
    } else if (transducerType === 'convex') {
      baseWidth = 1.0 + depthCm * 0.3;
    } else if (transducerType === 'microconvex') {
      baseWidth = 0.7 + depthCm * 0.2;
    }

    // Higher frequency = narrower beam
    return baseWidth * (5 / frequency);
  }

  private pixelToPhysical(x: number, y: number, width: number, height: number): { depth: number; lateral: number } {
    const depthCm = (y / height) * this.config.depth;
    
    let lateral = 0;
    if (this.config.transducerType === 'linear') {
      lateral = ((x / width) - 0.5) * 4; // -2 to +2 cm
    } else {
      // Convex/microconvex - fan shape
      const angle = ((x / width) - 0.5) * Math.PI * 0.6; // ~54 degrees
      lateral = depthCm * Math.tan(angle);
    }

    return { depth: depthCm, lateral };
  }

  private generateVelocityField(): void {
    const { width, height } = this.canvas;
    this.velocityField = new Float32Array(width * height);

    // Find vessel inclusions
    const vessels = this.config.inclusions.filter(inc => 
      inc.mediumInsideId === 'blood' || inc.type === 'vessel'
    );

    if (vessels.length === 0) {
      this.velocityField.fill(0);
      return;
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const { depth, lateral } = this.pixelToPhysical(x, y, width, height);
        let velocity = 0;

        for (const vessel of vessels) {
          if (this.isPointInInclusion(depth, lateral, vessel)) {
            // Laminar flow profile - parabolic
            const dx = lateral - vessel.centerLateralPos * 2;
            const dy = depth - vessel.centerDepthCm;
            const centerDist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = vessel.sizeCm.width / 2;
            
            if (centerDist < maxDist) {
              const flowProfile = 1 - Math.pow(centerDist / maxDist, 2);
              velocity = 0.02 * flowProfile; // Peak velocity ~0.02 cm/s
              
              // Pulsatility
              velocity *= (1 + 0.3 * Math.sin(this.config.time * Math.PI * 2));
            }
          }
        }

        this.velocityField[y * width + x] = velocity;
      }
    }
  }

  private rayleighNoise(): number {
    // Rayleigh distribution for speckle
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  private drawBeamOverlay(): void {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
    this.ctx.lineWidth = 1;

    const { width, height } = this.canvas;
    const centerX = width / 2;

    if (this.config.transducerType === 'linear') {
      // Draw parallel beam lines
      for (let i = 0; i < 5; i++) {
        const x = centerX + (i - 2) * width / 8;
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, height);
        this.ctx.stroke();
      }
    } else {
      // Draw fan beam lines
      const numLines = 9;
      for (let i = 0; i < numLines; i++) {
        const angle = ((i / (numLines - 1)) - 0.5) * Math.PI * 0.6;
        const endX = centerX + Math.tan(angle) * height;
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, 0);
        this.ctx.lineTo(endX, height);
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
  }

  private drawDepthScale(): void {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.font = '10px monospace';

    const { height } = this.canvas;
    const steps = 5;

    for (let i = 0; i <= steps; i++) {
      const y = (i / steps) * height;
      const depthCm = (i / steps) * this.config.depth;
      this.ctx.fillText(`${depthCm.toFixed(1)}cm`, 5, y + 12);
    }

    this.ctx.restore();
  }

  private drawFocusMarker(): void {
    this.ctx.save();
    const { height, width } = this.canvas;
    const focusY = (this.config.focus / this.config.depth) * height;

    this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(width - 20, focusY);
    this.ctx.lineTo(width - 5, focusY);
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawAnatomyLabels(): void {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.font = '12px sans-serif';

    const { height } = this.canvas;

    for (const layer of this.config.layers) {
      // Draw label at the middle of the layer
      const midDepth = (layer.depthRange[0] + layer.depthRange[1]) / 2;
      const y = midDepth * height;
      
      if (y < height && y > 0) {
        this.ctx.fillText(layer.name.toUpperCase(), 30, y);
        
        // Draw horizontal lines at layer boundaries
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 1;
        
        // Top boundary
        const yTop = layer.depthRange[0] * height;
        this.ctx.beginPath();
        this.ctx.moveTo(0, yTop);
        this.ctx.lineTo(this.canvas.width, yTop);
        this.ctx.stroke();
        
        // Bottom boundary
        const yBottom = layer.depthRange[1] * height;
        this.ctx.beginPath();
        this.ctx.moveTo(0, yBottom);
        this.ctx.lineTo(this.canvas.width, yBottom);
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
  }
}
