import type { DynamicChartBlockData, DynamicChartPresetId } from "@/types/dynamicChart";
import { linspace, PRESET_SERIES_COLORS, type PresetComputeFn } from "./helpers";

const COLORS = PRESET_SERIES_COLORS;

function tensStrengthDuration(
  config: DynamicChartBlockData,
  params: Record<string, number>,
) {
  const rheobase = params.rheobase ?? 12;
  const chronaxie = params.chronaxie ?? 0.35;
  const xMin = config.axes.x.min ?? 0.05;
  const xMax = config.axes.x.max ?? 2;
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 120);
  return [
    {
      id: "strength_duration",
      label: "Intensidade mínima (mA)",
      color: COLORS.primary,
      strokeWidth: 2.5,
      points: xs.map((t) => ({
        x: t,
        y: rheobase * (1 + chronaxie / Math.max(t, 0.01)),
      })),
    },
  ];
}

function usAttenuation(config: DynamicChartBlockData, params: Record<string, number>) {
  const i0 = params.initial_intensity ?? 100;
  const alpha = params.attenuation_coeff ?? 0.8;
  const xMin = config.axes.x.min ?? 0;
  const xMax = config.axes.x.max ?? 6;
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 120);
  return [
    {
      id: "attenuation",
      label: "Intensidade relativa (%)",
      color: COLORS.secondary,
      strokeWidth: 2.5,
      points: xs.map((depth) => ({ x: depth, y: i0 * Math.exp(-alpha * depth) })),
    },
  ];
}

function pbmArndtSchulz(config: DynamicChartBlockData, params: Record<string, number>) {
  const optimalDose = params.optimal_dose ?? 4;
  const peakEffect = params.peak_effect ?? 100;
  const xMin = config.axes.x.min ?? 0;
  const xMax = config.axes.x.max ?? 12;
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 120);
  return [
    {
      id: "arndt_schulz",
      label: "Efeito biológico (%)",
      color: COLORS.accent,
      strokeWidth: 2.5,
      points: xs.map((d) => {
        const ratio = d / Math.max(optimalDose, 0.01);
        return { x: d, y: Math.max(0, peakEffect * ratio * Math.exp(1 - ratio)) };
      }),
    },
  ];
}

function diathermyPenetration(config: DynamicChartBlockData, params: Record<string, number>) {
  const frequency = params.frequency_mhz ?? 13.56;
  const penetration = params.penetration_depth_cm ?? 3;
  const surfaceIntensity = params.surface_intensity ?? 60;
  const effectiveDelta = penetration * Math.sqrt(13.56 / Math.max(frequency, 0.1));
  const xMin = config.axes.x.min ?? 0;
  const xMax = config.axes.x.max ?? 10;
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 120);
  return [
    {
      id: "diathermy_power",
      label: "Potência absorvida relativa (%)",
      color: COLORS.warning,
      strokeWidth: 2.5,
      points: xs.map((depth) => ({
        x: depth,
        y: surfaceIntensity * Math.exp(-2 * depth / Math.max(effectiveDelta, 0.1)),
      })),
    },
  ];
}

function fesForceFrequency(config: DynamicChartBlockData, params: Record<string, number>) {
  const forceMax = params.force_max ?? 60;
  const fusionFreq = params.fusion_frequency ?? 25;
  const xMin = config.axes.x.min ?? 1;
  const xMax = config.axes.x.max ?? 80;
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 120);
  return [
    {
      id: "fes_force",
      label: "Força evocada (% Fmax)",
      color: COLORS.primary,
      strokeWidth: 2.5,
      points: xs.map((freq) => ({
        x: freq,
        y: forceMax * (1 - Math.exp(-freq / Math.max(fusionFreq, 1))),
      })),
    },
  ];
}

