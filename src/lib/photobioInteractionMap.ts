/**
 * Mapa 2D educacional de interação óptica — Fotobiomodulação.
 * Grid lateral (x) × profundidade (z), heurístico, não clínico.
 */

import {
  buildPhotobioLayers,
  classifyPhotobioDose,
  getBeamRadiusAtDepthMm,
  getIncidenceEfficiency,
  getPhotobioOpticalProperties,
  getStackFluenceRatioAtDepthMm,
  getTherapeuticWindowScore,
  resolveContactOpticalCoupling,
  type PhotobioLayer,
  type PhotobioLayerConfig,
  type PhotobioTissueType,
  type PhotobioWavelength,
} from "@/lib/photobioOptics";
import { getPhotobioInteractionMapResolution } from "@/lib/therapeuticLabsPerformance";

export interface PhotobioFieldCell {
  xNorm: number;
  zNorm: number;
  zMm: number;
  layerType: PhotobioTissueType;
  fluenceRelative: number;
  fluenceJcm2: number;
  absorbedRelative: number;
  scatteredRelative: number;
  biologicalActivation: number;
  inhibitionRisk: number;
  thermalRisk: number;
}

export interface PhotobioInteractionMap {
  width: number;
  height: number;
  maxDepthMm: number;
  cells: PhotobioFieldCell[];
  maxFluenceJcm2: number;
  maxAbsorption: number;
  targetDepthMm: number;
  targetLayer: PhotobioTissueType;
  beamCenterXNorm: number;
  wavelength: PhotobioWavelength;
}

/** Largura lateral do bloco PBM em unidades mundo (≈ eixo X do viewer) */
export const PHOTOBIO_TISSUE_WIDTH_WORLD = 8.5;
export const PHOTOBIO_TISSUE_HALF_WIDTH_WORLD = PHOTOBIO_TISSUE_WIDTH_WORLD / 2;

