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

/** NMES: F(pw) = Fmax · (1 − e^(−pw/τ)) — recrutamento com largura de pulso */
function nmesForcePulseWidth(): DynamicChartBlockData {
  return presetBlock("nmes_force_pulse_width", {
    title: t("NMES — Força × Largura de Pulso", "NMES — Force × Pulse Width"),
    subtitle: t("Recrutamento de unidades motoras", "Motor unit recruitment"),
    description: t(
      "Pulsos mais longos recrutam mais fibras e aumentam a força evocada até um platô. Pulsos muito curtos sub-recrutam o músculo alvo.",
      "Longer pulses recruit more fibers and increase evoked force toward a plateau. Pulses that are too short under-recruit the target muscle.",
    ),
    axes: {
      x: {
        label: t("Largura do pulso", "Pulse width"),
        unit: "ms",
        min: 0.05,
        max: 1,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Força evocada", "Evoked force"),
        unit: "% MVC",
        min: 0,
        max: 110,
        scaleMode: "fixed",
      },
    },
    parameters: [
      {
        id: "force_max",
        name: t("Força máxima", "Maximum force"),
        unit: "% MVC",
        min: 20,
        max: 100,
        step: 1,
        defaultValue: 70,
      },
      {
        id: "time_constant",
        name: t("Constante de tempo τ", "Time constant τ"),
        unit: "ms",
        min: 0.08,
        max: 0.5,
        step: 0.01,
        defaultValue: 0.2,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "time_constant < 0.12",
        feedbackText: t(
          "**τ baixo:** fibras rápidas dominam — pulsos curtos já geram força útil (músculo com baixa cronaxia).",
          "**Low τ:** fast fibers dominate — short pulses already produce useful force (low chronaxie muscle).",
        ),
        type: "info",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "force_max > 85",
        feedbackText: t(
          "**Alto recrutamento:** intensidade e largura adequadas para treino de força — monitore fadiga.",
          "**High recruitment:** adequate intensity and width for strength training — monitor fatigue.",
        ),
        type: "success",
        priority: 2,
      },
    ],
  });
}

/** FES: fadiga exponencial durante sessão */
function fesFatigueSession(): DynamicChartBlockData {
  return presetBlock("fes_fatigue_session", {
    title: t("FES — Fadiga durante a sessão", "FES — Session Fatigue"),
    subtitle: t("Decaimento de força × tempo", "Force decay × time"),
    description: t(
      "Força evocada cai com o tempo de estimulação repetida. Frequências altas e duty elevado aceleram a fadiga.",
      "Evoked force drops with repeated stimulation time. High frequencies and duty cycle accelerate fatigue.",
    ),
    axes: {
      x: {
        label: t("Tempo de sessão", "Session time"),
        unit: "min",
        min: 0,
        max: 15,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Força relativa", "Relative force"),
        unit: "% inicial",
        min: 0,
        max: 105,
        scaleMode: "fixed",
      },
    },
    parameters: [
      {
        id: "frequency",
        name: t("Frequência", "Frequency"),
        unit: "Hz",
        min: 10,
        max: 50,
        step: 1,
        defaultValue: 30,
      },
      {
        id: "duty_cycle",
        name: t("Duty cycle", "Duty cycle"),
        unit: "%",
        min: 10,
        max: 100,
        step: 5,
        defaultValue: 50,
      },
      {
        id: "fatigue_rate",
        name: t("Taxa de fadiga", "Fatigue rate"),
        unit: "1/min",
        min: 0.05,
        max: 0.4,
        step: 0.01,
        defaultValue: 0.15,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "frequency > 40 && duty_cycle > 60",
        feedbackText: t(
          "**Alta carga neural:** frequência e duty elevados — fadiga precoce e desconforto provável.",
          "**High neural load:** elevated frequency and duty — early fatigue and likely discomfort.",
        ),
        type: "warning",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "fatigue_rate < 0.08",
        feedbackText: t(
          "**Baixa fadiga:** perfil de fibras lentas ou pausas amplas — sessão mais longa viável.",
          "**Low fatigue:** slow-twitch profile or ample rest — longer session feasible.",
        ),
        type: "info",
        priority: 2,
      },
    ],
  });
}

