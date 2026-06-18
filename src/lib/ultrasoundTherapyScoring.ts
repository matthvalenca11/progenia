/**
 * Pontuação educacional 0–100 para desafios e modo guiado.
 */

import type { UltrasoundTherapyConfig } from "@/types/ultrasoundTherapyConfig";
import type { UltrasoundTherapyResult } from "@/simulation/ultrasoundTherapyEngine";
import type { TherapyChallengeId } from "@/config/ultrasoundTherapyChallenges";
import {
  getObjectiveProgress,
  type ChallengeEvalContext,
  isChallengeComplete,
} from "@/config/ultrasoundTherapyChallenges";

export interface TherapyScoreBreakdown {
  total: number;
  objectiveBonus: number;
  safetyBonus: number;
  techniqueBonus: number;
  penalties: number;
  labels: string[];
}

export interface ComputeScoreInput {
  config: UltrasoundTherapyConfig;
  result: UltrasoundTherapyResult;
  challengeId?: TherapyChallengeId | null;
  challengeCtx?: ChallengeEvalContext | null;
  isAblativeGoal?: boolean;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function computeTherapyScore(input: ComputeScoreInput): TherapyScoreBreakdown {
  const { config, result, challengeId, challengeCtx, isAblativeGoal = false } = input;
  const labels: string[] = [];
  let objectiveBonus = 0;
  let safetyBonus = 0;
  let techniqueBonus = 0;
  let penalties = 0;

  if (challengeId && challengeCtx) {
    const { completed, total } = getObjectiveProgress(challengeId, challengeCtx);
    objectiveBonus = total > 0 ? (completed / total) * 45 : 0;
    if (isChallengeComplete(challengeId, challengeCtx)) {
      objectiveBonus += 10;
      labels.push("Desafio concluído");
    } else {
      labels.push(`${completed}/${total} objetivos`);
    }
  } else {
    objectiveBonus = 20;
  }

  if (result.targetTemp >= 40 && result.targetTemp <= 43) {
    techniqueBonus += 12;
    labels.push("Alvo terapêutico adequado");
  } else if (result.targetTemp >= 38 && result.targetTemp < 40) {
    techniqueBonus += 6;
  }

  if (result.risk === "low") {
    safetyBonus += 18;
    labels.push("Risco baixo");
  } else if (result.risk === "medium") {
    safetyBonus += 10;
    labels.push("Risco moderado");
  } else {
    penalties += 15;
    labels.push("Risco alto");
  }

  if (config.coupling === "good") {
    techniqueBonus += 8;
  } else {
    penalties += 8;
  }

  if (config.movement === "scanning") {
    techniqueBonus += 8;
  } else if (config.intensity > 1.8) {
    penalties += 6;
  }

  if (result.maxTemp > 48) {
    penalties += 20;
  } else if (result.maxTemp > 45) {
    penalties += 12;
  } else if (result.maxTemp <= 43) {
    safetyBonus += 5;
  }

  if (result.periostealRisk > 0.5) {
    penalties += 15;
  } else if (result.periostealRisk > 0.3) {
    penalties += 8;
  } else if (result.periostealRisk < 0.15) {
    safetyBonus += 5;
  }

  const ablationIndex = result.physiologyResponse?.ablationIndex ?? 0;
  if (!isAblativeGoal && ablationIndex > 0.35) {
    penalties += 12;
    labels.push("Ablação educacional não era o objetivo");
  } else if (isAblativeGoal && ablationIndex > 0.25) {
    techniqueBonus += 8;
  }

  if (Math.abs(result.maxTempDepth - result.effectiveDepth) < 0.8) {
    techniqueBonus += 5;
  }

  const total = clampScore(25 + objectiveBonus + safetyBonus + techniqueBonus - penalties);

  return {
    total,
    objectiveBonus,
    safetyBonus,
    techniqueBonus,
    penalties,
    labels,
  };
}

export function scoreTone(score: number): "excellent" | "good" | "fair" | "low" {
  if (score >= 85) return "excellent";
  if (score >= 65) return "good";
  if (score >= 45) return "fair";
  return "low";
}

export const SCORE_TONE_LABELS: Record<ReturnType<typeof scoreTone>, string> = {
  excellent: "Excelente",
  good: "Bom",
  fair: "Em progresso",
  low: "Precisa ajustar",
};