export interface BuildPhotobioInteractionMapInput {
  wavelength: PhotobioWavelength;
  fluenceJcm2: number;
  effectiveFluenceJcm2: number;
  irradianceMwCm2: number;
  spotSizeCm2: number;
  layers: PhotobioLayer[];
  layerConfig?: PhotobioLayerConfig;
  transducerXWorld?: number;
  transducerAngleDeg?: number;
  contactPressure?: number;
  contactOpticalCoupling?: number;
  skinMelaninIndex?: number;
  incidenceEfficiency?: number;
  width?: number;
  height?: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getLayerTypeAtDepthMm(zMm: number, layers: PhotobioLayer[]): PhotobioTissueType {
  let cursor = 0;
  for (const layer of layers) {
    cursor += layer.thicknessMm;
    if (zMm <= cursor + 1e-6) return layer.type;
  }
  return layers[layers.length - 1]?.type ?? "muscle";
}

function getMuscleEntryDepthMm(layers: PhotobioLayer[]): number {
  let depth = 0;
  for (const layer of layers) {
    if (layer.type === "muscle") return depth;
    depth += layer.thicknessMm;
  }
  return depth;
}

function resolveMelanin(input: BuildPhotobioInteractionMapInput): number {
  return clamp01(input.skinMelaninIndex ?? 0.35);
}

function resolveSurfaceCoupling(input: BuildPhotobioInteractionMapInput): number {
  if (input.contactOpticalCoupling != null) {
    return clamp01(input.contactOpticalCoupling);
  }
  return resolveContactOpticalCoupling({
    wavelength: input.wavelength,
    fluenceJcm2: input.fluenceJcm2,
    effectiveFluenceJcm2: input.effectiveFluenceJcm2,
    irradianceMwCm2: input.irradianceMwCm2,
    spotSizeCm2: input.spotSizeCm2,
    layers: input.layers,
    contactPressure: input.contactPressure,
  });
}

function resolveIncidence(input: BuildPhotobioInteractionMapInput): number {
  if (input.incidenceEfficiency != null) return clamp01(input.incidenceEfficiency);
  return getIncidenceEfficiency(input.transducerAngleDeg ?? 90);
}

/** Deslocamento lateral do feixe com profundidade (ângulo ≠ 90°) — cm pedagógico */
function angleLateralShiftCm(
  zMm: number,
  transducerAngleDeg: number,
): number {
  const tiltRad = ((transducerAngleDeg - 90) * Math.PI) / 180;
  return Math.tan(tiltRad) * zMm * 0.1;
}

export function buildPhotobioInteractionMap(
  input: BuildPhotobioInteractionMapInput,
): PhotobioInteractionMap {
  const res = getPhotobioInteractionMapResolution();
  const width = input.width ?? res.width;
  const height = input.height ?? res.height;
  const layers =
    input.layers.length > 0
      ? input.layers
      : input.layerConfig
        ? buildPhotobioLayers(input.layerConfig)
        : [];

  const maxDepthMm = Math.max(
    0.1,
    layers.reduce((sum, layer) => sum + layer.thicknessMm, 0),
  );
  const melanin = resolveMelanin(input);
  const surfaceCoupling = resolveSurfaceCoupling(input);
  const incidence = resolveIncidence(input);
  const transducerX = input.transducerXWorld ?? 0;
  const beamCenterXNorm = clamp(
    transducerX / PHOTOBIO_TISSUE_HALF_WIDTH_WORLD,
    -1,
    1,
  );
  const angleDeg = input.transducerAngleDeg ?? 90;
  const thermalRiskBase = clamp01(input.irradianceMwCm2 / 500);
  const targetDepthMm = getMuscleEntryDepthMm(layers);

  const cells: PhotobioFieldCell[] = new Array(width * height);
  let maxFluenceJcm2 = 0;
  let maxAbsorption = 0;

  for (let row = 0; row < height; row += 1) {
    const zNorm = row / Math.max(1, height - 1);
    const zMm = zNorm * maxDepthMm;
    const layerType = getLayerTypeAtDepthMm(zMm, layers);
    const props = getPhotobioOpticalProperties(input.wavelength, layerType, melanin);
    const stackRatio = getStackFluenceRatioAtDepthMm(
      zMm,
      input.wavelength,
      layers,
      melanin,
    );
    const centerFluenceRel = surfaceCoupling * incidence * stackRatio;
    const beamRadiusCm = Math.max(
      0.05,
      getBeamRadiusAtDepthMm(zMm, input.spotSizeCm2, input.wavelength),
    );
    const angleShiftCm = angleLateralShiftCm(zMm, angleDeg);

    for (let col = 0; col < width; col += 1) {
      const xNorm = (col / Math.max(1, width - 1)) * 2 - 1;
      const worldX = xNorm * PHOTOBIO_TISSUE_HALF_WIDTH_WORLD;
      const lateralCm =
        Math.abs(worldX - transducerX) * (PHOTOBIO_TISSUE_HALF_WIDTH_WORLD / 4.25) -
        angleShiftCm;
      const lateralGauss = Math.exp(
        -0.5 * Math.pow(Math.max(0, lateralCm) / beamRadiusCm, 2),
      );

      const fluenceRelative = clamp01(centerFluenceRel * lateralGauss);
      const fluenceJcm2 = input.effectiveFluenceJcm2 * fluenceRelative;
      const absorbedRelative = clamp01(
        fluenceRelative * (props.muAbsorption / Math.max(props.muEff, 1e-6)),
      );
      const scatteredRelative = clamp01(
        fluenceRelative *
          ((props.muScattering * (1 - props.anisotropy)) / Math.max(props.muEff, 1e-6)),
      );
      const doseClass = classifyPhotobioDose(fluenceJcm2);
      const inhibitionRisk =
        doseClass.zone === "saturation"
          ? 1
          : doseClass.zone === "inhibitory"
            ? clamp01((fluenceJcm2 - 10) / 40)
            : doseClass.zone === "transition" && fluenceJcm2 > 8
              ? 0.35
              : 0.05;

      maxFluenceJcm2 = Math.max(maxFluenceJcm2, fluenceJcm2);
      maxAbsorption = Math.max(maxAbsorption, absorbedRelative);

      cells[row * width + col] = {
        xNorm,
        zNorm,
        zMm,
        layerType,
        fluenceRelative,
        fluenceJcm2,
        absorbedRelative,
        scatteredRelative,
        biologicalActivation: getTherapeuticWindowScore(fluenceJcm2),
        inhibitionRisk,
        thermalRisk: thermalRiskBase * fluenceRelative,
      };
    }
  }

  return {
    width,
    height,
    maxDepthMm,
    cells,
    maxFluenceJcm2,
    maxAbsorption,
    targetDepthMm,
    targetLayer: "muscle",
    beamCenterXNorm,
    wavelength: input.wavelength,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function samplePhotobioInteractionCell(
  map: PhotobioInteractionMap,
  xNorm: number,
  zNorm: number,
): PhotobioFieldCell | undefined {
  const colF = clamp01((xNorm + 1) / 2) * Math.max(0, map.width - 1);
  const rowF = clamp01(zNorm) * Math.max(0, map.height - 1);
  const col = Math.round(colF);
  const row = Math.round(rowF);
  return map.cells[row * map.width + col];
}
