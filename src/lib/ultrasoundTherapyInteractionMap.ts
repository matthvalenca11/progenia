/**
 * Mapa educacional de interação acústica nos tecidos — modelo heurístico, não clínico.
 */

import type { TherapeuticTransducerType } from "@/config/therapeuticTransducerDefinitions";
import { isAndroidNative } from "@/lib/labPerformance";
import {
  buildStackLayers,
  getBoneStartDepth,
  TOTAL_BLOCK_DEPTH,
  type StackCustomThicknesses,
} from "@/lib/ultrasoundTherapyStack";
import { resolveMixedLayerConfig } from "@/lib/ultrasoundTherapyStackConfig";
import {
  evaluateBoneAcousticEffect,
  TISSUE_ACOUSTIC_HALF_W,
} from "@/lib/ultrasoundTherapyBoneAcoustics";
import {
  getThermalBeamGeometryFactor,
  getBeamRadiusAtDepthCm,
  getEquivalentDiameterCm,
  type AcousticPhysicsInput,
} from "@/lib/ultrasoundTherapyPhysics";
import { getTransducerDefinition } from "@/config/therapeuticTransducerDefinitions";
import type {
  AnatomicalScenario,
  CouplingQuality,
  TransducerBeamProfile,
  TransducerMovement,
  UltrasoundMode,
} from "@/types/ultrasoundTherapyConfig";

export type UltrasoundInteractionCell = {
  xNorm: number;
  depthCm: number;
  tissueKind: "skin" | "fat" | "muscle" | "bone" | "mixed" | string;
  relativeIntensity: number;
  pressureProxy: number;
  attenuationLoss: number;
  thermalRate: number;
  estimatedTemp: number;
  cavitationIndex: number;
  reflectionIndex: number;
  standingWaveIndex: number;
  tissueStressIndex: number;
  lesionIndex: number;
  ablationIndex: number;
};

export type UltrasoundDominantPhenomenon =
  | "attenuation"
  | "deep-heating"
  | "surface-heating"
  | "cavitation"
  | "bone-reflection"
  | "standing-wave"
  | "thermal-lesion"
  | "ablation"
  | "balanced";

export type UltrasoundInteractionMap = {
  width: number;
  height: number;
  maxDepthCm: number;
  cells: UltrasoundInteractionCell[];
  summary: {
    maxIntensity: number;
    maxTemp: number;
    maxCavitationIndex: number;
    maxReflectionIndex: number;
    maxLesionIndex: number;
    maxAblationIndex: number;
    dominantPhenomenon: UltrasoundDominantPhenomenon;
  };
};

export const INTERACTION_MAP_RESOLUTION_DESKTOP = { width: 72, height: 56 } as const;
export const INTERACTION_MAP_RESOLUTION_MOBILE = { width: 40, height: 32 } as const;

export function getDefaultInteractionMapResolution(): {
  width: number;
  height: number;
} {
  return isAndroidNative
    ? { ...INTERACTION_MAP_RESOLUTION_MOBILE }
    : { ...INTERACTION_MAP_RESOLUTION_DESKTOP };
}

const TISSUE_ATTENUATION_DB: Record<string, number> = {
  skin: 0.5,
  fat: 0.3,
  muscle: 0.7,
  bone: 2.0,
  mixed: 0.85,
};

