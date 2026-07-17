/**
 * Desafios educacionais gamificados — Fotobiomodulação (PBM)
 */

import { classifyPhotobioDose, PHOTOBIO_DOSE_THRESHOLDS } from "@/lib/photobioOptics";
import type { PhotobioAnatomyPreset } from "@/simulation/photobioEngine";
import type { TissueInteractionResult } from "@/simulation/photobioEngine";
import type { PhotobioApplicatorType } from "@/components/labs/photobio/photobioApplicatorTypes";
import type { PhotobioSnapshot } from "@/lib/photobioComparison";
import type { PhotobioMode, PhotobioViewerTab } from "@/config/photobioPresets";
import type { PhotobioWavelength } from "@/lib/photobioOptics";

export type PhotobioChallengeId =
  | "therapeutic-window"
  | "compare-660-808"
  | "fix-technique"
  | "avoid-bioinhibition"
  | "deep-obese";

export interface PhotobioChallengeRuntimeState {
  muscleTransmissionAt660: number | null;
  muscleTransmissionAt808: number | null;
  snapshotSavedForCompare: boolean;
  techniqueStartedBad: boolean;
  doseStartedHigh: boolean;
  realDoseFactorStarted: number | null;
}

export const DEFAULT_PHOTOBIO_CHALLENGE_RUNTIME: PhotobioChallengeRuntimeState = {
  muscleTransmissionAt660: null,
  muscleTransmissionAt808: null,
  snapshotSavedForCompare: false,
  techniqueStartedBad: false,
  doseStartedHigh: false,
  realDoseFactorStarted: null,
};

export interface PhotobioChallengeEvalContext {
  wavelength: PhotobioWavelength;
  power: number;
  spotSize: number;
  exposureTime: number;
  mode: PhotobioMode;
  dutyCycle: number;
  transducerAngle: number;
  contactPressure: number;
  isDragging: boolean;
  draggingSpeed: number;
  anatomyPreset: PhotobioAnatomyPreset;
  interaction: TissueInteractionResult;
  runtime: PhotobioChallengeRuntimeState;
  viewerTab?: PhotobioViewerTab;
  doseMap: number[];
  snapshots: PhotobioSnapshot[];
}

export interface PhotobioChallengeObjectiveDef {
  id: string;
  label: string;
  hint: string;
}

export interface PhotobioChallengeDef {
  id: PhotobioChallengeId;
  title: string;
  summary: string;
  difficulty: "easy" | "medium" | "hard";
  estimatedMin: number;
  initialConfig: Partial<{
    wavelength: PhotobioWavelength;
    power: number;
    spotSize: number;
    exposureTime: number;
    mode: PhotobioMode;
    dutyCycle: number;
    transducerAngle: number;
    contactPressure: number;
    isDragging: boolean;
    draggingSpeed: number;
    anatomyPreset: PhotobioAnatomyPreset;
    applicatorType: PhotobioApplicatorType;
    viewerTab: PhotobioViewerTab;
  }>;
  objectives: PhotobioChallengeObjectiveDef[];
  coachHints: string[];
  suggestedTab?: PhotobioViewerTab;
}

