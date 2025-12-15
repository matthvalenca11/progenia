/**
 * ConvexPolarEngine.ts
 * 
 * Motor de renderização para transdutor CONVEXO com geometria correta:
 * - Transdutor é um ARCO (não um ponto)
 * - Raios divergem a partir de múltiplos pontos do arco
 * - Renderização em coordenadas polares puras
 * - Inclusões, sombras e speckle em espaço polar
 * 
 * Geometria física correta de ultrassom abdominal convexo.
 */

import { UltrasoundLayerConfig, UltrasoundInclusionConfig, getAcousticMedium } from '@/types/acousticMedia';
import { UnifiedPhysicsCore, PhysicsConfig, TissueProperties } from './UnifiedPhysicsCore';

export interface ConvexPolarConfig {
  // Geometria do transdutor
  fovDegrees: number;           // Abertura total do leque (60-90°)
  transducerRadiusCm: number;   // Raio do arco do transdutor (footprint)
  maxDepthCm: number;           // Profundidade máxima em cm
  
  // Resolução polar interna
  numDepthSamples: number;      // Resolução radial (r)
  numAngleSamples: number;      // Resolução angular (θ)
  
  // Parâmetros de física
  gain: number;                 // Ganho (0-100)
  frequency: number;            // Frequência em MHz
  focus?: number;               // Profundidade de foco em cm (opcional)
  lateralOffset: number;        // Offset lateral do transdutor (-1 a +1, limitado)
  
  // Canvas output
  canvasWidth: number;
  canvasHeight: number;
  
  // Dados anatômicos
  layers?: UltrasoundLayerConfig[];
  inclusions?: UltrasoundInclusionConfig[];
}

export class ConvexPolarEngine {
  private config: ConvexPolarConfig;
  private polarImage: Float32Array;      // Imagem polar (r, θ)
  private shadowMap: Float32Array;       // Mapa de sombras acústicas
  private time: number = 0;
  private physicsCore: UnifiedPhysicsCore; // Motor de física unificado

  constructor(config: ConvexPolarConfig) {
    this.config = config;
    this.polarImage = new Float32Array(config.numDepthSamples * config.numAngleSamples);
    this.shadowMap = new Float32Array(config.numDepthSamples * config.numAngleSamples);
    
    // Inicializar motor de física unificado
    this.physicsCore = new UnifiedPhysicsCore(config.canvasWidth, config.canvasHeight);
  }

  /**
   * Get frequency-dependent PSF parameters
   * Higher frequency = sharper image, Lower frequency = blurrier
   */
  private getFrequencyDependentPSF(): { sigmaAxial: number; sigmaLateral: number; speckleScale: number } {
    const f = this.config.frequency;
    const fRef = 6.0; // Reference = max frequency for convex
    
    // Stronger blur constants for visible resolution effect
    const kAxial = 0.6;   // Increased from 0.12
    const kLateral = 0.8; // Increased from 0.15
    
    const frequencyRatio = fRef / f;
    
    // Gradual scaling from high to low frequency
    // At 6 MHz: ratio=1.0, sigma=0 (sharpest)
    // At 3 MHz: ratio=2.0, sigmaAxial=0.6, sigmaLateral=0.8
    // At 2 MHz: ratio=3.0, sigmaAxial=1.2, sigmaLateral=1.6
    const sigmaAxial = kAxial * Math.max(0, frequencyRatio - 1.0);
    const sigmaLateral = kLateral * Math.max(0, frequencyRatio - 1.0);
    
    // Speckle grain: more noticeable scaling (15% effect)
    const speckleScale = 1.0 + (frequencyRatio - 1.0) * 0.15;
    
    return { sigmaAxial, sigmaLateral, speckleScale };
  }

  /**
   * Atualiza configuração
   */
  updateConfig(config: Partial<ConvexPolarConfig>) {
    this.config = { ...this.config, ...config };
    
    // Realocar arrays se tamanho mudou
    const newSize = this.config.numDepthSamples * this.config.numAngleSamples;
    if (this.polarImage.length !== newSize) {
      this.polarImage = new Float32Array(newSize);
      this.shadowMap = new Float32Array(newSize);
    }
  }