function actionPotential(config: DynamicChartBlockData, params: Record<string, number>) {
  const gNa = params.g_na ?? 1;
  const gK = params.g_k ?? 1;
  const vRest = params.v_rest ?? -70;
  const vPeak = params.v_peak ?? 30;
  const tauRise = 0.08 / Math.max(gNa, 0.1);
  const tauRepol = 1.2 / Math.max(gK, 0.1);
  const tPeak = tauRise * 2.5;
  const xMin = config.axes.x.min ?? 0;
  const xMax = config.axes.x.max ?? 5;
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 160);
  const vmPoints: Array<{ x: number; y: number }> = [];
  const naPoints: Array<{ x: number; y: number }> = [];
  const kPoints: Array<{ x: number; y: number }> = [];
  for (const t of xs) {
    const naPhase = 1 - Math.exp(-t / tauRise);
    const kPhase = 1 - Math.exp(-Math.max(0, t - tPeak) / tauRepol);
    const vm = vRest + (vPeak - vRest) * naPhase * kPhase;
    vmPoints.push({ x: t, y: vm });
    naPoints.push({ x: t, y: vRest + (vPeak - vRest) * naPhase });
    kPoints.push({ x: t, y: vRest - (vPeak - vRest) * (1 - kPhase) * naPhase });
  }
  return [
    { id: "vm", label: "Potencial de membrana (Vm)", color: COLORS.primary, strokeWidth: 2.5, points: vmPoints },
    { id: "na_phase", label: "Fase Na⁺", color: COLORS.danger, strokeWidth: 1.75, points: naPoints },
    { id: "k_phase", label: "Fase K⁺", color: COLORS.info, strokeWidth: 1.75, points: kPoints },
  ];
}

function tmsIOCurve(config: DynamicChartBlockData, params: Record<string, number>) {
  const baseline = params.baseline ?? 5;
  const amplitude = params.amplitude ?? 95;
  const ec50 = params.ec50 ?? 55;
  const hill = params.hill_coeff ?? 2.2;
  const xMin = config.axes.x.min ?? 0;
  const xMax = config.axes.x.max ?? 100;
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 120);
  return [
    {
      id: "tms_io",
      label: "Amplitude MEP (µV)",
      color: COLORS.warning,
      strokeWidth: 2.5,
      points: xs.map((intensity) => {
        const xn = Math.pow(Math.max(intensity, 0), hill);
        const en = Math.pow(ec50, hill);
        return { x: intensity, y: baseline + (amplitude * xn) / (xn + en) };
      }),
    },
  ];
}

function nernstEquilibrium(config: DynamicChartBlockData, params: Record<string, number>) {
  const valence = params.valence ?? 1;
  const temperature = params.temperature ?? 37;
  const xMin = config.axes.x.min ?? -2;
  const xMax = config.axes.x.max ?? 2;
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 120);
  const thermalFactor = (temperature + 273.15) / 310.15;
  return [
    {
      id: "nernst",
      label: "Potencial de equilíbrio (mV)",
      color: COLORS.accent,
      strokeWidth: 2.5,
      points: xs.map((logRatio) => ({
        x: logRatio,
        y: (61.5 / Math.max(valence, 1)) * thermalFactor * logRatio,
      })),
    },
  ];
}

function nerveAccommodation(config: DynamicChartBlockData, params: Record<string, number>) {
  const i0 = params.i0 ?? 10;
  const tau = params.tau_accommodation ?? 2;
  const xMin = config.axes.x.min ?? 0;
  const xMax = config.axes.x.max ?? 10;
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 120);
  return [
    {
      id: "accommodation",
      label: "Limiar de excitação (mA)",
      color: COLORS.secondary,
      strokeWidth: 2.5,
      points: xs.map((t) => ({ x: t, y: i0 * Math.exp(t / Math.max(tau, 0.1)) })),
    },
  ];
}

function hillForceVelocity(config: DynamicChartBlockData, params: Record<string, number>) {
  const f0 = params.f0 ?? 600;
  const vmax = params.vmax ?? 1.2;
  const a = 0.25 * f0;
  const b = (vmax * a) / Math.max(f0, 1);
  const xMin = config.axes.x.min ?? 0;
  const xMax = config.axes.x.max ?? Math.max(vmax * 1.05, 1.5);
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 120);
  return [
    {
      id: "force_velocity",
      label: "Força (N)",
      color: COLORS.primary,
      strokeWidth: 2.5,
      points: xs.map((velocity) => {
        const force = (b * f0 - velocity * a) / (b + Math.max(velocity, 0));
        return { x: velocity, y: Math.max(0, force) };
      }),
    },
  ];
}

