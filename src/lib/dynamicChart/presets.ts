import type {
  ComputedChartSeries,
  DynamicChartBlockData,
  DynamicChartPresetId,
  DynamicChartPresetMeta,
} from "@/types/dynamicChart";

export const PRESET_CATALOG: DynamicChartPresetMeta[] = [
  {
    id: "tens_strength_duration",
    title: "TENS — Curva Intensidade × Duração",
    subtitle: "Reobase e Cronaxia (Weiss)",
    icon: "curve",
    discipline: "Eletroterapia",
  },
  {
    id: "pbm_arndt_schulz",
    title: "PBM — Lei de Arndt-Schulz",
    subtitle: "Resposta bifásica dose × efeito",
    icon: "bell",
    discipline: "Fotobiomodulação",
  },
  {
    id: "us_attenuation",
    title: "Ultrassom — Atenuação Exponencial",
    subtitle: "Intensidade vs profundidade",
    icon: "decay",
    discipline: "Ultrassom terapêutico",
  },
  {
    id: "tms_io_curve",
    title: "TMS — Curva Entrada-Saída",
    subtitle: "Sigmoide do limiar motor",
    icon: "sigmoid",
    discipline: "Estimulação magnética",
  },
];

const COLORS = {
  primary: "hsl(var(--primary))",
  accent: "#0ea5e9",
  secondary: "#8b5cf6",
  warning: "#f59e0b",
};

function linspace(min: number, max: number, count: number): number[] {
  if (count <= 1) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + i * step);
}

type PresetComputeFn = (
  config: DynamicChartBlockData,
  params: Record<string, number>,
) => ComputedChartSeries[];

/** Weiss: I = I_rh * (1 + c / t) — intensidade mínima vs largura de pulso */
function tensStrengthDuration(
  config: DynamicChartBlockData,
  params: Record<string, number>,
): ComputedChartSeries[] {
  const rheobase = params.rheobase ?? 12;
  const chronaxie = params.chronaxie ?? 0.35;
  const xMin = config.axes.x.min ?? 0.05;
  const xMax = config.axes.x.max ?? 2;
  const samples = config.axes.x.sampleCount ?? 120;
  const xs = linspace(xMin, xMax, samples);

  const points = xs.map((t) => ({
    x: t,
    y: rheobase * (1 + chronaxie / Math.max(t, 0.01)),
  }));

  return [
    {
      id: "strength_duration",
      label: "Intensidade mínima (mA)",
      color: COLORS.primary,
      strokeWidth: 2.5,
      points,
    },
  ];
}

/** Arndt-Schulz: efeito ótimo em dose intermediária — y = A * (d/d0) * exp(1 - d/d0) */
function pbmArndtSchulz(
  config: DynamicChartBlockData,
  params: Record<string, number>,
): ComputedChartSeries[] {
  const optimalDose = params.optimal_dose ?? 4;
  const peakEffect = params.peak_effect ?? 100;
  const xMin = config.axes.x.min ?? 0;
  const xMax = config.axes.x.max ?? 12;
  const samples = config.axes.x.sampleCount ?? 120;
  const xs = linspace(xMin, xMax, samples);

  const points = xs.map((d) => {
    const ratio = d / Math.max(optimalDose, 0.01);
    const y = peakEffect * ratio * Math.exp(1 - ratio);
    return { x: d, y: Math.max(0, y) };
  });

  return [
    {
      id: "arndt_schulz",
      label: "Efeito biológico (%)",
      color: COLORS.accent,
      strokeWidth: 2.5,
      points,
    },
  ];
}

/** Atenuação: I(x) = I0 * exp(-α * x) */
function usAttenuation(
  config: DynamicChartBlockData,
  params: Record<string, number>,
): ComputedChartSeries[] {
  const i0 = params.initial_intensity ?? 100;
  const alpha = params.attenuation_coeff ?? 0.8;
  const xMin = config.axes.x.min ?? 0;
  const xMax = config.axes.x.max ?? 6;
  const samples = config.axes.x.sampleCount ?? 120;
  const xs = linspace(xMin, xMax, samples);

  const points = xs.map((depth) => ({
    x: depth,
    y: i0 * Math.exp(-alpha * depth),
  }));

  return [
    {
      id: "attenuation",
      label: "Intensidade relativa (%)",
      color: COLORS.secondary,
      strokeWidth: 2.5,
      points,
    },
  ];
}

