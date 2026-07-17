/**
 * photobioOptics.ts
 * Óptica de tecidos para Fotobiomodulação (modelo educacional calibrado).
 *
 * Modelo: Beer–Lambert multicamada F(z) = F₀·exp(−∫μ_eff dz),
 * com μ_eff = μ_a + μ_s·(1−g). Coeficientes base em cm⁻¹ (literatura /
 * Jacques, Tissue Optics); profundidades z em mm → conversão ×0,1.
 *
 * Melanina: contribuição aditiva a μ_a na epiderme/derme (660 >> 808 nm).
 */

export type PhotobioWavelength = 660 | 808;

export interface PhotobioLayerConfig {
  epidermisMm: number;
  dermisMm: number;
  adiposeMm: number;
  muscleMm: number;
}

export type PhotobioTissueType =
  | "epidermis"
  | "dermis"
  | "adipose"
  | "muscle"
  | "bone";

export interface PhotobioLayer {
  type: PhotobioTissueType;
  thicknessMm: number;
}

export interface PhotobioOpticalProperties {
  muAbsorption: number;
  muScattering: number;
  muEff: number;
  anisotropy: number;
  relativeChromophoreAbsorption: number;
}

export interface PhotobioDepthSample {
  zMm: number;
  layerType: PhotobioTissueType;
  fluenceRelative: number;
  absorbedRelative: number;
  scatteredRelative: number;
  beamRadiusCm: number;
  therapeuticWindowScore: number;
}

export interface PhotobioOpticsInput {
  wavelength: PhotobioWavelength;
  fluenceJcm2: number;
  effectiveFluenceJcm2: number;
  irradianceMwCm2: number;
  spotSizeCm2: number;
  layers: PhotobioLayer[];
  skinMelaninIndex?: number;
  contactOpticalCoupling?: number;
  /** Legado: deriva acoplamento se contactOpticalCoupling omitido */
  transducerAngleDeg?: number;
  contactPressure?: number;
  /** Legado: alias de skinMelaninIndex */
  melaninIndex?: number;
  incidenceEfficiency?: number;
}

/** Limiares únicos de dose (Arndt–Schulz educacional) — J/cm² */
export const PHOTOBIO_DOSE_THRESHOLDS = {
  subdoseMax: 2,
  therapeuticMin: 2,
  therapeuticMax: 8,
  transitionLowerMax: 10,
  inhibitoryMin: 10,
  inhibitoryMax: 30,
  saturationMin: 50,
} as const;

export type PhotobioDoseZone =
  | "subdose"
  | "therapeutic"
  | "transition"
  | "inhibitory"
  | "saturation";

export const PHOTOBIO_DOSE_ZONE_LABELS: Record<PhotobioDoseZone, string> = {
  subdose: "Subdose / Efeito Nulo",
  therapeutic: "Janela Terapêutica Ativa",
  transition: "Transição",
  inhibitory: "Efeito Inibitório / Sedação",
  saturation: "Bioinibição / Saturação",
};

export type PhotobioDoseZoneColor = "yellow" | "green" | "blue" | "red" | "gray";

export interface PhotobioDoseClassification {
  zone: PhotobioDoseZone;
  label: string;
  color: PhotobioDoseZoneColor;
}

export interface PhotobioLayerSummary {
  layerType: PhotobioTissueType;
  thicknessMm: number;
  absorbedFraction: number;
  transmittedFraction: number;
  entryFluenceRelative: number;
  exitFluenceRelative: number;
}

export interface PhotobioPenetrationLayer {
  layer: "epidermis_dermis" | "hypodermis" | "muscle";
  absorbedFraction: number;
}

export interface PhotobioWavelengthVisualPreset {
  wavelength: PhotobioWavelength;
  beamColor: string;
  glowColor: string;
  accentColor: string;
  scatterDepthFactor: number;
  beamSpreadScale: number;
  superficialBias: number;
}

