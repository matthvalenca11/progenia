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

/** Weiss: I = I_rh · (1 + c / t) — intensidade mínima vs largura de pulso */
function tensStrengthDuration(): DynamicChartBlockData {
  return presetBlock("tens_strength_duration", {
    title: t("Curva Intensidade × Duração (TENS)", "Strength–Duration Curve (TENS)"),
    subtitle: t("Explore reobase e cronaxia", "Explore rheobase and chronaxie"),
    description: t(
      "Manipule os parâmetros para entender como a largura do pulso altera a intensidade mínima necessária para excitar o tecido neural.",
      "Adjust the parameters to understand how pulse width changes the minimum intensity required to excite neural tissue.",
    ),
    axes: {
      x: {
        label: t("Largura do pulso", "Pulse width"),
        unit: "ms",
        min: 0.05,
        max: 2,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Intensidade mínima", "Minimum intensity"),
        unit: "mA",
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "rheobase",
        name: t("Reobase", "Rheobase"),
        unit: "mA",
        min: 5,
        max: 30,
        step: 0.5,
        defaultValue: 12,
      },
      {
        id: "chronaxie",
        name: t("Cronaxia", "Chronaxie"),
        unit: "ms",
        min: 0.1,
        max: 1.2,
        step: 0.05,
        defaultValue: 0.35,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "chronaxie < 0.25",
        feedbackText: t(
          "**Cronaxia baixa:** tecido neural com alta excitabilidade — pulso curto já atinge limiar com pouca intensidade.",
          "**Low chronaxie:** highly excitable neural tissue — a short pulse already reaches threshold with little intensity.",
        ),
        type: "info",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "chronaxie > 0.8",
        feedbackText: t(
          "**Cronaxia elevada:** fibra menos excitável — exige pulsos mais longos ou intensidades maiores (típico em tecidos desnervados).",
          "**High chronaxie:** less excitable fiber — requires longer pulses or higher intensities (typical of denervated tissue).",
        ),
        type: "warning",
        priority: 2,
      },
      {
        id: "fb3",
        condition: "rheobase > 22",
        feedbackText: t(
          "**Reobase alta:** limiar de excitação elevado — revise eletrodo, hidratação cutânea e condutividade do meio.",
          "**High rheobase:** elevated excitation threshold — check electrode, skin hydration, and medium conductivity.",
        ),
        type: "warning",
        priority: 3,
      },
    ],
  });
}

/** Atenuação: I(x) = I0 · exp(−α · x) */
function usAttenuation(): DynamicChartBlockData {
  return presetBlock("us_attenuation", {
    title: t("Atenuação do Ultrassom", "Ultrasound Attenuation"),
    subtitle: t("Decaimento exponencial com a profundidade", "Exponential decay with depth"),
    description: t(
      "A intensidade acústica diminui exponencialmente ao penetrar nos tecidos. O coeficiente de atenuação depende da frequência e do meio.",
      "Acoustic intensity decreases exponentially as it penetrates tissue. The attenuation coefficient depends on frequency and medium.",
    ),
    axes: {
      x: {
        label: t("Profundidade", "Depth"),
        unit: "cm",
        min: 0,
        max: 6,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Intensidade", "Intensity"),
        unit: "%",
        min: 0,
        max: 105,
        scaleMode: "fixed",
      },
    },
    parameters: [
      {
        id: "initial_intensity",
        name: t("Intensidade inicial", "Initial intensity"),
        unit: "%",
        min: 50,
        max: 100,
        step: 1,
        defaultValue: 100,
      },
      {
        id: "attenuation_coeff",
        name: t("Coef. atenuação α", "Attenuation coeff. α"),
        unit: "dB/cm",
        min: 0.2,
        max: 2,
        step: 0.05,
        defaultValue: 0.8,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "attenuation_coeff > 1.2",
        feedbackText: t(
          "**Alta atenuação:** tecidos com maior absorção (ex.: frequências altas ou meios densos) — energia concentrada superficialmente.",
          "**High attenuation:** tissues with greater absorption (e.g. higher frequencies or denser media) — energy concentrated superficially.",
        ),
        type: "warning",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "attenuation_coeff < 0.4",
        feedbackText: t(
          "**Baixa atenuação:** melhor penetração — útil para alvos profundos, mas atenção ao aquecimento superficial.",
          "**Low attenuation:** better penetration — useful for deep targets, but watch for superficial heating.",
        ),
        type: "info",
        priority: 2,
      },
    ],
  });
}

