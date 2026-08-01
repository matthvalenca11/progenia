import { useCallback, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import type {
  ActiveConditionalFeedback,
  ComputedChartSeries,
  DynamicChartBlockData,
  DynamicChartParameter,
} from "@/types/dynamicChart";
import {
  evaluateCondition,
  parameterValuesFromList,
} from "@/lib/dynamicChart/conditionEvaluator";
import {
  computeChartSeries,
  resolveYDomain,
  seriesToRechartsData,
} from "@/lib/dynamicChart/formulaEngine";

function initialParameterState(parameters: DynamicChartParameter[]): Record<string, number> {
  return Object.fromEntries(parameters.map((p) => [p.id, p.defaultValue]));
}

export interface UseDynamicChartResult {
  parameterValues: Record<string, number>;
  setParameter: (id: string, value: number) => void;
  resetParameters: () => void;
  series: ComputedChartSeries[];
  chartData: ReturnType<typeof seriesToRechartsData>;
  yDomain: [number, number];
  activeFeedbacks: ActiveConditionalFeedback[];
  /** Feedbacks a renderizar conforme feedbackDisplayMode */
  displayedFeedbacks: ActiveConditionalFeedback[];
  /** @deprecated Preferir displayedFeedbacks */
  primaryFeedback: ActiveConditionalFeedback | null;
}

/**
 * Motor reativo do gráfico paramétrico.
 * Recalcula curvas e feedbacks a cada mudança de slider — otimizado com useMemo.
 */
export function useDynamicChart(config: DynamicChartBlockData): UseDynamicChartResult {
  const { language } = useLanguage();
  const [parameterValues, setParameterValues] = useState<Record<string, number>>(() =>
    initialParameterState(config.parameters),
  );

  const paramKey = config.parameters.map((p) => `${p.id}:${p.defaultValue}`).join("|");
  const syncedValues = useMemo(
    () => initialParameterState(config.parameters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paramKey],
  );

  const effectiveValues = useMemo(() => {
    const merged = { ...syncedValues, ...parameterValues };
    return parameterValuesFromList(config.parameters, merged);
  }, [config.parameters, parameterValues, syncedValues]);

  const setParameter = useCallback((id: string, value: number) => {
    setParameterValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  const resetParameters = useCallback(() => {
    setParameterValues(initialParameterState(config.parameters));
  }, [config.parameters]);

  const series = useMemo(
    () => computeChartSeries(config, effectiveValues, language),
    [config, effectiveValues, language],
  );

  const chartData = useMemo(() => seriesToRechartsData(series), [series]);

  const yDomain = useMemo(
    () => resolveYDomain(series, config.axes.y),
    [series, config.axes.y],
  );

  const activeFeedbacks = useMemo((): ActiveConditionalFeedback[] => {
    const sorted = [...config.conditionalFeedbacks].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
    );
    return sorted.map((rule) => ({
      rule,
      isActive: evaluateCondition(rule.condition, effectiveValues),
    }));
  }, [config.conditionalFeedbacks, effectiveValues]);

  const displayedFeedbacks = useMemo(() => {
    const active = activeFeedbacks.filter((f) => f.isActive);
    if (active.length === 0) return [];

    const mode = config.feedbackDisplayMode ?? "highest_priority";
    if (mode === "all_active") return active;

    return [active[0]];
  }, [activeFeedbacks, config.feedbackDisplayMode]);

  const primaryFeedback = displayedFeedbacks[0] ?? null;

  return {
    parameterValues: effectiveValues,
    setParameter,
    resetParameters,
    series,
    chartData,
    yDomain,
    activeFeedbacks,
    displayedFeedbacks,
    primaryFeedback,
  };
}
