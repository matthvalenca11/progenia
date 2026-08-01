import type { DynamicChartBlockData } from "@/types/dynamicChart";

export const DYNAMIC_CHART_VALIDATION_MESSAGE =
  "Selecione um gráfico paramétrico publicado para cada bloco de gráfico interativo.";

export const CAPSULA_CHART_VALIDATION_MESSAGE =
  "Selecione um gráfico paramétrico publicado ou remova a seção de gráfico da cápsula.";

export function isInlineDynamicChartData(data: unknown): data is DynamicChartBlockData {
  if (!data || typeof data !== "object") return false;
  const candidate = data as DynamicChartBlockData;
  return typeof candidate.source_type === "string" && Array.isArray(candidate.parameters);
}

/** Bloco de aula com chartId vazio e sem config legada inline. */
export function isEmptyDynamicChartReference(data: unknown): boolean {
  if (!data || typeof data !== "object") return true;
  const block = data as { chartId?: string };
  const chartId = block.chartId?.trim();
  if (chartId) return false;
  return !isInlineDynamicChartData(data);
}

export function validateLessonDynamicChartBlocks(
  blocks: Array<{ type: string; data?: unknown }>,
): void {
  for (const block of blocks) {
    if (block.type !== "dynamic_chart") continue;
    if (isEmptyDynamicChartReference(block.data)) {
      throw new Error(DYNAMIC_CHART_VALIDATION_MESSAGE);
    }
  }
}

export function validateCapsulaDynamicChartSelection(
  showDynamicChart: boolean,
  chartId: string | undefined,
): void {
  if (!showDynamicChart) return;
  const normalized = chartId?.trim();
  if (!normalized || normalized === "none") {
    throw new Error(CAPSULA_CHART_VALIDATION_MESSAGE);
  }
}
