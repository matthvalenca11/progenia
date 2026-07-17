/**
 * Gráfico Interativo Paramétrico — modelo de domínio.
 * Compatível com serialização JSON no CMS (lessons.content_data.blocks[]).
 * UI pensada para espelhamento futuro em Flutter (sliders, séries, feedbacks).
 */

export type DynamicChartSourceType = "custom_formula" | "preset";

export type DynamicChartPresetId =
  | "tens_strength_duration"
  | "pbm_arndt_schulz"
  | "us_attenuation"
  | "tms_io_curve";

export type AxisScaleMode = "fixed" | "auto";

export interface DynamicChartAxisConfig {
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  scaleMode: AxisScaleMode;
  /** Número de pontos amostrados ao longo do eixo X */
  sampleCount?: number;
}

export interface DynamicChartParameter {
  id: string;
  name: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface DynamicChartFormulaSeries {
  id: string;
  label: string;
  /** Expressão y = f(x) — variáveis: x + ids dos parâmetros */
  expression: string;
  color?: string;
  strokeWidth?: number;
}

export type ConditionalFeedbackType = "info" | "warning" | "success";

export interface ConditionalFeedbackRule {
  id: string;
  /** Ex: "amplitude > 50 && pulse_width < 100" */
  condition: string;
  feedbackText: string;
  type: ConditionalFeedbackType;
  priority?: number;
}

export interface DynamicChartBlockData {
  source_type: DynamicChartSourceType;
  preset_id?: DynamicChartPresetId;
  title: string;
  subtitle?: string;
  description?: string;
  axes: {
    x: DynamicChartAxisConfig;
    y: DynamicChartAxisConfig;
  };
  parameters: DynamicChartParameter[];
  /** Usado quando source_type === 'custom_formula' */
  formulas?: DynamicChartFormulaSeries[];
  conditionalFeedbacks: ConditionalFeedbackRule[];
}

export interface ChartDataPoint {
  x: number;
  [seriesKey: string]: number;
}

export interface ComputedChartSeries {
  id: string;
  label: string;
  color: string;
  strokeWidth: number;
  points: Array<{ x: number; y: number }>;
}

export interface ActiveConditionalFeedback {
  rule: ConditionalFeedbackRule;
  isActive: boolean;
}

/** Preset metadata para o grid do admin */
export interface DynamicChartPresetMeta {
  id: DynamicChartPresetId;
  title: string;
  subtitle: string;
  icon: "curve" | "bell" | "decay" | "sigmoid";
  discipline: string;
}