const TISSUE_ABSORPTION_FACTOR: Record<string, number> = {
  skin: 0.075,
  fat: 0.045,
  muscle: 0.105,
  bone: 0.3,
  mixed: 0.09,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getTissueAtDepth(
  depthCm: number,
  scenario: AnatomicalScenario,
  customThicknesses?: StackCustomThicknesses,
  mixedLayer?: { enabled: boolean; depth: number; division: number },
  xNorm?: number,
): UltrasoundInteractionCell["tissueKind"] {
  const layers = buildStackLayers(scenario, customThicknesses);

  if (
    mixedLayer?.enabled &&
    depthCm >= mixedLayer.depth &&
    xNorm != null
  ) {
    const boundaryX = (mixedLayer.division / 100) * 2 - 1;
    if (Math.abs(xNorm - boundaryX) < 0.08) {
      return "mixed";
    }
    return xNorm > boundaryX ? "bone" : "muscle";
  }

  for (const layer of layers) {
    if (depthCm >= layer.depth && depthCm < layer.depth + layer.thickness) {
      return layer.type;
    }
  }
  return layers[layers.length - 1]?.type ?? "muscle";
}

function getTissueAttenuationLinear(
  depthCm: number,
  frequencyMHz: number,
  tissueKind: string,
): number {
  const coeff = TISSUE_ATTENUATION_DB[tissueKind] ?? 0.7;
  const frequencyFactor = 0.5 + (frequencyMHz - 1) * 0.8;
  const attenuationDb = coeff * frequencyFactor * depthCm * 1.5;
  return Math.pow(10, -attenuationDb / 10);
}

function getAttenuationLoss(depthCm: number, frequencyMHz: number, tissueKind: string): number {
  return clamp01(1 - getTissueAttenuationLinear(depthCm, frequencyMHz, tissueKind));
}

function radialBeamFactor(
  xNorm: number,
  depthCm: number,
  maxLateralCm: number,
  acoustic: AcousticPhysicsInput,
): number {
  const beamRadius = Math.max(0.05, getBeamRadiusAtDepthCm(depthCm, acoustic));
  const lateralCm = xNorm * maxLateralCm;
  const sigma = beamRadius * 0.55;
  return Math.exp(-0.5 * (lateralCm / sigma) ** 2);
}

function resolveDominantPhenomenon(
  cells: UltrasoundInteractionCell[],
): UltrasoundDominantPhenomenon {
  if (cells.length === 0) return "balanced";

  let attenuationScore = 0;
  let deepHeating = 0;
  let surfaceHeating = 0;
  let cavitation = 0;
  let reflection = 0;
  let standingWave = 0;
  let lesion = 0;
  let ablation = 0;

  for (const cell of cells) {
    attenuationScore += cell.attenuationLoss;
    if (cell.depthCm >= 1.2) {
      deepHeating = Math.max(deepHeating, cell.thermalRate);
    }
    if (cell.depthCm <= 0.6) {
      surfaceHeating = Math.max(surfaceHeating, cell.thermalRate);
    }
    cavitation = Math.max(cavitation, cell.cavitationIndex);
    reflection = Math.max(reflection, cell.reflectionIndex);
    standingWave = Math.max(standingWave, cell.standingWaveIndex);
    lesion = Math.max(lesion, cell.lesionIndex);
    ablation = Math.max(ablation, cell.ablationIndex);
  }

  attenuationScore /= cells.length;

  const ranked: Array<{ key: UltrasoundDominantPhenomenon; score: number }> = [
    { key: "ablation", score: ablation },
    { key: "thermal-lesion", score: lesion },
    { key: "cavitation", score: cavitation },
    { key: "standing-wave", score: standingWave },
    { key: "bone-reflection", score: reflection },
    { key: "deep-heating", score: deepHeating },
    { key: "surface-heating", score: surfaceHeating },
    { key: "attenuation", score: attenuationScore },
  ];

  ranked.sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top || top.score < 0.12) {
    return "balanced";
  }
  return top.key;
}

export interface BuildUltrasoundInteractionMapInput {
  scenario: AnatomicalScenario;
  customThicknesses?: StackCustomThicknesses;
  mixedLayer?: { enabled: boolean; depth: number; division: number };
  frequencyMHz: number;
  intensity: number;
  eraCm2: number;
  transducerType: TherapeuticTransducerType;
  beamProfile: TransducerBeamProfile;
  focusDepthCm: number;
  mode: UltrasoundMode;
  dutyCycle: number;
  coupling: CouplingQuality;
  movement: TransducerMovement;
  surfaceTemp: number;
  maxTemp: number;
  maxTempDepth: number;
  thermalDose: number;
  cumulativeDose: number;
  boneReflection: number;
  acoustic: AcousticPhysicsInput;
  maxDepthCm?: number;
  resolution?: { width: number; height: number };
}

