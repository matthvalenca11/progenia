/**
 * Física educacional compartilhada — feixe terapêutico (motor + visual 3D)
 * Aproximação didática, não clínica. v ≈ 1540 m/s em tecido mole.
 */

import type { TherapeuticTransducerType } from "@/config/therapeuticTransducerDefinitions";
import { getTransducerDefinition } from "@/config/therapeuticTransducerDefinitions";
import type { TransducerBeamProfile } from "@/types/ultrasoundTherapyConfig";

export const TISSUE_SOUND_SPEED_M_S = 1540;
export const WAVELENGTH_CM_PER_MHZ = 0.154;

export interface AcousticPhysicsInput {
  frequencyMHz: number;
  eraCm2: number;
  transducerType: TherapeuticTransducerType;
  beamProfile: TransducerBeamProfile;
  focusDepthCm: number;
}

export interface RelativeIntensityAtDepthInput extends AcousticPhysicsInput {
  depthCm: number;
  /** Fator linear de atenuação tecidual I/I₀ (0–1), default 1 */
  tissueAttenuationLinear?: number;
}

export interface AcousticDepthSample {
  depthCm: number;
  relativeIntensity: number;
  tissueKind: string;
  heatSource: number;
}

export interface AcousticProfileSummary {
  equivalentDiameterCm: number;
  wavelengthCm: number;
  nearFieldCm: number;
  focusDepthCm: number;
  focusGain: number;
  beamProfile: TransducerBeamProfile;
  transducerType: TherapeuticTransducerType;
  depthSamples: AcousticDepthSample[];
}

export function getEquivalentDiameterCm(
  eraCm2: number,
  _transducerType: TherapeuticTransducerType = "planar_circular",
): number {
  const safeEra = Math.max(eraCm2, 0.01);
  return Math.sqrt(safeEra / Math.PI) * 2;
}

export function getWavelengthCm(frequencyMHz: number): number {
  return WAVELENGTH_CM_PER_MHZ / Math.max(0.5, frequencyMHz);
}

export function getNearFieldLengthCm(
  diameterCm: number,
  frequencyMHz: number,
  transducerType: TherapeuticTransducerType = "planar_circular",
): number {
  const lambda = getWavelengthCm(frequencyMHz);
  const def = getTransducerDefinition(transducerType);
  const nearScale = def.beam.nearFieldScale ?? 1;
  const n = ((diameterCm * diameterCm) / (4 * lambda)) * nearScale;
  return Math.max(0.4, Math.min(4.5, n));
}

export function resolveFocusDepthCm(
  focusDepth: number | undefined,
  frequencyMHz: number,
  beamProfile: TransducerBeamProfile,
  transducerType: TherapeuticTransducerType,
): number {
  if (focusDepth != null && focusDepth > 0) {
    return focusDepth;
  }
  const def = getTransducerDefinition(transducerType);
  if (def.defaultFocusDepth != null) {
    return def.defaultFocusDepth;
  }
  if (beamProfile === "focused") {
    return Math.max(1.2, Math.min(4.5, 2.8 / frequencyMHz));
  }
  return 2.5;
}

/** Meio-ângulo de divergência far-field (rad): sin θ ≈ 1,22 λ / D */
export function getFarFieldHalfAngleRad(diameterCm: number, frequencyMHz: number): number {
  const lambda = getWavelengthCm(frequencyMHz);
  const d = Math.max(0.1, diameterCm);
  return Math.atan(Math.min(0.55, (1.22 * lambda) / d));
}

/** Raio do feixe (-6 dB) a uma profundidade (cm) */
export function getBeamRadiusAtDepthCm(
  depthCm: number,
  input: AcousticPhysicsInput,
): number {
  const diameter = getEquivalentDiameterCm(input.eraCm2, input.transducerType);
  const faceR = diameter / 2;
  const d = Math.max(0, depthCm);
  const def = getTransducerDefinition(input.transducerType);
  const nearField = getNearFieldLengthCm(diameter, input.frequencyMHz, input.transducerType);

  if (input.beamProfile === "focused") {
    const waistR = faceR * (def.beam.waistRatio ?? 0.24);
    const f = Math.max(input.focusDepthCm, 0.15);

    if (d <= f) {
      const t = d / f;
      const taper = t * t * (3 - 2 * t);
      return faceR - (faceR - waistR) * taper;
    }

    const post = d - f;
    const angle = getFarFieldHalfAngleRad(diameter, input.frequencyMHz);
    return waistR + post * Math.tan(angle) * 1.08;
  }

  if (d <= nearField) {
    return faceR * 1.02;
  }

  const angle = getFarFieldHalfAngleRad(diameter, input.frequencyMHz);
  return faceR * 1.02 + (d - nearField) * Math.tan(angle);
}

/**
 * Fator de divergência geométrica (≤ 1) após o campo próximo — pistão circular aproximado.
 */
export function getBeamDivergenceFactor(
  depthCm: number,
  nearFieldCm: number,
  _transducerType: TherapeuticTransducerType,
): number {
  const d = Math.max(0, depthCm);
  if (d <= nearFieldCm) {
    return 1;
  }

  const farDepth = d - nearFieldCm;
  const spreadRate = 0.105;
  const radiusRatio = 1 + farDepth * spreadRate;
  return 1 / (radiusRatio * radiusRatio);
}

/**
 * Ganho gaussiano em torno da profundidade focal (feixe convergente / lente acústica).
 */
