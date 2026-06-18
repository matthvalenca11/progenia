/**
 * Desafios educacionais gamificados — Ultrassom Terapêutico
 */

import type { UltrasoundTherapyConfig } from "@/types/ultrasoundTherapyConfig";
import type { UltrasoundTherapyResult } from "@/simulation/ultrasoundTherapyEngine";

export type TherapyChallengeId =
  | "deep-heating-safe"
  | "fix-coupling"
  | "freq-compare"
  | "avoid-periosteal"
  | "focused-educational";

export interface ChallengeEvalContext {
  config: UltrasoundTherapyConfig;
  result: UltrasoundTherapyResult;
  runtime: ChallengeRuntimeState;
  viewerTab?: string;
}

export interface ChallengeRuntimeState {
  couplingStartedPoor: boolean;
  freqDepthAt1MHz: number | null;
  freqDepthAt3MHz: number | null;
  couplingImproved: boolean;
}

export const DEFAULT_CHALLENGE_RUNTIME: ChallengeRuntimeState = {
  couplingStartedPoor: false,
  freqDepthAt1MHz: null,
  freqDepthAt3MHz: null,
  couplingImproved: false,
};

export interface TherapyChallengeObjectiveDef {
  id: string;
  label: string;
  hint: string;
}

export interface TherapyChallengeDef {
  id: TherapyChallengeId;
  title: string;
  summary: string;
  difficulty: "easy" | "medium" | "hard";
  estimatedMin: number;
  initialConfig: Partial<UltrasoundTherapyConfig>;
  objectives: TherapyChallengeObjectiveDef[];
  coachHints: string[];
  suggestedTab?: "thermal" | "beam" | "interaction" | "physiology";
}

