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

/** v = Vmax · [S] / (Km + [S]) — cinética de Michaelis–Menten */
function michaelisMenten(): DynamicChartBlockData {
  return presetBlock("michaelis_menten", {
    title: t("Michaelis–Menten", "Michaelis–Menten"),
    subtitle: t("Cinética enzimática / farmacodinâmica", "Enzyme / pharmacodynamic kinetics"),
    description: t(
      "A velocidade de reação (ou efeito farmacológico) aumenta com a concentração do substrato/ligante até saturar em Vmax; Km é a concentração na qual a velocidade atinge metade do máximo.",
      "Reaction rate (or pharmacologic effect) increases with substrate/ligand concentration until saturating at Vmax; Km is the concentration at which the rate reaches half of the maximum.",
    ),
    axes: {
      x: {
        label: t("Concentração do substrato [S]", "Substrate concentration [S]"),
        unit: "mM",
        min: 0,
        max: 50,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Velocidade de reação (v)", "Reaction rate (v)"),
        unit: "µM/min",
        min: 0,
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "vmax",
        name: t("Velocidade máxima (Vmax)", "Maximum rate (Vmax)"),
        unit: "µM/min",
        min: 50,
        max: 200,
        step: 1,
        defaultValue: 100,
      },
      {
        id: "km",
        name: t("Constante de Michaelis (Km)", "Michaelis constant (Km)"),
        unit: "mM",
        min: 0.5,
        max: 20,
        step: 0.1,
        defaultValue: 5,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "km < 2",
        feedbackText: t(
          "**Km baixo:** alta afinidade enzima-substrato — velocidade máxima é atingida com pouca concentração de substrato.",
          "**Low Km:** high enzyme–substrate affinity — maximum rate is reached with little substrate concentration.",
        ),
        type: "success",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "km > 15",
        feedbackText: t(
          "**Km elevado:** baixa afinidade — é necessária alta concentração de substrato para atingir metade da velocidade máxima.",
          "**High Km:** low affinity — a high substrate concentration is needed to reach half of the maximum rate.",
        ),
        type: "warning",
        priority: 2,
      },
      {
        id: "fb3",
        condition: "vmax > 150",
        feedbackText: t(
          "**Vmax elevado:** grande capacidade catalítica/farmacodinâmica — resposta máxima potencialmente mais intensa.",
          "**High Vmax:** large catalytic/pharmacodynamic capacity — potentially more intense maximal response.",
        ),
        type: "info",
        priority: 3,
      },
    ],
  });
}

/** C(t) = C0 · exp(−k·t), com k = 0,693/t½ — eliminação de primeira ordem */
function firstOrderElimination(): DynamicChartBlockData {
  return presetBlock("first_order_elimination", {
    title: t("Eliminação de 1ª Ordem", "First-Order Elimination"),
    subtitle: t("Decaimento exponencial de concentração", "Exponential concentration decay"),
    description: t(
      "Após uma dose única, a concentração plasmática do fármaco decai exponencialmente com o tempo; a meia-vida (t½) determina a taxa constante de eliminação (k).",
      "After a single dose, the drug's plasma concentration decays exponentially over time; the half-life (t½) determines the constant elimination rate (k).",
    ),
    axes: {
      x: {
        label: t("Tempo", "Time"),
        unit: "h",
        min: 0,
        max: 48,
        scaleMode: "fixed",
        sampleCount: 120,
      },
      y: {
        label: t("Concentração plasmática", "Plasma concentration"),
        unit: "mg/L",
        min: 0,
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "c0",
        name: t("Concentração inicial (C₀)", "Initial concentration (C₀)"),
        unit: "mg/L",
        min: 50,
        max: 500,
        step: 5,
        defaultValue: 200,
      },
      {
        id: "half_life",
        name: t("Meia-vida (t½)", "Half-life (t½)"),
        unit: "h",
        min: 2,
        max: 24,
        step: 0.5,
        defaultValue: 8,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "half_life > 16",
        feedbackText: t(
          "**Meia-vida longa:** eliminação lenta — risco de acúmulo do fármaco em esquemas de doses repetidas frequentes.",
          "**Long half-life:** slow elimination — risk of drug accumulation with frequent repeated dosing.",
        ),
        type: "warning",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "half_life < 4",
        feedbackText: t(
          "**Meia-vida curta:** eliminação rápida — pode exigir doses mais frequentes para manter o efeito terapêutico.",
          "**Short half-life:** fast elimination — may require more frequent dosing to maintain the therapeutic effect.",
        ),
        type: "info",
        priority: 2,
      },
      {
        id: "fb3",
        condition: "c0 > 400",
        feedbackText: t(
          "**Concentração inicial alta:** monitore sinais de toxicidade, especialmente em fármacos de janela terapêutica estreita.",
          "**High initial concentration:** monitor for toxicity signs, especially for drugs with a narrow therapeutic window.",
        ),
        type: "warning",
        priority: 3,
      },
    ],
  });
}