export function buildUltrasoundInteractionMap(
  input: BuildUltrasoundInteractionMapInput,
): UltrasoundInteractionMap {
  const resolution = input.resolution ?? getDefaultInteractionMapResolution();
  const { width, height } = resolution;
  const maxDepthCm = input.maxDepthCm ?? TOTAL_BLOCK_DEPTH;
  const couplingEfficiency = input.coupling === "good" ? 0.95 : 0.7;
  const effectiveIntensity = input.intensity * couplingEfficiency;
  const dutyFactor = input.mode === "continuous" ? 1 : input.dutyCycle / 100;
  const movementFactor = input.movement === "scanning" ? 0.4 : 1;
  const modeCavitationBoost =
    input.mode === "pulsed" ? 1 + (1 - input.dutyCycle / 100) * 0.45 : 1;
  const couplingCavitationBoost = input.coupling === "poor" ? 1.4 : 1;

  const resolvedMixedLayer = resolveMixedLayerConfig(
    input.scenario,
    input.customThicknesses,
    input.mixedLayer,
  );

  const boneStart = getBoneStartDepth(input.scenario, input.customThicknesses);
  const mixedBoneDepth = resolvedMixedLayer?.depth ?? null;

  const maxLateralCm =
    getBeamRadiusAtDepthCm(maxDepthCm, input.acoustic) * 1.25;

  const cells: UltrasoundInteractionCell[] = [];
  let maxIntensity = 0;
  let maxTemp = 37;
  let maxCavitationIndex = 0;
  let maxReflectionIndex = 0;
  let maxLesionIndex = 0;
  let maxAblationIndex = 0;
  let maxThermalRate = 0;

  const thermalRates: number[] = [];

  for (let row = 0; row < height; row++) {
    const depthCm = (row / Math.max(1, height - 1)) * maxDepthCm;

    for (let col = 0; col < width; col++) {
      const xNorm = width <= 1 ? 0 : (col / (width - 1)) * 2 - 1;
      const tissueKind = getTissueAtDepth(
        depthCm,
        input.scenario,
        input.customThicknesses,
        resolvedMixedLayer,
        xNorm,
      );

      const tissueAtt = getTissueAttenuationLinear(
        depthCm,
        input.frequencyMHz,
        tissueKind,
      );
      const beamGeo = getThermalBeamGeometryFactor(depthCm, input.acoustic);
      const radial = radialBeamFactor(xNorm, depthCm, maxLateralCm, input.acoustic);
      const beamFactor = tissueAtt * beamGeo * radial;
      let relativeIntensity = clamp01(beamFactor);

      const worldXcm = xNorm * TISSUE_ACOUSTIC_HALF_W;
      const boneFx = evaluateBoneAcousticEffect(
        depthCm,
        worldXcm,
        input.scenario,
        input.customThicknesses,
        resolvedMixedLayer,
      );
      relativeIntensity *= boneFx.transmission;

      const pressureProxy = Math.sqrt(relativeIntensity * couplingEfficiency);
      const attenuationLoss = getAttenuationLoss(
        depthCm,
        input.frequencyMHz,
        tissueKind,
      );

      const absorption = TISSUE_ABSORPTION_FACTOR[tissueKind] ?? 0.1;
      const thermalRate =
        relativeIntensity *
        effectiveIntensity *
        absorption *
        dutyFactor *
        movementFactor *
        (boneFx.inBone ? 0.12 : 1);

      thermalRates.push(thermalRate);

      cells.push({
        xNorm,
        depthCm,
        tissueKind,
        relativeIntensity,
        pressureProxy,
        attenuationLoss,
        thermalRate,
        estimatedTemp: 37,
        cavitationIndex: 0,
        reflectionIndex: 0,
        standingWaveIndex: 0,
        tissueStressIndex: 0,
        lesionIndex: 0,
        ablationIndex: 0,
      });
    }
  }

  maxThermalRate = Math.max(...thermalRates, 1e-6);

  const engineRise = Math.max(0, input.maxTemp - 37);
  const minVisualRise =
    effectiveIntensity * dutyFactor * movementFactor *
    (input.acoustic.beamProfile === "focused" ? 1.35 : 0.85);
  const totalRise = Math.max(engineRise, minVisualRise);

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const depthCm = cell.depthCm;

    let estimatedTemp = 37 + (cell.thermalRate / maxThermalRate) * totalRise;
    if (depthCm < 0.45 && input.acoustic.beamProfile !== "focused") {
      const surfaceBlend = 1 - depthCm / 0.45;
      estimatedTemp =
        estimatedTemp * (1 - surfaceBlend * 0.65) +
        input.surfaceTemp * surfaceBlend * 0.65;
    }
    if (Math.abs(depthCm - input.maxTempDepth) < 0.28) {
      estimatedTemp = Math.max(estimatedTemp, input.maxTemp * 0.94);
    }
    if (input.acoustic.beamProfile === "focused") {
      const focusZ = Math.max(input.acoustic.focusDepthCm, 0.2);
      const diameter = getEquivalentDiameterCm(input.acoustic.eraCm2, input.acoustic.transducerType);
      const faceR = diameter / 2;
      const waistR = faceR * (getTransducerDefinition(input.acoustic.transducerType).beam.waistRatio ?? 0.24);
      const lateralCm = cell.xNorm * maxLateralCm;
      const sigmaZ = focusZ * 0.36;
      const sigmaX = Math.max(waistR * 0.95, 0.05);
      const axial = Math.exp(-0.5 * ((depthCm - focusZ) / sigmaZ) ** 2);
      const lateral = Math.exp(-0.5 * (lateralCm / sigmaX) ** 2);
      const cigar = axial * lateral;
      const focusBoost = 0.35 + cigar * 2.4;
      estimatedTemp = 37 + (estimatedTemp - 37) * focusBoost;
      if (Math.abs(depthCm - focusZ) < 0.35 && Math.abs(lateralCm) < waistR * 1.2) {
        estimatedTemp = Math.max(estimatedTemp, 37 + totalRise * 0.88);
      }
    }
    const lateralDissipation = radialBeamFactor(
      cell.xNorm,
      depthCm,
      maxLateralCm,
      input.acoustic,
    );
    const radialExponent = input.acoustic.beamProfile === "focused" ? 0.9 : 1.65;
    const radialFalloff = Math.pow(lateralDissipation, radialExponent);
    estimatedTemp = 37 + (estimatedTemp - 37) * radialFalloff;
    estimatedTemp = Math.min(52, Math.max(37, estimatedTemp));
    cell.estimatedTemp = estimatedTemp;

    cell.cavitationIndex = clamp01(
      cell.pressureProxy *
        (effectiveIntensity / 2.5) *
        modeCavitationBoost *
        couplingCavitationBoost *
        0.55,
    );

    let reflectionIndex = 0;
    let distToBone = Infinity;
    const worldXcm = cell.xNorm * TISSUE_ACOUSTIC_HALF_W;
    const boneFx = evaluateBoneAcousticEffect(
      depthCm,
      worldXcm,
      input.scenario,
      input.customThicknesses,
      resolvedMixedLayer,
    );
    const interfaceDepth = mixedBoneDepth ?? boneStart;

    reflectionIndex = Math.max(
      reflectionIndex,
      boneFx.reflection * (0.42 + cell.relativeIntensity * 0.48 + input.boneReflection * 0.38),
    );

    if (interfaceDepth != null) {
      distToBone = depthCm - interfaceDepth;
      if (distToBone >= -0.35 && distToBone <= 0.55) {
        const proximity = 1 - Math.min(1, Math.abs(distToBone) / 0.45);
        reflectionIndex = clamp01(
          Math.max(
            reflectionIndex,
            (0.18 + cell.relativeIntensity * 0.52 + input.boneReflection * 0.4) * proximity,
          ),
        );
        if (cell.tissueKind === "bone" || cell.tissueKind === "mixed") {
          reflectionIndex = clamp01(reflectionIndex + 0.12);
        }
      }
    }

    cell.reflectionIndex = reflectionIndex;

    cell.standingWaveIndex = clamp01(
      reflectionIndex * clamp01(1 - Math.abs(distToBone) / 0.65) * 0.95,
    );

    cell.tissueStressIndex = clamp01(
      cell.pressureProxy * 0.35 +
        reflectionIndex * 0.35 +
        cell.standingWaveIndex * 0.3,
    );

    cell.lesionIndex = clamp01(
      clamp01((estimatedTemp - 42) / 7) * 0.65 +
        clamp01(input.cumulativeDose / 120) * 0.35,
    );

    cell.ablationIndex = clamp01(
      clamp01((estimatedTemp - 48) / 5) * 0.55 +
        clamp01(input.thermalDose / 80) * 0.45,
    );

    maxIntensity = Math.max(maxIntensity, cell.relativeIntensity);
    maxTemp = Math.max(maxTemp, cell.estimatedTemp);
    maxCavitationIndex = Math.max(maxCavitationIndex, cell.cavitationIndex);
    maxReflectionIndex = Math.max(maxReflectionIndex, cell.reflectionIndex);
    maxLesionIndex = Math.max(maxLesionIndex, cell.lesionIndex);
    maxAblationIndex = Math.max(maxAblationIndex, cell.ablationIndex);
  }

  return {
    width,
    height,
    maxDepthCm,
    cells,
    summary: {
      maxIntensity,
      maxTemp,
      maxCavitationIndex,
      maxReflectionIndex,
      maxLesionIndex,
      maxAblationIndex,
      dominantPhenomenon: resolveDominantPhenomenon(cells),
    },
  };
}