export const THERAPY_CHALLENGES: TherapyChallengeDef[] = [
  {
    id: "deep-heating-safe",
    title: "Aquecimento profundo seguro",
    summary:
      "Configure o ultrassom para aquecer o alvo muscular (40–43 °C) sem picos perigosos nem risco periosteal.",
    difficulty: "medium",
    estimatedMin: 5,
    initialConfig: {
      scenario: "shoulder",
      frequency: 1.1,
      intensity: 1.0,
      era: 5,
      mode: "continuous",
      coupling: "good",
      movement: "stationary",
      duration: 8,
      transducerType: "planar_circular",
      beamProfile: "planar",
    },
    objectives: [
      { id: "target-temp", label: "Temperatura alvo entre 40 e 43 °C", hint: "Ajuste intensidade e tempo — o alvo fica abaixo da pele." },
      { id: "max-safe", label: "Temperatura máxima abaixo de 45 °C", hint: "Evite intensidade alta com transdutor parado." },
      { id: "periosteal-low", label: "Risco periosteal abaixo de 30 %", hint: "Mantenha distância do osso ou use varredura." },
      { id: "scanning", label: "Usar movimento em varredura", hint: "Varredura distribui energia e reduz hotspots." },
    ],
    coachHints: [
      "Observe a aba Térmico: o pico deve ficar no músculo, não só na pele.",
      "Frequências mais baixas (~1 MHz) ajudam a atingir profundidade com segurança.",
      "Varredura lenta é sua aliada quando a intensidade sobe.",
    ],
    suggestedTab: "thermal",
  },
  {
    id: "fix-coupling",
    title: "Corrija o acoplamento ruim",
    summary:
      "O gel está inadequado. Identifique o aquecimento superficial excessivo e corrija o acoplamento.",
    difficulty: "easy",
    estimatedMin: 4,
    initialConfig: {
      scenario: "forearm",
      frequency: 2.0,
      intensity: 1.2,
      coupling: "poor",
      movement: "stationary",
      duration: 8,
      mode: "continuous",
    },
    objectives: [
      { id: "noticed-surface", label: "Identificar aquecimento superficial elevado", hint: "Compare superfície vs alvo no painel ou aba Térmico." },
      { id: "good-coupling", label: "Trocar para acoplamento bom (gel adequado)", hint: "Abra os controles de acoplamento." },
      { id: "surface-cooled", label: "Reduzir temperatura superficial", hint: "Com bom gel, menos energia fica presa na pele." },
      { id: "risk-down", label: "Reduzir risco geral para baixo ou moderado", hint: "Bom acoplamento melhora transmissão e reduz risco." },
    ],
    coachHints: [
      "Acoplamento ruim aquece a pele antes do músculo — veja a diferença entre superfície e alvo.",
      "Observe o feixe amarelado na aba Feixe quando o gel está ruim.",
      "Depois de corrigir, a temperatura superficial deve cair em relação ao pico anterior.",
    ],
    suggestedTab: "beam",
  },
  {
    id: "freq-compare",
    title: "1 MHz vs 3 MHz",
    summary:
      "Compare como a frequência altera a profundidade efetiva do feixe no mesmo cenário.",
    difficulty: "easy",
    estimatedMin: 4,
    initialConfig: {
      scenario: "shoulder",
      frequency: 3.0,
      intensity: 1.0,
      coupling: "good",
      movement: "scanning",
      duration: 8,
      mode: "continuous",
      era: 5,
    },
    objectives: [
      { id: "try-3mhz", label: "Registrar profundidade efetiva com ~3 MHz", hint: "Anote a prof. efetiva na barra de status." },
      { id: "try-1mhz", label: "Testar com ~1 MHz", hint: "Reduza a frequência e observe a mudança." },
      { id: "deeper-at-1", label: "1 MHz penetra mais que 3 MHz", hint: "Profundidade efetiva maior em 1 MHz confirma o conceito." },
    ],
    coachHints: [
      "Frequência alta concentra energia superficialmente — ideal para pele, não para músculo profundo.",
      "Alterne entre 3 MHz e 1 MHz e compare a profundidade efetiva no painel.",
      "Use a aba Propagação para visualizar onde a energia se concentra.",
    ],
    suggestedTab: "interaction",
  },
  {
    id: "avoid-periosteal",
    title: "Evite risco periosteal",
    summary:
      "No joelho, reduza reflexão óssea e risco periosteal ajustando técnica e parâmetros.",
    difficulty: "hard",
    estimatedMin: 6,
    initialConfig: {
      scenario: "knee",
      frequency: 1.5,
      intensity: 1.8,
      coupling: "good",
      movement: "stationary",
      mode: "continuous",
      duration: 10,
      era: 4,
    },
    objectives: [
      { id: "periosteal-low", label: "Risco periosteal abaixo de 35 %", hint: "Afaste o hotspot do osso ou use varredura." },
      { id: "scanning-or-pulsed", label: "Usar varredura ou modo pulsado", hint: "Distribua ou interrompa energia para proteger o periósteo." },
      { id: "intensity-moderate", label: "Intensidade moderada (≤ 1,5 W/cm²)", hint: "Intensidade alta junto ao osso aumenta reflexão." },
      { id: "risk-low", label: "Risco geral baixo ou moderado", hint: "Combine técnica + parâmetros seguros." },
    ],
    coachHints: [
      "O osso reflete ultrassom — observe reflexão na aba Propagação ou Resposta fisiológica.",
      "Movimento estacionário perto do osso concentra energia no periósteo.",
      "Modo pulsado ou varredura reduz carga térmica local.",
    ],
    suggestedTab: "physiology",
  },
  {
    id: "focused-educational",
    title: "Modo focado educacional",
    summary:
      "Use transdutor focalizado e posicione o foco no tecido alvo. Observe a zona de maior energia.",
    difficulty: "medium",
    estimatedMin: 5,
    initialConfig: {
      scenario: "shoulder",
      transducerType: "focused_convergent",
      beamProfile: "focused",
      focusDepth: 2.5,
      frequency: 1.2,
      intensity: 1.2,
      coupling: "good",
      movement: "scanning",
      duration: 8,
      mode: "continuous",
    },
    objectives: [
      { id: "focused-type", label: "Usar aplicador/perfil convergente focalizado", hint: "Lente acústica concentra energia em profundidade." },
      { id: "focus-aligned", label: "Foco alinhado ao alvo (~1,5–3 cm)", hint: "Ajuste profundidade focal conforme o cenário." },
      { id: "hotspot-near-focus", label: "Pico térmico próximo ao foco", hint: "maxTempDepth deve ficar perto de focusDepth." },
      { id: "view-propagation", label: "Visualizar concentração na aba Propagação", hint: "Abra Propagação para ver o hotspot acústico." },
    ],
    coachHints: [
      "O foco concentra energia — compare com feixe plano na aba Feixe.",
      "Se o pico térmico está longe do foco, ajuste focusDepth.",
      "A profundidade efetiva e maxTempDepth devem convergir para sua profundidade focal.",
    ],
    suggestedTab: "interaction",
  },
];

