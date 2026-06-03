import {
  type AcousticMedium,
  type AcousticMediumId,
  type Echogenicity,
  type UltrasoundInclusionConfig,
  type UltrasoundLayerConfig,
  getAcousticMedium,
} from '@/types/acousticMedia';
import { computeHandheldProbeMotionCm } from './HandheldProbeMotion';
import { wavyInterfaceDepthCm } from './LayerInterfaceWobble';

export type PulseEchoModelConfig = {
  layers?: UltrasoundLayerConfig[];
  inclusions?: UltrasoundInclusionConfig[];
  depthCm: number;
  frequencyMHz: number;
  focusCm: number;
  gainDb: number;
  dynamicRangeDb?: number;
  lateralOffsetCm?: number;
  /** When true, applies breathing/jitter/tremor and live speckle shimmer. */
  animated?: boolean;
  /** Full PSF + global artifact pass (disable for faster keyframes). */
  highQualityPost?: boolean;
  /**
   * Convex/microconvex: scan cone stays fixed on screen; no beam-position jitter.
   * Motion is speckle + vessel pulsation only.
   */
  fixScanWindow?: boolean;
};

type TissueCell = {
  echogenicity: Echogenicity;
  impedance: number;
  attenuation: number;
  reflectivity: number;
  scatterDensity: number;
  scatterAmplitude: number;
  scatterSize: number;
  heterogeneity: number;
  isInclusion: boolean;
  isFluid: boolean;
  inclusion?: UltrasoundInclusionConfig;
  boundary: number;
  impedanceContrast: number;
  localX: number;
  localZ: number;
  sdf: number;
  normalX: number;
  normalZ: number;
  insideFraction: number;
};

type InclusionHit = {
  inclusion: UltrasoundInclusionConfig;
  medium: AcousticMedium;
  sdf: number;
  insideDistance: number;
  localX: number;
  localZ: number;
  normalX: number;
  normalZ: number;
};

export class PulseEchoAcousticModel {
  private time = 0;

  constructor(private config: PulseEchoModelConfig) {}

  updateConfig(config: PulseEchoModelConfig): void {
    this.config = config;
  }

  setTime(seconds: number): void {
    this.time = seconds;
  }

  renderLinear(width: number, height: number, fieldWidthCm = 5.0): Float32Array {
    const out = new Float32Array(width * height);
    const dz = this.config.depthCm / Math.max(1, height - 1);

    for (let x = 0; x < width; x++) {
      const lateral = ((x + 0.5) / width - 0.5) * fieldWidthCm + (this.config.lateralOffsetCm ?? 0);
      this.renderBeam(
        height,
        dz,
        (z) => ({ x: lateral, z }),
        (y, value) => {
          out[y * width + x] = value;
        },
      );
    }

    if (this.config.highQualityPost !== false) {
      this.applyPsf(out, width, height, this.psfSigmaLateral(), this.psfSigmaAxial());
      this.applyGlobalArtifacts(out, width, height);
    } else {
      this.applyPsf(out, width, height, this.psfSigmaLateral() * 0.6, this.psfSigmaAxial() * 0.6);
    }
    return out;
  }

  renderConvexPolar(numDepthSamples: number, numAngleSamples: number, fovDegrees: number): Float32Array {
    const out = new Float32Array(numDepthSamples * numAngleSamples);
    const dz = this.config.depthCm / Math.max(1, numDepthSamples - 1);
    const halfFov = (fovDegrees * Math.PI / 180) * 0.5;

    for (let a = 0; a < numAngleSamples; a++) {
      const theta = ((a / Math.max(1, numAngleSamples - 1)) * 2 - 1) * halfFov;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      this.renderBeam(
        numDepthSamples,
        dz,
        (r) => ({
          x: r * sinT + (this.config.lateralOffsetCm ?? 0),
          z: r * cosT,
        }),
        (rIdx, value) => {
          out[rIdx * numAngleSamples + a] = value;
        },
      );
    }

    if (this.config.highQualityPost !== false) {
      this.applyPsf(out, numAngleSamples, numDepthSamples, this.psfSigmaLateral(), this.psfSigmaAxial());
      this.applyGlobalArtifacts(out, numAngleSamples, numDepthSamples);
    } else {
      this.applyPsf(out, numAngleSamples, numDepthSamples, this.psfSigmaLateral() * 0.6, this.psfSigmaAxial() * 0.6);
    }
    return out;
  }

