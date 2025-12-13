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
import { ConvexPolarEngine } from './ConvexPolarEngine';

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
  lateralOffset?: number; // -0.3 to +0.3 (limitado para movimento lateral)
  
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
  
  // LINEAR MODE: Pre-computed shadow attenuation map (smoothed)
  private linearShadowMap: Float32Array | null = null;
  private linearShadowMapWidth: number = 0;
  private linearShadowMapHeight: number = 0;
  
  // Motor polar para convexo
  private convexEngine: ConvexPolarEngine | null = null;
  
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
    
    // Initialize linear shadow map
    this.linearShadowMapWidth = canvas.width;
    this.linearShadowMapHeight = canvas.height;
    this.linearShadowMap = new Float32Array(canvas.width * canvas.height);
    
    // Inicializar motor polar para convexo/microconvexo
    if (config.transducerType === 'convex' || config.transducerType === 'microconvex') {
      this.initConvexEngine();
    }
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
    const oldType = this.config.transducerType;
    this.config = { ...this.config, ...updates };
    
    // Regenerate caches if resolution changed
    if (updates.depth || updates.frequency) {
      this.generateCaches();
    }
    // Se mudou tipo de transdutor, reinicializar motor convexo
    if (oldType !== this.config.transducerType) {
      if (this.config.transducerType === 'convex' || this.config.transducerType === 'microconvex') {
        this.initConvexEngine();
      } else {
        this.convexEngine = null;
      }
    }
    
    // Atualizar configuração do motor convexo se existir
    if (this.convexEngine) {
      const transducerRadiusCm = this.config.transducerType === 'convex' ? 5.0 : 2.5;
      this.convexEngine.updateConfig({
        fovDegrees: this.config.transducerType === 'convex' ? 60 : 50, // Reduzido para arco mais flat
        transducerRadiusCm,
        maxDepthCm: this.config.depth,
        gain: this.config.gain,
        frequency: this.config.frequency,
        focus: this.config.focus,
        lateralOffset: this.config.lateralOffset || 0,
        layers: this.config.acousticLayers,
        inclusions: this.config.inclusions,
      });
    }
  }
  
  private initConvexEngine() {
    const fovDegrees = this.config.transducerType === 'convex' ? 60 : 50; // Reduzido para arco mais flat
    const transducerRadiusCm = this.config.transducerType === 'convex' ? 5.0 : 2.5;
    
    this.convexEngine = new ConvexPolarEngine({
      fovDegrees,
      transducerRadiusCm,
      maxDepthCm: this.config.depth,
      numDepthSamples: 512,
      numAngleSamples: 512,
      gain: this.config.gain,
      frequency: this.config.frequency,
      focus: this.config.focus,
      lateralOffset: this.config.lateralOffset || 0,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      layers: this.config.acousticLayers,
      inclusions: this.config.inclusions,
    });
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
    if (this.convexEngine) {
      this.convexEngine.stop();
    }
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
    // USAR MOTOR POLAR PURO para convexo/microconvexo
    if ((this.config.transducerType === 'convex' || this.config.transducerType === 'microconvex') && this.convexEngine) {
      this.convexEngine.render(this.ctx);
    } else {
      // LINEAR: renderização cartesiana padrão
      this.renderBMode();
    }
    
    if (this.config.mode === 'color-doppler') {
      this.renderDopplerOverlay();
    }
    
    this.renderOverlays();
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * CONVEX TRANSDUCER RENDERING - FIXED FAN SECTOR WITH DEPTH ZOOM
   * ═══════════════════════════════════════════════════════════════════════
   * The fan sector shape is FIXED. Depth control only changes the physical
   * depth range being displayed (zoom), NOT the sector geometry.
   */
  private renderPolarBMode(): void {
    const { width, height } = this.canvas;
    const imageData = this.ctx.createImageData(width, height);
    const data = imageData.data;
    
    const gainLinear = Math.pow(10, (this.config.gain - 50) / 20);
    const drFactor = this.config.dynamicRange / 60;
    
    // ═══ FIXED SECTOR GEOMETRY (NEVER CHANGES) ═══
    const sectorFOVDegrees = 90; // Total field of view - wider for convex
    const sectorAngleRad = (sectorFOVDegrees * Math.PI) / 180;
    const halfSectorAngle = sectorAngleRad / 2;
    
    // Virtual apex: CLOSER to transducer for wider fan
    // This creates the fan shape and NEVER changes with depth setting
    const virtualApexDistanceCm = 2.0; // cm above the transducer face (closer = wider fan)
    
    // FIXED: The maximum distance from apex to bottom of sector (visual geometry)
    const maxDistanceFromApex = 15.0; // cm - fixed visual sector size
    
    // Temporal seed for live effect
    const temporalSeed = this.time * 2.5;
    
    // ═══ RENDER EACH PIXEL ═══
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // ═══ 1. PIXEL → FIXED SECTOR GEOMETRY ═══
        const centerX = width / 2;
        const pixelOffsetX = x - centerX;
        
        // Y position in sector (0 = top/near, 1 = bottom/far)
        // This is FIXED geometry mapping
        const normalizedY = y / height;
        
        // Distance from virtual apex (FIXED GEOMETRY)
        const distanceFromApex = virtualApexDistanceCm + (normalizedY * maxDistanceFromApex);
        
        // Lateral position at this distance (FIXED FAN WIDTH)
        const maxLateralAtThisDistance = distanceFromApex * Math.tan(halfSectorAngle);
        const lateralCm = (pixelOffsetX / (width / 2)) * maxLateralAtThisDistance;
        
        // Calculate angle θ from center ray
        const theta = Math.atan2(lateralCm, distanceFromApex);
        
        // ═══ 2. SECTOR MASK (FIXED FAN BOUNDARY) ═══
        if (Math.abs(theta) > halfSectorAngle) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 255;
          continue;
        }
        
        // ═══ 3. MAP TO PHYSICAL DEPTH (THIS IS WHAT CHANGES WITH DEPTH CONTROL) ═══
        // The physical depth in cm that this pixel represents
        // When depth = 5cm → bottom of sector shows 5cm deep
        // When depth = 15cm → bottom of sector shows 15cm deep (zoomed out)
        const physicalDepthCm = (distanceFromApex - virtualApexDistanceCm) * (this.config.depth / maxDistanceFromApex);
        
        // Clip to valid depth range
        if (physicalDepthCm < 0 || physicalDepthCm > this.config.depth) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 255;
          continue;
        }
        
        // ═══ 4. RAY MARCH AT (θ, physical depth) ═══
        let intensity = this.convexRayMarch(theta, physicalDepthCm);
        
        // ═══ 5. SECTOR EDGE FEATHERING ═══
        const angleFromEdge = halfSectorAngle - Math.abs(theta);
        const edgeFeatherAngle = halfSectorAngle * 0.05;
        if (angleFromEdge < edgeFeatherAngle) {
          const edgeFalloff = Math.pow(angleFromEdge / edgeFeatherAngle, 2.0);
          intensity *= edgeFalloff;
        }
        
        // Near field feathering
        const nearFieldDepthCm = 0.3;
        if (physicalDepthCm < nearFieldDepthCm) {
          const nearFalloff = physicalDepthCm / nearFieldDepthCm;
          intensity *= (0.3 + 0.7 * nearFalloff);
        }
        
        // ═══ 6. TEMPORAL NOISE ═══
        const depthRatio = physicalDepthCm / this.config.depth;
        const highFreqNoise = Math.sin(x * 0.3 + y * 0.2 + temporalSeed * 12) * 0.012;
        const midFreqNoise = Math.sin(x * 0.08 + y * 0.1 + temporalSeed * 4) * 0.018;
        const lowFreqNoise = Math.sin(temporalSeed * 1.5) * 0.008;
        const frameNoise = (Math.random() - 0.5) * 0.025 * (1 + depthRatio * 0.5);
        const totalLiveNoise = (highFreqNoise + midFreqNoise + lowFreqNoise + frameNoise) * (1 + depthRatio * 0.8);
        intensity *= (1 + totalLiveNoise);
        
        // Scanline artifact
        const scanlinePos = (temporalSeed * 50) % height;
        const scanlineDistance = Math.abs(y - scanlinePos);
        const scanlineEffect = Math.exp(-scanlineDistance * 0.3) * 0.015 * Math.sin(temporalSeed * 15);
        intensity *= (1 + scanlineEffect);
        
        // ═══ 7. GAIN & COMPRESSION ═══
        intensity *= gainLinear;
        intensity = Math.pow(Math.max(0, intensity), drFactor);
        
        // ═══ 8. RENDER ═══
        const gray = Math.max(0, Math.min(255, intensity * 255));
        data[idx] = gray;
        data[idx + 1] = gray;
        data[idx + 2] = gray;
        data[idx + 3] = 255;
      }
    }
    
    this.ctx.putImageData(imageData, 0, 0);
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * CONVEX RAY MARCHING - Physics engine in POLAR coordinates
   * ═══════════════════════════════════════════════════════════════════════
   * Marches along a single diverging ray (θ, r) and accumulates physics
   */
  private convexRayMarch(theta: number, r: number): number {
    // ═══ 1. TISSUE PROPERTIES AT (θ, r) ═══
    const tissue = this.getConvexTissue(theta, r);
    
    // ═══ 2. BASE ECHOGENICITY ═══
    let intensity = this.getBaseEchogenicity(tissue.echogenicity);
    
    // ═══ 3. RAYLEIGH SPECKLE (Polar-addressed) ═══
    if (this.config.enableSpeckle) {
      const speckle = this.convexSpeckle(theta, r, tissue);
      intensity *= (0.4 + speckle * 0.6);
    }
    
    // ═══ 4. FREQUENCY-DEPENDENT ATTENUATION ═══
    // α = α₀ × f × r (depth = radial distance)
    const attenuationCoeff = tissue.attenuation; // dB/cm/MHz
    const frequencyMHz = this.config.frequency;
    const attenuationDB = attenuationCoeff * frequencyMHz * r;
    const attenuation = Math.pow(10, -attenuationDB / 20); // dB to linear
    intensity *= attenuation;
    
    // ═══ 5. FOCAL ZONE ENHANCEMENT ═══
    const focalGain = this.calculateFocalGain(r);
    intensity *= focalGain;
    
    // ═══ 6. TIME GAIN COMPENSATION (TGC) ═══
    const tgc = this.getTGC(r);
    intensity *= tgc;
    
    // ═══ 7. INTERFACE REFLECTIONS (Radial march) ═══
    const reflection = this.convexReflections(theta, r);
    intensity += reflection;
    
    // ═══ 8. RADIAL INCLUSION EFFECTS (DIVERGING Shadow + Enhancement) ═══
    const inclusionEffect = this.convexShadowAndEnhancement(theta, r, tissue);
    intensity *= inclusionEffect.attenuationFactor;
    intensity += inclusionEffect.reflection;
    
    // ═══ 9. REVERBERATION ARTIFACTS ═══
    if (this.config.enableReverberation) {
      intensity += this.calculateReverberation(r) * 0.15;
    }
    
    // ═══ 10. BEAM PROFILE (Gaussian angular distribution) ═══
    const beamProfile = this.convexBeamProfile(theta, r);
    intensity *= beamProfile;
    
    return intensity;
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * GET TISSUE IN POLAR COORDINATES with RADIAL INCLUSION DISTORTION
   * ═══════════════════════════════════════════════════════════════════════
   * Inclusions are WARPED by the polar projection (circles become ellipses)
   */
  private getConvexTissue(theta: number, r: number): {
    echogenicity: string;
    attenuation: number;
    reflectivity: number;
    impedance: number;
    isInclusion: boolean;
    inclusion?: UltrasoundInclusionConfig;
  } {
    // Convert polar (θ, r) to cartesian for inclusion testing
    const virtualApexDepth = -2.5;
    const physicalX = r * Math.sin(theta);
    const physicalY = r * Math.cos(theta) - virtualApexDepth;
    
    // ═══ CHECK INCLUSIONS WITH RADIAL DISTORTION ═══
    for (const inclusion of this.config.inclusions) {
      // Inclusion center in physical space
      const inclNormLat = inclusion.centerLateralPos; // -0.5 to +0.5
      const inclDepth = inclusion.centerDepthCm;
      
      // Map normalized lateral to physical cm
      const maxLateralExtent = this.config.depth * Math.tan((80 * Math.PI / 180) / 2);
      const inclX = inclNormLat * maxLateralExtent;
      const inclY = inclDepth;
      
      // Distance from inclusion center
      const dx = physicalX - inclX;
      const dy = physicalY - inclY;
      
      // ═══ RADIAL DISTORTION FACTOR ═══
      // Inclusions appear stretched horizontally with depth due to beam divergence
      const depthFactor = 1.0 + (r / this.config.depth) * 0.3; // 30% horizontal stretch at max depth
      const distortedDx = dx / depthFactor; // Compensate for stretch in test
      
      // Test inclusion shape with radial distortion
      let isInside = false;
      let distFromEdge = 1.0;
      
      const halfWidth = inclusion.sizeCm.width / 2;
      const halfHeight = inclusion.sizeCm.height / 2;
      
      if (inclusion.shape === 'ellipse') {
        const normX = distortedDx / halfWidth;
        const normY = dy / halfHeight;
        const dist = Math.sqrt(normX * normX + normY * normY);
        isInside = dist <= 1.0;
        distFromEdge = Math.max(0, 1.0 - dist);
      } else {
        // Rectangle
        isInside = Math.abs(distortedDx) <= halfWidth && Math.abs(dy) <= halfHeight;
        const edgeX = halfWidth - Math.abs(distortedDx);
        const edgeY = halfHeight - Math.abs(dy);
        distFromEdge = Math.min(edgeX / halfWidth, edgeY / halfHeight);
      }
      
      if (isInside) {
        const medium = getAcousticMedium(inclusion.mediumInsideId);
        
        // Smooth edge blending
        let blendFactor = 1;
        if (distFromEdge < 0.15) {
          blendFactor = Math.pow(distFromEdge / 0.15, 0.7);
        }
        
        return {
          echogenicity: medium.baseEchogenicity,
          attenuation: medium.attenuation_dB_per_cm_MHz,
          reflectivity: 0.5 * blendFactor,
          impedance: medium.acousticImpedance_MRayl,
          isInclusion: true,
          inclusion
        };
      }
    }
    
    // Anatomical layers (depth-based)
    const normalizedDepth = r / this.config.depth;
    const layer = this.getLayerAtDepth(normalizedDepth);
    
    return {
      echogenicity: layer.echogenicity,
      attenuation: layer.attenuationCoeff || 0.7,
      reflectivity: layer.reflectivity,
      impedance: 1.63,
      isInclusion: false
    };
  }
  
  /**
   * Calculate pixel intensity in POLAR coordinates
   * angle: ray angle from center (-maxAngle to +maxAngle)
   * depth: depth from transducer surface (0 to maxDepth)
   * lateral: physical lateral position (for compatibility)
   */
  private calculatePolarPixelIntensity(
    angle: number,
    depth: number,
    lateral: number
  ): number {
    // Motion artifacts
    const breathingCycle = Math.sin(this.time * 0.3) * 0.015;
    const breathingDepthEffect = depth / this.config.depth;
    let adjustedDepth = depth + breathingCycle * breathingDepthEffect;
    
    const jitterAngle = Math.sin(this.time * 8.5) * 0.002; // Angle jitter
    const jitterDepth = Math.cos(this.time * 7.2) * 0.006;
    let adjustedAngle = angle + jitterAngle;
    adjustedDepth += jitterDepth;
    
    // 1. Get tissue at this POLAR position
    const tissue = this.getPolarTissueAtPosition(adjustedAngle, adjustedDepth);
    
    // 2. Base echogenicity
    let intensity = this.getBaseEchogenicity(tissue.echogenicity);
    
    // 3. Speckle
    if (this.config.enableSpeckle) {
      // Use angle and depth for speckle addressing
      const speckleX = Math.floor((adjustedAngle + Math.PI) / (2 * Math.PI) * this.canvas.width);
      const speckleY = Math.floor((adjustedDepth / this.config.depth) * this.canvas.height);
      const speckleIdx = speckleY * this.canvas.width + speckleX;
      
      const rayleigh = Math.abs(this.rayleighCache[speckleIdx % this.rayleighCache.length]);
      const perlin = this.perlinCache[speckleIdx % this.perlinCache.length];
      
      const depthFactor = 1 + adjustedDepth / this.config.depth * 0.3;
      
      // Flow simulation for blood
      let flowOffset = 0;
      if (tissue.isInclusion && tissue.inclusion?.mediumInsideId === 'blood') {
        const radiusOfCurvature = this.config.transducerType === 'convex' ? 5.0 : 4.0;
        const distFromCenter = radiusOfCurvature + adjustedDepth;
        const currentLateral = distFromCenter * Math.sin(adjustedAngle);
        
        const inclLateral = tissue.inclusion.centerLateralPos * 2.5;
        const dx = currentLateral - inclLateral;
        const dy = adjustedDepth - tissue.inclusion.centerDepthCm;
        const radialPos = Math.sqrt(dx * dx + dy * dy) / (tissue.inclusion.sizeCm.width / 2);
        
        const flowSpeed = (1 - radialPos * radialPos) * 0.8;
        const flowPhase = this.time * flowSpeed * 25;
        flowOffset = Math.sin(flowPhase + adjustedDepth * 8 + currentLateral * 6) * 0.3;
        
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 1.2 * 2 * Math.PI);
        flowOffset *= pulse;
      }
      
      const speckle = (rayleigh * 0.35 + (perlin * 0.5 + 0.5) * 0.65) * depthFactor;
      intensity *= (0.4 + (speckle + flowOffset) * 0.6);
    }
    
    // 4. Attenuation
    const attenuation = this.calculateAttenuation(adjustedDepth, tissue);
    intensity *= attenuation;
    
    // 5. Focal gain
    const focalGain = this.calculateFocalGain(adjustedDepth);
    intensity *= focalGain;
    
    // 6. TGC
    const tgc = this.getTGC(adjustedDepth);
    intensity *= tgc;
    
    // 7. Interface reflections
    const reflection = this.calculateInterfaceReflection(adjustedDepth, lateral);
    intensity += reflection;
    
    // 8. Inclusion effects (mantido para compatibilidade - sombras específicas de geometria)
    // For polar mode, use approximated pixel coords from angle/depth
    const approxX = Math.floor((adjustedAngle + Math.PI) / (2 * Math.PI) * this.canvas.width);
    const approxY = Math.floor((adjustedDepth / this.config.depth) * this.canvas.height);
    const inclusionEffect = this.calculateInclusionEffects(approxX, approxY, depth, lateral, tissue);
    intensity *= inclusionEffect.attenuationFactor;
    intensity += inclusionEffect.reflection;
    
    // 9. Reverberation
    if (this.config.enableReverberation) {
      intensity += this.calculateReverberation(depth) * 0.15;
    }
    
    // 10. Beam geometry
    const beamFalloff = this.calculateBeamFalloff(depth, lateral);
    intensity *= beamFalloff;
    
    return intensity;
  }
  
  private renderBMode(): void {
    const { width, height } = this.canvas;
    const imageData = this.ctx.createImageData(width, height);
    const data = imageData.data;
    
    // ═══ LINEAR MODE: Pre-compute smoothed shadow map ═══
    if (this.config.transducerType === 'linear') {
      this.computeLinearShadowMap();
    }
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const physCoords = this.pixelToPhysical(x, y);
        
        // Máscara para convexo/microconvexo (mantida)
        if (this.config.transducerType === 'convex' || this.config.transducerType === 'microconvex') {
          const maxAngle = this.config.transducerType === 'convex' ? 0.61 : 0.52;
          const radiusOfCurvature = this.config.transducerType === 'convex' ? 5.0 : 4.0;
          const depth = (y / height) * this.config.depth;
          const distanceFromCenter = radiusOfCurvature + depth;
          const maxLateralCm = distanceFromCenter * Math.sin(maxAngle);
          const xCenter = width / 2;
          const fieldOfView = 15;
          const maxXOffsetPixels = (maxLateralCm / fieldOfView) * width;
          
          if (Math.abs(x - xCenter) > maxXOffsetPixels) {
            data[idx] = data[idx + 1] = data[idx + 2] = 0;
            data[idx + 3] = 255;
            continue;
          }
        }
        
        if (physCoords.depth > this.config.depth) {
          data[idx] = data[idx + 1] = data[idx + 2] = 0;
          data[idx + 3] = 255;
          continue;
        }
        
        // Calculate intensity with all physics
        let intensity = this.calculatePixelIntensity(x, y, physCoords);
        
        // Temporal "live" noise (chuvisco) - igual ao Linear
        const depthRatio = physCoords.depth / this.config.depth;
        const temporalSeed = this.time * 2.5;
        const framePhase = Math.sin(this.time * 8) * 0.5 + 0.5;
        
        const highFreqNoise = Math.sin(x * 0.3 + y * 0.2 + temporalSeed * 12) * 0.012;
        const midFreqNoise = Math.sin(x * 0.08 + y * 0.1 + temporalSeed * 4) * 0.018;
        const lowFreqNoise = Math.sin(temporalSeed * 1.5) * 0.008;
        const frameNoise = (Math.random() - 0.5) * 0.025 * (1 + depthRatio * 0.5);
        
        const totalLiveNoise = (highFreqNoise + midFreqNoise + lowFreqNoise + frameNoise) * (1 + depthRatio * 0.8);
        intensity *= (1 + totalLiveNoise);
        
        const scanlinePos = (temporalSeed * 50) % height;
        const scanlineDistance = Math.abs(y - scanlinePos);
        const scanlineEffect = Math.exp(-scanlineDistance * 0.3) * 0.015 * Math.sin(temporalSeed * 15);
        intensity *= (1 + scanlineEffect);
        
        const bandingNoise = Math.sin(x * 0.15 + temporalSeed * 2) * 0.006;
        intensity *= (1 + bandingNoise);
        
        // Apply gain and compression
        const gainLinear = Math.pow(10, (this.config.gain - 50) / 20);
        const drFactor = this.config.dynamicRange / 60;
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
  
  /**
   * Smoothstep clássico para transições suaves
   */
  private smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
  }
  
  /**
   * Linear interpolation
   */
  private lerp(a: number, b: number, t: number): number {
    return a * (1 - t) + b * t;
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * LINEAR SHADOW - CURVA ALVO IDÊNTICA AO CONVEXO
   * ═══════════════════════════════════════════════════════════════════════════════
   * 
   * DIAGNÓSTICO CONVEXO vs LINEAR:
   * ──────────────────────────────────────────────────────────────────────────────
   * CONVEXO usa:
   *   - SHADOW_STRENGTH = 0.60 (60% de redução MÁXIMA)
   *   - SHADOW_MIN_INTENSITY = 0.18
   *   - rawShadow = 1.0 - SHADOW_STRENGTH * edgeFactor * (1.0 - attenuation)
   *   - Resultado: sombra entre 0.40 e 1.0 (nunca abaixo de 40% do tecido)
   * 
   * LINEAR ANTES usava:
   *   - expAtten = Math.exp(-alpha * dz * depthScale)
   *   - targetAtten = Math.max(minIntensity, expAtten)
   *   - Problema: expAtten caía muito rápido → sombra muito escura (0.1-0.2)
   * 
   * CORREÇÃO: Usar MESMA fórmula do Convexo!
   *   - SHADOW_STRENGTH = 0.55 (55% de redução máxima → sombra mínima = 45%)
   *   - rawShadow = 1.0 - SHADOW_STRENGTH * (1.0 - expAtten)
   *   - expAtten agora é só modulador, não atenuador direto
   * ──────────────────────────────────────────────────────────────────────────────
   * 
   * CURVA ALVO DE CONTRASTE (mesmo que Convexo):
   * - início (0–5 mm): 20–30% mais escuro que o tecido
   * - meio  (5–20 mm): 40–55% mais escuro que o tecido
   * - fundo (>20 mm): 50–55% mais escuro, mas NUNCA preto
   */
  private applyLinearShadowColumnWithReference(
    shadowColumn: Float32Array,
    insideMask: boolean[],
    referenceColumn: Float32Array | null,
    depthScale: number,
    columnX: number = 0
  ): void {
    const n = shadowColumn.length;
    let exitIndex = -1;

    // 1) Encontrar último índice dentro da inclusão
    for (let z = 0; z < n; z++) {
      if (insideMask[z]) {
        exitIndex = z;
      }
    }
    
    if (exitIndex < 0) return;

    // ═══════════════════════════════════════════════════════════════════════════════
    // PARÂMETROS IDÊNTICOS AO CONVEXO - para consistência visual entre modos
    // ═══════════════════════════════════════════════════════════════════════════════
    const SHADOW_STRENGTH = 0.55;       // Mesmo que Convexo: escurece no máx 55%
    const SHADOW_MIN_INTENSITY = 0.40;  // Mínimo 40% para preservar speckle (mais alto que Convexo para Linear)
    const TRANSITION_DEPTH_PIXELS = 12; // Zona de transição suave (em pixels)
    const ALPHA_BASE = 0.35;            // Taxa de atenuação exponencial (similar ao Convexo 0.40)
    
    // 2) Aplicar sombra com VARIAÇÃO POR PIXEL
    for (let z = exitIndex + 1; z < n; z++) {
      const dz = z - exitIndex; // Distância em pixels
      const dzCm = dz * depthScale * 0.5; // Converter para cm aproximado
      
      // ═══ RUÍDO POR PIXEL - variação orgânica ═══
      const pixelSeed = columnX * 7919 + z * 104729;
      const beamNoise = 1.0 + (this.hashNoise(pixelSeed) - 0.5) * 0.12; // ±6% variação
      const alpha = ALPHA_BASE * beamNoise;
      
      // ═══ ATENUAÇÃO EXPONENCIAL SUAVE ═══
      const attenuation = Math.exp(-alpha * dzCm);
      
      // ═══ FÓRMULA IDÊNTICA AO CONVEXO ═══
      // rawShadow = 1.0 - SHADOW_STRENGTH * (1.0 - attenuation)
      // Quando attenuation=1 (perto da inclusão) → rawShadow=1.0 (sem sombra)
      // Quando attenuation=0 (muito longe) → rawShadow=0.45 (sombra máxima)
      const rawShadow = 1.0 - SHADOW_STRENGTH * (1.0 - attenuation);
      
      // Garantir mínimo para preservar speckle
      const shadowFactor = Math.max(SHADOW_MIN_INTENSITY, rawShadow);
      
      // ═══ TRANSIÇÃO SUAVE NO INÍCIO DA SOMBRA (smoothstep) ═══
      let transitionBlend = 1.0;
      if (dz < TRANSITION_DEPTH_PIXELS) {
        const t = dz / TRANSITION_DEPTH_PIXELS;
        transitionBlend = t * t * (3.0 - 2.0 * t); // smoothstep
      }
      
      // Lerp entre sem-sombra (1.0) e sombra (shadowFactor)
      const finalShadow = this.lerp(1.0, shadowFactor, transitionBlend);
      
      // Referência do tecido vizinho
      const I_ref = referenceColumn ? referenceColumn[z] : 1.0;
      
      // Aplicar atenuação relativa
      shadowColumn[z] *= finalShadow * I_ref;
    }
  }
  
  /**
   * Verifica se um ponto (depthCm, lateralCm) está dentro de uma inclusão
   */
  private isPointInsideInclusionForShadow(
    depthCm: number,
    lateralCm: number,
    inclusion: UltrasoundInclusionConfig
  ): boolean {
    const inclLateral = inclusion.centerLateralPos * 2.5; // -2.5 to +2.5 cm
    const dx = lateralCm - inclLateral;
    const dy = depthCm - inclusion.centerDepthCm;
    
    const halfW = inclusion.sizeCm.width / 2;
    const halfH = inclusion.sizeCm.height / 2;
    
    if (inclusion.shape === 'ellipse') {
      const normX = dx / halfW;
      const normY = dy / halfH;
      return (normX * normX + normY * normY) <= 1.0;
    } else {
      return Math.abs(dx) <= halfW && Math.abs(dy) <= halfH;
    }
  }
  
  /**
   * Encontra uma coluna de referência próxima que NÃO passa por inclusões
   */
  private findReferenceColumn(
    targetX: number,
    width: number,
    height: number,
    shadowInclusions: UltrasoundInclusionConfig[]
  ): Float32Array | null {
    // Tentar colunas vizinhas em ordem crescente de distância
    const offsets = [3, -3, 6, -6, 10, -10, 15, -15];
    
    for (const offset of offsets) {
      const refX = targetX + offset;
      if (refX < 0 || refX >= width) continue;
      
      const lateralCm = ((refX / width) - 0.5) * 5.0;
      let passesInclusion = false;
      
      // Verificar se esta coluna passa por alguma inclusão
      for (let y = 0; y < height && !passesInclusion; y++) {
        const depthCm = (y / height) * this.config.depth;
        for (const inclusion of shadowInclusions) {
          if (this.isPointInsideInclusionForShadow(depthCm, lateralCm, inclusion)) {
            passesInclusion = true;
            break;
          }
        }
      }
      
      // Se não passa por inclusão, usar como referência
      if (!passesInclusion) {
        // Criar coluna de referência com valores base (1.0)
        const refColumn = new Float32Array(height);
        refColumn.fill(1.0);
        return refColumn;
      }
    }
    
    return null; // Não encontrou coluna livre
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * LINEAR SHADOW MAP - COM REFERÊNCIA DE TECIDO VIZINHO
   * ═══════════════════════════════════════════════════════════════════════════════
   * 
   * Pipeline:
   * 1. Para cada coluna (feixe), construir insideMask
   * 2. Encontrar coluna vizinha de referência
   * 3. Aplicar sombra relativa ao tecido vizinho
   */
  private computeLinearShadowMap(): void {
    const { width, height } = this.canvas;
    
    // Ensure shadow map is allocated
    if (!this.linearShadowMap || this.linearShadowMap.length !== width * height) {
      this.linearShadowMap = new Float32Array(width * height);
      this.linearShadowMapWidth = width;
      this.linearShadowMapHeight = height;
    }
    
    // Initialize to no shadow (1.0 = full intensity)
    this.linearShadowMap.fill(1.0);
    
    if (!this.config.enableAcousticShadow) {
      return;
    }
    
    // Filtrar apenas inclusões com sombra forte
    const shadowInclusions = this.config.inclusions.filter(inc => inc.hasStrongShadow);
    if (shadowInclusions.length === 0) return;
    
    // Escala de profundidade: converte pixels para unidades normalizadas
    // Valor baixo = sombra cresce mais lentamente com a profundidade
    const depthScale = 0.08;
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // PARA CADA COLUNA (FEIXE VERTICAL)
    // ═══════════════════════════════════════════════════════════════════════════════
    for (let x = 0; x < width; x++) {
      // Criar coluna de shadow e máscara para esta coluna
      const shadowColumn = new Float32Array(height);
      shadowColumn.fill(1.0);
      
      const insideMask: boolean[] = new Array(height).fill(false);
      
      // Posição lateral em CM para esta coluna
      const lateralCm = ((x / width) - 0.5) * 5.0;
      
      // Construir máscara: para cada sample de profundidade
      let hasInclusion = false;
      for (let y = 0; y < height; y++) {
        const depthCm = (y / height) * this.config.depth;
        
        for (const inclusion of shadowInclusions) {
          if (this.isPointInsideInclusionForShadow(depthCm, lateralCm, inclusion)) {
            insideMask[y] = true;
            hasInclusion = true;
            break;
          }
        }
      }
      
      // Se esta coluna não passa por inclusão, pular
      if (!hasInclusion) continue;
      
      // Encontrar coluna de referência (tecido vizinho sem sombra)
      const referenceColumn = this.findReferenceColumn(x, width, height, shadowInclusions);
      
      // Aplicar sombra 1D nesta coluna com referência + posição X para variação 2D
      this.applyLinearShadowColumnWithReference(shadowColumn, insideMask, referenceColumn, depthScale, x);
      
      // Copiar resultado para o mapa 2D
      for (let y = 0; y < height; y++) {
        const idx = y * width + x;
        this.linearShadowMap[idx] = shadowColumn[y];
      }
    }
    
    // ═══ NOVO: Aplicar blur 2D para suavizar a transição na borda da inclusão ═══
    this.applyShadowMapBlur(width, height);
  }
  
  /**
   * Aplica um blur gaussiano 2D ao mapa de sombra para suavizar transições
   * Foca especialmente na região de transição inclusão → sombra
   */
  private applyShadowMapBlur(width: number, height: number): void {
    if (!this.linearShadowMap) return;
    
    // Criar cópia temporária para ler valores originais
    const original = new Float32Array(this.linearShadowMap);
    
    // Parâmetros do blur - aumentados significativamente
    const blurRadiusX = 12; // Raio horizontal maior
    const blurRadiusY = 16; // Raio vertical ainda maior para suavizar a linha horizontal
    const sigmaX = 5.0;
    const sigmaY = 7.0;
    
    // Pré-computar pesos Gaussianos horizontais
    const weightsX: number[] = [];
    let weightSumX = 0;
    for (let i = -blurRadiusX; i <= blurRadiusX; i++) {
      const w = Math.exp(-(i * i) / (2 * sigmaX * sigmaX));
      weightsX.push(w);
      weightSumX += w;
    }
    for (let i = 0; i < weightsX.length; i++) {
      weightsX[i] /= weightSumX;
    }
    
    // Pré-computar pesos Gaussianos verticais
    const weightsY: number[] = [];
    let weightSumY = 0;
    for (let i = -blurRadiusY; i <= blurRadiusY; i++) {
      const w = Math.exp(-(i * i) / (2 * sigmaY * sigmaY));
      weightsY.push(w);
      weightSumY += w;
    }
    for (let i = 0; i < weightsY.length; i++) {
      weightsY[i] /= weightSumY;
    }
    
    // Primeiro passo: blur horizontal
    const horizontalBlur = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let wSum = 0;
        for (let dx = -blurRadiusX; dx <= blurRadiusX; dx++) {
          const sx = x + dx;
          if (sx >= 0 && sx < width) {
            const w = weightsX[dx + blurRadiusX];
            sum += original[y * width + sx] * w;
            wSum += w;
          }
        }
        horizontalBlur[y * width + x] = sum / wSum;
      }
    }
    
    // Segundo passo: blur vertical (mais forte)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let wSum = 0;
        for (let dy = -blurRadiusY; dy <= blurRadiusY; dy++) {
          const sy = y + dy;
          if (sy >= 0 && sy < height) {
            const w = weightsY[dy + blurRadiusY];
            sum += horizontalBlur[sy * width + x] * w;
            wSum += w;
          }
        }
        this.linearShadowMap[y * width + x] = sum / wSum;
      }
    }
  }
  /**
   * Hash-based noise for organic variation (deterministic)
   */
  private hashNoise(seed: number): number {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }
  
  /**
   * Get shadow factor from pre-computed linear shadow map
   */
  private getLinearShadowFactor(x: number, y: number): number {
    if (!this.linearShadowMap) return 1.0;
    if (x < 0 || x >= this.linearShadowMapWidth || y < 0 || y >= this.linearShadowMapHeight) return 1.0;
    return this.linearShadowMap[y * this.linearShadowMapWidth + x];
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
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // CORRECT PIPELINE ORDER:
    // 1. Base intensity (clean, no noise)
    // 2. Physical effects (attenuation, TGC, focal gain)
    // 3. SHADOW (applied to clean image, geometry-based only)
    // 4. SPECKLE (applied last, multiplicative noise)
    // ═══════════════════════════════════════════════════════════════════════════════
    
    // 1. Get tissue properties at this location
    const tissue = this.getTissueAtPosition(depth, lateral);
    
    // 2. Base echogenicity (CLEAN - no noise)
    let intensity = this.getBaseEchogenicity(tissue.echogenicity);
    
    // 3. Frequency-dependent attenuation
    const attenuation = this.calculateAttenuation(depth, tissue);
    intensity *= attenuation;
    
    // 4. Focal zone enhancement
    const focalGain = this.calculateFocalGain(depth);
    intensity *= focalGain;
    
    // 5. Time Gain Compensation (TGC)
    const tgc = this.getTGC(depth);
    intensity *= tgc;
    
    // 6. Interface reflections (MULTIPLICATIVE, not additive)
    const reflection = this.calculateInterfaceReflection(depth, lateral);
    intensity *= (1 + reflection * 0.3);
    
    // 7. Beam geometry
    const beamFalloff = this.calculateBeamFalloff(depth, lateral);
    intensity *= beamFalloff;
    
    // 8. ═══ SHADOW - Applied BEFORE speckle, uses pre-computed clean mask ═══
    // Shadow mask is geometry-based only (no noise dependency)
    const inclusionEffect = this.calculateInclusionEffects(x, y, depth, lateral, tissue);
    intensity *= inclusionEffect.attenuationFactor;
    intensity += inclusionEffect.reflection;
    
    // 9. Reverberation artifacts (MULTIPLICATIVE, not additive)
    if (this.config.enableReverberation) {
      const reverb = this.calculateReverberation(depth);
      intensity *= (1 + reverb * 0.2); // Multiplicative, not additive
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 10. SPECKLE - MULTIPLICATIVE ONLY (NO ADDITIVE NOISE)
    // ═══════════════════════════════════════════════════════════════════════════════
    // CRITICAL: Speckle must be purely multiplicative per-pixel.
    // NO additive noise (+=), NO row-wise averaging.
    // Formula: intensity *= (1 + k * random_per_pixel)
    if (this.config.enableSpeckle) {
      const speckleIdx = y * this.canvas.width + x;
      const rayleigh = Math.abs(this.rayleighCache[speckleIdx % this.rayleighCache.length]);
      const perlin = this.perlinCache[speckleIdx % this.perlinCache.length];
      
      // Depth-dependent speckle size (deeper = coarser speckle)
      const depthFactor = 1 + (depth / this.config.depth) * 0.25;
      
      // Per-pixel granular noise (hash-based, not periodic sin/cos)
      const px = x * 0.1 + this.time * 0.5;
      const py = y * 0.1;
      const hashNoise = this.noise(px * 12.9898 + py * 78.233) * 2 - 1; // -1 to 1
      const fineHash = this.noise((px + 100) * 45.123 + (py + 50) * 91.456) * 2 - 1;
      
      // PURELY MULTIPLICATIVE speckle (never additive)
      // Base speckle from cached Rayleigh/Perlin
      const baseSpeckle = (rayleigh * 0.5 + (perlin * 0.5 + 0.5) * 0.5) * depthFactor;
      
      // Add per-pixel variation (multiplicative, not additive)
      const pixelVariation = 1.0 + hashNoise * 0.15 + fineHash * 0.1;
      
      // Combine: mean ~1, with variance
      const speckleMultiplier = (0.5 + baseSpeckle * 0.5) * pixelVariation;
      
      // Blood flow modulation (if applicable)
      let flowMultiplier = 1.0;
      if (tissue.isInclusion && tissue.inclusion?.mediumInsideId === 'blood') {
        const inclLateral = tissue.inclusion.centerLateralPos * 2.5;
        const dx = lateral - inclLateral;
        const dy = depth - tissue.inclusion.centerDepthCm;
        const radialPos = Math.sqrt(dx * dx + dy * dy) / (tissue.inclusion.sizeCm.width / 2);
        const flowSpeed = Math.max(0, 1 - radialPos * radialPos) * 0.8;
        const flowPhase = this.time * flowSpeed * 25;
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 1.2 * 2 * Math.PI);
        flowMultiplier = 1.0 + Math.sin(flowPhase + depth * 8 + lateral * 6) * 0.2 * pulse;
      }
      
      // Apply PURELY MULTIPLICATIVE speckle
      intensity *= speckleMultiplier * flowMultiplier;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 11. LOG COMPRESSION (LAST STEP - after shadow and speckle)
    // ═══════════════════════════════════════════════════════════════════════════════
    // NO clamp before this, NO threshold before this
    const gainLinear = Math.pow(10, (this.config.gain - 50) / 20);
    intensity *= gainLinear;
    
    // Log compression to map wide dynamic range to display range
    intensity = Math.log(1 + intensity * 10) / Math.log(11); // Normalize to 0-1 range
    
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
        
        // ═══ TRANSIÇÃO SUAVE EM TODA A BORDA (incluindo inferior) ═══
        // Usar distância real da borda da elipse, não linha horizontal fixa
        let blendFactor = 1;
        
        // Transição suave nas bordas - usar distanceFromEdge que já é calculado
        // corretamente para elipses/retângulos
        if (distInfo.distanceFromEdge < 0.08) {
          // Gradual transition zone baseado na distância real da borda
          const t = distInfo.distanceFromEdge / 0.08;
          blendFactor = this.smoothstep(0, 1, t);
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
  
  private calculateReverberation(depth: number): number {
    // Multiple echoes from strong reflectors
    const reverb1 = Math.sin(depth * 40) * Math.exp(-depth * 1.5) * 0.08;
    const reverb2 = Math.sin(depth * 80) * Math.exp(-depth * 2.0) * 0.04;
    return reverb1 + reverb2;
  }
  
  private getDistanceFromInclusion(
    depth: number,
    lateral: number,
    inclusion: UltrasoundInclusionConfig
  ): { isInside: boolean; distanceFromEdge: number } {
    const inclLateral = inclusion.centerLateralPos * 2.5; // 5cm field: -2.5 to +2.5
    const dx = lateral - inclLateral;
    const dy = depth - inclusion.centerDepthCm;
    
    if (inclusion.shape === 'ellipse') {
      const rx = inclusion.sizeCm.width / 2;
      const ry = inclusion.sizeCm.height / 2;
      const normalizedDist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      const isInside = normalizedDist <= 1;
      const distFromCenter = Math.sqrt(normalizedDist);
      
      // ═══ CORRIGIDO: Calcular distância real da borda mesmo quando FORA ═══
      if (isInside) {
        // Dentro: distância positiva da borda interna
        return {
          isInside: true,
          distanceFromEdge: (1 - distFromCenter) * Math.min(rx, ry)
        };
      } else {
        // Fora: distância positiva da borda externa
        // Aproximação: (distFromCenter - 1) * raio médio
        return {
          isInside: false,
          distanceFromEdge: (distFromCenter - 1) * Math.min(rx, ry)
        };
      }
    } else { // rectangle
      const halfW = inclusion.sizeCm.width / 2;
      const halfH = inclusion.sizeCm.height / 2;
      const isInside = Math.abs(dx) <= halfW && Math.abs(dy) <= halfH;
      
      if (isInside) {
        const distX = halfW - Math.abs(dx);
        const distY = halfH - Math.abs(dy);
        return {
          isInside: true,
          distanceFromEdge: Math.min(distX, distY)
        };
      } else {
        // Fora: calcular distância da borda mais próxima
        const overlapX = Math.max(0, Math.abs(dx) - halfW);
        const overlapY = Math.max(0, Math.abs(dy) - halfH);
        return {
          isInside: false,
          distanceFromEdge: Math.sqrt(overlapX * overlapX + overlapY * overlapY)
        };
      }
    }
  }
  
  private isPointInInclusion(
    depth: number, 
    lateral: number, 
    inclusion: UltrasoundInclusionConfig
  ): boolean {
    return this.getDistanceFromInclusion(depth, lateral, inclusion).isInside;
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
  
  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ACOUSTIC SHADOW - COMPLETE REWRITE v4
   * ═══════════════════════════════════════════════════════════════════════════════
   * 
   * PHYSICAL MODEL:
   * - Shadow is the consequence of cumulative attenuation along each beam
   * - Each beam is traced independently from transducer surface to max depth
   * - When beam intersects an inclusion, energy is absorbed
   * - Shadow starts EXACTLY at the exit point (z_exit) - NO GAP
   * - Formula: I(z) = I(z) × exp(-α × (z - z_exit))
   * 
   * GEOMETRY:
   * - LINEAR: Vertical parallel beams → narrow vertical shadows
   * - CONVEX/MICROCONVEX: Use ConvexPolarEngine instead
   * 
   * CRITICAL REQUIREMENTS:
   * 1. Shadow begins at EXACT exit point (no gap)
   * 2. Follows beam trajectory (vertical for linear)
   * 3. Preserves speckle (only reduces amplitude)
   * 4. Has diffuse edges (beams at edge have partial shadow)
   * 5. Darker near inclusion, gradually lighter with depth
   */
  private calculateInclusionEffects(
    x: number,
    y: number,
    depth: number,
    lateral: number,
    tissue: any
  ): { attenuationFactor: number; reflection: number } {
    let attenuationFactor = 1;
    let reflection = 0;
    
    // ═══ APLICAR SOMBRA COM TRANSIÇÃO SUAVE NA BORDA ═══
    // Ao invés de um corte abrupto em !tissue.isInclusion,
    // usar uma transição baseada na distância da borda da inclusão
    
    if (this.config.transducerType === 'linear') {
      // Calcular distância da borda da inclusão mais próxima
      let minDistFromEdge = Infinity;
      let isNearInclusion = false;
      
      for (const inclusion of this.config.inclusions) {
        const distInfo = this.getDistanceFromInclusion(depth, lateral, inclusion);
        if (distInfo.isInside) {
          // Dentro da inclusão - não aplicar sombra, mas preparar transição
          minDistFromEdge = -distInfo.distanceFromEdge; // Negativo = dentro
          isNearInclusion = true;
          break;
        } else {
          // Fora da inclusão - calcular distância
          // distanceFromEdge é 0 quando está exatamente na borda
          const distOutside = distInfo.distanceFromEdge;
          if (distOutside < minDistFromEdge) {
            minDistFromEdge = distOutside;
            isNearInclusion = distOutside < 0.3; // Zona de transição de 0.3cm
          }
        }
      }
      
      // Aplicar sombra com transição gradual
      const shadowX = ((lateral + 2.5) / 5.0) * this.canvas.width;
      const shadowY = (depth / this.config.depth) * this.canvas.height;
      const rawShadow = this.getLinearShadowFactor(Math.floor(shadowX), Math.floor(shadowY));
      
      if (tissue.isInclusion) {
        // Dentro da inclusão - usar transição suave nas bordas inferiores
        const distFromEdge = Math.abs(minDistFromEdge);
        const transitionZone = 0.15; // cm de transição
        
        if (distFromEdge < transitionZone) {
          // Perto da borda - começar a aplicar sombra gradualmente
          const t = 1.0 - (distFromEdge / transitionZone);
          const smoothT = t * t; // Quadrático para suavidade
          // Interpolar entre 1.0 (sem sombra) e rawShadow
          attenuationFactor *= this.lerp(1.0, rawShadow, smoothT * 0.5);
        }
        // Longe da borda interior - não aplica sombra
      } else {
        // Fora da inclusão - aplicar sombra com fade-in
        const transitionZone = 0.1; // cm de transição após sair da inclusão
        
        if (minDistFromEdge < transitionZone && isNearInclusion) {
          // Logo após sair da inclusão - fade-in gradual
          const t = minDistFromEdge / transitionZone;
          const smoothT = t * t * (3 - 2 * t); // Smoothstep
          attenuationFactor *= this.lerp(1.0, rawShadow, smoothT);
        } else {
          // Longe da inclusão - aplicar sombra total
          attenuationFactor *= rawShadow;
        }
      }
      
      // Posterior enhancement (for cystic/fluid structures)
      if (this.config.enablePosteriorEnhancement && !tissue.isInclusion) {
        const enhancementFactor = this.applyPosteriorEnhancement(depth, lateral);
        attenuationFactor *= enhancementFactor;
      }
    } else {
      // CONVEX/MICROCONVEX - manter lógica original
      if (!tissue.isInclusion) {
        if (this.config.enablePosteriorEnhancement) {
          const enhancementFactor = this.applyPosteriorEnhancement(depth, lateral);
          attenuationFactor *= enhancementFactor;
        }
      }
    }
    
    return { attenuationFactor, reflection };
  }
  
  // NOTE: applyLinearAcousticShadow and computeVerticalBeamExitWithMotion removed
  // Shadow is now computed via pre-calculated smoothed shadow map in computeLinearShadowMap()
  
  /**
   * Deterministic noise function (0 to 1)
   */
  private noise(seed: number): number {
    const x = Math.sin(seed * 12.9898 + seed * 0.1) * 43758.5453;
    return x - Math.floor(x);
  }
  
  /**
   * POSTERIOR ENHANCEMENT - Increased brightness behind fluid-filled structures
   */
  private applyPosteriorEnhancement(depth: number, lateral: number): number {
    let enhancementFactor = 1.0;
    
    for (const inclusion of this.config.inclusions) {
      // Only fluid-filled structures cause enhancement
      if (inclusion.mediumInsideId !== 'cyst_fluid' && 
          inclusion.mediumInsideId !== 'blood' && 
          inclusion.mediumInsideId !== 'water') continue;
      
      const inclCenterLateral = inclusion.centerLateralPos * 2.5;
      const inclHalfWidth = inclusion.sizeCm.width / 2;
      const inclHalfHeight = inclusion.sizeCm.height / 2;
      const inclusionBottomDepth = inclusion.centerDepthCm + inclHalfHeight;
      
      // Only apply below inclusion
      if (depth <= inclusionBottomDepth) continue;
      
      const posteriorDepth = depth - inclusionBottomDepth;
      const lateralDist = Math.abs(lateral - inclCenterLateral);
      
      // Check if in enhancement zone
      if (lateralDist < inclHalfWidth && posteriorDepth < 2.0) {
        // Enhancement decays with depth
        const enhancement = 0.35 * Math.exp(-posteriorDepth * 0.6);
        const lateralFalloff = 1 - (lateralDist / inclHalfWidth) * 0.3;
        enhancementFactor *= (1 + enhancement * lateralFalloff);
      }
    }
    
    return enhancementFactor;
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
      // Convex/Microconvex: radial beam pattern from center of curvature
      const beamAngle = transducerType === 'convex' ? 0.61 : 0.52;
      const radiusOfCurvature = transducerType === 'convex' ? 5.0 : 4.0;
      
      // Distance from center of curvature
      const distanceFromCenter = radiusOfCurvature + depth;
      
      // Beam half-width at this distance (radial divergence)
      const beamHalfWidth = distanceFromCenter * Math.sin(beamAngle);
      
      const lateralDist = Math.abs(lateral);
      if (lateralDist > beamHalfWidth) {
        const excess = lateralDist - beamHalfWidth;
        return Math.exp(-excess * excess * 6);
      }
      return 1;
    }
  }
  
  /**
   * Get tissue properties at POLAR coordinates
   * CRITICAL: This makes inclusions appear STRETCHED in convex mode
   */
  private getPolarTissueAtPosition(angle: number, depth: number): {
    echogenicity: string;
    attenuation: number;
    reflectivity: number;
    impedance: number;
    isInclusion: boolean;
    inclusion?: UltrasoundInclusionConfig;
  } {
    const radiusOfCurvature = 5.0; // cm (convex only)
    
    // Current position in cartesian
    const distFromCenter = radiusOfCurvature + depth;
    const lateral = distFromCenter * Math.sin(angle);
    
    // Check inclusions with CONVEX DISTORTION
    for (const inclusion of this.config.inclusions) {
      // Inclusion center in original space (normalized -0.5 to +0.5)
      const inclNormalizedLateral = inclusion.centerLateralPos; // -0.5 to +0.5
      const inclDepth = inclusion.centerDepthCm;
      
      // Convert inclusion center to actual lateral position at its depth
      const distAtInclusion = radiusOfCurvature + inclDepth;
      const inclLateral = inclNormalizedLateral * 2.5; // 5cm field
      const inclAngle = Math.asin(Math.max(-1, Math.min(1, inclLateral / distAtInclusion)));
      
      // Calculate distance in PHYSICAL space (not screen space)
      // The inclusion is defined in cm, so we work in cm
      
      // CRITICAL: For convex, we need to account for divergence
      // At the inclusion's depth, calculate its "physical" size
      // But at CURRENT depth, the same angular span covers MORE lateral distance
      
      const currentLateral = distFromCenter * Math.sin(angle);
      const inclusionCenterLateral = distAtInclusion * Math.sin(inclAngle);
      
      // Distance in lateral direction (this accounts for divergence)
      const lateralDiff = currentLateral - inclusionCenterLateral;
      const depthDiff = depth - inclDepth;
      
      // Inclusion size - but WIDTH is angular, so it maps to different lateral widths at different depths
      const inclusionAngularHalfWidth = Math.atan2(inclusion.sizeCm.width / 2, distAtInclusion);
      
      // At CURRENT depth, what lateral width does this angular width represent?
      const effectiveWidthAtCurrentDepth = distFromCenter * Math.tan(inclusionAngularHalfWidth);
      
      // Radial height stays the same
      const radialHalfHeight = inclusion.sizeCm.height / 2;
      
      // Test if we're inside the inclusion
      let isInside = false;
      let distanceFromEdge = 1.0;
      
      if (inclusion.shape === 'ellipse') {
        // Ellipse test with DEPTH-DEPENDENT width
        const normalizedLateral = lateralDiff / effectiveWidthAtCurrentDepth;
        const normalizedDepth = depthDiff / radialHalfHeight;
        const ellipseDist = Math.sqrt(normalizedLateral * normalizedLateral + normalizedDepth * normalizedDepth);
        isInside = ellipseDist <= 1.0;
        distanceFromEdge = Math.max(0, 1.0 - ellipseDist);
      } else {
        // Rectangle with depth-dependent width
        isInside = Math.abs(lateralDiff) <= effectiveWidthAtCurrentDepth && 
                   Math.abs(depthDiff) <= radialHalfHeight;
        const edgeDistLat = effectiveWidthAtCurrentDepth - Math.abs(lateralDiff);
        const edgeDistDepth = radialHalfHeight - Math.abs(depthDiff);
        distanceFromEdge = Math.min(
          edgeDistLat / effectiveWidthAtCurrentDepth,
          edgeDistDepth / radialHalfHeight
        );
      }
      
      if (isInside) {
        const medium = getAcousticMedium(inclusion.mediumInsideId);
        
        // Smooth edge transition
        const inclusionBottomDepth = inclDepth + radialHalfHeight;
        const distToBottom = Math.abs(depth - inclusionBottomDepth);
        
        let blendFactor = 1;
        if (distanceFromEdge < 0.15 && distToBottom > 0.02) {
          blendFactor = Math.pow(distanceFromEdge / 0.15, 0.7);
        }
        
        return {
          echogenicity: medium.baseEchogenicity,
          attenuation: medium.attenuation_dB_per_cm_MHz,
          reflectivity: 0.5 * blendFactor,
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
      impedance: 1.63,
      isInclusion: false
    };
  }
  
  /**
   * Calculate inclusion effects in POLAR space with DIVERGING shadows
   * CRITICAL: Shadows must DIVERGE downward, not converge!
   */
  private calculatePolarInclusionEffects(
    angle: number,
    depth: number,
    tissue: any
  ): { attenuationFactor: number; reflection: number } {
    let attenuationFactor = 1;
    let reflection = 0;
    
    if (!tissue.isInclusion) {
      const radiusOfCurvature = 5.0; // cm
      
      // === RAY MARCHING: March along THIS specific angle ===
      // This ray goes from depth=0 to current depth, at FIXED angle
      let isRayShadowed = false;
      let shadowInclusion: UltrasoundInclusionConfig | null = null;
      let shadowStartDepth = 0;
      
      const marchSteps = 50;
      for (let step = 0; step < marchSteps; step++) {
        const marchDepth = (step / marchSteps) * depth;
        if (marchDepth >= depth) break;
        
        // At marchDepth, calculate lateral position for THIS angle
        const distAtMarch = radiusOfCurvature + marchDepth;
        const lateralAtMarch = distAtMarch * Math.sin(angle);
        
        // Check if ray hits any inclusion at this marchDepth
        for (const inclusion of this.config.inclusions) {
          if (!this.config.enableAcousticShadow || !inclusion.hasStrongShadow) continue;
          
          const inclDepth = inclusion.centerDepthCm;
          const inclNormalizedLateral = inclusion.centerLateralPos;
          const inclLateral = inclNormalizedLateral * 2.5;
          
          const distAtInclusion = radiusOfCurvature + inclDepth;
          const inclAngle = Math.asin(Math.max(-1, Math.min(1, inclLateral / distAtInclusion)));
          
          const inclusionCenterLateral = distAtInclusion * Math.sin(inclAngle);
          
          const lateralDiff = lateralAtMarch - inclusionCenterLateral;
          const depthDiff = marchDepth - inclDepth;
          
          // Inclusion size with divergence
          const angularHalfWidth = Math.atan2(inclusion.sizeCm.width / 2, distAtInclusion);
          const effectiveWidthAtMarch = distAtMarch * Math.tan(angularHalfWidth);
          const radialHalfHeight = inclusion.sizeCm.height / 2;
          
          let hitInclusion = false;
          if (inclusion.shape === 'ellipse') {
            const normLat = lateralDiff / effectiveWidthAtMarch;
            const normDepth = depthDiff / radialHalfHeight;
            const dist = Math.sqrt(normLat * normLat + normDepth * normDepth);
            hitInclusion = dist <= 1.0;
          } else {
            hitInclusion = Math.abs(lateralDiff) <= effectiveWidthAtMarch && 
                          Math.abs(depthDiff) <= radialHalfHeight;
          }
          
          if (hitInclusion) {
            isRayShadowed = true;
            shadowInclusion = inclusion;
            shadowStartDepth = marchDepth;
            break;
          }
        }
        
        if (isRayShadowed) break;
      }
      
      // === Apply DIVERGING shadow ===
      if (isRayShadowed && shadowInclusion) {
        const posteriorDepth = depth - shadowStartDepth;
        const inclusionThickness = shadowInclusion.sizeCm.height;
        
        // Shadow strength based on thickness
        const thicknessFactor = Math.min(1, inclusionThickness / 2.0);
        const baseShadowStrength = 0.25 + thicknessFactor * 0.35;
        
        // Shadow texture
        const distFromCenter = radiusOfCurvature + depth;
        const lateral = distFromCenter * Math.sin(angle);
        const shadowTexture = Math.sin(posteriorDepth * 8 + lateral * 6) * 0.03;
        const shadowCore = baseShadowStrength + shadowTexture;
        
        // Depth decay
        const depthDecay = Math.exp(-posteriorDepth * 0.35);
        const finalShadowStrength = shadowCore * depthDecay;
        
        // Apply shadow attenuation
        attenuationFactor *= (0.15 + 0.85 * (1 - finalShadowStrength));
      }
      
      // === Posterior enhancement (for fluid/cysts) ===
      if (this.config.enablePosteriorEnhancement) {
        for (const inclusion of this.config.inclusions) {
          if (inclusion.mediumInsideId === 'cyst_fluid' || 
              inclusion.mediumInsideId === 'blood' || 
              inclusion.mediumInsideId === 'water') {
            
            const inclDepth = inclusion.centerDepthCm;
            const inclNormalizedLateral = inclusion.centerLateralPos;
            const inclLateral = inclNormalizedLateral * 2.5;
            
            const distAtInclusion = radiusOfCurvature + inclDepth;
            const inclAngle = Math.asin(Math.max(-1, Math.min(1, inclLateral / distAtInclusion)));
            
            const angleDiff = Math.abs(angle - inclAngle);
            const angularHalfWidth = Math.atan2(inclusion.sizeCm.width / 2, distAtInclusion);
            
            const inclusionBottomDepth = inclDepth + inclusion.sizeCm.height / 2;
            const isPosterior = depth >= inclusionBottomDepth;
            
            if (isPosterior && angleDiff < angularHalfWidth) {
              const posteriorDepth = depth - inclusionBottomDepth;
              if (posteriorDepth < 1.5) {
                const enhancementStrength = 0.25 * Math.exp(-posteriorDepth * 0.8);
                attenuationFactor *= (1 + enhancementStrength);
              }
            }
          }
        }
      }
    }
    
    return { attenuationFactor, reflection };
  }
  
  /**
   * Calculate beam falloff in POLAR space
   */
  private calculatePolarBeamFalloff(angle: number, depth: number): number {
    const maxAngle = this.config.transducerType === 'convex' ? 0.61 : 0.52;
    
    // Simple angular falloff
    if (Math.abs(angle) > maxAngle) {
      const excess = Math.abs(angle) - maxAngle;
      return Math.exp(-excess * excess * 50);
    }
    
    // Smooth edge falloff near the edges
    const edgeZone = maxAngle * 0.9;
    if (Math.abs(angle) > edgeZone) {
      const distFromEdge = (Math.abs(angle) - edgeZone) / (maxAngle - edgeZone);
      return 1 - distFromEdge * 0.3;
    }
    
    return 1;
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * CONVEX SPECKLE - Rayleigh distribution in polar coordinates
   * ═══════════════════════════════════════════════════════════════════════
   */
  private convexSpeckle(theta: number, r: number, tissue: any): number {
    // Map polar (θ, r) to cache indices
    const angleNorm = (theta + Math.PI) / (2 * Math.PI);
    const depthNorm = r / this.config.depth;
    
    const x = Math.floor(angleNorm * this.canvas.width);
    const y = Math.floor(depthNorm * this.canvas.height);
    const idx = (y * this.canvas.width + x) % this.rayleighCache.length;
    
    const rayleigh = Math.abs(this.rayleighCache[idx]);
    const perlin = this.perlinCache[idx];
    
    // Speckle size increases with depth
    const depthFactor = 1 + r / this.config.depth * 0.3;
    
    // Flow simulation for blood
    let flowOffset = 0;
    if (tissue.isInclusion && tissue.inclusion?.mediumInsideId === 'blood') {
      const virtualApexDepth = -2.5;
      const physicalX = r * Math.sin(theta);
      const physicalY = r * Math.cos(theta) - virtualApexDepth;
      
      const maxLateralExtent = this.config.depth * Math.tan((80 * Math.PI / 180) / 2);
      const inclX = tissue.inclusion.centerLateralPos * maxLateralExtent;
      const inclY = tissue.inclusion.centerDepthCm;
      
      const dx = physicalX - inclX;
      const dy = physicalY - inclY;
      const radialPos = Math.sqrt(dx * dx + dy * dy) / (tissue.inclusion.sizeCm.width / 2);
      
      const flowSpeed = (1 - radialPos * radialPos) * 0.8;
      const flowPhase = this.time * flowSpeed * 25;
      flowOffset = Math.sin(flowPhase + r * 8 + physicalX * 6) * 0.3;
      
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 1.2 * 2 * Math.PI);
      flowOffset *= pulse;
    }
    
    const speckle = (rayleigh * 0.35 + (perlin * 0.5 + 0.5) * 0.65) * depthFactor;
    return speckle + flowOffset;
  }
  
  /**
   * Calculate Rayleigh-distributed speckle for radial coordinates
   */
  private calculateRadialSpeckle(rayAngle: number, depth: number, tissue: any): number {
    // Use angle and depth to index speckle cache
    const angleNorm = (rayAngle + Math.PI) / (2 * Math.PI);
    const depthNorm = depth / this.config.depth;
    
    const x = Math.floor(angleNorm * this.canvas.width);
    const y = Math.floor(depthNorm * this.canvas.height);
    const idx = (y * this.canvas.width + x) % this.rayleighCache.length;
    
    const rayleigh = Math.abs(this.rayleighCache[idx]);
    const perlin = this.perlinCache[idx];
    
    // Speckle size increases with depth
    const depthFactor = 1 + depth / this.config.depth * 0.3;
    
    // Flow simulation for blood
    let flowOffset = 0;
    if (tissue.isInclusion && tissue.inclusion?.mediumInsideId === 'blood') {
      const radiusOfCurvature = 5.0;
      const distFromCenter = radiusOfCurvature + depth;
      const lateral = distFromCenter * Math.sin(rayAngle);
      
      const inclLat = tissue.inclusion.centerLateralPos * 2.5;
      const dx = lateral - inclLat;
      const dy = depth - tissue.inclusion.centerDepthCm;
      const radialPos = Math.sqrt(dx * dx + dy * dy) / (tissue.inclusion.sizeCm.width / 2);
      
      const flowSpeed = (1 - radialPos * radialPos) * 0.8;
      const flowPhase = this.time * flowSpeed * 25;
      flowOffset = Math.sin(flowPhase + depth * 8 + lateral * 6) * 0.3;
      
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 1.2 * 2 * Math.PI);
      flowOffset *= pulse;
    }
    
    const speckle = (rayleigh * 0.35 + (perlin * 0.5 + 0.5) * 0.65) * depthFactor;
    return speckle + flowOffset;
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * CONVEX REFLECTIONS - Interface reflections in polar space
   * ═══════════════════════════════════════════════════════════════════════
   */
  private convexReflections(theta: number, r: number): number {
    // March along this ray and detect impedance changes
    const marchSteps = 20;
    let totalReflection = 0;
    
    for (let step = 1; step < marchSteps; step++) {
      const prevDepth = (step - 1) / marchSteps * r;
      const currDepth = step / marchSteps * r;
      
      const prevTissue = this.getConvexTissue(theta, prevDepth);
      const currTissue = this.getConvexTissue(theta, currDepth);
      
      if (prevTissue.isInclusion !== currTissue.isInclusion) {
        // Interface detected - calculate reflection coefficient
        const Z1 = prevTissue.impedance;
        const Z2 = currTissue.impedance;
        const R = Math.abs((Z2 - Z1) / (Z2 + Z1));
        
        // Reflection strength depends on depth
        const reflectionStrength = R * 0.3 * Math.exp(-currDepth * 0.4);
        totalReflection += reflectionStrength;
      }
    }
    
    return totalReflection;
  }
  
  /**
   * Calculate interface reflections in radial space
   */
  private calculateRadialReflection(rayAngle: number, depth: number): number {
    // March along this ray and detect impedance changes
    const marchSteps = 20;
    let totalReflection = 0;
    
    for (let step = 1; step < marchSteps; step++) {
      const prevDepth = (step - 1) / marchSteps * depth;
      const currDepth = step / marchSteps * depth;
      
      const prevTissue = this.getConvexTissue(rayAngle, prevDepth);
      const currTissue = this.getConvexTissue(rayAngle, currDepth);
      
      if (prevTissue.isInclusion !== currTissue.isInclusion) {
        // Interface detected - calculate reflection coefficient
        const Z1 = prevTissue.impedance;
        const Z2 = currTissue.impedance;
        const R = Math.abs((Z2 - Z1) / (Z2 + Z1));
        
        // Reflection strength depends on angle and depth
        const reflectionStrength = R * 0.3 * Math.exp(-currDepth * 0.4);
        totalReflection += reflectionStrength;
      }
    }
    
    return totalReflection;
  }
  
  /**
   * Calculate DIVERGING shadows and posterior enhancement in radial space
   */
  private calculateRadialInclusionEffects(
    rayAngle: number,
    currentDepth: number,
    tissue: any
  ): { attenuationFactor: number; reflection: number } {
    let attenuationFactor = 1;
    let reflection = 0;
    
    if (!tissue.isInclusion) {
      const radiusOfCurvature = 5.0;
      
      // === RAY MARCHING: March along THIS ray from depth 0 to current ===
      let isRayShadowed = false;
      let shadowInclusion: UltrasoundInclusionConfig | null = null;
      let shadowStartDepth = 0;
      
      const marchSteps = 50;
      for (let step = 0; step < marchSteps; step++) {
        const marchDepth = (step / marchSteps) * currentDepth;
        if (marchDepth >= currentDepth) break;
        
        // Check if THIS ray hits any inclusion at marchDepth
        for (const inclusion of this.config.inclusions) {
          if (!this.config.enableAcousticShadow || !inclusion.hasStrongShadow) continue;
          
          const inclDepth = inclusion.centerDepthCm;
          const inclLat = inclusion.centerLateralPos * 2.5;
          
          const distAtInclusion = radiusOfCurvature + inclDepth;
          const inclAngle = Math.asin(Math.max(-1, Math.min(1, inclLat / distAtInclusion)));
          
          const angleDiff = rayAngle - inclAngle;
          const depthDiff = marchDepth - inclDepth;
          
          const angularHalfWidth = Math.atan2(inclusion.sizeCm.width / 2, distAtInclusion);
          const radialHalfHeight = inclusion.sizeCm.height / 2;
          
          let hitInclusion = false;
          if (inclusion.shape === 'ellipse') {
            const normAngle = angleDiff / angularHalfWidth;
            const normDepth = depthDiff / radialHalfHeight;
            const dist = Math.sqrt(normAngle * normAngle + normDepth * normDepth);
            hitInclusion = dist <= 1.0;
          } else {
            hitInclusion = Math.abs(angleDiff) <= angularHalfWidth && 
                          Math.abs(depthDiff) <= radialHalfHeight;
          }
          
          if (hitInclusion) {
            isRayShadowed = true;
            shadowInclusion = inclusion;
            shadowStartDepth = marchDepth;
            break;
          }
        }
        
        if (isRayShadowed) break;
      }
      
      // === Apply DIVERGING shadow ===
      if (isRayShadowed && shadowInclusion) {
        const posteriorDepth = currentDepth - shadowStartDepth;
        const inclusionThickness = shadowInclusion.sizeCm.height;
        
        const thicknessFactor = Math.min(1, inclusionThickness / 2.0);
        const baseShadowStrength = 0.25 + thicknessFactor * 0.35;
        
        const distFromCenter = radiusOfCurvature + currentDepth;
        const lateral = distFromCenter * Math.sin(rayAngle);
        const shadowTexture = Math.sin(posteriorDepth * 8 + lateral * 6) * 0.03;
        const shadowCore = baseShadowStrength + shadowTexture;
        
        const depthDecay = Math.exp(-posteriorDepth * 0.35);
        const finalShadowStrength = shadowCore * depthDecay;
        
        attenuationFactor *= (0.15 + 0.85 * (1 - finalShadowStrength));
      }
      
      // === Posterior enhancement ===
      if (this.config.enablePosteriorEnhancement) {
        for (const inclusion of this.config.inclusions) {
          if (inclusion.mediumInsideId === 'cyst_fluid' || 
              inclusion.mediumInsideId === 'blood' || 
              inclusion.mediumInsideId === 'water') {
            
            const inclDepth = inclusion.centerDepthCm;
            const inclLat = inclusion.centerLateralPos * 2.5;
            
            const distAtInclusion = radiusOfCurvature + inclDepth;
            const inclAngle = Math.asin(Math.max(-1, Math.min(1, inclLat / distAtInclusion)));
            
            const angleDiff = Math.abs(rayAngle - inclAngle);
            const angularHalfWidth = Math.atan2(inclusion.sizeCm.width / 2, distAtInclusion);
            
            const bottomDepth = inclDepth + inclusion.sizeCm.height / 2;
            const isPosterior = currentDepth >= bottomDepth;
            
            if (isPosterior && angleDiff < angularHalfWidth) {
              const posteriorDepth = currentDepth - bottomDepth;
              if (posteriorDepth < 1.5) {
                const enhancementStrength = 0.25 * Math.exp(-posteriorDepth * 0.8);
                attenuationFactor *= (1 + enhancementStrength);
              }
            }
          }
        }
      }
    }
    
    return { attenuationFactor, reflection };
  }
  
  /**
   * Calculate beam profile (Gaussian lateral intensity distribution)
   */
  private calculateRadialBeamProfile(rayAngle: number, depth: number): number {
    const sectorAngle = 0.87;
    
    // Simple angular falloff
    if (Math.abs(rayAngle) > sectorAngle) {
      return 0;
    }
    
    // Gaussian profile - stronger in center
    const angleRatio = Math.abs(rayAngle) / sectorAngle;
    const gaussianFalloff = Math.exp(-angleRatio * angleRatio * 0.5);
    
    return 0.6 + gaussianFalloff * 0.4;
  }
  
  /**
   * ═══ CONVEX SHADOW & POSTERIOR ENHANCEMENT ═══
   * Shadows DIVERGE along each ray (not vertical!)
   */
  private convexShadowAndEnhancement(
    rayAngle: number,
    currentDepth: number,
    tissue: any
  ): { attenuationFactor: number; reflection: number } {
    let attenuationFactor = 1;
    let reflection = 0;
    
    if (!tissue.isInclusion) {
      const virtualApex = -5.0;
      const rayDirX = Math.sin(rayAngle);
      const rayDirY = Math.cos(rayAngle);
      
      // March THIS ray from depth=0 to current checking for occlusions
      let isRayShadowed = false;
      let shadowInclusion: UltrasoundInclusionConfig | null = null;
      let shadowStartDepth = 0;
      
      const marchSteps = 40;
      for (let step = 0; step < marchSteps; step++) {
        const marchDepth = (step / marchSteps) * currentDepth;
        if (marchDepth >= currentDepth) break;
        
        const marchDist = Math.abs(virtualApex) + marchDepth;
        const marchX = marchDist * rayDirX;
        const marchY = marchDist * rayDirY;
        
        // Check if ray hits any inclusion
        for (const inclusion of this.config.inclusions) {
          if (!this.config.enableAcousticShadow || !inclusion.hasStrongShadow) continue;
          
          const fieldWidth = 5.0;
          const inclX = inclusion.centerLateralPos * fieldWidth;
          const inclY = inclusion.centerDepthCm;
          
          const dx = marchX - inclX;
          const dy = marchY - inclY;
          
          // Radial distortion
          const depthFactor = 1.0 + (marchDepth / this.config.depth) * 0.3;
          const distortedDx = dx / depthFactor;
          
          const halfWidth = inclusion.sizeCm.width / 2;
          const halfHeight = inclusion.sizeCm.height / 2;
          
          let hitInclusion = false;
          if (inclusion.shape === 'ellipse') {
            const normX = distortedDx / halfWidth;
            const normY = dy / halfHeight;
            const dist = Math.sqrt(normX * normX + normY * normY);
            hitInclusion = dist <= 1.0;
          } else {
            hitInclusion = Math.abs(distortedDx) <= halfWidth && Math.abs(dy) <= halfHeight;
          }
          
          if (hitInclusion) {
            isRayShadowed = true;
            shadowInclusion = inclusion;
            shadowStartDepth = marchDepth;
            break;
          }
        }
        
        if (isRayShadowed) break;
      }
      
      // Apply DIVERGING shadow along ray
      if (isRayShadowed && shadowInclusion) {
        const posteriorDepth = currentDepth - shadowStartDepth;
        const inclusionThickness = shadowInclusion.sizeCm.height;
        
        const thicknessFactor = Math.min(1, inclusionThickness / 2.0);
        const baseShadowStrength = 0.25 + thicknessFactor * 0.35;
        
        const distFromCenter = Math.abs(virtualApex) + currentDepth;
        const physicalX = distFromCenter * rayDirX;
        const shadowTexture = Math.sin(posteriorDepth * 8 + physicalX * 6) * 0.03;
        const shadowCore = baseShadowStrength + shadowTexture;
        
        const depthDecay = Math.exp(-posteriorDepth * 0.35);
        const finalShadowStrength = shadowCore * depthDecay;
        
        attenuationFactor *= (0.15 + 0.85 * (1 - finalShadowStrength));
      }
      
      // Posterior enhancement for anechoic inclusions
      if (this.config.enablePosteriorEnhancement) {
        for (const inclusion of this.config.inclusions) {
          if (inclusion.mediumInsideId === 'cyst_fluid' || 
              inclusion.mediumInsideId === 'blood' || 
              inclusion.mediumInsideId === 'water') {
            
            const fieldWidth = 5.0;
            const inclX = inclusion.centerLateralPos * fieldWidth;
            const inclY = inclusion.centerDepthCm;
            
            const bottomDepth = inclY + inclusion.sizeCm.height / 2;
            const isPosterior = currentDepth >= bottomDepth;
            
            if (isPosterior) {
              const distFromApex = Math.abs(virtualApex) + currentDepth;
              const currentX = distFromApex * rayDirX;
              
              const dx = currentX - inclX;
              const depthFactor = 1.0 + (currentDepth / this.config.depth) * 0.3;
              const distortedDx = dx / depthFactor;
              
              const halfWidth = inclusion.sizeCm.width / 2;
              
              if (Math.abs(distortedDx) < halfWidth) {
                const posteriorDepth = currentDepth - bottomDepth;
                if (posteriorDepth < 1.5) {
                  const enhancementStrength = 0.25 * Math.exp(-posteriorDepth * 0.8);
                  attenuationFactor *= (1 + enhancementStrength);
                }
              }
            }
          }
        }
      }
    }
    
    return { attenuationFactor, reflection };
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * CONVEX BEAM PROFILE - Gaussian angular distribution
   * ═══════════════════════════════════════════════════════════════════════
   */
  private convexBeamProfile(theta: number, r: number): number {
    const sectorAngleRad = (80 * Math.PI) / 180;
    const maxAngle = sectorAngleRad / 2;
    
    // Out of sector
    if (Math.abs(theta) > maxAngle) {
      return 0;
    }
    
    // Gaussian profile - stronger in center
    const angleRatio = Math.abs(theta) / maxAngle;
    const gaussianFalloff = Math.exp(-angleRatio * angleRatio * 0.5);
    
    return 0.6 + gaussianFalloff * 0.4;
  }
  
  private pixelToPhysical(x: number, y: number): { depth: number; lateral: number} {
    const { width, height } = this.canvas;
    const depth = (y / height) * this.config.depth;
    
    let lateral = 0;
    if (this.config.transducerType === 'linear') {
      // Linear transducer: ~5cm aperture (realistic field of view)
      lateral = ((x / width) - 0.5) * 5.0; // 5cm total width
    } else if (this.config.transducerType === 'convex') {
      // Convex: rays emanate radially from center of curvature (behind transducer)
      const maxAngle = 0.61; // ~35 degrees from center (70 degrees total)
      const radiusOfCurvature = 5.0; // cm
      
      // Each pixel X maps to an angle from the center of curvature
      const normalizedX = x / width; // 0 to 1
      const angle = (normalizedX - 0.5) * maxAngle * 2; // -0.61 to +0.61 rad
      
      // Distance from center of curvature to this depth
      const distanceFromCenter = radiusOfCurvature + depth;
      
      // Lateral position: rays diverge radially
      lateral = distanceFromCenter * Math.sin(angle);
    } else {
      // Microconvex: same principle, smaller radius
      const maxAngle = 0.52; // ~30 degrees from center (60 degrees total)
      const radiusOfCurvature = 4.0; // cm
      const normalizedX = x / width;
      const angle = (normalizedX - 0.5) * maxAngle * 2;
      const distanceFromCenter = radiusOfCurvature + depth;
      lateral = distanceFromCenter * Math.sin(angle);
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
    
    if (this.config.transducerType === 'linear') {
      // Linear: linha reta horizontal
      this.ctx.moveTo(width * 0.1, focusY);
      this.ctx.lineTo(width * 0.9, focusY);
    } else {
      // Convex/Microconvex: arco curvo COM GEOMETRIA CORRETA
      const fovDegrees = this.config.transducerType === 'convex' ? 60 : 50;
      const transducerRadiusCm = this.config.transducerType === 'convex' ? 5.0 : 2.5;
      
      // MESMA geometria correta do ConvexPolarEngine
      const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
      const centerX = width / 2;
      
      // Escala para que maxDepth coincida com fundo do canvas
      const totalDistanceFromCenter = transducerRadiusCm + this.config.depth;
      const pixelsPerCm = height / totalDistanceFromCenter;
      
      // Centro virtual posicionado corretamente
      const arcRadiusPixels = transducerRadiusCm * pixelsPerCm;
      const virtualCenterY = -arcRadiusPixels;
      
      // Raio do arco de foco (do centro virtual até a profundidade de foco)
      const focusRadiusPixels = (transducerRadiusCm + this.config.focus) * pixelsPerCm;
      
      // Desenhar arco
      this.ctx.arc(
        centerX,
        virtualCenterY,
        focusRadiusPixels,
        Math.PI / 2 - halfFOVRad,
        Math.PI / 2 + halfFOVRad
      );
    }
    
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
