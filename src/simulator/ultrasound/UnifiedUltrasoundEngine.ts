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
    const { depth, lateral } = coords;
    
    // 1. Get tissue properties at this location
    const tissue = this.getTissueAtPosition(depth, lateral);
    
    // 2. Base echogenicity
    let intensity = this.getBaseEchogenicity(tissue.echogenicity);
    
    // 3. Realistic speckle (Rayleigh distributed)
    if (this.config.enableSpeckle) {
      const speckleIdx = y * this.canvas.width + x;
      const rayleigh = Math.abs(this.rayleighCache[speckleIdx % this.rayleighCache.length]);
      const perlin = this.perlinCache[speckleIdx % this.perlinCache.length];
      
      // Combine for organic texture
      const speckle = (rayleigh * 0.4 + (perlin * 0.5 + 0.5) * 0.6);
      intensity *= (0.5 + speckle * 0.5);
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
      if (this.isPointInInclusion(depth, lateral, inclusion)) {
        const medium = getAcousticMedium(inclusion.mediumInsideId);
        return {
          echogenicity: medium.baseEchogenicity,
          attenuation: medium.attenuation_dB_per_cm_MHz,
          reflectivity: 0.5,
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
  
  private isPointInInclusion(
    depth: number, 
    lateral: number, 
    inclusion: UltrasoundInclusionConfig
  ): boolean {
    // Convert coordinates - centerLateralPos is already in normalized units (-1 to 1)
    // Map to physical lateral position (cm) independent of beam width
    const inclLateral = inclusion.centerLateralPos * 1.75; // Fixed scale, not dependent on frequency
    const dx = lateral - inclLateral;
    const dy = depth - inclusion.centerDepthCm;
    
    if (inclusion.shape === 'circle') {
      const r = inclusion.sizeCm.width / 2;
      return (dx * dx + dy * dy) <= r * r;
    } else if (inclusion.shape === 'ellipse') {
      const rx = inclusion.sizeCm.width / 2;
      const ry = inclusion.sizeCm.height / 2;
      return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
    } else { // rectangle
      return Math.abs(dx) <= inclusion.sizeCm.width / 2 && 
             Math.abs(dy) <= inclusion.sizeCm.height / 2;
    }
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
        const isPosterior = depth > inclusion.centerDepthCm + inclusion.sizeCm.height / 2;
        if (!isPosterior) continue;
        
        const inclLateral = inclusion.centerLateralPos * (this.getBeamWidth(depth) / 2);
        const lateralDist = Math.abs(lateral - inclLateral);
        const isAligned = lateralDist < inclusion.sizeCm.width / 2;
        
        if (isAligned) {
          const posteriorDepth = depth - (inclusion.centerDepthCm + inclusion.sizeCm.height / 2);
          const falloff = Math.exp(-posteriorDepth * 1.5);
          
          if (this.config.enableAcousticShadow && inclusion.hasStrongShadow) {
            attenuationFactor *= (0.15 + 0.85 * (1 - falloff));
          }
          
          if (this.config.enablePosteriorEnhancement && inclusion.posteriorEnhancement) {
            attenuationFactor *= (1 + 0.5 * falloff);
          }
        }
      }
    } else if (tissue.inclusion) {
      // At inclusion border - add reflection
      if (tissue.inclusion.borderEchogenicity === 'sharp') {
        reflection = 0.3;
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
    const beamWidth = this.getBeamWidth(depth);
    const lateralDist = Math.abs(lateral);
    
    if (lateralDist > beamWidth / 2) {
      const excess = lateralDist - beamWidth / 2;
      return Math.exp(-excess * excess * 8);
    }
    
    return 1;
  }
  
  private getBeamWidth(depth: number): number {
    const { transducerType, frequency } = this.config;
    
    let base = 0;
    if (transducerType === 'linear') {
      base = 0.4 + depth * 0.08;
    } else if (transducerType === 'convex') {
      base = 0.8 + depth * 0.25;
    } else {
      base = 0.6 + depth * 0.15;
    }
    
    return base * (5 / frequency);
  }
  
  private pixelToPhysical(x: number, y: number): { depth: number; lateral: number } {
    const { width, height } = this.canvas;
    const depth = (y / height) * this.config.depth;
    
    let lateral = 0;
    if (this.config.transducerType === 'linear') {
      lateral = ((x / width) - 0.5) * 3.5;
    } else {
      const angle = ((x / width) - 0.5) * 0.9;
      lateral = depth * Math.tan(angle);
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
      const lateralCm = inclusion.centerLateralPos * 1.75;
      const x = this.canvas.width * 0.5 + (lateralCm / 3.5) * this.canvas.width;
      this.ctx.fillText(inclusion.label, x, y);
    }
  }
}
