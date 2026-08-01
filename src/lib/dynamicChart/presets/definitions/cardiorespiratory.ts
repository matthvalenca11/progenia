import type { DynamicChartBlockData, DynamicChartPresetId } from "@/types/dynamicChart";
import { t } from "../helpers";

function presetBlock(
  presetId: DynamicChartPresetId,
  data: Omit<DynamicChartBlockData, "source_type" | "preset_id">,
): DynamicChartBlockData {
  return {
    source_type: "preset",
    preset_id: presetId,
    feedbackDisplayMode: "highest_priority",
    ...data,
  };
}

/**
 * Curva de dissociação da hemoglobina (Hill) com deslocamento de P50 pelo efeito Bohr.
 * SaO2 = 100 · PO2^n / (P50^n + PO2^n)
 * log10(P50) = log10(P50_ref) + 0,48·(7,4 − pH) + 0,0024·(pCO2 − 40) + 0,015·(T − 37)
 */
function hbBohrDissociation(): DynamicChartBlockData {
  return presetBlock("hb_bohr_dissociation", {
    title: t("Curva de Dissociação da Hemoglobina", "Hemoglobin Dissociation Curve"),
    subtitle: t(
      "Efeito Bohr — pH, pCO₂ e temperatura",
      "Bohr effect — pH, pCO₂, and temperature",
    ),
    description: t(
      "A afinidade da hemoglobina pelo O₂ (curva sigmoide de Hill) desloca-se com pH, pCO₂ e temperatura, alterando o P50 e a saturação arterial para uma mesma PO₂.",
      "Hemoglobin's affinity for O₂ (Hill sigmoid curve) shifts with pH, pCO₂, and temperature, changing P50 and arterial saturation for a given PO₂.",
    ),
    axes: {
      x: {
        label: t("Pressão parcial de O₂ (PO₂)", "Partial pressure of O₂ (PO₂)"),
        unit: "mmHg",
        min: 0,
        max: 100,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Saturação de O₂ (SaO₂)", "O₂ saturation (SaO₂)"),
        unit: "%",
        min: 0,
        max: 100,
        scaleMode: "fixed",
      },
    },
    parameters: [
      {
        id: "pco2",
        name: t("pCO₂", "pCO₂"),
        unit: "mmHg",
        min: 25,
        max: 60,
        step: 1,
        defaultValue: 40,
      },
      {
        id: "ph",
        name: t("pH", "pH"),
        unit: "",
        min: 7.2,
        max: 7.6,
        step: 0.01,
        defaultValue: 7.4,
      },
      {
        id: "temperature",
        name: t("Temperatura", "Temperature"),
        unit: "°C",
        min: 34,
        max: 40,
        step: 0.5,
        defaultValue: 37,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "ph < 7.35",
        feedbackText: t(
          "**Acidose (Bohr):** pH baixo desloca a curva para a direita — menor afinidade da Hb por O₂ (P50 elevado).",
          "**Acidosis (Bohr):** low pH shifts the curve to the right — lower Hb affinity for O₂ (elevated P50).",
        ),
        type: "warning",
        priority: 2,
      },
      {
        id: "fb2",
        condition: "pco2 > 45",
        feedbackText: t(
          "**Hipercapnia:** pCO₂ elevado desloca a curva para a direita, facilitando liberação de O₂ nos tecidos.",
          "**Hypercapnia:** elevated pCO₂ shifts the curve to the right, facilitating O₂ release to tissues.",
        ),
        type: "info",
        priority: 1,
      },
      {
        id: "fb3",
        condition: "temperature > 38",
        feedbackText: t(
          "**Temperatura elevada:** aumento térmico reduz afinidade da hemoglobina — útil na entrega periférica de O₂.",
          "**Elevated temperature:** thermal increase reduces hemoglobin affinity — useful for peripheral O₂ delivery.",
        ),
        type: "info",
        priority: 3,
      },
    ],
  });
}