  private renderBeam(
    sampleCount: number,
    dz: number,
    positionAt: (depthCm: number) => { x: number; z: number },
    write: (sampleIdx: number, value: number) => void,
  ): void {
    let incidentEnergy = 1.0;
    const surface = positionAt(0);
    let previousImpedance = this.getLayerCell(surface.x, 0).impedance;
    let posteriorEnhancement = 1.0;
    let fluidPathCm = 0;
    let wasInFluid = false;

    let insideShadowCaster = false;
    let shadowCasterEdge = 1.0;
    let shadowDepthBehindCm = -1;

    for (let i = 0; i < sampleCount; i++) {
      const depth = i * dz;
      const p = positionAt(depth);
      const depthNorm = depth / Math.max(0.1, this.config.depthCm);
      const sample = this.config.animated !== false
        ? this.applyProbeMotion(p.x, p.z, depthNorm)
        : p;
      const tissue = this.getTissueCell(sample.x, sample.z);

      const reflection = Math.abs((tissue.impedance - previousImpedance) / Math.max(0.05, tissue.impedance + previousImpedance));
      previousImpedance = tissue.impedance;

      const focusGain = 1 + 0.5 * Math.exp(-Math.pow(depth - this.config.focusCm, 2) * 1.4);
      const tgc = 0.55 + 0.95 * depthNorm;

      const castsShadow = this.inclusionCastsShadow(tissue.inclusion);
      const insideCaster = castsShadow && tissue.isInclusion && tissue.sdf <= 0.02;

      if (insideCaster) {
        insideShadowCaster = true;
        const halfW = Math.max(0.05, (tissue.inclusion?.sizeCm.width ?? 0.6) * 0.5);
        const centrality = this.clamp01(1 - Math.abs(tissue.localX) / halfW);
        shadowCasterEdge = Math.min(shadowCasterEdge, 0.45 + centrality * 0.55);
      } else if (insideShadowCaster) {
        shadowDepthBehindCm = 0;
        insideShadowCaster = false;
      }

      const envelope = this.coherentScatterEnvelope(sample.x, sample.z, depth, tissue);
      const backscatter = tissue.scatterAmplitude * tissue.scatterDensity * envelope;
      const wallEcho = reflection * (0.7 + tissue.boundary * 2.8);
      const interior = this.inclusionInteriorSignal(tissue, sample.x, sample.z, backscatter);
      const boundaryEcho = tissue.boundary > 0.12 ? wallEcho : 0;
      const edgeArtifact = this.lateralEdgeArtifact(tissue);

      if (tissue.isFluid) {
        fluidPathCm += dz;
        wasInFluid = true;
      } else if (wasInFluid) {
        const wantsBoost = tissue.inclusion?.posteriorEnhancement !== false;
        posteriorEnhancement = wantsBoost
          ? 1 + Math.min(0.48, fluidPathCm * 0.34)
          : 1;
        fluidPathCm = 0;
        wasInFluid = false;
      } else {
        posteriorEnhancement = 1 + (posteriorEnhancement - 1) * Math.exp(-dz * 1.15);
      }

      let acousticShadow = 1.0;
      if (shadowDepthBehindCm >= 0) {
        shadowDepthBehindCm += dz;
        acousticShadow = this.posteriorShadowFactor(shadowDepthBehindCm, shadowCasterEdge);
      }

      let intensity =
        incidentEnergy *
        focusGain *
        tgc *
        posteriorEnhancement *
        acousticShadow *
        (1 - edgeArtifact) *
        (boundaryEcho + interior);

      if (this.config.animated !== false) {
        intensity *= this.liveSpeckleMultiplier(sample.x, sample.z, depthNorm);
        const flow = this.bloodFlowArtifact(tissue, sample.x, sample.z, depth);
        intensity = intensity * flow.mult + flow.add;
      }

      intensity *= this.depthAttenuationTint(depthNorm);
      if (this.config.highQualityPost !== false) {
        intensity += this.nearFieldReverberation(sample.z, depthNorm);
        intensity += this.layerInterfaceGlint(sample.x, sample.z);
      }

      intensity *= Math.pow(10, (this.config.gainDb - 50) / 20);
      intensity = Math.log1p(Math.max(0, intensity) * 12) / Math.log1p(12);
      const drExponent = Math.max(0.35, (this.config.dynamicRangeDb ?? 60) / 60);
      intensity = Math.pow(this.clamp01(intensity), drExponent);
      write(i, this.clamp01(intensity));

      const attenuationDb = tissue.attenuation * this.config.frequencyMHz * dz;
      incidentEnergy *= Math.pow(10, (-2 * attenuationDb) / 20);
    }
  }

