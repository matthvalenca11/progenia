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

export type LinearDebugView = 'base' | 'base_shadow' | 'final';

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
  
  // === CORE IMAGING ===
  showStructuralBMode: boolean;        // Main B-mode rendering toggle
  
  // === ARTIFACT TOGGLES ===
  enablePosteriorEnhancement: boolean; // Brightness increase behind anechoic structures
  enableAcousticShadow: boolean;       // Dark shadows behind hyperechoic structures
  enableReverberation: boolean;        // Multiple echo artifacts
  enableNearFieldClutter: boolean;     // Increased noise in superficial region
  enableSpeckle: boolean;              // Base speckle texture
  
  // === VISUAL OVERLAYS (Orientation elements) ===
  showBeamLines: boolean;              // Beam direction lines overlay
  showDepthScale: boolean;             // Depth markers (cm) on the side
  showFocusMarker: boolean;            // Focus zone indicator (triangle/arc)
  
  // === DIDACTIC OVERLAYS ===
  showFieldLines: boolean;             // Concentric wave propagation arcs
  showAttenuationMap: boolean;         // Semi-transparent attenuation gradient overlay
  showAnatomyLabels: boolean;          // Text labels for anatomical layers
  
  // === ADVANCED FEATURES ===
  showPhysicsPanel: boolean;           // Real-time physics parameters panel
  enableColorDoppler: boolean;         // Color flow overlay (blue/red for vessels)
  
  // === DEBUG ===
  linearDebugView?: LinearDebugView;
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
  
  // LINEAR MODE: Shadow data
  private linearShadowFactors: Float32Array | null = null;
  private linearZExits: Int32Array | null = null;
  private linearShadowMap: Float32Array | null = null; // Mapa 2D de sombra
  
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
    
    // Initialize linear shadow arrays
    this.linearShadowFactors = new Float32Array(canvas.width);
    this.linearZExits = new Int32Array(canvas.width);
    
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
  
  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * FREQUENCY-DEPENDENT RESOLUTION (PSF) PARAMETERS
   * ═══════════════════════════════════════════════════════════════════════════════
   * 
   * Physical model:
   * - Axial resolution ∝ λ/2 = c/(2f), so higher f → better axial resolution
   * - Lateral resolution ∝ λ × F# = c × F# / f, so higher f → better lateral resolution
   * - Speckle grain size scales similarly
   * 
   * We model this as blur sigma inversely proportional to frequency:
   *   sigma(f) = k × (f_ref / f)
   * 
   * where f_ref = 7.5 MHz is our reference frequency
   */
  private getFrequencyDependentPSF(): { sigmaAxial: number; sigmaLateral: number; speckleScale: number } {
    const f = this.config.frequency;
    const fRef = 11.0; // Reference = max frequency for linear
    
    // Stronger blur constants for visible resolution effect
    const kAxial = 0.8;   // Increased from 0.15
    const kLateral = 1.0; // Increased from 0.2
    
    const frequencyRatio = fRef / f;
    
    // Gradual scaling from high to low frequency
    // At 11 MHz: ratio=1.0, sigma=0 (sharpest)
    // At 5 MHz: ratio=2.2, sigmaAxial=0.96, sigmaLateral=1.2
    // At 2 MHz: ratio=5.5, sigmaAxial=3.6, sigmaLateral=4.5
    const sigmaAxial = kAxial * Math.max(0, frequencyRatio - 1.0);
    const sigmaLateral = kLateral * Math.max(0, frequencyRatio - 1.0);
    
    // Speckle grain: more noticeable scaling (20% effect)
    const speckleScale = 1.0 + (frequencyRatio - 1.0) * 0.2;
    
    return { sigmaAxial, sigmaLateral, speckleScale };
  }
  
  /**
   * Apply separable Gaussian blur to a Float32Array image buffer
   * Uses frequency-dependent sigma for PSF simulation
   */
  private applyFrequencyDependentBlur(buffer: Float32Array, width: number, height: number): void {
    const psf = this.getFrequencyDependentPSF();
    
    // Skip blur if sigmas are too small (high frequency = sharp image)
    if (psf.sigmaAxial < 0.8 && psf.sigmaLateral < 0.8) {
      return;
    }
    
    // Temporary buffer for separable convolution
    const temp = new Float32Array(buffer.length);
    
    // ═══ HORIZONTAL BLUR (Lateral PSF) ═══
    const radiusH = Math.ceil(psf.sigmaLateral * 2);
    if (radiusH >= 1) {
      const kernelH = this.createGaussianKernel1D(psf.sigmaLateral, radiusH);
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let sum = 0;
          let weightSum = 0;
          
          for (let k = -radiusH; k <= radiusH; k++) {
            const sx = Math.max(0, Math.min(width - 1, x + k));
            const weight = kernelH[k + radiusH];
            sum += buffer[y * width + sx] * weight;
            weightSum += weight;
          }
          
          temp[y * width + x] = sum / weightSum;
        }
      }
      
      // Copy back
      buffer.set(temp);
    }
    
    // ═══ VERTICAL BLUR (Axial PSF) ═══
    const radiusV = Math.ceil(psf.sigmaAxial * 2);
    if (radiusV >= 1) {
      const kernelV = this.createGaussianKernel1D(psf.sigmaAxial, radiusV);
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let sum = 0;
          let weightSum = 0;
          
          for (let k = -radiusV; k <= radiusV; k++) {
            const sy = Math.max(0, Math.min(height - 1, y + k));
            const weight = kernelV[k + radiusV];
            sum += buffer[sy * width + x] * weight;
            weightSum += weight;
          }
          
          temp[y * width + x] = sum / weightSum;
        }
      }
      
      // Copy back
      buffer.set(temp);
    }
  }
  
  /**
   * Create 1D Gaussian kernel
   */
  private createGaussianKernel1D(sigma: number, radius: number): Float32Array {
    const size = radius * 2 + 1;
    const kernel = new Float32Array(size);
    const sigma2 = sigma * sigma * 2;
    
    for (let i = 0; i < size; i++) {
      const x = i - radius;
      kernel[i] = Math.exp(-(x * x) / sigma2);
    }
    
    return kernel;
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
    // ═══════════════════════════════════════════════════════════════════════════════
    // SHOW STRUCTURAL B-MODE TOGGLE
    // When disabled, render blank screen with message
    // ═══════════════════════════════════════════════════════════════════════════════
    if (!this.config.showStructuralBMode) {
      this.renderBlankScreen();
      this.renderOverlays();
      return;
    }
    
    // USAR MOTOR POLAR PURO para convexo/microconvexo
    if ((this.config.transducerType === 'convex' || this.config.transducerType === 'microconvex') && this.convexEngine) {
      this.convexEngine.render(this.ctx);
    } else {
      // LINEAR: renderização cartesiana padrão
      this.renderBMode();
    }
    
    // Color Doppler overlay (only when enabled)
    if (this.config.mode === 'color-doppler' || this.config.enableColorDoppler) {
      this.renderDopplerOverlay();
    }
    
    this.renderOverlays();
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * BLANK SCREEN - Rendered when showStructuralBMode is OFF
   * ═══════════════════════════════════════════════════════════════════════════════
   */
  private renderBlankScreen(): void {
    const { width, height } = this.canvas;
    
    // Dark gray background
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, width, height);
    
    // "No Image" message
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.font = 'bold 16px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Modo B desativado', width / 2, height / 2 - 10);
    this.ctx.font = '12px sans-serif';
    this.ctx.fillText('Ative "Imagem estrutural" para visualizar', width / 2, height / 2 + 15);
    this.ctx.textAlign = 'left';
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
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // LINEAR MODE: DEBUG com 3 buffers separados
    // ═══════════════════════════════════════════════════════════════════════════════
    if (this.config.transducerType === 'linear') {
      // Compute shadow data
      this.computeLinearShadow();
      
      // Debug view mode
      const debugView = this.config.linearDebugView || 'final';
      
      // ═══ BUFFER 1: image_base (SEM sombra) ═══
      // ═══ BUFFER 2: image_with_shadow (base + shadow only) ═══
      // ═══ BUFFER 3: image_final (com todo pós-processamento) ═══
      const image_base = new Float32Array(width * height);
      const image_with_shadow = new Float32Array(width * height);
      const image_final = new Float32Array(width * height);
      
      // PASSO 1: Gerar image_base (intensidade SEM sombra)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const physCoords = this.pixelToPhysical(x, y);
          
          if (physCoords.depth > this.config.depth) {
            image_base[idx] = 0;
            continue;
          }
          
          // Calcular intensidade BASE (sem sombra, sem noise temporal)
          const baseIntensity = this.calculatePixelIntensityNoShadow(x, y, physCoords);
          image_base[idx] = baseIntensity;
        }
      }
      
      // PASSO 2: Clonar para image_with_shadow e aplicar sombra do mapa 2D
      for (let i = 0; i < image_base.length; i++) {
        image_with_shadow[i] = image_base[i];
      }
      
      // Aplicar sombra do mapa 2D (modelo ray-tracing)
      if (this.linearShadowMap && this.linearShadowMap.length === width * height) {
        for (let i = 0; i < image_base.length; i++) {
          image_with_shadow[i] = image_base[i] * this.linearShadowMap[i];
        }
      }
      
      // PASSO 3: Gerar image_final (adiciona noise temporal e pós-processamento)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const physCoords = this.pixelToPhysical(x, y);
          
          let intensity = image_with_shadow[idx];
          
          // Temporal "live" noise (chuvisco)
          const depthRatio = physCoords.depth / this.config.depth;
          const temporalSeed = this.time * 2.5;
          
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
          
          image_final[idx] = intensity;
        }
      }
      
      // ═══════════════════════════════════════════════════════════════════════════════
      // PASSO 4: C1 CONTINUITY BRIDGING - Remove descontinuidade multiplicativa em zExit
      // 
      // O problema: acima de zExit temos I_base, abaixo temos I_base * shadowFactor
      // Isso cria uma descontinuidade matemática (linha horizontal)
      // 
      // Solução: "bridge" entre as duas funções para continuidade C1
      // ═══════════════════════════════════════════════════════════════════════════════
      const BRIDGE_TRANSITION_PIXELS = 8;
      
      for (let x = 0; x < width; x++) {
        const zExit = this.linearZExits[x];
        if (zExit < 0 || zExit >= height - 1) continue;
        
        // Obter o shadowFactor desta coluna no ponto imediatamente após zExit
        const shadowMapIdx = (zExit + 1) * width + x;
        if (!this.linearShadowMap || shadowMapIdx >= this.linearShadowMap.length) continue;
        
        const shadowFactor = this.linearShadowMap[shadowMapIdx];
        if (shadowFactor >= 0.999) continue; // Sem sombra nesta coluna
        
        // Valor do último pixel NÃO sombreado (zExit)
        const idxLastUnshadowed = zExit * width + x;
        const I_lastUnshadowed = image_final[idxLastUnshadowed];
        
        // Valor "bridge" = intensidade que a região sombreada DEVERIA ter para continuidade
        const bridge = I_lastUnshadowed * shadowFactor;
        
        // PASSO 4a: Primeiro pixel após zExit - atribuição direta do bridge
        const idxFirstShadowed = (zExit + 1) * width + x;
        image_final[idxFirstShadowed] = bridge;
        
        // PASSO 4b: Transição suave nos próximos 8 pixels (zExit+2 até zExit+9)
        const transitionEnd = Math.min(height - 1, zExit + 1 + BRIDGE_TRANSITION_PIXELS);
        
        for (let z = zExit + 2; z <= transitionEnd; z++) {
          const idx = z * width + x;
          
          // t varia de 0 (início da transição) até 1 (fim da transição)
          const t = (z - (zExit + 1)) / BRIDGE_TRANSITION_PIXELS;
          
          // target = intensidade normal sombreada que o pixel teria
          const target = image_final[idx]; // Já foi processado com shadow no PASSO 2-3
          
          // Interpolação linear do bridge para o target
          image_final[idx] = (1.0 - t) * bridge + t * target;
        }
      }
      
      // ═══════════════════════════════════════════════════════════════════════════════
      // PASSO 5: Smoothing vertical leve dentro da sombra (mantém speckle)
      // ═══════════════════════════════════════════════════════════════════════════════
      for (let x = 0; x < width; x++) {
        const zExit = this.linearZExits[x];
        if (zExit < 0) continue;
        
        // Começar APÓS a região de transição do bridge
        const z0 = zExit + BRIDGE_TRANSITION_PIXELS + 2;
        const z1 = height - 2;
        
        if (z0 >= z1) continue;
        
        for (let z = z0; z <= z1; z++) {
          const idxPrev = (z - 1) * width + x;
          const idxCurr = z * width + x;
          const idxNext = (z + 1) * width + x;
          
          const a = image_final[idxPrev];
          const b = image_final[idxCurr];
          const c = image_final[idxNext];
          
          const smooth = (a + 2 * b + c) / 4.0;
          // Mantém 80% speckle, 20% smoothed
          image_final[idxCurr] = 0.8 * b + 0.2 * smooth;
        }
      }
      
      // ═══════════════════════════════════════════════════════════════════════════════
      // PASSO 6: FREQUENCY-DEPENDENT PSF BLUR
      // 
      // Lower frequency → larger PSF → blurrier image (worse resolution)
      // Higher frequency → smaller PSF → sharper image (better resolution)
      // ═══════════════════════════════════════════════════════════════════════════════
      this.applyFrequencyDependentBlur(image_final, width, height);
      
      // ═══ RENDERIZAR O BUFFER SELECIONADO ═══
      let renderBuffer: Float32Array;
      switch (debugView) {
        case 'base':
          renderBuffer = image_base;
          break;
        case 'base_shadow':
          renderBuffer = image_with_shadow;
          break;
        case 'final':
        default:
          renderBuffer = image_final;
      }
      
      // Aplicar gain/compression apenas para base e base_shadow (final já tem)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const pixelIdx = idx * 4;
          
          let intensity = renderBuffer[idx];
          
          // Para base e base_shadow, aplicar gain/compression agora
          if (debugView !== 'final') {
            const gainLinear = Math.pow(10, (this.config.gain - 50) / 20);
            const drFactor = this.config.dynamicRange / 60;
            intensity *= gainLinear;
            intensity = Math.pow(Math.max(0, intensity), drFactor);
          }
          
          const gray = Math.max(0, Math.min(255, intensity * 255));
          data[pixelIdx] = gray;
          data[pixelIdx + 1] = gray;
          data[pixelIdx + 2] = gray;
          data[pixelIdx + 3] = 255;
        }
      }
      
      this.ctx.putImageData(imageData, 0, 0);
      return;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // CONVEX/MICROCONVEX MODE: Pipeline normal (sem debug)
    // ═══════════════════════════════════════════════════════════════════════════════
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const physCoords = this.pixelToPhysical(x, y);
        
        // Máscara para convexo/microconvexo
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
        
        if (physCoords.depth > this.config.depth) {
          data[idx] = data[idx + 1] = data[idx + 2] = 0;
          data[idx + 3] = 255;
          continue;
        }
        
        // Calculate intensity with all physics
        let intensity = this.calculatePixelIntensity(x, y, physCoords);
        
        // Temporal "live" noise
        const depthRatio = physCoords.depth / this.config.depth;
        const temporalSeed = this.time * 2.5;
        
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
   * LINEAR SHADOW - CONTINUOUS PATH-LENGTH ATTENUATION MODEL
   * ═══════════════════════════════════════════════════════════════════════════════
   * 
   * PHYSICAL MODEL:
   * - Each X column is treated as a vertical ultrasound beam
   * - For every depth z, compute how much path has been traveled inside the inclusion
   * - Shadow factor is a CONTINUOUS FUNCTION of z (not column-constant)
   * - Uses smoothstep for C¹ continuity at enter/exit points
   * 
   * RESULT: No horizontal bands, no discontinuities, physically plausible darkening
   */
  private computeLinearShadow(): void {
    const { width, height } = this.canvas;
    
    // Allocate 2D shadow map
    if (!this.linearShadowMap || this.linearShadowMap.length !== width * height) {
      this.linearShadowMap = new Float32Array(width * height);
    }
    
    // Initialize with 1.0 (no shadow)
    this.linearShadowMap.fill(1.0);
    
    // Keep old arrays for compatibility
    if (!this.linearShadowFactors || this.linearShadowFactors.length !== width) {
      this.linearShadowFactors = new Float32Array(width);
      this.linearZExits = new Int32Array(width);
    }
    this.linearShadowFactors.fill(1.0);
    this.linearZExits.fill(-1);
    
    // All inclusions generate acoustic shadows automatically (no toggle)
    const shadowInclusions = this.config.inclusions;
    if (shadowInclusions.length === 0) return;
    
    // Motion compensation (inverted from rendering for synchronization)
    const breathingCycle = Math.sin(this.time * 0.3) * 0.015;
    const jitterLateral = Math.sin(this.time * 8.5 + Math.cos(this.time * 12)) * 0.008;
    const jitterDepth = Math.cos(this.time * 7.2 + Math.sin(this.time * 9.5)) * 0.006;
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // CONTINUOUS PATH-LENGTH MODEL: For each (x, z), compute shadow factor
    // based on how much path length inside inclusion has been traversed
    // ═══════════════════════════════════════════════════════════════════════════════
    
    // Shadow parameters - BALANCED across all transducer types
    // MAX_DROP = 0.05 means center of shadow is ~5% darker than surrounding tissue
    const MAX_DROP = 0.05; // ~5% darker at center (minimal)
    const NOISE_SCALE_X = 0.05;
    const NOISE_SCALE_Z = 0.05;
    const NOISE_AMP = 0.025; // ±2.5% organic jitter
    
    for (let x = 0; x < width; x++) {
      // Convert pixel X to physical lateral position (cm)
      const lateralCm = ((x / width) - 0.5) * 5.0;
      const lateralCmAdjusted = lateralCm + jitterLateral;
      
      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 1: Find zEnter and zExit for this column via ray-tracing
      // ═══════════════════════════════════════════════════════════════════════════
      let columnZEnter = -1;
      let columnZExit = -1;
      let wasInside = false;
      
      // For analytical intersection with ellipse (more precise)
      let activeInclusion: typeof shadowInclusions[0] | null = null;
      
      // Scan vertically through this column (ray-tracing)
      for (let y = 0; y < height; y++) {
        const depthCm = (y / height) * this.config.depth;
        const depthCmAdjusted = depthCm + jitterDepth + breathingCycle * (depthCm / this.config.depth);
        
        // Check if this sample is inside ANY shadow-producing inclusion
        let isInsideAny = false;
        
        for (const inclusion of shadowInclusions) {
          const inclLateral = inclusion.centerLateralPos * 2.5;
          const inclCenterDepth = inclusion.centerDepthCm;
          const halfW = inclusion.sizeCm.width / 2;
          const halfH = inclusion.sizeCm.height / 2;
          
          const dx = lateralCmAdjusted - inclLateral;
          const dy = depthCmAdjusted - inclCenterDepth;
          
          let isInside = false;
          if (inclusion.shape === 'ellipse') {
            const normalizedDist = (dx * dx) / (halfW * halfW) + (dy * dy) / (halfH * halfH);
            isInside = normalizedDist <= 1.0;
          } else if (inclusion.shape === 'capsule') {
            // Capsule: rectangle with semicircular ends
            // WITH ROTATION AND IRREGULARITY for anatomical realism
            const capsuleRadius = halfH;
            const rectHalfWidth = halfW - capsuleRadius;
            
            // === ROTATION TRANSFORM ===
            const rotationDeg = inclusion.rotationDegrees || 0;
            const rotationRad = (rotationDeg * Math.PI) / 180;
            const cosR = Math.cos(rotationRad);
            const sinR = Math.sin(rotationRad);
            
            // Rotate into capsule's local coordinate system
            const dxLocal = dx * cosR + dy * sinR;
            const dyLocal = -dx * sinR + dy * cosR;
            
            // === WALL IRREGULARITY (subtle oscillation) ===
            const irregularity = inclusion.wallIrregularity || 0;
            let radiusMod = 0;
            if (irregularity > 0) {
              radiusMod = irregularity * (
                0.5 * Math.sin(dxLocal * 8.0) + 
                0.3 * Math.cos(dxLocal * 15.0) + 
                0.2 * Math.sin(dxLocal * 23.0)
              );
            }
            
            // === WALL ASYMMETRY ===
            const asymmetry = inclusion.wallAsymmetry || 0;
            const asymmetryOffset = dyLocal > 0 ? asymmetry : -asymmetry;
            
            const effectiveRadius = capsuleRadius + radiusMod + asymmetryOffset;
            
            if (Math.abs(dxLocal) <= rectHalfWidth) {
              // In rectangular middle
              isInside = Math.abs(dyLocal) <= effectiveRadius;
            } else {
              // In semicircular ends
              const endCenterX = Math.sign(dxLocal) * rectHalfWidth;
              const localDxEnd = dxLocal - endCenterX;
              const distToEndCenter = Math.sqrt(localDxEnd * localDxEnd + dyLocal * dyLocal);
              isInside = distToEndCenter <= effectiveRadius;
            }
          } else {
            // Rectangle
            isInside = Math.abs(dx) <= halfW && Math.abs(dy) <= halfH;
          }
          
          if (isInside) {
            isInsideAny = true;
            activeInclusion = inclusion;
            break;
          }
        }
        
        // State machine for enter/exit detection
        if (isInsideAny && !wasInside) {
          columnZEnter = y;
        } else if (!isInsideAny && wasInside) {
          columnZExit = y - 1;
        }
        
        wasInside = isInsideAny;
      }
      
      // Handle case where ray never exits
      if (wasInside && columnZExit < 0 && columnZEnter >= 0) {
        columnZExit = height - 1;
      }
      
      // Skip columns that don't cross any inclusion
      if (columnZEnter < 0 || columnZExit < 0 || columnZExit <= columnZEnter) {
        continue;
      }
      
      // Store for compatibility
      this.linearZExits[x] = columnZExit;
      const thickness = columnZExit - columnZEnter + 1;
      
      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 2: Apply CONTINUOUS depth-dependent attenuation for ALL z in this column
      // Shadow factor CONTINUES TO VARY with depth even AFTER exiting the inclusion
      // This eliminates the plateau/horizontal band at zExit
      // ═══════════════════════════════════════════════════════════════════════════
      
      // Post-exit continuation slope (very small to avoid visible change, but non-zero)
      const k = 0.006;
      
      // Maximum effective attenuation = inclusion thickness + continuation to bottom
      const maxEff = thickness + height * k;
      
      for (let z = 0; z < height; z++) {
        // Skip pixels above inclusion entry (no shadow yet)
        if (z <= columnZEnter) continue;
        
        // ═══════════════════════════════════════════════════════════════════════
        // CONTINUOUS PATH-LENGTH MODEL:
        // - Inside inclusion: attenuation builds up based on path traveled
        // - After exit: attenuation CONTINUES to increase with small slope k
        // - This ensures factorShadow(z) has non-zero derivative at zExit
        // ═══════════════════════════════════════════════════════════════════════
        
        // Normalized in-inclusion path fraction (clamped 0-1)
        const baseT = Math.min(1.0, Math.max(0, (z - columnZEnter) / thickness));
        
        // Distance traveled after exiting inclusion
        const post = Math.max(0, z - columnZExit);
        
        // Effective attenuation = inclusion contribution + post-exit continuation
        const effective = thickness * baseT + post * k;
        
        // Normalize to [0, 1] range
        const t = Math.min(1.0, Math.max(0, effective / maxEff));
        
        // ═══════════════════════════════════════════════════════════════════════
        // SMOOTHSTEP for C¹ continuity: s(t) = t² * (3 - 2t)
        // Ensures smooth curve with zero slope at endpoints
        // ═══════════════════════════════════════════════════════════════════════
        const s = t * t * (3 - 2 * t);
        
        // Shadow factor: 1.0 (no shadow) → (1 - MAX_DROP) at maximum attenuation
        let factorShadow = 1.0 - MAX_DROP * s;
        
        // ═══════════════════════════════════════════════════════════════════════
        // ORGANIC NOISE to break uniformity (very subtle)
        // ═══════════════════════════════════════════════════════════════════════
        const nx = x * NOISE_SCALE_X;
        const nz = z * NOISE_SCALE_Z;
        const noiseValue = this.smoothNoise(nx, nz, 42);
        const jitter = 1.0 + NOISE_AMP * noiseValue;
        
        factorShadow *= jitter;
        
        // Store in shadow map
        const idx = z * width + x;
        this.linearShadowMap[idx] = Math.min(this.linearShadowMap[idx], factorShadow);
      }
      
      // Store final column factor for compatibility
      this.linearShadowFactors[x] = 1.0 - MAX_DROP;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // STEP 3: Apply gentle 3×3 blur for lateral smoothing
    // ═══════════════════════════════════════════════════════════════════════════════
    this.apply3x3Blur(width, height);
  }
  
  
  /**
   * Apply final 3×3 Gaussian blur to shadow map for smooth edges
   * Only blur AFTER all shadow is applied - never before
   */
  private apply3x3Blur(width: number, height: number): void {
    if (!this.linearShadowMap) return;
    
    // 3×3 Gaussian kernel
    const kernel = [
      1/16, 2/16, 1/16,
      2/16, 4/16, 2/16,
      1/16, 2/16, 1/16
    ];
    
    // Buffer for blurred result
    const temp = new Float32Array(this.linearShadowMap.length);
    temp.set(this.linearShadowMap); // Copy original
    
    // Apply 3×3 convolution
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0;
        let ki = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = (y + dy) * width + (x + dx);
            sum += this.linearShadowMap[idx] * kernel[ki];
            ki++;
          }
        }
        temp[y * width + x] = sum;
      }
    }
    
    // Copy result back
    this.linearShadowMap.set(temp);
  }
  
  /**
   * Obtém o shadowFactor para uma coluna específica
   */
  private getLinearShadowFactor(x: number): number {
    if (!this.linearShadowFactors) return 1.0;
    if (x < 0 || x >= this.linearShadowFactors.length) return 1.0;
    return this.linearShadowFactors[Math.floor(x)];
  }
  
  /**
   * Obtém o zExit para uma coluna específica
   */
  private getLinearZExit(x: number): number {
    if (!this.linearZExits) return -1;
    if (x < 0 || x >= this.linearZExits.length) return -1;
    return this.linearZExits[Math.floor(x)];
  }
  
  /**
   * Hash-based noise for organic variation (deterministic)
   */
  private hashNoise(seed: number): number {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }
  
  /**
   * Calcula intensidade do pixel SEM sombra (para debug)
   * Inclui: tissue, attenuation, TGC, focal gain, beam falloff, speckle, log compression
   * NÃO inclui: shadow, noise temporal
   */
  private calculatePixelIntensityNoShadow(
    x: number, 
    y: number, 
    coords: { depth: number; lateral: number }
  ): number {
    let { depth, lateral } = coords;
    
    // Motion artifacts (INCREASED for realistic hand-held probe movements)
    const breathingCycle = Math.sin(this.time * 0.3) * 0.035;
    const breathingDepthEffect = depth / this.config.depth;
    depth += breathingCycle * breathingDepthEffect;
    
    const jitterLateral = Math.sin(this.time * 8.5 + Math.cos(this.time * 12)) * 0.025;
    const jitterDepth = Math.cos(this.time * 7.2 + Math.sin(this.time * 9.5)) * 0.018;
    lateral += jitterLateral;
    depth += jitterDepth;
    
    const armSway = Math.sin(this.time * 1.2) * Math.cos(this.time * 0.7) * 0.015;
    lateral += armSway;
    
    const tissueTremor = Math.sin(x * 0.02 + this.time * 5) * Math.cos(y * 0.015 + this.time * 4) * 0.008;
    depth += tissueTremor;
    
    // 1. Get tissue properties at this location
    const tissue = this.getTissueAtPosition(depth, lateral);
    
    // 2. Base echogenicity
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
    
    // 6. Interface reflections
    const reflection = this.calculateInterfaceReflection(depth, lateral);
    intensity *= (1 + reflection * 0.3);
    
    // 7. Beam geometry
    const beamFalloff = this.calculateBeamFalloff(depth, lateral);
    intensity *= beamFalloff;
    
    // 8. ═══ SEM SHADOW ═══ (diferença principal)
    // Apenas posterior enhancement se habilitado
    if (this.config.enablePosteriorEnhancement) {
      const enhancementFactor = this.applyPosteriorEnhancement(depth, lateral);
      intensity *= enhancementFactor;
    }
    
    // 9. Reverberation artifacts
    if (this.config.enableReverberation) {
      const reverb = this.calculateReverberation(depth);
      intensity *= (1 + reverb * 0.2);
    }
    
    // 10. SPECKLE
    if (this.config.enableSpeckle) {
      const speckleIdx = y * this.canvas.width + x;
      const rayleigh = Math.abs(this.rayleighCache[speckleIdx % this.rayleighCache.length]);
      const perlin = this.perlinCache[speckleIdx % this.perlinCache.length];
      
      const depthFactor = 1 + (depth / this.config.depth) * 0.25;
      const px = x * 0.1 + this.time * 0.5;
      const py = y * 0.1;
      const hashNoise = this.noise(px * 12.9898 + py * 78.233) * 2 - 1;
      const fineHash = this.noise((px + 100) * 45.123 + (py + 50) * 91.456) * 2 - 1;
      
      const baseSpeckle = (rayleigh * 0.5 + (perlin * 0.5 + 0.5) * 0.5) * depthFactor;
      const pixelVariation = 1.0 + hashNoise * 0.15 + fineHash * 0.1;
      const speckleMultiplier = (0.5 + baseSpeckle * 0.5) * pixelVariation;
      
      // Blood flow modulation
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
      
      intensity *= speckleMultiplier * flowMultiplier;
    }
    
    // 11. LOG COMPRESSION
    const gainLinear = Math.pow(10, (this.config.gain - 50) / 20);
    intensity *= gainLinear;
    intensity = Math.log(1 + intensity * 10) / Math.log(11);
    
    return intensity;
  }

  private calculatePixelIntensity(
    x: number, 
    y: number, 
    coords: { depth: number; lateral: number }
  ): number {
    let { depth, lateral } = coords;
    
    // MOTION ARTIFACTS - Realistic hand-held probe movements (INCREASED for visibility)
    // 1. Breathing motion (cyclic vertical displacement)
    const breathingCycle = Math.sin(this.time * 0.3) * 0.035; // Increased from 0.015
    const breathingDepthEffect = depth / this.config.depth;
    depth += breathingCycle * breathingDepthEffect;
    
    // 2. Probe micro-jitter (operator hand tremor) - INCREASED
    const jitterLateral = Math.sin(this.time * 8.5 + Math.cos(this.time * 12)) * 0.025; // Increased from 0.008
    const jitterDepth = Math.cos(this.time * 7.2 + Math.sin(this.time * 9.5)) * 0.018; // Increased from 0.006
    lateral += jitterLateral;
    depth += jitterDepth;
    
    // 3. Additional low-frequency sway (natural arm movement)
    const armSway = Math.sin(this.time * 1.2) * Math.cos(this.time * 0.7) * 0.015;
    lateral += armSway;
    
    // 4. Tissue micro-movements (random fibrillar motion) - INCREASED
    const tissueTremor = Math.sin(x * 0.02 + this.time * 5) * Math.cos(y * 0.015 + this.time * 4) * 0.008;
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
      intensity *= (1 + reverb * 0.4); // Stronger effect when enabled
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 10. NEAR FIELD CLUTTER - Increased noise in superficial region
    // ═══════════════════════════════════════════════════════════════════════════════
    if (this.config.enableNearFieldClutter) {
      const nearFieldDepthCm = 1.0; // First 1cm affected
      if (depth < nearFieldDepthCm) {
        const nearFieldFactor = 1 - (depth / nearFieldDepthCm); // 1 at surface, 0 at 1cm
        const clutterNoise = (Math.random() - 0.5) * 0.4 * nearFieldFactor;
        const perlinClutter = this.smoothNoise(x * 0.05, y * 0.05, 123) * 0.3 * nearFieldFactor;
        intensity *= (1 + clutterNoise + perlinClutter);
        // Also increase base brightness in near field
        intensity *= (1 + nearFieldFactor * 0.15);
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 11. SPECKLE - FREQUENCY-DEPENDENT GRAIN SIZE
    // ═══════════════════════════════════════════════════════════════════════════════
    // CRITICAL: Speckle must be purely multiplicative per-pixel.
    // Speckle grain size scales with 1/frequency (lower freq = coarser grains)
    if (this.config.enableSpeckle) {
      // Get frequency-dependent scaling
      const psf = this.getFrequencyDependentPSF();
      const speckleScale = psf.speckleScale;
      
      // Scale sampling coordinates inversely with frequency
      // Lower frequency → larger speckleScale → coarser sampling → bigger grains
      const scaledX = x / speckleScale;
      const scaledY = y / speckleScale;
      
      const speckleIdx = Math.floor(scaledY) * this.canvas.width + Math.floor(scaledX);
      const rayleigh = Math.abs(this.rayleighCache[Math.abs(speckleIdx) % this.rayleighCache.length]);
      const perlin = this.perlinCache[Math.abs(speckleIdx) % this.perlinCache.length];
      
      // Depth-dependent speckle size (deeper = coarser speckle)
      const depthFactor = 1 + (depth / this.config.depth) * 0.25;
      
      // Per-pixel granular noise with frequency scaling
      const px = scaledX * 0.1 + this.time * 0.5;
      const py = scaledY * 0.1;
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
    // 12. LOG COMPRESSION (LAST STEP - after shadow and speckle)
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
      attenuation: layer.attenuationCoeff || 0.06, // Very low for visible depth at high frequencies
      reflectivity: layer.reflectivity,
      impedance: 1.63,
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
      attenuationCoeff: 0.06 // Very low for visible depth at high frequencies
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
  
  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * REVERBERATION - Multiple echo artifacts (horizontal bands)
   * ═══════════════════════════════════════════════════════════════════════════════
   */
  private calculateReverberation(depth: number): number {
    // Multiple echoes from strong reflectors - creates horizontal bands
    // More visible when enabled
    const reverb1 = Math.sin(depth * 25) * Math.exp(-depth * 0.8) * 0.15;
    const reverb2 = Math.sin(depth * 50) * Math.exp(-depth * 1.2) * 0.10;
    const reverb3 = Math.sin(depth * 75) * Math.exp(-depth * 1.8) * 0.05;
    return reverb1 + reverb2 + reverb3;
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
      
      if (isInside) {
        return {
          isInside: true,
          distanceFromEdge: (1 - distFromCenter) * Math.min(rx, ry)
        };
      } else {
        return {
          isInside: false,
          distanceFromEdge: (distFromCenter - 1) * Math.min(rx, ry)
        };
      }
    } else if (inclusion.shape === 'capsule') {
      // ═══════════════════════════════════════════════════════════════════════════════
      // CAPSULE SHAPE (Stadium/Pill) - Rectangle with semicircular ends
      // Perfect for longitudinal vessel visualization
      // 
      // ANATOMICAL REALISM FEATURES:
      // - Rotation: slight angle to simulate vessel path (±30°)
      // - Wall irregularity: subtle amplitude variation using sin/cos
      // - Wall asymmetry: anterior vs posterior wall thickness difference
      // ═══════════════════════════════════════════════════════════════════════════════
      const halfWidth = inclusion.sizeCm.width / 2;
      const halfHeight = inclusion.sizeCm.height / 2;
      const capsuleRadius = halfHeight;
      const rectHalfWidth = halfWidth - capsuleRadius;
      
      // === ROTATION TRANSFORM ===
      const rotationDeg = inclusion.rotationDegrees ?? 0;
      const rotationRad = (rotationDeg * Math.PI) / 180;
      const cosR = Math.cos(rotationRad);
      const sinR = Math.sin(rotationRad);
      
      // Rotate (dx, dy) into capsule's local coordinate system
      const dxLocal = dx * cosR + dy * sinR;
      const dyLocal = -dx * sinR + dy * cosR;
      
      // === WALL IRREGULARITY (subtle oscillation along length) ===
      const irregularity = inclusion.wallIrregularity || 0;
      let radiusModulation = 0;
      if (irregularity > 0) {
        // Multi-frequency sinusoidal variation along the capsule length
        const phase1 = dxLocal * 8.0; // Primary frequency
        const phase2 = dxLocal * 15.0; // Secondary frequency
        const phase3 = dxLocal * 23.0; // Tertiary frequency (breaks periodicity)
        radiusModulation = irregularity * (
          0.5 * Math.sin(phase1) + 
          0.3 * Math.cos(phase2) + 
          0.2 * Math.sin(phase3)
        );
      }
      
      // === WALL ASYMMETRY (posterior slightly thicker) ===
      const asymmetry = inclusion.wallAsymmetry || 0;
      // dyLocal > 0 means posterior (below center), < 0 means anterior (above center)
      const asymmetryOffset = dyLocal > 0 ? asymmetry : -asymmetry;
      
      // Effective radius with modulation and asymmetry
      const effectiveRadius = capsuleRadius + radiusModulation + asymmetryOffset;
      
      // Signed distance to capsule (SDF) with modified radius
      let dist: number;
      
      if (Math.abs(dxLocal) <= rectHalfWidth) {
        // In the rectangular middle section - distance is just vertical
        dist = Math.abs(dyLocal) - effectiveRadius;
      } else {
        // In one of the semicircular ends
        const endCenterX = Math.sign(dxLocal) * rectHalfWidth;
        const localDxEnd = dxLocal - endCenterX;
        const distToEndCenter = Math.sqrt(localDxEnd * localDxEnd + dyLocal * dyLocal);
        dist = distToEndCenter - effectiveRadius;
      }
      
      const isInside = dist <= 0;
      return {
        isInside,
        distanceFromEdge: Math.abs(dist)
      };
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
  
  private calculateInclusionEffects(
    x: number,
    y: number,
    depth: number,
    lateral: number,
    tissue: any
  ): { attenuationFactor: number; reflection: number } {
    let attenuationFactor = 1;
    let reflection = 0;
    
    if (this.config.transducerType === 'linear') {
      // ═══════════════════════════════════════════════════════════════════════════════
      // LINEAR: Sombra já aplicada diretamente no buffer de renderização
      // Não aplicar novamente aqui para evitar dupla atenuação
      // ═══════════════════════════════════════════════════════════════════════════════
      
      // Posterior enhancement apenas
      if (this.config.enablePosteriorEnhancement) {
        const enhancementFactor = this.applyPosteriorEnhancement(depth, lateral);
        attenuationFactor *= enhancementFactor;
      }
      
    } else {
      // CONVEX/MICROCONVEX - sem alterações
      if (this.config.enablePosteriorEnhancement) {
        const enhancementFactor = this.applyPosteriorEnhancement(depth, lateral);
        attenuationFactor *= enhancementFactor;
      }
    }
    
    return { attenuationFactor, reflection };
  }
  
  /**
   * Deterministic noise function (0 to 1)
   */
  private noise(seed: number): number {
    const x = Math.sin(seed * 12.9898 + seed * 0.1) * 43758.5453;
    return x - Math.floor(x);
  }
  
  /**
   * POSTERIOR ENHANCEMENT - Realistic brightness increase behind anechoic structures
   * 
   * For longitudinal vessels (capsule shape):
   * - Enhancement follows the vessel contour (uses rotation)
   * - Smooth transition with Gaussian lateral falloff
   * - Gradual depth decay using quadratic smoothstep
   * - No horizontal bands or discontinuities
   */
  private applyPosteriorEnhancement(depth: number, lateral: number): number {
    let enhancementFactor = 1.0;
    
    for (const inclusion of this.config.inclusions) {
      // Only fluid-filled structures cause enhancement
      if (!inclusion.posteriorEnhancement) continue;
      if (inclusion.mediumInsideId !== 'cyst_fluid' && 
          inclusion.mediumInsideId !== 'blood' && 
          inclusion.mediumInsideId !== 'water') continue;
      
      const inclCenterLateral = inclusion.centerLateralPos * 2.5;
      const inclHalfWidth = inclusion.sizeCm.width / 2;
      const inclHalfHeight = inclusion.sizeCm.height / 2;
      
      // === HANDLE ROTATION FOR CAPSULE SHAPE ===
      const rotationDeg = inclusion.rotationDegrees || 0;
      const rotationRad = (rotationDeg * Math.PI) / 180;
      const cosR = Math.cos(rotationRad);
      const sinR = Math.sin(rotationRad);
      
      // Transform point into inclusion's local coordinate system
      const dx = lateral - inclCenterLateral;
      const dy = depth - inclusion.centerDepthCm;
      const dxLocal = dx * cosR + dy * sinR;
      const dyLocal = -dx * sinR + dy * cosR;
      
      // === CALCULATE POSTERIOR BOUNDARY (zExit) FOR THIS LATERAL POSITION ===
      let zExitLocal: number;
      
      if (inclusion.shape === 'capsule') {
        const capsuleRadius = inclHalfHeight;
        const rectHalfWidth = inclHalfWidth - capsuleRadius;
        
        if (Math.abs(dxLocal) <= rectHalfWidth) {
          // In rectangular middle - zExit is constant
          zExitLocal = capsuleRadius;
        } else {
          // In semicircular ends - zExit varies with lateral position
          const endCenterX = Math.sign(dxLocal) * rectHalfWidth;
          const distFromEndCenter = Math.abs(dxLocal - endCenterX);
          if (distFromEndCenter >= capsuleRadius) {
            continue; // Outside vessel laterally
          }
          zExitLocal = Math.sqrt(capsuleRadius * capsuleRadius - distFromEndCenter * distFromEndCenter);
        }
      } else {
        // Ellipse or rectangle - use simple bottom depth
        zExitLocal = inclHalfHeight;
      }
      
      // Check if we're below the vessel (in local coords)
      if (dyLocal <= zExitLocal) continue;
      
      // === POSTERIOR ENHANCEMENT CALCULATION ===
      const posteriorDepth = dyLocal - zExitLocal; // Distance below vessel bottom
      const enhancementDepthCm = 0.8; // Depth of enhancement effect (cm)
      
      // Only apply within enhancement zone
      if (posteriorDepth > enhancementDepthCm) continue;
      
      // Smooth depth falloff using quadratic curve (starts strong, fades smoothly)
      const t = Math.min(1.0, posteriorDepth / enhancementDepthCm);
      const tSmooth = t * t; // Quadratic for smooth start
      const depthFactor = 1.0 - tSmooth;
      
      // === LATERAL GAUSSIAN FALLOFF ===
      // Follows vessel width - strongest at center, fades at edges
      let lateralWeight: number;
      if (inclusion.shape === 'capsule') {
        const capsuleRadius = inclHalfHeight;
        const rectHalfWidth = inclHalfWidth - capsuleRadius;
        
        // Calculate lateral distance from vessel center
        let normalizedLateral: number;
        if (Math.abs(dxLocal) <= rectHalfWidth) {
          normalizedLateral = 0; // In middle, full strength
        } else {
          normalizedLateral = (Math.abs(dxLocal) - rectHalfWidth) / capsuleRadius;
        }
        // Gaussian falloff
        lateralWeight = Math.exp(-normalizedLateral * normalizedLateral * 2.0);
      } else {
        lateralWeight = 1.0 - Math.pow(Math.abs(dxLocal) / inclHalfWidth, 2);
      }
      
      lateralWeight = Math.max(0, lateralWeight);
      
      // === FINAL ENHANCEMENT ===
      // Max enhancement: ~12% brighter at center, fading smoothly
      const maxEnhancement = 0.12;
      const enhancement = maxEnhancement * depthFactor * lateralWeight;
      
      enhancementFactor *= (1.0 + enhancement);
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
  
  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * MOTION PARAMETERS - Centralized for synchronization across image and Doppler
   * ═══════════════════════════════════════════════════════════════════════════════
   */
  private getMotionOffsets(depth: number): { lateralOffset: number; depthOffset: number } {
    // 1. Breathing motion (cyclic vertical displacement)
    const breathingCycle = Math.sin(this.time * 0.3) * 0.035;
    const breathingDepthEffect = depth / this.config.depth;
    const breathingOffset = breathingCycle * breathingDepthEffect;
    
    // 2. Probe micro-jitter (operator hand tremor) - LATERAL AND DEPTH
    const jitterLateral = Math.sin(this.time * 8.5 + Math.cos(this.time * 12)) * 0.025;
    const jitterDepth = Math.cos(this.time * 7.2 + Math.sin(this.time * 9.5)) * 0.018;
    
    // 3. Additional low-frequency sway (natural arm movement) - LATERAL
    const armSway = Math.sin(this.time * 1.2) * Math.cos(this.time * 0.7) * 0.015;
    
    // 4. Slow drift (longer period lateral movement)
    const slowDrift = Math.sin(this.time * 0.5) * 0.02;
    
    return {
      lateralOffset: jitterLateral + armSway + slowDrift,
      depthOffset: breathingOffset + jitterDepth
    };
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * COLOR DOPPLER OVERLAY - Realistic per-pixel flow visualization for blood vessels
   * Uses EXACT same coordinate mapping as main rendering engine for pixel-perfect alignment
   * MOTION-SYNCHRONIZED with the main image
   * ═══════════════════════════════════════════════════════════════════════════════
   */
  private renderDopplerOverlay(): void {
    // Filter inclusions that represent blood vessels or water (anechoic flowing structures)
    const vesselInclusions = this.config.inclusions.filter(inc => 
      inc.mediumInsideId === 'blood' || inc.mediumInsideId === 'water'
    );
    
    if (vesselInclusions.length === 0) return;
    
    const { width, height } = this.canvas;
    const imageData = this.ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Cardiac cycle for pulsatile flow
    const heartRate = 1.2; // ~72 bpm
    const cardiacPhase = (this.time * heartRate) % 1.0;
    const pulse = 0.6 + 0.4 * Math.sin(cardiacPhase * Math.PI * 2);
    
    // FIXED_LATERAL_SCALE must match isPointInInclusion exactly (5.0 cm = -2.5 to +2.5)
    const FIXED_LATERAL_SCALE = 5.0;
    
    if (this.config.transducerType === 'linear') {
      // ═══ LINEAR MODE ═══
      for (let py = 0; py < height; py++) {
        const baseDepth = (py / height) * this.config.depth;
        
        // Get motion offsets synchronized with main image
        const motion = this.getMotionOffsets(baseDepth);
        const depth = baseDepth + motion.depthOffset;
        
        for (let px = 0; px < width; px++) {
          const lateralNormalized = (px / width) - 0.5;
          const baseLateralCm = lateralNormalized * FIXED_LATERAL_SCALE;
          
          // Apply lateral motion offset (synchronized with main image)
          const lateralCm = baseLateralCm + motion.lateralOffset;
          
          // Check ALL vessel inclusions to detect overlaps
          const insideResults: Array<{ inclusion: typeof vesselInclusions[0]; result: { isInside: boolean; distanceFromEdge: number } }> = [];
          
          for (const inclusion of vesselInclusions) {
            const result = this.getDistanceFromInclusion(depth, lateralCm, inclusion);
            if (result.isInside) {
              insideResults.push({ inclusion, result });
            }
          }
          
          if (insideResults.length > 0) {
            // Use the first inclusion for color/direction
            const { inclusion, result } = insideResults[0];
            const halfSize = Math.min(inclusion.sizeCm.width, inclusion.sizeCm.height) / 2;
            
            // If inside multiple vessels (overlap), suppress edge effect
            const isOverlap = insideResults.length > 1;
            const distFromCenter = isOverlap 
              ? 0.3 // Flat color in overlap region (no edge darkening)
              : Math.max(0, 1 - (result.distanceFromEdge / halfSize));
            
            // Determine vessel type CONSISTENTLY based on inclusion properties
            // Shallower vessel = artery (carotid), deeper vessel = vein (jugular)
            // Or use lateral position: left = artery, right = vein in typical carotid scan
            const isArterial = this.isArterialVessel(inclusion, vesselInclusions);
            
            this.applyDopplerColorToPixelV2(data, px, py, width, distFromCenter, pulse, isArterial);
          }
        }
      }
    } else {
      // ═══ CONVEX/MICROCONVEX MODE ═══
      const sectorAngle = this.config.transducerType === 'convex' ? 80 : 60;
      const halfAngle = (sectorAngle / 2) * Math.PI / 180;
      const virtualApexDepth = -2.5;
      const maxLateralExtent = this.config.depth * Math.tan(halfAngle);
      
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const centerX = width / 2;
          const normalizedR = py / height;
          const normalizedTheta = (px - centerX) / (width / 2);
          
          const theta = normalizedTheta * halfAngle;
          const baseR = normalizedR * this.config.depth;
          
          // Get motion offsets synchronized with main image
          const motion = this.getMotionOffsets(baseR);
          const r = baseR + motion.depthOffset;
          
          // Apply angular jitter for lateral motion
          const thetaAdjusted = theta + motion.lateralOffset * 0.1;
          
          // Convert to physical coordinates with motion
          const physicalX = r * Math.sin(thetaAdjusted);
          const physicalY = r * Math.cos(thetaAdjusted) - virtualApexDepth;
          
          // Check ALL vessel inclusions to detect overlaps
          const insideResults: Array<{ inclusion: typeof vesselInclusions[0]; result: { isInside: boolean; distanceFromEdge: number } }> = [];
          
          for (const inclusion of vesselInclusions) {
            const result = this.isPointInInclusionConvex(physicalX, physicalY, r, inclusion, maxLateralExtent);
            if (result.isInside) {
              insideResults.push({ inclusion, result });
            }
          }
          
          if (insideResults.length > 0) {
            const { inclusion, result } = insideResults[0];
            const halfSize = Math.min(inclusion.sizeCm.width, inclusion.sizeCm.height) / 2;
            
            // If inside multiple vessels (overlap), suppress edge effect
            const isOverlap = insideResults.length > 1;
            const distFromCenter = isOverlap 
              ? 0.3
              : Math.max(0, 1 - (result.distanceFromEdge / halfSize));
            
            // Determine vessel type CONSISTENTLY based on inclusion properties
            const isArterial = this.isArterialVessel(inclusion, vesselInclusions);
            
            this.applyDopplerColorToPixelV2(data, px, py, width, distFromCenter, pulse, isArterial);
          }
        }
      }
    }
    
    this.ctx.putImageData(imageData, 0, 0);
  }
  
  /**
   * Check if point is inside inclusion for Convex mode with full geometry support
   */
  private isPointInInclusionConvex(
    physicalX: number,
    physicalY: number,
    r: number,
    inclusion: UltrasoundInclusionConfig,
    maxLateralExtent: number
  ): { isInside: boolean; distanceFromEdge: number } {
    const inclNormLat = inclusion.centerLateralPos;
    const inclDepth = inclusion.centerDepthCm;
    const inclX = inclNormLat * maxLateralExtent;
    const inclY = inclDepth;
    
    // Distance from inclusion center
    const dx = physicalX - inclX;
    const dy = physicalY - inclY;
    
    // Radial distortion factor
    const depthFactor = 1.0 + (r / this.config.depth) * 0.3;
    const distortedDx = dx / depthFactor;
    
    const halfWidth = inclusion.sizeCm.width / 2;
    const halfHeight = inclusion.sizeCm.height / 2;
    
    if (inclusion.shape === 'ellipse') {
      const normX = distortedDx / halfWidth;
      const normY = dy / halfHeight;
      const normalizedDist = normX * normX + normY * normY;
      const isInside = normalizedDist <= 1.0;
      const distFromEdge = isInside 
        ? (1 - Math.sqrt(normalizedDist)) * Math.min(halfWidth, halfHeight)
        : (Math.sqrt(normalizedDist) - 1) * Math.min(halfWidth, halfHeight);
      return { isInside, distanceFromEdge: Math.abs(distFromEdge) };
      
    } else if (inclusion.shape === 'capsule') {
      // Capsule with ROTATION and IRREGULARITY support
      const capsuleRadius = halfHeight;
      const rectHalfWidth = halfWidth - capsuleRadius;
      
      // === ROTATION TRANSFORM ===
      const rotationDeg = inclusion.rotationDegrees || 0;
      const rotationRad = (rotationDeg * Math.PI) / 180;
      const cosR = Math.cos(rotationRad);
      const sinR = Math.sin(rotationRad);
      const dxLocal = distortedDx * cosR + dy * sinR;
      const dyLocal = -distortedDx * sinR + dy * cosR;
      
      // === WALL IRREGULARITY ===
      const irregularity = inclusion.wallIrregularity || 0;
      let radiusMod = 0;
      if (irregularity > 0) {
        radiusMod = irregularity * (
          0.5 * Math.sin(dxLocal * 8.0) + 
          0.3 * Math.cos(dxLocal * 15.0) + 
          0.2 * Math.sin(dxLocal * 23.0)
        );
      }
      
      // === WALL ASYMMETRY ===
      const asymmetry = inclusion.wallAsymmetry || 0;
      const asymmetryOffset = dyLocal > 0 ? asymmetry : -asymmetry;
      const effectiveRadius = capsuleRadius + radiusMod + asymmetryOffset;
      
      let dist: number;
      if (Math.abs(dxLocal) <= rectHalfWidth) {
        dist = Math.abs(dyLocal) - effectiveRadius;
      } else {
        const endCenterX = Math.sign(dxLocal) * rectHalfWidth;
        const localDxEnd = dxLocal - endCenterX;
        const distToEndCenter = Math.sqrt(localDxEnd * localDxEnd + dyLocal * dyLocal);
        dist = distToEndCenter - effectiveRadius;
      }
      
      const isInside = dist <= 0;
      return { isInside, distanceFromEdge: Math.abs(dist) };
      
    } else {
      // Rectangle
      const isInside = Math.abs(distortedDx) <= halfWidth && Math.abs(dy) <= halfHeight;
      const distX = halfWidth - Math.abs(distortedDx);
      const distY = halfHeight - Math.abs(dy);
      const distFromEdge = isInside ? Math.min(distX, distY) : -Math.min(Math.abs(distX), Math.abs(distY));
      return { isInside, distanceFromEdge: Math.abs(distFromEdge) };
    }
  }
  
  /**
   * Determine if a vessel is arterial (toward probe = red) or venous (away = blue)
   * For carotid preset: ALL vessels are treated as arterial (red with aliasing)
   */
  private isArterialVessel(
    inclusion: UltrasoundInclusionConfig,
    allVessels: UltrasoundInclusionConfig[]
  ): boolean {
    // For typical carotid/neck ultrasound, treat ALL blood vessels as arterial
    // This gives the realistic red color with aliasing during systole
    // The jugular vein in real life would be blue, but for this simulation
    // we're focusing on arterial flow visualization
    return true;
  }
  
  /**
   * Apply Doppler color V2 - REALISTIC arterial flow with subtle aliasing
   * All vessels are red, with LOCALIZED aliasing during peak systole
   */
  private applyDopplerColorToPixelV2(
    data: Uint8ClampedArray,
    px: number,
    py: number,
    width: number,
    distFromCenter: number,
    pulse: number,
    isArterial: boolean
  ): void {
    // ═══════════════════════════════════════════════════════════════════════════════
    // REALISTIC ARTERIAL DOPPLER
    // 
    // Base: RED throughout the vessel
    // During systole (pulsation):
    // - Center becomes YELLOW/ORANGE (high velocity)
    // - SOME spots show brief CYAN/BLUE aliasing (only at peak, localized)
    // - Edges stay darker red (lower velocity)
    // ═══════════════════════════════════════════════════════════════════════════════
    
    // Parabolic velocity profile (center = fastest)
    const normalizedRadius = Math.min(1.0, distFromCenter);
    const laminarProfile = Math.pow(1.0 - normalizedRadius * normalizedRadius, 0.6);
    
    // === CARDIAC CYCLE ===
    const cardiacPhase = (this.time * 1.2) % 1.0;
    // Sharp systolic peak
    const systolicWave = Math.pow(Math.sin(cardiacPhase * Math.PI), 1.8);
    const diastolicBase = 0.3;
    const systolicPeak = diastolicBase + (1 - diastolicBase) * systolicWave;
    
    // === FLOW TURBULENCE (creates localized variation) ===
    const motionPhase = this.time * 4.0;
    const turbulenceX = this.dopplerNoise(px * 0.04 + motionPhase, py * 0.02, this.time) * 0.2;
    const turbulenceY = this.dopplerNoise(px * 0.02, py * 0.04 + motionPhase * 0.8, this.time * 1.3) * 0.15;
    const localTurbulence = turbulenceX + turbulenceY;
    
    // === VELOCITY ===
    const baseVelocity = laminarProfile * (0.65 + localTurbulence);
    const pulsatileVelocity = baseVelocity * systolicPeak * pulse;
    
    // Edge fade
    const edgeFade = Math.pow(laminarProfile, 0.4);
    const intensity = Math.max(0, pulsatileVelocity) * edgeFade;
    
    if (intensity < 0.05) return;
    
    const idx = (py * width + px) * 4;
    const gray = data[idx];
    
    // ═══ ARTERIAL COLOR MAPPING ═══
    // All vessels use red family with localized aliasing
    
    const v = pulsatileVelocity;
    let r: number, g: number, b: number;
    
    // Aliasing only happens at VERY high velocity AND with spatial randomness
    // This creates localized "spots" of aliasing, not uniform color change
    const aliasingThreshold = 0.72;
    const aliasingNoise = this.dopplerNoise(px * 0.06 + this.time * 3, py * 0.06, this.time * 2);
    const shouldAlias = v > aliasingThreshold && aliasingNoise > 0.55 && laminarProfile > 0.6;
    
    if (shouldAlias) {
      // === LOCALIZED ALIASING (brief cyan/blue spots) ===
      const aliasStrength = Math.min(1.0, (v - aliasingThreshold) / 0.3) * (aliasingNoise - 0.55) * 2.2;
      
      // Yellow → Cyan transition
      r = Math.floor(255 - 180 * aliasStrength);
      g = Math.floor(200 + 30 * aliasStrength);
      b = Math.floor(50 + 160 * aliasStrength);
      
    } else {
      // === NORMAL RED FLOW ===
      // Maps velocity to: Dark red → Bright red → Orange → Yellow
      
      if (v < 0.25) {
        // Diastole: Dark red
        const t = v / 0.25;
        r = Math.floor(90 + 90 * t);
        g = Math.floor(8 + 20 * t);
        b = Math.floor(8 + 8 * t);
      } else if (v < 0.5) {
        // Rising: Bright red
        const t = (v - 0.25) / 0.25;
        r = Math.floor(180 + 55 * t);
        g = Math.floor(28 + 45 * t);
        b = Math.floor(16 - 8 * t);
      } else if (v < 0.72) {
        // Peak approaching: Orange/Yellow
        const t = (v - 0.5) / 0.22;
        r = Math.floor(235 + 20 * t);
        g = Math.floor(73 + 100 * t);
        b = Math.floor(8 + 30 * t);
      } else {
        // High velocity (no aliasing trigger): Bright yellow
        const t = Math.min(1.0, (v - 0.72) / 0.28);
        r = 255;
        g = Math.floor(173 + 50 * t);
        b = Math.floor(38 + 30 * t);
      }
    }
    
    // === EDGE BLUE TINT DURING PULSATION ===
    // Edges get a subtle blue shift during systole (reverse flow at edges)
    const isAtEdge = laminarProfile < 0.45;
    const edgeBlueTint = isAtEdge ? systolicWave * (1 - laminarProfile / 0.45) * 0.6 : 0;
    
    if (edgeBlueTint > 0.1) {
      // Add blue tint to edges during pulsation
      r = Math.floor(r * (1 - edgeBlueTint * 0.5));
      g = Math.floor(g * (1 - edgeBlueTint * 0.2));
      b = Math.floor(Math.min(255, b + edgeBlueTint * 120));
    }
    
    // Apply edge darkening
    r = Math.floor(r * (0.4 + 0.6 * edgeFade));
    g = Math.floor(g * (0.4 + 0.6 * edgeFade));
    b = Math.floor(b * (0.4 + 0.6 * edgeFade));
    
    // Blend with B-mode
    const alpha = 0.82 + 0.16 * intensity;
    const invAlpha = 1 - alpha;
    
    // Shimmer
    const shimmer = this.dopplerNoise(px * 0.1 + this.time * 3, py * 0.1, this.time * 4) * 10;
    
    data[idx] = Math.min(255, Math.max(0, Math.floor(r * alpha + gray * invAlpha + shimmer * 0.5)));
    data[idx + 1] = Math.min(255, Math.max(0, Math.floor(g * alpha + gray * invAlpha + shimmer * 0.3)));
    data[idx + 2] = Math.min(255, Math.max(0, Math.floor(b * alpha + gray * invAlpha + shimmer * 0.6)));
    data[idx + 2] = Math.min(255, Math.max(0, Math.floor(b * alpha + gray * invAlpha + shimmer * (isArterial ? 0.2 : 1))));
  }
  
  /**
   * Legacy Doppler color function (kept for compatibility)
   */
  private applyDopplerColorToPixel(
    data: Uint8ClampedArray,
    px: number,
    py: number,
    width: number,
    distFromCenter: number,
    pulse: number,
    depth: number,
    lateral: number,
    incCenterX: number
  ): void {
    // Determine vessel type based on position (legacy behavior)
    const flowBias = lateral - incCenterX;
    const isArterial = flowBias < 0.15;
    this.applyDopplerColorToPixelV2(data, px, py, width, distFromCenter, pulse, isArterial);
  }
  
  /**
   * 3-parameter hash noise for Doppler color variation
   */
  private dopplerNoise(x: number, y: number, t: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233 + t * 43.8912) * 43758.5453;
    return n - Math.floor(n);
  }
  
  private renderOverlays(): void {
    if (this.config.showBeamLines) this.drawBeamLines();
    if (this.config.showDepthScale) this.drawDepthScale();
    if (this.config.showFocusMarker) this.drawFocusMarker();
    if (this.config.showAnatomyLabels) this.drawLabels();
    if (this.config.showFieldLines) this.drawFieldLines();
    if (this.config.showAttenuationMap) this.drawAttenuationMap();
    if (this.config.showPhysicsPanel) this.drawPhysicsPanel();
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
  
  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * FIELD LINES OVERLAY - Concentric wave propagation arcs (didactic overlay)
   * ═══════════════════════════════════════════════════════════════════════════════
   */
  private drawFieldLines(): void {
    const { width, height } = this.canvas;
    
    this.ctx.strokeStyle = 'rgba(0, 200, 255, 0.25)';
    this.ctx.lineWidth = 1;
    
    if (this.config.transducerType === 'linear') {
      // Linear: horizontal arcs representing wavefronts
      const numArcs = 8;
      for (let i = 1; i <= numArcs; i++) {
        const y = (i / numArcs) * height;
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(width, y);
        this.ctx.stroke();
      }
    } else {
      // Convex/Microconvex: concentric arcs from transducer center
      const fovDegrees = this.config.transducerType === 'convex' ? 60 : 50;
      const transducerRadiusCm = this.config.transducerType === 'convex' ? 5.0 : 2.5;
      const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
      const centerX = width / 2;
      
      const totalDistanceFromCenter = transducerRadiusCm + this.config.depth;
      const pixelsPerCm = height / totalDistanceFromCenter;
      const arcRadiusPixels = transducerRadiusCm * pixelsPerCm;
      const virtualCenterY = -arcRadiusPixels;
      
      const numArcs = 8;
      for (let i = 1; i <= numArcs; i++) {
        const depthCm = (i / numArcs) * this.config.depth;
        const arcRadius = (transducerRadiusCm + depthCm) * pixelsPerCm;
        
        this.ctx.beginPath();
        this.ctx.arc(centerX, virtualCenterY, arcRadius, Math.PI / 2 - halfFOVRad, Math.PI / 2 + halfFOVRad);
        this.ctx.stroke();
      }
    }
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ATTENUATION MAP OVERLAY - Semi-transparent gradient showing intensity decay
   * ═══════════════════════════════════════════════════════════════════════════════
   */
  private drawAttenuationMap(): void {
    const { width, height } = this.canvas;
    
    // Create a semi-transparent overlay showing attenuation gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    
    // Color gradient from green (high intensity) to red (low intensity)
    gradient.addColorStop(0, 'rgba(0, 255, 100, 0.15)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 0, 0.12)');
    gradient.addColorStop(0.6, 'rgba(255, 100, 0, 0.10)');
    gradient.addColorStop(1.0, 'rgba(255, 0, 0, 0.08)');
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);
    
    // Add attenuation percentage labels
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    this.ctx.font = '10px monospace';
    
    const attenuationDb = this.config.frequency * 0.7; // ~0.7 dB/cm/MHz typical
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const y = (i / steps) * height;
      const depthCm = (i / steps) * this.config.depth;
      const totalAttenuation = attenuationDb * depthCm;
      const percentRemaining = Math.pow(10, -totalAttenuation / 10) * 100;
      
      this.ctx.fillText(`${percentRemaining.toFixed(0)}%`, width - 35, y + 12);
    }
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * PHYSICS PANEL - Real-time physics parameters display
   * ═══════════════════════════════════════════════════════════════════════════════
   */
  private drawPhysicsPanel(): void {
    const { width } = this.canvas;
    
    // Semi-transparent panel background
    const panelWidth = 180;
    const panelHeight = 140;
    const panelX = width - panelWidth - 10;
    const panelY = 10;
    
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    this.ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    
    // Border
    this.ctx.strokeStyle = 'rgba(0, 200, 255, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
    
    // Title
    this.ctx.fillStyle = 'rgba(0, 200, 255, 1)';
    this.ctx.font = 'bold 11px monospace';
    this.ctx.fillText('PARÂMETROS FÍSICOS', panelX + 10, panelY + 18);
    
    // Parameters
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.font = '10px monospace';
    
    const params = [
      `Freq: ${this.config.frequency.toFixed(1)} MHz`,
      `Prof: ${this.config.depth.toFixed(1)} cm`,
      `Foco: ${this.config.focus.toFixed(1)} cm`,
      `Ganho: ${this.config.gain.toFixed(0)} dB`,
      `DR: ${this.config.dynamicRange} dB`,
      `Transd: ${this.config.transducerType.toUpperCase()}`,
    ];
    
    params.forEach((param, i) => {
      this.ctx.fillText(param, panelX + 10, panelY + 35 + i * 16);
    });
    
    // Calculate and display derived physics
    const wavelengthMm = (1.54 / this.config.frequency).toFixed(2); // c = 1540 m/s in tissue
    const axialRes = (parseFloat(wavelengthMm) / 2).toFixed(2);
    
    this.ctx.fillStyle = 'rgba(100, 255, 100, 0.9)';
    this.ctx.fillText(`λ: ${wavelengthMm}mm | Res: ${axialRes}mm`, panelX + 10, panelY + 130);
  }
}
