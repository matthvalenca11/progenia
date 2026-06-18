/**
 * Comparação pedagógica entre duas simulações de ultrassom terapêutico.
 */

import type { UltrasoundTherapyConfig } from "@/types/ultrasoundTherapyConfig";
import type { UltrasoundTherapyResult } from "@/simulation/ultrasoundTherapyEngine";

export interface UltrasoundTherapySnapshot {
  id: string;
  label: string;
  createdAt: number;
  config: UltrasoundTherapyConfig;
  result: UltrasoundTherapyResult;
}

export interface UltrasoundComparisonDeltas {
  deltaPowerW: number;
  deltaEnergyJ: number;
  deltaEffectiveDepth: number;
  deltaPenetrationDepth: number;
  deltaSurfaceTemp: number;
  deltaTargetTemp: number;
  deltaMaxTemp: number;
  deltaThermalDose: number;
  deltaRisk: number;
  deltaPeriostealRisk: number;
  deltaCavitationIndex: number;
  deltaAblationIndex: number;
  /** Distância focal → pico térmico (menor = foco mais alinhado) */
  deltaFocusAlignment: number;
}

export interface ComparisonInsight {
  id: string;
  message: string;
  tone: "positive" | "negative" | "neutral";
}

const RISK_SCORE: Record<UltrasoundTherapyResult["risk"], number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function cavitationIndex(result: UltrasoundTherapyResult): number {
  return result.interactionMap?.summary.maxCavitationIndex ?? 0;
}

function ablationIndex(result: UltrasoundTherapyResult): number {
  return result.physiologyResponse?.ablationIndex ?? 0;
}

function focusAlignment(config: UltrasoundTherapyConfig, result: UltrasoundTherapyResult): number {
  const focus = config.focusDepth ?? result.effectiveDepth;
  return Math.abs(result.maxTempDepth - focus);
}

export function suggestSnapshotLabel(config: UltrasoundTherapyConfig): string {
  if (config.coupling === "poor") return "Acoplamento ruim";
  if (config.beamProfile === "focused" || config.transducerType === "focused_convergent") {
    return `Focalizado convergente (${(config.focusDepth ?? 2.5).toFixed(1)} cm)`;
  }
  if (config.frequency <= 1.2) return "1 MHz profundo";
  if (config.frequency >= 2.8) return "3 MHz superficial";
  if (config.movement === "scanning" && config.mode === "pulsed") {
    return `${config.frequency.toFixed(1)} MHz pulsado`;
  }
  return `${config.frequency.toFixed(1)} MHz · ${config.intensity.toFixed(1)} W/cm²`;
}

export function compareUltrasoundResults(
  a: UltrasoundTherapyResult,
  b: UltrasoundTherapyResult,
  configA?: UltrasoundTherapyConfig,
  configB?: UltrasoundTherapyConfig,
): UltrasoundComparisonDeltas {
  return {
    deltaPowerW: b.powerW - a.powerW,
    deltaEnergyJ: b.energyJ - a.energyJ,
    deltaEffectiveDepth: b.effectiveDepth - a.effectiveDepth,
    deltaPenetrationDepth: b.penetrationDepth - a.penetrationDepth,
    deltaSurfaceTemp: b.surfaceTemp - a.surfaceTemp,
    deltaTargetTemp: b.targetTemp - a.targetTemp,
    deltaMaxTemp: b.maxTemp - a.maxTemp,
    deltaThermalDose: b.thermalDose - a.thermalDose,
    deltaRisk: RISK_SCORE[b.risk] - RISK_SCORE[a.risk],
    deltaPeriostealRisk: b.periostealRisk - a.periostealRisk,
    deltaCavitationIndex: cavitationIndex(b) - cavitationIndex(a),
    deltaAblationIndex: ablationIndex(b) - ablationIndex(a),
    deltaFocusAlignment:
      configA && configB
        ? focusAlignment(configB, b) - focusAlignment(configA, a)
        : b.maxTempDepth - a.maxTempDepth,
  };
}

const THRESH = {
  depth: 0.15,
  temp: 0.4,
  risk: 0.05,
  focus: 0.25,
  cavitation: 0.05,
} as const;

