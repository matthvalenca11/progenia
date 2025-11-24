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

  constructor(config: ConvexPolarConfig) {
    this.config = config;
    this.polarImage = new Float32Array(config.numDepthSamples * config.numAngleSamples);
    this.shadowMap = new Float32Array(config.numDepthSamples * config.numAngleSamples);
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
    
    // Etapa 1: Gerar imagem polar interna com física
    this.generatePolarImageWithPhysics();
    
    // Etapa 2: Converter polar → XY e renderizar no canvas
    this.renderPolarToCanvas(ctx);
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * ETAPA 1: Gera imagem polar com física completa
   * ═══════════════════════════════════════════════════════════════════
   */
  private generatePolarImageWithPhysics() {
    const { numDepthSamples, numAngleSamples, maxDepthCm, frequency, gain, fovDegrees } = this.config;
    
    const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
    
    // Limpar shadow map
    this.shadowMap.fill(1.0);
    
    // ═══ PROCESSAR INCLUSÕES PARA CRIAR SHADOW MAP ═══
    this.computeAcousticShadows();
    
    // ═══ GERAR IMAGEM POLAR ═══
    for (let rIdx = 0; rIdx < numDepthSamples; rIdx++) {
      for (let thetaIdx = 0; thetaIdx < numAngleSamples; thetaIdx++) {
        const idx = rIdx * numAngleSamples + thetaIdx;
        
        // Profundidade em cm
        const r = (rIdx / numDepthSamples) * maxDepthCm;
        
        // Ângulo em radianos [-halfFOV, +halfFOV]
        const theta = ((thetaIdx / numAngleSamples) * 2 - 1) * halfFOVRad;
        
        // ═══ 1. OBTER TECIDO EM (r, θ) ═══
        const tissue = this.getTissueAtPolar(r, theta);
        
        // ═══ 2. ECHOGENICIDADE BASE ═══
        let intensity = this.getBaseEchogenicity(tissue.echogenicity);
        
        // ═══ 3. SPECKLE NOISE (Rayleigh) ═══
        const speckle = this.rayleighSpeckle(r, theta);
        intensity *= (0.4 + speckle * 0.6);
        
        // ═══ 4. ATENUAÇÃO POR PROFUNDIDADE ═══
        const attenuationDB = tissue.attenuation * frequency * r;
        const attenuation = Math.pow(10, -attenuationDB / 20);
        intensity *= attenuation;
        
        // ═══ 5. APLICAR SOMBRA ACÚSTICA ═══
        intensity *= this.shadowMap[idx];
        
        // ═══ 6. REALCE POSTERIOR (se aplicável) ═══
        if (tissue.posteriorEnhancement) {
          const enhancementFactor = 1.0 + (r / maxDepthCm) * 0.3;
          intensity *= enhancementFactor;
        }
        
        // ═══ 7. GANHO ═══
        intensity *= (gain / 100);
        
        // ═══ 8. CLAMPAR ═══
        intensity = Math.max(0, Math.min(1, intensity));
        
        this.polarImage[idx] = intensity;
      }
    }
  }

  /**
   * Calcula shadow map em coordenadas polares
   * Sombras divergem conforme o feixe
   */
  private computeAcousticShadows() {
    if (!this.config.inclusions || this.config.inclusions.length === 0) return;
    
    const { numDepthSamples, numAngleSamples, maxDepthCm, fovDegrees } = this.config;
    const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
    
    for (const inclusion of this.config.inclusions) {
      if (!inclusion.hasStrongShadow) continue;
      
      // Converter posição da inclusão para polar
      const inclDepth = inclusion.centerDepthCm;
      const inclLateral = inclusion.centerLateralPos; // -0.5 to +0.5
      
      // Converter lateral normalizado para ângulo
      const inclTheta = inclLateral * halfFOVRad * 2; // aproximação
      
      // Encontrar índices polares da inclusão
      const inclRIdx = Math.floor((inclDepth / maxDepthCm) * numDepthSamples);
      const inclThetaIdx = Math.floor(((inclTheta / halfFOVRad + 1) / 2) * numAngleSamples);
      
      // Sombra diverge a partir da inclusão
      const shadowWidth = inclusion.sizeCm.width;
      
      for (let rIdx = inclRIdx + 1; rIdx < numDepthSamples; rIdx++) {
        const r = (rIdx / numDepthSamples) * maxDepthCm;
        const depthBelowInclusion = r - inclDepth;
        
        // Divergência da sombra proporcional à profundidade
        const shadowDivergence = depthBelowInclusion * 0.3; // 30% de abertura
        const shadowAngularWidth = (shadowWidth + shadowDivergence) / r; // rad
        
        const shadowThetaSpan = Math.floor((shadowAngularWidth / (2 * halfFOVRad)) * numAngleSamples);
        
        for (let dTheta = -shadowThetaSpan; dTheta <= shadowThetaSpan; dTheta++) {
          const thetaIdx = inclThetaIdx + dTheta;
          if (thetaIdx >= 0 && thetaIdx < numAngleSamples) {
            const idx = rIdx * numAngleSamples + thetaIdx;
            
            // Atenuação da sombra (mais forte no centro)
            const distFromCenter = Math.abs(dTheta) / Math.max(1, shadowThetaSpan);
            const shadowStrength = 0.1 + 0.9 * (1 - distFromCenter);
            
            this.shadowMap[idx] *= shadowStrength;
          }
        }
      }
    }
  }

  /**
   * Obtém propriedades do tecido em coordenadas polares
   */
  private getTissueAtPolar(r: number, theta: number): {
    echogenicity: string;
    attenuation: number;
    isInclusion: boolean;
    posteriorEnhancement: boolean;
  } {
    const { fovDegrees, maxDepthCm, transducerRadiusCm } = this.config;
    const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
    
    // Converter (r, θ) para cartesiano físico
    const x = r * Math.sin(theta);
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
   * Echogenicidade base por tipo
   */
  private getBaseEchogenicity(type: string): number {
    switch (type) {
      case 'hyperechoic': return 0.75;
      case 'isoechoic': return 0.50;
      case 'hypoechoic': return 0.25;
      case 'anechoic': return 0.05;
      default: return 0.50;
    }
  }

  /**
   * Speckle noise com distribuição Rayleigh
   */
  private rayleighSpeckle(r: number, theta: number): number {
    const seed = r * 73.12 + theta * 127.45 + this.time * 0.5;
    const u1 = this.pseudoRandom(seed);
    const u2 = this.pseudoRandom(seed * 1.618);
    
    // Box-Muller para Gaussiano
    const gaussian = Math.sqrt(-2 * Math.log(u1 + 0.001)) * Math.cos(2 * Math.PI * u2);
    
    // Rayleigh
    const rayleigh = Math.abs(gaussian);
    
    return Math.min(1.5, rayleigh);
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
    
    const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
    
    // ═══ GEOMETRIA DO ARCO DO TRANSDUTOR ═══
    // Centro do arco (topo do canvas)
    const arcCenterX = canvasWidth / 2;
    const arcCenterY = 0;
    
    // Raio do arco em pixels
    const pixelsPerCm = canvasHeight / maxDepthCm;
    const arcRadiusPixels = transducerRadiusCm * pixelsPerCm;
    
    // ═══ RENDERIZAR CADA PIXEL ═══
    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const pixelIdx = (y * canvasWidth + x) * 4;
        
        // Posição relativa ao centro do arco
        const dx = x - arcCenterX;
        const dy = y - arcCenterY;
        
        // Distância do centro do arco
        const distFromArcCenter = Math.sqrt(dx * dx + dy * dy);
        
        // Ângulo do pixel
        const pixelAngle = Math.atan2(dx, dy);
        
        // ═══ MÁSCARA DO SETOR ═══
        // 1. Verificar se está dentro do FOV angular
        if (Math.abs(pixelAngle) > halfFOVRad) {
          data[pixelIdx] = 0;
          data[pixelIdx + 1] = 0;
          data[pixelIdx + 2] = 0;
          data[pixelIdx + 3] = 255;
          continue;
        }
        
        // 2. Verificar se está abaixo do arco do transdutor
        if (distFromArcCenter < arcRadiusPixels) {
          data[pixelIdx] = 0;
          data[pixelIdx + 1] = 0;
          data[pixelIdx + 2] = 0;
          data[pixelIdx + 3] = 255;
          continue;
        }
        
        // ═══ CALCULAR PROFUNDIDADE FÍSICA ═══
        // Profundidade = distância do arco do transdutor
        const physicalDepthPixels = distFromArcCenter - arcRadiusPixels;
        const physicalDepthCm = physicalDepthPixels / pixelsPerCm;
        
        // 3. Verificar se está dentro da profundidade máxima
        if (physicalDepthCm > maxDepthCm || physicalDepthCm < 0) {
          data[pixelIdx] = 0;
          data[pixelIdx + 1] = 0;
          data[pixelIdx + 2] = 0;
          data[pixelIdx + 3] = 255;
          continue;
        }
        
        // ═══ SAMPLE DA IMAGEM POLAR ═══
        const rNorm = physicalDepthCm / maxDepthCm;
        const thetaNorm = (pixelAngle / halfFOVRad + 1) / 2; // [0, 1]
        
        const rIdx = Math.floor(rNorm * (numDepthSamples - 1));
        const thetaIdx = Math.floor(thetaNorm * (numAngleSamples - 1));
        
        if (rIdx < 0 || rIdx >= numDepthSamples || thetaIdx < 0 || thetaIdx >= numAngleSamples) {
          data[pixelIdx] = 0;
          data[pixelIdx + 1] = 0;
          data[pixelIdx + 2] = 0;
          data[pixelIdx + 3] = 255;
          continue;
        }
        
        const polarIdx = rIdx * numAngleSamples + thetaIdx;
        let intensity = this.polarImage[polarIdx];
        
        // ═══ RUÍDO TEMPORAL PARA EFEITO VIVO ═══
        const frameNoise = (this.pseudoRandom(x * 0.123 + y * 0.456 + this.time * 100) - 0.5) * 0.015;
        intensity += frameNoise;
        
        // ═══ FEATHERING NAS BORDAS DO SETOR ═══
        const angleFromEdge = halfFOVRad - Math.abs(pixelAngle);
        const edgeFeatherAngle = halfFOVRad * 0.03;
        if (angleFromEdge < edgeFeatherAngle) {
          const edgeFalloff = angleFromEdge / edgeFeatherAngle;
          intensity *= edgeFalloff;
        }
        
        // Near-field feathering (perto do arco)
        const nearFieldCm = 0.5;
        if (physicalDepthCm < nearFieldCm) {
          const nearFalloff = physicalDepthCm / nearFieldCm;
          intensity *= (0.2 + 0.8 * nearFalloff);
        }
        
        // ═══ RENDERIZAR ═══
        const gray = Math.max(0, Math.min(255, intensity * 255));
        data[pixelIdx] = gray;
        data[pixelIdx + 1] = gray;
        data[pixelIdx + 2] = gray;
        data[pixelIdx + 3] = 255;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // ═══ DESENHAR ARCO DO TRANSDUTOR (DEBUG - opcional) ═══
    // this.drawTransducerArc(ctx, arcCenterX, arcCenterY, arcRadiusPixels, halfFOVRad);
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
