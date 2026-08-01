import type { ComputedChartSeries, DynamicChartBlockData } from "@/types/dynamicChart";
import { createI18nText, type I18nText, type MaybeI18nText } from "@/types/dynamicChart";

export const PRESET_SERIES_COLORS = {
  primary: "hsl(var(--primary))",
  accent: "#0ea5e9",
  secondary: "#8b5cf6",
  warning: "#f59e0b",
  success: "#10b981",
  danger: "#ef4444",
  info: "#3b82f6",
  pharmacy: "#a855f7",
} as const;

export function linspace(min: number, max: number, count: number): number[] {
  if (count <= 1) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + i * step);
}

export function i18n(pt: string, en: string): I18nText {
  return createI18nText(pt, en);
}

/** Converte par I18n para MaybeI18nText usado em config_data. */
export function t(pt: string, en: string): MaybeI18nText {
  return createI18nText(pt, en);
}

export type PresetComputeFn = (
  config: DynamicChartBlockData,
  params: Record<string, number>,
) => ComputedChartSeries[];
