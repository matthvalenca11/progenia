/**
 * Pontuação educacional 0–100 para desafios e modo guiado — PBM.
 */

import {
  getPhotobioObjectiveProgress,
  isPhotobioChallengeComplete,
  type PhotobioChallengeEvalContext,
  type PhotobioChallengeId,
} from "@/config/photobioChallenges";
import { classifyPhotobioDose, PHOTOBIO_DOSE_THRESHOLDS } from "@/lib/photobioOptics";
import type { TissueInteractionResult } from "@/simulation/photobioEngine";
import type { PhotobioWavelength } from "@/lib/photobioOptics";

export interface PhotobioScoreBreakdown {
  total: number;
  objectiveBonus: number;
  doseBonus: number;
  safetyBonus: number;
  techniqueBonus: number;
  transmissionBonus: number;
  penalties: number;
  labels: string[];
}

export interface ComputePhotobioScoreInput {
  interaction: TissueInteractionResult;
  wavelength: PhotobioWavelength;
  isDragging: boolean;
  doseMap: number[];
  challengeId?: PhotobioChallengeId | null;
  challengeCtx?: PhotobioChallengeEvalContext | null;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function computeDoseMapUniformity(doseMap: number[], isDragging: boolean): number {
  if (!isDragging) return 0.55;
  const active = doseMap.filter((d) => d > 0.5);
  if (active.length < 4) return 0.35;
  const mean = active.reduce((a, b) => a + b, 0) / active.length;
  const variance = active.reduce((s, d) => s + (d - mean) ** 2, 0) / active.length;
  const cv = Math.sqrt(variance) / Math.max(mean, 0.1);
  return Math.max(0, Math.min(1, 1 - cv * 0.85));
}

function isWavelengthCoherent(
  wavelength: PhotobioWavelength,
  interaction: TissueInteractionResult,
  anatomyObese: boolean,
): boolean {
  if (anatomyObese && wavelength === 808) return true;
  if (!anatomyObese && wavelength === 660 && interaction.superficialAbsorptionIndex > 0.4) return true;
  if (interaction.muscleFluenceRatio > 0.2 && wavelength === 808) return true;
  return wavelength === 660 || wavelength === 808;
}

export function computePhotobioScore(input: ComputePhotobioScoreInput): PhotobioScoreBreakdown {
  const { interaction, wavelength, isDragging, doseMap, challengeId, challengeCtx } = input;
  const labels: string[] = [];
  let objectiveBonus = 0;
  let doseBonus = 0;
  let safetyBonus = 0;
  let techniqueBonus = 0;
  let transmissionBonus = 0;
  let penalties = 0;

  const doseZone = classifyPhotobioDose(interaction.effectiveFluence).zone;
  const { therapeuticMin, therapeuticMax } = PHOTOBIO_DOSE_THRESHOLDS;

  if (challengeId && challengeCtx) {
    const { completed, total } = getPhotobioObjectiveProgress(challengeId, challengeCtx);
    objectiveBonus = total > 0 ? (completed / total) * 45 : 0;
    if (isPhotobioChallengeComplete(challengeId, challengeCtx)) {
      objectiveBonus += 10;
      labels.push("Desafio concluído");
    } else {
      labels.push(`${completed}/${total} objetivos`);
    }
  } else {
    objectiveBonus = 18;
  }

  if (interaction.effectiveFluence >= therapeuticMin && interaction.effectiveFluence <= therapeuticMax) {
    doseBonus += 15;
    labels.push("Dose na janela terapêutica");
  } else if (interaction.effectiveFluence >= therapeuticMin * 0.7 && interaction.effectiveFluence < therapeuticMin) {
    doseBonus += 6;
  }

  if (doseZone === "saturation" || doseZone === "inhibitory") {
    penalties += 18;
    labels.push("Bioinibição / saturação");
  }

  if (!interaction.thermalWarning && interaction.thermalRiskIndex < 0.45) {
    safetyBonus += 16;
    labels.push("Irradiância segura");
  } else if (interaction.thermalRiskIndex < 0.6) {
    safetyBonus += 8;
  } else {
    penalties += 14;
    labels.push("Risco térmico elevado");
  }

  if (interaction.realDoseFactor >= 0.9) {
    techniqueBonus += 12;
    labels.push("Técnica excelente");
  } else if (interaction.realDoseFactor >= 0.75) {
    techniqueBonus += 7;
  } else {
    penalties += 8;
  }

  const uniformity = computeDoseMapUniformity(doseMap, isDragging);
  if (isDragging && uniformity >= 0.65) {
    techniqueBonus += 6;
    labels.push("Varredura uniforme");
  } else if (isDragging && uniformity < 0.4) {
    penalties += 4;
  }

  if (interaction.muscleFluenceRatio >= 0.18) {
    transmissionBonus += 8;
    labels.push("Boa transmissão muscular");
  } else if (interaction.muscleFluenceRatio >= 0.1) {
    transmissionBonus += 4;
  }

  const obeseContext = challengeCtx?.anatomyPreset === "obese";
  if (isWavelengthCoherent(wavelength, interaction, obeseContext)) {
    transmissionBonus += 4;
  } else if (obeseContext && wavelength === 660) {
    penalties += 6;
  }

  const total = clampScore(20 + objectiveBonus + doseBonus + safetyBonus + techniqueBonus + transmissionBonus - penalties);

  return {
    total,
    objectiveBonus,
    doseBonus,
    safetyBonus,
    techniqueBonus,
    transmissionBonus,
    penalties,
    labels,
  };
}

export function photobioScoreTone(score: number): "excellent" | "good" | "fair" | "low" {
  if (score >= 85) return "excellent";
  if (score >= 65) return "good";
  if (score >= 45) return "fair";
  return "low";
}

export const PHOTOBIO_SCORE_TONE_LABELS: Record<ReturnType<typeof photobioScoreTone>, string> = {
  excellent: "Excelente",
  good: "Bom",
  fair: "Em progresso",
  low: "Precisa ajustar",
};
