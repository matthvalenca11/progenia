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
   * ═══════════════════════════════════════════════════════════════════
   * ETAPA 1: Gera imagem polar com FÍSICA UNIFICADA (baseada no Linear)
   * ═══════════════════════════════════════════════════════════════════
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
        
        // ═══ APLICAR MOTION ARTIFACTS COM AMPLITUDE AUMENTADA (breathing, jitter, tremor) ═══
        const withMotion = this.physicsCore.applyMotionArtifacts(y, x, physicsConfig);
        
        // Aumentar amplitude do motion para convexo (2.5x mais perceptível)
        const motionAmplitude = 2.5;
        const depthWithMotion = y + (withMotion.depth - y) * motionAmplitude;
        const lateralWithMotion = x + (withMotion.lateral - x) * motionAmplitude;
        
        // Reconverter para polar com motion aplicado
        const rWithMotion = Math.sqrt(depthWithMotion * depthWithMotion + lateralWithMotion * lateralWithMotion);
        const thetaWithMotion = Math.atan2(lateralWithMotion, depthWithMotion);
        
        // Índices de pixel fictícios para cache (mapeamento polar → cartesiano)
        const pixelX = Math.floor((theta / (2 * halfFOVRad) + 0.5) * this.config.canvasWidth);
        const pixelY = Math.floor((r / maxDepthCm) * this.config.canvasHeight);
        
        // ═══ 1. OBTER TECIDO EM (r, θ) COM MOTION ═══
        const tissue = this.getTissueAtPolar(rWithMotion, thetaWithMotion);
        
        // ═══ 2. ECHOGENICIDADE BASE (motor unificado) ═══
        let intensity = this.physicsCore.getBaseEchogenicity(tissue.echogenicity);
        
        // ═══ 3. SPECKLE REALISTA (motor unificado - polar) ═══
        const speckleMultiplier = this.physicsCore.multiOctaveNoisePolar(r, theta, 4);
        
        // Escala de speckle baseada na echogenicidade
        const speckleScale = tissue.echogenicity === "anechoic" ? 0.1 : 
                            tissue.echogenicity === "hypoechoic" ? 0.5 :
                            tissue.echogenicity === "isoechoic" ? 0.7 :
                            0.9;
        
        intensity *= (0.4 + speckleMultiplier * speckleScale * 0.6);
        
        // ═══ 4. ATENUAÇÃO (motor unificado) ═══
        const tissueProps: TissueProperties = {
          echogenicity: tissue.echogenicity,
          attenuation: tissue.attenuation,
          reflectivity: 0.5,
          impedance: 1.63,
          isInclusion: tissue.isInclusion,
          inclusion: tissue.isInclusion ? this.config.inclusions?.find(inc => 
            this.isPointInInclusionPolar(r, theta, inc)
          ) : undefined,
        };
        
        const attenuation = this.physicsCore.calculateAttenuation(r, tissueProps, frequency);
        intensity *= attenuation;
        
        // ═══ 5. GANHO FOCAL (motor unificado) ═══
        const focalGain = this.physicsCore.calculateFocalGain(r, physicsConfig.focus);
        intensity *= focalGain;
        
        // ═══ 6. TGC (motor unificado) ═══
        const tgc = this.physicsCore.calculateTGC(r, maxDepthCm);
        intensity *= tgc;
        
        // ═══ 7. APLICAR SOMBRA ACÚSTICA COM MESMO MOTION ═══
        // O shadowMap está em coordenadas "mundo" (sem motion).
        // Para sincronizar, consultamos usando as coordenadas COM motion.
        const rIdxWithMotion = Math.floor((rWithMotion / maxDepthCm) * numDepthSamples);
        const thetaIdxWithMotion = Math.floor(((thetaWithMotion / halfFOVRad) + 1) * 0.5 * numAngleSamples);
        
        // Clamp to valid indices
        const clampedRIdx = Math.max(0, Math.min(numDepthSamples - 1, rIdxWithMotion));
        const clampedThetaIdx = Math.max(0, Math.min(numAngleSamples - 1, thetaIdxWithMotion));
        const shadowIdx = clampedRIdx * numAngleSamples + clampedThetaIdx;
        
        intensity *= this.shadowMap[shadowIdx];
        
        // ═══ 8. REALCE POSTERIOR (se aplicável) ═══
        if (tissue.posteriorEnhancement) {
          const enhancementFactor = 1.2 + (r / maxDepthCm) * 0.4;
          intensity *= enhancementFactor;
        }
        
        // ═══ 9. APLICAR GANHO E COMPRESSÃO (motor unificado) ═══
        intensity = this.physicsCore.applyGainAndCompression(intensity, gain, 60);
        
        // ═══ 10. CLAMPAR ═══
        this.polarImage[idx] = Math.max(0, Math.min(1, intensity));
      }
    }
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
    
    if (inclusion.shape === 'circle' || inclusion.shape === 'ellipse') {
      const normX = distortedDx / halfWidth;
      const normY = dy / halfHeight;
      return (normX * normX + normY * normY) <= 1.0;
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
    
    const { numDepthSamples, numAngleSamples, maxDepthCm, fovDegrees } = this.config;
    const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
    
    const MIN_INTENSITY = 0.06;
    
    // ═══ PROCESS EACH BEAM (ANGLE) ═══
    for (let thetaIdx = 0; thetaIdx < numAngleSamples; thetaIdx++) {
      const theta = ((thetaIdx / numAngleSamples) * 2 - 1) * halfFOVRad;
      
      const beamSeed = thetaIdx * 7 + 123;
      const alphaVariation = this.noise(beamSeed) * 0.10 - 0.05;
      
      for (const inclusion of this.config.inclusions) {
        if (!inclusion.hasStrongShadow) continue;
        
        // ═══ USE ORIGINAL INCLUSION POSITION (same as getTissueAtPolar) ═══
        // NO motion applied here - motion comes from displaced sampling
        const inclCenterDepth = inclusion.centerDepthCm;
        const inclLateralNorm = inclusion.centerLateralPos;
        
        // Map lateral position to angle (same as getTissueAtPolar uses)
        const maxLateralAtDepth = inclCenterDepth * Math.tan(halfFOVRad);
        const inclLateralCm = inclLateralNorm * maxLateralAtDepth * 2;
        const inclTheta = Math.atan2(inclLateralCm, inclCenterDepth);
        
        // Compute angular radius of inclusion
        const inclRadius = inclusion.shape === 'circle' 
          ? (inclusion.sizeCm.width + inclusion.sizeCm.height) / 4 
          : inclusion.sizeCm.width / 2;
        
        const inclAngularRadius = Math.atan2(inclRadius, inclCenterDepth);
        
        // Per-beam noise for organic edges
        const edgeNoise = this.noise(thetaIdx * 13 + 456) * 0.08 - 0.04;
        const effectiveAngularRadius = inclAngularRadius * (1 + edgeNoise);
        
        // Angular distance from beam to inclusion center
        const angleDiff = Math.abs(theta - inclTheta);
        
        // Check if beam hits inclusion
        if (angleDiff > effectiveAngularRadius * 1.2) continue;
        
        // ═══ COMPUTE z_exit ═══
        const normalizedDist = Math.min(1.0, angleDiff / effectiveAngularRadius);
        const inclHalfHeight = inclusion.sizeCm.height / 2;
        
        let z_exit: number;
        let edgeFactor: number;
        
        if (normalizedDist <= 1.0) {
          const exitOffset = inclHalfHeight * Math.sqrt(Math.max(0, 1 - normalizedDist * normalizedDist));
          z_exit = inclCenterDepth + exitOffset;
          edgeFactor = Math.pow(1 - normalizedDist, 0.5);
        } else {
          z_exit = inclCenterDepth + inclHalfHeight * 0.3;
          edgeFactor = Math.max(0, 1 - (normalizedDist - 1) / 0.2) * 0.3;
        }
        
        if (edgeFactor < 0.01) continue;
        
        // ═══ COMPUTE ALPHA ═══
        const inclusionMedium = getAcousticMedium(inclusion.mediumInsideId);
        const materialAttenuation = inclusionMedium.attenuation_dB_per_cm_MHz;
        const baseAlpha = 0.6 + Math.min(0.8, materialAttenuation / 4);
        const alpha = baseAlpha * (1 + alphaVariation);
        const effectiveAlpha = alpha * edgeFactor;
        
        // ═══ APPLY ATTENUATION ALONG BEAM ═══
        for (let rIdx = 0; rIdx < numDepthSamples; rIdx++) {
          const r = (rIdx / numDepthSamples) * maxDepthCm;
          
          if (r <= z_exit) continue;
          
          const posteriorDepth = r - z_exit;
          const attenuation = Math.exp(-effectiveAlpha * posteriorDepth);
          const shadowFactor = Math.max(MIN_INTENSITY, attenuation);
          
          const idx = rIdx * numAngleSamples + thetaIdx;
          this.shadowMap[idx] = Math.min(this.shadowMap[idx], shadowFactor);
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
    const inclRadius = inclusion.shape === 'circle' 
      ? (inclusion.sizeCm.width + inclusion.sizeCm.height) / 4 
      : inclusion.sizeCm.width / 2;
    
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
        
        if (inclusion.shape === 'circle' || inclusion.shape === 'ellipse') {
          const normX = distortedDx / halfWidth;
          const normY = dy / halfHeight;
          isInside = (normX * normX + normY * normY) <= 1.0;
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
        
        // ═══ RUÍDO TEMPORAL (motor unificado - igual ao linear) ═══
        intensity = this.physicsCore.applyTemporalNoise(x, y, physDepthCm, maxDepthCm, intensity);
        
        // ═══ FEATHERING NAS BORDAS ═══
        const angleFromEdge = halfFOVRad - Math.abs(pixelAngle);
        const edgeFeatherAngle = halfFOVRad * 0.05;
        if (angleFromEdge < edgeFeatherAngle) {
          const edgeFalloff = angleFromEdge / edgeFeatherAngle;
          intensity *= edgeFalloff;
        }
        
        // Near-field feathering
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