export interface PhotobioOpticsResult {
  samples: PhotobioDepthSample[];
  surfaceFluenceJcm2: number;
  effectiveFluenceJcm2: number;
  targetMuscleFluenceJcm2: number;
  targetMuscleTransmission: number;
  peakAbsorptionLayer: PhotobioTissueType;
  dominantOpticalPhenomenon: string;
  superficialAbsorptionIndex: number;
  deepDeliveryIndex: number;
  thermalRiskIndex: number;
  biologicalActivationIndex: number;
  inhibitionRiskIndex: number;
  doseClassification: PhotobioDoseClassification;
  /** Compatível com consumidores legados */
  wavelength: PhotobioWavelength;
  depthSamples: PhotobioDepthSample[];
  layerSummaries: PhotobioLayerSummary[];
  penetrationProfile: PhotobioPenetrationLayer[];
  muscleFluenceRatio: number;
  muscleFluenceJcm2: number;
  penetrationDepthMm: number;
  beamVisualDepthMm: number;
  totalStackDepthMm: number;
  spotRadiusCm: number;
  incidenceEfficiency: number;
  contactTransmission: number;
}

export type PhotobioOpticsSummary = PhotobioOpticsResult;
export type PhotobioBeamVisualChannel = "core" | "halo";

const DEFAULT_MELANIN_INDEX = 0.35;
const DEFAULT_STEP_MM = 0.5;
const PENETRATION_THRESHOLD = 0.08;
const VISUAL_BEAM_THRESHOLD = 0.05;
const THERMAL_RISK_IRRADIANCE_MW = 500;

/** cm⁻¹ → mm⁻¹ (Beer–Lambert com espessuras em mm) */
const CM_INV_TO_MM_INV = 0.1;

/** μ_a adicional da melanina (cm⁻¹) quando skinMelaninIndex = 1 */
const MELANIN_MU_A_CM: Record<
  PhotobioWavelength,
  Record<"epidermis" | "dermis", number>
> = {
  660: { epidermis: 14, dermis: 2.8 },
  808: { epidermis: 1.9, dermis: 0.45 },
};

/** Coeficientes ópticos base em cm⁻¹ (μ_a, μ_s) — pele Fitzpatrick médio, sem melanina extra */
const BASE_OPTICAL_TABLE_CM: Record<
  PhotobioWavelength,
  Record<PhotobioTissueType, Omit<PhotobioOpticalProperties, "muEff">>
> = {
  660: {
    epidermis: { muAbsorption: 0.34, muScattering: 12, anisotropy: 0.88, relativeChromophoreAbsorption: 0.85 },
    dermis: { muAbsorption: 0.085, muScattering: 9.2, anisotropy: 0.87, relativeChromophoreAbsorption: 0.55 },
    adipose: { muAbsorption: 0.034, muScattering: 6.4, anisotropy: 0.91, relativeChromophoreAbsorption: 0.12 },
    muscle: { muAbsorption: 0.058, muScattering: 7.4, anisotropy: 0.91, relativeChromophoreAbsorption: 0.62 },
    bone: { muAbsorption: 0.13, muScattering: 13.5, anisotropy: 0.86, relativeChromophoreAbsorption: 0.08 },
  },
  808: {
    epidermis: { muAbsorption: 0.058, muScattering: 10.2, anisotropy: 0.89, relativeChromophoreAbsorption: 0.35 },
    dermis: { muAbsorption: 0.044, muScattering: 8.6, anisotropy: 0.88, relativeChromophoreAbsorption: 0.48 },
    adipose: { muAbsorption: 0.026, muScattering: 5.6, anisotropy: 0.92, relativeChromophoreAbsorption: 0.1 },
    muscle: { muAbsorption: 0.038, muScattering: 6.9, anisotropy: 0.92, relativeChromophoreAbsorption: 0.78 },
    bone: { muAbsorption: 0.1, muScattering: 12.8, anisotropy: 0.85, relativeChromophoreAbsorption: 0.06 },
  },
};

/** mm de spread lateral por mm de profundidade — 808 espalha mais em profundidade */
const BEAM_SPREAD_MM_PER_MM: Record<PhotobioWavelength, number> = {
  660: 0.022,
  808: 0.036,
};