function muscleLengthTension(config: DynamicChartBlockData, params: Record<string, number>) {
  const fMax = params.f_max ?? 800;
  const lOpt = params.l_opt ?? 1.05;
  const width = params.gaussian_width ?? 0.25;
  const xMin = config.axes.x.min ?? 0.7;
  const xMax = config.axes.x.max ?? 1.4;
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 120);
  return [
    {
      id: "length_tension",
      label: "Força isométrica (N)",
      color: COLORS.primary,
      strokeWidth: 2.5,
      points: xs.map((length) => {
        const z = (length - lOpt) / Math.max(width, 0.01);
        return { x: length, y: fMax * Math.exp(-z * z) };
      }),
    },
  ];
}

function viscoelasticCreep(config: DynamicChartBlockData, params: Record<string, number>) {
  const stress = params.applied_stress ?? 50;
  const tau = params.tau ?? 20;
  const compliance = params.compliance ?? 0.01;
  const xMin = config.axes.x.min ?? 0;
  const xMax = config.axes.x.max ?? 120;
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 120);
  return [
    {
      id: "creep",
      label: "Deformação (%)",
      color: COLORS.info,
      strokeWidth: 2.5,
      points: xs.map((t) => ({
        x: t,
        y: stress * compliance * (1 - Math.exp(-t / Math.max(tau, 0.1))) * 100,
      })),
    },
  ];
}

function boneStressStrain(config: DynamicChartBlockData, params: Record<string, number>) {
  const youngModulus = params.young_modulus ?? 15;
  const yieldStrain = params.yield_strain ?? 0.01;
  const xMin = config.axes.x.min ?? 0;
  const xMax = config.axes.x.max ?? 0.02;
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 120);
  return [
    {
      id: "bone_elastic",
      label: "Tensão (MPa)",
      color: COLORS.primary,
      strokeWidth: 2.5,
      points: xs.map((strain) => ({
        x: strain,
        y: Math.min(youngModulus * 1000 * strain, youngModulus * 1000 * yieldStrain),
      })),
    },
  ];
}

function hbBohrDissociation(config: DynamicChartBlockData, params: Record<string, number>) {
  const pco2 = params.pco2 ?? 40;
  const ph = params.ph ?? 7.4;
  const temperature = params.temperature ?? 37;
  const p50Ref = 26.6;
  const hillN = 2.7;
  const xMin = config.axes.x.min ?? 0;
  const xMax = config.axes.x.max ?? 100;
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 120);
  const logP50 =
    Math.log10(p50Ref) +
    0.48 * (7.4 - ph) +
    0.0024 * (pco2 - 40) +
    0.015 * (temperature - 37);
  const p50 = Math.pow(10, logP50);
  return [
    {
      id: "sao2",
      label: "Saturação de O₂ (SaO₂)",
      color: "#dc2626",
      strokeWidth: 2.5,
      points: xs.map((po2) => {
        const po2N = Math.pow(Math.max(po2, 0), hillN);
        const p50N = Math.pow(p50, hillN);
        return { x: po2, y: (100 * po2N) / (p50N + po2N) };
      }),
    },
  ];
}

function frankStarling(config: DynamicChartBlockData, params: Record<string, number>) {
  const svMax = params.sv_max ?? 90;
  const edvRef = params.edv_ref ?? 120;
  const steepness = params.steepness ?? 0.03;
  const xMin = config.axes.x.min ?? 40;
  const xMax = config.axes.x.max ?? 200;
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 120);
  return [
    {
      id: "frank_starling",
      label: "Volume sistólico (mL)",
      color: COLORS.danger,
      strokeWidth: 2.5,
      points: xs.map((edv) => ({
        x: edv,
        y: svMax / (1 + Math.exp(-steepness * (edv - edvRef))),
      })),
    },
  ];
}

function cardiacOutputExercise(config: DynamicChartBlockData, params: Record<string, number>) {
  const coRest = params.co_rest ?? 5;
  const slope = params.slope ?? 0.04;
  const xMin = config.axes.x.min ?? 0;
  const xMax = config.axes.x.max ?? 200;
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 120);
  return [
    {
      id: "cardiac_output",
      label: "Débito cardíaco (L/min)",
      color: COLORS.danger,
      strokeWidth: 2.5,
      points: xs.map((workload) => ({ x: workload, y: coRest + slope * workload })),
    },
  ];
}