/** Arndt-Schulz: efeito ótimo em dose intermediária — y = A · (d/d0) · exp(1 − d/d0) */
function pbmArndtSchulz(): DynamicChartBlockData {
  return presetBlock("pbm_arndt_schulz", {
    title: t("Lei de Arndt-Schulz (Fotobiomodulação)", "Arndt-Schulz Law (Photobiomodulation)"),
    subtitle: t("Dose × efeito biológico", "Dose × biological effect"),
    description: t(
      "A resposta biológica à luz segue uma curva bifásica: doses muito baixas ou muito altas reduzem o efeito terapêutico.",
      "The biological response to light follows a biphasic curve: doses that are too low or too high reduce the therapeutic effect.",
    ),
    axes: {
      x: {
        label: t("Dose energética", "Energy dose"),
        unit: "J/cm²",
        min: 0,
        max: 12,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Efeito biológico", "Biological effect"),
        unit: "%",
        min: 0,
        max: 110,
        scaleMode: "fixed",
      },
    },
    parameters: [
      {
        id: "optimal_dose",
        name: t("Dose ótima", "Optimal dose"),
        unit: "J/cm²",
        min: 1,
        max: 8,
        step: 0.2,
        defaultValue: 4,
      },
      {
        id: "peak_effect",
        name: t("Pico de efeito", "Peak effect"),
        unit: "%",
        min: 40,
        max: 100,
        step: 1,
        defaultValue: 100,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "optimal_dose < 2.5",
        feedbackText: t(
          "**Janela terapêutica estreita:** doses ótimas baixas — pequenos desvios de potência podem sair da faixa eficaz.",
          "**Narrow therapeutic window:** low optimal doses — small deviations in power can fall outside the effective range.",
        ),
        type: "info",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "peak_effect > 85",
        feedbackText: t(
          "**Resposta robusta:** o pico de efeito está alto — parâmetros dentro da faixa clínica favorável.",
          "**Robust response:** peak effect is high — parameters within the favorable clinical range.",
        ),
        type: "success",
        priority: 2,
      },
    ],
  });
}

/** Diatermia: P(x) = P0 · exp(−2x/δ), δ ≈ k/√(f·μ·σ) — penetração de energia eletromagnética */
function diathermyPenetration(): DynamicChartBlockData {
  return presetBlock("diathermy_penetration", {
    title: t("Diatermia — Penetração Térmica", "Diathermy — Thermal Penetration"),
    subtitle: t("Absorção de energia vs profundidade", "Energy absorption vs depth"),
    description: t(
      "A potência absorvida pelos tecidos decai exponencialmente com a profundidade. Frequências mais altas reduzem a profundidade efetiva de penetração (δ), concentrando o aquecimento em camadas mais superficiais.",
      "Power absorbed by tissue decays exponentially with depth. Higher frequencies reduce the effective penetration depth (δ), concentrating heating in more superficial layers.",
    ),
    axes: {
      x: {
        label: t("Profundidade tecidual", "Tissue depth"),
        unit: "cm",
        min: 0,
        max: 10,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Potência absorvida relativa", "Relative absorbed power"),
        unit: "%",
        min: 0,
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "frequency_mhz",
        name: t("Frequência", "Frequency"),
        unit: "MHz",
        min: 0.3,
        max: 27,
        step: 0.1,
        defaultValue: 13.56,
      },
      {
        id: "penetration_depth_cm",
        name: t("Profundidade de penetração (δ)", "Penetration depth (δ)"),
        unit: "cm",
        min: 1,
        max: 8,
        step: 0.1,
        defaultValue: 3,
      },
      {
        id: "surface_intensity",
        name: t("Intensidade superficial (P₀)", "Surface intensity (P₀)"),
        unit: "%",
        min: 10,
        max: 100,
        step: 1,
        defaultValue: 60,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "frequency_mhz > 20",
        feedbackText: t(
          "**Frequência elevada:** menor profundidade de penetração (δ) — aquecimento concentrado nas camadas superficiais (pele/tecido subcutâneo).",
          "**High frequency:** shallower penetration depth (δ) — heating concentrated in superficial layers (skin/subcutaneous tissue).",
        ),
        type: "warning",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "penetration_depth_cm < 2",
        feedbackText: t(
          "**Baixa profundidade de penetração:** efeito térmico restrito a tecidos superficiais — pouco alcance para estruturas profundas.",
          "**Low penetration depth:** thermal effect restricted to superficial tissue — limited reach for deep structures.",
        ),
        type: "info",
        priority: 2,
      },
      {
        id: "fb3",
        condition: "surface_intensity > 80",
        feedbackText: t(
          "**Intensidade superficial alta:** risco aumentado de queimadura superficial — monitore a sensação térmica do paciente.",
          "**High surface intensity:** increased risk of superficial burn — monitor the patient's thermal sensation.",
        ),
        type: "warning",
        priority: 3,
      },
    ],
  });
}