const WAVELENGTH_VISUAL_PRESETS: Record<PhotobioWavelength, PhotobioWavelengthVisualPreset> = {
  660: {
    wavelength: 660,
    beamColor: "#FF4500",
    glowColor: "#ff5a2a",
    accentColor: "#78d7ff",
    scatterDepthFactor: 0.72,
    beamSpreadScale: 0.85,
    superficialBias: 1.25,
  },
  808: {
    wavelength: 808,
    beamColor: "#FF00FF",
    glowColor: "#ff47ff",
    accentColor: "#7efcc5",
    scatterDepthFactor: 1.18,
    beamSpreadScale: 1.15,
    superficialBias: 0.65,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getMuEff(
  muAbsorption: number,
  muScattering: number,
  anisotropy: number,
): number {
  return muAbsorption + muScattering * (1 - anisotropy);
}

/** Formata fração 0–1 como percentual com precisão adaptativa (valores pequenos visíveis). */
export function formatPhotobioFraction(fraction: number): string {
  const pct = Math.max(0, fraction) * 100;
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  if (pct >= 0.1) return `${pct.toFixed(2)}%`;
  if (pct >= 0.01) return `${pct.toFixed(3)}%`;
  return `${pct.toFixed(4)}%`;
}

function melaninAbsorptionContributionCm(
  wavelength: PhotobioWavelength,
  tissueType: PhotobioTissueType,
  melanin: number,
): number {
  if (tissueType !== "epidermis" && tissueType !== "dermis") return 0;
  const melaninCurve = Math.pow(melanin, 1.08);
  const layerWeight = tissueType === "epidermis" ? 1 : 0.32;
  return MELANIN_MU_A_CM[wavelength][tissueType] * melaninCurve * layerWeight;
}

export function getPhotobioOpticalProperties(
  wavelength: PhotobioWavelength,
  tissueType: PhotobioTissueType,
  skinMelaninIndex = DEFAULT_MELANIN_INDEX,
): PhotobioOpticalProperties {
  const base = BASE_OPTICAL_TABLE_CM[wavelength][tissueType];
  const melanin = clamp(skinMelaninIndex, 0, 1);
  const muAbsorptionCm = base.muAbsorption + melaninAbsorptionContributionCm(wavelength, tissueType, melanin);
  const scatBoost = tissueType === "epidermis" || tissueType === "dermis" ? 1 + melanin * 0.12 : 1;
  const muAbsorption = muAbsorptionCm * CM_INV_TO_MM_INV;
  const muScattering = base.muScattering * CM_INV_TO_MM_INV * scatBoost;

  return {
    muAbsorption,
    muScattering,
    anisotropy: base.anisotropy,
    relativeChromophoreAbsorption: base.relativeChromophoreAbsorption,
    muEff: getMuEff(muAbsorption, muScattering, base.anisotropy),
  };
}

/** @deprecated Use getPhotobioOpticalProperties */
export const getOpticalProperties = getPhotobioOpticalProperties;

export function buildPhotobioLayers(
  config: PhotobioLayerConfig,
  includeBone = false,
): PhotobioLayer[] {
  const layers: PhotobioLayer[] = [
    { type: "epidermis", thicknessMm: Math.max(0, config.epidermisMm) },
    { type: "dermis", thicknessMm: Math.max(0, config.dermisMm) },
    { type: "adipose", thicknessMm: Math.max(0, config.adiposeMm) },
    { type: "muscle", thicknessMm: Math.max(0, config.muscleMm) },
  ];
  if (includeBone) {
    layers.push({ type: "bone", thicknessMm: 2 });
  }
  return layers.filter((layer) => layer.thicknessMm > 0);
}

/** @deprecated Use buildPhotobioLayers */
export const layersFromLayerConfig = (config: PhotobioLayerConfig) =>
  buildPhotobioLayers(config, false);

export function getMuscleEntryDepthMm(config: PhotobioLayerConfig): number {
  return config.epidermisMm + config.dermisMm + config.adiposeMm;
}

export function getPhotobioWavelengthVisualPreset(
  wavelength: PhotobioWavelength,
): PhotobioWavelengthVisualPreset {
  return WAVELENGTH_VISUAL_PRESETS[wavelength];
}

export function classifyPhotobioDose(
  effectiveFluenceJcm2: number,
): PhotobioDoseClassification {
  const f = Math.max(0, effectiveFluenceJcm2);
  const t = PHOTOBIO_DOSE_THRESHOLDS;

  if (f < t.subdoseMax) {
    return { zone: "subdose", label: PHOTOBIO_DOSE_ZONE_LABELS.subdose, color: "yellow" };
  }
  if (f >= t.therapeuticMin && f <= t.therapeuticMax) {
    return { zone: "therapeutic", label: PHOTOBIO_DOSE_ZONE_LABELS.therapeutic, color: "green" };
  }
  if (f >= t.inhibitoryMin && f <= t.inhibitoryMax) {
    return { zone: "inhibitory", label: PHOTOBIO_DOSE_ZONE_LABELS.inhibitory, color: "blue" };
  }
  if (f >= t.saturationMin) {
    return { zone: "saturation", label: PHOTOBIO_DOSE_ZONE_LABELS.saturation, color: "red" };
  }
  return { zone: "transition", label: PHOTOBIO_DOSE_ZONE_LABELS.transition, color: "gray" };
}

export function getPhotobioDoseZoneColor(zone: PhotobioDoseZone): PhotobioDoseZoneColor {
  return classifyPhotobioDose(
    zone === "subdose"
      ? 0
      : zone === "therapeutic"
        ? 5
        : zone === "inhibitory"
          ? 20
          : zone === "saturation"
            ? 60
            : 9,
  ).color;
}

export function getIncidenceEfficiency(transducerAngleDeg: number): number {
  const angle = clamp(transducerAngleDeg, 30, 150);
  const radians = (Math.abs(90 - angle) * Math.PI) / 180;
  return Math.max(0.05, Math.cos(radians));
}

export function getContactTransmission(contactPressure: number): number {
  const pressure = clamp(contactPressure, 0, 100);
  if (pressure < 20) return 0.72;
  if (pressure > 80) return 1.08;
  return 0.88 + (pressure / 100) * 0.12;
}

export function resolveContactOpticalCoupling(input: PhotobioOpticsInput): number {
  if (input.contactOpticalCoupling != null) {
    return clamp(input.contactOpticalCoupling, 0.05, 1.15);
  }
  if (input.contactPressure != null) {
    return getContactTransmission(input.contactPressure);
  }
  return 0.95;
}

function resolveMelaninIndex(input: PhotobioOpticsInput): number {
  return clamp(input.skinMelaninIndex ?? input.melaninIndex ?? DEFAULT_MELANIN_INDEX, 0, 1);
}

export function resolveOpticsInput(input: PhotobioOpticsInput) {
  const incidenceEfficiency =
    input.incidenceEfficiency ?? getIncidenceEfficiency(input.transducerAngleDeg ?? 90);

  return {
    effectiveFluenceJcm2: input.effectiveFluenceJcm2 ?? input.fluenceJcm2,
    transducerAngleDeg: input.transducerAngleDeg ?? 90,
    contactPressure: input.contactPressure ?? 50,
    skinMelaninIndex: resolveMelaninIndex(input),
    incidenceEfficiency,
    contactOpticalCoupling: resolveContactOpticalCoupling(input),
  };
}

export function getSpotRadiusCm(spotSizeCm2: number): number {
  return Math.sqrt(Math.max(spotSizeCm2, 0.05) / Math.PI);
}

export function getBeamRadiusAtDepthMm(
  zMm: number,
  spotSizeCm2: number,
  wavelength: PhotobioWavelength,
): number {
  const preset = getPhotobioWavelengthVisualPreset(wavelength);
  const r0 = getSpotRadiusCm(spotSizeCm2);
  const spreadCm =
    (Math.max(0, zMm) * BEAM_SPREAD_MM_PER_MM[wavelength] * preset.beamSpreadScale) / 10;
  return r0 + spreadCm;
}

export function getTherapeuticWindowScore(localFluenceJcm2: number): number {
  const { zone } = classifyPhotobioDose(localFluenceJcm2);
  if (zone === "subdose") return clamp(localFluenceJcm2 / PHOTOBIO_DOSE_THRESHOLDS.subdoseMax, 0, 1) * 0.35;
  if (zone === "therapeutic") return 0.55 + ((localFluenceJcm2 - 2) / 6) * 0.45;
  if (zone === "inhibitory") return clamp(1 - (localFluenceJcm2 - 10) / 40, 0.35, 0.95);
  if (zone === "saturation") return 0.05;
  return 0.45;
}

function getLayerTypeAtDepthMm(zMm: number, layers: PhotobioLayer[]): PhotobioTissueType {
  let cursor = 0;
  for (const layer of layers) {
    cursor += layer.thicknessMm;
    if (zMm <= cursor + 1e-6) return layer.type;
  }
  return layers[layers.length - 1]?.type ?? "muscle";
}

/** Atenuação Beer–Lambert apenas no stack (sem acoplamento superficial). */
export function getStackFluenceRatioAtDepthMm(
  zMm: number,
  wavelength: PhotobioWavelength,
  layers: PhotobioLayer[],
  skinMelaninIndex: number,
): number {
  const targetZ = Math.max(0, zMm);
  let traversed = 0;
  let fluence = 1;

  for (const layer of layers) {
    if (layer.thicknessMm <= 0) continue;
    const remaining = targetZ - traversed;
    if (remaining <= 0) break;
    const stepMm = Math.min(layer.thicknessMm, remaining);
    const props = getPhotobioOpticalProperties(wavelength, layer.type, skinMelaninIndex);
    fluence *= Math.exp(-props.muEff * stepMm);
    traversed += stepMm;
  }

  return clamp(fluence, 0, 1);
}

/** Fluência relativa na profundidade z, incluindo incidência e acoplamento de contato. */
export function getRelativeFluenceAtDepthMm(
  zMm: number,
  input: PhotobioOpticsInput,
): number {
  const resolved = resolveOpticsInput(input);
  const stackRatio = getStackFluenceRatioAtDepthMm(
    zMm,
    input.wavelength,
    input.layers,
    resolved.skinMelaninIndex,
  );
  return clamp(
    resolved.incidenceEfficiency * resolved.contactOpticalCoupling * stackRatio,
    0,
    1.15,
  );
}

function getMuscleEntryDepthFromLayersMm(layers: PhotobioLayer[]): number {
  let depth = 0;
  for (const layer of layers) {
    if (layer.type === "muscle") return depth;
    depth += layer.thicknessMm;
  }
  return depth;
}

export function getMuscleFluenceRatio(input: PhotobioOpticsInput): number {
  const resolved = resolveOpticsInput(input);
  const muscleEntry = getMuscleEntryDepthFromLayersMm(input.layers);
  const stackRatio = getStackFluenceRatioAtDepthMm(
    muscleEntry,
    input.wavelength,
    input.layers,
    resolved.skinMelaninIndex,
  );
  return clamp(
    resolved.incidenceEfficiency * resolved.contactOpticalCoupling * stackRatio,
    0,
    1.15,
  );
}

export function getStackMuscleTransmission(input: PhotobioOpticsInput): number {
  const resolved = resolveOpticsInput(input);
  return getStackFluenceRatioAtDepthMm(
    getMuscleEntryDepthFromLayersMm(input.layers),
    input.wavelength,
    input.layers,
    resolved.skinMelaninIndex,
  );
}

export function samplePhotobioDepthProfile(
  input: PhotobioOpticsInput,
  stepMm = DEFAULT_STEP_MM,
): PhotobioDepthSample[] {
  const resolved = resolveOpticsInput(input);
  const totalDepth = input.layers.reduce((sum, layer) => sum + layer.thicknessMm, 0);
  const maxDepth = Math.max(totalDepth, stepMm);
  const samples: PhotobioDepthSample[] = [];
  let previousFluence =
    resolved.incidenceEfficiency * resolved.contactOpticalCoupling;

  for (let z = 0; z <= maxDepth + 1e-6; z += stepMm) {
    const zMm = Math.round(z * 100) / 100;
    const fluenceRelative = getRelativeFluenceAtDepthMm(zMm, input);
    const deltaFluence = Math.max(0, previousFluence - fluenceRelative);
    const layerType = getLayerTypeAtDepthMm(zMm, input.layers);
    const props = getPhotobioOpticalProperties(
      input.wavelength,
      layerType,
      resolved.skinMelaninIndex,
    );
    const absorbedRelative =
      deltaFluence * (props.muAbsorption / Math.max(props.muEff, 1e-6));
    const scatteredRelative =
      deltaFluence *
      ((props.muScattering * (1 - props.anisotropy)) / Math.max(props.muEff, 1e-6));
    const localFluenceJcm2 = resolved.effectiveFluenceJcm2 * fluenceRelative;

    samples.push({
      zMm,
      layerType,
      fluenceRelative,
      absorbedRelative: clamp(absorbedRelative, 0, 1),
      scatteredRelative: clamp(scatteredRelative, 0, 1),
      beamRadiusCm: getBeamRadiusAtDepthMm(zMm, input.spotSizeCm2, input.wavelength),
      therapeuticWindowScore: getTherapeuticWindowScore(localFluenceJcm2),
    });

    previousFluence = fluenceRelative;
  }

  return samples;
}

/** @deprecated Use samplePhotobioDepthProfile */
export const buildDepthSamples = samplePhotobioDepthProfile;

function buildLayerSummaries(input: PhotobioOpticsInput): PhotobioLayerSummary[] {
  const resolved = resolveOpticsInput(input);
  const surfaceTransmission =
    resolved.incidenceEfficiency * resolved.contactOpticalCoupling;
  let entryFluence = surfaceTransmission;
  let cursor = 0;
  const summaries: PhotobioLayerSummary[] = [];

  for (const layer of input.layers) {
    if (layer.thicknessMm <= 0) continue;
    const exitFluence = getRelativeFluenceAtDepthMm(cursor + layer.thicknessMm, input);
    summaries.push({
      layerType: layer.type,
      thicknessMm: layer.thicknessMm,
      absorbedFraction: clamp(
        (entryFluence - exitFluence) / Math.max(surfaceTransmission, 1e-6),
        0,
        1,
      ),
      transmittedFraction: clamp(exitFluence / Math.max(surfaceTransmission, 1e-6), 0, 1),
      entryFluenceRelative: entryFluence,
      exitFluenceRelative: exitFluence,
    });
    entryFluence = exitFluence;
    cursor += layer.thicknessMm;
  }

  return summaries;
}

export function buildPenetrationProfile(
  layerSummaries: PhotobioLayerSummary[],
): PhotobioPenetrationLayer[] {
  const pick = (types: PhotobioTissueType[]) =>
    layerSummaries
      .filter((summary) => types.includes(summary.layerType))
      .reduce((sum, summary) => sum + summary.absorbedFraction, 0);

  const epidermisDermis = pick(["epidermis", "dermis"]);
  const hypodermis = pick(["adipose"]);
  const muscle = pick(["muscle"]);
  const total = epidermisDermis + hypodermis + muscle;

  if (total <= 1e-6) {
    return [
      { layer: "epidermis_dermis", absorbedFraction: 0.5 },
      { layer: "hypodermis", absorbedFraction: 0.3 },
      { layer: "muscle", absorbedFraction: 0.2 },
    ];
  }

  return [
    { layer: "epidermis_dermis", absorbedFraction: epidermisDermis / total },
    { layer: "hypodermis", absorbedFraction: hypodermis / total },
    { layer: "muscle", absorbedFraction: muscle / total },
  ];
}

function resolvePeakAbsorptionLayer(
  summaries: PhotobioLayerSummary[],
): PhotobioTissueType {
  if (summaries.length === 0) return "epidermis";
  return summaries.reduce((peak, layer) =>
    layer.absorbedFraction > peak.absorbedFraction ? layer : peak,
  ).layerType;
}

function resolveDominantOpticalPhenomenon(
  input: PhotobioOpticsInput,
  summaries: PhotobioLayerSummary[],
  stackMuscleTransmission: number,
): string {
  const peak = resolvePeakAbsorptionLayer(summaries);
  const superficial = summaries
    .filter((s) => s.layerType === "epidermis" || s.layerType === "dermis")
    .reduce((sum, s) => sum + s.absorbedFraction, 0);
  const adipose = summaries
    .filter((s) => s.layerType === "adipose")
    .reduce((sum, s) => sum + s.absorbedFraction, 0);

  if (input.wavelength === 660 && superficial > 0.28) {
    return "Absorção superficial dominante (660 nm)";
  }
  if (input.wavelength === 808 && stackMuscleTransmission > 0.04) {
    return "Penetração profunda / entrega muscular (808 nm)";
  }
  if (adipose > 0.35) {
    return "Atenuação limitada pela camada adiposa";
  }
  if (peak === "muscle") {
    return "Deposição de energia preferencial no músculo";
  }
  if (peak === "bone") {
    return "Barreira óssea / alta atenuação profunda";
  }
  return "Espalhamento difuso com absorção moderada";
}

function resolvePenetrationDepthMm(samples: PhotobioDepthSample[]): number {
  for (const sample of samples) {
    if (sample.fluenceRelative <= PENETRATION_THRESHOLD) return sample.zMm;
  }
  return samples[samples.length - 1]?.zMm ?? 0;
}

function resolveBeamVisualDepthMm(
  samples: PhotobioDepthSample[],
  totalStackDepthMm: number,
  wavelength: PhotobioWavelength,
): number {
  const preset = getPhotobioWavelengthVisualPreset(wavelength);
  for (const sample of samples) {
    if (sample.fluenceRelative <= VISUAL_BEAM_THRESHOLD * preset.superficialBias) {
      return Math.max(1.5, sample.zMm);
    }
  }
  return Math.max(1.5, totalStackDepthMm);
}

function computePhysicalOpticsMetrics(
  layerSummaries: PhotobioLayerSummary[],
  stackMuscleTransmission: number,
  effectiveMuscleTransmission: number,
): {
  superficialAbsorptionIndex: number;
  deepDeliveryIndex: number;
  targetMuscleTransmission: number;
} {
  const superficialAbsorptionIndex = clamp(
    layerSummaries
      .filter((summary) => summary.layerType === "epidermis" || summary.layerType === "dermis")
      .reduce((sum, summary) => sum + summary.absorbedFraction, 0),
    0,
    1,
  );

  return {
    superficialAbsorptionIndex,
    /** Transmissão Beer–Lambert ao plano muscular (sem acoplamento de contato). */
    deepDeliveryIndex: clamp(stackMuscleTransmission, 0, 1),
    /** Fluência relativa efetiva no músculo (incidência × contato × stack). */
    targetMuscleTransmission: clamp(effectiveMuscleTransmission, 0, 1.15),
  };
}

export function computePhotobioOptics(
  input: PhotobioOpticsInput,
  stepMm = DEFAULT_STEP_MM,
): PhotobioOpticsResult {
  const resolved = resolveOpticsInput(input);
  const samples = samplePhotobioDepthProfile(input, stepMm);
  const layerSummaries = buildLayerSummaries(input);
  const penetrationProfile = buildPenetrationProfile(layerSummaries);
  const totalStackDepthMm = input.layers.reduce((sum, layer) => sum + layer.thicknessMm, 0);
  const stackMuscleTransmission = getStackMuscleTransmission(input);
  const effectiveMuscleTransmission = getMuscleFluenceRatio(input);
  const physicalMetrics = computePhysicalOpticsMetrics(
    layerSummaries,
    stackMuscleTransmission,
    effectiveMuscleTransmission,
  );
  const targetMuscleTransmission = physicalMetrics.targetMuscleTransmission;
  const targetMuscleFluenceJcm2 =
    resolved.effectiveFluenceJcm2 * targetMuscleTransmission;
  const doseClassification = classifyPhotobioDose(resolved.effectiveFluenceJcm2);

  const superficialAbsorptionIndex = physicalMetrics.superficialAbsorptionIndex;
  const deepDeliveryIndex = physicalMetrics.deepDeliveryIndex;
  const thermalRiskIndex = clamp(input.irradianceMwCm2 / THERMAL_RISK_IRRADIANCE_MW, 0, 1);
  const biologicalActivationIndex = clamp(
    getTherapeuticWindowScore(targetMuscleFluenceJcm2),
    0,
    1,
  );
  const inhibitionRiskIndex =
    doseClassification.zone === "saturation"
      ? 1
      : doseClassification.zone === "inhibitory"
        ? clamp((resolved.effectiveFluenceJcm2 - 10) / 40, 0.2, 0.85)
        : doseClassification.zone === "transition" && resolved.effectiveFluenceJcm2 > 8
          ? 0.35
          : 0.05;

  const result: PhotobioOpticsResult = {
    samples,
    surfaceFluenceJcm2: input.fluenceJcm2,
    effectiveFluenceJcm2: resolved.effectiveFluenceJcm2,
    targetMuscleFluenceJcm2,
    targetMuscleTransmission,
    peakAbsorptionLayer: resolvePeakAbsorptionLayer(layerSummaries),
    dominantOpticalPhenomenon: resolveDominantOpticalPhenomenon(
      input,
      layerSummaries,
      stackMuscleTransmission,
    ),
    superficialAbsorptionIndex,
    deepDeliveryIndex,
    thermalRiskIndex,
    biologicalActivationIndex,
    inhibitionRiskIndex,
    doseClassification,
    wavelength: input.wavelength,
    depthSamples: samples,
    layerSummaries,
    penetrationProfile,
    muscleFluenceRatio: targetMuscleTransmission,
    muscleFluenceJcm2: targetMuscleFluenceJcm2,
    penetrationDepthMm: resolvePenetrationDepthMm(samples),
    beamVisualDepthMm: resolveBeamVisualDepthMm(samples, totalStackDepthMm, input.wavelength),
    totalStackDepthMm,
    spotRadiusCm: getSpotRadiusCm(input.spotSizeCm2),
    incidenceEfficiency: resolved.incidenceEfficiency,
    contactTransmission: resolved.contactOpticalCoupling,
  };

  return result;
}

/** @deprecated Use computePhotobioOptics */
export function buildPhotobioOpticsProfile(
  input: PhotobioOpticsInput,
  stepMm = DEFAULT_STEP_MM,
): PhotobioOpticsSummary {
  return computePhotobioOptics(
    {
      ...input,
      effectiveFluenceJcm2: input.effectiveFluenceJcm2 ?? input.fluenceJcm2,
    },
    stepMm,
  );
}

export function getRelativeFluenceAtBeamProgress(
  progress: number,
  profile: PhotobioOpticsResult,
): number {
  const t = clamp(progress, 0, 1);
  const zMm = t * profile.beamVisualDepthMm;
  const samples = profile.samples;
  if (samples.length === 0) return 1;

  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const next = samples[i];
    if (zMm <= next.zMm) {
      const span = Math.max(next.zMm - prev.zMm, 1e-6);
      const alpha = (zMm - prev.zMm) / span;
      return prev.fluenceRelative + (next.fluenceRelative - prev.fluenceRelative) * alpha;
    }
  }

  return samples[samples.length - 1].fluenceRelative;
}

export function getVisualBeamChannelFactors(
  progress: number,
  channel: PhotobioBeamVisualChannel,
  profile: PhotobioOpticsResult,
): { attenuation: number; scatterBoost: number } {
  const preset = getPhotobioWavelengthVisualPreset(profile.wavelength);
  const fluence = getRelativeFluenceAtBeamProgress(progress, profile);
  const zMm = clamp(progress, 0, 1) * profile.beamVisualDepthMm;
  const sample =
    profile.samples.find((entry) => entry.zMm >= zMm) ??
    profile.samples[profile.samples.length - 1];
  const scatter = (sample?.scatteredRelative ?? 0) * preset.scatterDepthFactor;

  if (channel === "core") {
    return {
      attenuation: clamp(Math.pow(fluence, 0.92), 0.02, 1),
      scatterBoost: 1,
    };
  }

  return {
    attenuation: clamp(Math.pow(fluence, 0.68), 0.03, 1),
    scatterBoost: 1 + scatter * 0.45,
  };
}

export function photobioDepthMmToWorldUnits(zMm: number, mmToWorld = 0.09): number {
  return Math.max(0, zMm) * mmToWorld;
}

/** Helpers para análise de dose map com limiares unificados */
export function classifyDoseMapBin(doseJcm2: number): PhotobioDoseZone | "untouched" {
  if (doseJcm2 <= 0.5) return "untouched";
  return classifyPhotobioDose(doseJcm2).zone;
}

export function isTherapeuticDose(doseJcm2: number): boolean {
  return classifyPhotobioDose(doseJcm2).zone === "therapeutic";
}

export function isOverDose(doseJcm2: number): boolean {
  const zone = classifyPhotobioDose(doseJcm2).zone;
  return zone === "inhibitory" || zone === "saturation";
}

/** Cores educacionais para overlay de resposta biológica */
export function getPhotobioBioResponseColor(zone: PhotobioDoseZone): {
  color: string;
  emissive: string;
  opacity: number;
} {
  switch (zone) {
    case "subdose":
      return { color: "#64748b", emissive: "#475569", opacity: 0.12 };
    case "therapeutic":
      return { color: "#22d3ee", emissive: "#06b6d4", opacity: 0.28 };
    case "transition":
      return { color: "#eab308", emissive: "#ca8a04", opacity: 0.22 };
    case "inhibitory":
      return { color: "#f97316", emissive: "#ea580c", opacity: 0.3 };
    case "saturation":
      return { color: "#ef4444", emissive: "#dc2626", opacity: 0.38 };
    default:
      return { color: "#94a3b8", emissive: "#64748b", opacity: 0.1 };
  }
}
