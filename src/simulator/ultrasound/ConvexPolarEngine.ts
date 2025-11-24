/**
 * ConvexPolarEngine.ts
 * 
 * Motor de renderização POLAR PURO para transdutor convexo.
 * Não herda lógica antiga. Implementação limpa e minimalista.
 * 
 * Geometria:
 * - Coordenadas polares (r, θ)
 * - Setor circular com topo estreito e base larga
 * - Máscara analítica fora do setor
 * - Conversão polar → cartesiano para renderização final
 */

import { UltrasoundLayerConfig, UltrasoundInclusionConfig } from '@/types/acousticMedia';

export interface ConvexPolarConfig {
  // Geometria do setor
  fovDegrees: number;           // Abertura total do leque (60-90°)
  maxDepthCm: number;           // Profundidade máxima em cm
  
  // Resolução polar interna
  numDepthSamples: number;      // Resolução radial (r)
  numAngleSamples: number;      // Resolução angular (θ)
  
  // Parâmetros de física básica
  gain: number;                 // Ganho (0-100)
  frequency: number;            // Frequência em MHz
  
  // Canvas output
  canvasWidth: number;
  canvasHeight: number;
  
  // Layers e inclusões (para futura expansão)
  layers?: UltrasoundLayerConfig[];
  inclusions?: UltrasoundInclusionConfig[];
}

export class ConvexPolarEngine {
  private config: ConvexPolarConfig;
  private polarImage: Float32Array;
  private time: number = 0;

  constructor(config: ConvexPolarConfig) {
    this.config = config;
    this.polarImage = new Float32Array(config.numDepthSamples * config.numAngleSamples);
  }

  /**
   * Atualiza configuração
   */
  updateConfig(config: Partial<ConvexPolarConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Renderiza um frame completo
   */
  render(ctx: CanvasRenderingContext2D) {
    this.time += 0.016; // ~60fps
    
    // Etapa 1: Gerar imagem polar interna
    this.generatePolarImage();
    
    // Etapa 2: Converter polar → XY e renderizar no canvas
    this.renderPolarToCanvas(ctx);
  }

  /**
   * Etapa 1: Gera a imagem em coordenadas polares (r, θ)
   * Por enquanto: textura básica com ruído modulado por profundidade
   */
  private generatePolarImage() {
    const { numDepthSamples, numAngleSamples, maxDepthCm, frequency, gain } = this.config;
    
    for (let rIdx = 0; rIdx < numDepthSamples; rIdx++) {
      for (let thetaIdx = 0; thetaIdx < numAngleSamples; thetaIdx++) {
        const idx = rIdx * numAngleSamples + thetaIdx;
        
        // Profundidade normalizada [0, 1]
        const rNorm = rIdx / numDepthSamples;
        const r = rNorm * maxDepthCm;
        
        // Ângulo normalizado [-1, 1]
        const thetaNorm = (thetaIdx / numAngleSamples) * 2 - 1;
        
        // Textura básica: ruído + atenuação por profundidade
        const noise = this.simplexNoise(r * 0.5, thetaNorm * 5, this.time * 0.3);
        const attenuation = Math.exp(-r * 0.08 * frequency);
        
        // Intensidade base
        let intensity = (noise * 0.5 + 0.5) * attenuation;
        
        // Aplicar ganho
        intensity = intensity * (gain / 100);
        
        // Clampar [0, 1]
        intensity = Math.max(0, Math.min(1, intensity));
        
        this.polarImage[idx] = intensity;
      }
    }
  }

  /**
   * Etapa 2: Converte imagem polar para canvas cartesiano XY
   * Aplica máscara analítica fora do setor
   */
  private renderPolarToCanvas(ctx: CanvasRenderingContext2D) {
    const { canvasWidth, canvasHeight, fovDegrees, maxDepthCm, numDepthSamples, numAngleSamples } = this.config;
    
    const imageData = ctx.createImageData(canvasWidth, canvasHeight);
    const data = imageData.data;
    
    // Centro do probe (topo do canvas)
    const cx = canvasWidth / 2;
    const cy = 0;
    
    // Converter FOV para radianos
    const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
    
    // Escala de pixels por cm
    const pixelsPerCm = canvasHeight / maxDepthCm;
    
    // Para cada pixel do canvas
    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const pixelIdx = (y * canvasWidth + x) * 4;
        
        // Converter pixel XY → polar (r, θ)
        const dx = x - cx;
        const dy = y - cy;
        
        // Distância radial em pixels
        const rPixels = Math.sqrt(dx * dx + dy * dy);
        const rCm = rPixels / pixelsPerCm;
        
        // Ângulo em radianos
        const theta = Math.atan2(dx, dy); // atan2(x, y) porque y é "para baixo"
        
        // ═══ MÁSCARA ANALÍTICA ═══
        // Se fora do setor angular OU fora da profundidade → PRETO
        if (Math.abs(theta) > halfFOVRad || rCm > maxDepthCm || rCm < 0) {
          data[pixelIdx] = 0;     // R
          data[pixelIdx + 1] = 0; // G
          data[pixelIdx + 2] = 0; // B
          data[pixelIdx + 3] = 255; // A
          continue;
        }
        
        // ═══ SAMPLE DA IMAGEM POLAR ═══
        // Converter (r, θ) para índices da imagem polar
        const rNorm = rCm / maxDepthCm;
        const thetaNorm = (theta / halfFOVRad) * 0.5 + 0.5; // [0, 1]
        
        const rIdx = Math.floor(rNorm * (numDepthSamples - 1));
        const thetaIdx = Math.floor(thetaNorm * (numAngleSamples - 1));
        
        // Garantir bounds
        if (rIdx < 0 || rIdx >= numDepthSamples || thetaIdx < 0 || thetaIdx >= numAngleSamples) {
          data[pixelIdx] = 0;
          data[pixelIdx + 1] = 0;
          data[pixelIdx + 2] = 0;
          data[pixelIdx + 3] = 255;
          continue;
        }
        
        // Pegar intensidade da imagem polar
        const polarIdx = rIdx * numAngleSamples + thetaIdx;
        const intensity = this.polarImage[polarIdx];
        
        // Converter para grayscale (0-255)
        const gray = Math.floor(intensity * 255);
        
        data[pixelIdx] = gray;     // R
        data[pixelIdx + 1] = gray; // G
        data[pixelIdx + 2] = gray; // B
        data[pixelIdx + 3] = 255;  // A
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Ruído simplex básico (placeholder)
   * Pode ser substituído por implementação mais sofisticada depois
   */
  private simplexNoise(x: number, y: number, z: number): number {
    // Implementação simplificada de ruído 3D
    const noise = (seed: number) => {
      const val = Math.sin(seed) * 43758.5453123;
      return val - Math.floor(val);
    };
    
    const n1 = noise(x * 12.9898 + y * 78.233 + z * 37.719);
    const n2 = noise(x * 93.989 + y * 67.345 + z * 41.234);
    const n3 = noise(x * 34.483 + y * 89.234 + z * 19.673);
    
    return (n1 + n2 + n3) / 3 * 2 - 1; // [-1, 1]
  }

  /**
   * Para a renderização
   */
  stop() {
    // Cleanup se necessário
  }
}