  /**
   * Renderiza um frame completo
   */
  render(ctx: CanvasRenderingContext2D) {
    this.time += 0.016;
    
    // Atualizar tempo no motor de física
    this.physicsCore.updateTime(this.time);
    
    // Etapa 1: Gerar imagem polar interna com física
    this.generatePolarImageWithPhysics();
    
    // Etapa 2: Converter polar → XY e renderizar no canvas
    this.renderPolarToCanvas(ctx);
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * GENERATE POLAR IMAGE - PHOTOMETRICALLY IDENTICAL TO LINEAR MODE
   * ═══════════════════════════════════════════════════════════════════════════════
   * 
   * All photometric parameters (speckle, attenuation, gain, contrast, noise) are
   * EXACTLY copied from Linear mode. Only beam geometry differs (fan vs parallel).
   */
  private generatePolarImageWithPhysics() {
    const { numDepthSamples, numAngleSamples, maxDepthCm, frequency, gain, fovDegrees } = this.config;
    
    const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
    
    // Configuração de física para motor unificado
    const physicsConfig: PhysicsConfig = {
      frequency,
      depth: maxDepthCm,
      focus: this.config.focus || maxDepthCm * 0.5,
      gain,
      dynamicRange: 60,
      enableSpeckle: true,
      enablePosteriorEnhancement: true,
      enableAcousticShadow: true,
      enableReverberation: false,
    };
    
    // Limpar shadow map - será recalculado COM motion a cada frame
    this.shadowMap.fill(1.0);
    
    // ═══ RECALCULAR SHADOW MAP COM MOTION ═══
    this.computeAcousticShadowsWithMotion(physicsConfig);
    
    // ═══ GERAR IMAGEM POLAR ═══
    for (let rIdx = 0; rIdx < numDepthSamples; rIdx++) {
      for (let thetaIdx = 0; thetaIdx < numAngleSamples; thetaIdx++) {
        const idx = rIdx * numAngleSamples + thetaIdx;
        
        // Profundidade em cm
        let r = (rIdx / numDepthSamples) * maxDepthCm;
        
        // Ângulo em radianos [-halfFOV, +halfFOV]
        const theta = ((thetaIdx / numAngleSamples) * 2 - 1) * halfFOVRad;
        
        // Converter para coordenadas cartesianas para física
        let x = r * Math.sin(theta);
        let y = r * Math.cos(theta);
        
        // ═══ MOTION ARTIFACTS - IDENTICAL TO LINEAR ═══
        // 1. Breathing motion (cyclic vertical displacement)
        const breathingCycle = Math.sin(this.time * 0.3) * 0.015; // ~20 breaths/min, ±0.15mm
        const breathingDepthEffect = r / maxDepthCm;
        y += breathingCycle * breathingDepthEffect;
        
        // 2. Probe micro-jitter (operator hand tremor)
        const jitterLateral = Math.sin(this.time * 8.5 + Math.cos(this.time * 12)) * 0.008;
        const jitterDepth = Math.cos(this.time * 7.2 + Math.sin(this.time * 9.5)) * 0.006;
        x += jitterLateral;
        y += jitterDepth;
        
        // 3. Tissue micro-movements (random fibrillar motion)
        const tissueTremor = Math.sin(x * 100 * 0.02 + this.time * 5) * 
                             Math.cos(y * 100 * 0.015 + this.time * 4) * 0.003;
        y += tissueTremor;
        
        // Reconverter para polar com motion aplicado
        const rWithMotion = Math.sqrt(x * x + y * y);
        const thetaWithMotion = Math.atan2(x, y);
        
        // Índices de pixel fictícios para cache (mapeamento polar → cartesiano)
        const pixelX = Math.floor((theta / (2 * halfFOVRad) + 0.5) * this.config.canvasWidth);
        const pixelY = Math.floor((r / maxDepthCm) * this.config.canvasHeight);
        
        // ═══════════════════════════════════════════════════════════════════════════════
        // PIPELINE IDENTICAL TO LINEAR MODE:
        // 1. Base intensity (clean, no noise)
        // 2. Physical effects (attenuation, TGC, focal gain)
        // 3. Interface reflections
        // 4. Beam falloff
        // 5. SHADOW (applied to clean image)
        // 6. SPECKLE (applied last, multiplicative noise)
        // 7. LOG COMPRESSION
        // ═══════════════════════════════════════════════════════════════════════════════
        
        // ═══ 1. OBTER TECIDO EM (r, θ) COM MOTION ═══
        const tissue = this.getTissueAtPolar(rWithMotion, thetaWithMotion);
        
        // ═══ 2. ECHOGENICIDADE BASE - IDENTICAL TO LINEAR ═══
        let intensity = this.getBaseEchogenicityLinear(tissue.echogenicity);
        
        // ═══ 3. ATENUAÇÃO - IDENTICAL TO LINEAR ═══
        const attenuationDb = tissue.attenuation * frequency * r;
        const attenuation = Math.pow(10, -attenuationDb / 20);
        intensity *= attenuation;
        
        // ═══ 4. GANHO FOCAL - IDENTICAL TO LINEAR ═══
        const focusDepth = physicsConfig.focus;
        const focalDist = Math.abs(r - focusDepth);
        const focalGain = 1 + 0.4 * Math.exp(-focalDist * focalDist * 2);
        intensity *= focalGain;
        
        // ═══ 5. TGC - IDENTICAL TO LINEAR ═══
        const tgc = 1 + r / maxDepthCm * 0.3;
        intensity *= tgc;
        
        // ═══ 6. INTERFACE REFLECTIONS - IDENTICAL TO LINEAR (multiplicative) ═══
        // Simplified reflection at layer boundaries
        const reflection = this.calculateInterfaceReflectionPolar(r, theta);
        intensity *= (1 + reflection * 0.3);
        
        // ═══ 7. BEAM FALLOFF (adapted for polar geometry) ═══
        const normalizedLateral = Math.abs(theta) / halfFOVRad; // 0 to 1
        const beamFalloff = 1 - normalizedLateral * normalizedLateral * 0.15;
        intensity *= beamFalloff;
        
        // ═══ 8. APLICAR SOMBRA ACÚSTICA - ANTES DO SPECKLE ═══
        const rIdxWithMotion = Math.floor((rWithMotion / maxDepthCm) * numDepthSamples);
        const thetaIdxWithMotion = Math.floor(((thetaWithMotion / halfFOVRad) + 1) * 0.5 * numAngleSamples);
        
        const clampedRIdx = Math.max(0, Math.min(numDepthSamples - 1, rIdxWithMotion));
        const clampedThetaIdx = Math.max(0, Math.min(numAngleSamples - 1, thetaIdxWithMotion));
        const shadowIdx = clampedRIdx * numAngleSamples + clampedThetaIdx;
        
        intensity *= this.shadowMap[shadowIdx];
        
        // ═══ 9. REALCE POSTERIOR (se aplicável) ═══
        if (tissue.posteriorEnhancement) {
          const enhancementFactor = 1.2 + (r / maxDepthCm) * 0.4;
          intensity *= enhancementFactor;
        }
        
        // ═══════════════════════════════════════════════════════════════════════════════
        // 10. SPECKLE - FREQUENCY-DEPENDENT GRAIN SIZE
        // ═══════════════════════════════════════════════════════════════════════════════
        // Speckle grain size scales with 1/frequency (lower freq = coarser grains)
        
        // Get frequency-dependent scaling
        const psf = this.getFrequencyDependentPSF();
        const speckleScale = psf.speckleScale;
        
        // Scale sampling coordinates inversely with frequency
        const scaledX = pixelX / speckleScale;
        const scaledY = pixelY / speckleScale;
        
        const speckleIdx = Math.floor(scaledY) * this.config.canvasWidth + Math.floor(scaledX);
        
        // Use hash-based Rayleigh approximation
        const rayleighSeed = Math.abs(speckleIdx) * 12.9898 + 78.233;
        const rayleigh = Math.abs(Math.sqrt(-2 * Math.log(Math.max(0.001, this.noise(rayleighSeed)))) * 
                                  Math.cos(2 * Math.PI * this.noise(rayleighSeed + 1000)));
        
        // Perlin-style noise with frequency scaling
        const perlin = this.multiOctaveNoiseLinear(scaledX, scaledY, 6);
        
        // Depth-dependent speckle size
        const depthFactor = 1 + (r / maxDepthCm) * 0.25;
        
        // Per-pixel granular noise with frequency scaling
        const px = scaledX * 0.1 + this.time * 0.5;
        const py = scaledY * 0.1;
        const hashNoise = this.noise(px * 12.9898 + py * 78.233) * 2 - 1;
        const fineHash = this.noise((px + 100) * 45.123 + (py + 50) * 91.456) * 2 - 1;
        
        // Base speckle from Rayleigh/Perlin
        const baseSpeckle = (rayleigh * 0.5 + (perlin * 0.5 + 0.5) * 0.5) * depthFactor;
        
        // Pixel variation
        const pixelVariation = 1.0 + hashNoise * 0.15 + fineHash * 0.1;
        
        // Combined speckle multiplier
        const speckleMultiplier = (0.5 + baseSpeckle * 0.5) * pixelVariation;
        
        // Blood flow modulation (if applicable) - IDENTICAL TO LINEAR
        let flowMultiplier = 1.0;
        if (tissue.isInclusion) {
          const inclusion = this.config.inclusions?.find(inc => 
            this.isPointInInclusionPolar(r, theta, inc)
          );
          if (inclusion?.mediumInsideId === 'blood') {
            const inclLateral = inclusion.centerLateralPos * maxDepthCm * Math.tan(halfFOVRad);
            const inclX = r * Math.sin(theta);
            const dx = inclX - inclLateral;
            const dy = r - inclusion.centerDepthCm;
            const radialPos = Math.sqrt(dx * dx + dy * dy) / (inclusion.sizeCm.width / 2);
            const flowSpeed = Math.max(0, 1 - radialPos * radialPos) * 0.8;
            const flowPhase = this.time * flowSpeed * 25;
            const pulse = 0.5 + 0.5 * Math.sin(this.time * 1.2 * 2 * Math.PI);
            flowMultiplier = 1.0 + Math.sin(flowPhase + r * 8 + theta * 6) * 0.2 * pulse;
          }
        }
        
        // Apply PURELY MULTIPLICATIVE speckle - IDENTICAL TO LINEAR
        intensity *= speckleMultiplier * flowMultiplier;
        
        // ═══════════════════════════════════════════════════════════════════════════════
        // 11. LOG COMPRESSION - IDENTICAL TO LINEAR
        // ═══════════════════════════════════════════════════════════════════════════════
        const gainLinear = Math.pow(10, (gain - 50) / 20);
        intensity *= gainLinear;
        
        // Log compression - IDENTICAL TO LINEAR
        intensity = Math.log(1 + intensity * 10) / Math.log(11);
        
        // ═══ 12. FINAL CLAMP ═══
        this.polarImage[idx] = Math.max(0, Math.min(1, intensity));
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // STEP 13: FREQUENCY-DEPENDENT PSF BLUR (on polar image)
    // Lower frequency → larger PSF → blurrier image
    // ═══════════════════════════════════════════════════════════════════════════════
    this.applyFrequencyDependentBlurToPolar();
  }
  
  /**
   * Apply frequency-dependent Gaussian blur to the polar image buffer
   */
  private applyFrequencyDependentBlurToPolar(): void {
    const psf = this.getFrequencyDependentPSF();
    const { numDepthSamples, numAngleSamples } = this.config;
    
    // Skip blur if sigmas are too small (high frequency = sharp image)
    if (psf.sigmaAxial < 0.8 && psf.sigmaLateral < 0.8) {
      return;
    }
    
    const temp = new Float32Array(this.polarImage.length);
    
    // Horizontal blur (angular direction = lateral PSF)
    const radiusH = Math.ceil(psf.sigmaLateral * 2);
    if (radiusH >= 1) {
      for (let r = 0; r < numDepthSamples; r++) {
        for (let t = 0; t < numAngleSamples; t++) {
          let sum = 0;
          let weightSum = 0;
          
          for (let k = -radiusH; k <= radiusH; k++) {
            const st = Math.max(0, Math.min(numAngleSamples - 1, t + k));
            const weight = Math.exp(-(k * k) / (2 * psf.sigmaLateral * psf.sigmaLateral));
            sum += this.polarImage[r * numAngleSamples + st] * weight;
            weightSum += weight;
          }
          
          temp[r * numAngleSamples + t] = sum / weightSum;
        }
      }
      this.polarImage.set(temp);
    }
    
    // Vertical blur (radial direction = axial PSF)
    const radiusV = Math.ceil(psf.sigmaAxial * 2);
    if (radiusV >= 1) {
      for (let r = 0; r < numDepthSamples; r++) {
        for (let t = 0; t < numAngleSamples; t++) {
          let sum = 0;
          let weightSum = 0;
          
          for (let k = -radiusV; k <= radiusV; k++) {
            const sr = Math.max(0, Math.min(numDepthSamples - 1, r + k));
            const weight = Math.exp(-(k * k) / (2 * psf.sigmaAxial * psf.sigmaAxial));
            sum += this.polarImage[sr * numAngleSamples + t] * weight;
            weightSum += weight;
          }
          
          temp[r * numAngleSamples + t] = sum / weightSum;
        }
      }
      this.polarImage.set(temp);
    }
  }
  
  /**
   * Base echogenicity - IDENTICAL TO LINEAR
   */
  private getBaseEchogenicityLinear(echogenicity: string): number {
    switch (echogenicity) {
      case 'anechoic': return 0.05;
      case 'hypoechoic': return 0.35;
      case 'isoechoic': return 0.55;
      case 'hyperechoic': return 0.85;
      default: return 0.5;
    }
  }
  
  /**
   * Interface reflection for polar coordinates
   */
  private calculateInterfaceReflectionPolar(r: number, theta: number): number {
    // Simplified layer interface detection
    if (!this.config.layers || this.config.layers.length < 2) return 0;
    
    let cumulativeDepth = 0;
    for (let i = 0; i < this.config.layers.length - 1; i++) {
      cumulativeDepth += this.config.layers[i].thicknessCm;
      const distFromInterface = Math.abs(r - cumulativeDepth);
      if (distFromInterface < 0.05) {
        // Near interface - add reflection
        return Math.exp(-distFromInterface * 40) * 0.3;
      }
    }
    return 0;
  }
  
  /**
   * Multi-octave Perlin noise - IDENTICAL TO LINEAR
   */
  private multiOctaveNoiseLinear(x: number, y: number, octaves: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      const sampleX = x * frequency * 0.01;
      const sampleY = y * frequency * 0.01;
      const n = Math.sin(sampleX * 12.9898 + sampleY * 78.233 + i * 43758.5453) * 43758.5453;
      const noiseVal = (n - Math.floor(n)) * 2 - 1;
      value += noiseVal * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    
    return value / maxValue;
  }
  
  /**
   * Verifica se ponto polar está em inclusão
   */
  private isPointInInclusionPolar(r: number, theta: number, inclusion: UltrasoundInclusionConfig): boolean {
    const { fovDegrees, transducerRadiusCm, lateralOffset } = this.config;
    const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
    
    // Aplicar lateral offset
    const clampedOffset = Math.max(-0.3, Math.min(0.3, lateralOffset || 0));
    const offsetCm = clampedOffset * this.config.maxDepthCm * 0.5;
    
    // Converter (r, θ) para cartesiano COM offset
    const x = r * Math.sin(theta) + offsetCm;
    const y = r * Math.cos(theta);
    
    const inclDepth = inclusion.centerDepthCm;
    const inclLateral = inclusion.centerLateralPos;
    
    const maxLateralAtDepth = inclDepth * Math.tan(halfFOVRad);
    const inclX = inclLateral * maxLateralAtDepth * 2;
    const inclY = inclDepth;
    
    const dx = x - inclX;
    const dy = y - inclY;
    
    const beamWidthFactor = 1.0 + (r / this.config.maxDepthCm) * 0.4;
    const distortedDx = dx / beamWidthFactor;
    
    const halfWidth = inclusion.sizeCm.width / 2;
    const halfHeight = inclusion.sizeCm.height / 2;
    
    if (inclusion.shape === 'ellipse') {
      const normX = distortedDx / halfWidth;
      const normY = dy / halfHeight;
      return (normX * normX + normY * normY) <= 1.0;
    } else if (inclusion.shape === 'capsule') {
      // Capsule: rectangle with semicircular ends + rotation
      const capsuleRadius = halfHeight;
      const rectHalfWidth = halfWidth - capsuleRadius;
      
      const rotationDeg = inclusion.rotationDegrees ?? 0;
      const rotationRad = (rotationDeg * Math.PI) / 180;
      const cosR = Math.cos(rotationRad);
      const sinR = Math.sin(rotationRad);
      const dxLocal = distortedDx * cosR + dy * sinR;
      const dyLocal = -distortedDx * sinR + dy * cosR;
      
      if (Math.abs(dxLocal) <= rectHalfWidth) {
        return Math.abs(dyLocal) <= capsuleRadius;
      } else {
        const endCenterX = Math.sign(dxLocal) * rectHalfWidth;
        const localDx = dxLocal - endCenterX;
        const distToEndCenter = Math.sqrt(localDx * localDx + dyLocal * dyLocal);
        return distToEndCenter <= capsuleRadius;
      }
    } else {
      return Math.abs(distortedDx) <= halfWidth && Math.abs(dy) <= halfHeight;
    }
  }
  

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ACOUSTIC SHADOW - COMPLETE REWRITE v4 (CONVEX/MICROCONVEX)
   * ═══════════════════════════════════════════════════════════════════════════════
   * 
   * PHYSICAL MODEL FOR FAN-SHAPED BEAMS:
   * - Each beam originates from the transducer arc and diverges outward
   * - Beam at angle θ travels radially from surface to max depth
   * - When beam intersects an inclusion, shadow is cast along THAT beam
   * - Shadow starts at EXACT exit point - NO GAP
   * - Multiple beams through inclusion create a fan-shaped shadow
   * 
   * ALGORITHM:
   * 1. For each beam (angle θ):
   *    a. Trace ray from transducer surface along angle θ
   *    b. Find intersection with inclusion (entry and exit points)
   *    c. z_exit = radial depth where ray exits inclusion
   *    d. For all depths > z_exit: apply exponential attenuation
   * 
   * 2. Diffuse edges come from:
   *    - Beams at the edge of inclusion have partial blocking
   *    - Per-beam alpha variation creates organic texture
   * 
   * CRITICAL: Process each beam INDEPENDENTLY. The shadow is the SUM of
   * individual beam attenuations, NOT a geometric shape.
   */
  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ACOUSTIC SHADOW - FIXED COORDINATE SYSTEM v6 (CONVEX/MICROCONVEX)
   * ═══════════════════════════════════════════════════════════════════════════════
   * 
   * KEY INSIGHT: The image rendering in generatePolarImageWithPhysics applies
   * motion to the SAMPLING POINT (r, theta), NOT to the inclusion position.
   * 
   * getTissueAtPolar() checks inclusion at ORIGINAL position (no motion).
   * The "motion" effect comes from sampling at displaced coordinates.
   * 
   * Therefore, the shadow must ALSO use the ORIGINAL inclusion position,
   * so both the inclusion AND shadow remain aligned in the same coordinate system.
   * 
   * The apparent "motion" of both comes from the displaced sampling, which
   * shifts the ENTIRE image (inclusion + shadow together).
   */
  private computeAcousticShadowsWithMotion(physicsConfig: PhysicsConfig) {
    if (!this.config.inclusions || this.config.inclusions.length === 0) return;
    
    const { numDepthSamples, numAngleSamples, maxDepthCm, fovDegrees, lateralOffset } = this.config;
    const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // UNIFIED SHADOW PARAMETERS - Convex/Microconvex shadows (20% darker)
    // ═══════════════════════════════════════════════════════════════════════════════
    const SHADOW_ALPHA_BASE = 0.7;     // Attenuation speed
    const SHADOW_STRENGTH = 0.20;      // Reference only
    const SHADOW_MIN_INTENSITY = 0.80; // Shadow goes down to 80% brightness (20% darker)
    
    // Apply same lateral offset as getTissueAtPolar
    const clampedOffset = Math.max(-0.3, Math.min(0.3, lateralOffset || 0));
    const offsetCm = clampedOffset * maxDepthCm * 0.5;
    
    // ═══ PROCESS EACH BEAM (ANGLE) ═══
    for (let thetaIdx = 0; thetaIdx < numAngleSamples; thetaIdx++) {
      const theta = ((thetaIdx / numAngleSamples) * 2 - 1) * halfFOVRad;
      
      for (const inclusion of this.config.inclusions) {
        if (!inclusion.hasStrongShadow) continue;
        
        // ═══ EXACT SAME GEOMETRY AS isPointInInclusionPolar ═══
        const inclDepth = inclusion.centerDepthCm;
        const inclLateral = inclusion.centerLateralPos;
        
        // Match isPointInInclusionPolar exactly
        const maxLateralAtInclDepth = inclDepth * Math.tan(halfFOVRad);
        const inclX = inclLateral * maxLateralAtInclDepth * 2;
        const inclY = inclDepth;
        
        const halfWidth = inclusion.sizeCm.width / 2;
        const halfHeight = inclusion.sizeCm.height / 2;
        
        // ═══ TRACE BEAM TO FIND EXACT INTERSECTION ═══
        // MUST use same beamWidthFactor as isPointInInclusionPolar
        let z_exit = -1;
        let wasInside = false;
        let edgeFactor = 1.0;
        
        for (let rIdx = 0; rIdx < numDepthSamples; rIdx++) {
          const r = (rIdx / numDepthSamples) * maxDepthCm;
          
          const x = r * Math.sin(theta) + offsetCm;
          const y = r * Math.cos(theta);
          
          const dx = x - inclX;
          const dy = y - inclY;
          
          // ═══ SAME beamWidthFactor as isPointInInclusionPolar ═══
          const beamWidthFactor = 1.0 + (r / maxDepthCm) * 0.4;
          const distortedDx = dx / beamWidthFactor;
          
          let isInside = false;
          
          if (inclusion.shape === 'ellipse') {
            const normX = distortedDx / halfWidth;
            const normY = dy / halfHeight;
            const dist = Math.sqrt(normX * normX + normY * normY);
            isInside = dist <= 1.0;
            if (isInside) {
              edgeFactor = Math.max(0.3, 1.0 - dist * 0.7);
            }
          } else if (inclusion.shape === 'capsule') {
            // Capsule with ROTATION and IRREGULARITY for anatomical realism
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
              dist = Math.abs(dyLocal) / effectiveRadius;
              isInside = dist <= 1.0;
            } else {
              const endCenterX = Math.sign(dxLocal) * rectHalfWidth;
              const localDxEnd = dxLocal - endCenterX;
              const distToEndCenter = Math.sqrt(localDxEnd * localDxEnd + dyLocal * dyLocal);
              dist = distToEndCenter / effectiveRadius;
              isInside = dist <= 1.0;
            }
            if (isInside) {
              edgeFactor = Math.max(0.3, 1.0 - dist * 0.7);
            }
          } else {
            isInside = Math.abs(distortedDx) <= halfWidth && Math.abs(dy) <= halfHeight;
            if (isInside) {
              const normDist = Math.max(Math.abs(distortedDx) / halfWidth, Math.abs(dy) / halfHeight);
              edgeFactor = Math.max(0.3, 1.0 - normDist * 0.7);
            }
          }
          
          if (isInside) {
            wasInside = true;
            z_exit = r;
          } else if (wasInside && !isInside) {
            break;
          }
        }
        
        if (z_exit < 0) continue;
        
        // ═══ COMPUTE ALPHA ═══
        const inclusionMedium = getAcousticMedium(inclusion.mediumInsideId);
        const materialAttenuation = inclusionMedium.attenuation_dB_per_cm_MHz;
        const baseAlpha = SHADOW_ALPHA_BASE + Math.min(0.3, materialAttenuation / 8);
        
        // Per-beam variation using hash noise (not periodic sin)
        const beamNoise = 1.0 + (this.noise(thetaIdx * 17 + 42) - 0.5) * 0.12;
        const alpha = baseAlpha * beamNoise;
        
        // ═══ APPLY ATTENUATION WITH SMOOTH TRANSITION AT SHADOW START ═══
        const TRANSITION_DEPTH_CM = 0.10; // Shorter transition zone
        
        for (let rIdx = 0; rIdx < numDepthSamples; rIdx++) {
          const r = (rIdx / numDepthSamples) * maxDepthCm;
          
          if (r <= z_exit) continue;
          
          const posteriorDepth = r - z_exit;
          
          // ═══ SIMPLIFIED DIRECT SHADOW - More aggressive ═══
          // Direct exponential attenuation without complex edgeFactor blending
          const attenuation = Math.exp(-alpha * posteriorDepth);
          
          // Direct shadow: (1 - STRENGTH) at max attenuation, approaches 1.0 as attenuation → 1
          // With STRENGTH = 0.50, shadow goes from 1.0 down to 0.50 (50% darker)
          const rawShadow = SHADOW_MIN_INTENSITY + (1.0 - SHADOW_MIN_INTENSITY) * attenuation;
          
          // Apply edge softness (but keep it mild)
          const shadowFactor = SHADOW_MIN_INTENSITY + (rawShadow - SHADOW_MIN_INTENSITY) * edgeFactor;
          
          // ═══ SMOOTH TRANSITION: Blend shadow gradually at the start ═══
          let transitionBlend = 1.0;
          if (posteriorDepth < TRANSITION_DEPTH_CM) {
            const t = posteriorDepth / TRANSITION_DEPTH_CM;
            transitionBlend = t * t * (3 - 2 * t); // smoothstep function
          }
          
          // Apply transitioned shadow
          const finalShadow = 1.0 * (1 - transitionBlend) + shadowFactor * transitionBlend;
          
          const idx = rIdx * numAngleSamples + thetaIdx;
          this.shadowMap[idx] = Math.min(this.shadowMap[idx], finalShadow);
        }
      }
    }
  }
  
  /**
   * Compute intersection of a RADIAL beam (at angle θ) with an inclusion.
   * 
   * For convex transducers:
   * - Beam originates from transducer arc at angle θ
   * - Beam travels radially outward at angle θ
   * - Need to find where this ray intersects the inclusion
   * 
   * Returns:
   * - z_exit: radial depth where beam exits inclusion
   * - edgeFactor: 1.0 at center, 0.0 at edge (for diffuse shadows)
   */
  private computeRadialRayIntersection(
    theta: number,
    beamIdx: number,
    inclusion: UltrasoundInclusionConfig,
    halfFOVRad: number
  ): { z_exit: number; edgeFactor: number } | null {
    
    const inclCenterDepth = inclusion.centerDepthCm;
    const inclHalfHeight = inclusion.sizeCm.height / 2;
    
    // Compute inclusion's angular position
    // The inclusion's lateral position is normalized (-0.5 to +0.5)
    // Map this to actual angle in the fan
    const inclLateralNorm = inclusion.centerLateralPos;
    
    // For the inclusion at depth D, its lateral extent maps to an angular width
    // incl_theta = atan2(lateral_cm, depth_cm)
    // But we use the normalized lateral position directly
    const inclTheta = inclLateralNorm * halfFOVRad * 2; // Map to [-halfFOV, +halfFOV]
    
    // Compute angular radius of inclusion (how wide it appears at its depth)
    const inclRadius = inclusion.sizeCm.width / 2;
    
    // Angular radius = atan(radius / depth)
    const inclAngularRadius = Math.atan2(inclRadius, inclCenterDepth);
    
    // Per-beam noise for organic edges (±4%)
    const edgeNoise = this.noise(beamIdx * 13 + 456) * 0.08 - 0.04;
    const effectiveAngularRadius = inclAngularRadius * (1 + edgeNoise);
    
    // Angular distance from beam to inclusion center
    const angleDiff = Math.abs(theta - inclTheta);
    
    // Check if beam hits inclusion
    if (angleDiff > effectiveAngularRadius) return null;
    
    // ═══ COMPUTE EXACT EXIT POINT ═══
    // The beam at angle θ passes through the inclusion.
    // How far from the center axis is this beam?
    // normalizedDist = 0 → beam through center → exits at center + halfHeight
    // normalizedDist = 1 → beam at edge → exits at center
    
    const normalizedDist = angleDiff / effectiveAngularRadius; // 0 to 1
    
    // Circle/ellipse geometry: exit offset = halfHeight × sqrt(1 - d²)
    const exitOffset = inclHalfHeight * Math.sqrt(Math.max(0, 1 - normalizedDist * normalizedDist));
    const z_exit = inclCenterDepth + exitOffset;
    
    // Edge factor: 1 at center, 0 at edge (for diffuse shadows)
    const edgeFactor = Math.pow(1 - normalizedDist, 0.5);
    
    return { z_exit, edgeFactor };
  }
  
  /**
   * Deterministic noise function (0 to 1)
   */
  private noise(seed: number): number {
    const x = Math.sin(seed * 12.9898 + seed * 0.1) * 43758.5453;
    return x - Math.floor(x);
  }

  // DEPRECATED function removed - use computeAcousticShadowsWithMotion instead

  /**
   * Obtém propriedades do tecido em coordenadas polares
   * Aplica lateral offset para simular movimento do transdutor
   */
  private getTissueAtPolar(r: number, theta: number): {
    echogenicity: string;
    attenuation: number;
    isInclusion: boolean;
    posteriorEnhancement: boolean;
  } {
    const { fovDegrees, maxDepthCm, transducerRadiusCm, lateralOffset } = this.config;
    const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
    
    // Aplicar lateral offset (limitado a ±0.3 para movimento realista)
    const clampedOffset = Math.max(-0.3, Math.min(0.3, lateralOffset || 0));
    const offsetCm = clampedOffset * maxDepthCm * 0.5; // Escalar offset
    
    // Converter (r, θ) para cartesiano físico COM offset
    const x = r * Math.sin(theta) + offsetCm;
    const y = r * Math.cos(theta);
    
    // ═══ VERIFICAR INCLUSÕES ═══
    if (this.config.inclusions) {
      for (const inclusion of this.config.inclusions) {
        const inclDepth = inclusion.centerDepthCm;
        const inclLateral = inclusion.centerLateralPos; // -0.5 to +0.5
        
        // Converter lateral normalizado para cm
        const maxLateralAtDepth = inclDepth * Math.tan(halfFOVRad);
        const inclX = inclLateral * maxLateralAtDepth * 2;
        const inclY = inclDepth;
        
        // Distância da inclusão
        const dx = x - inclX;
        const dy = y - inclY;
        
        // Fator de distorção por divergência do feixe
        const beamWidthFactor = 1.0 + (r / maxDepthCm) * 0.4;
        const distortedDx = dx / beamWidthFactor;
        
        const halfWidth = inclusion.sizeCm.width / 2;
        const halfHeight = inclusion.sizeCm.height / 2;
        
        let isInside = false;
        
        if (inclusion.shape === 'ellipse') {
          const normX = distortedDx / halfWidth;
          const normY = dy / halfHeight;
          isInside = (normX * normX + normY * normY) <= 1.0;
        } else if (inclusion.shape === 'capsule') {
          // Capsule with ROTATION and IRREGULARITY for anatomical realism
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
          
          if (Math.abs(dxLocal) <= rectHalfWidth) {
            isInside = Math.abs(dyLocal) <= effectiveRadius;
          } else {
            const endCenterX = Math.sign(dxLocal) * rectHalfWidth;
            const localDxEnd = dxLocal - endCenterX;
            const distToEndCenter = Math.sqrt(localDxEnd * localDxEnd + dyLocal * dyLocal);
            isInside = distToEndCenter <= effectiveRadius;
          }
        } else {
          isInside = Math.abs(distortedDx) <= halfWidth && Math.abs(dy) <= halfHeight;
        }
        
        if (isInside) {
          const medium = getAcousticMedium(inclusion.mediumInsideId);
          return {
            echogenicity: medium.baseEchogenicity,
            attenuation: medium.attenuation_dB_per_cm_MHz,
            isInclusion: true,
            posteriorEnhancement: inclusion.posteriorEnhancement || false,
          };
        }
      }
    }
    
    // ═══ LAYERS POR PROFUNDIDADE ═══
    if (this.config.layers && this.config.layers.length > 0) {
      let cumulativeDepth = 0;
      for (const layer of this.config.layers) {
        cumulativeDepth += layer.thicknessCm;
        if (r <= cumulativeDepth) {
          const medium = getAcousticMedium(layer.mediumId);
          return {
            echogenicity: medium.baseEchogenicity,
            attenuation: medium.attenuation_dB_per_cm_MHz,
            isInclusion: false,
            posteriorEnhancement: false,
          };
        }
      }
    }
    
    // Default: tecido mole genérico
    return {
      echogenicity: 'isoechoic',
      attenuation: 0.7,
      isInclusion: false,
      posteriorEnhancement: false,
    };
  }


  /**
   * Gerador pseudo-aleatório determinístico
   */
  private pseudoRandom(seed: number): number {
    const x = Math.sin(seed) * 43758.5453123;
    return x - Math.floor(x);
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * ETAPA 2: Renderiza polar → canvas com ARCO DO TRANSDUTOR
   * ═══════════════════════════════════════════════════════════════════
   */
  private renderPolarToCanvas(ctx: CanvasRenderingContext2D) {
    const { canvasWidth, canvasHeight, fovDegrees, maxDepthCm, transducerRadiusCm, numDepthSamples, numAngleSamples } = this.config;
    
    const imageData = ctx.createImageData(canvasWidth, canvasHeight);
    const data = imageData.data;
    
    // ═══ GEOMETRIA CORRETA - PROFUNDIDADE MÁXIMA NO FUNDO DO CANVAS ═══
    const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
    const centerX = canvasWidth / 2;
    
    // Calcular escala para que maxDepthCm coincida EXATAMENTE com o fundo do canvas
    // A distância do centro virtual até o fundo = transducerRadius + maxDepth
    const totalDistanceFromCenter = transducerRadiusCm + maxDepthCm;
    const pixelsPerCm = canvasHeight / totalDistanceFromCenter;
    
    // Posicionar centro virtual para que:
    // - O arco do transdutor fique logo acima do canvas (ou no topo)
    // - A profundidade máxima chegue exatamente no fundo
    const arcRadiusPixels = transducerRadiusCm * pixelsPerCm;
    const virtualCenterY = -arcRadiusPixels; // Centro virtual está acima por 1 raio do arco
    
    
    let pixelsRendered = 0;
    let pixelsBlocked = 0;
    
    // ═══ RENDERIZAR CADA PIXEL ═══
    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const pixelIdx = (y * canvasWidth + x) * 4;
        
        // Posição relativa ao centro virtual
        const dx = x - centerX;
        const dy = y - virtualCenterY;
        
        // Distância radial do centro virtual
        const radiusFromCenter = Math.sqrt(dx * dx + dy * dy);
        
        // Ângulo do pixel
        const pixelAngle = Math.atan2(dx, dy);
        
        // ═══ MÁSCARA 1: FOV ANGULAR ═══
        if (Math.abs(pixelAngle) > halfFOVRad) {
          data[pixelIdx] = 0;
          data[pixelIdx + 1] = 0;
          data[pixelIdx + 2] = 0;
          data[pixelIdx + 3] = 255;
          pixelsBlocked++;
          continue;
        }
        
        // ═══ MÁSCARA 2: ACIMA DO ARCO DO TRANSDUTOR ═══
        const arcRadiusPixels = transducerRadiusCm * pixelsPerCm;
        if (radiusFromCenter < arcRadiusPixels) {
          data[pixelIdx] = 0;
          data[pixelIdx + 1] = 0;
          data[pixelIdx + 2] = 0;
          data[pixelIdx + 3] = 255;
          pixelsBlocked++;
          continue;
        }
        
        // ═══ PROFUNDIDADE FÍSICA ═══
        // Distância do pixel até a superfície do arco (ao longo do raio)
        const depthFromTransducer = radiusFromCenter - arcRadiusPixels;
        const physDepthCm = depthFromTransducer / pixelsPerCm;
        
        // ═══ MÁSCARA 3: PROFUNDIDADE MÁXIMA ═══
        if (physDepthCm > maxDepthCm || physDepthCm < 0) {
          data[pixelIdx] = 0;
          data[pixelIdx + 1] = 0;
          data[pixelIdx + 2] = 0;
          data[pixelIdx + 3] = 255;
          pixelsBlocked++;
          continue;
        }
        
        // ═══ SAMPLE DA IMAGEM POLAR COM INTERPOLAÇÃO BILINEAR ═══
        const rNorm = physDepthCm / maxDepthCm;
        const thetaNorm = (pixelAngle / halfFOVRad + 1) / 2; // [0, 1]
        
        // Posições contínuas (não inteiras)
        const rContinuous = rNorm * (numDepthSamples - 1);
        const thetaContinuous = thetaNorm * (numAngleSamples - 1);
        
        // Índices dos 4 vizinhos para interpolação
        const r0 = Math.floor(rContinuous);
        const r1 = Math.min(r0 + 1, numDepthSamples - 1);
        const t0 = Math.floor(thetaContinuous);
        const t1 = Math.min(t0 + 1, numAngleSamples - 1);
        
        // Frações para interpolação
        const rFrac = rContinuous - r0;
        const tFrac = thetaContinuous - t0;
        
        // Obter os 4 valores vizinhos
        const v00 = this.polarImage[r0 * numAngleSamples + t0];
        const v01 = this.polarImage[r0 * numAngleSamples + t1];
        const v10 = this.polarImage[r1 * numAngleSamples + t0];
        const v11 = this.polarImage[r1 * numAngleSamples + t1];
        
        // Interpolação bilinear
        const v0 = v00 * (1 - tFrac) + v01 * tFrac;
        const v1 = v10 * (1 - tFrac) + v11 * tFrac;
        let intensity = v0 * (1 - rFrac) + v1 * rFrac;
        
        // ═══ RUÍDO TEMPORAL - IDENTICAL TO LINEAR ═══
        const depthRatio = physDepthCm / maxDepthCm;
        const temporalSeed = this.time * 2.5;
        
        // Multi-frequency temporal noise - IDENTICAL TO LINEAR coefficients
        const highFreqNoise = Math.sin(x * 0.3 + y * 0.2 + temporalSeed * 12) * 0.012;
        const midFreqNoise = Math.sin(x * 0.08 + y * 0.1 + temporalSeed * 4) * 0.018;
        const lowFreqNoise = Math.sin(temporalSeed * 1.5) * 0.008;
        const frameNoise = (Math.random() - 0.5) * 0.025 * (1 + depthRatio * 0.5);
        
        const totalLiveNoise = (highFreqNoise + midFreqNoise + lowFreqNoise + frameNoise) * (1 + depthRatio * 0.8);
        intensity *= (1 + totalLiveNoise);
        
        // Scanline/refresh effect - IDENTICAL TO LINEAR
        const scanlinePos = (temporalSeed * 50) % canvasHeight;
        const scanlineDistance = Math.abs(y - scanlinePos);
        const scanlineEffect = Math.exp(-scanlineDistance * 0.3) * 0.015 * Math.sin(temporalSeed * 15);
        intensity *= (1 + scanlineEffect);
        
        // Vertical banding - IDENTICAL TO LINEAR
        const bandingNoise = Math.sin(x * 0.15 + temporalSeed * 2) * 0.006;
        intensity *= (1 + bandingNoise);
        
        // ═══ FEATHERING NAS BORDAS ═══
        const angleFromEdge = halfFOVRad - Math.abs(pixelAngle);
        const edgeFeatherAngle = halfFOVRad * 0.05;
        if (angleFromEdge < edgeFeatherAngle) {
          const edgeFalloff = angleFromEdge / edgeFeatherAngle;
          intensity *= edgeFalloff;
        }
        
        // Near-field feathering - IDENTICAL TO LINEAR
        const nearFieldCm = 0.3;
        if (physDepthCm < nearFieldCm) {
          const nearFalloff = physDepthCm / nearFieldCm;
          intensity *= (0.3 + 0.7 * nearFalloff);
        }
        
        // ═══ RENDERIZAR ═══
        const gray = Math.max(0, Math.min(255, intensity * 255));
        data[pixelIdx] = gray;
        data[pixelIdx + 1] = gray;
        data[pixelIdx + 2] = gray;
        data[pixelIdx + 3] = 255;
        
        pixelsRendered++;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Debug log apenas na primeira vez
    if (this.time < 0.1) {
      console.log('🔍 Convex Debug:', {
        canvasSize: `${canvasWidth}x${canvasHeight}`,
        transducerRadiusCm,
        maxDepthCm,
        fovDegrees,
        pixelsPerCm: pixelsPerCm.toFixed(2),
        virtualCenterY: virtualCenterY.toFixed(2),
        arcRadiusPixels: (transducerRadiusCm * pixelsPerCm).toFixed(2),
        pixelsRendered,
        pixelsBlocked,
        percentRendered: ((pixelsRendered / (canvasWidth * canvasHeight)) * 100).toFixed(1) + '%'
      });
    }
  }

  /**
   * Desenha o arco do transdutor (para debug)
   */
  private drawTransducerArc(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, halfFOV: number) {
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -halfFOV, halfFOV);
    ctx.stroke();
  }

  /**
   * Para a renderização
   */
  stop() {
    // Cleanup se necessário
  }
}