export function getChallengeById(id: TherapyChallengeId): TherapyChallengeDef | undefined {
  return THERAPY_CHALLENGES.find((c) => c.id === id);
}

function updateFreqRuntime(
  runtime: ChallengeRuntimeState,
  config: UltrasoundTherapyConfig,
  result: UltrasoundTherapyResult,
): ChallengeRuntimeState {
  const next = { ...runtime };
  if (config.frequency <= 1.3) {
    next.freqDepthAt1MHz = result.effectiveDepth;
  }
  if (config.frequency >= 2.5) {
    next.freqDepthAt3MHz = result.effectiveDepth;
  }
  return next;
}

export function advanceChallengeRuntime(
  runtime: ChallengeRuntimeState,
  config: UltrasoundTherapyConfig,
  result: UltrasoundTherapyResult,
  prevCoupling?: string,
): ChallengeRuntimeState {
  let next = updateFreqRuntime(runtime, config, result);
  if (prevCoupling === "poor" && config.coupling === "good") {
    next.couplingImproved = true;
  }
  return next;
}

export function evaluateObjective(
  challengeId: TherapyChallengeId,
  objectiveId: string,
  ctx: ChallengeEvalContext,
): boolean {
  const { config, result, runtime } = ctx;

  switch (challengeId) {
    case "deep-heating-safe":
      switch (objectiveId) {
        case "target-temp":
          return result.targetTemp >= 40 && result.targetTemp <= 43;
        case "max-safe":
          return result.maxTemp < 45;
        case "periosteal-low":
          return result.periostealRisk < 0.3;
        case "scanning":
          return config.movement === "scanning";
        default:
          return false;
      }

    case "fix-coupling":
      switch (objectiveId) {
        case "noticed-surface":
          return result.surfaceTemp > result.targetTemp + 0.5 || runtime.couplingStartedPoor;
        case "good-coupling":
          return config.coupling === "good";
        case "surface-cooled":
          return config.coupling === "good" && result.surfaceTemp <= 42;
        case "risk-down":
          return config.coupling === "good" && result.risk !== "high";
        default:
          return false;
      }

    case "freq-compare":
      switch (objectiveId) {
        case "try-3mhz":
          return runtime.freqDepthAt3MHz != null;
        case "try-1mhz":
          return runtime.freqDepthAt1MHz != null;
        case "deeper-at-1":
          return (
            runtime.freqDepthAt1MHz != null &&
            runtime.freqDepthAt3MHz != null &&
            runtime.freqDepthAt1MHz > runtime.freqDepthAt3MHz + 0.15
          );
        default:
          return false;
      }

    case "avoid-periosteal":
      switch (objectiveId) {
        case "periosteal-low":
          return result.periostealRisk < 0.35;
        case "scanning-or-pulsed":
          return config.movement === "scanning" || config.mode === "pulsed";
        case "intensity-moderate":
          return config.intensity <= 1.5;
        case "risk-low":
          return result.risk === "low" || result.risk === "medium";
        default:
          return false;
      }

    case "focused-educational":
      switch (objectiveId) {
        case "focused-type":
          return config.beamProfile === "focused" || config.transducerType === "focused_convergent";
        case "focus-aligned": {
          const focus = config.focusDepth ?? 2.5;
          return focus >= 1.5 && focus <= 3.5;
        }
        case "hotspot-near-focus": {
          const focus = config.focusDepth ?? 2.5;
          return Math.abs(result.maxTempDepth - focus) <= 0.6;
        }
        case "view-propagation":
          return ctx.viewerTab === "interaction";
        default:
          return false;
      }

    default:
      return false;
  }
}

