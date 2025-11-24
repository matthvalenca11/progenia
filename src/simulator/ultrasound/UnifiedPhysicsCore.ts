/**
 * UNIFIED PHYSICS CORE
 * Single source of truth for all ultrasound physics
 * Based on the superior Linear transducer implementation
 * All transducers share this exact physics, only geometry differs
 */

export interface PhysicsConfig {
  frequency: number; // MHz
  depth: number; // cm
  focus: number; // cm
  gain: number; // 0-100
  dynamicRange: number; // dB
  enableSpeckle: boolean;
  enablePosteriorEnhancement: boolean;
  enableAcousticShadow: boolean;
  enableReverberation: boolean;
}

export interface TissueProperties {
  echogenicity: string;
  attenuation: number;
  reflectivity: number;
  impedance: number;
  isInclusion: boolean;
  inclusion?: any;
}

export class UnifiedPhysicsCore {
  private time: number = 0;
  private rayleighCache: Float32Array;
  private perlinCache: Float32Array;
  private cacheWidth: number;
  private cacheHeight: number;
  
  constructor(width: number, height: number) {
    this.cacheWidth = width;
    this.cacheHeight = height;
    const cacheSize = width * height;
    this.rayleighCache = new Float32Array(cacheSize);
    this.perlinCache = new Float32Array(cacheSize);
    this.generateCaches();
  }
  
  /**
   * Update time for temporal effects (motion, jitter, live noise)
   */
  updateTime(time: number): void {
    this.time = time;
  }
  