/** US terapêutico: SATA = I · (duty/100) */
function usSataDuty(): DynamicChartBlockData {
  return presetBlock("us_sata_duty", {
    title: t("Ultrassom — SATA × Duty Cycle", "Ultrasound — SATA × Duty Cycle"),
    subtitle: t("Intensidade espacial média no tempo", "Time-averaged spatial intensity"),
    description: t(
      "No modo pulsado, a SATA é menor que a intensidade de pico. Duty de 50% reduz a dose térmica média pela metade.",
      "In pulsed mode, SATA is lower than peak intensity. A 50% duty halves the average thermal dose.",
    ),
    axes: {
      x: {
        label: t("Duty cycle", "Duty cycle"),
        unit: "%",
        min: 10,
        max: 100,
        scaleMode: "fixed",
        sampleCount: 100,
      },
      y: {
        label: t("SATA", "SATA"),
        unit: "W/cm²",
        min: 0,
        max: 3,
        scaleMode: "fixed",
      },
    },
    parameters: [
      {
        id: "peak_intensity",
        name: t("Intensidade de pico", "Peak intensity"),
        unit: "W/cm²",
        min: 0.5,
        max: 3,
        step: 0.1,
        defaultValue: 1.5,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "peak_intensity > 2",
        feedbackText: t(
          "**Pico elevado:** mesmo com duty baixo, picos altos aumentam risco de efeitos não térmicos — revise ERA e área do feixe.",
          "**High peak:** even at low duty, high peaks increase non-thermal effects risk — review ERA and beam area.",
        ),
        type: "warning",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "peak_intensity < 1",
        feedbackText: t(
          "**Baixa intensidade de pico:** SATA reduzida — pode ser insuficiente para alvos profundos.",
          "**Low peak intensity:** reduced SATA — may be insufficient for deep targets.",
        ),
        type: "info",
        priority: 2,
      },
    ],
  });
}

/** US: profundidade efetiva ≈ k/f (MHz) */
function usFrequencyPenetration(): DynamicChartBlockData {
  return presetBlock("us_frequency_penetration", {
    title: t("Ultrassom — Penetração × Frequência", "Ultrasound — Penetration × Frequency"),
    subtitle: t("Trade-off resolução vs profundidade", "Resolution vs depth trade-off"),
    description: t(
      "Frequências mais altas atenuam rapidamente e concentram energia superficialmente. Frequências baixas penetram mais, com feixe menos focado.",
      "Higher frequencies attenuate quickly and concentrate energy superficially. Lower frequencies penetrate deeper with a less focused beam.",
    ),
    axes: {
      x: {
        label: t("Frequência", "Frequency"),
        unit: "MHz",
        min: 0.5,
        max: 5,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Profundidade efetiva", "Effective depth"),
        unit: "cm",
        min: 0,
        max: 8,
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "tissue_factor",
        name: t("Fator tecidual k", "Tissue factor k"),
        unit: "cm·MHz",
        min: 2,
        max: 5,
        step: 0.1,
        defaultValue: 3.5,
      },
      {
        id: "target_depth",
        name: t("Profundidade alvo", "Target depth"),
        unit: "cm",
        min: 1,
        max: 6,
        step: 0.5,
        defaultValue: 3,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "target_depth > 4",
        feedbackText: t(
          "**Alvo profundo:** prefira 1 MHz ou menos e baixa atenuação — 3 MHz raramente alcança esta profundidade com dose útil.",
          "**Deep target:** prefer 1 MHz or less and low attenuation — 3 MHz rarely reaches this depth with useful dose.",
        ),
        type: "warning",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "tissue_factor > 4",
        feedbackText: t(
          "**Tecido muito absorvente:** profundidade efetiva reduzida mesmo em baixa frequência (ex.: tecido fibroso, cicatriz).",
          "**Highly absorbing tissue:** reduced effective depth even at low frequency (e.g. fibrous tissue, scar).",
        ),
        type: "info",
        priority: 2,
      },
    ],
  });
}

/** PBM: D = (P_mW/cm² / 1000) · t */
function pbmDoseTime(): DynamicChartBlockData {
  return presetBlock("pbm_dose_time", {
    title: t("PBM — Dose × Tempo", "PBM — Dose × Time"),
    subtitle: t("J/cm² acumulados na irradiância fixa", "J/cm² accumulated at fixed irradiance"),
    description: t(
      "Dose energética é irradiância × tempo. Mesma dose pode vir de potência alta por pouco tempo ou baixa por mais tempo — a resposta biológica nem sempre é idêntica.",
      "Energy dose is irradiance × time. The same dose can come from high power briefly or low power longer — biological response is not always identical.",
    ),
    axes: {
      x: {
        label: t("Tempo de exposição", "Exposure time"),
        unit: "s",
        min: 0,
        max: 300,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Dose energética", "Energy dose"),
        unit: "J/cm²",
        min: 0,
        max: 15,
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "irradiance",
        name: t("Irradiância", "Irradiance"),
        unit: "mW/cm²",
        min: 20,
        max: 200,
        step: 5,
        defaultValue: 100,
      },
      {
        id: "optimal_dose",
        name: t("Dose alvo clínica", "Clinical target dose"),
        unit: "J/cm²",
        min: 2,
        max: 10,
        step: 0.5,
        defaultValue: 4,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "irradiance > 150",
        feedbackText: t(
          "**Irradiância alta:** atinja a dose alvo em menos tempo — risco de aquecimento superficial se o spot for pequeno.",
          "**High irradiance:** reach target dose faster — superficial heating risk if spot size is small.",
        ),
        type: "warning",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "optimal_dose > 7",
        feedbackText: t(
          "**Dose alvo elevada:** verifique janela terapêutica (Arndt-Schulz) — sobredose inibe resposta.",
          "**High target dose:** check therapeutic window (Arndt-Schulz) — overdose inhibits response.",
        ),
        type: "info",
        priority: 2,
      },
    ],
  });
}