  private inclusionCastsShadow(inclusion?: UltrasoundInclusionConfig): boolean {
    if (!inclusion?.hasStrongShadow) return false;
    if (
      inclusion.mediumInsideId === 'blood' ||
      inclusion.mediumInsideId === 'water' ||
      inclusion.mediumInsideId === 'cyst_fluid'
    ) {
      return false;
    }
    if (inclusion.mediumInsideId === 'bone_cortical') return true;
    return inclusion.type === 'solid_mass' || inclusion.type === 'calcification';
  }

  /**
   * Soft posterior shadow: tissue remains visible (speckle never fully extinguished).
   * Matches clinical appearance — ~10–25% darker, fuzzy edges, gradual recovery with depth.
   */
  private posteriorShadowFactor(depthBehindCm: number, edgeSoftness: number): number {
    const alpha = 0.55;
    const maxDrop = 0.22 * edgeSoftness;
    const transitionCm = 0.12;
    const t = this.clamp01(depthBehindCm / transitionCm);
    const blend = t * t * (3 - 2 * t);
    const decay = Math.exp(-alpha * depthBehindCm);
    const shadowStrength = maxDrop * decay * blend;
    return Math.max(0.72, 1 - shadowStrength);
  }

  /** Subtle refraction dropout at the wall sample only — does not cast a black column. */
  private lateralEdgeArtifact(tissue: TissueCell): number {
    if (tissue.sdf === Number.POSITIVE_INFINITY || tissue.boundary < 0.2) return 0;
    const lateralEdge = Math.abs(tissue.normalX);
    const nearWall = Math.exp(-Math.abs(tissue.sdf) / 0.06);
    return nearWall * lateralEdge * tissue.impedanceContrast * 0.06;
  }

  private inclusionInteriorSignal(
    tissue: TissueCell,
    x: number,
    z: number,
    backscatter: number,
  ): number {
    if (!tissue.isInclusion) {
      return (this.echogenicityFloor(tissue.echogenicity) + backscatter) * tissue.reflectivity;
    }

    if (tissue.isFluid) {
      const centerWeight = this.clamp01(1 - tissue.boundary * 1.25);
      const base = this.fluidInteriorBase(tissue);
      const reverberation = this.fluidReverberation(x, z, tissue) * centerWeight;
      const wallProximity = tissue.boundary * (0.55 + tissue.impedanceContrast * 0.9);
      return base * centerWeight + backscatter * (0.75 + centerWeight * 0.35) + reverberation + wallProximity;
    }

    return (this.echogenicityFloor(tissue.echogenicity) + backscatter) * tissue.reflectivity;
  }

  private fluidInteriorBase(tissue: TissueCell): number {
    if (tissue.inclusion?.mediumInsideId === 'blood') {
      const pulse = this.cardiacPulse();
      const arteryBoost = tissue.inclusion && this.isArtery(tissue.inclusion) ? 0.02 * pulse : 0.01 * pulse;
      return 0.08 + arteryBoost;
    }
    if (tissue.inclusion?.type === 'cyst' || tissue.inclusion?.mediumInsideId === 'cyst_fluid') {
      return 0.11;
    }
    return 0.09;
  }

  /** Arterial-style envelope: fast upstroke, slower downstroke (no ringing). */
  private cardiacPulse(): number {
    const phase = (this.time * 1.2) % 1;
    if (phase < 0.18) return phase / 0.18;
    return Math.max(0, 1 - (phase - 0.18) / 0.82);
  }

  private isArtery(inclusion: UltrasoundInclusionConfig): boolean {
    if (inclusion.type !== 'vessel' || inclusion.mediumInsideId !== 'blood') return false;
    const id = `${inclusion.id} ${inclusion.label}`.toLowerCase();
    return id.includes('arter') || id.includes('arté') || id.includes('carot');
  }