export function buildComparisonInsights(
  snapshotA: Pick<UltrasoundTherapySnapshot, "label" | "config" | "result">,
  snapshotB: Pick<UltrasoundTherapySnapshot, "label" | "config" | "result">,
): ComparisonInsight[] {
  const deltas = compareUltrasoundResults(
    snapshotA.result,
    snapshotB.result,
    snapshotA.config,
    snapshotB.config,
  );
  const insights: ComparisonInsight[] = [];

  if (Math.abs(deltas.deltaEffectiveDepth) >= THRESH.depth) {
    insights.push({
      id: "effective-depth",
      message:
        deltas.deltaEffectiveDepth > 0
          ? `A profundidade efetiva aumentou (${snapshotA.label} → ${snapshotB.label}).`
          : `A profundidade efetiva diminuiu — energia ficou mais superficial.`,
      tone: deltas.deltaEffectiveDepth > 0 ? "positive" : "neutral",
    });
  }

  if (Math.abs(deltas.deltaSurfaceTemp) >= THRESH.temp) {
    insights.push({
      id: "surface-temp",
      message:
        deltas.deltaSurfaceTemp < 0
          ? "A temperatura superficial reduziu — menos calor preso na pele."
          : "A temperatura superficial subiu — revise acoplamento ou intensidade.",
      tone: deltas.deltaSurfaceTemp < 0 ? "positive" : "negative",
    });
  }

  if (Math.abs(deltas.deltaTargetTemp) >= THRESH.temp) {
    insights.push({
      id: "target-temp",
      message:
        deltas.deltaTargetTemp > 0
          ? "O alvo aqueceu mais — verifique se ainda está na faixa terapêutica segura."
          : "O alvo esfriou em relação ao snapshot anterior.",
      tone: deltas.deltaTargetTemp > 0 ? "neutral" : "positive",
    });
  }

  if (Math.abs(deltas.deltaPeriostealRisk) >= THRESH.risk) {
    insights.push({
      id: "periosteal",
      message:
        deltas.deltaPeriostealRisk < 0
          ? "O risco periosteal melhorou — menos energia refletida no osso."
          : "O risco periosteal piorou — osso pode estar recebendo mais reflexão.",
      tone: deltas.deltaPeriostealRisk < 0 ? "positive" : "negative",
    });
  }

  if (deltas.deltaRisk !== 0) {
    insights.push({
      id: "overall-risk",
      message:
        deltas.deltaRisk < 0
          ? "O risco geral diminuiu com a nova configuração."
          : "O risco geral aumentou — revise parâmetros ou técnica.",
      tone: deltas.deltaRisk < 0 ? "positive" : "negative",
    });
  }

  if (Math.abs(deltas.deltaFocusAlignment) >= THRESH.focus) {
    insights.push({
      id: "focus",
      message:
        deltas.deltaFocusAlignment < 0
          ? "O foco ficou mais próximo do alvo térmico."
          : "O pico térmico se afastou do foco configurado.",
      tone: deltas.deltaFocusAlignment < 0 ? "positive" : "negative",
    });
  }

  if (Math.abs(deltas.deltaCavitationIndex) >= THRESH.cavitation) {
    insights.push({
      id: "cavitation",
      message:
        deltas.deltaCavitationIndex > 0
          ? "Índice de cavitação (ilustrativo) subiu — frequência/intensidade mais agressivas."
          : "Cavitação modelada reduziu — feixe menos agressivo superficialmente.",
      tone: deltas.deltaCavitationIndex > 0 ? "negative" : "positive",
    });
  }

  if (Math.abs(deltas.deltaAblationIndex) >= 0.08) {
    insights.push({
      id: "ablation",
      message:
        deltas.deltaAblationIndex > 0
          ? "Índice de ablação educacional aumentou — cuidado com dose e foco."
          : "Ablação educacional modelada diminuiu.",
      tone: deltas.deltaAblationIndex > 0 ? "negative" : "positive",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "similar",
      message: "As duas configurações produziram resultados muito parecidos — tente mudar frequência, acoplamento ou movimento.",
      tone: "neutral",
    });
  }

  return insights;
}

export function formatDelta(value: number, unit: string, decimals = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)} ${unit}`;
}