  /**
   * Generate Rayleigh and Perlin caches for speckle
   * EXACTLY as in Linear mode
   */
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
    for (let y = 0; y < this.cacheHeight; y++) {
      for (let x = 0; x < this.cacheWidth; x++) {
        const idx = y * this.cacheWidth + x;
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;
        
        // Multi-octave noise (6 octaves)
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
  
  /**
   * Apply realistic motion artifacts (breathing, jitter, tremor)
   * EXACTLY as in Linear mode
   */
  applyMotionArtifacts(depth: number, lateral: number, config: PhysicsConfig): { 
    depth: number; 
    lateral: number 
  } {
    // 1. Breathing motion (cyclic vertical displacement)
    const breathingCycle = Math.sin(this.time * 0.3) * 0.015; // ~20 breaths/min, ±0.15mm
    const breathingDepthEffect = depth / config.depth; // Deeper = more movement
    depth += breathingCycle * breathingDepthEffect;
    
    // 2. Probe micro-jitter (operator hand tremor)
    const jitterLateral = Math.sin(this.time * 8.5 + Math.cos(this.time * 12)) * 0.008; // ~8Hz tremor
    const jitterDepth = Math.cos(this.time * 7.2 + Math.sin(this.time * 9.5)) * 0.006;
    lateral += jitterLateral;
    depth += jitterDepth;
    
    // 3. Tissue micro-movements (random fibrillar motion)
    const tissueTremor = Math.sin(lateral * 100 * 0.02 + this.time * 5) * 
                         Math.cos(depth * 100 * 0.015 + this.time * 4) * 0.003;
    depth += tissueTremor;
    
    return { depth, lateral };
  }
  
  /**
   * Calculate base echogenicity
   */
  getBaseEchogenicity(echogenicity: string): number {
    switch (echogenicity) {
      case 'anechoic': return 0.05;
      case 'hypoechoic': return 0.35;
      case 'isoechoic': return 0.55;
      case 'hyperechoic': return 0.85;
      default: return 0.5;
    }
  }
  
  /**
   * Calculate realistic speckle with flow motion
   * EXACTLY as in Linear mode
   */
  calculateSpeckle(
    x: number, 
    y: number, 
    depth: number,
    lateral: number,
    tissue: TissueProperties,
    config: PhysicsConfig
  ): number {
    if (!config.enableSpeckle) return 1.0;
    
    const speckleIdx = Math.max(0, Math.min(
      this.rayleighCache.length - 1,
      y * this.cacheWidth + x
    ));
    
    const rayleigh = Math.abs(this.rayleighCache[speckleIdx]);
    const perlin = this.perlinCache[speckleIdx];
    
    // Speckle size increases with depth
    const depthFactor = 1 + depth / config.depth * 0.3;
    
    // Flow simulation for blood
    let flowOffset = 0;
    if (tissue.isInclusion && tissue.inclusion?.mediumInsideId === 'blood') {
      const inclLateral = tissue.inclusion.centerLateralPos * 2.5;
      const dx = lateral - inclLateral;
      const dy = depth - tissue.inclusion.centerDepthCm;
      const radialPos = Math.sqrt(dx * dx + dy * dy) / (tissue.inclusion.sizeCm.width / 2);
      
      const flowSpeed = (1 - radialPos * radialPos) * 0.8;
      const flowPhase = this.time * flowSpeed * 25;
      flowOffset = Math.sin(flowPhase + depth * 8 + lateral * 6) * 0.3;
      
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 1.2 * 2 * Math.PI);
      flowOffset *= pulse;
    }
    
    const speckle = (rayleigh * 0.35 + (perlin * 0.5 + 0.5) * 0.65) * depthFactor;
    return (0.4 + (speckle + flowOffset) * 0.6);
  }
  
  /**
   * Calculate attenuation with depth
   */
  calculateAttenuation(depth: number, tissue: TissueProperties, frequency: number): number {
    const attenuationDb = tissue.attenuation * frequency * depth;
    return Math.pow(10, -attenuationDb / 20);
  }
  
  /**
   * Calculate focal gain
   */
  calculateFocalGain(depth: number, focusDepth: number): number {
    const focalDist = Math.abs(depth - focusDepth);
    return 1 + 0.4 * Math.exp(-focalDist * focalDist * 2);
  }
  
  /**
   * Calculate TGC (Time Gain Compensation)
   */
  calculateTGC(depth: number, maxDepth: number, tgc?: number[]): number {
    if (!tgc || tgc.length === 0) {
      return 1 + depth / maxDepth * 0.3; // Default linear TGC
    }
    
    const idx = Math.floor((depth / maxDepth) * (tgc.length - 1));
    return Math.pow(10, tgc[idx] / 20);
  }
  
  /**
   * Calculate reverberation artifacts
   */
  calculateReverberation(depth: number): number {
    // Multiple echoes from strong reflectors
    const reverb1 = Math.sin(depth * 40) * Math.exp(-depth * 1.5) * 0.08;
    const reverb2 = Math.sin(depth * 80) * Math.exp(-depth * 2.0) * 0.04;
    return reverb1 + reverb2;
  }
  
  /**
   * Apply temporal "live" noise (chuvisco)
   * EXACTLY as in Linear mode
   */
  applyTemporalNoise(
    x: number, 
    y: number, 
    depth: number, 
    maxDepth: number,
    intensity: number
  ): number {
    // Temporal noise seed for "live" effect
    const temporalSeed = this.time * 2.5;
    const framePhase = Math.sin(this.time * 8) * 0.5 + 0.5; // Refresh cycle
    
    // Depth-dependent noise
    const depthRatio = depth / maxDepth;
    
    // Multi-frequency temporal noise (electronic noise)
    const highFreqNoise = Math.sin(x * 0.3 + y * 0.2 + temporalSeed * 12) * 0.012;
    const midFreqNoise = Math.sin(x * 0.08 + y * 0.1 + temporalSeed * 4) * 0.018;
    const lowFreqNoise = Math.sin(temporalSeed * 1.5) * 0.008;
    
    // Random per-frame variation
    const frameNoise = (Math.random() - 0.5) * 0.025 * (1 + depthRatio * 0.5);
    
    // Combine noises with depth dependency
    const totalLiveNoise = (highFreqNoise + midFreqNoise + lowFreqNoise + frameNoise) * 
                           (1 + depthRatio * 0.8);
    intensity *= (1 + totalLiveNoise);
    
    // Scanline/refresh effect
    const scanlinePos = (temporalSeed * 50) % this.cacheHeight;
    const scanlineDistance = Math.abs(y - scanlinePos);
    const scanlineEffect = Math.exp(-scanlineDistance * 0.3) * 0.015 * Math.sin(temporalSeed * 15);
    intensity *= (1 + scanlineEffect);
    
    // Vertical banding (cable interference)
    const bandingNoise = Math.sin(x * 0.15 + temporalSeed * 2) * 0.006;
    intensity *= (1 + bandingNoise);
    
    return intensity;
  }
  
  /**
   * Apply gain and dynamic range compression
   */
  applyGainAndCompression(intensity: number, gain: number, dynamicRange: number): number {
    const gainLinear = Math.pow(10, (gain - 50) / 20);
    const drFactor = dynamicRange / 60;
    
    intensity *= gainLinear;
    intensity = Math.pow(Math.max(0, intensity), drFactor);
    
    return intensity;
  }
  
  /**
   * Multi-octave noise for polar coordinates (Convex/Microconvex)
   * EXACTLY as in Linear, adapted for polar
   */
  multiOctaveNoisePolar(r: number, theta: number, octaves: number = 4): number {
    // Convert polar to pseudo-cartesian for noise
    const x = r * Math.sin(theta) * 10;
    const y = r * Math.cos(theta) * 10;
    
    // Temporal seed
    const temporalSeed = this.time * 2.5;
    
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(
        x * frequency * 0.15 + temporalSeed * 0.01,
        y * frequency * 0.15,
        1000 + i
      ) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    
    return value / maxValue;
  }
  
  private noise2D(x: number, y: number, seed: number = 0): number {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
    return n - Math.floor(n);
  }
  
  /**
   * Regenerate caches (call when resolution changes)
   */
  regenerateCaches(width: number, height: number): void {
    this.cacheWidth = width;
    this.cacheHeight = height;
    const cacheSize = width * height;
    this.rayleighCache = new Float32Array(cacheSize);
    this.perlinCache = new Float32Array(cacheSize);
    this.generateCaches();
  }
}
