import { useCallback, useMemo, useState } from "react";
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
  primaryFeedback: ActiveConditionalFeedback | null;
}

/**
 * Motor reativo do gráfico paramétrico.
 * Recalcula curvas e feedbacks a cada mudança de slider — otimizado com useMemo.
 */
export function useDynamicChart(config: DynamicChartBlockData): UseDynamicChartResult {
  const [parameterValues, setParameterValues] = useState<Record<string, number>>(() =>
    initialParameterState(config.parameters),
  );

  // Sincroniza quando admin troca preset/parâmetros
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
    () => computeChartSeries(config, effectiveValues),
    [config, effectiveValues],
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

  const primaryFeedback = useMemo(() => {
    const active = activeFeedbacks.filter((f) => f.isActive);
    return active.length > 0 ? active[0] : null;
  }, [activeFeedbacks]);

  return {
    parameterValues: effectiveValues,
    setParameter,
    resetParameters,
    series,
    chartData,
    yDomain,
    activeFeedbacks,
    primaryFeedback,
  };
}