/** Css = dose / (1 − exp(−k·τ)); C(t) = Css · (1 − exp(−k·t)) — acúmulo até estado estacionário */
function doseAccumulation(): DynamicChartBlockData {
  return presetBlock("dose_accumulation", {
    title: t("Acumulação de Doses", "Dose Accumulation"),
    subtitle: t("Aproximação ao estado estacionário", "Approach to steady state"),
    description: t(
      "Com administração repetida em intervalos regulares, a concentração plasmática do fármaco se aproxima progressivamente de um patamar de estado estacionário (Css), determinado pela dose, meia-vida e intervalo entre doses.",
      "With repeated administration at regular intervals, the drug's plasma concentration progressively approaches a steady-state plateau (Css), determined by the dose, half-life, and dosing interval.",
    ),
    axes: {
      x: {
        label: t("Tempo", "Time"),
        unit: "h",
        min: 0,
        max: 72,
        scaleMode: "fixed",
        sampleCount: 140,
      },
      y: {
        label: t("Concentração plasmática", "Plasma concentration"),
        unit: "mg/L",
        min: 0,
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "dose",
        name: t("Dose administrada", "Administered dose"),
        unit: "mg",
        min: 100,
        max: 500,
        step: 10,
        defaultValue: 250,
      },
      {
        id: "half_life",
        name: t("Meia-vida (t½)", "Half-life (t½)"),
        unit: "h",
        min: 4,
        max: 24,
        step: 0.5,
        defaultValue: 12,
      },
      {
        id: "dosing_interval",
        name: t("Intervalo entre doses (τ)", "Dosing interval (τ)"),
        unit: "h",
        min: 6,
        max: 24,
        step: 1,
        defaultValue: 12,
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "dosing_interval < half_life",
        feedbackText: t(
          "**Intervalo curto em relação à meia-vida:** cada dose é administrada antes da eliminação parcial da anterior — maior risco de acúmulo/toxicidade.",
          "**Short interval relative to half-life:** each dose is given before the previous one is partially eliminated — greater risk of accumulation/toxicity.",
        ),
        type: "warning",
        priority: 1,
      },
      {
        id: "fb2",
        condition: "dosing_interval > 2 * half_life",
        feedbackText: t(
          "**Intervalo longo em relação à meia-vida:** a concentração pode cair abaixo do nível terapêutico entre as doses.",
          "**Long interval relative to half-life:** concentration may fall below the therapeutic level between doses.",
        ),
        type: "info",
        priority: 2,
      },
      {
        id: "fb3",
        condition: "half_life > 18",
        feedbackText: t(
          "**Meia-vida longa:** são necessários aproximadamente 5 meias-vidas para atingir o estado estacionário — resposta clínica plena mais demorada.",
          "**Long half-life:** approximately 5 half-lives are needed to reach steady state — full clinical response takes longer.",
        ),
        type: "info",
        priority: 3,
      },
    ],
  });
}

export const PHARMACOLOGY_PRESET_DEFINITIONS: Partial<
  Record<DynamicChartPresetId, () => DynamicChartBlockData>
> = {
  michaelis_menten: michaelisMenten,
  first_order_elimination: firstOrderElimination,
  dose_accumulation: doseAccumulation,
};
