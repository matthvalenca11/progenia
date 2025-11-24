/**
 * UNIFIED ULTRASOUND PHYSICS ENGINE
 * Professional-grade B-mode simulation with realistic artifacts
 * Unifies all rendering paths for consistency
 */

import { AnatomyLayer } from '@/types/ultrasoundAdvanced';
import { 
  UltrasoundInclusionConfig, 
  UltrasoundLayerConfig,
  getAcousticMedium,
  calculateReflectionCoefficient 
} from '@/types/acousticMedia';

export interface UnifiedEngineConfig {
  // Anatomical structure
  layers: AnatomyLayer[];
  acousticLayers: UltrasoundLayerConfig[];
  inclusions: UltrasoundInclusionConfig[];
  
  // Transducer settings
  transducerType: 'linear' | 'convex' | 'microconvex';
  frequency: number; // MHz
  depth: number; // cm
  focus: number; // cm
  
  // Image processing
  gain: number; // 0-100
  dynamicRange: number; // dB
  tgc: number[]; // Time Gain Compensation curve
  
  // Mode
  mode: 'b-mode' | 'color-doppler';
  
  // Artifact toggles
  enablePosteriorEnhancement: boolean;
  enableAcousticShadow: boolean;
  enableReverberation: boolean;
  enableSpeckle: boolean;
  
  // Visual overlays
  showBeamLines: boolean;
  showDepthScale: boolean;
  showFocusMarker: boolean;
  showLabels: boolean;
}