/** SV(EDV) = SV_max / (1 + exp(−steepness·(EDV − EDV_ref))) — Lei de Frank-Starling */
function frankStarling(): DynamicChartBlockData {
  return presetBlock("frank_starling", {
    title: t("Lei de Frank-Starling", "Frank-Starling Law"),
    subtitle: t("Volume diastólico × volume sistólico", "End-diastolic volume × stroke volume"),
    description: t(
      "O coração contrai com mais força e ejeta maior volume sistólico quando o retorno venoso (pré-carga) aumenta, até atingir um platô de saturação contrátil.",
      "The heart contracts more forcefully and ejects a greater stroke volume when venous return (preload) increases, until reaching a contractile saturation plateau.",
    ),
    axes: {
      x: {
        label: t("Volume diastólico final (EDV)", "End-diastolic volume (EDV)"),
        unit: "mL",
        min: 40,
        max: 200,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Volume sistólico (SV)", "Stroke volume (SV)"),
        unit: "mL",
        min: 0,
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "sv_max",
        name: t("Volume sistólico máximo (SVmax)", "Maximum stroke volume (SVmax)"),
        unit: "mL",
        min: 60,
        max: 120,
        step: 1,
        defaultValue: 90,
      },
      {
        id: "edv_ref",
        name: t("EDV de referência (centro da curva)", "Reference EDV (curve center)"),
        unit: "mL",
        min: 80,
        max: 160,
        step: 1,
        defaultValue: 120,
      },
      {
        id: "steepness",
        name: t("Inclinação da curva", "Curve steepness"),
        unit: "",
        min: 0.01,
        max: 0.05,
        step: 0.001,
        defaultValue: 0.03,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "edv_ref > 140",
        feedbackText: t(
          "**EDV de referência elevado:** curva deslocada para a direita — sugere contratilidade reduzida (ex.: insuficiência cardíaca).",
          "**High reference EDV:** curve shifted to the right — suggests reduced contractility (e.g., heart failure).",
        ),
        type: "warning",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "sv_max > 100",
        feedbackText: t(
          "**SVmax elevado:** boa capacidade contrátil e de ejeção — perfil compatível com coração bem condicionado.",
          "**High SVmax:** good contractile and ejection capacity — profile consistent with a well-conditioned heart.",
        ),
        type: "success",
        priority: 2,
      },
      {
        id: "fb3",
        condition: "steepness < 0.02",
        feedbackText: t(
          "**Curva mais achatada:** menor sensibilidade do volume sistólico às variações de pré-carga.",
          "**Flatter curve:** lower sensitivity of stroke volume to preload variations.",
        ),
        type: "info",
        priority: 3,
      },
    ],
  });
}

/** CO(W) = CO_rest + slope · W — resposta cardiovascular linear ao exercício submáximo */
function cardiacOutputExercise(): DynamicChartBlockData {
  return presetBlock("cardiac_output_exercise", {
    title: t("Débito Cardíaco × Exercício", "Cardiac Output × Exercise"),
    subtitle: t("Resposta cardiovascular ao esforço", "Cardiovascular response to effort"),
    description: t(
      "O débito cardíaco aumenta de forma aproximadamente linear com a carga de trabalho durante exercício submáximo, refletindo o ajuste combinado de frequência cardíaca e volume sistólico.",
      "Cardiac output increases approximately linearly with workload during submaximal exercise, reflecting the combined adjustment of heart rate and stroke volume.",
    ),
    axes: {
      x: {
        label: t("Carga de trabalho", "Workload"),
        unit: "W",
        min: 0,
        max: 200,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Débito cardíaco (CO)", "Cardiac output (CO)"),
        unit: "L/min",
        min: 0,
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "co_rest",
        name: t("Débito cardíaco de repouso", "Resting cardiac output"),
        unit: "L/min",
        min: 4,
        max: 6,
        step: 0.1,
        defaultValue: 5,
      },
      {
        id: "slope",
        name: t("Inclinação CO-carga", "CO-workload slope"),
        unit: "L/min/W",
        min: 0.02,
        max: 0.08,
        step: 0.001,
        defaultValue: 0.04,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "slope > 0.06",
        feedbackText: t(
          "**Inclinação elevada:** forte resposta cardiovascular ao esforço — grande incremento de débito por watt de carga.",
          "**High slope:** strong cardiovascular response to effort — large output increment per watt of workload.",
        ),
        type: "info",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "slope < 0.03",
        feedbackText: t(
          "**Inclinação reduzida:** resposta cardiovascular atenuada ao exercício — pode indicar incompetência cronotrópica ou descondicionamento.",
          "**Reduced slope:** blunted cardiovascular response to exercise — may indicate chronotropic incompetence or deconditioning.",
        ),
        type: "warning",
        priority: 2,
      },
      {
        id: "fb3",
        condition: "co_rest > 5.5",
        feedbackText: t(
          "**Débito de repouso elevado:** metabolismo basal aumentado ou tensão/ansiedade durante a medição de repouso.",
          "**Elevated resting output:** increased basal metabolism or tension/anxiety during resting measurement.",
        ),
        type: "info",
        priority: 3,
      },
    ],
  });
}