export const PHOTOBIO_CHALLENGES: PhotobioChallengeDef[] = [
  {
    id: "therapeutic-window",
    title: "Atingir janela terapêutica",
    summary:
      "Configure parâmetros e técnica para fluência efetiva na janela (2–8 J/cm²), sem risco térmico.",
    difficulty: "medium",
    estimatedMin: 5,
    initialConfig: {
      wavelength: 660,
      power: 60,
      spotSize: 0.4,
      exposureTime: 25,
      mode: "CW",
      transducerAngle: 85,
      contactPressure: 45,
      isDragging: false,
      anatomyPreset: "default",
      applicatorType: "cluster",
    },
    objectives: [
      {
        id: "effective-window",
        label: "Fluência efetiva na janela terapêutica (2–8 J/cm²)",
        hint: "Ajuste potência, tempo e spot — observe F eff. no painel.",
      },
      {
        id: "no-thermal",
        label: "Sem risco térmico elevado",
        hint: "Irradiância alta + spot pequeno aumentam calor superficial.",
      },
      {
        id: "technique-ok",
        label: "Técnica adequada (realDoseFactor ≥ 75%)",
        hint: "Ângulo perpendicular, contato firme e varredura moderada ajudam.",
      },
      {
        id: "scanning-or-steady",
        label: "Varredura lenta ou exposição distribuída",
        hint: "Evite ficar parado tempo demais no mesmo ponto.",
      },
    ],
    coachHints: [
      "Observe a fluência efetiva — ela inclui perdas por ângulo, contato e velocidade.",
      "Se o nominal parece bom mas F eff. caiu, revise técnica antes de subir potência.",
      "A janela terapêutica fica entre 2 e 8 J/cm² efetivos na curva Arndt–Schulz.",
    ],
    suggestedTab: "bioresponse",
  },
  {
    id: "compare-660-808",
    title: "Compare 660 vs 808",
    summary:
      "Alterne comprimentos de onda e salve snapshots A/B para comparar transmissão ao músculo.",
    difficulty: "easy",
    estimatedMin: 4,
    initialConfig: {
      wavelength: 660,
      power: 100,
      spotSize: 0.55,
      exposureTime: 40,
      mode: "CW",
      transducerAngle: 90,
      contactPressure: 55,
      anatomyPreset: "default",
      applicatorType: "dualWavelengthCluster",
    },
    objectives: [
      {
        id: "record-660",
        label: "Registrar transmissão muscular com 660 nm",
        hint: "Anote % músculo na barra de status.",
      },
      {
        id: "record-808",
        label: "Testar com 808 nm",
        hint: "Alterne comprimento de onda e compare.",
      },
      {
        id: "808-deeper",
        label: "808 nm preserva mais energia em profundidade",
        hint: "Transmissão muscular deve ser maior em 808 nm.",
      },
      {
        id: "snapshot-ab",
        label: "Salvar snapshot A/B para comparar",
        hint: "Use o botão Salvar snapshot após cada configuração.",
      },
    ],
    coachHints: [
      "660 nm absorve mais na derme — observe glow superficial na aba Feixe.",
      "Para alvo muscular, observe a transmissão ao músculo; 808 nm tende a preservar mais energia em profundidade.",
      "Salve um snapshot em cada wavelength antes de concluir.",
    ],
    suggestedTab: "penetration",
  },
  {
    id: "fix-technique",
    title: "Corrigir técnica",
    summary:
      "Parta de ângulo, pressão e varredura inadequados — melhore realDoseFactor sem overdose.",
    difficulty: "medium",
    estimatedMin: 5,
    initialConfig: {
      wavelength: 808,
      power: 120,
      spotSize: 0.5,
      exposureTime: 45,
      mode: "CW",
      transducerAngle: 52,
      contactPressure: 18,
      isDragging: true,
      draggingSpeed: 2.6,
      anatomyPreset: "athlete",
      applicatorType: "dualWavelengthCluster",
    },
    objectives: [
      {
        id: "noticed-loss",
        label: "Identificar queda de dose efetiva por técnica",
        hint: "Compare nominal vs F eff. no painel de técnica.",
      },
      {
        id: "angle-fixed",
        label: "Ângulo próximo de 90° (±15°)",
        hint: "Incidência perpendicular maximiza acoplamento.",
      },
      {
        id: "pressure-ok",
        label: "Pressão de contato adequada (≥ 45)",
        hint: "Contato leve reduz acoplamento óptico.",
      },
      {
        id: "dose-factor",
        label: "realDoseFactor ≥ 85%",
        hint: "Corrija ângulo, pressão e velocidade de varredura.",
      },
    ],
    coachHints: [
      "Seu valor nominal parece bom, mas a dose efetiva caiu por causa do ângulo.",
      "Pressão leve e varredura rápida simulada reduzem entrega — veja o breakdown de técnica.",
      "Corrija uma variável por vez e observe realDoseFactor subir.",
    ],
    suggestedTab: "fluence",
  },
  {
    id: "avoid-bioinhibition",
    title: "Evitar bioinibição",
    summary:
      "Reduza dose excessiva inicial até fluência efetiva segura, fora de saturação/inibição.",
    difficulty: "hard",
    estimatedMin: 6,
    initialConfig: {
      wavelength: 660,
      power: 380,
      spotSize: 0.18,
      exposureTime: 90,
      mode: "CW",
      transducerAngle: 90,
      contactPressure: 50,
      isDragging: false,
      anatomyPreset: "default",
      applicatorType: "pointLaser",
    },
    objectives: [
      {
        id: "noticed-high",
        label: "Reconhecer dose excessiva inicial",
        hint: "Zona Arndt–Schulz deve indicar saturação ou inibição.",
      },
      {
        id: "reduce-fluence",
        label: "Fluência efetiva na janela ou transição segura (< 10 J/cm²)",
        hint: "Reduza potência, tempo ou amplie spot.",
      },
      {
        id: "no-saturation",
        label: "Fora de bioinibição / saturação",
        hint: "Evite zona vermelha na resposta biológica.",
      },
      {
        id: "thermal-safe",
        label: "Irradiância segura (sem alerta térmico)",
        hint: "Spot pequeno + power alto elevam irradiância.",
      },
    ],
    coachHints: [
      "O spot pequeno aumentou muito a irradiância — amplie área ou reduza potência.",
      "Você está parado tempo demais no mesmo ponto; veja o mapa de fluência acumulada.",
      "Bioinibição na curva Arndt–Schulz aparece com doses muito altas — reduza gradualmente.",
    ],
    suggestedTab: "bioresponse",
  },
  {
    id: "deep-obese",
    title: "Alvo profundo em adiposidade elevada",
    summary:
      "Anatomia obese: escolha 808 nm e ajuste parâmetros para entregar dose muscular sem risco térmico.",
    difficulty: "hard",
    estimatedMin: 7,
    initialConfig: {
      wavelength: 660,
      power: 100,
      spotSize: 0.45,
      exposureTime: 40,
      mode: "CW",
      transducerAngle: 90,
      contactPressure: 50,
      anatomyPreset: "obese",
      applicatorType: "dualWavelengthCluster",
    },
    objectives: [
      {
        id: "use-808",
        label: "Usar 808 nm como comprimento de onda",
        hint: "808 nm atravessa melhor adiposo moderado/alto.",
      },
      {
        id: "muscle-improved",
        label: "Melhorar fluência muscular (≥ 0,8 J/cm²)",
        hint: "Observe fluência no músculo no painel de profundidade.",
      },
      {
        id: "transmission-ok",
        label: "Transmissão muscular ≥ 12%",
        hint: "AdiposeMm elevado atenua 660 nm mais que 808 nm.",
      },
      {
        id: "thermal-safe",
        label: "Sem risco térmico elevado",
        hint: "Compense adipose com parâmetros, não só potência máxima.",
      },
    ],
    coachHints: [
      "AdiposeMm elevado reduz transmissão — compare 660 vs 808 na aba Penetração.",
      "808 nm é ponto de partida, mas tempo e spot também importam para dose muscular.",
      "Evite compensar adiposidade apenas com potência máxima — risco térmico sobe.",
    ],
    suggestedTab: "penetration",
  },
];

