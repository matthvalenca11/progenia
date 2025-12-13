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
        
        // ═══ 7. APLICAR SOMBRA ACÚSTICA ═══
        intensity *= this.shadowMap[idx];
        
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
   * ═══════════════════════════════════════════════════════════════════════
   * UNIFIED ACOUSTIC SHADOW MODEL - Same physics as Linear transducer
   * ═══════════════════════════════════════════════════════════════════════
   * Computes shadows with:
   * - Progressive attenuation after attenuating objects
   * - Gradual energy decay
   * - Organic texture with noise
   * - Smooth Gaussian edges (no square artifacts)
   * - Consistent behavior across all transducer types
   */
  private computeAcousticShadowsWithMotion(physicsConfig: PhysicsConfig) {
    if (!this.config.inclusions || this.config.inclusions.length === 0) return;
    
    const { numDepthSamples, numAngleSamples, maxDepthCm, fovDegrees } = this.config;
    const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
    
    // Para cada raio angular, fazer marching e detectar oclusões
    for (let thetaIdx = 0; thetaIdx < numAngleSamples; thetaIdx++) {
      const theta = ((thetaIdx / numAngleSamples) * 2 - 1) * halfFOVRad;
      
      // Marchar ao longo deste raio específico
      let shadowStartDepth = -1;
      let shadowExitDepth = -1;
      let shadowingInclusion: UltrasoundInclusionConfig | null = null;
      
      for (let rIdx = 0; rIdx < numDepthSamples; rIdx++) {
        let r = (rIdx / numDepthSamples) * maxDepthCm;
        
        // Aplicar motion artifacts ao ponto atual
        let x = r * Math.sin(theta);
        let y = r * Math.cos(theta);
        const withMotion = this.physicsCore.applyMotionArtifacts(y, x, physicsConfig);
        
        const motionAmplitude = 2.5;
        const depthWithMotion = y + (withMotion.depth - y) * motionAmplitude;
        const lateralWithMotion = x + (withMotion.lateral - x) * motionAmplitude;
        
        const rWithMotion = Math.sqrt(depthWithMotion * depthWithMotion + lateralWithMotion * lateralWithMotion);
        const thetaWithMotion = Math.atan2(lateralWithMotion, depthWithMotion);
        
        // Verificar se este ponto COM MOTION está dentro de alguma inclusão
        for (const inclusion of this.config.inclusions) {
          if (!inclusion.hasStrongShadow) continue;
          
          const isInside = this.isPointInInclusionPolar(rWithMotion, thetaWithMotion, inclusion);
          
          if (isInside) {
            if (shadowStartDepth < 0) {
              shadowStartDepth = r;
              shadowingInclusion = inclusion;
            }
            shadowExitDepth = r;
          }
        }
      }
      
      // Aplicar sombra unificada se encontrou inclusão bloqueando este raio
      if (shadowStartDepth >= 0 && shadowingInclusion) {
        const inclusionThickness = shadowExitDepth - shadowStartDepth + shadowingInclusion.sizeCm.height * 0.5;
        const inclusionBottomDepth = shadowStartDepth + inclusionThickness;
        
        for (let rIdx = 0; rIdx < numDepthSamples; rIdx++) {
          const r = (rIdx / numDepthSamples) * maxDepthCm;
          if (r <= inclusionBottomDepth) continue; // Skip inclusion and above
          
          const idx = rIdx * numAngleSamples + thetaIdx;
          const posteriorDepth = r - inclusionBottomDepth;
          
          // ═══ UNIFIED SHADOW PROFILE (same as Linear) ═══
          // Progressive attenuation with organic texture and Gaussian edges
          
          // Depth decay: gradual energy loss posterior to inclusion
          const depthDecay = Math.exp(-posteriorDepth * 0.4);
          
          // Organic texture: multi-frequency noise for realistic speckle degradation
          const x = r * Math.sin(theta);
          const noise1 = Math.sin(posteriorDepth * 12 + x * 8 + this.time * 0.5) * 0.02;
          const noise2 = Math.sin(posteriorDepth * 25 + x * 15) * 0.015;
          const noise3 = Math.sin(posteriorDepth * 5 + x * 3) * 0.01;
          const organicNoise = noise1 + noise2 + noise3;
          
          // Shadow intensity based on inclusion thickness
          const thicknessFactor = Math.min(1, inclusionThickness / 2.0);
          const baseShadowStrength = 0.3 + thicknessFactor * 0.4;
          
          // Core shadow with Gaussian profile
          const coreStrength = baseShadowStrength + organicNoise;
          const finalStrength = coreStrength * depthDecay;
          
          // Apply attenuation (never completely black, maintain some speckle)
          const minIntensity = 0.08 + (1 - thicknessFactor) * 0.1;
          const shadowMultiplier = minIntensity + (1 - minIntensity) * (1 - finalStrength);
          
          this.shadowMap[idx] = Math.min(this.shadowMap[idx], shadowMultiplier);
        }
      }
    }
  }

  /**
   * Calcula shadow map em coordenadas polares com RAY MARCHING correto (DEPRECATED - usar WithMotion)
   * A sombra deve seguir os raios que divergem do arco do transdutor
   */
  private computeAcousticShadows() {
    if (!this.config.inclusions || this.config.inclusions.length === 0) return;
    
    const { numDepthSamples, numAngleSamples, maxDepthCm, fovDegrees, lateralOffset } = this.config;
    const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
    
    // Para cada raio angular, fazer marching e detectar oclusões
    for (let thetaIdx = 0; thetaIdx < numAngleSamples; thetaIdx++) {
      const theta = ((thetaIdx / numAngleSamples) * 2 - 1) * halfFOVRad;
      
      // Marchar ao longo deste raio específico
      let shadowStartDepth = -1;
      let shadowingInclusion: UltrasoundInclusionConfig | null = null;
      
      for (let rIdx = 0; rIdx < numDepthSamples; rIdx++) {
        const r = (rIdx / numDepthSamples) * maxDepthCm;
        
        // Verificar se este ponto (r, theta) está dentro de alguma inclusão
        for (const inclusion of this.config.inclusions) {
          if (!inclusion.hasStrongShadow) continue;
          
          // Verificar se ponto está na inclusão
          const isInside = this.isPointInInclusionPolar(r, theta, inclusion);
          
          if (isInside && shadowStartDepth < 0) {
            // Encontrou início da sombra neste raio
            shadowStartDepth = r;
            shadowingInclusion = inclusion;
            break;
          }
        }
        
        // Se já encontrou uma inclusão bloqueando este raio, aplicar sombra daqui para baixo
        if (shadowStartDepth >= 0 && r > shadowStartDepth) {
          const idx = rIdx * numAngleSamples + thetaIdx;
          const posteriorDepth = r - shadowStartDepth;
          
          // Intensidade da sombra baseada na espessura da inclusão e distância posterior
          const inclusionThickness = shadowingInclusion?.sizeCm.height || 1.0;
          const thicknessFactor = Math.min(1, inclusionThickness / 1.5);
          const baseShadowStrength = 0.15 + thicknessFactor * 0.45; // Sombra mais forte
          
          // Decay com profundidade posterior
          const depthDecay = Math.exp(-posteriorDepth * 0.25);
          
          // Textura interna da sombra (speckle degradado)
          const shadowTexture = Math.sin(r * 15 + theta * 20) * 0.04;
          
          const finalShadowStrength = (baseShadowStrength + shadowTexture) * depthDecay;
          
          // Aplicar atenuação (valores menores = mais escuro)
          this.shadowMap[idx] *= Math.max(0.08, 1.0 - finalShadowStrength);
        }
      }
    }
  }

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
        
        // ═══ SAMPLE DA IMAGEM POLAR ═══
        const rNorm = physDepthCm / maxDepthCm;
        const thetaNorm = (pixelAngle / halfFOVRad + 1) / 2; // [0, 1]
        
        let rIdx = Math.floor(rNorm * (numDepthSamples - 1));
        let thetaIdx = Math.floor(thetaNorm * (numAngleSamples - 1));
        
        // Clampar índices
        rIdx = Math.max(0, Math.min(numDepthSamples - 1, rIdx));
        thetaIdx = Math.max(0, Math.min(numAngleSamples - 1, thetaIdx));
        
        const polarIdx = rIdx * numAngleSamples + thetaIdx;
        let intensity = this.polarImage[polarIdx];
        
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