  /** Vessel wall expansion in anatomical space (internal structure motion). */
  private vesselRadiusPulse(inclusion: UltrasoundInclusionConfig): number {
    if (inclusion.mediumInsideId !== 'blood' && inclusion.type !== 'vessel') return 1;
    const pulse = this.cardiacPulse();
    const artery = this.isArtery(inclusion);
    const amp = artery ? 0.034 : 0.02;
    return 1 + (pulse - 0.5) * amp * 2;
  }

  private fluidReverberation(x: number, z: number, tissue: TissueCell): number {
    const coarse = this.fbm(x * 1.4 + this.time * 0.08, z * 1.2, 2, 211);
    const fine = this.hash2(x * 8.2, z * 9.1, 41) * 0.5 - 0.25;
    return (coarse * 0.028 + fine * 0.015) * (0.4 + tissue.heterogeneity);
  }

  private getTissueCell(x: number, z: number): TissueCell {
    const background = this.getLayerCell(x, z);
    let best: InclusionHit | null = null;

    for (const inclusion of this.config.inclusions ?? []) {
      const hit = this.inclusionSdf(x, z, inclusion);
      if (!best || hit.sdf < best.sdf) best = hit;
    }

    if (!best) return background;

    const edgeWidth =
      best.inclusion.type === 'cyst' || best.medium.id === 'cyst_fluid' || best.medium.id === 'water'
        ? 0.11
        : 0.085;
    const boundary = Math.exp(-Math.abs(best.sdf) / edgeWidth);
    const contrast = Math.abs(best.medium.acousticImpedance_MRayl - background.impedance) /
      Math.max(0.05, best.medium.acousticImpedance_MRayl + background.impedance);

    if (best.sdf <= 0) {
      const inner = this.smoothstep(0, edgeWidth, best.insideDistance);
      const wallBlend = Math.max(boundary, 1 - inner);
      const isFluid =
        best.medium.id === 'cyst_fluid' || best.medium.id === 'water' || best.medium.id === 'blood';

      return this.cellFromMedium(best.medium, true, best.inclusion, {
        echogenicity: isFluid ? 'hypoechoic' : best.medium.baseEchogenicity,
        reflectivity: this.mediumReflectivity(best.medium.id, best.inclusion.type) * (0.55 + 0.45 * inner) + wallBlend * 0.42,
        scatterDensity: this.mediumScatterDensity(best.medium.id, best.inclusion.type) * (0.85 + inner * 0.2),
        scatterAmplitude: this.mediumScatterAmplitude(best.medium.id, best.inclusion.type),
        scatterSize: this.mediumScatterSize(best.medium.id, best.inclusion.type) * 1.15,
        heterogeneity: Math.max(0.12, this.mediumHeterogeneity(best.medium.id, best.inclusion.type)),
        boundary: wallBlend,
        impedanceContrast: contrast,
        localX: best.localX,
        localZ: best.localZ,
        sdf: best.sdf,
        normalX: best.normalX,
        normalZ: best.normalZ,
        insideFraction: inner,
      });
    }

    if (best.sdf < edgeWidth * 1.35) {
      const rimStrength = Math.exp(-Math.abs(best.sdf) / (edgeWidth * 0.65));
      return {
        ...background,
        echogenicity: best.inclusion.borderEchogenicity === 'sharp' ? 'hyperechoic' : 'isoechoic',
        boundary: rimStrength,
        impedanceContrast: contrast,
        reflectivity: background.reflectivity + rimStrength * (0.45 + contrast * 0.65),
        scatterDensity: background.scatterDensity + rimStrength * 0.35,
        sdf: best.sdf,
        normalX: best.normalX,
        normalZ: best.normalZ,
        insideFraction: 0,
      };
    }

    return background;
  }

