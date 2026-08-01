import type { DynamicChartFormulaSeries, DynamicChartPresetId } from "@/types/dynamicChart";
import { PRESET_SERIES_COLORS } from "./helpers";
import { t } from "./helpers";

const COLORS = PRESET_SERIES_COLORS;

interface PresetFormulaTemplate {
  id: string;
  name: ReturnType<typeof t>;
  equation: string;
  color?: string;
  thickness?: number;
}

/** Expressões mathjs alinhadas ao motor de compute — editáveis no modo custom. */
const PRESET_FORMULA_TEMPLATES: Record<DynamicChartPresetId, PresetFormulaTemplate[]> = {
  tens_strength_duration: [
    {
      id: "strength_duration",
      name: t("Intensidade mínima (mA)", "Minimum intensity (mA)"),
      equation: "rheobase * (1 + chronaxie / max(x, 0.01))",
      color: COLORS.primary,
    },
  ],
  us_attenuation: [
    {
      id: "attenuation",
      name: t("Intensidade relativa (%)", "Relative intensity (%)"),
      equation: "initial_intensity * exp(-attenuation_coeff * x)",
      color: COLORS.secondary,
    },
  ],
  pbm_arndt_schulz: [
    {
      id: "arndt_schulz",
      name: t("Efeito biológico (%)", "Biological effect (%)"),
      equation:
        "peak_effect * max(0, (x / max(optimal_dose, 0.01)) * exp(1 - x / max(optimal_dose, 0.01)))",
      color: COLORS.accent,
    },
  ],
  diathermy_penetration: [
    {
      id: "diathermy_power",
      name: t("Potência absorvida relativa (%)", "Relative absorbed power (%)"),
      equation:
        "surface_intensity * exp(-2 * x / max(penetration_depth_cm * sqrt(13.56 / max(frequency_mhz, 0.1)), 0.1))",
      color: COLORS.warning,
    },
  ],
  fes_force_frequency: [
    {
      id: "fes_force",
      name: t("Força evocada (% Fmax)", "Evoked force (% Fmax)"),
      equation: "force_max * (1 - exp(-x / max(fusion_frequency, 1)))",
      color: COLORS.primary,
    },
  ],
  action_potential: [
    {
      id: "vm",
      name: t("Potencial de membrana (Vm)", "Membrane potential (Vm)"),
      equation:
        "v_rest + (v_peak - v_rest) * (1 - exp(-x / (0.08 / max(g_na, 0.1)))) * (1 - exp(-max(0, x - 0.08 / max(g_na, 0.1) * 2.5) / (1.2 / max(g_k, 0.1))))",
      color: COLORS.primary,
    },
    {
      id: "na_phase",
      name: t("Fase Na⁺", "Na⁺ phase"),
      equation: "v_rest + (v_peak - v_rest) * (1 - exp(-x / (0.08 / max(g_na, 0.1))))",
      color: COLORS.danger,
      thickness: 1.75,
    },
    {
      id: "k_phase",
      name: t("Fase K⁺", "K⁺ phase"),
      equation:
        "v_rest - (v_peak - v_rest) * (1 - (1 - exp(-max(0, x - 0.08 / max(g_na, 0.1) * 2.5) / (1.2 / max(g_k, 0.1))))) * (1 - exp(-x / (0.08 / max(g_na, 0.1))))",
      color: COLORS.info,
      thickness: 1.75,
    },
  ],
  tms_io_curve: [
    {
      id: "tms_io",
      name: t("Amplitude MEP (µV)", "MEP amplitude (µV)"),
      equation:
        "baseline + (amplitude * x^hill_coeff) / (x^hill_coeff + ec50^hill_coeff)",
      color: COLORS.warning,
    },
  ],
  nernst_equilibrium: [
    {
      id: "nernst",
      name: t("Potencial de equilíbrio (mV)", "Equilibrium potential (mV)"),
      equation: "(61.5 / max(valence, 1)) * ((temperature + 273.15) / 310.15) * x",
      color: COLORS.accent,
    },
  ],
  nerve_accommodation: [
    {
      id: "accommodation",
      name: t("Limiar de excitação (mA)", "Excitation threshold (mA)"),
      equation: "i0 * exp(x / max(tau_accommodation, 0.1))",
      color: COLORS.secondary,
    },
  ],
  hill_force_velocity: [
    {
      id: "force_velocity",
      name: t("Força (N)", "Force (N)"),
      equation:
        "max(0, ((0.25 * f0 * f0 / max(f0, 1) - x * 0.25 * f0) / (0.25 * f0 * f0 / max(f0, 1) + max(x, 0))))",
      color: COLORS.primary,
    },
  ],
  muscle_length_tension: [
    {
      id: "length_tension",
      name: t("Força isométrica (N)", "Isometric force (N)"),
      equation: "f_max * exp(-((x - l_opt) / max(gaussian_width, 0.01))^2)",
      color: COLORS.primary,
    },
  ],
  viscoelastic_creep: [
    {
      id: "creep",
      name: t("Deformação (%)", "Strain (%)"),
      equation:
        "applied_stress * compliance * (1 - exp(-x / max(tau, 0.1))) * 100",
      color: COLORS.info,
    },
  ],
  bone_stress_strain: [
    {
      id: "bone_elastic",
      name: t("Tensão (MPa)", "Stress (MPa)"),
      equation: "min(young_modulus * 1000 * x, young_modulus * 1000 * yield_strain)",
      color: COLORS.primary,
    },
  ],
  hb_bohr_dissociation: [
    {
      id: "sao2",
      name: t("Saturação de O₂ (SaO₂)", "O₂ saturation (SaO₂)"),
      equation:
        "(100 * x^2.7) / (x^2.7 + (10^(log10(26.6) + 0.48 * (7.4 - ph) + 0.0024 * (pco2 - 40) + 0.015 * (temperature - 37)))^2.7)",
      color: "#dc2626",
    },
  ],
  frank_starling: [
    {
      id: "frank_starling",
      name: t("Volume sistólico (mL)", "Stroke volume (mL)"),
      equation: "sv_max / (1 + exp(-steepness * (x - edv_ref)))",
      color: COLORS.danger,
    },
  ],
  cardiac_output_exercise: [
    {
      id: "cardiac_output",
      name: t("Débito cardíaco (L/min)", "Cardiac output (L/min)"),
      equation: "co_rest + slope * x",
      color: COLORS.danger,
    },
  ],
  spirometry_loop: [
    {
      id: "inspiratory_limb",
      name: t("Inspiração forçada", "Forced inspiration"),
      equation: "peak_inspiratory_flow * sqrt(max(0, 1 - (x / max(vc, 0.1))^2))",
      color: COLORS.info,
    },
    {
      id: "expiratory_limb",
      name: t("Expiração forçada", "Forced expiration"),
      equation: "-peak_expiratory_flow * sqrt(max(0, 1 - ((vc - x) / max(vc, 0.1))^2))",
      color: COLORS.warning,
    },
  ],
  michaelis_menten: [
    {
      id: "mm_kinetics",
      name: t("Velocidade / efeito (u.a.)", "Rate / effect (a.u.)"),
      equation: "(vmax * x) / (km + max(x, 0))",
      color: COLORS.pharmacy,
    },
  ],
  first_order_elimination: [
    {
      id: "elimination",
      name: t("Concentração (mg/L)", "Concentration (mg/L)"),
      equation: "c0 * exp(-(0.693 / max(half_life, 0.1)) * x)",
      color: COLORS.accent,
    },
  ],
  dose_accumulation: [
    {
      id: "accumulation",
      name: t("Concentração (mg/L)", "Concentration (mg/L)"),
      equation:
        "(dose / max(1 - exp(-(0.693 / max(half_life, 0.1)) * dosing_interval), 0.01)) * (1 - exp(-(0.693 / max(half_life, 0.1)) * x))",
      color: COLORS.success,
    },
  ],
};

