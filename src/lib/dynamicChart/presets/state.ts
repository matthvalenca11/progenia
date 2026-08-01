import type { DynamicChartBlockData } from "@/types/dynamicChart";
import {
  DEFAULT_DYNAMIC_CHART_PRESET_ID,
  type DynamicChartPresetId,
} from "@/types/dynamicChart";
import { buildPresetBlockData } from "./definitions";
import { getPresetCatalogEntry } from "./catalog";
import { buildCustomFormulasFromPreset } from "./presetFormulaTemplates";
import { t } from "./helpers";

const DEFAULT_CUSTOM_FORMULAS: NonNullable<DynamicChartBlockData["formulas"]> = [
  {
    id: "series1",
    name: t("Série 1", "Series 1"),
    equation: "a * sin(x) + b",
    color: "hsl(var(--primary))",
    thickness: 2.5,
  },
];

export interface ApplyClinicalPresetOptions {
  /**
   * Quando true, mantém título/subtítulo/descrição já editados pelo admin.
   */
  preservePresentation?: boolean;
  /**
   * Quando true, mantém eixos e feedbacks condicionais do config atual ao trocar de preset.
   * Parâmetros e preset_id sempre vêm do novo modelo (IDs do motor clínico).
   */
  preserveAxesAndFeedbacks?: boolean;
}

/**
 * Aplica preset clínico. Por padrão redefine eixos, parâmetros e feedbacks a partir do preset.
 */
export function applyClinicalPreset(
  current: DynamicChartBlockData,
  presetId: DynamicChartPresetId,
  options: ApplyClinicalPresetOptions = {},
): DynamicChartBlockData {
  const { preservePresentation = false, preserveAxesAndFeedbacks = false } = options;
  const preset = buildPresetBlockData(presetId);

  if (!preservePresentation && !preserveAxesAndFeedbacks) {
    return preset;
  }

  const next: DynamicChartBlockData = {
    ...preset,
    ...(preservePresentation
      ? {
          title: current.title || preset.title,
          subtitle: current.subtitle ?? preset.subtitle,
          description: current.description ?? preset.description,
          feedbackDisplayMode: current.feedbackDisplayMode ?? preset.feedbackDisplayMode,
        }
      : {}),
    ...(preserveAxesAndFeedbacks
      ? {
          axes: structuredClone(current.axes),
          conditionalFeedbacks: structuredClone(current.conditionalFeedbacks),
        }
      : {}),
  };

  return next;
}

/**
 * Importa preset para modo custom: copia parâmetros, eixos, feedbacks e fórmulas editáveis
 * (sem preset_id — o admin controla tudo livremente).
 */
export function ejectPresetToCustomFormula(
  current: DynamicChartBlockData,
  presetId: DynamicChartPresetId,
): DynamicChartBlockData {
  const preset = buildPresetBlockData(presetId);
  const catalog = getPresetCatalogEntry(presetId);
  const readonlyEquations = catalog?.readonly_equations ?? [];
  const formulas = buildCustomFormulasFromPreset(presetId, readonlyEquations);

  return {
    source_type: "custom_formula",
    preset_id: undefined,
    title: preset.title,
    subtitle: preset.subtitle,
    description: preset.description,
    axes: structuredClone(preset.axes),
    parameters: structuredClone(preset.parameters),
    conditionalFeedbacks: structuredClone(preset.conditionalFeedbacks),
    formulas,
    feedbackDisplayMode: current.feedbackDisplayMode ?? preset.feedbackDisplayMode,
  };
}

/** Restaura eixos, parâmetros e feedbacks de fábrica do preset ativo; mantém textos ao aluno. */
export function restorePresetDefaults(current: DynamicChartBlockData): DynamicChartBlockData {
  if (current.source_type !== "preset" || !current.preset_id) {
    return current;
  }
  return applyClinicalPreset(current, current.preset_id, { preservePresentation: true });
}

export function createEmptyCustomBlock(): DynamicChartBlockData {
  return {
    source_type: "custom_formula",
    title: t("Gráfico Paramétrico", "Parametric Chart"),
    subtitle: t("Fórmula customizada", "Custom formula"),
    description: t(
      "Ajuste os parâmetros e observe a curva em tempo real.",
      "Adjust parameters and observe the curve in real time.",
    ),
    axes: {
      x: {
        label: t("Eixo X", "X axis"),
        unit: "",
        min: 0,
        max: 10,
        scaleMode: "fixed",
        sampleCount: 100,
      },
      y: {
        label: t("Eixo Y", "Y axis"),
        unit: "",
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "a",
        name: t("Parâmetro A", "Parameter A"),
        min: 0,
        max: 10,
        step: 0.1,
        defaultValue: 2,
      },
      {
        id: "b",
        name: t("Parâmetro B", "Parameter B"),
        min: 0,
        max: 10,
        step: 0.1,
        defaultValue: 1,
      },
    ],
    formulas: structuredClone(DEFAULT_CUSTOM_FORMULAS),
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "a > 5",
        feedbackText: t(
          "**Parâmetro A elevado:** a amplitude da oscilação aumenta significativamente.",
          "**High parameter A:** oscillation amplitude increases significantly.",
        ),
        type: "info",
        priority: 1,
      },
    ],
    feedbackDisplayMode: "highest_priority",
  };
}

/** Troca preset ↔ custom. Preset sempre aplica reset completo do modelo clínico. */
export function switchSourceType(
  current: DynamicChartBlockData,
  sourceType: DynamicChartBlockData["source_type"],
): DynamicChartBlockData {
  if (current.source_type === sourceType) return current;

  if (sourceType === "custom_formula") {
    const custom = createEmptyCustomBlock();
    return {
      ...custom,
      title: current.title || custom.title,
      subtitle: current.subtitle ?? custom.subtitle,
      description: current.description ?? custom.description,
      feedbackDisplayMode: current.feedbackDisplayMode ?? custom.feedbackDisplayMode,
      formulas:
        current.formulas && current.formulas.length > 0
          ? structuredClone(current.formulas)
          : custom.formulas,
    };
  }

  const presetId = current.preset_id ?? DEFAULT_DYNAMIC_CHART_PRESET_ID;
  return applyClinicalPreset(current, presetId, { preservePresentation: true });
}

/**
 * @deprecated Use applyClinicalPreset — mantido temporariamente para imports legados.
 */
export function selectPresetKeepingState(
  current: DynamicChartBlockData,
  presetId: DynamicChartPresetId,
  options: Omit<ApplyClinicalPresetOptions, never> = {},
): DynamicChartBlockData {
  return applyClinicalPreset(current, presetId, {
    preservePresentation: true,
    ...options,
  });
}