  private getLayerCell(x: number, z: number): TissueCell {
    if (this.config.layers?.length) {
      let cumulativeDepth = 0;
      for (let li = 0; li < this.config.layers.length; li++) {
        const layer = this.config.layers[li];
        cumulativeDepth += layer.thicknessCm;
        const boundaryZ = wavyInterfaceDepthCm(cumulativeDepth, x, li);
        if (z <= boundaryZ) {
          const medium = getAcousticMedium(layer.mediumId);
          return this.cellFromMedium(medium, false, undefined, {
            reflectivity: layer.reflectivityBias !== undefined ? 0.5 + layer.reflectivityBias : this.mediumReflectivity(medium.id),
            scatterSize: (layer.noiseScale ?? 1) * this.mediumScatterSize(medium.id),
          });
        }
      }
    }

    return this.cellFromMedium(getAcousticMedium('generic_soft'), false);
  }

  private cellFromMedium(
    medium: AcousticMedium,
    isInclusion: boolean,
    inclusion?: UltrasoundInclusionConfig,
    overrides: Partial<TissueCell> = {},
  ): TissueCell {
    return {
      echogenicity: overrides.echogenicity ?? medium.baseEchogenicity,
      impedance: medium.acousticImpedance_MRayl,
      attenuation: medium.attenuation_dB_per_cm_MHz,
      reflectivity: overrides.reflectivity ?? this.mediumReflectivity(medium.id, inclusion?.type),
      scatterDensity: overrides.scatterDensity ?? this.mediumScatterDensity(medium.id, inclusion?.type),
      scatterAmplitude: overrides.scatterAmplitude ?? this.mediumScatterAmplitude(medium.id, inclusion?.type),
      scatterSize: overrides.scatterSize ?? this.mediumScatterSize(medium.id, inclusion?.type),
      heterogeneity: overrides.heterogeneity ?? this.mediumHeterogeneity(medium.id, inclusion?.type),
      isInclusion,
      isFluid: medium.id === 'cyst_fluid' || medium.id === 'water' || medium.id === 'blood',
      inclusion,
      boundary: overrides.boundary ?? 0,
      impedanceContrast: overrides.impedanceContrast ?? 0,
      localX: overrides.localX ?? 0,
      localZ: overrides.localZ ?? 0,
      sdf: overrides.sdf ?? Number.POSITIVE_INFINITY,
      normalX: overrides.normalX ?? 0,
      normalZ: overrides.normalZ ?? 0,
      insideFraction: overrides.insideFraction ?? 0,
    };
  }

  private inclusionSdf(x: number, z: number, inclusion: UltrasoundInclusionConfig): InclusionHit {
    const cx = inclusion.centerLateralPos * 2.5;
    const cz = inclusion.centerDepthCm;
    const dx = x - cx;
    const dz = z - cz;
    const rot = ((inclusion.rotationDegrees ?? 0) * Math.PI) / 180;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const lx = dx * c + dz * s;
    const lz = -dx * s + dz * c;
    const radiusPulse = this.vesselRadiusPulse(inclusion);
    const rx = Math.max(0.03, inclusion.sizeCm.width * 0.5) * radiusPulse;
    const rz = Math.max(0.03, inclusion.sizeCm.height * 0.5) * radiusPulse;

    let sdf: number;
    let nxLocal = 0;
    let nzLocal = -1;

    if (inclusion.shape === 'capsule') {
      const radius = rz + this.wallNoise(lx, lz, inclusion);
      const halfLine = Math.max(0, rx - radius);
      const qx = lx - this.clamp(lx, -halfLine, halfLine);
      const qz = lz;
      const len = Math.sqrt(qx * qx + qz * qz) || 1;
      sdf = len - radius;
      nxLocal = qx / len;
      nzLocal = qz / len;
    } else if (inclusion.shape === 'rectangle') {
      const qx = Math.abs(lx) - rx;
      const qz = Math.abs(lz) - rz;
      const ox = Math.max(qx, 0);
      const oz = Math.max(qz, 0);
      sdf = Math.sqrt(ox * ox + oz * oz) + Math.min(Math.max(qx, qz), 0);
      if (qx > qz) {
        nxLocal = Math.sign(lx);
        nzLocal = 0;
      } else {
        nxLocal = 0;
        nzLocal = Math.sign(lz);
      }
    } else {
      const lobulation = this.lobulation(lx, lz, inclusion);
      const px = lx / rx;
      const pz = lz / rz;
      const len = Math.sqrt(px * px + pz * pz) || 1;
      sdf = (len - (1 + lobulation)) * Math.min(rx, rz);
      nxLocal = px / len;
      nzLocal = pz / len;
    }

    const normalX = nxLocal * c - nzLocal * s;
    const normalZ = nxLocal * s + nzLocal * c;

    return {
      inclusion,
      medium: getAcousticMedium(inclusion.mediumInsideId),
      sdf,
      insideDistance: Math.max(0, -sdf),
      localX: lx,
      localZ: lz,
      normalX,
      normalZ,
    };
  }

