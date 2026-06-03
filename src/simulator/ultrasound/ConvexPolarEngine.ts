/**
 * ConvexPolarEngine.ts
 *
 * B-mode renderer for convex/microconvex diagnostic ultrasound.
 *
 * Core design:
 * - The image is scan-converted through the fan, but anatomy lives in stable
 *   Cartesian centimeters: x = lateral cm, z = depth cm from the transducer.
 * - Inclusions are signed-distance fields (SDFs) in that anatomical space.
 * - Acoustic artifacts are beam path integrals along each angular ray.
 * - Speckle is tissue-specific scatterer texture, then blurred by a frequency PSF.
 *
 * This file renders only the active B-mode image content. UI, overlays, rulers,
 * labels and lab layout are handled elsewhere and intentionally untouched.
 */

import {
  type AcousticMedium,
  type AcousticMediumId,
  type Echogenicity,
  type UltrasoundInclusionConfig,
  type UltrasoundLayerConfig,
  getAcousticMedium,
} from '@/types/acousticMedia';
import { PulseEchoAcousticModel } from './PulseEchoAcousticModel';
import { wavyInterfaceDepthCm } from './LayerInterfaceWobble';
import { getConvexSectorLayout } from './ConvexScanGeometry';

type ConvexCanvasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface ConvexPolarConfig {
  transducerType: 'convex' | 'microconvex';
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
  highQualityPost?: boolean;
}

type AnatomicalPoint = {
  x: number;
  z: number;
};

type InclusionSdf = {
  inclusion: UltrasoundInclusionConfig;
  medium: AcousticMedium;
  sdf: number;
  distanceFromEdge: number;
  normalX: number;
  normalZ: number;
  localX: number;
  localZ: number;
};

type TissueSample = {
  echogenicity: Echogenicity;
  attenuation: number;
  reflectivity: number;
  impedance: number;
  scatterDensity: number;
  scatterSize: number;
  heterogeneity: number;
  isInclusion: boolean;
  isFluid: boolean;
  inclusion?: UltrasoundInclusionConfig;
  sdf: number;
  boundaryStrength: number;
  impedanceContrast: number;
  sdfNormalX: number;
  sdfNormalZ: number;
  localX: number;
  localZ: number;
};

export class ConvexPolarEngine {
  private config: ConvexPolarConfig;
  private polarImage: Float32Array;
  private time: number = 0;
  private pulseEchoModel: PulseEchoAcousticModel;

  constructor(config: ConvexPolarConfig) {
    this.config = config;
    this.polarImage = new Float32Array(config.numDepthSamples * config.numAngleSamples);
    this.pulseEchoModel = new PulseEchoAcousticModel(this.toPulseEchoConfig());
  }

  /**
   * Get frequency-dependent PSF parameters
   * Higher frequency = sharper image, Lower frequency = blurrier
   */
  private getFrequencyDependentPSF(): { sigmaAxial: number; sigmaLateral: number; speckleScale: number } {
    const f = this.config.frequency;
    const fRef = 6.0; // Reference = max frequency for convex
    
    // VERY strong blur constants for clearly visible resolution effect
    // Convex/Microconvex need stronger blur than Linear due to deeper penetration use
    const kAxial = 2.0;   // Very strong axial blur
    const kLateral = 2.5; // Very strong lateral blur
    
    const frequencyRatio = fRef / f;
    
    // Progressive scaling from high to low frequency
    // At 6 MHz: ratio=1.0, sigma=0 (sharpest)
    // At 4 MHz: ratio=1.5, sigmaAxial=1.0, sigmaLateral=1.25
    // At 3 MHz: ratio=2.0, sigmaAxial=2.0, sigmaLateral=2.5
    // At 2 MHz: ratio=3.0, sigmaAxial=4.0, sigmaLateral=5.0
    const sigmaAxial = kAxial * Math.max(0, frequencyRatio - 1.0);
    const sigmaLateral = kLateral * Math.max(0, frequencyRatio - 1.0);
    
    // Speckle grain: much coarser at low frequency (35% effect)
    const speckleScale = 1.0 + (frequencyRatio - 1.0) * 0.35;
    
    return { sigmaAxial, sigmaLateral, speckleScale };
  }

  /**
   * Atualiza configuração
   */
  updateConfig(config: Partial<ConvexPolarConfig>) {
    this.config = { ...this.config, ...config };
    this.pulseEchoModel.updateConfig(this.toPulseEchoConfig());
    
    // Realocar arrays se tamanho mudou
    const newSize = this.config.numDepthSamples * this.config.numAngleSamples;
    if (this.polarImage.length !== newSize) {
      this.polarImage = new Float32Array(newSize);
    }
  }