function spirometryLoop(config: DynamicChartBlockData, params: Record<string, number>) {
  const vc = params.vc ?? 4.5;
  const peakIn = params.peak_inspiratory_flow ?? 7;
  const peakExp = params.peak_expiratory_flow ?? 6;
  const samples = config.axes.x.sampleCount ?? 120;
  const xs = linspace(0, vc, samples);
  const inspiratory = xs.map((volume) => ({
    x: volume,
    y: peakIn * Math.sqrt(Math.max(0, 1 - Math.pow(volume / Math.max(vc, 0.1), 2))),
  }));
  const expiratory = xs.map((volume) => ({
    x: volume,
    y: -peakExp * Math.sqrt(Math.max(0, 1 - Math.pow((vc - volume) / Math.max(vc, 0.1), 2))),
  }));
  return [
    {
      id: "inspiratory_limb",
      label: "Inspiração forçada",
      color: COLORS.info,
      strokeWidth: 2.5,
      points: inspiratory,
    },
    {
      id: "expiratory_limb",
      label: "Expiração forçada",
      color: COLORS.warning,
      strokeWidth: 2.5,
      points: expiratory,
    },
  ];
}

function michaelisMenten(config: DynamicChartBlockData, params: Record<string, number>) {
  const vmax = params.vmax ?? 100;
  const km = params.km ?? 5;
  const xMin = config.axes.x.min ?? 0;
  const xMax = config.axes.x.max ?? 50;
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 120);
  return [
    {
      id: "mm_kinetics",
      label: "Velocidade / efeito (u.a.)",
      color: COLORS.pharmacy,
      strokeWidth: 2.5,
      points: xs.map((substrate) => ({
        x: substrate,
        y: (vmax * substrate) / (km + Math.max(substrate, 0)),
      })),
    },
  ];
}

function firstOrderElimination(config: DynamicChartBlockData, params: Record<string, number>) {
  const c0 = params.c0 ?? 200;
  const halfLife = params.half_life ?? 8;
  const k = 0.693 / Math.max(halfLife, 0.1);
  const xMin = config.axes.x.min ?? 0;
  const xMax = config.axes.x.max ?? 48;
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 120);
  return [
    {
      id: "elimination",
      label: "Concentração (mg/L)",
      color: COLORS.accent,
      strokeWidth: 2.5,
      points: xs.map((t) => ({ x: t, y: c0 * Math.exp(-k * t) })),
    },
  ];
}

function doseAccumulation(config: DynamicChartBlockData, params: Record<string, number>) {
  const dose = params.dose ?? 200;
  const halfLife = params.half_life ?? 8;
  const interval = params.dosing_interval ?? 12;
  const k = 0.693 / Math.max(halfLife, 0.1);
  const css = dose / Math.max(1 - Math.exp(-k * interval), 0.01);
  const xMin = config.axes.x.min ?? 0;
  const xMax = config.axes.x.max ?? 72;
  const xs = linspace(xMin, xMax, config.axes.x.sampleCount ?? 120);
  return [
    {
      id: "accumulation",
      label: "Concentração (mg/L)",
      color: COLORS.success,
      strokeWidth: 2.5,
      points: xs.map((t) => ({ x: t, y: css * (1 - Math.exp(-k * t)) })),
    },
  ];
}

const PRESET_COMPUTE: Record<DynamicChartPresetId, PresetComputeFn> = {
  tens_strength_duration: tensStrengthDuration,
  us_attenuation: usAttenuation,
  pbm_arndt_schulz: pbmArndtSchulz,
  diathermy_penetration: diathermyPenetration,
  fes_force_frequency: fesForceFrequency,
  action_potential: actionPotential,
  tms_io_curve: tmsIOCurve,
  nernst_equilibrium: nernstEquilibrium,
  nerve_accommodation: nerveAccommodation,
  hill_force_velocity: hillForceVelocity,
  muscle_length_tension: muscleLengthTension,
  viscoelastic_creep: viscoelasticCreep,
  bone_stress_strain: boneStressStrain,
  hb_bohr_dissociation: hbBohrDissociation,
  frank_starling: frankStarling,
  cardiac_output_exercise: cardiacOutputExercise,
  spirometry_loop: spirometryLoop,
  michaelis_menten: michaelisMenten,
  first_order_elimination: firstOrderElimination,
  dose_accumulation: doseAccumulation,
};

export function computePresetSeries(
  presetId: DynamicChartPresetId,
  config: DynamicChartBlockData,
  parameterValues: Record<string, number>,
) {
  const fn = PRESET_COMPUTE[presetId];
  return fn ? fn(config, parameterValues) : [];
}
