import { create, all } from "mathjs";
import type {
  ChartDataPoint,
  ComputedChartSeries,
  DynamicChartAxisConfig,
  DynamicChartBlockData,
  DynamicChartFormulaSeries,
} from "@/types/dynamicChart";
import { computePresetSeries } from "./presets";

const math = create(all, {});

const DEFAULT_COLORS = [
  "hsl(var(--primary))",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
];

function linspace(min: number, max: number, count: number): number[] {
  if (count <= 1) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + i * step);
}

function resolveXRange(
  xAxis: DynamicChartAxisConfig,
  xValues: number[],
): { min: number; max: number } {
  if (xAxis.scaleMode === "fixed" && xAxis.min != null && xAxis.max != null) {
    return { min: xAxis.min, max: xAxis.max };
  }
  const min = xAxis.min ?? Math.min(...xValues, 0);
  const max = xAxis.max ?? Math.max(...xValues, 1);
  return { min, max };
}

function evaluateFormulaSeries(
  series: DynamicChartFormulaSeries,
  xSamples: number[],
  parameterValues: Record<string, number>,
  colorIndex: number,
): ComputedChartSeries {
  let compiled: ReturnType<ReturnType<typeof math.parse>["compile"]>;

  try {
    compiled = math.parse(series.expression).compile();
  } catch {
    return {
      id: series.id,
      label: series.label,
      color: series.color ?? DEFAULT_COLORS[colorIndex % DEFAULT_COLORS.length],
      strokeWidth: series.strokeWidth ?? 2.5,
      points: [],
    };
  }

  const points: Array<{ x: number; y: number }> = [];

  for (const x of xSamples) {
    try {
      const scope = { x, ...parameterValues };
      const y = compiled.evaluate(scope);
      if (typeof y === "number" && Number.isFinite(y)) {
        points.push({ x, y });
      }
    } catch {
      // ignora ponto inválido
    }
  }

  return {
    id: series.id,
    label: series.label,
    color: series.color ?? DEFAULT_COLORS[colorIndex % DEFAULT_COLORS.length],
    strokeWidth: series.strokeWidth ?? 2.5,
    points,
  };
}

export function hasValidFormulaSyntax(expression: string): boolean {
  if (!expression.trim()) return false;

  try {
    math.parse(expression);
    return true;
  } catch {
    return false;
  }
}

/** Calcula séries e pontos para Recharts a partir do bloco + estado dos sliders */
export function computeChartSeries(
  config: DynamicChartBlockData,
  parameterValues: Record<string, number>,
): ComputedChartSeries[] {
  if (config.source_type === "preset" && config.preset_id) {
    return computePresetSeries(config.preset_id, config, parameterValues);
  }

  const sampleCount = config.axes.x.sampleCount ?? 120;
  const { min, max } = resolveXRange(config.axes.x, []);
  const xSamples = linspace(min, max, sampleCount);

  return (config.formulas ?? []).map((series, i) =>
    evaluateFormulaSeries(series, xSamples, parameterValues, i),
  );
}

/** Formato unificado para Recharts LineChart (wide format) */
export function seriesToRechartsData(series: ComputedChartSeries[]): ChartDataPoint[] {
  if (series.length === 0) return [];
  const byX = new Map<number, ChartDataPoint>();

  for (const s of series) {
    for (const { x, y } of s.points) {
      const key = Number(x.toFixed(6));
      const row = byX.get(key) ?? { x: key };
      row[s.id] = y;
      byX.set(key, row);
    }
  }

  return Array.from(byX.values()).sort((a, b) => a.x - b.x);
}

export function resolveYDomain(
  series: ComputedChartSeries[],
  yAxis: DynamicChartAxisConfig,
): [number, number] {
  if (yAxis.scaleMode === "fixed" && yAxis.min != null && yAxis.max != null) {
    return [yAxis.min, yAxis.max];
  }
  const ys = series.flatMap((s) => s.points.map((p) => p.y)).filter(Number.isFinite);
  if (ys.length === 0) return [0, 1];
  const min = yAxis.min ?? Math.min(...ys);
  const max = yAxis.max ?? Math.max(...ys);
  const pad = (max - min) * 0.08 || 1;
  return [min - pad, max + pad];
}
