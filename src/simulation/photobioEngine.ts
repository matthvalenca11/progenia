/**
 * photobioEngine.ts
 * Motor físico simplificado para Fotobiomodulação (FBM) em contexto educacional.
 * Óptica multicamada: src/lib/photobioOptics.ts (single source of truth).
 */

import {
  buildPhotobioLayers,
  classifyPhotobioDose,
  computePhotobioOptics,
  type PhotobioDepthSample,
  type PhotobioDoseZoneColor,
  type PhotobioLayerConfig,
  type PhotobioPenetrationLayer,
  type PhotobioWavelength,
  getMuscleEntryDepthMm,
} from "@/lib/photobioOptics";

export type { PhotobioLayerConfig, PhotobioWavelength } from "@/lib/photobioOptics";

export type ArndtSchulzZone =
  | "Subdose / Efeito Nulo"
  | "Janela Terapêutica Ativa"
  | "Efeito Inibitório / Sedação"
  | "Bioinibição / Saturação"
  | "Transição";

export type ArndtSchulzZoneColor = PhotobioDoseZoneColor;
export type PhotobioAnatomyPreset = "default" | "elderly" | "athlete" | "obese" | "custom";

export interface PenetrationLayer {
  layer: PhotobioPenetrationLayer["layer"];
  absorbedFraction: number;
}

export interface TissueInteractionResult {
  penetrationProfile: PenetrationLayer[];
  arndtSchulzZone: ArndtSchulzZone;
  statusColor: ArndtSchulzZoneColor;
  insight: string;
  muscleFluence: number;
  muscleFluenceRatio: number;
  effectiveFluence: number;
  realDoseFactor: number;
  angleEfficiency: number;
  pressureFactor: number;
  speedFactor: number;
  contactOpticalCoupling: number;
  anatomyWarning?: string;
  techniqueWarnings: string[];
  thermalWarning: boolean;
  irradiance: number;
  energy: number;
  fluence: number;
  /** Óptica derivada — evita recomputar no painel */
  depthSamples: PhotobioDepthSample[];
  superficialAbsorptionIndex: number;
  deepDeliveryIndex: number;
  thermalRiskIndex: number;
  dominantOpticalPhenomenon: string;
  muscleEntryDepthMm: number;
  opticsWavelength: PhotobioWavelength;
}

export interface TissueInteractionInput {
  wavelength: PhotobioWavelength;
  irradiance: number; // mW/cm^2
  fluence: number; // J/cm^2
  energy: number; // J
  spotSize: number; // cm^2
  layerConfig: PhotobioLayerConfig;
  transducerAngle: number; // degrees
  contactPressure: number; // 0..100
  isDragging: boolean;
  draggingSpeed: number;
  skinMelaninIndex?: number;
}

export function calculatePhotobioIrradiance(powerMw: number, spotSizeCm2: number): number {
  return powerMw / Math.max(spotSizeCm2, 0.001);
}

export function calculatePhotobioEnergy(
  powerMw: number,
  exposureTimeSec: number,
  mode: "CW" | "Pulsed",
  dutyCyclePct: number,
): number {
  const modeFactor = mode === "Pulsed" ? Math.max(0, Math.min(100, dutyCyclePct)) / 100 : 1;
  return (powerMw / 1000) * exposureTimeSec * modeFactor;
}

export function calculatePhotobioFluence(energyJ: number, spotSizeCm2: number): number {
  return energyJ / Math.max(spotSizeCm2, 0.001);
}

export function calculateRealDoseFactor(input: {
  transducerAngle: number;
  contactPressure: number;
  isDragging: boolean;
  draggingSpeed: number;
}) {
  const angle = Math.max(30, Math.min(150, input.transducerAngle));
  const radians = (Math.abs(90 - angle) * Math.PI) / 180;
  const angleEfficiency = Math.cos(radians);

  let pressureFactor = 1;
  if (input.contactPressure < 20) pressureFactor = 0.5;
  else if (input.contactPressure > 80) pressureFactor = 1.2;

  const speedFactor = input.isDragging
    ? 1 / Math.max(0.2, input.draggingSpeed)
    : 1;

  const realDoseFactor = Math.max(
    0.05,
    angleEfficiency * pressureFactor * speedFactor
  );

  return { realDoseFactor, angleEfficiency, pressureFactor, speedFactor };
}

/** @deprecated Prefer classifyPhotobioDose de photobioOptics */
export function calculateArndtSchulzZone(fluence: number): ArndtSchulzZone {
  return classifyPhotobioDose(fluence).label as ArndtSchulzZone;
}

export function getZoneInsight(zone: ArndtSchulzZone): string {
  if (zone === "Subdose / Efeito Nulo") {
    return "A densidade de energia fornecida e insuficiente para atingir o limiar de ativacao dos cromoforos mitocondriais (Citocromo C Oxidase). Nao ha evidencia de resposta biologica significativa.";
  }
  if (zone === "Janela Terapêutica Ativa") {
    return "Dose ideal para reparo tecidual. Ocorre o aumento da sintese de ATP, liberacao de oxido nitrico e modulacao de ROS, acelerando a proliferacao de fibroblastos e a sintese de colageno.";
  }
  if (zone === "Efeito Inibitório / Sedação") {
    return "Dose alta indicada para controle de dor aguda e pontos gatilho. Ocorre a reducao da velocidade de conducao nervosa e a inibicao de mediadores pro-inflamatorios (como a PGE2).";
  }
  if (zone === "Bioinibição / Saturação") {
    return "Dose excessiva. A curva de Arndt-Schulz demonstra que o excesso de energia pode levar a inibicao dos processos de cura e, em casos extremos, saturacao dos receptores celulares.";
  }
  return "Faixa de transicao entre zonas biologicas; ajuste os parametros para entrar em uma janela terapeutica definida.";
}

