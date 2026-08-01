import type {
  DynamicChartBlockData,
  ConditionalFeedbackRule,
  DynamicChartParameter,
} from "@/types/dynamicChart";
import { isPresetMode } from "@/types/dynamicChart";

/** Campos editáveis pelo admin mesmo em modo preset (apresentação ao aluno). */
export type PresetPresentationPatch = Partial<
  Pick<DynamicChartBlockData, "title" | "subtitle" | "description" | "feedbackDisplayMode">
>;

/** Feedback: apenas texto/tipo/prioridade — condição e IDs permanecem do preset. */
export type PresetFeedbackPresentationPatch = Partial<
  Pick<ConditionalFeedbackRule, "feedbackText" | "markdown" | "type" | "priority">
>;

export function assertPresetMode(config: DynamicChartBlockData): void {
  if (!isPresetMode(config)) {
    throw new Error("Operação permitida apenas em modo preset clínico.");
  }
}

export function patchPresetPresentation(
  config: DynamicChartBlockData,
  patch: PresetPresentationPatch,
): DynamicChartBlockData {
  return { ...config, ...patch };
}

export function patchPresetFeedbackPresentation(
  config: DynamicChartBlockData,
  feedbackId: string,
  patch: PresetFeedbackPresentationPatch,
): DynamicChartBlockData {
  assertPresetMode(config);
  return {
    ...config,
    conditionalFeedbacks: config.conditionalFeedbacks.map((rule) =>
      rule.id === feedbackId ? { ...rule, ...patch } : rule,
    ),
  };
}

/** Parâmetros: label, faixas e default editáveis; id imutável. */
export type PresetParameterPatch = Partial<
  Pick<DynamicChartParameter, "name" | "unit" | "min" | "max" | "step" | "defaultValue">
>;

export function patchPresetParameter(
  config: DynamicChartBlockData,
  parameterId: string,
  patch: PresetParameterPatch,
): DynamicChartBlockData {
  assertPresetMode(config);
  return {
    ...config,
    parameters: config.parameters.map((param) =>
      param.id === parameterId ? { ...param, ...patch, id: param.id } : param,
    ),
  };
}

/** Bloqueia mutações estruturais (parâmetros, eixos, fórmulas) em modo preset. */
export function rejectPresetStructuralMutation(config: DynamicChartBlockData): void {
  if (isPresetMode(config)) {
    throw new Error(
      "Em modo preset clínico, eixos, parâmetros e fórmulas são imutáveis. Restaure os defaults ou use fórmula customizada.",
    );
  }
}