export function getPhotobioChallengeById(
  id: PhotobioChallengeId,
): PhotobioChallengeDef | undefined {
  return PHOTOBIO_CHALLENGES.find((c) => c.id === id);
}

function isInTherapeuticWindow(effectiveFluence: number): boolean {
  const { therapeuticMin, therapeuticMax } = PHOTOBIO_DOSE_THRESHOLDS;
  return effectiveFluence >= therapeuticMin && effectiveFluence <= therapeuticMax;
}

export function advancePhotobioChallengeRuntime(
  runtime: PhotobioChallengeRuntimeState,
  ctx: PhotobioChallengeEvalContext,
  snapshots: PhotobioSnapshot[],
): PhotobioChallengeRuntimeState {
  const next = { ...runtime };
  const { wavelength, interaction } = ctx;

  if (wavelength === 660) {
    next.muscleTransmissionAt660 = interaction.muscleFluenceRatio;
  }
  if (wavelength === 808) {
    next.muscleTransmissionAt808 = interaction.muscleFluenceRatio;
  }
  if (snapshots.length >= 1) {
    next.snapshotSavedForCompare = true;
  }
  return next;
}

export function evaluatePhotobioObjective(
  challengeId: PhotobioChallengeId,
  objectiveId: string,
  ctx: PhotobioChallengeEvalContext,
): boolean {
  const { interaction, wavelength, transducerAngle, contactPressure, isDragging, draggingSpeed, runtime, snapshots } =
    ctx;
  const doseZone = classifyPhotobioDose(interaction.effectiveFluence).zone;

  switch (challengeId) {
    case "therapeutic-window":
      switch (objectiveId) {
        case "effective-window":
          return isInTherapeuticWindow(interaction.effectiveFluence);
        case "no-thermal":
          return !interaction.thermalWarning && interaction.thermalRiskIndex < 0.55;
        case "technique-ok":
          return interaction.realDoseFactor >= 0.75;
        case "scanning-or-steady":
          return isDragging ? draggingSpeed <= 1.8 : interaction.effectiveFluence <= 12;
        default:
          return false;
      }

    case "compare-660-808":
      switch (objectiveId) {
        case "record-660":
          return runtime.muscleTransmissionAt660 != null;
        case "record-808":
          return runtime.muscleTransmissionAt808 != null;
        case "808-deeper":
          return (
            runtime.muscleTransmissionAt660 != null &&
            runtime.muscleTransmissionAt808 != null &&
            runtime.muscleTransmissionAt808 > runtime.muscleTransmissionAt660 + 0.02
          );
        case "snapshot-ab":
          return snapshots.length >= 2;
        default:
          return false;
      }

    case "fix-technique":
      switch (objectiveId) {
        case "noticed-loss":
          return (
            runtime.techniqueStartedBad ||
            interaction.realDoseFactor < 0.85 ||
            interaction.effectiveFluence < ctx.interaction.fluence * 0.85
          );
        case "angle-fixed":
          return Math.abs(transducerAngle - 90) <= 15;
        case "pressure-ok":
          return contactPressure >= 45;
        case "dose-factor":
          return interaction.realDoseFactor >= 0.85;
        default:
          return false;
      }

    case "avoid-bioinhibition":
      switch (objectiveId) {
        case "noticed-high":
          return (
            runtime.doseStartedHigh ||
            doseZone === "saturation" ||
            doseZone === "inhibitory" ||
            interaction.effectiveFluence >= PHOTOBIO_DOSE_THRESHOLDS.inhibitoryMin
          );
        case "reduce-fluence":
          return interaction.effectiveFluence <= PHOTOBIO_DOSE_THRESHOLDS.transitionLowerMax;
        case "no-saturation":
          return doseZone !== "saturation" && doseZone !== "inhibitory";
        case "thermal-safe":
          return !interaction.thermalWarning && interaction.thermalRiskIndex < 0.6;
        default:
          return false;
      }

    case "deep-obese":
      switch (objectiveId) {
        case "use-808":
          return wavelength === 808;
        case "muscle-improved":
          return interaction.muscleFluence >= 0.8;
        case "transmission-ok":
          return interaction.muscleFluenceRatio >= 0.12;
        case "thermal-safe":
          return !interaction.thermalWarning && interaction.thermalRiskIndex < 0.55;
        default:
          return false;
      }

    default:
      return false;
  }
}