/**
 * Alça fluxo–volume: F_in(V) = peak_in · √(1 − (V/VC)²); F_exp(V) = −peak_exp · √(1 − ((VC−V)/VC)²)
 */
function spirometryLoop(): DynamicChartBlockData {
  return presetBlock("spirometry_loop", {
    title: t("Alça Espirométrica (Fluxo × Volume)", "Spirometry Flow–Volume Loop"),
    subtitle: t("Inspiração e expiração forçada", "Forced inspiration and expiration"),
    description: t(
      "A alça fluxo–volume relaciona o fluxo aéreo ao volume pulmonar durante manobras forçadas de inspiração e expiração, permitindo identificar padrões restritivos e obstrutivos.",
      "The flow–volume loop relates airflow to lung volume during forced inspiratory and expiratory maneuvers, allowing identification of restrictive and obstructive patterns.",
    ),
    axes: {
      x: {
        label: t("Volume pulmonar", "Lung volume"),
        unit: "L",
        min: 0,
        max: 6,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Fluxo aéreo", "Airflow"),
        unit: "L/s",
        min: -10,
        max: 10,
        scaleMode: "fixed",
      },
    },
    parameters: [
      {
        id: "vc",
        name: t("Capacidade vital (VC)", "Vital capacity (VC)"),
        unit: "L",
        min: 3,
        max: 6,
        step: 0.1,
        defaultValue: 5,
      },
      {
        id: "peak_inspiratory_flow",
        name: t("Pico de fluxo inspiratório", "Peak inspiratory flow"),
        unit: "L/s",
        min: 4,
        max: 10,
        step: 0.1,
        defaultValue: 6,
      },
      {
        id: "peak_expiratory_flow",
        name: t("Pico de fluxo expiratório", "Peak expiratory flow"),
        unit: "L/s",
        min: 3,
        max: 9,
        step: 0.1,
        defaultValue: 8,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "vc < 3.5",
        feedbackText: t(
          "**Capacidade vital reduzida:** sugere padrão restritivo — volume pulmonar mobilizável abaixo do esperado.",
          "**Reduced vital capacity:** suggests a restrictive pattern — mobilizable lung volume below expected.",
        ),
        type: "warning",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "peak_expiratory_flow < 4",
        feedbackText: t(
          "**PFE reduzido:** pico de fluxo expiratório baixo — pode indicar padrão obstrutivo das vias aéreas.",
          "**Reduced PEF:** low peak expiratory flow — may indicate an obstructive airway pattern.",
        ),
        type: "warning",
        priority: 2,
      },
      {
        id: "fb3",
        condition: "peak_inspiratory_flow > 8",
        feedbackText: t(
          "**Fluxo inspiratório elevado:** boa força muscular inspiratória e complacência das vias aéreas superiores.",
          "**High inspiratory flow:** good inspiratory muscle strength and upper airway compliance.",
        ),
        type: "success",
        priority: 3,
      },
    ],
  });
}

export const CARDIORESPIRATORY_PRESET_DEFINITIONS: Partial<
  Record<DynamicChartPresetId, () => DynamicChartBlockData>
> = {
  hb_bohr_dissociation: hbBohrDissociation,
  frank_starling: frankStarling,
  cardiac_output_exercise: cardiacOutputExercise,
  spirometry_loop: spirometryLoop,
};