  private toPulseEchoConfig(animated = true) {
    return {
      layers: this.config.layers,
      inclusions: this.config.inclusions,
      depthCm: this.config.maxDepthCm,
      frequencyMHz: this.config.frequency,
      focusCm: this.config.focus || this.config.maxDepthCm * 0.5,
      gainDb: this.config.gain,
      dynamicRangeDb: 60,
      lateralOffsetCm: Math.max(-0.3, Math.min(0.3, this.config.lateralOffset || 0)) * this.config.maxDepthCm * 0.5,
      animated,
      highQualityPost: this.config.highQualityPost ?? true,
      fixScanWindow: true,
    };
  }

  private clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
  }

  private saturate(v: number, min = 0, max = 1): number {
    return Math.max(min, Math.min(max, v));
  }

  private smoothstep(edge0: number, edge1: number, x: number): number {
    const t = this.clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
    return t * t * (3 - 2 * t);
  }

  private beamToAnatomical(r: number, theta: number): AnatomicalPoint {
    const clampedOffset = Math.max(-0.3, Math.min(0.3, this.config.lateralOffset || 0));
    const offsetCm = clampedOffset * this.config.maxDepthCm * 0.5;

    // Stable anatomical coordinates. Convex geometry only affects where the beam samples.
    return {
      x: r * Math.sin(theta) + offsetCm,
      z: r * Math.cos(theta),
    };
  }

  private inclusionCenterX(inclusion: UltrasoundInclusionConfig): number {
    // Keep compatibility with existing presets/admin tools: centerLateralPos is -1..+1.
    return inclusion.centerLateralPos * 2.5;
  }

  private getLayerSample(x: number, z: number): TissueSample {
    if (this.config.layers?.length) {
      let cumulativeDepth = 0;
      for (let li = 0; li < this.config.layers.length; li++) {
        const layer = this.config.layers[li];
        cumulativeDepth += layer.thicknessCm;
        const boundaryZ = wavyInterfaceDepthCm(cumulativeDepth, x, li);
        if (z <= boundaryZ) {
          const medium = getAcousticMedium(layer.mediumId);
          return this.sampleFromMedium(medium, false, undefined, {
            reflectivity: layer.reflectivityBias !== undefined ? 0.5 + layer.reflectivityBias : 0.5,
            scatterDensity: this.layerScatterDensity(layer.mediumId, layer.noiseScale),
            scatterSize: layer.noiseScale ?? 1,
            heterogeneity: this.layerHeterogeneity(layer.mediumId),
          });
        }
      }
    }

    const medium = getAcousticMedium('generic_soft');
    return this.sampleFromMedium(medium, false, undefined, {
      reflectivity: 0.55,
      scatterDensity: 0.88,
      scatterSize: 1.05,
      heterogeneity: 0.35,
    });
  }

  private sampleFromMedium(
    medium: AcousticMedium,
    isInclusion: boolean,
    inclusion?: UltrasoundInclusionConfig,
    overrides: Partial<TissueSample> = {},
  ): TissueSample {
    return {
      echogenicity: medium.baseEchogenicity,
      attenuation: medium.attenuation_dB_per_cm_MHz,
      reflectivity: overrides.reflectivity ?? this.mediumReflectivity(medium.id),
      impedance: medium.acousticImpedance_MRayl,
      scatterDensity: overrides.scatterDensity ?? this.mediumScatterDensity(medium.id),
      scatterSize: overrides.scatterSize ?? this.mediumScatterSize(medium.id),
      heterogeneity: overrides.heterogeneity ?? this.mediumHeterogeneity(medium.id),
      isInclusion,
      isFluid: medium.id === 'cyst_fluid' || medium.id === 'water' || medium.id === 'blood',
      inclusion,
      sdf: overrides.sdf ?? Number.POSITIVE_INFINITY,
      boundaryStrength: overrides.boundaryStrength ?? 0,
      impedanceContrast: overrides.impedanceContrast ?? 0,
      sdfNormalX: overrides.sdfNormalX ?? 0,
      sdfNormalZ: overrides.sdfNormalZ ?? 0,
      localX: overrides.localX ?? 0,
      localZ: overrides.localZ ?? 0,
    };
  }

  private getTissueAtAnatomical(x: number, z: number): TissueSample {
    const base = this.getLayerSample(x, z);
    let best: InclusionSdf | null = null;

    for (const inclusion of this.config.inclusions ?? []) {
      const sdf = this.evaluateInclusionSdf(x, z, inclusion);
      if (!best || sdf.sdf < best.sdf) best = sdf;
    }

    if (!best) return base;

    const edgeWidthCm = 0.07;
    const boundaryStrength = Math.exp(-Math.abs(best.sdf) / edgeWidthCm);
    const impedanceContrast = Math.abs(best.medium.acousticImpedance_MRayl - base.impedance) /
      Math.max(0.1, best.medium.acousticImpedance_MRayl + base.impedance);

    if (best.sdf <= 0) {
      const innerBlend = this.smoothstep(0, edgeWidthCm, best.distanceFromEdge);
      const edgeBoost = (best.inclusion.borderEchogenicity === 'sharp' ? 0.34 : 0.14) * boundaryStrength;
      const mediumReflectivity = this.mediumReflectivity(best.medium.id);

      return this.sampleFromMedium(best.medium, true, best.inclusion, {
        reflectivity: (mediumReflectivity + edgeBoost) * (0.65 + 0.35 * innerBlend),
        scatterDensity: this.mediumScatterDensity(best.medium.id, best.inclusion.type),
        scatterSize: this.mediumScatterSize(best.medium.id, best.inclusion.type),
        heterogeneity: this.mediumHeterogeneity(best.medium.id, best.inclusion.type),
        sdf: best.sdf,
        boundaryStrength,
        impedanceContrast,
        sdfNormalX: best.normalX,
        sdfNormalZ: best.normalZ,
        localX: best.localX,
        localZ: best.localZ,
      });
    }

    if (best.sdf < edgeWidthCm && best.inclusion.borderEchogenicity === 'sharp') {
      return {
        ...base,
        echogenicity: 'hyperechoic',
        reflectivity: base.reflectivity + boundaryStrength * 0.42,
        boundaryStrength,
        impedanceContrast,
        sdfNormalX: best.normalX,
        sdfNormalZ: best.normalZ,
        sdf: best.sdf,
      };
    }

    return base;
  }

  private evaluateInclusionSdf(x: number, z: number, inclusion: UltrasoundInclusionConfig): InclusionSdf {
    const cx = this.inclusionCenterX(inclusion);
    const cz = inclusion.centerDepthCm;
    const dx = x - cx;
    const dz = z - cz;
    const rotationRad = ((inclusion.rotationDegrees ?? 0) * Math.PI) / 180;
    const cosR = Math.cos(rotationRad);
    const sinR = Math.sin(rotationRad);
    const localX = dx * cosR + dz * sinR;
    const localZ = -dx * sinR + dz * cosR;

    const halfW = Math.max(0.03, inclusion.sizeCm.width * 0.5);
    const halfH = Math.max(0.03, inclusion.sizeCm.height * 0.5);

    let sdf: number;
    let nxLocal = 0;
    let nzLocal = -1;

    if (inclusion.shape === 'capsule') {
      const radius = halfH + this.wallPerturbation(localX, localZ, inclusion);
      const lineHalf = Math.max(0, halfW - radius);
      const qx = localX - this.saturate(localX, -lineHalf, lineHalf);
      const qz = localZ;
      const len = Math.sqrt(qx * qx + qz * qz) || 1;
      sdf = len - radius;
      nxLocal = qx / len;
      nzLocal = qz / len;
    } else if (inclusion.shape === 'rectangle') {
      const qx = Math.abs(localX) - halfW;
      const qz = Math.abs(localZ) - halfH;
      const ox = Math.max(qx, 0);
      const oz = Math.max(qz, 0);
      sdf = Math.sqrt(ox * ox + oz * oz) + Math.min(Math.max(qx, qz), 0);
      if (qx > qz) {
        nxLocal = Math.sign(localX);
        nzLocal = 0;
      } else {
        nxLocal = 0;
        nzLocal = Math.sign(localZ);
      }
    } else {
      const irregularity = this.lobulation(localX, localZ, inclusion);
      const px = localX / halfW;
      const pz = localZ / halfH;
      const len = Math.sqrt(px * px + pz * pz) || 1;
      sdf = (len - (1 + irregularity)) * Math.min(halfW, halfH);
      nxLocal = px / len;
      nzLocal = pz / len;
    }

    const normalX = nxLocal * cosR - nzLocal * sinR;
    const normalZ = nxLocal * sinR + nzLocal * cosR;
    const medium = getAcousticMedium(inclusion.mediumInsideId);

    return {
      inclusion,
      medium,
      sdf,
      distanceFromEdge: Math.max(0, -sdf),
      normalX,
      normalZ,
      localX,
      localZ,
    };
  }

  private lobulation(localX: number, localZ: number, inclusion: UltrasoundInclusionConfig): number {
    const amount =
      inclusion.type === 'heterogeneous_lesion' || inclusion.type === 'solid_mass'
        ? 0.09
        : (inclusion.wallIrregularity ?? 0) * 0.7;
    if (amount <= 0) return 0;
    const a = Math.atan2(localZ, localX);
    return amount * (
      0.55 * Math.sin(a * 5.0 + this.hash1(inclusion.id.length * 17.13)) +
      0.30 * Math.sin(a * 9.0 + 1.7) +
      0.15 * Math.cos(a * 13.0 - 0.9)
    );
  }

  private wallPerturbation(localX: number, localZ: number, inclusion: UltrasoundInclusionConfig): number {
    const irregularity = inclusion.wallIrregularity ?? 0;
    const asymmetry = inclusion.wallAsymmetry ?? 0;
    if (irregularity <= 0 && asymmetry <= 0) return 0;
    return (
      irregularity * (0.5 * Math.sin(localX * 8) + 0.3 * Math.cos(localX * 15) + 0.2 * Math.sin(localX * 23)) +
      (localZ > 0 ? asymmetry : -asymmetry)
    );
  }

  private mediumReflectivity(id: AcousticMediumId): number {
    switch (id) {
      case 'water':
      case 'cyst_fluid':
      case 'blood':
        return 0.08;
      case 'bone_cortical':
        return 1.05;
      case 'tendon':
      case 'fascia':
        return 0.9;
      case 'fat':
        return 0.42;
      case 'liver':
        return 0.62;
      default:
        return 0.55;
    }
  }

  private mediumScatterDensity(id: AcousticMediumId, type?: string): number {
    if (id === 'water' || id === 'cyst_fluid') return 0.05;
    if (id === 'blood') return 0.16;
    if (id === 'fat') return 0.62;
    if (id === 'liver') return 0.95;
    if (type === 'heterogeneous_lesion') return 1.25;
    if (type === 'solid_mass') return 1.08;
    if (id === 'bone_cortical') return 1.35;
    return 0.88;
  }

  private mediumScatterSize(id: AcousticMediumId, type?: string): number {
    if (id === 'water' || id === 'cyst_fluid') return 1.9;
    if (id === 'blood') return 1.25;
    if (id === 'fat') return 1.55;
    if (type === 'heterogeneous_lesion') return 0.85;
    return 1.0;
  }

  private mediumHeterogeneity(id: AcousticMediumId, type?: string): number {
    if (id === 'water' || id === 'cyst_fluid') return 0.04;
    if (id === 'blood') return 0.22;
    if (id === 'fat') return 0.32;
    if (id === 'liver') return 0.48;
    if (type === 'heterogeneous_lesion') return 0.78;
    if (type === 'solid_mass') return 0.62;
    return 0.38;
  }

  private layerScatterDensity(id: AcousticMediumId, noiseScale = 1): number {
    return this.mediumScatterDensity(id) * Math.max(0.35, noiseScale);
  }

  private layerHeterogeneity(id: AcousticMediumId): number {
    return this.mediumHeterogeneity(id);
  }

  private getInclusionPathLossDb(tissue: TissueSample, stepCm: number): number {
    if (!tissue.inclusion) return 0;
    if (tissue.isFluid) return -0.015 * stepCm;
    const density = tissue.inclusion.hasStrongShadow ? 5.5 : 1.25;
    const impedance = tissue.impedanceContrast * 8.0;
    return (density + impedance) * stepCm;
  }

  private estimateLateralEdgeFactor(normalX: number, theta: number): number {
    const beamX = Math.sin(theta);
    return Math.pow(Math.abs(normalX - beamX * 0.35), 0.7);
  }

  private tissueSpeckle(x: number, z: number, r: number, theta: number, tissue: TissueSample): number {
    const psf = this.getFrequencyDependentPSF();
    const scale = Math.max(0.3, tissue.scatterSize * psf.speckleScale);
    const sx = x / scale;
    const sz = z / scale;

    const u1 = Math.max(0.001, this.hash2(sx * 15.1, sz * 15.1, 11));
    const u2 = this.hash2(sx * 15.1, sz * 15.1, 29);
    const rayleigh = Math.sqrt(-2 * Math.log(u1)) * Math.abs(Math.cos(2 * Math.PI * u2));
    const macro = this.fbm(sx * 0.9, sz * 0.9, 4, 71);
    const meso = this.fbm(sx * 2.4 + this.time * 0.015, sz * 2.1, 3, 137);
    const micro = this.fbm(sx * 7.5, sz * 7.5, 2, 223);

    const hetero = 1 + tissue.heterogeneity * (macro * 0.38 + meso * 0.22);
    const scatter =
      0.72 +
      tissue.scatterDensity * (rayleigh * 0.23 + micro * 0.06 + meso * 0.05);

    let flow = 1;
    if (tissue.inclusion?.mediumInsideId === 'blood') {
      const radial = Math.sqrt(tissue.localX * tissue.localX + tissue.localZ * tissue.localZ) /
        Math.max(0.05, tissue.inclusion.sizeCm.width * 0.5);
      const laminar = Math.max(0, 1 - radial * radial);
      flow += Math.sin(this.time * 16 * laminar + r * 7 + theta * 12) * 0.18 * laminar;
    }

    return Math.max(0.18, scatter * hetero * flow);
  }

  private hash1(seed: number): number {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  private hash2(x: number, y: number, seed = 0): number {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  private valueNoise2D(x: number, y: number, seed = 0): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = this.hash2(ix, iy, seed);
    const b = this.hash2(ix + 1, iy, seed);
    const c = this.hash2(ix, iy + 1, seed);
    const d = this.hash2(ix + 1, iy + 1, seed);
    const x0 = a * (1 - ux) + b * ux;
    const x1 = c * (1 - ux) + d * ux;
    return (x0 * (1 - uy) + x1 * uy) * 2 - 1;
  }

  private fbm(x: number, y: number, octaves: number, seed = 0): number {
    let value = 0;
    let amplitude = 0.5;
    let sum = 0;
    for (let i = 0; i < octaves; i++) {
      value += this.valueNoise2D(x, y, seed + i * 19) * amplitude;
      sum += amplitude;
      x *= 2.03;
      y *= 1.97;
      amplitude *= 0.5;
    }
    return value / Math.max(1e-6, sum);
  }

  /**
   * Renderiza um frame completo.
   * @param structuralOnly B-mode estrutural sem ruído temporal (para cache / motion pass).
   */
  render(ctx: ConvexCanvasContext, options?: { structuralOnly?: boolean }) {
    this.time += 0.016;
    this.generatePolarImageWithPhysics();
    this.renderPolarToCanvas(ctx, !options?.structuralOnly);
  }

  /**
   * Generates the internal polar image one beam at a time.
   *
   * Crucial correction versus the previous pipeline:
   * - No beamWidthFactor
   * - No distortedDx
   * - No pre-warped lesion membership test
   *
   * Each sample is inverse-mapped from beam coordinates into anatomical x/z space,
   * SDFs are evaluated there, and the fan projection happens only when the polar
   * buffer is scan-converted in renderPolarToCanvas().
   */
  private generatePolarImageWithPhysics() {
    this.pulseEchoModel.updateConfig(this.toPulseEchoConfig());
    this.pulseEchoModel.setTime(this.time);
    this.polarImage = this.pulseEchoModel.renderConvexPolar(
      this.config.numDepthSamples,
      this.config.numAngleSamples,
      this.config.fovDegrees,
    );
  }
  
  /**
   * Apply frequency-dependent Gaussian blur to the polar image buffer
   */
  private applyFrequencyDependentBlurToPolar(): void {
    const psf = this.getFrequencyDependentPSF();
    const { numDepthSamples, numAngleSamples } = this.config;
    
    // Skip blur if sigmas are too small (high frequency = sharp image)
    // Lower threshold to make effect more visible at moderate frequencies
    if (psf.sigmaAxial < 0.3 && psf.sigmaLateral < 0.3) {
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
   * Interface reflection for polar coordinates - ENHANCED (matching Linear quality)
   * Creates visible bright lines at tissue layer boundaries
   */
  private calculateInterfaceReflectionPolar(r: number, theta: number): number {
    if (!this.config.layers || this.config.layers.length < 2) return 0;
    
    let cumulativeDepth = 0;
    let totalReflection = 0;
    
    for (let i = 0; i < this.config.layers.length - 1; i++) {
      cumulativeDepth += this.config.layers[i].thicknessCm;
      const lateralCm = r * Math.sin(theta);
      const distFromInterface = Math.abs(
        r - wavyInterfaceDepthCm(cumulativeDepth, lateralCm, i),
      );
      
      // Sharper interface detection for visible layer boundaries
      if (distFromInterface < 0.08) {
        // Gaussian-like falloff for smooth but visible interface
        const interfaceStrength = Math.exp(-distFromInterface * 50) * 0.5;
        totalReflection += interfaceStrength;
      }
    }
    
    return Math.min(totalReflection, 0.8); // Cap total reflection
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
      
      // All inclusions generate acoustic shadows automatically (no toggle)
      for (const inclusion of this.config.inclusions) {
        
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
          const attenuation = Math.exp(-alpha * posteriorDepth);
          
          // Direct shadow: (1 - STRENGTH) at max attenuation
          const rawShadow = SHADOW_MIN_INTENSITY + (1.0 - SHADOW_MIN_INTENSITY) * attenuation;
          
          // Apply edge softness
          const shadowFactor = SHADOW_MIN_INTENSITY + (rawShadow - SHADOW_MIN_INTENSITY) * edgeFactor;
          
          // ═══ SMOOTH TRANSITION at shadow start ═══
          let transitionBlend = 1.0;
          if (posteriorDepth < TRANSITION_DEPTH_CM) {
            const t = posteriorDepth / TRANSITION_DEPTH_CM;
            transitionBlend = t * t * (3 - 2 * t);
          }
          
          // ═══ PER-PIXEL ORGANIC NOISE (serrated effect - from Linear) ═══
          // Creates granular, jagged texture at inclusion bottom
          const NOISE_SCALE = 0.08;
          const NOISE_AMP = 0.04; // ±4% organic jitter
          const nx = thetaIdx * NOISE_SCALE;
          const nz = rIdx * NOISE_SCALE;
          const noiseValue = this.smoothNoise2D(nx, nz, 42);
          const organicJitter = 1.0 + NOISE_AMP * noiseValue;
          
          // Apply transitioned shadow with organic noise
          const finalShadow = (1.0 * (1 - transitionBlend) + shadowFactor * transitionBlend) * organicJitter;
          
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
  
  /**
   * Smooth 2D noise for organic texture (serrated effect at inclusion bottoms)
   * Similar to Linear mode's smoothNoise function
   */
  private smoothNoise2D(x: number, y: number, seed: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    
    // Hermite interpolation weights
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    
    // Four corner noise values
    const n00 = this.noise(ix + iy * 57 + seed);
    const n10 = this.noise(ix + 1 + iy * 57 + seed);
    const n01 = this.noise(ix + (iy + 1) * 57 + seed);
    const n11 = this.noise(ix + 1 + (iy + 1) * 57 + seed);
    
    // Bilinear interpolation
    const nx0 = n00 * (1 - ux) + n10 * ux;
    const nx1 = n01 * (1 - ux) + n11 * ux;
    
    return (nx0 * (1 - uy) + nx1 * uy) * 2 - 1; // Return -1 to 1
  }

  // DEPRECATED function removed - use computeAcousticShadowsWithMotion instead

  /**
   * Obtém propriedades do tecido em coordenadas polares
   * COM BLENDING DE BORDAS E BORDAS HIPERECÓICAS (igual ao Linear)
   */
  private getTissueAtPolar(r: number, theta: number): {
    echogenicity: string;
    attenuation: number;
    reflectivity: number;
    isInclusion: boolean;
    posteriorEnhancement: boolean;
  } {
    const { fovDegrees, maxDepthCm, transducerRadiusCm, lateralOffset } = this.config;
    const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
    
    // Aplicar lateral offset (limitado a ±0.3 para movimento realista)
    const clampedOffset = Math.max(-0.3, Math.min(0.3, lateralOffset || 0));
    const offsetCm = clampedOffset * maxDepthCm * 0.5;
    
    // Converter (r, θ) para cartesiano físico COM offset
    const x = r * Math.sin(theta) + offsetCm;
    const y = r * Math.cos(theta);
    
    // ═══ VERIFICAR INCLUSÕES COM DISTÂNCIA DA BORDA ═══
    if (this.config.inclusions) {
      for (const inclusion of this.config.inclusions) {
        const inclDepth = inclusion.centerDepthCm;
        const inclLateral = inclusion.centerLateralPos;
        
        const maxLateralAtDepth = inclDepth * Math.tan(halfFOVRad);
        const inclX = inclLateral * maxLateralAtDepth * 2;
        const inclY = inclDepth;
        
        const dx = x - inclX;
        const dy = y - inclY;
        
        const beamWidthFactor = 1.0 + (r / maxDepthCm) * 0.4;
        const distortedDx = dx / beamWidthFactor;
        
        const halfWidth = inclusion.sizeCm.width / 2;
        const halfHeight = inclusion.sizeCm.height / 2;
        
        // ═══ CALCULAR DISTÂNCIA NORMALIZADA E DA BORDA ═══
        let normalizedDist = 0;
        let distanceFromEdge = 0;
        let isInside = false;
        
        if (inclusion.shape === 'ellipse') {
          const normX = distortedDx / halfWidth;
          const normY = dy / halfHeight;
          normalizedDist = Math.sqrt(normX * normX + normY * normY);
          isInside = normalizedDist <= 1.0;
          distanceFromEdge = isInside 
            ? (1 - normalizedDist) * Math.min(halfWidth, halfHeight)
            : (normalizedDist - 1) * Math.min(halfWidth, halfHeight);
        } else if (inclusion.shape === 'capsule') {
          const capsuleRadius = halfHeight;
          const rectHalfWidth = halfWidth - capsuleRadius;
          
          const rotationDeg = inclusion.rotationDegrees || 0;
          const rotationRad = (rotationDeg * Math.PI) / 180;
          const cosR = Math.cos(rotationRad);
          const sinR = Math.sin(rotationRad);
          const dxLocal = distortedDx * cosR + dy * sinR;
          const dyLocal = -distortedDx * sinR + dy * cosR;
          
          const irregularity = inclusion.wallIrregularity || 0;
          let radiusMod = 0;
          if (irregularity > 0) {
            radiusMod = irregularity * (
              0.5 * Math.sin(dxLocal * 8.0) + 
              0.3 * Math.cos(dxLocal * 15.0) + 
              0.2 * Math.sin(dxLocal * 23.0)
            );
          }
          
          const asymmetry = inclusion.wallAsymmetry || 0;
          const asymmetryOffset = dyLocal > 0 ? asymmetry : -asymmetry;
          const effectiveRadius = capsuleRadius + radiusMod + asymmetryOffset;
          
          if (Math.abs(dxLocal) <= rectHalfWidth) {
            isInside = Math.abs(dyLocal) <= effectiveRadius;
            distanceFromEdge = effectiveRadius - Math.abs(dyLocal);
          } else {
            const endCenterX = Math.sign(dxLocal) * rectHalfWidth;
            const localDxEnd = dxLocal - endCenterX;
            const distToEndCenter = Math.sqrt(localDxEnd * localDxEnd + dyLocal * dyLocal);
            isInside = distToEndCenter <= effectiveRadius;
            distanceFromEdge = effectiveRadius - distToEndCenter;
          }
        } else {
          isInside = Math.abs(distortedDx) <= halfWidth && Math.abs(dy) <= halfHeight;
          distanceFromEdge = Math.min(halfWidth - Math.abs(distortedDx), halfHeight - Math.abs(dy));
        }
        
        // ═══ SE PERTO DA BORDA (dentro ou fora) - BORDA HIPERECÓICA ═══
        const edgeZone = 0.08; // Zone de transição em cm
        const isNearEdge = Math.abs(distanceFromEdge) < edgeZone;
        
        if (isNearEdge && !isInside) {
          // Borda externa hiperecóica (brilhante) para inclusões com sharp border
          if (inclusion.borderEchogenicity === 'sharp') {
            const edgeIntensity = Math.exp(-Math.abs(distanceFromEdge) / 0.03);
            return {
              echogenicity: 'hyperechoic',
              attenuation: 0.5,
              reflectivity: 0.5 + edgeIntensity * 0.45, // Borda brilhante
              isInclusion: false,
              posteriorEnhancement: false,
            };
          }
        }
        
        if (isInside) {
          const medium = getAcousticMedium(inclusion.mediumInsideId);
          
          // ═══ BLENDING SUAVE NA BORDA (igual ao Linear) ═══
          let blendFactor = 1;
          if (distanceFromEdge < edgeZone && distanceFromEdge >= 0) {
            const t = distanceFromEdge / edgeZone;
            // Smoothstep: t² * (3 - 2t)
            blendFactor = t * t * (3 - 2 * t);
          }
          
          // Borda interna hiperecóica para sharp borders
          let edgeBoost = 0;
          if (inclusion.borderEchogenicity === 'sharp' && distanceFromEdge < edgeZone) {
            edgeBoost = (1 - distanceFromEdge / edgeZone) * 0.4;
          }
          
          return {
            echogenicity: medium.baseEchogenicity,
            attenuation: medium.attenuation_dB_per_cm_MHz,
            reflectivity: (0.5 + edgeBoost) * blendFactor,
            isInclusion: true,
            posteriorEnhancement: inclusion.posteriorEnhancement || false,
          };
        }
      }
    }
    
    // ═══ LAYERS POR PROFUNDIDADE ═══
    if (this.config.layers && this.config.layers.length > 0) {
      const lateralCm = r * Math.sin(theta);
      let cumulativeDepth = 0;
      for (let li = 0; li < this.config.layers.length; li++) {
        const layer = this.config.layers[li];
        cumulativeDepth += layer.thicknessCm;
        const boundaryZ = wavyInterfaceDepthCm(cumulativeDepth, lateralCm, li);
        if (r <= boundaryZ) {
          const medium = getAcousticMedium(layer.mediumId);
          return {
            echogenicity: medium.baseEchogenicity,
            attenuation: medium.attenuation_dB_per_cm_MHz,
            reflectivity: layer.reflectivityBias !== undefined ? 0.5 + layer.reflectivityBias : 0.5,
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
      reflectivity: 0.5,
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
  private renderPolarToCanvas(ctx: ConvexCanvasContext, applyLiveNoise = true) {
    const {
      canvasWidth,
      canvasHeight,
      maxDepthCm,
      transducerType,
      numDepthSamples,
      numAngleSamples,
    } = this.config;
    
    const imageData = ctx.createImageData(canvasWidth, canvasHeight);
    const data = imageData.data;
    
    // Fixed on-screen fan; depth control scales anatomy inside the wedge.
    const layout = getConvexSectorLayout(
      canvasWidth,
      canvasHeight,
      transducerType === 'microconvex' ? 'microconvex' : 'convex',
    );
    const {
      halfFOVRad,
      arcRadiusPixels,
      centerX,
      virtualCenterY,
      sectorDepthPixels,
    } = layout;
    
    
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
        if (radiusFromCenter < arcRadiusPixels) {
          data[pixelIdx] = 0;
          data[pixelIdx + 1] = 0;
          data[pixelIdx + 2] = 0;
          data[pixelIdx + 3] = 255;
          pixelsBlocked++;
          continue;
        }
        
        const depthFromTransducer = radiusFromCenter - arcRadiusPixels;

        // ═══ MÁSCARA 3: FORA DO SETOR FIXO ═══
        if (depthFromTransducer > sectorDepthPixels) {
          data[pixelIdx] = 0;
          data[pixelIdx + 1] = 0;
          data[pixelIdx + 2] = 0;
          data[pixelIdx + 3] = 255;
          pixelsBlocked++;
          continue;
        }

        const physDepthCm =
          (depthFromTransducer / Math.max(1, sectorDepthPixels)) * maxDepthCm;
        
        // ═══ SAMPLE DA IMAGEM POLAR COM INTERPOLAÇÃO BILINEAR ═══
        const rNorm = depthFromTransducer / Math.max(1, sectorDepthPixels);
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
        
        const angleFromEdge = halfFOVRad - Math.abs(pixelAngle);

        if (applyLiveNoise) {
          const depthRatio = physDepthCm / maxDepthCm;
          const temporalSeed = this.time * 2.5;
          const highFreqNoise = Math.sin(x * 0.3 + y * 0.2 + temporalSeed * 12) * 0.012;
          const midFreqNoise = Math.sin(x * 0.08 + y * 0.1 + temporalSeed * 4) * 0.018;
          const lowFreqNoise = Math.sin(temporalSeed * 1.5) * 0.008;
          const rnd =
            Math.sin(x * 12.9898 + y * 78.233 + temporalSeed * 43.891) * 43758.5453;
          const frameNoise = ((rnd - Math.floor(rnd)) - 0.5) * 0.025 * (1 + depthRatio * 0.5);

          const depthFromEdge = maxDepthCm - physDepthCm;
          const edgeMotionGuard = Math.min(
            Math.min(1, angleFromEdge / (halfFOVRad * 0.14)),
            Math.min(1, depthFromEdge / Math.max(0.25, maxDepthCm * 0.1)),
          );

          const totalLiveNoise =
            (highFreqNoise + midFreqNoise + lowFreqNoise + frameNoise) * (1 + depthRatio * 0.8);
          intensity *= 1 + totalLiveNoise * edgeMotionGuard;

          const scanlinePos = (temporalSeed * 50) % canvasHeight;
          const scanlineDistance = Math.abs(y - scanlinePos);
          intensity *=
            1 +
            Math.exp(-scanlineDistance * 0.3) *
              0.015 *
              Math.sin(temporalSeed * 15) *
              edgeMotionGuard;

          intensity *= 1 + Math.sin(x * 0.15 + temporalSeed * 2) * 0.006 * edgeMotionGuard;
        }

        const edgeFeatherAngle = halfFOVRad * 0.07;
        if (angleFromEdge < edgeFeatherAngle) {
          intensity *= angleFromEdge / edgeFeatherAngle;
        }

        const radialFromOuter = sectorDepthPixels - depthFromTransducer;
        const outerFeatherPx = sectorDepthPixels * 0.05;
        if (radialFromOuter < outerFeatherPx) {
          intensity *= Math.max(0, radialFromOuter / outerFeatherPx);
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
  }

  /**
   * Para a renderização
   */
  stop() {
    // Cleanup se necessário
  }
}