export function getFocusedGain(
  depthCm: number,
  focusDepthCm: number,
  beamProfile: TransducerBeamProfile,
  transducerType: TherapeuticTransducerType,
): number {
  if (beamProfile !== "focused") {
    return 1;
  }

  const isConvergentLens = transducerType === "focused_convergent";
  const sigma = focusDepthCm * (isConvergentLens ? 0.2 : 0.32);
  const peakGain = isConvergentLens ? 2.8 : 2.0;
  const dist = depthCm - focusDepthCm;
  const gaussian = Math.exp(-0.5 * (dist / Math.max(sigma, 0.12)) ** 2);

  const preFocusRamp =
    depthCm < focusDepthCm * 0.4
      ? 0.6 + 0.4 * (depthCm / Math.max(focusDepthCm * 0.4, 0.05))
      : 1;

  return 1 + (peakGain - 1) * gaussian * preFocusRamp;
}

/**
 * Geometria do feixe para aquecimento — focalizado pode exceder 1 (ganho na zona focal).
 */
export function getThermalBeamGeometryFactor(
  depthCm: number,
  input: AcousticPhysicsInput,
): number {
  const diameter = getEquivalentDiameterCm(input.eraCm2, input.transducerType);
  const nearField = getNearFieldLengthCm(
    diameter,
    input.frequencyMHz,
    input.transducerType,
  );

  if (input.beamProfile !== "focused") {
    return getBeamDivergenceFactor(depthCm, nearField, input.transducerType);
  }

  const focus = getFocusedGain(
    depthCm,
    input.focusDepthCm,
    input.beamProfile,
    input.transducerType,
  );
  const faceR = diameter / 2;
  const def = getTransducerDefinition(input.transducerType);
  const waistR = faceR * (def.beam.waistRatio ?? 0.24);
  const beamR = Math.max(getBeamRadiusAtDepthCm(depthCm, input), waistR * 0.35);
  const peakConv = (faceR / waistR) ** 2;
  const convergence = Math.min(peakConv, (faceR / beamR) ** 2);
  const normalizedConv = convergence / Math.max(peakConv, 1);

  return Math.min(3.8, normalizedConv * focus * 1.08);
}

/** Fator geométrico do feixe (divergência × foco), sem atenuação tecidual */
export function getBeamGeometryFactor(
  depthCm: number,
  input: AcousticPhysicsInput,
): number {
  const diameter = getEquivalentDiameterCm(input.eraCm2, input.transducerType);
  const nearField = getNearFieldLengthCm(diameter, input.frequencyMHz, input.transducerType);

  if (input.beamProfile === "focused") {
    const focus = getFocusedGain(
      depthCm,
      input.focusDepthCm,
      input.beamProfile,
      input.transducerType,
    );
    const faceR = diameter / 2;
    const def = getTransducerDefinition(input.transducerType);
    const waistR = faceR * (def.beam.waistRatio ?? 0.24);
    const beamR = Math.max(getBeamRadiusAtDepthCm(depthCm, input), waistR * 0.5);
    const convergence = Math.min(3.2, (faceR / beamR) ** 2);
    const peakConv = (faceR / waistR) ** 2;
    const normalizedConv = convergence / peakConv;
    return Math.min(1, normalizedConv * focus);
  }

  return getBeamDivergenceFactor(depthCm, nearField, input.transducerType);
}

/** Intensidade relativa I/I₀ (atenuação tecidual × divergência × foco × bulk simplificado) */
export function getRelativeIntensityAtDepth(input: RelativeIntensityAtDepthInput): number {
  const tissueAtt = input.tissueAttenuationLinear ?? 1;
  const geoFactor = getBeamGeometryFactor(input.depthCm, input);

  const alpha = 0.35 + input.frequencyMHz * 0.22;
  const bulkAtten = Math.exp(-2 * alpha * input.depthCm * 0.35);

  return tissueAtt * geoFactor * bulkAtten;
}

export interface BuildAcousticProfileOptions extends AcousticPhysicsInput {
  maxDepthCm?: number;
  stepCm?: number;
  getTissueAttenuationLinear: (depthCm: number) => number;
  getTissueKindAtDepth: (depthCm: number) => string;
  getAbsorptionCoeff: (depthCm: number) => number;
}

export function buildAcousticProfile(options: BuildAcousticProfileOptions): AcousticProfileSummary {
  const {
    frequencyMHz,
    eraCm2,
    transducerType,
    beamProfile,
    focusDepthCm,
    maxDepthCm = 6,
    stepCm = 0.2,
    getTissueAttenuationLinear,
    getTissueKindAtDepth,
    getAbsorptionCoeff,
  } = options;

  const equivalentDiameterCm = getEquivalentDiameterCm(eraCm2, transducerType);
  const wavelengthCm = getWavelengthCm(frequencyMHz);
  const nearFieldCm = getNearFieldLengthCm(
    equivalentDiameterCm,
    frequencyMHz,
    transducerType,
  );
  const focusGain = getFocusedGain(focusDepthCm, focusDepthCm, beamProfile, transducerType);

  const depthSamples: AcousticDepthSample[] = [];
  for (let d = 0; d <= maxDepthCm + 0.001; d += stepCm) {
    const depthCm = Math.round(d * 100) / 100;
    const tissueAtt = getTissueAttenuationLinear(depthCm);
    const relativeIntensity =
      tissueAtt * getBeamGeometryFactor(depthCm, options);
    const absorption = getAbsorptionCoeff(depthCm);
    depthSamples.push({
      depthCm,
      relativeIntensity,
      tissueKind: getTissueKindAtDepth(depthCm),
      heatSource: relativeIntensity * absorption,
    });
  }

  return {
    equivalentDiameterCm,
    wavelengthCm,
    nearFieldCm,
    focusDepthCm,
    focusGain,
    beamProfile,
    transducerType,
    depthSamples,
  };
}
