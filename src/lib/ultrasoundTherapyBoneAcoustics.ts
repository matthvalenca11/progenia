/**
 * Reflexão e sombreamento acústico em interfaces de alta impedância (osso).
 * Modelo educacional: R ≈ ((Z₂−Z₁)/(Z₂+Z₁))² — músculo (~1,7) vs osso (~7,8) → R ≈ 0,41.
 */

import type { AnatomicalScenario } from "@/types/ultrasoundTherapyConfig";
import { getBoneStartDepth } from "@/lib/ultrasoundTherapyStack";
import type { StackCustomThicknesses } from "@/lib/ultrasoundTherapyStack";
import type { ResolvedMixedLayer } from "@/lib/ultrasoundTherapyStackConfig";

export const TISSUE_ACOUSTIC_WIDTH_CM = 20;
export const TISSUE_ACOUSTIC_HALF_W = TISSUE_ACOUSTIC_WIDTH_CM / 2;

/** Coeficiente de reflexão de intensidade músculo → osso (heurístico). */
export const MUSCLE_BONE_REFLECTION = 0.58;

export interface BoneAcousticEffect {
  /** Multiplicador de transmissão forward (0–1). */
  transmission: number;
  /** Contribuição de reflexão local (0–1). */
  reflection: number;
  /** Proximidade a interface de impedância (0–1). */
  interfaceProximity: number;
  /** Dentro de região óssea. */
  inBone: boolean;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function mixedLayerBoundaryXcm(division: number): number {
  return (division / 100) * TISSUE_ACOUSTIC_WIDTH_CM - TISSUE_ACOUSTIC_HALF_W;
}

/**
 * Efeito acústico do osso em um ponto (profundidade, posição lateral).
 * Cobre osso horizontal (STACK) e interface vertical (camada mista).
 */
export function evaluateBoneAcousticEffect(
  depthCm: number,
  worldXcm: number,
  scenario: AnatomicalScenario,
  customThicknesses?: StackCustomThicknesses,
  mixedLayer?: ResolvedMixedLayer,
): BoneAcousticEffect {
  let transmission = 1;
  let reflection = 0;
  let interfaceProximity = 0;
  let inBone = false;

  const stackBoneDepth = getBoneStartDepth(scenario, customThicknesses);
  const interfaceDepth = mixedLayer?.depth ?? stackBoneDepth;

  // ── Camada mista: interface vertical músculo | osso ──
  if (mixedLayer && depthCm >= mixedLayer.depth - 0.1) {
    const boundaryX = mixedLayerBoundaryXcm(mixedLayer.division);
    const distToBoundary = worldXcm - boundaryX;

    if (distToBoundary > 0.06) {
      inBone = true;
      transmission *= 0.035;
    } else if (distToBoundary > -0.28) {
      const prox = clamp01(1 - Math.max(0, -distToBoundary) / 0.28);
      interfaceProximity = Math.max(interfaceProximity, prox);
      const ifaceReflect = prox * MUSCLE_BONE_REFLECTION;
      reflection = Math.max(reflection, ifaceReflect);
      if (distToBoundary > 0) {
        inBone = true;
        transmission *= 0.06 + (1 - prox) * 0.08;
      }
    }
  }

  // ── Interface horizontal músculo → osso (STACK) — camada mista usa só interface vertical ──
  if (interfaceDepth != null && !mixedLayer) {
    const distBelow = depthCm - interfaceDepth;

    if (distBelow > 0.1) {
      inBone = true;
      transmission *= 0.04;
    } else if (distBelow > -0.12 && distBelow <= 0.55) {
      const prox = clamp01(1 - Math.abs(distBelow) / 0.42);
      interfaceProximity = Math.max(interfaceProximity, prox);
      reflection = Math.max(reflection, prox * MUSCLE_BONE_REFLECTION * 0.95);
      if (distBelow > 0.08) {
        inBone = true;
        transmission *= 0.05 + (1 - prox) * 0.1;
      }
    }

    // Reflexão para cima: energia incidente repelida acima da interface (só lado músculo)
    if (distBelow < 0 && distBelow > -0.55 && !inBone) {
      const upwardProx = clamp01(1 - Math.abs(distBelow) / 0.5);
      reflection = Math.max(reflection, upwardProx * MUSCLE_BONE_REFLECTION * 0.55);
    }
  }

  return {
    transmission: clamp01(transmission),
    reflection: clamp01(reflection),
    interfaceProximity: clamp01(interfaceProximity),
    inBone,
  };
}

/** Reflexão ascendente a partir da interface óssea (evita faixa branca; realça retorno). */
export function boneUpwardReflectionFromEffect(
  depthCm: number,
  lateralCm: number,
  interfaceDepth: number | null,
  beamRadiusCm: number,
  incidentIntensity: number,
  boneFx: BoneAcousticEffect,
  boneReflectCoeff: number,
): number {
  if (interfaceDepth == null || boneReflectCoeff < 0.04) return 0;
  if (boneFx.inBone) return 0;

  const delta = interfaceDepth - depthCm;
  if (delta < 0 || delta > 0.65) return 0;

  const upward = Math.exp(-delta / 0.2) * (1 - delta / 0.75);
  const lateral = Math.exp(-0.5 * (lateralCm / Math.max(0.05, beamRadiusCm)) ** 2);
  const ifaceGain = 0.35 + boneFx.interfaceProximity * 0.65;

  return clamp01(
    incidentIntensity *
      Math.max(boneReflectCoeff, boneFx.reflection) *
      upward *
      lateral *
      ifaceGain *
      0.55,
  );
}
