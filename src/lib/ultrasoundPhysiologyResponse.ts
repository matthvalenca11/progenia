/**
 * Resposta fisiológica educacional heurística — não predição clínica.
 */

import type { UltrasoundInteractionMap } from "@/lib/ultrasoundTherapyInteractionMap";
import type { UltrasoundTherapyResult } from "@/simulation/ultrasoundTherapyEngine";
import type { UltrasoundTherapyConfig } from "@/types/ultrasoundTherapyConfig";
import { getPerfusionVisualProfile } from "@/types/ultrasoundTherapyConfig";

export type UltrasoundPrimaryPhysiologyResponse =
  | "none"
  | "mild-heating"
  | "hyperemia"
  | "deep-thermal-effect"
  | "periosteal-risk"
  | "cavitation-risk"
  | "thermal-damage"
  | "ablation";

export type UltrasoundPhysiologyResponse = {
  hyperemiaIndex: number;
  edemaIndex: number;
  nociceptionIndex: number;
  periostealPainIndex: number;
  muscleThermalStressIndex: number;
  collagenDenaturationIndex: number;
  coagulationIndex: number;
  ablationIndex: number;
  cavitationRiskIndex: number;
  reversibleChangeIndex: number;
  irreversibleDamageIndex: number;
  summary: {
    primaryResponse: UltrasoundPrimaryPhysiologyResponse;
    explanation: string;
  };
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export const PRIMARY_PHYSIOLOGY_LABELS: Record<UltrasoundPrimaryPhysiologyResponse, string> = {
  none: "Sem alteração relevante",
  "mild-heating": "Aquecimento leve",
  hyperemia: "Aquecimento superficial",
  "deep-thermal-effect": "Aquecimento muscular profundo",
  "periosteal-risk": "Irritação periosteal",
  "cavitation-risk": "Cavitação estimada",
  "thermal-damage": "Dano térmico",
  ablation: "Superaquecimento focal",
};

export interface BuildUltrasoundPhysiologyResponseInput {
  result: UltrasoundTherapyResult;
  interactionMap?: UltrasoundInteractionMap;
  config: UltrasoundTherapyConfig;
}

function resolvePrimaryResponse(
  indices: Omit<
    UltrasoundPhysiologyResponse,
    "summary" | "reversibleChangeIndex" | "irreversibleDamageIndex"
  >,
): { primaryResponse: UltrasoundPrimaryPhysiologyResponse; explanation: string } {
  const thermalDamageScore = Math.max(
    indices.collagenDenaturationIndex,
    indices.coagulationIndex,
    indices.muscleThermalStressIndex * 0.85,
  );
  const cavitationForRanking =
    thermalDamageScore > 0.14 || indices.ablationIndex > 0.14
      ? indices.cavitationRiskIndex * 0.72
      : indices.cavitationRiskIndex;

  const ranked: Array<{ key: UltrasoundPrimaryPhysiologyResponse; score: number; explanation: string }> = [
    {
      key: "ablation",
      score: indices.ablationIndex,
      explanation:
        "Temperatura, dose e foco muito altos concentram calor extremo em uma zona pequena.",
    },
    {
      key: "thermal-damage",
      score: thermalDamageScore,
      explanation:
        "Calor sustentado eleva a temperatura do músculo e pode iniciar alterações teciduais no modelo.",
    },
    {
      key: "periosteal-risk",
      score: indices.periostealPainIndex,
      explanation:
        "Energia refletida ou concentrada perto do osso aumenta irritação periosteal simulada.",
    },
    {
      key: "cavitation-risk",
      score: cavitationForRanking,
      explanation:
        "Intensidade e acoplamento elevados favorecem microbolhas ilustrativas no modelo.",
    },
    {
      key: "deep-thermal-effect",
      score: indices.muscleThermalStressIndex,
      explanation:
        "O feixe aquece o músculo em profundidade, típico do ultrassom terapêutico bem acoplado.",
    },
    {
      key: "hyperemia",
      score: indices.hyperemiaIndex,
      explanation:
        "A pele aquece e fica mais rosada após aquecimento local moderado.",
    },
    {
      key: "mild-heating",
      score: clamp01((indices.hyperemiaIndex + indices.muscleThermalStressIndex) * 0.35),
      explanation: "Aquecimento leve dentro da faixa terapêutica usual.",
    },
  ];

  ranked.sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top || top.score < 0.12) {
    return {
      primaryResponse: "none",
      explanation: "Parâmetros atuais produzem alteração fisiológica mínima no modelo educacional.",
    };
  }
  return { primaryResponse: top.key, explanation: top.explanation };
}