export class UnifiedUltrasoundEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: UnifiedEngineConfig;
  private animationId: number | null = null;
  private isRunning: boolean = false;
  private time: number = 0;
  
  // Performance optimization
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private targetFPS: number = 30;
  
  // Cached computation
  private rayleighCache: Float32Array;
  private perlinCache: Float32Array;
  
  constructor(canvas: HTMLCanvasElement, config: UnifiedEngineConfig) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { 
      alpha: false,
      desynchronized: true,
      willReadFrequently: false 
    });
    if (!ctx) throw new Error('Failed to get canvas context');
    this.ctx = ctx;
    this.config = config;
    
    // Initialize caches
    const cacheSize = canvas.width * canvas.height;
    this.rayleighCache = new Float32Array(cacheSize);
    this.perlinCache = new Float32Array(cacheSize);
    this.generateCaches();
  }
  
  private generateCaches(): void {
    // Rayleigh distribution for speckle amplitude
    for (let i = 0; i < this.rayleighCache.length; i++) {
      const u1 = Math.random();
      const u2 = Math.random();
      this.rayleighCache[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
    
    // Perlin-style noise for texture
    this.generatePerlinNoise();
  }
  
  private generatePerlinNoise(): void {
    const { width, height } = this.canvas;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;
        
        // Multi-octave noise
        for (let octave = 0; octave < 6; octave++) {
          const sampleX = x * frequency * 0.01;
          const sampleY = y * frequency * 0.01;
          const noiseVal = this.smoothNoise(sampleX, sampleY, octave);
          value += noiseVal * amplitude;
          maxValue += amplitude;
          amplitude *= 0.5;
          frequency *= 2;
        }
        
        this.perlinCache[idx] = value / maxValue;
      }
    }
  }
  
  private smoothNoise(x: number, y: number, seed: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43758.5453) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  }
  
  public updateConfig(updates: Partial<UnifiedEngineConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Regenerate caches if resolution changed
    if (updates.depth || updates.frequency) {
      this.generateCaches();
    }
  }
  
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.animate();
  }
  
  public stop(): void {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  public destroy(): void {
    this.stop();
  }
  
  private animate = (): void => {
    if (!this.isRunning) return;
    
    const now = performance.now();
    const elapsed = now - this.lastFrameTime;
    
    if (elapsed >= 1000 / this.targetFPS) {
      this.time = now / 1000;
      this.renderFrame();
      this.lastFrameTime = now - (elapsed % (1000 / this.targetFPS));
      this.frameCount++;
    }
    
    this.animationId = requestAnimationFrame(this.animate);
  };
  
  public renderFrame(): void {
    this.renderBMode();
    
    if (this.config.mode === 'color-doppler') {
      this.renderDopplerOverlay();
    }
    
    this.renderOverlays();
  }
  
  private renderBMode(): void {
    const { width, height } = this.canvas;
    const imageData = this.ctx.createImageData(width, height);
    const data = imageData.data;
    
    const gainLinear = Math.pow(10, (this.config.gain - 50) / 20);
    const drFactor = this.config.dynamicRange / 60;
    
    // Temporal noise seed for "live" effect
    const temporalSeed = this.time * 2.5;
    const framePhase = Math.sin(this.time * 8) * 0.5 + 0.5; // Refresh cycle
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const physCoords = this.pixelToPhysical(x, y);
        
        if (physCoords.depth > this.config.depth) {
          // Beyond scan depth
          data[idx] = data[idx + 1] = data[idx + 2] = 0;
          data[idx + 3] = 255;
          continue;
        }
        
        // Calculate intensity with all physics
        let intensity = this.calculatePixelIntensity(x, y, physCoords);
        
        // Temporal "live" noise (chuviscos) - increases with depth
        const depthRatio = physCoords.depth / this.config.depth;
        
        // Multi-frequency temporal noise (like electronic noise in transducer)
        const highFreqNoise = Math.sin(x * 0.3 + y * 0.2 + temporalSeed * 12) * 0.012;
        const midFreqNoise = Math.sin(x * 0.08 + y * 0.1 + temporalSeed * 4) * 0.018;
        const lowFreqNoise = Math.sin(temporalSeed * 1.5) * 0.008;
        
        // Random per-frame variation (electronic noise)
        const frameNoise = (Math.random() - 0.5) * 0.025 * (1 + depthRatio * 0.5);
        
        // Combine noises with depth dependency
        const totalLiveNoise = (highFreqNoise + midFreqNoise + lowFreqNoise + frameNoise) * (1 + depthRatio * 0.8);
        intensity *= (1 + totalLiveNoise);
        
        // Subtle scanline/refresh effect (mimics probe scanning motion)
        const scanlinePos = (temporalSeed * 50) % height;
        const scanlineDistance = Math.abs(y - scanlinePos);
        const scanlineEffect = Math.exp(-scanlineDistance * 0.3) * 0.015 * Math.sin(temporalSeed * 15);
        intensity *= (1 + scanlineEffect);
        
        // Very subtle vertical banding (cable/connector interference)
        const bandingNoise = Math.sin(x * 0.15 + temporalSeed * 2) * 0.006;
        intensity *= (1 + bandingNoise);
        
        // Apply gain and compression
        intensity *= gainLinear;
        intensity = Math.pow(Math.max(0, intensity), drFactor);
        
        // Convert to grayscale
        const gray = Math.max(0, Math.min(255, intensity * 255));
        data[idx] = gray;
        data[idx + 1] = gray;
        data[idx + 2] = gray;
        data[idx + 3] = 255;
      }
    }
    
    this.ctx.putImageData(imageData, 0, 0);
  }
  
  private calculatePixelIntensity(
    x: number, 
    y: number, 
    coords: { depth: number; lateral: number }
  ): number {
    let { depth, lateral } = coords;
    
    // MOTION ARTIFACTS - Realistic subtle movements
    // 1. Breathing motion (cyclic vertical displacement)
    const breathingCycle = Math.sin(this.time * 0.3) * 0.015; // ~20 breaths/min, ±0.15mm
    const breathingDepthEffect = depth / this.config.depth; // Deeper = more movement
    depth += breathingCycle * breathingDepthEffect;
    
    // 2. Probe micro-jitter (operator hand tremor)
    const jitterLateral = Math.sin(this.time * 8.5 + Math.cos(this.time * 12)) * 0.008; // ~8Hz tremor
    const jitterDepth = Math.cos(this.time * 7.2 + Math.sin(this.time * 9.5)) * 0.006;
    lateral += jitterLateral;
    depth += jitterDepth;
    
    // 3. Tissue micro-movements (random fibrillar motion)
    const tissueTremor = Math.sin(x * 0.02 + this.time * 5) * Math.cos(y * 0.015 + this.time * 4) * 0.003;
    depth += tissueTremor;
    
    // 1. Get tissue properties at this location
    const tissue = this.getTissueAtPosition(depth, lateral);
    
    // 2. Base echogenicity
    let intensity = this.getBaseEchogenicity(tissue.echogenicity);
    
    // 3. Realistic speckle with flow motion for blood
    if (this.config.enableSpeckle) {
      const speckleIdx = y * this.canvas.width + x;
      const rayleigh = Math.abs(this.rayleighCache[speckleIdx % this.rayleighCache.length]);
      const perlin = this.perlinCache[speckleIdx % this.perlinCache.length];
      
      // Speckle size increases with depth
      const depthFactor = 1 + depth / this.config.depth * 0.3;
      
      // Check if we're in blood vessel for flow simulation
      let flowOffset = 0;
      if (tissue.isInclusion && tissue.inclusion?.mediumInsideId === 'blood') {
        // REDESIGNED: Actual speckle displacement (flow simulation)
        const inclLateral = tissue.inclusion.centerLateralPos * 2.5; // 5cm field: -2.5 to +2.5
        const dx = lateral - inclLateral;
        const dy = depth - tissue.inclusion.centerDepthCm;
        const radialPos = Math.sqrt(dx * dx + dy * dy) / (tissue.inclusion.sizeCm.width / 2);
        
        // Parabolic flow profile (laminar flow - faster in center)
        const flowSpeed = (1 - radialPos * radialPos) * 0.8;
        
        // Flow direction creates phase shift in noise pattern
        const flowPhase = this.time * flowSpeed * 25;
        flowOffset = Math.sin(flowPhase + depth * 8 + lateral * 6) * 0.3;
        
        // Pulsatile modulation (arterial pulse)
        const heartRate = 1.2;
        const pulse = 0.5 + 0.5 * Math.sin(this.time * heartRate * 2 * Math.PI);
        flowOffset *= pulse;
      }
      
      // Combine for organic texture
      const speckle = (rayleigh * 0.35 + (perlin * 0.5 + 0.5) * 0.65) * depthFactor;
      intensity *= (0.4 + (speckle + flowOffset) * 0.6);
    }
    
    // 4. Frequency-dependent attenuation
    const attenuation = this.calculateAttenuation(depth, tissue);
    intensity *= attenuation;
    
    // 5. Focal zone enhancement
    const focalGain = this.calculateFocalGain(depth);
    intensity *= focalGain;
    
    // 6. Time Gain Compensation (TGC)
    const tgc = this.getTGC(depth);
    intensity *= tgc;
    
    // 7. Interface reflections
    const reflection = this.calculateInterfaceReflection(depth, lateral);
    intensity += reflection;
    
    // 8. Inclusion effects
    const inclusionEffect = this.calculateInclusionEffects(depth, lateral, tissue);
    intensity *= inclusionEffect.attenuationFactor;
    intensity += inclusionEffect.reflection;
    
    // 9. Artifacts
    if (this.config.enableReverberation) {
      intensity += this.calculateReverberation(depth) * 0.15;
    }
    
    // 10. Beam geometry
    const beamFalloff = this.calculateBeamFalloff(depth, lateral);
    intensity *= beamFalloff;
    
    return intensity;
  }
  
  private getTissueAtPosition(depth: number, lateral: number): {
    echogenicity: string;
    attenuation: number;
    reflectivity: number;
    impedance: number;
    isInclusion: boolean;
    inclusion?: UltrasoundInclusionConfig;
  } {
    // Check inclusions first (they override layers)
    for (const inclusion of this.config.inclusions) {
      const distInfo = this.getDistanceFromInclusion(depth, lateral, inclusion);
      
      if (distInfo.isInside) {
        const medium = getAcousticMedium(inclusion.mediumInsideId);
        
        // Smooth transition at border (soft tissue blending)
        // BUT: Skip transition zone at the very bottom edge to avoid gap with shadow
        const inclusionBottomDepth = inclusion.centerDepthCm + inclusion.sizeCm.height / 2;
        const distToBottom = Math.abs(depth - inclusionBottomDepth);
        
        let blendFactor = 1;
        // Only blend on sides and top, NOT on bottom (to avoid shadow gap)
        if (distInfo.distanceFromEdge < 0.05 && distToBottom > 0.02) {
          // Tighter gradual transition zone (but not at bottom)
          blendFactor = Math.pow(1 - distInfo.distanceFromEdge / 0.05, 0.7);
        }
        
        // Simplified - motion is now in speckle calculation above
        let motionFactor = 1;
        
        return {
          echogenicity: medium.baseEchogenicity,
          attenuation: medium.attenuation_dB_per_cm_MHz,
          reflectivity: 0.5 * blendFactor * motionFactor,
          impedance: medium.acousticImpedance_MRayl,
          isInclusion: true,
          inclusion
        };
      }
    }
    
    // Use anatomical layers
    const normalizedDepth = depth / this.config.depth;
    const layer = this.getLayerAtDepth(normalizedDepth);
    
    return {
      echogenicity: layer.echogenicity,
      attenuation: layer.attenuationCoeff || 0.7,
      reflectivity: layer.reflectivity,
      impedance: 1.63, // Average soft tissue
      isInclusion: false
    };
  }
  
  private getLayerAtDepth(normalizedDepth: number): AnatomyLayer {
    for (const layer of this.config.layers) {
      if (normalizedDepth >= layer.depthRange[0] && normalizedDepth <= layer.depthRange[1]) {
        return layer;
      }
    }
    
    // Default fallback
    return {
      name: 'Generic',
      depthRange: [0, 1],
      reflectivity: 0.5,
      echogenicity: 'isoechoic',
      texture: 'homogeneous',
      attenuationCoeff: 0.7
    };
  }
  
  private getDistanceFromInclusion(
    depth: number,
    lateral: number,
    inclusion: UltrasoundInclusionConfig
  ): { isInside: boolean; distanceFromEdge: number } {
    const inclLateral = inclusion.centerLateralPos * 2.5; // 5cm field: -2.5 to +2.5
    const dx = lateral - inclLateral;
    const dy = depth - inclusion.centerDepthCm;
    
    if (inclusion.shape === 'circle') {
      // For circles, use the average of width and height as radius
      const r = (inclusion.sizeCm.width + inclusion.sizeCm.height) / 4;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      return {
        isInside: distFromCenter <= r,
        distanceFromEdge: Math.abs(r - distFromCenter)
      };
    } else if (inclusion.shape === 'ellipse') {
      const rx = inclusion.sizeCm.width / 2;
      const ry = inclusion.sizeCm.height / 2;
      const normalizedDist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      const isInside = normalizedDist <= 1;
      const distFromCenter = Math.sqrt(normalizedDist);
      return {
        isInside,
        distanceFromEdge: Math.abs(1 - distFromCenter) * Math.min(rx, ry)
      };
    } else { // rectangle
      const halfW = inclusion.sizeCm.width / 2;
      const halfH = inclusion.sizeCm.height / 2;
      const isInside = Math.abs(dx) <= halfW && Math.abs(dy) <= halfH;
      const distX = halfW - Math.abs(dx);
      const distY = halfH - Math.abs(dy);
      return {
        isInside,
        distanceFromEdge: Math.min(distX, distY)
      };
    }
  }
  
  private isPointInInclusion(
    depth: number, 
    lateral: number, 
    inclusion: UltrasoundInclusionConfig
  ): boolean {
    return this.getDistanceFromInclusion(depth, lateral, inclusion).isInside;
  }
  
  private getBaseEchogenicity(echogenicity: string): number {
    switch (echogenicity) {
      case 'anechoic': return 0.05;
      case 'hypoechoic': return 0.35;
      case 'isoechoic': return 0.55;
      case 'hyperechoic': return 0.85;
      default: return 0.5;
    }
  }
  
  private calculateAttenuation(depth: number, tissue: any): number {
    const attenuationDb = tissue.attenuation * this.config.frequency * depth;
    return Math.pow(10, -attenuationDb / 20);
  }
  
  private calculateFocalGain(depth: number): number {
    const focalDist = Math.abs(depth - this.config.focus);
    return 1 + 0.4 * Math.exp(-focalDist * focalDist * 2);
  }
  
  private getTGC(depth: number): number {
    if (!this.config.tgc || this.config.tgc.length === 0) {
      return 1 + depth / this.config.depth * 0.3; // Default linear TGC
    }
    
    const idx = Math.floor((depth / this.config.depth) * (this.config.tgc.length - 1));
    return Math.pow(10, this.config.tgc[idx] / 20);
  }
  
  private calculateInterfaceReflection(depth: number, lateral: number): number {
    let reflection = 0;
    
    // Check acoustic layer interfaces
    let cumulativeDepth = 0;
    for (let i = 0; i < this.config.acousticLayers.length - 1; i++) {
      cumulativeDepth += this.config.acousticLayers[i].thicknessCm;
      const distToInterface = Math.abs(depth - cumulativeDepth);
      
      if (distToInterface < 0.15) {
        const m1 = getAcousticMedium(this.config.acousticLayers[i].mediumId);
        const m2 = getAcousticMedium(this.config.acousticLayers[i + 1].mediumId);
        const R = calculateReflectionCoefficient(
          m1.acousticImpedance_MRayl,
          m2.acousticImpedance_MRayl
        );
        reflection += Math.abs(R) * Math.exp(-distToInterface * distToInterface * 100);
      }
    }
    
    return reflection * 0.6;
  }
  
  private calculateInclusionEffects(
    depth: number, 
    lateral: number,
    tissue: any
  ): { attenuationFactor: number; reflection: number } {
    let attenuationFactor = 1;
    let reflection = 0;
    
    if (!tissue.isInclusion) {
      // Check if we're in shadow/enhancement zone
      for (const inclusion of this.config.inclusions) {
        const inclusionBottomDepth = inclusion.centerDepthCm + inclusion.sizeCm.height / 2;
        
        // Check if we're at the exact bottom edge or just below
        const atBottomEdge = Math.abs(depth - inclusionBottomDepth) < 0.01;
        
        // Log for the very first pixels after bottom edge
        if (atBottomEdge && this.frameCount % 60 === 0) {
          console.log('Bottom edge check:', {
            depth,
            inclusionBottomDepth,
            diff: depth - inclusionBottomDepth,
            isInclusion: tissue.isInclusion
          });
        }
        
        const isPosterior = depth >= inclusionBottomDepth;
        if (!isPosterior) continue;
        
        // Convert inclusion lateral position to physical coordinates
        const inclLateral = inclusion.centerLateralPos * 2.5; // 5cm field: -2.5 to +2.5
        const lateralDist = Math.abs(lateral - inclLateral);
        
        // Distance behind the inclusion (starts at 0 immediately after bottom edge)
        const posteriorDepth = depth - inclusionBottomDepth;
        
        // Acoustic shadow - physics-based with thickness-dependent intensity
        if (this.config.enableAcousticShadow && inclusion.hasStrongShadow) {
          const inclusionThickness = inclusion.sizeCm.height;
          
          // Ray-based shadow calculation
          const inclusionTop = inclusion.centerDepthCm - inclusion.sizeCm.height / 2;
          const inclusionBottom = inclusion.centerDepthCm + inclusion.sizeCm.height / 2;
          
          // Only apply shadow posterior to the inclusion (IMMEDIATELY after)
          if (depth >= inclusionBottom) {
            const posteriorDepth = depth - inclusionBottom;
            const inclLateral = inclusion.centerLateralPos * 2.5; // 5cm field: -2.5 to +2.5
            
            // Calculate effective width at the bottom edge of inclusion
            let effectiveWidth;
            if (inclusion.shape === 'circle') {
              effectiveWidth = (inclusion.sizeCm.width + inclusion.sizeCm.height) / 4;
            } else if (inclusion.shape === 'ellipse') {
              // For ellipse, width at bottom edge
              effectiveWidth = inclusion.sizeCm.width / 2;
            } else {
              // Rectangle
              effectiveWidth = inclusion.sizeCm.width / 2;
            }
            
            // Shadow intensity based on thickness (thicker = stronger shadow)
            const thicknessFactor = Math.min(1, inclusionThickness / 2.0);
            const baseShadowStrength = 0.25 + thicknessFactor * 0.35; // 25% to 60% (more realistic)
            
            // Shadow spread depends on transducer type
            // Linear: nearly parallel (minimal spread)
            // Convex/micro: conical spread
            const shadowSpreadAngle = this.config.transducerType === 'linear' ? 0.005 : 0.02;
            const shadowHalfWidth = effectiveWidth + posteriorDepth * Math.tan(shadowSpreadAngle);
            
            const distFromShadowCenter = Math.abs(lateral - inclLateral);
            
            if (distFromShadowCenter < shadowHalfWidth * 2) {
              // Core shadow (umbra) - intensity varies with thickness
              if (distFromShadowCenter < shadowHalfWidth * 0.85) {
                const internalTexture = Math.sin(posteriorDepth * 8 + lateral * 6) * 0.03;
                const shadowCore = baseShadowStrength + internalTexture;
                
                // Depth decay
                const depthDecay = Math.exp(-posteriorDepth * 0.35);
                const finalShadowStrength = shadowCore * depthDecay;
                
                attenuationFactor *= (0.15 + 0.85 * (1 - finalShadowStrength)); // Less aggressive attenuation
              }
              // Penumbra - also affected by thickness
              else if (distFromShadowCenter < shadowHalfWidth * 1.5) {
                const edgeDist = (distFromShadowCenter - shadowHalfWidth * 0.85) / (shadowHalfWidth * 0.65);
                const penumbraStrength = (baseShadowStrength * 0.6) * Math.exp(-edgeDist * edgeDist * 2);
                
                const depthDecay = Math.exp(-posteriorDepth * 0.4);
                attenuationFactor *= (0.45 + 0.55 * (1 - penumbraStrength * depthDecay)); // Less dark
              }
              // Outer fade
              else {
                const outerDist = (distFromShadowCenter - shadowHalfWidth * 1.5) / (shadowHalfWidth * 0.5);
                const outerFade = (baseShadowStrength * 0.3) * Math.exp(-outerDist * outerDist * 3);
                
                const depthDecay = Math.exp(-posteriorDepth * 0.5);
                attenuationFactor *= (0.7 + 0.3 * (1 - outerFade * depthDecay)); // Subtle fade
              }
            }
          }
        }
        
        // Posterior enhancement (for cystic/fluid structures)
        if (this.config.enablePosteriorEnhancement && inclusion.posteriorEnhancement) {
          // Enhancement zone is focused and symmetrical
          const enhancementWidth = inclusion.sizeCm.width * 0.8;
          
          if (lateralDist < enhancementWidth * 1.2) {
            // Gaussian lateral profile (brightest at center)
            const lateralProfile = Math.exp(-Math.pow(lateralDist / enhancementWidth, 2) * 2);
            
            // Depth profile: peaks slightly below inclusion, then fades
            const optimalDepth = 0.3; // cm below inclusion where enhancement peaks
            const depthProfile = Math.exp(-Math.pow((posteriorDepth - optimalDepth) / 0.8, 2));
            
            // Combine for realistic enhancement
            const enhancementStrength = lateralProfile * depthProfile;
            
            // Strong enhancement (60% brightness increase)
            attenuationFactor *= (1 + 0.6 * enhancementStrength);
          }
        }
      }
    } else if (tissue.inclusion) {
      // At inclusion edge - realistic border rendering
      const inclLateral = tissue.inclusion.centerLateralPos * 2.5; // 5cm field: -2.5 to +2.5
      const dx = lateral - inclLateral;
      const dy = depth - tissue.inclusion.centerDepthCm;
      
      // Calculate distance from edge based on shape
      let edgeDistance = 0;
      
      if (tissue.inclusion.shape === 'circle') {
        const r = (tissue.inclusion.sizeCm.width + tissue.inclusion.sizeCm.height) / 4;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        edgeDistance = Math.abs(distFromCenter - r);
      } else if (tissue.inclusion.shape === 'ellipse') {
        const rx = tissue.inclusion.sizeCm.width / 2;
        const ry = tissue.inclusion.sizeCm.height / 2;
        const normalizedDist = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
        edgeDistance = Math.abs(normalizedDist - 1) * Math.min(rx, ry);
      } else { // rectangle
        const halfW = tissue.inclusion.sizeCm.width / 2;
        const halfH = tissue.inclusion.sizeCm.height / 2;
        const distX = halfW - Math.abs(dx);
        const distY = halfH - Math.abs(dy);
        edgeDistance = Math.min(Math.abs(distX), Math.abs(distY));
      }
      
      // Multi-layer border rendering for realism
      if (tissue.inclusion.borderEchogenicity === 'sharp') {
        // Outer specular highlight (bright reflection)
        if (edgeDistance < 0.15) {
          const outerHighlight = Math.exp(-Math.pow(edgeDistance / 0.08, 2)) * 0.35;
          reflection += outerHighlight;
        }
        
        // Inner bright rim (interface reflection)
        if (edgeDistance < 0.05) {
          const innerRim = Math.exp(-Math.pow(edgeDistance / 0.025, 2)) * 0.25;
          reflection += innerRim;
        }
        
        // Angular-dependent specular reflection (realistic beam angle effects)
        const angle = Math.atan2(dy, dx);
        const beamAngleFactor = Math.abs(Math.cos(angle)) * 0.15;
        if (edgeDistance < 0.1) {
          reflection += beamAngleFactor * Math.exp(-edgeDistance * edgeDistance * 80);
        }
      } else {
        // Soft border - gentle transition
        if (edgeDistance < 0.12) {
          reflection += 0.15 * Math.exp(-Math.pow(edgeDistance / 0.06, 2));
        }
      }
    }
    
    return { attenuationFactor, reflection };
  }
  
  private calculateReverberation(depth: number): number {
    let reverb = 0;
    const intervals = [0.8, 1.6, 2.4, 3.2];
    
    for (const interval of intervals) {
      const mod = depth % interval;
      if (mod < 0.08) {
        reverb += (0.08 - mod) * Math.exp(-depth * 0.4);
      }
    }
    
    return reverb;
  }
  
  private calculateBeamFalloff(depth: number, lateral: number): number {
    const { transducerType } = this.config;
    
    // For convex/microconvex: beam DIVERGES (gets wider with depth)
    // For linear: beam stays relatively parallel
    
    if (transducerType === 'linear') {
      // Linear: nearly parallel beam, very minimal lateral falloff
      const beamHalfWidth = 2.5; // cm, relatively constant
      const lateralDist = Math.abs(lateral);
      if (lateralDist > beamHalfWidth) {
        const excess = lateralDist - beamHalfWidth;
        return Math.exp(-excess * excess * 8);
      }
      return 1;
    } else {
      // Convex/Microconvex: fan-shaped beam that DIVERGES
      // Calculate maximum lateral extent at this depth based on beam angle
      const beamAngle = transducerType === 'convex' ? 0.61 : 0.52; // radians
      const surfaceAperture = transducerType === 'convex' ? 3.0 : 2.0;
      
      // At this depth, the beam half-width INCREASES with depth (divergence)
      const beamHalfWidth = (surfaceAperture / 2) + (depth * Math.tan(beamAngle));
      
      const lateralDist = Math.abs(lateral);
      if (lateralDist > beamHalfWidth) {
        const excess = lateralDist - beamHalfWidth;
        return Math.exp(-excess * excess * 6);
      }
      return 1;
    }
  }
  
  private pixelToPhysical(x: number, y: number): { depth: number; lateral: number } {
    const { width, height } = this.canvas;
    const depth = (y / height) * this.config.depth;
    
    let lateral = 0;
    if (this.config.transducerType === 'linear') {
      // Linear transducer: ~5cm aperture (realistic field of view)
      lateral = ((x / width) - 0.5) * 5.0; // 5cm total width
    } else if (this.config.transducerType === 'convex') {
      // Convex: Fan-shaped beam that DIVERGES (opens up) with depth
      // Total beam angle ~70 degrees (±35 degrees from center)
      const maxAngle = 0.61; // ~35 degrees in radians
      const normalizedX = (x / width) - 0.5; // -0.5 to +0.5
      const angle = normalizedX * 2 * maxAngle; // -0.61 to +0.61 rad
      
      // Small aperture at surface (3cm), then pure angle-based divergence
      const surfaceAperture = 3.0;
      
      // At depth=0: narrow aperture
      // As depth increases: lateral position grows with tan(angle) - DIVERGES
      lateral = (surfaceAperture * normalizedX) + (depth * Math.tan(angle));
    } else {
      // Microconvex: Similar but smaller
      const maxAngle = 0.52; // ~30 degrees
      const normalizedX = (x / width) - 0.5;
      const angle = normalizedX * 2 * maxAngle;
      const surfaceAperture = 2.0;
      lateral = (surfaceAperture * normalizedX) + (depth * Math.tan(angle));
    }
    
    return { depth, lateral };
  }
  
  private renderDopplerOverlay(): void {
    // Doppler implementation (placeholder for now)
    // Would show flow in vessels
  }
  
  private renderOverlays(): void {
    if (this.config.showBeamLines) this.drawBeamLines();
    if (this.config.showDepthScale) this.drawDepthScale();
    if (this.config.showFocusMarker) this.drawFocusMarker();
    if (this.config.showLabels) this.drawLabels();
  }
  
  private drawBeamLines(): void {
    const { width, height } = this.canvas;
    this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
    this.ctx.lineWidth = 1;
    
    if (this.config.transducerType === 'linear') {
      for (let i = 0; i < 5; i++) {
        const x = (i / 4) * width;
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, height);
        this.ctx.stroke();
      }
    } else {
      const centerX = width / 2;
      for (let i = 0; i < 9; i++) {
        const angle = ((i / 8) - 0.5) * 0.9;
        const endX = centerX + Math.tan(angle) * height;
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, 0);
        this.ctx.lineTo(endX, height);
        this.ctx.stroke();
      }
    }
  }
  
  private drawDepthScale(): void {
    const { height } = this.canvas;
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.font = '11px monospace';
    
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const y = (i / steps) * height;
      const depth = (i / steps) * this.config.depth;
      this.ctx.fillText(`${depth.toFixed(1)}cm`, 5, y + 12);
    }
  }
  
  private drawFocusMarker(): void {
    const { width, height } = this.canvas;
    const focusY = (this.config.focus / this.config.depth) * height;
    
    this.ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(width * 0.1, focusY);
    this.ctx.lineTo(width * 0.9, focusY);
    this.ctx.stroke();
  }
  
  private drawLabels(): void {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.font = 'bold 12px sans-serif';
    
    for (const inclusion of this.config.inclusions) {
      const y = (inclusion.centerDepthCm / this.config.depth) * this.canvas.height;
      // Use same fixed scale as isPointInInclusion
      const lateralCm = inclusion.centerLateralPos * 2.5; // 5cm field: -2.5 to +2.5
      const x = this.canvas.width * 0.5 + (lateralCm / 5.0) * this.canvas.width * 2;
      this.ctx.fillText(inclusion.label, x, y);
    }
  }
}
