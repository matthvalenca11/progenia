import type { DynamicChartBlockData, DynamicChartPresetId } from "@/types/dynamicChart";
import { ELECTROTHERAPY_PRESET_DEFINITIONS } from "./electrotherapy";
import { NEUROPHYSIOLOGY_PRESET_DEFINITIONS } from "./neurophysiology";
import { BIOMECHANICS_PRESET_DEFINITIONS } from "./biomechanics";
import { CARDIORESPIRATORY_PRESET_DEFINITIONS } from "./cardiorespiratory";
import { PHARMACOLOGY_PRESET_DEFINITIONS } from "./pharmacology";

const ALL = {
  ...ELECTROTHERAPY_PRESET_DEFINITIONS,
  ...NEUROPHYSIOLOGY_PRESET_DEFINITIONS,
  ...BIOMECHANICS_PRESET_DEFINITIONS,
  ...CARDIORESPIRATORY_PRESET_DEFINITIONS,
  ...PHARMACOLOGY_PRESET_DEFINITIONS,
} as Record<DynamicChartPresetId, () => DynamicChartBlockData>;

export function buildPresetBlockData(presetId: DynamicChartPresetId): DynamicChartBlockData {
  const factory = ALL[presetId];
  if (!factory) throw new Error(`Unknown preset: ${presetId}`);
  return structuredClone(factory());
}