export const DOMINANT_PHENOMENON_LABELS: Record<UltrasoundDominantPhenomenon, string> = {
  attenuation: "Atenuação progressiva",
  "deep-heating": "Aquecimento profundo",
  "surface-heating": "Aquecimento superficial",
  cavitation: "Cavitação (modelo ilustrativo)",
  "bone-reflection": "Reflexão óssea",
  "standing-wave": "Onda estacionária (heurística)",
  "thermal-lesion": "Dano térmico potencial",
  ablation: "Zona de ablação educacional",
  balanced: "Distribuição equilibrada",
};

export const DOMINANT_PHENOMENON_HINTS: Record<UltrasoundDominantPhenomenon, string> = {
  attenuation:
    "A energia diminui com a profundidade conforme o tecido absorve e espalha o feixe.",
  "deep-heating":
    "O pico de aquecimento ocorre abaixo da superfície, típico de US terapêutico contínuo.",
  "surface-heating":
    "Mais calor na pele — comum com acoplamento ruim, alta frequência ou transdutor parado.",
  cavitation:
    "Índice relativo de microbolhas; aumenta com intensidade, acoplamento ruim e modo pulsado.",
  "bone-reflection":
    "Interface óssea reflete parte da onda, redistribuindo energia e calor periosteal.",
  "standing-wave":
    "Padrão ilustrativo de interferência próximo ao osso quando a reflexão é alta.",
  "thermal-lesion":
    "Temperatura ou dose térmica elevadas — zona de risco educacional, não diagnóstico.",
  ablation:
    "Combinação extrema de temperatura/dose — apenas demonstração didática de ablação.",
  balanced:
    "Nenhum fenômeno domina claramente; parâmetros dentro de faixa terapêutica moderada.",
};