  /**
   * Linear: beam wander. Convex (fixScanWindow): no shift — keeps wedge size fixed on screen.
   */
  private applyProbeMotion(x: number, z: number, depthNorm: number): { x: number; z: number } {
    if (this.config.fixScanWindow) {
      return { x, z };
    }
    const motion = computeHandheldProbeMotionCm(this.time, depthNorm);
    return {
      x: x + motion.lateralCm,
      z: z + motion.depthCm,
    };
  }

  private liveSpeckleMultiplier(x: number, z: number, depthNorm: number): number {
    const seed = this.time * 2.5;
    const high = Math.sin(x * 0.3 + z * 0.2 + seed * 12) * 0.022;
    const mid = Math.sin(x * 0.08 + z * 0.1 + seed * 4) * 0.028;
    const low = Math.sin(seed * 1.5) * 0.012;
    const strain =
      Math.sin(this.time * 1.35 + x * 0.4 + z * 0.5) *
      Math.sin(this.time * 0.8 + z * 0.35) *
      0.016;
    return 1 + (high + mid + low + strain) * (1 + depthNorm * 0.85);
  }

  private bloodFlowArtifact(
    tissue: TissueCell,
    x: number,
    z: number,
    _depth: number,
  ): { mult: number; add: number } {
    if (tissue.inclusion?.mediumInsideId !== 'blood' || !tissue.isInclusion) {
      return { mult: 1, add: 0 };
    }

    const halfW = Math.max(0.05, tissue.inclusion.sizeCm.width * 0.5);
    const radial = Math.sqrt(tissue.localX * tissue.localX + tissue.localZ * tissue.localZ) / halfW;
    const laminar = Math.max(0, 1 - radial * radial);
    if (laminar < 0.05) return { mult: 1, add: 0 };

    const pulse = this.cardiacPulse();
    const seed = tissue.inclusion.id.length * 13;
    const advect = this.time * (this.isArtery(tissue.inclusion) ? 2.8 : 1.6);
    const flow = this.fbm(
      tissue.localX * 4 + advect,
      tissue.localZ * 3.5 + advect * 0.7,
      2,
      seed,
    );

    const mult = 1 + (flow - 0.5) * 0.1 * laminar * (0.55 + pulse * 0.45);
    const add = Math.max(0, flow - 0.35) * 0.07 * laminar * pulse;

    return { mult, add };
  }

  private depthAttenuationTint(depthNorm: number): number {
    return 0.88 + 0.12 * (1 - depthNorm * 0.85);
  }

  private nearFieldReverberation(z: number, depthNorm: number): number {
    if (z > this.config.depthCm * 0.42) return 0;
    const t = 1 - z / (this.config.depthCm * 0.42);
    const rings =
      Math.sin(z * 95 + this.time * 4.2) * 0.018 +
      Math.sin(z * 160 - this.time * 2.8) * 0.01;
    return rings * t * t;
  }

  private layerInterfaceGlint(x: number, z: number): number {
    if (!this.config.layers?.length) return 0;
    let cumulative = 0;
    for (let li = 0; li < this.config.layers.length; li++) {
      const layer = this.config.layers[li];
      cumulative += layer.thicknessCm;
      const ifaceZ = wavyInterfaceDepthCm(cumulative, x, li);
      const dist = Math.abs(z - ifaceZ);
      if (dist < 0.045) {
        return Math.exp(-dist * 55) * 0.12 * (0.6 + (layer.reflectivityBias ?? 0) * 0.8);
      }
    }
    return 0;
  }

  private electronicSpeckleNoise(x: number, z: number, depthNorm: number): number {
    const n = this.hash2(x * 17.3 + this.time * 31, z * 23.1, 59) - 0.5;
    return n * 0.055 * (0.75 + depthNorm * 0.35);
  }