/** FES: F(f) = Fmax · (1 − exp(−f / f_fusion)) — fusão tetânica e saturação de força */
function fesForceFrequency(): DynamicChartBlockData {
  return presetBlock("fes_force_frequency", {
    title: t("FES — Força × Frequência", "FES — Force × Frequency"),
    subtitle: t("Fusão de frequência e saturação", "Frequency fusion and saturation"),
    description: t(
      "A força evocada por estimulação elétrica funcional aumenta com a frequência de pulsos até saturar próximo à fusão tetânica, quando contrações isoladas se sobrepõem em um platô de força.",
      "Force evoked by functional electrical stimulation increases with pulse frequency until it saturates near tetanic fusion, when individual twitches overlap into a force plateau.",
    ),
    axes: {
      x: {
        label: t("Frequência de estimulação", "Stimulation frequency"),
        unit: "Hz",
        min: 1,
        max: 80,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Força evocada", "Evoked force"),
        unit: "% Fmax",
        min: 0,
        max: 110,
        scaleMode: "fixed",
      },
    },
    parameters: [
      {
        id: "force_max",
        name: t("Força máxima (Fmax)", "Maximum force (Fmax)"),
        unit: "% Fmax",
        min: 10,
        max: 100,
        step: 1,
        defaultValue: 60,
      },
      {
        id: "fusion_frequency",
        name: t("Frequência de fusão", "Fusion frequency"),
        unit: "Hz",
        min: 15,
        max: 40,
        step: 1,
        defaultValue: 25,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "fusion_frequency < 20",
        feedbackText: t(
          "**Fusão precoce:** tetanização ocorre em frequências baixas — típico de fibras lentas (tipo I), com fadiga mais tardia.",
          "**Early fusion:** tetanization occurs at low frequencies — typical of slow-twitch fibers (type I), with later fatigue onset.",
        ),
        type: "info",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "fusion_frequency > 35",
        feedbackText: t(
          "**Fusão tardia:** exige frequências altas para tetanizar — maior risco de fadiga muscular precoce em protocolos prolongados.",
          "**Late fusion:** requires high frequencies to tetanize — greater risk of early muscle fatigue in prolonged protocols.",
        ),
        type: "warning",
        priority: 2,
      },
      {
        id: "fb3",
        condition: "force_max > 80",
        feedbackText: t(
          "**Alta capacidade de força:** unidade motora com grande recrutamento de fibras — resposta robusta à estimulação.",
          "**High force capacity:** motor unit with large fiber recruitment — robust response to stimulation.",
        ),
        type: "success",
        priority: 3,
      },
    ],
  });
}

export const ELECTROTHERAPY_PRESET_DEFINITIONS: Partial<
  Record<DynamicChartPresetId, () => DynamicChartBlockData>
> = {
  tens_strength_duration: tensStrengthDuration,
  us_attenuation: usAttenuation,
  pbm_arndt_schulz: pbmArndtSchulz,
  diathermy_penetration: diathermyPenetration,
  fes_force_frequency: fesForceFrequency,
};
