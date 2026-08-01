/**
 * Gráfico Interativo Paramétrico — modelo de domínio.
 * Compatível com serialização JSON no CMS (lessons.content_data.blocks[]).
 * UI pensada para espelhamento futuro em Flutter (sliders, séries, feedbacks).
 */

export type DynamicChartSourceType = "custom_formula" | "preset";

/** Agrupamento clínico do catálogo de presets (27 modelos). */
export type ClinicalPresetCategoryId =
  | "electrotherapy"
  | "ultrasound"
  | "photobiomodulation"
  | "diathermy"
  | "neurophysiology"
  | "biomechanics"
  | "cardiorespiratory"
  | "pharmacology";

export type DynamicChartPresetId =
  /** Eletroterapia */
  | "tens_strength_duration"
  | "us_attenuation"
  | "pbm_arndt_schulz"
  | "diathermy_penetration"
  | "fes_force_frequency"
  | "nmes_force_pulse_width"
  | "fes_fatigue_session"
  | "us_sata_duty"
  | "us_frequency_penetration"
  | "pbm_dose_time"
  | "pbm_wavelength_penetration"
  | "diathermy_heating_time"
  /** Neurofisiologia */
  | "action_potential"
  | "tms_io_curve"
  | "nernst_equilibrium"
  | "nerve_accommodation"
  /** Biomecânica */
  | "hill_force_velocity"
  | "muscle_length_tension"
  | "viscoelastic_creep"
  | "bone_stress_strain"
  /** Cardio / Respiratória */
  | "hb_bohr_dissociation"
  | "frank_starling"
  | "cardiac_output_exercise"
  | "spirometry_loop"
  /** Farmacologia */
  | "michaelis_menten"
  | "first_order_elimination"
  | "dose_accumulation";

/** Preset padrão ao criar gráfico novo ou voltar de modo custom. */
export const DEFAULT_DYNAMIC_CHART_PRESET_ID: DynamicChartPresetId = "tens_strength_duration";

export const DYNAMIC_CHART_PRESET_IDS: DynamicChartPresetId[] = [
  "tens_strength_duration",
  "us_attenuation",
  "pbm_arndt_schulz",
  "diathermy_penetration",
  "fes_force_frequency",
  "nmes_force_pulse_width",
  "fes_fatigue_session",
  "us_sata_duty",
  "us_frequency_penetration",
  "pbm_dose_time",
  "pbm_wavelength_penetration",
  "diathermy_heating_time",
  "action_potential",
  "tms_io_curve",
  "nernst_equilibrium",
  "nerve_accommodation",
  "hill_force_velocity",
  "muscle_length_tension",
  "viscoelastic_creep",
  "bone_stress_strain",
  "hb_bohr_dissociation",
  "frank_starling",
  "cardiac_output_exercise",
  "spirometry_loop",
  "michaelis_menten",
  "first_order_elimination",
  "dose_accumulation",
];

/** Como exibir feedbacks condicionais ativos. */
export type DynamicChartFeedbackDisplayMode = "highest_priority" | "all_active";

/** Categorias editoriais — alinhadas ao lab_type dos Labs Virtuais. */
export type ParametricChartCategory =
  | "electrotherapy"
  | "photobiomodulation"
  | "ultrasound"
  | "ultrasound_therapy"
  | "tms"
  | "biomechanics"
  | "other";

export type AxisScaleMode = "fixed" | "auto";

/** Texto localizado (padrão Landing / cards de demo). */
export interface I18nText {
  pt: string;
  en: string;
}

/**
 * Aceita string monolíngue (legado inline) ou objeto pt/en.
 * Strings legadas são tratadas como conteúdo em português na camada de resolução.
 */
export type MaybeI18nText = string | I18nText;

export interface DynamicChartAxis {
  label: MaybeI18nText;
  unit?: string;
  min?: number;
  max?: number;
  sampleCount?: number;
  scaleMode: AxisScaleMode;
}

/** @deprecated Preferir `DynamicChartAxis`. Mantido para compatibilidade com imports existentes. */
export type DynamicChartAxisConfig = DynamicChartAxis;

