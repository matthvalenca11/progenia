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
 * Potencial de membrana simplificado: soma de fases de despolarização (Na⁺)
 * e repolarização (K⁺) com constantes de tempo moduladas por condutâncias relativas.
 */
function actionPotential(): DynamicChartBlockData {
  return presetBlock("action_potential", {
    title: t("Potencial de Ação Neuronal", "Neuronal Action Potential"),
    subtitle: t(
      "Fases de despolarização (Na⁺) e repolarização (K⁺)",
      "Depolarization (Na⁺) and repolarization (K⁺) phases",
    ),
    description: t(
      "Modelo paramétrico simplificado: a subida rápida reflete a abertura de canais de Na⁺; a repolarização depende da condutância de K⁺ e restaura o potencial de repouso.",
      "Simplified parametric model: the rapid upstroke reflects Na⁺ channel opening; repolarization depends on K⁺ conductance and restores the resting potential.",
    ),
    axes: {
      x: {
        label: t("Tempo", "Time"),
        unit: "ms",
        min: 0,
        max: 5,
        scaleMode: "fixed",
        sampleCount: 160,
      },
      y: {
        label: t("Potencial de membrana", "Membrane potential"),
        unit: "mV",
        min: -80,
        max: 40,
        scaleMode: "fixed",
      },
    },
    parameters: [
      {
        id: "g_na",
        name: t("Condutância Na⁺ (relativa)", "Na⁺ conductance (relative)"),
        unit: "",
        min: 0.3,
        max: 2.5,
        step: 0.1,
        defaultValue: 1,
      },
      {
        id: "g_k",
        name: t("Condutância K⁺ (relativa)", "K⁺ conductance (relative)"),
        unit: "",
        min: 0.3,
        max: 2.5,
        step: 0.1,
        defaultValue: 1,
      },
      {
        id: "v_rest",
        name: t("Potencial de repouso", "Resting potential"),
        unit: "mV",
        min: -80,
        max: -55,
        step: 1,
        defaultValue: -70,
      },
      {
        id: "v_peak",
        name: t("Pico de despolarização", "Depolarization peak"),
        unit: "mV",
        min: 10,
        max: 45,
        step: 1,
        defaultValue: 30,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "g_na > 1.5",
        feedbackText: t(
          "**g_Na elevada:** upslope mais rápido — maior taxa de despolarização (canal de sódio mais ativo).",
          "**High g_Na:** faster upslope — higher depolarization rate (more active sodium channel).",
        ),
        type: "warning",
        priority: 2,
      },
      {
        id: "fb2",
        condition: "g_k < 0.6",
        feedbackText: t(
          "**g_K baixa:** repolarização lenta — potencial permanece elevado por mais tempo (similar a bloqueio de K⁺).",
          "**Low g_K:** slow repolarization — potential remains elevated for longer (similar to K⁺ channel block).",
        ),
        type: "warning",
        priority: 3,
      },
      {
        id: "fb3",
        condition: "g_k > 1.5",
        feedbackText: t(
          "**g_K elevada:** repolarização acelerada — retorno mais rápido ao potencial de repouso.",
          "**High g_K:** accelerated repolarization — faster return to resting potential.",
        ),
        type: "info",
        priority: 1,
      },
    ],
  });
}

/** TMS I-O: sigmoide — y = baseline + (amp · x^n) / (x^n + ec50^n) */
function tmsIOCurve(): DynamicChartBlockData {
  return presetBlock("tms_io_curve", {
    title: t("Curva Entrada-Saída (TMS)", "Input–Output Curve (TMS)"),
    subtitle: t("Resposta motor evocada vs intensidade", "Motor evoked response vs intensity"),
    description: t(
      "A relação entre intensidade do estímulo magnético e amplitude da resposta muscular segue uma curva sigmoide.",
      "The relationship between magnetic stimulus intensity and muscle response amplitude follows a sigmoid curve.",
    ),
    axes: {
      x: {
        label: t("Intensidade do estímulo", "Stimulus intensity"),
        unit: "% MSO",
        min: 0,
        max: 100,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Amplitude MEP", "MEP amplitude"),
        unit: "µV",
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "baseline",
        name: t("Linha de base", "Baseline"),
        unit: "µV",
        min: 0,
        max: 20,
        step: 0.5,
        defaultValue: 5,
      },
      {
        id: "amplitude",
        name: t("Amplitude máxima", "Maximum amplitude"),
        unit: "µV",
        min: 50,
        max: 120,
        step: 1,
        defaultValue: 95,
      },
      {
        id: "ec50",
        name: t("EC50 (intensidade)", "EC50 (intensity)"),
        unit: "% MSO",
        min: 30,
        max: 80,
        step: 1,
        defaultValue: 55,
      },
      {
        id: "hill_coeff",
        name: t("Coef. Hill", "Hill coefficient"),
        unit: "",
        min: 1,
        max: 5,
        step: 0.1,
        defaultValue: 2.2,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "ec50 < 45",
        feedbackText: t(
          "**EC50 baixo:** córtex mais excitável — limiar motor atingido com menor intensidade de estímulo.",
          "**Low EC50:** more excitable cortex — motor threshold reached with lower stimulus intensity.",
        ),
        type: "info",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "hill_coeff > 3.5",
        feedbackText: t(
          "**Curva íngreme:** transição rápida entre subliminar e supraliminar — ajuste fino de intensidade é crítico.",
          "**Steep curve:** rapid transition between subthreshold and suprathreshold — fine intensity adjustment is critical.",
        ),
        type: "warning",
        priority: 2,
      },
    ],
  });
}