export function evaluateAllObjectives(
  challengeId: TherapyChallengeId,
  ctx: ChallengeEvalContext,
): Record<string, boolean> {
  const def = getChallengeById(challengeId);
  if (!def) return {};
  const out: Record<string, boolean> = {};
  for (const obj of def.objectives) {
    out[obj.id] = evaluateObjective(challengeId, obj.id, ctx);
  }
  return out;
}

export function getObjectiveProgress(
  challengeId: TherapyChallengeId,
  ctx: ChallengeEvalContext,
): { completed: number; total: number; map: Record<string, boolean> } {
  const map = evaluateAllObjectives(challengeId, ctx);
  const completed = Object.values(map).filter(Boolean).length;
  return { completed, total: Object.keys(map).length, map };
}

export function isChallengeComplete(
  challengeId: TherapyChallengeId,
  ctx: ChallengeEvalContext,
): boolean {
  const { completed, total } = getObjectiveProgress(challengeId, ctx);
  return total > 0 && completed === total;
}

export function buildInitialConfigForChallenge(
  challengeId: TherapyChallengeId,
  base: UltrasoundTherapyConfig,
): UltrasoundTherapyConfig {
  const def = getChallengeById(challengeId);
  if (!def) return base;
  return {
    ...base,
    ...def.initialConfig,
    enabledControls: base.enabledControls,
    ranges: base.ranges,
  };
}

export interface CoachFeedback {
  message: string;
  tone: "tip" | "success" | "warning";
}

/** Feedback contextual didático — não entrega a resposta completa de primeira. */
export function getContextualCoachFeedback(
  challengeId: TherapyChallengeId | null,
  ctx: ChallengeEvalContext,
  hintIndex: number,
): CoachFeedback {
  const { config, result } = ctx;
  const def = challengeId ? getChallengeById(challengeId) : null;

  if (config.coupling === "poor" && result.surfaceTemp > result.targetTemp + 1.5) {
    return {
      message: "Você está aquecendo a superfície mais do que o alvo. Revise o acoplamento.",
      tone: "warning",
    };
  }

  if (
    config.beamProfile === "focused" &&
    config.focusDepth != null &&
    Math.abs(result.maxTempDepth - config.focusDepth) > 1.2
  ) {
    return {
      message: "O foco está profundo demais para esse cenário — ajuste a profundidade focal.",
      tone: "tip",
    };
  }

  if (result.periostealRisk > 0.35 || result.boneReflection > 0.25) {
    return {
      message: "O osso está refletindo energia; reduza intensidade ou mude movimento.",
      tone: "warning",
    };
  }

  if (config.mode === "pulsed" && result.maxTemp < 44 && result.periostealRisk < 0.35) {
    return {
      message: "Boa escolha: o modo pulsado reduziu carga térmica.",
      tone: "success",
    };
  }

  if (config.movement === "scanning" && result.maxTemp < 45) {
    return {
      message: "Varredura está distribuindo energia — continue observando o alvo.",
      tone: "success",
    };
  }

  if (def && def.coachHints.length > 0) {
    const idx = Math.min(hintIndex, def.coachHints.length - 1);
    return { message: def.coachHints[idx], tone: "tip" };
  }

  return {
    message: "Explore parâmetros e observe como risco, temperatura e profundidade respondem.",
    tone: "tip",
  };
}
