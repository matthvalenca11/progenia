import { create, all } from "mathjs";
import type { DynamicChartParameter } from "@/types/dynamicChart";

const math = create(all, {});

/** Escopo seguro: apenas parâmetros numéricos + operadores lógicos */
function buildScope(parameters: Record<string, number>): Record<string, number> {
  return { ...parameters };
}

/** Normaliza operadores JS para math.js (and/or) */
function normalizeCondition(expr: string): string {
  return expr.replace(/&&/g, " and ").replace(/\|\|/g, " or ");
}

/**
 * Avalia condição booleana do Visual Logic Builder.
 * Ex: "amplitude > 50 && pulse_width < 100"
 */
export function evaluateCondition(
  condition: string,
  parameterValues: Record<string, number>,
): boolean {
  if (!condition.trim()) return false;
  try {
    const scope = buildScope(parameterValues);
    const compiled = math.parse(normalizeCondition(condition)).compile();
    const result = compiled.evaluate(scope);
    return Boolean(result);
  } catch {
    return false;
  }
}

export function parameterValuesFromList(
  parameters: DynamicChartParameter[],
  values: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of parameters) {
    out[p.id] = values[p.id] ?? p.defaultValue;
  }
  return out;
}