function buildReferenceName(referenceEquation: string, index: number) {
  const labelPt = `Referência ${index + 1}`;
  const labelEn = `Reference ${index + 1}`;
  return t(`${labelPt}: ${referenceEquation}`, `${labelEn}: ${referenceEquation}`);
}

/** Converte preset clínico em séries de fórmula custom (mathjs + equações de catálogo). */
export function buildCustomFormulasFromPreset(
  presetId: DynamicChartPresetId,
  readonlyEquations: string[],
): DynamicChartFormulaSeries[] {
  const templates = PRESET_FORMULA_TEMPLATES[presetId] ?? [];
  const count = Math.max(readonlyEquations.length, templates.length, 1);

  return Array.from({ length: count }, (_, index) => {
    const template = templates[index];
    const reference = readonlyEquations[index];

    if (template) {
      return {
        id: template.id,
        name: template.name,
        equation: template.equation,
        color: template.color ?? COLORS.primary,
        thickness: template.thickness ?? 2.5,
      };
    }

    return {
      id: `ref_${presetId}_${index}`,
      name: reference ? buildReferenceName(reference, index) : t(`Curva ${index + 1}`, `Curve ${index + 1}`),
      equation: reference ?? "",
      color: COLORS.primary,
      thickness: 2.5,
    };
  });
}