export function evaluateAllPhotobioObjectives(
  challengeId: PhotobioChallengeId,
  ctx: PhotobioChallengeEvalContext,
): Record<string, boolean> {
  const def = getPhotobioChallengeById(challengeId);
  if (!def) return {};
  const out: Record<string, boolean> = {};
  for (const obj of def.objectives) {
    out[obj.id] = evaluatePhotobioObjective(challengeId, obj.id, ctx);
  }
  return out;
}

export function getPhotobioObjectiveProgress(
  challengeId: PhotobioChallengeId,
  ctx: PhotobioChallengeEvalContext,
): { completed: number; total: number; map: Record<string, boolean> } {
  const map = evaluateAllPhotobioObjectives(challengeId, ctx);
  const completed = Object.values(map).filter(Boolean).length;
  return { completed, total: Object.keys(map).length, map };
}

export function isPhotobioChallengeComplete(
  challengeId: PhotobioChallengeId,
  ctx: PhotobioChallengeEvalContext,
): boolean {
  const { completed, total } = getPhotobioObjectiveProgress(challengeId, ctx);
  return total > 0 && completed === total;
}

export interface PhotobioCoachFeedback {
  message: string;
  tone: "tip" | "success" | "warning";
}

/** Feedback contextual didático — não entrega a resposta completa de primeira. */
export function getPhotobioContextualCoachFeedback(
  challengeId: PhotobioChallengeId | null,
  ctx: PhotobioChallengeEvalContext,
  hintIndex: number,
): PhotobioCoachFeedback {
  const { interaction, transducerAngle, isDragging, wavelength } = ctx;
  const def = challengeId ? getPhotobioChallengeById(challengeId) : null;

  if (interaction.realDoseFactor < 0.75 && Math.abs(transducerAngle - 90) > 20) {
    return {
      message:
        "Seu valor nominal parece bom, mas a dose efetiva caiu por causa do ângulo.",
      tone: "warning",
    };
  }

  if (wavelength === 808 && interaction.muscleFluenceRatio > 0.15) {
    return {
      message:
        "Para alvo muscular, observe a transmissão ao músculo; 808 nm tende a preservar mais energia em profundidade.",
      tone: "tip",
    };
  }

  if (interaction.irradiance > 400 && ctx.spotSize < 0.25) {
    return {
      message: "O spot pequeno aumentou muito a irradiância.",
      tone: "warning",
    };
  }

  if (!isDragging && interaction.effectiveFluence > 20) {
    return {
      message:
        "Você está parado tempo demais no mesmo ponto; veja o mapa de fluência acumulada.",
      tone: "warning",
    };
  }

  if (isInTherapeuticWindow(interaction.effectiveFluence) && !interaction.thermalWarning) {
    return {
      message: "Boa entrega: fluência efetiva na janela e irradiância controlada.",
      tone: "success",
    };
  }

  if (def && def.coachHints.length > 0) {
    const idx = Math.min(hintIndex, def.coachHints.length - 1);
    return { message: def.coachHints[idx], tone: "tip" };
  }

  return {
    message: "Explore parâmetros e observe fluência efetiva, transmissão e resposta biológica.",
    tone: "tip",
  };
}
