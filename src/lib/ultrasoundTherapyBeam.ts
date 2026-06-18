/**
 * Geometria do feixe acústico terapêutico — delega física compartilhada ao motor
 */

import type { TherapeuticTransducerType } from "@/config/therapeuticTransducerDefinitions";
import { getTransducerDefinition } from "@/config/therapeuticTransducerDefinitions";
import type { TransducerBeamProfile } from "@/types/ultrasoundTherapyConfig";
import {
  getBeamGeometryFactor,
  getBeamRadiusAtDepthCm,
  getEquivalentDiameterCm,
  getNearFieldLengthCm,
  getRelativeIntensityAtDepth,
  getWavelengthCm,
  resolveFocusDepthCm,
  type AcousticPhysicsInput,
} from "@/lib/ultrasoundTherapyPhysics";

export type { TransducerBeamProfile };

export interface BeamGeometryParams {
  era: number;
  frequency: number;
  beamProfile: TransducerBeamProfile;
  transducerType?: TherapeuticTransducerType;
  /** Profundidade focal (cm) — só para perfil focalizado */
  focusDepth?: number;
  /** Profundidade máxima de visualização (cm) */
  maxDepth: number;
}

function toAcousticInput(params: BeamGeometryParams): AcousticPhysicsInput {
  const transducerType = params.transducerType ?? "planar_circular";
  return {
    frequencyMHz: params.frequency,
    eraCm2: params.era,
    transducerType,
    beamProfile: params.beamProfile,
    focusDepthCm: resolveFocusDepthCm(
      params.focusDepth,
      params.frequency,
      params.beamProfile,
      transducerType,
    ),
  };
}

export function faceRadiusFromEra(era: number): number {
  return Math.sqrt(era / Math.PI);
}

export function wavelengthCm(frequencyMhz: number): number {
  return getWavelengthCm(frequencyMhz);
}

/** Comprimento do campo próximo: N ≈ D² / (4λ) */
export function nearFieldLengthCm(
  era: number,
  frequencyMhz: number,
  transducerType: TherapeuticTransducerType = "planar_circular",
): number {
  const diameter = getEquivalentDiameterCm(era, transducerType);
  return getNearFieldLengthCm(diameter, frequencyMhz, transducerType);
}

/** Meio-ângulo de divergência far-field (rad): sin θ ≈ 1,22 λ / D */
export function farFieldHalfAngleRad(era: number, frequencyMhz: number): number {
  const diameter = Math.max(0.1, faceRadiusFromEra(era) * 2);
  const lambda = getWavelengthCm(frequencyMhz);
  return Math.atan(Math.min(0.55, (1.22 * lambda) / diameter));
}

export function defaultFocusDepthCm(
  frequencyMhz: number,
  beamProfile: TransducerBeamProfile = "focused",
  transducerType: TherapeuticTransducerType = "planar_circular",
): number {
  return resolveFocusDepthCm(undefined, frequencyMhz, beamProfile, transducerType);
}

/** Raio do feixe (-6 dB) a uma profundidade (cm, positiva para dentro do tecido) */
export function beamRadiusAtDepth(depth: number, params: BeamGeometryParams): number {
  return getBeamRadiusAtDepthCm(depth, toAcousticInput(params));
}

/** Escala lateral do feixe no plano XZ (retangular → elíptico) */
export function beamLateralScale(params: BeamGeometryParams): { x: number; z: number } {
  const def = getTransducerDefinition(params.transducerType ?? "planar_circular");
  if (def.beam.lateralScale) {
    return { x: def.beam.lateralScale[0], z: def.beam.lateralScale[1] };
  }
  return { x: 1, z: 1 };
}

/** Intensidade relativa simplificada para colorir cortes (atenuação + geometria) */
export function relativeBeamIntensity(
  depth: number,
  params: BeamGeometryParams,
  surfaceIntensity = 1,
): number {
  const acoustic = toAcousticInput(params);
  return (
    surfaceIntensity *
    getRelativeIntensityAtDepth({
      depthCm: depth,
      ...acoustic,
      tissueAttenuationLinear: 1,
    })
  );
}

export interface BeamSliceSample {
  depth: number;
  radius: number;
  intensity: number;
}

/** Amostras para discos de corte ao longo do feixe */
export function sampleBeamSlices(params: BeamGeometryParams, count = 8): BeamSliceSample[] {
  const transducerType = params.transducerType ?? "planar_circular";
  const near = nearFieldLengthCm(params.era, params.frequency, transducerType);
  const acoustic = toAcousticInput(params);
  const focal = params.beamProfile === "focused" ? acoustic.focusDepthCm : null;

  const keyDepths = [
    0.04,
    near * 0.45,
    near,
    ...(focal != null ? [focal] : []),
    params.maxDepth * 0.4,
    params.maxDepth * 0.65,
    params.maxDepth * 0.9,
  ].filter((d) => d > 0 && d <= params.maxDepth);

  const unique = [...new Set(keyDepths.map((d) => Math.round(d * 100) / 100))].sort(
    (a, b) => a - b,
  );
  const picked =
    unique.length <= count
      ? unique
      : Array.from({ length: count }, (_, i) => {
          const idx = Math.round((i / Math.max(1, count - 1)) * (unique.length - 1));
          return unique[idx];
        });

  return picked.map((depth) => ({
    depth,
    radius: beamRadiusAtDepth(depth, params),
    intensity: relativeBeamIntensity(depth, params),
  }));
}

/** Amostras a partir do perfil acústico calculado pelo motor (sincronizado) */
export function sampleBeamSlicesFromAcousticProfile(
  params: BeamGeometryParams,
  depthSamples: Array<{ depthCm: number; relativeIntensity: number }>,
  count = 8,
): BeamSliceSample[] {
  if (depthSamples.length === 0) {
    return sampleBeamSlices(params, count);
  }

  const maxDepth = params.maxDepth;
  const inRange = depthSamples.filter((s) => s.depthCm > 0 && s.depthCm <= maxDepth);
  if (inRange.length <= count) {
    return inRange.map((s) => ({
      depth: s.depthCm,
      radius: beamRadiusAtDepth(s.depthCm, params),
      intensity: s.relativeIntensity,
    }));
  }

  return Array.from({ length: count }, (_, i) => {
    const idx = Math.round((i / Math.max(1, count - 1)) * (inRange.length - 1));
    const sample = inRange[idx];
    return {
      depth: sample.depthCm,
      radius: beamRadiusAtDepth(sample.depthCm, params),
      intensity: sample.relativeIntensity,
    };
  });
}

export { getBeamGeometryFactor, toAcousticInput };