/** PBM: penetração óptica gaussiana centrada em ~808 nm */
function pbmWavelengthPenetration(): DynamicChartBlockData {
  return presetBlock("pbm_wavelength_penetration", {
    title: t("PBM — Penetração × Comprimento de Onda", "PBM — Penetration × Wavelength"),
    subtitle: t("Vermelho vs infravermelho próximo", "Red vs near-infrared"),
    description: t(
      "Comprimentos de onda mais longos (808–850 nm) penetram mais em tecidos moles. Vermelho (~660 nm) fica mais superficial — útil para pele e mucosas.",
      "Longer wavelengths (808–850 nm) penetrate soft tissue more. Red (~660 nm) stays superficial — useful for skin and mucosa.",
    ),
    axes: {
      x: {
        label: t("Comprimento de onda", "Wavelength"),
        unit: "nm",
        min: 600,
        max: 1000,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Penetração efetiva", "Effective penetration"),
        unit: "mm",
        min: 0,
        max: 25,
        scaleMode: "fixed",
      },
    },
    parameters: [
      {
        id: "peak_penetration",
        name: t("Penetração máxima", "Peak penetration"),
        unit: "mm",
        min: 10,
        max: 25,
        step: 1,
        defaultValue: 18,
      },
      {
        id: "surface_penetration",
        name: t("Penetração em 660 nm", "Penetration at 660 nm"),
        unit: "mm",
        min: 1,
        max: 8,
        step: 0.5,
        defaultValue: 3,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "peak_penetration > 20",
        feedbackText: t(
          "**Alta transmissão tecidual:** NIR profundo — indicado para músculo e articulações profundas.",
          "**High tissue transmission:** deep NIR — indicated for muscle and deep joints.",
        ),
        type: "success",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "surface_penetration < 2",
        feedbackText: t(
          "**Vermelho muito superficial:** ideal para feridas e pele; não espere efeito em estruturas profundas.",
          "**Very superficial red:** ideal for wounds and skin; do not expect effect in deep structures.",
        ),
        type: "info",
        priority: 2,
      },
    ],
  });
}

/** Diatermia: ΔT(t) = ΔTmax · (1 − e^(−t/τ)) / perfusão */
function diathermyHeatingTime(): DynamicChartBlockData {
  return presetBlock("diathermy_heating_time", {
    title: t("Diatermia — Aquecimento × Tempo", "Diathermy — Heating × Time"),
    subtitle: t("Elevação térmica e perfusão", "Temperature rise and perfusion"),
    description: t(
      "A temperatura sobe rapidamente no início e tende a platô. Boa perfusão dissipa calor e limita o aquecimento — áreas isquêmicas aquecem mais.",
      "Temperature rises quickly at first and tends to plateau. Good perfusion dissipates heat and limits warming — ischemic areas heat more.",
    ),
    axes: {
      x: {
        label: t("Tempo de aplicação", "Application time"),
        unit: "min",
        min: 0,
        max: 20,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Elevação térmica", "Temperature rise"),
        unit: "°C",
        min: 0,
        max: 12,
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "power_level",
        name: t("Potência aplicada", "Applied power"),
        unit: "%",
        min: 20,
        max: 100,
        step: 5,
        defaultValue: 70,
      },
      {
        id: "perfusion",
        name: t("Índice de perfusão", "Perfusion index"),
        unit: "a.u.",
        min: 0.4,
        max: 2,
        step: 0.1,
        defaultValue: 1,
      },
      {
        id: "tau_minutes",
        name: t("Constante térmica τ", "Thermal constant τ"),
        unit: "min",
        min: 2,
        max: 10,
        step: 0.5,
        defaultValue: 5,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "power_level > 85 && perfusion < 0.6",
        feedbackText: t(
          "**Risco térmico:** alta potência com baixa perfusão — monitorar eritema e sensação de queimação.",
          "**Thermal risk:** high power with low perfusion — monitor erythema and burning sensation.",
        ),
        type: "warning",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "perfusion > 1.5",
        feedbackText: t(
          "**Alta perfusão:** dissipação eficiente — pode exigir potência ou tempo maiores para atingir alvo térmico.",
          "**High perfusion:** efficient dissipation — may require higher power or time to reach thermal target.",
        ),
        type: "info",
        priority: 2,
      },
    ],
  });
}

export const PHYSICAL_AGENTS_EXTENDED_DEFINITIONS: Partial<
  Record<DynamicChartPresetId, () => DynamicChartBlockData>
> = {
  nmes_force_pulse_width: nmesForcePulseWidth,
  fes_fatigue_session: fesFatigueSession,
  us_sata_duty: usSataDuty,
  us_frequency_penetration: usFrequencyPenetration,
  pbm_dose_time: pbmDoseTime,
  pbm_wavelength_penetration: pbmWavelengthPenetration,
  diathermy_heating_time: diathermyHeatingTime,
};
