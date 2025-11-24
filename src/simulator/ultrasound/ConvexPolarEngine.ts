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
   * ETAPA 1: Gera imagem polar com motor B-mode realista
   * ═══════════════════════════════════════════════════════════════════
   */
  private generatePolarImageWithPhysics() {
    const { numDepthSamples, numAngleSamples, maxDepthCm, frequency, gain, fovDegrees } = this.config;
    
    const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
    
    // Limpar shadow map
    this.shadowMap.fill(1.0);
    
    // ═══ PROCESSAR INCLUSÕES PARA CRIAR SHADOW MAP ═══
    this.computeAcousticShadows();
    
    // Parâmetros de física realista
    const focalDepthCm = maxDepthCm * 0.5; // Foco no meio por padrão
    const focalZoneWidth = maxDepthCm * 0.3; // Zona focal ~30% da profundidade
    
    // Atenuação base depende da frequência (dB/cm/MHz)
    const attenuationCoeff = 0.5; // Coeficiente médio para tecidos moles
    
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
        
        // ═══ 2. SPECKLE TEXTURE REALISTA ═══
        const speckleNoise = this.generateRealisticSpeckle(r, theta);
        
        // ═══ 3. ECHOGENICIDADE BASE DO TECIDO ═══
        let baseIntensity = this.getBaseEchogenicity(tissue.echogenicity);
        
        // Escala de speckle baseada na echogenicidade (igual ao linear)
        const speckleScale = tissue.echogenicity === "anechoic" ? 0.1 : 
                            tissue.echogenicity === "hypoechoic" ? 0.5 :
                            tissue.echogenicity === "isoechoic" ? 0.7 :
                            0.9; // hyperechoic
        
        const finalSpeckle = speckleNoise * speckleScale;
        
        // ═══ 4. ATENUAÇÃO COM PROFUNDIDADE ═══
        // Frequência maior = mais atenuação
        // exp(-α * f * r) para atenuação exponencial suave
        const attenuationFactor = Math.exp(-attenuationCoeff * (frequency / 5) * r);
        
        // ═══ 5. EFEITO DO FOCO (nitidez aumenta perto do foco) ═══
        const distFromFocus = Math.abs(r - focalDepthCm);
        const focusFactor = 1.0 + 0.4 * Math.exp(-(distFromFocus * distFromFocus) / (focalZoneWidth * focalZoneWidth));
        
        // ═══ 6. COMBINAR TUDO ═══
        let intensity = baseIntensity * finalSpeckle * attenuationFactor * focusFactor;
        
        // ═══ 7. APLICAR SOMBRA ACÚSTICA ═══
        intensity *= this.shadowMap[idx];
        
        // ═══ 8. REALCE POSTERIOR (se aplicável) ═══
        if (tissue.posteriorEnhancement) {
          const enhancementFactor = 1.2 + (r / maxDepthCm) * 0.4;
          intensity *= enhancementFactor;
        }
        
        // ═══ 9. COMPRESSÃO DINÂMICA LOGARÍTMICA ═══
        // Mapear para escala logarítmica (similar a scanners reais)
        const gainLinear = Math.pow(10, (gain - 50) / 20); // 50 dB como referência
        intensity *= gainLinear;
        
        // Compressão log para dynamic range realista
        const compressed = Math.log(1 + intensity * 10) / Math.log(11);
        
        // ═══ 10. CLAMPAR ═══
        this.polarImage[idx] = Math.max(0, Math.min(1, compressed));
      }
    }
  }
  
  /**
   * Gera speckle texture igual ao modo linear com motion temporal
   */
  private generateRealisticSpeckle(r: number, theta: number): number {
    // Usar mesma função noise2D do linear
    const noise2D = (x: number, y: number, seed: number = 0): number => {
      const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
      return n - Math.floor(n);
    };
    
    const multiOctaveNoise = (x: number, y: number, octaves: number, seed: number): number => {
      let value = 0;
      let amplitude = 1;
      let frequency = 1;
      let maxValue = 0;
      
      for (let i = 0; i < octaves; i++) {
        value += noise2D(x * frequency, y * frequency, seed + i) * amplitude;
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
      }
      
      return value / maxValue;
    };
    
    // Converter (r, theta) para coordenadas pseudo-cartesianas para o noise
    const x = r * Math.sin(theta) * 10; // escalar para melhor granularidade
    const y = r * Math.cos(theta) * 10;
    
    // Temporal seed IGUAL ao linear (motion temporal)
    const temporalSeed = this.time * 2.5;
    
    // Multi-octave noise igual ao linear COM motion temporal
    return multiOctaveNoise(
      x * 0.15 + temporalSeed * 0.01,
      y * 0.15,
      4,
      1000
    );
  }

  /**
   * Calcula shadow map em coordenadas polares com divergência correta
   */
  private computeAcousticShadows() {
    if (!this.config.inclusions || this.config.inclusions.length === 0) return;
    
    const { numDepthSamples, numAngleSamples, maxDepthCm, fovDegrees } = this.config;
    const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
    
    for (const inclusion of this.config.inclusions) {
      if (!inclusion.hasStrongShadow) continue;
      
      const inclDepth = inclusion.centerDepthCm;
      const inclLateral = inclusion.centerLateralPos; // -0.5 to +0.5
      
      // Converter posição lateral para ângulo
      const inclTheta = inclLateral * fovDegrees * (Math.PI / 180);
      
      // Índices polares da inclusão
      const inclRIdx = Math.floor((inclDepth / maxDepthCm) * numDepthSamples);
      const inclThetaIdx = Math.floor(((inclTheta / (2 * halfFOVRad)) + 0.5) * numAngleSamples);
      
      if (inclRIdx < 0 || inclRIdx >= numDepthSamples) continue;
      if (inclThetaIdx < 0 || inclThetaIdx >= numAngleSamples) continue;
      
      // Largura angular da inclusão (em radianos)
      const angularWidth = inclusion.sizeCm.width / inclDepth; // aproximação para ângulo pequeno
      const angularSpan = Math.floor((angularWidth / (2 * halfFOVRad)) * numAngleSamples);
      
      // Criar sombra que diverge com a profundidade
      for (let rIdx = inclRIdx + 1; rIdx < numDepthSamples; rIdx++) {
        const r = (rIdx / numDepthSamples) * maxDepthCm;
        const depthBelowInclusion = r - inclDepth;
        
        // Divergência: sombra se abre proporcionalmente à profundidade
        const divergenceFactor = 1.0 + (depthBelowInclusion / inclDepth) * 0.5;
        const currentAngularSpan = Math.floor(angularSpan * divergenceFactor);
        
        for (let dTheta = -currentAngularSpan; dTheta <= currentAngularSpan; dTheta++) {
          const thetaIdx = inclThetaIdx + dTheta;
          if (thetaIdx >= 0 && thetaIdx < numAngleSamples) {
            const idx = rIdx * numAngleSamples + thetaIdx;
            
            // Atenuação da sombra (mais forte no centro, gradiente nas bordas)
            const distFromCenter = Math.abs(dTheta) / Math.max(1, currentAngularSpan);
            const shadowStrength = Math.max(0.15, 1.0 - (1.0 - 0.15) * (1.0 - distFromCenter));
            
            this.shadowMap[idx] *= shadowStrength;
          }
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
   * Echogenicidade base realista por tipo
   */
  private getBaseEchogenicity(type: string): number {
    switch (type) {
      case 'hyperechoic': return 0.85;
      case 'isoechoic': return 0.65;
      case 'hypoechoic': return 0.35;
      case 'anechoic': return 0.08;
      default: return 0.65;
    }
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
    
    // ═══ GEOMETRIA SIMPLIFICADA ═══
    // O arco do transdutor está no topo, raios divergem dele
    // Vamos usar uma geometria mais simples e direta
    
    const centerX = canvasWidth / 2;
    
    // Escala: pixels por cm
    const pixelsPerCm = canvasHeight / (maxDepthCm + transducerRadiusCm);
    
    // O centro virtual do arco está ACIMA do canvas
    const virtualCenterY = -transducerRadiusCm * pixelsPerCm;
    
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
        const depthCm = depthFromTransducer / pixelsPerCm;
        
        // ═══ MÁSCARA 3: PROFUNDIDADE MÁXIMA ═══
        if (depthCm > maxDepthCm || depthCm < 0) {
          data[pixelIdx] = 0;
          data[pixelIdx + 1] = 0;
          data[pixelIdx + 2] = 0;
          data[pixelIdx + 3] = 255;
          pixelsBlocked++;
          continue;
        }
        
        // ═══ SAMPLE DA IMAGEM POLAR ═══
        const rNorm = depthCm / maxDepthCm;
        const thetaNorm = (pixelAngle / halfFOVRad + 1) / 2; // [0, 1]
        
        let rIdx = Math.floor(rNorm * (numDepthSamples - 1));
        let thetaIdx = Math.floor(thetaNorm * (numAngleSamples - 1));
        
        // Clampar índices
        rIdx = Math.max(0, Math.min(numDepthSamples - 1, rIdx));
        thetaIdx = Math.max(0, Math.min(numAngleSamples - 1, thetaIdx));
        
        const polarIdx = rIdx * numAngleSamples + thetaIdx;
        let intensity = this.polarImage[polarIdx];
        
        // ═══ RUÍDO TEMPORAL (igual ao linear) ═══
        // Frame phase para "live" effect (igual ao linear)
        const framePhase = Math.sin(this.time * 8) * 0.5 + 0.5;
        const frameNoise = (this.pseudoRandom(x * 0.123 + y * 0.456 + this.time * 100) - 0.5) * 0.02 * framePhase;
        intensity += frameNoise;
        
        // ═══ FEATHERING NAS BORDAS ═══
        const angleFromEdge = halfFOVRad - Math.abs(pixelAngle);
        const edgeFeatherAngle = halfFOVRad * 0.05;
        if (angleFromEdge < edgeFeatherAngle) {
          const edgeFalloff = angleFromEdge / edgeFeatherAngle;
          intensity *= edgeFalloff;
        }
        
        // Near-field feathering
        const nearFieldCm = 0.3;
        if (depthCm < nearFieldCm) {
          const nearFalloff = depthCm / nearFieldCm;
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