export interface DynamicChartParameter {
  id: string;
  name: MaybeI18nText;
  unit?: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

/**
 * Série de fórmula customizada.
 * Campos novos: equation, name, thickness.
 * Campos legados: expression, label, strokeWidth — ainda válidos em conteúdo inline antigo.
 */
export interface DynamicChartFormulaSeries {
  id: string;
  /** y = f(x) — variáveis: x + ids dos parâmetros */
  equation?: string;
  name?: MaybeI18nText;
  color?: string;
  thickness?: number;
  /** @deprecated Preferir `equation` */
  expression?: string;
  /** @deprecated Preferir `name` */
  label?: string;
  /** @deprecated Preferir `thickness` */
  strokeWidth?: number;
}

export type ConditionalFeedbackType = "info" | "warning" | "success";

export interface ConditionalFeedbackRule {
  id: string;
  /** Ex: "amplitude > 50 && pulse_width < 100" */
  condition: string;
  /** Texto exibido ao aluno (legado + i18n). Suporta Markdown. */
  feedbackText?: MaybeI18nText;
  /** Alias estruturado para feedbackText — preferido em conteúdo novo. */
  markdown?: MaybeI18nText;
  type: ConditionalFeedbackType;
  priority?: number;
}

export interface DynamicChartBlockData {
  source_type: DynamicChartSourceType;
  preset_id?: DynamicChartPresetId;
  title: MaybeI18nText;
  subtitle?: MaybeI18nText;
  description?: MaybeI18nText;
  axes: {
    x: DynamicChartAxis;
    y: DynamicChartAxis;
  };
  parameters: DynamicChartParameter[];
  /** Usado quando source_type === 'custom_formula' — suporta múltiplas séries. */
  formulas?: DynamicChartFormulaSeries[];
  conditionalFeedbacks: ConditionalFeedbackRule[];
  /**
   * Modo de exibição de feedbacks.
   * @default "highest_priority" (compatível com conteúdo legado)
   */
  feedbackDisplayMode?: DynamicChartFeedbackDisplayMode;
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

export type DynamicChartPresetIcon =
  | "curve"
  | "bell"
  | "decay"
  | "sigmoid"
  | "wave"
  | "heart"
  | "muscle"
  | "lung"
  | "nerve"
  | "joint"
  | "bone"
  | "pharmacy";

/** Categoria clínica do catálogo (agrupa os 20 presets). */
export interface ClinicalPresetCategory {
  id: ClinicalPresetCategoryId;
  label: I18nText;
  presetIds: DynamicChartPresetId[];
}

/** Preset metadata para o seletor do admin (i18n-ready). */
export interface DynamicChartPresetMeta {
  id: DynamicChartPresetId;
  title: I18nText;
  /** Subtítulo curto exibido no card e no resumo do seletor. */
  subtitle: I18nText;
  description: I18nText;
  /** Categoria clínica de agrupamento (ex.: Biomecânica, Eletroterapia). */
  category: ClinicalPresetCategoryId;
  /** Disciplina / subárea para busca e badges. */
  discipline: I18nText;
  icon: DynamicChartPresetIcon;
  /**
   * Equações literais exibidas na aba Fórmulas (modo preset, somente leitura).
   * Notação matemática em texto — preparada para renderização futura (KaTeX).
   */
  readonly_equations: string[];
}

export function createI18nText(pt: string, en: string): I18nText {
  return { pt, en };
}

/** Normaliza string legada ou objeto parcial para { pt, en }. */
export function normalizeToI18nText(value: MaybeI18nText | undefined): I18nText {
  if (value == null) return { pt: "", en: "" };
  if (typeof value === "string") return { pt: value, en: value };
  return { pt: value.pt ?? "", en: value.en ?? "" };
}

/** Lê um campo localizado para edição no admin. */
export function readI18nField(
  value: MaybeI18nText | undefined,
  language: "pt" | "en" = "pt",
): string {
  return normalizeToI18nText(value)[language];
}

/** Atualiza um campo localizado preservando o outro idioma. */
export function writeI18nField(
  value: MaybeI18nText | undefined,
  language: "pt" | "en",
  text: string,
): I18nText {
  const current = normalizeToI18nText(value);
  return { ...current, [language]: text };
}

export function resolvePresetMetaField(
  value: I18nText,
  language: "pt" | "en" = "pt",
): string {
  if (language === "en" && value.en.trim()) return value.en;
  return value.pt;
}

export function isPresetMode(config: DynamicChartBlockData): boolean {
  return config.source_type === "preset" && !!config.preset_id;
}

/** Labels para dropdown de categoria no admin. */
export const PARAMETRIC_CHART_CATEGORY_OPTIONS: {
  value: ParametricChartCategory;
  label: string;
}[] = [
  { value: "electrotherapy", label: "Eletroterapia" },
  { value: "photobiomodulation", label: "Fotobiomodulação" },
  { value: "ultrasound", label: "Ultrassom diagnóstico" },
  { value: "ultrasound_therapy", label: "Ultrassom terapêutico" },
  { value: "tms", label: "Estimulação magnética (TMS)" },
  { value: "biomechanics", label: "Biomecânica / Cinesiologia" },
  { value: "other", label: "Outros" },
];

export function getCategoryLabel(category: string | null | undefined): string {
  if (!category) return "Sem categoria";
  return PARAMETRIC_CHART_CATEGORY_OPTIONS.find((o) => o.value === category)?.label ?? category;
}

export function resolveI18nText(
  value: MaybeI18nText | undefined,
  language: "pt" | "en" = "pt",
): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (language === "en" && value.en.trim()) return value.en;
  return value.pt;
}

export function normalizeFormulaSeries(
  series: DynamicChartFormulaSeries,
  language: "pt" | "en" = "pt",
): {
  id: string;
  label: string;
  expression: string;
  color?: string;
  strokeWidth?: number;
} {
  return {
    id: series.id,
    label: resolveI18nText(series.name ?? series.label, language),
    expression: series.equation ?? series.expression ?? "",
    color: series.color,
    strokeWidth: series.thickness ?? series.strokeWidth,
  };
}

/** Texto do feedback (markdown ou feedbackText legado). */
export function resolveFeedbackMarkdown(rule: ConditionalFeedbackRule, language: "pt" | "en" = "pt"): string {
  return resolveI18nText(rule.markdown ?? rule.feedbackText, language);
}