/** TMS I-O: sigmoide — y = baseline + (amp * x^n) / (x^n + ec50^n) */
function tmsIOCurve(
  config: DynamicChartBlockData,
  params: Record<string, number>,
): ComputedChartSeries[] {
  const baseline = params.baseline ?? 5;
  const amplitude = params.amplitude ?? 95;
  const ec50 = params.ec50 ?? 55;
  const hill = params.hill_coeff ?? 2.2;
  const xMin = config.axes.x.min ?? 0;
  const xMax = config.axes.x.max ?? 100;
  const samples = config.axes.x.sampleCount ?? 120;
  const xs = linspace(xMin, xMax, samples);

  const points = xs.map((intensity) => {
    const xn = Math.pow(Math.max(intensity, 0), hill);
    const en = Math.pow(ec50, hill);
    const y = baseline + (amplitude * xn) / (xn + en);
    return { x: intensity, y };
  });

  return [
    {
      id: "tms_io",
      label: "Amplitude MEP (µV)",
      color: COLORS.warning,
      strokeWidth: 2.5,
      points,
    },
  ];
}

const PRESET_COMPUTE: Record<DynamicChartPresetId, PresetComputeFn> = {
  tens_strength_duration: tensStrengthDuration,
  pbm_arndt_schulz: pbmArndtSchulz,
  us_attenuation: usAttenuation,
  tms_io_curve: tmsIOCurve,
};

export function computePresetSeries(
  presetId: DynamicChartPresetId,
  config: DynamicChartBlockData,
  parameterValues: Record<string, number>,
): ComputedChartSeries[] {
  const fn = PRESET_COMPUTE[presetId];
  return fn ? fn(config, parameterValues) : [];
}

