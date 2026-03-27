/**
 * photobioEngine.ts
 * Motor físico simplificado para Fotobiomodulação (FBM) em contexto educacional.
 */

export type PhotobioWavelength = 660 | 808;

export type ArndtSchulzZone =
  | "Subdose / Efeito Nulo"
  | "Janela Terapêutica Ativa"
  | "Efeito Inibitório / Sedação"
  | "Bioinibição / Saturação"
  | "Transição";

export type ArndtSchulzZoneColor = "yellow" | "green" | "blue" | "red" | "gray";
export type PhotobioAnatomyPreset = "default" | "elderly" | "athlete" | "obese" | "custom";

export interface PhotobioLayerConfig {
  epidermisMm: number;
  dermisMm: number;
  adiposeMm: number;
  muscleMm: number;
}

export interface PenetrationLayer {
  layer: "epidermis_dermis" | "hypodermis" | "muscle";
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
  anatomyWarning?: string;
  techniqueWarnings: string[];
  thermalWarning: boolean;
  irradiance: number;
  energy: number;
  fluence: number;
}

export interface TissueInteractionInput {
  wavelength: PhotobioWavelength;
  irradiance: number; // mW/cm^2
  fluence: number; // J/cm^2
  energy: number; // J
  layerConfig: PhotobioLayerConfig;
  transducerAngle: number; // degrees
  contactPressure: number; // 0..100
  isDragging: boolean;
  draggingSpeed: number;
}

export function calculateRealDoseFactor(input: {
  transducerAngle: number;
  contactPressure: number;
  isDragging: boolean;
  draggingSpeed: number;
}) {
  const angle = Math.max(0, Math.min(180, input.transducerAngle));
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

export function calculateArndtSchulzZone(fluence: number): ArndtSchulzZone {
  if (fluence < 2) return "Subdose / Efeito Nulo";
  if (fluence >= 2 && fluence <= 8) return "Janela Terapêutica Ativa";
  if (fluence >= 10 && fluence <= 30) return "Efeito Inibitório / Sedação";
  if (fluence > 50) return "Bioinibição / Saturação";
  return "Transição";
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
  if (zone === "Subdose / Efeito Nulo") return "yellow";
  if (zone === "Janela Terapêutica Ativa") return "green";
  if (zone === "Efeito Inibitório / Sedação") return "blue";
  if (zone === "Bioinibição / Saturação") return "red";
  return "gray";
}

export function getPenetrationProfile(wavelength: PhotobioWavelength): PenetrationLayer[] {
  if (wavelength === 660) {
    // 660 nm (red): higher superficial attenuation
    return [
      { layer: "epidermis_dermis", absorbedFraction: 0.7 },
      { layer: "hypodermis", absorbedFraction: 0.3 },
      { layer: "muscle", absorbedFraction: 0.0 },
    ];
  }

  // 808 nm (IR): deeper penetration
  return [
    { layer: "epidermis_dermis", absorbedFraction: 0.2 },
    { layer: "hypodermis", absorbedFraction: 0.5 },
    { layer: "muscle", absorbedFraction: 0.3 },
  ];
}

export function calculateTissueInteraction(
  input: TissueInteractionInput
): TissueInteractionResult {
  const penetrationProfile = getPenetrationProfile(input.wavelength);
  const arndtSchulzZone = calculateArndtSchulzZone(input.fluence);
  const statusColor = getZoneColor(arndtSchulzZone);
  const attenuationK = input.wavelength === 660 ? 0.038 : 0.02;
  const muscleFluenceRatio = Math.exp(-attenuationK * Math.max(0, input.layerConfig.adiposeMm));
  const doseFactor = calculateRealDoseFactor({
    transducerAngle: input.transducerAngle,
    contactPressure: input.contactPressure,
    isDragging: input.isDragging,
    draggingSpeed: input.draggingSpeed,
  });
  const effectiveFluence = input.fluence * doseFactor.realDoseFactor;
  const muscleFluence = effectiveFluence * muscleFluenceRatio;
  const adiposeThick = input.layerConfig.adiposeMm >= 20;
  const anatomyWarning = adiposeThick
    ? "Atenção: A espessura do tecido adiposo requer um ajuste maior de energia (Joules) para atingir a janela terapêutica no músculo."
    : undefined;
  const baseInsight = getZoneInsight(arndtSchulzZone);
  const insight = anatomyWarning ? `${baseInsight} ${anatomyWarning}` : baseInsight;
  const thermalWarning = input.irradiance > 500;
  const techniqueWarnings: string[] = [];
  if (input.isDragging && input.draggingSpeed > 1.6) {
    techniqueWarnings.push("Movimento muito rápido detectado. Subdose em Scanning.");
  }
  if (!input.isDragging && effectiveFluence > 30) {
    techniqueWarnings.push("Transdutor parado por muito tempo. Risco de Bioinibição local no ponto central.");
  }

  return {
    penetrationProfile,
    arndtSchulzZone,
    statusColor,
    insight,
    muscleFluence,
    muscleFluenceRatio,
    effectiveFluence,
    realDoseFactor: doseFactor.realDoseFactor,
    angleEfficiency: doseFactor.angleEfficiency,
    pressureFactor: doseFactor.pressureFactor,
    speedFactor: doseFactor.speedFactor,
    anatomyWarning,
    techniqueWarnings,
    thermalWarning,
    irradiance: input.irradiance,
    energy: input.energy,
    fluence: input.fluence,
  };
}