/**
 * Nernst: E = (R·T / z·F) · ln([ion]o/[ion]i) ≈ (61,5/z) · log10(razão) mV a 37 °C.
 * Eixo X é o próprio log10(razão de concentrações); parâmetros ajustam a inclinação (z) e o fator térmico (T).
 */
function nernstEquilibrium(): DynamicChartBlockData {
  return presetBlock("nernst_equilibrium", {
    title: t("Equação de Nernst", "Nernst Equation"),
    subtitle: t("Potencial de equilíbrio iônico", "Ionic equilibrium potential"),
    description: t(
      "O potencial de equilíbrio de um íon é proporcional ao logaritmo da razão entre as concentrações extra e intracelular, com inclinação determinada pela valência iônica (z) e pela temperatura.",
      "An ion's equilibrium potential is proportional to the logarithm of the extra- to intracellular concentration ratio, with slope determined by ionic valence (z) and temperature.",
    ),
    axes: {
      x: {
        label: t("log₁₀([íon]ext / [íon]int)", "log₁₀([ion]ext / [ion]int)"),
        unit: "",
        min: -2,
        max: 2,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Potencial de equilíbrio (E)", "Equilibrium potential (E)"),
        unit: "mV",
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "valence",
        name: t("Valência iônica (z)", "Ionic valence (z)"),
        unit: "",
        min: 1,
        max: 2,
        step: 1,
        defaultValue: 1,
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
        condition: "valence == 2",
        feedbackText: t(
          "**Íon divalente (z=2):** inclinação da reta reduzida à metade — íons como Ca²⁺ geram potenciais menores para a mesma razão de concentração.",
          "**Divalent ion (z=2):** the line's slope is halved — ions like Ca²⁺ generate smaller potentials for the same concentration ratio.",
        ),
        type: "info",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "temperature > 38.5",
        feedbackText: t(
          "**Temperatura elevada:** aumento discreto da inclinação da curva de Nernst (dependência direta de T em Kelvin).",
          "**Elevated temperature:** slight increase in the Nernst curve's slope (direct dependence on T in Kelvin).",
        ),
        type: "info",
        priority: 2,
      },
      {
        id: "fb3",
        condition: "temperature < 35",
        feedbackText: t(
          "**Hipotermia:** redução discreta da inclinação — potenciais de equilíbrio levemente atenuados para a mesma razão iônica.",
          "**Hypothermia:** slight reduction in slope — equilibrium potentials slightly attenuated for the same ionic ratio.",
        ),
        type: "warning",
        priority: 3,
      },
    ],
  });
}

/** Limiar(t) = I0 · exp(t/τ_acc) — acomodação neural sob estimulação contínua */
function nerveAccommodation(): DynamicChartBlockData {
  return presetBlock("nerve_accommodation", {
    title: t("Acomodação Nervosa", "Neural Accommodation"),
    subtitle: t("Elevação do limiar com estimulação repetitiva", "Threshold rise with repetitive stimulation"),
    description: t(
      "Durante estimulação contínua, o limiar de excitação neural aumenta exponencialmente ao longo do tempo (acomodação), exigindo intensidades crescentes para manter o mesmo efeito.",
      "During continuous stimulation, the neural excitation threshold rises exponentially over time (accommodation), requiring increasing intensities to maintain the same effect.",
    ),
    axes: {
      x: {
        label: t("Tempo de estimulação", "Stimulation time"),
        unit: "s",
        min: 0,
        max: 10,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Limiar de excitação", "Excitation threshold"),
        unit: "mA",
        min: 0,
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "i0",
        name: t("Limiar inicial (I₀)", "Initial threshold (I₀)"),
        unit: "mA",
        min: 5,
        max: 25,
        step: 0.5,
        defaultValue: 10,
      },
      {
        id: "tau_accommodation",
        name: t("Constante de acomodação (τ)", "Accommodation constant (τ)"),
        unit: "s",
        min: 0.5,
        max: 5,
        step: 0.1,
        defaultValue: 2,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "tau_accommodation < 1",
        feedbackText: t(
          "**Acomodação rápida:** limiar sobe rapidamente — recomenda-se modulação de frequência/amplitude para evitar habituação precoce.",
          "**Fast accommodation:** threshold rises quickly — frequency/amplitude modulation is recommended to avoid early habituation.",
        ),
        type: "warning",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "tau_accommodation > 3.5",
        feedbackText: t(
          "**Acomodação lenta:** limiar permanece relativamente estável — corrente contínua tende a manter eficácia por mais tempo.",
          "**Slow accommodation:** threshold remains relatively stable — continuous current tends to maintain efficacy for longer.",
        ),
        type: "info",
        priority: 2,
      },
      {
        id: "fb3",
        condition: "i0 > 20",
        feedbackText: t(
          "**Limiar inicial elevado:** tecido pouco excitável já no início — considere reavaliar o posicionamento dos eletrodos.",
          "**High initial threshold:** tissue is poorly excitable from the start — consider reassessing electrode placement.",
        ),
        type: "warning",
        priority: 3,
      },
    ],
  });
}

export const NEUROPHYSIOLOGY_PRESET_DEFINITIONS: Partial<
  Record<DynamicChartPresetId, () => DynamicChartBlockData>
> = {
  action_potential: actionPotential,
  tms_io_curve: tmsIOCurve,
  nernst_equilibrium: nernstEquilibrium,
  nerve_accommodation: nerveAccommodation,
};