export function buildUltrasoundPhysiologyResponse(
  input: BuildUltrasoundPhysiologyResponseInput,
): UltrasoundPhysiologyResponse {
  const { result, interactionMap, config } = input;
  const { surfaceTemp, targetTemp, maxTemp, maxTempDepth, thermalDose, cumulativeDose, periostealRisk } =
    result;

  const mapCavitation = interactionMap?.summary.maxCavitationIndex ?? 0;
  const mapAblation = interactionMap?.summary.maxAblationIndex ?? 0;
  const mapLesion = interactionMap?.summary.maxLesionIndex ?? 0;

  const hyperemiaIndex = clamp01((surfaceTemp - 39) / 4);

  const perfusionVisual = getPerfusionVisualProfile(config.tissuePerfusionProfile ?? "normal");
  const perfusionHyperemiaBoost =
    perfusionVisual.heatRetention > 1 ? (perfusionVisual.heatRetention - 1) * 0.35 : 0;
  const perfusionHyperemiaDamp =
    perfusionVisual.heatRetention < 1 ? (1 - perfusionVisual.heatRetention) * 0.25 : 0;
  const adjustedHyperemia = clamp01(
    hyperemiaIndex * (1 + perfusionHyperemiaBoost - perfusionHyperemiaDamp) + perfusionVisual.skinFlush * 0.35,
  );

  let edemaIndex = clamp01((surfaceTemp - 40) / 5);
  if (perfusionVisual.heatRetention > 1.1) edemaIndex = clamp01(edemaIndex * 1.18);
  if (perfusionVisual.heatRetention < 0.85) edemaIndex = clamp01(edemaIndex * 0.82);
  if (config.coupling === "poor") edemaIndex = clamp01(edemaIndex * 1.25);
  if (config.movement === "stationary") edemaIndex = clamp01(edemaIndex * 1.15);
  else edemaIndex = clamp01(edemaIndex * 0.82);

  const muscleThermalStressIndex = clamp01((Math.max(targetTemp, maxTemp) - 42) / 6);
  const adjustedMuscleStress = clamp01(
    muscleThermalStressIndex * (0.85 + perfusionVisual.heatRetention * 0.22),
  );

  const collagenDenaturationIndex = clamp01(
    clamp01((maxTemp - 45) / 5) * 0.65 + clamp01(cumulativeDose / 90) * 0.35,
  );

  const coagulationIndex = clamp01(
    clamp01((maxTemp - 48) / 4) * 0.6 + clamp01(thermalDose / 100) * 0.4,
  );

  const focusedBoost =
    config.beamProfile === "focused" || config.transducerType === "focused_convergent" ? 1.15 : 1;
  const stationaryBoost = config.movement === "stationary" ? 1.12 : 0.88;
  const doseBoost = clamp01(result.doseJcm2 / 25);

  let ablationIndex = clamp01(
    mapAblation * 0.45 +
      clamp01((maxTemp - 48) / 5) * 0.35 +
      doseBoost * 0.25 +
      (config.beamProfile === "focused" ? 0.08 : 0),
  );
  ablationIndex = clamp01(ablationIndex * focusedBoost * stationaryBoost);

  const periostealPainIndex = clamp01(periostealRisk * 0.85 + result.boneReflection * 0.25);

  const nociceptionIndex = clamp01(
    clamp01((surfaceTemp - 41) / 6) * 0.35 +
      periostealPainIndex * 0.35 +
      mapCavitation * 0.3,
  );

  const reversibleChangeIndex = clamp01(
    adjustedHyperemia * 0.35 +
      edemaIndex * 0.2 +
      adjustedMuscleStress * 0.35 +
      clamp01((surfaceTemp - 37.5) / 5) * 0.1,
  );

  const irreversibleDamageIndex = clamp01(
    Math.max(collagenDenaturationIndex, coagulationIndex, mapLesion * 0.9),
  );

  const cavitationRiskIndex = clamp01(
    mapCavitation * 0.85 +
      (config.mode === "pulsed" ? 0.06 : 0) +
      (config.coupling === "poor" ? 0.08 : 0),
  );

  const core = {
    hyperemiaIndex: adjustedHyperemia,
    edemaIndex,
    nociceptionIndex,
    periostealPainIndex,
    muscleThermalStressIndex: adjustedMuscleStress,
    collagenDenaturationIndex,
    coagulationIndex,
    ablationIndex,
    cavitationRiskIndex,
  };

  const summary = resolvePrimaryResponse(core);

  return {
    ...core,
    reversibleChangeIndex,
    irreversibleDamageIndex,
    summary,
  };
}

/** Índices principais para barras no painel */
export const PHYSIOLOGY_INDEX_LABELS: Record<string, string> = {
  hyperemiaIndex: "Hiperemia",
  edemaIndex: "Edema (ilustrativo)",
  muscleThermalStressIndex: "Stress muscular térmico",
  periostealPainIndex: "Dor periosteal",
  nociceptionIndex: "Nocicepção simulada",
  collagenDenaturationIndex: "Desnaturação de colágeno",
  coagulationIndex: "Coagulação educacional",
  ablationIndex: "Superaquecimento focal",
  cavitationRiskIndex: "Cavitação estimada",
  reversibleChangeIndex: "Alteração reversível",
  irreversibleDamageIndex: "Dano irreversível (modelo)",
};

/** Barras prioritárias por resposta dominante */
export const PRIMARY_PHYSIOLOGY_BAR_KEYS: Record<
  UltrasoundPrimaryPhysiologyResponse,
  Array<keyof typeof PHYSIOLOGY_INDEX_LABELS>
> = {
  none: ["hyperemiaIndex", "muscleThermalStressIndex"],
  "mild-heating": ["hyperemiaIndex", "reversibleChangeIndex", "muscleThermalStressIndex"],
  hyperemia: ["hyperemiaIndex", "edemaIndex", "reversibleChangeIndex"],
  "deep-thermal-effect": ["muscleThermalStressIndex", "hyperemiaIndex", "reversibleChangeIndex"],
  "periosteal-risk": ["periostealPainIndex", "nociceptionIndex", "hyperemiaIndex"],
  "cavitation-risk": ["cavitationRiskIndex", "nociceptionIndex", "hyperemiaIndex"],
  "thermal-damage": [
    "irreversibleDamageIndex",
    "muscleThermalStressIndex",
    "collagenDenaturationIndex",
    "coagulationIndex",
  ],
  ablation: ["ablationIndex", "irreversibleDamageIndex", "muscleThermalStressIndex"],
};