export function getZoneColor(zone: ArndtSchulzZone): ArndtSchulzZoneColor {
  return classifyPhotobioDose(
    zone === "Subdose / Efeito Nulo"
      ? 0
      : zone === "Janela Terapêutica Ativa"
        ? 5
        : zone === "Efeito Inibitório / Sedação"
          ? 20
          : zone === "Bioinibição / Saturação"
            ? 60
            : 9,
  ).color;
}

export function getPenetrationProfile(
  wavelength: PhotobioWavelength,
  layerConfig: PhotobioLayerConfig,
): PenetrationLayer[] {
  return computePhotobioOptics({
    wavelength,
    fluenceJcm2: 1,
    effectiveFluenceJcm2: 1,
    irradianceMwCm2: 100,
    spotSizeCm2: 0.5,
    layers: buildPhotobioLayers(layerConfig),
  }).penetrationProfile;
}

export function calculateTissueInteraction(
  input: TissueInteractionInput
): TissueInteractionResult {
  const doseFactor = calculateRealDoseFactor({
    transducerAngle: input.transducerAngle,
    contactPressure: input.contactPressure,
    isDragging: input.isDragging,
    draggingSpeed: input.draggingSpeed,
  });
  const effectiveFluence = input.fluence * doseFactor.realDoseFactor;

  const optics = computePhotobioOptics({
    wavelength: input.wavelength,
    fluenceJcm2: input.fluence,
    effectiveFluenceJcm2: effectiveFluence,
    irradianceMwCm2: input.irradiance,
    spotSizeCm2: input.spotSize,
    layers: buildPhotobioLayers(input.layerConfig),
    transducerAngleDeg: input.transducerAngle,
    contactPressure: input.contactPressure,
    incidenceEfficiency: doseFactor.angleEfficiency,
    skinMelaninIndex: input.skinMelaninIndex,
  });

  const doseClass = optics.doseClassification;
  const arndtSchulzZone = doseClass.label as ArndtSchulzZone;
  const statusColor = doseClass.color;
  const adiposeThick = input.layerConfig.adiposeMm >= 20;
  const anatomyWarning = adiposeThick
    ? "Atenção: A espessura do tecido adiposo requer um ajuste maior de energia (Joules) para atingir a janela terapêutica no músculo."
    : undefined;
  const baseInsight = getZoneInsight(arndtSchulzZone);
  const insight = anatomyWarning ? `${baseInsight} ${anatomyWarning}` : baseInsight;
  const thermalWarning = optics.thermalRiskIndex >= 1;
  const techniqueWarnings: string[] = [];
  if (input.isDragging && input.draggingSpeed > 1.6) {
    techniqueWarnings.push("Movimento muito rápido detectado. Subdose em Scanning.");
  }
  if (!input.isDragging && effectiveFluence > 30) {
    techniqueWarnings.push("Transdutor parado por muito tempo. Risco de Bioinibição local no ponto central.");
  }
  if (input.transducerAngle < 70 || input.transducerAngle > 110) {
    techniqueWarnings.push(
      "Ângulo de incidência inadequado. Perpendicularidade comprometida reduz a dose efetiva."
    );
  }
  if (input.contactPressure < 20) {
    techniqueWarnings.push("Contato insuficiente. Pressão baixa reduz a transmissão de energia.");
  }
  if (input.contactPressure > 80) {
    techniqueWarnings.push("Pressão excessiva. Risco de desconforto e concentração térmica local.");
  }

  return {
    penetrationProfile: optics.penetrationProfile,
    arndtSchulzZone,
    statusColor,
    insight,
    muscleFluence: optics.targetMuscleFluenceJcm2,
    muscleFluenceRatio: optics.targetMuscleTransmission,
    effectiveFluence,
    realDoseFactor: doseFactor.realDoseFactor,
    angleEfficiency: doseFactor.angleEfficiency,
    pressureFactor: doseFactor.pressureFactor,
    speedFactor: doseFactor.speedFactor,
    contactOpticalCoupling: optics.contactTransmission,
    anatomyWarning,
    techniqueWarnings,
    thermalWarning,
    irradiance: input.irradiance,
    energy: input.energy,
    fluence: input.fluence,
    depthSamples: optics.depthSamples,
    superficialAbsorptionIndex: optics.superficialAbsorptionIndex,
    deepDeliveryIndex: optics.deepDeliveryIndex,
    thermalRiskIndex: optics.thermalRiskIndex,
    dominantOpticalPhenomenon: optics.dominantOpticalPhenomenon,
    muscleEntryDepthMm: getMuscleEntryDepthMm(input.layerConfig),
    opticsWavelength: input.wavelength,
  };
}