/** Configuração completa auto-populada ao selecionar preset no CMS */
export function buildPresetBlockData(presetId: DynamicChartPresetId): DynamicChartBlockData {
  switch (presetId) {
    case "tens_strength_duration":
      return {
        source_type: "preset",
        preset_id: presetId,
        title: "Curva Intensidade × Duração (TENS)",
        subtitle: "Explore reobase e cronaxia",
        description:
          "Manipule os parâmetros para entender como a largura do pulso altera a intensidade mínima necessária para excitar o tecido neural.",
        axes: {
          x: {
            label: "Largura do pulso",
            unit: "ms",
            min: 0.05,
            max: 2,
            scaleMode: "fixed",
            sampleCount: 120,
          },
          y: {
            label: "Intensidade mínima",
            unit: "mA",
            scaleMode: "auto",
          },
        },
        parameters: [
          {
            id: "rheobase",
            name: "Reobase",
            unit: "mA",
            min: 5,
            max: 30,
            step: 0.5,
            defaultValue: 12,
          },
          {
            id: "chronaxie",
            name: "Cronaxia",
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
            feedbackText:
              "**Cronaxia baixa:** tecido neural com alta excitabilidade — pulso curto já atinge limiar com pouca intensidade.",
            type: "info",
            priority: 1,
          },
          {
            id: "fb2",
            condition: "chronaxie > 0.8",
            feedbackText:
              "**Cronaxia elevada:** fibra menos excitável — exige pulsos mais longos ou intensidades maiores (típico em tecidos desnervados).",
            type: "warning",
            priority: 2,
          },
          {
            id: "fb3",
            condition: "rheobase > 22",
            feedbackText:
              "**Reobase alta:** limiar de excitação elevado — revise eletrodo, hidratação cutânea e condutividade do meio.",
            type: "warning",
            priority: 3,
          },
        ],
      };

    case "pbm_arndt_schulz":
      return {
        source_type: "preset",
        preset_id: presetId,
        title: "Lei de Arndt-Schulz (Fotobiomodulação)",
        subtitle: "Dose × efeito biológico",
        description:
          "A resposta biológica à luz segue uma curva bifásica: doses muito baixas ou muito altas reduzem o efeito terapêutico.",
        axes: {
          x: {
            label: "Dose energética",
            unit: "J/cm²",
            min: 0,
            max: 12,
            scaleMode: "fixed",
            sampleCount: 120,
          },
          y: {
            label: "Efeito biológico",
            unit: "%",
            min: 0,
            max: 110,
            scaleMode: "fixed",
          },
        },
        parameters: [
          {
            id: "optimal_dose",
            name: "Dose ótima",
            unit: "J/cm²",
            min: 1,
            max: 8,
            step: 0.2,
            defaultValue: 4,
          },
          {
            id: "peak_effect",
            name: "Pico de efeito",
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
            feedbackText:
              "**Janela terapêutica estreita:** doses ótimas baixas — pequenos desvios de potência podem sair da faixa eficaz.",
            type: "info",
            priority: 1,
          },
          {
            id: "fb2",
            condition: "peak_effect > 85",
            feedbackText:
              "**Resposta robusta:** o pico de efeito está alto — parâmetros dentro da faixa clínica favorável.",
            type: "success",
            priority: 2,
          },
        ],
      };

    case "us_attenuation":
      return {
        source_type: "preset",
        preset_id: presetId,
        title: "Atenuação do Ultrassom",
        subtitle: "Decaimento exponencial com a profundidade",
        description:
          "A intensidade acústica diminui exponencialmente ao penetrar nos tecidos. O coeficiente de atenuação depende da frequência e do meio.",
        axes: {
          x: {
            label: "Profundidade",
            unit: "cm",
            min: 0,
            max: 6,
            scaleMode: "fixed",
            sampleCount: 120,
          },
          y: {
            label: "Intensidade",
            unit: "%",
            min: 0,
            max: 105,
            scaleMode: "fixed",
          },
        },
        parameters: [
          {
            id: "initial_intensity",
            name: "Intensidade inicial",
            unit: "%",
            min: 50,
            max: 100,
            step: 1,
            defaultValue: 100,
          },
          {
            id: "attenuation_coeff",
            name: "Coef. atenuação α",
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
            feedbackText:
              "**Alta atenuação:** tecidos com maior absorção (ex.: frequências altas ou meios densos) — energia concentrada superficialmente.",
            type: "warning",
            priority: 1,
          },
          {
            id: "fb2",
            condition: "attenuation_coeff < 0.4",
            feedbackText:
              "**Baixa atenuação:** melhor penetração — útil para alvos profundos, mas atenção ao aquecimento superficial.",
            type: "info",
            priority: 2,
          },
        ],
      };

    case "tms_io_curve":
      return {
        source_type: "preset",
        preset_id: presetId,
        title: "Curva Entrada-Saída (TMS)",
        subtitle: "Resposta motor evocada vs intensidade",
        description:
          "A relação entre intensidade do estímulo magnético e amplitude da resposta muscular segue uma curva sigmoide.",
        axes: {
          x: {
            label: "Intensidade do estímulo",
            unit: "% MSO",
            min: 0,
            max: 100,
            scaleMode: "fixed",
            sampleCount: 120,
          },
          y: {
            label: "Amplitude MEP",
            unit: "µV",
            scaleMode: "auto",
          },
        },
        parameters: [
          {
            id: "baseline",
            name: "Linha de base",
            unit: "µV",
            min: 0,
            max: 20,
            step: 0.5,
            defaultValue: 5,
          },
          {
            id: "amplitude",
            name: "Amplitude máxima",
            unit: "µV",
            min: 50,
            max: 120,
            step: 1,
            defaultValue: 95,
          },
          {
            id: "ec50",
            name: "EC50 (intensidade)",
            unit: "% MSO",
            min: 30,
            max: 80,
            step: 1,
            defaultValue: 55,
          },
          {
            id: "hill_coeff",
            name: "Coef. Hill",
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
            feedbackText:
              "**EC50 baixo:** córtex mais excitável — limiar motor atingido com menor intensidade de estímulo.",
            type: "info",
            priority: 1,
          },
          {
            id: "fb2",
            condition: "hill_coeff > 3.5",
            feedbackText:
              "**Curva íngreme:** transição rápida entre subliminar e supraliminar — ajuste fino de intensidade é crítico.",
            type: "warning",
            priority: 2,
          },
        ],
      };
  }
}

export function createEmptyCustomBlock(): DynamicChartBlockData {
  return {
    source_type: "custom_formula",
    title: "Gráfico Paramétrico",
    subtitle: "Fórmula customizada",
    description: "Ajuste os parâmetros e observe a curva em tempo real.",
    axes: {
      x: {
        label: "X",
        unit: "",
        min: 0,
        max: 10,
        scaleMode: "fixed",
        sampleCount: 100,
      },
      y: {
        label: "Y",
        unit: "",
        scaleMode: "auto",
      },
    },
    parameters: [
      {
        id: "a",
        name: "Parâmetro A",
        min: 0,
        max: 10,
        step: 0.1,
        defaultValue: 2,
      },
      {
        id: "b",
        name: "Parâmetro B",
        min: 0,
        max: 10,
        step: 0.1,
        defaultValue: 1,
      },
    ],
    formulas: [
      {
        id: "series1",
        label: "Série 1",
        expression: "a * sin(x) + b",
        color: "hsl(var(--primary))",
      },
    ],
    conditionalFeedbacks: [
      {
        id: "fb1",
        condition: "a > 5",
        feedbackText: "**Parâmetro A elevado:** a amplitude da oscilação aumenta significativamente.",
        type: "info",
        priority: 1,
      },
    ],
  };
}