  private applyGlobalArtifacts(buffer: Float32Array, width: number, height: number): void {
    const seed = this.time * 2.5;
    for (let y = 0; y < height; y++) {
      const depthNorm = y / Math.max(1, height - 1);
      const scanLine =
        1 +
        Math.sin(y * 0.22 + seed * 5.5) * 0.028 +
        Math.sin(y * 0.07 + seed * 2.1) * 0.015;
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const lateralNorm = (x / Math.max(1, width - 1) - 0.5) * 2;
        const vignette = 1 - Math.abs(lateralNorm) * 0.06;
        const thermal = (this.hash2(x * 1.1, y * 1.3, seed + 17) - 0.5) * 0.035;
        const depthNoise = (this.hash2(x * 0.4, y * 0.6, seed + 91) - 0.5) * 0.02 * depthNorm;
        buffer[i] = this.clamp01(buffer[i] * scanLine * vignette + thermal + depthNoise);
      }
    }
  }

  private coherentScatterEnvelope(x: number, z: number, depth: number, tissue: TissueCell): number {
    const freqScale = 6 / Math.max(1, this.config.frequencyMHz);
    const scale = Math.max(0.2, tissue.scatterSize * (0.85 + freqScale * 0.12));
    const axialStretch = 1 + depth * 0.018;
    const beamWidth = 0.03 + depth * 0.014;
    let re = 0;
    let im = 0;
    const count = this.config.highQualityPost === false ? 5 : 7;

    for (let i = 0; i < count; i++) {
      const ox = (i - (count - 1) / 2) * beamWidth;
      const px = (x + ox) / scale;
      const pz = z / (scale * axialStretch);
      const phase = this.hash2(px * 9.1, pz * 13.7, i * 31) * Math.PI * 2 + this.time * 0.65;
      const amp = 0.65 + 0.7 * this.hash2(px * 4.7, pz * 5.3, 99 + i);
      re += Math.cos(phase) * amp;
      im += Math.sin(phase) * amp;
    }

    const rayleigh = Math.sqrt(re * re + im * im) / Math.sqrt(count);
    const macro = this.fbm(x * 0.85, z * 0.85, 5, 41);
    const meso = this.fbm(x * 2.2 + this.time * 0.02, z * 2.0, 4, 97);
    const micro = this.fbm(x * 6.5, z * 6.2, 2, 173);
    return Math.max(
      0.04,
      rayleigh * (1 + tissue.heterogeneity * (macro * 0.42 + meso * 0.24 + micro * 0.08)),
    );
  }

  private applyPsf(buffer: Float32Array, width: number, height: number, sigmaX: number, sigmaY: number): void {
    this.blurHorizontal(buffer, width, height, sigmaX);
    this.blurVertical(buffer, width, height, sigmaY);
  }

  private blurHorizontal(buffer: Float32Array, width: number, height: number, sigma: number): void {
    if (sigma < 0.25) return;
    const radius = Math.ceil(sigma * 2);
    const temp = new Float32Array(buffer.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let wsum = 0;
        for (let k = -radius; k <= radius; k++) {
          const sx = this.clamp(Math.round(x + k), 0, width - 1);
          const w = Math.exp(-(k * k) / (2 * sigma * sigma));
          sum += buffer[y * width + sx] * w;
          wsum += w;
        }
        temp[y * width + x] = sum / wsum;
      }
    }
    buffer.set(temp);
  }

  private blurVertical(buffer: Float32Array, width: number, height: number, sigma: number): void {
    if (sigma < 0.25) return;
    const radius = Math.ceil(sigma * 2);
    const temp = new Float32Array(buffer.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let wsum = 0;
        for (let k = -radius; k <= radius; k++) {
          const sy = this.clamp(Math.round(y + k), 0, height - 1);
          const w = Math.exp(-(k * k) / (2 * sigma * sigma));
          sum += buffer[sy * width + x] * w;
          wsum += w;
        }
        temp[y * width + x] = sum / wsum;
      }
    }
    buffer.set(temp);
  }

  private psfSigmaAxial(): number {
    return Math.max(0.2, (6 / Math.max(1, this.config.frequencyMHz) - 1) * 1.1);
  }

  private psfSigmaLateral(): number {
    return Math.max(0.25, (6 / Math.max(1, this.config.frequencyMHz) - 1) * 1.45);
  }

  private echogenicityFloor(e: Echogenicity): number {
    switch (e) {
      case 'anechoic': return 0.035;
      case 'hypoechoic': return 0.13;
      case 'hyperechoic': return 0.42;
      default: return 0.22;
    }
  }

  private mediumReflectivity(id: AcousticMediumId, type?: string): number {
    if (type === 'cyst' || id === 'cyst_fluid' || id === 'water') return 0.42;
    if (id === 'blood') return 0.38;
    if (id === 'bone_cortical') return 1.25;
    if (type === 'heterogeneous_lesion') return 0.55;
    if (type === 'solid_mass') return 0.45;
    if (id === 'fat') return 0.36;
    if (id === 'fascia' || id === 'tendon') return 0.88;
    return 0.5;
  }

  private mediumScatterDensity(id: AcousticMediumId, type?: string): number {
    if (type === 'cyst' || id === 'cyst_fluid' || id === 'water') return 0.38;
    if (id === 'blood') return 0.45;
    if (id === 'fat') return 0.62;
    if (type === 'heterogeneous_lesion') return 1.15;
    if (type === 'solid_mass') return 0.9;
    if (id === 'bone_cortical') return 1.45;
    return 0.82;
  }

  private mediumScatterAmplitude(id: AcousticMediumId, type?: string): number {
    if (type === 'cyst' || id === 'cyst_fluid' || id === 'water') return 0.28;
    if (id === 'blood') return 0.22;
    if (type === 'heterogeneous_lesion') return 0.72;
    if (type === 'solid_mass') return 0.5;
    if (id === 'bone_cortical') return 1.05;
    return 0.42;
  }

  private mediumScatterSize(id: AcousticMediumId, type?: string): number {
    if (type === 'cyst' || id === 'cyst_fluid' || id === 'water') return 2.1;
    if (id === 'blood') return 1.55;
    if (id === 'fat') return 1.45;
    if (type === 'heterogeneous_lesion') return 0.85;
    return 1.0;
  }

  private mediumHeterogeneity(id: AcousticMediumId, type?: string): number {
    if (type === 'cyst' || id === 'cyst_fluid' || id === 'water') return 0.22;
    if (id === 'blood') return 0.28;
    if (id === 'fat') return 0.35;
    if (type === 'heterogeneous_lesion') return 0.82;
    if (type === 'solid_mass') return 0.55;
    return 0.4;
  }

  private lobulation(x: number, z: number, inclusion: UltrasoundInclusionConfig): number {
    const amount =
      inclusion.type === 'solid_mass' || inclusion.type === 'heterogeneous_lesion'
        ? 0.08
        : inclusion.type === 'cyst' || inclusion.type === 'vessel'
          ? 0.05 + (inclusion.wallIrregularity ?? 0) * 0.65
          : (inclusion.wallIrregularity ?? 0) * 0.5;
    if (amount <= 0) return 0;
    const a = Math.atan2(z, x);
    return amount * (0.55 * Math.sin(a * 5.0) + 0.3 * Math.cos(a * 8.0 + 1.2) + 0.15 * Math.sin(a * 13.0));
  }

  private wallNoise(x: number, z: number, inclusion: UltrasoundInclusionConfig): number {
    return (inclusion.wallIrregularity ?? 0) * (0.55 * Math.sin(x * 8) + 0.3 * Math.cos(x * 15)) +
      (z > 0 ? 1 : -1) * (inclusion.wallAsymmetry ?? 0);
  }

  private smoothstep(a: number, b: number, x: number): number {
    const t = this.clamp01((x - a) / Math.max(1e-6, b - a));
    return t * t * (3 - 2 * t);
  }

  private fbm(x: number, y: number, octaves: number, seed: number): number {
    let v = 0;
    let amp = 0.5;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      v += this.valueNoise(x, y, seed + i * 17) * amp;
      norm += amp;
      x *= 2.02;
      y *= 1.98;
      amp *= 0.5;
    }
    return v / Math.max(1e-6, norm);
  }

  private valueNoise(x: number, y: number, seed: number): number {
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

  private hash2(x: number, y: number, seed: number): number {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }

  private clamp01(v: number): number {
    return this.clamp(v, 0, 1);
  }
}
