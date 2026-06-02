import type { AnatomyLayer, UltrasoundSimulationFeatures } from "@/types/ultrasoundAdvanced";
import { DEFAULT_SIMULATION_FEATURES } from "@/types/ultrasoundAdvanced";
import type { UltrasoundInclusionConfig, UltrasoundLayerConfig } from "@/types/acousticMedia";
import { getAcousticMedium } from "@/types/acousticMedia";
import {
  getDefaultInclusionsForPreset,
  getDefaultLayersForPreset,
  getPresetById,
} from "@/config/ultrasoundPresets";
import type { UltrasoundAnatomyPresetId } from "@/types/ultrasoundPresets";

export type UltrasoundStudentControls = {
  showGain: boolean;
  showDepth: boolean;
  showFrequency: boolean;
  showFocus: boolean;
  showDynamicRange: boolean;
  showTransducerSelector: boolean;
  showModeSelector: boolean;
  lockGain: boolean;
  lockDepth: boolean;
  lockFrequency: boolean;
  lockFocus: boolean;
  lockTransducer: boolean;
  enableTransducerMovement: boolean;
};

export type NormalizedUltrasoundLabConfig = {
  presetId?: string;
  layers: AnatomyLayer[];
  acousticLayers: UltrasoundLayerConfig[];
  inclusions: UltrasoundInclusionConfig[];
  transducerType: "linear" | "convex" | "microconvex";
  frequency: number;
  depth: number;
  focus: number;
  gain: number;
  dynamicRange: number;
  mode: "b-mode" | "color-doppler";
  simulationFeatures: UltrasoundSimulationFeatures;
  studentControls: UltrasoundStudentControls;
  complexityLevel?: string;
  videoUrl?: string;
};

const DEFAULT_STUDENT_CONTROLS: UltrasoundStudentControls = {
  showGain: true,
  showDepth: true,
  showFrequency: true,
  showFocus: true,
  showDynamicRange: false,
  showTransducerSelector: true,
  showModeSelector: false,
  lockGain: false,
  lockDepth: false,
  lockFrequency: false,
  lockFocus: false,
  lockTransducer: false,
  enableTransducerMovement: true,
};

/** Controle visível salvo como `false` no admin; ausente = visível por padrão. */
export function isStudentControlVisible(value: boolean | undefined, defaultVisible = true): boolean {
  if (value === false) return false;
  if (value === true) return true;
  return defaultVisible;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isAcousticLayer(value: unknown): value is UltrasoundLayerConfig {
  return isRecord(value) && "mediumId" in value && "thicknessCm" in value;
}

function isAnatomyLayer(value: unknown): value is AnatomyLayer {
  return isRecord(value) && "depthRange" in value && "echogenicity" in value;
}

export function acousticLayersToAnatomyLayers(layers: UltrasoundLayerConfig[]): AnatomyLayer[] {
  if (!layers.length) return [];
  const totalDepth = layers.reduce((sum, layer) => sum + layer.thicknessCm, 0) || 1;

  return layers.map((layerConfig, index) => {
    const startDepth = layers.slice(0, index).reduce((sum, layer) => sum + layer.thicknessCm, 0);
    const endDepth = startDepth + layerConfig.thicknessCm;
    const medium = getAcousticMedium(layerConfig.mediumId);

    return {
      name: layerConfig.name,
      depthRange: [startDepth / totalDepth, endDepth / totalDepth] as [number, number],
      reflectivity: Math.max(0.05, Math.min(1, 0.5 + (layerConfig.reflectivityBias || 0))),
      echogenicity: medium.baseEchogenicity,
      texture:
        layerConfig.mediumId === "muscle"
          ? "striated"
          : layerConfig.mediumId === "tendon"
            ? "fibrillar"
            : layerConfig.mediumId === "fat"
              ? "heterogeneous"
              : "homogeneous",
      attenuationCoeff: medium.attenuation_dB_per_cm_MHz,
      hasFlow: layerConfig.mediumId === "blood",
    };
  });
}

function resolvePresetId(raw: Record<string, unknown>, nested: Record<string, unknown>): UltrasoundAnatomyPresetId | undefined {
  const id = (raw.presetId || nested.presetId) as string | undefined;
  if (!id) return undefined;
  const preset = getPresetById(id as UltrasoundAnatomyPresetId);
  return preset ? (id as UltrasoundAnatomyPresetId) : undefined;
}

/** Unifica config flat (editor unificado) e nested (`ultrasoundConfig` do editor legado). */
export function normalizeUltrasoundLabConfig(raw: unknown): NormalizedUltrasoundLabConfig {
  const data = isRecord(raw) ? raw : {};
  const nested = isRecord(data.ultrasoundConfig) ? data.ultrasoundConfig : {};

  const presetId = resolvePresetId(data, nested);
  const preset = presetId ? getPresetById(presetId) : null;

  const rawLayers = (data.layers ?? nested.layers) as unknown;
  const rawAcoustic = (data.acousticLayers ?? nested.acousticLayers) as unknown;
  const rawInclusions = (data.inclusions ?? nested.inclusions) as unknown;

  let acousticLayers: UltrasoundLayerConfig[] = Array.isArray(rawAcoustic)
    ? (rawAcoustic as UltrasoundLayerConfig[])
    : [];

  let layers: AnatomyLayer[] = [];
  if (Array.isArray(rawLayers) && rawLayers.length > 0) {
    if (isAnatomyLayer(rawLayers[0])) {
      layers = rawLayers as AnatomyLayer[];
    } else if (isAcousticLayer(rawLayers[0])) {
      acousticLayers = rawLayers as UltrasoundLayerConfig[];
      layers = acousticLayersToAnatomyLayers(acousticLayers);
    }
  }

  if (!layers.length && !acousticLayers.length && presetId) {
    acousticLayers = getDefaultLayersForPreset(presetId);
    layers = acousticLayersToAnatomyLayers(acousticLayers);
  }

  if (!layers.length) {
    layers = [
      {
        name: "Tissue",
        depthRange: [0, 1],
        reflectivity: 0.5,
        echogenicity: "isoechoic",
        texture: "homogeneous",
        attenuationCoeff: 0.7,
        hasFlow: false,
      },
    ];
  }

  let inclusions: UltrasoundInclusionConfig[] = Array.isArray(rawInclusions)
    ? (rawInclusions as UltrasoundInclusionConfig[])
    : presetId
      ? getDefaultInclusionsForPreset(presetId)
      : [];

  const legacyControls = isRecord(nested.controls) ? nested.controls : {};
  const flatControls = isRecord(data.studentControls) ? data.studentControls : {};

  const simulationFeatures: UltrasoundSimulationFeatures = {
    ...DEFAULT_SIMULATION_FEATURES,
    ...(isRecord(nested.simulationFeatures) ? nested.simulationFeatures : {}),
    ...(isRecord(data.simulationFeatures) ? data.simulationFeatures : {}),
  };

  const studentControls: UltrasoundStudentControls = {
    showGain: isStudentControlVisible((flatControls.showGain ?? legacyControls.showGain) as boolean | undefined),
    showDepth: isStudentControlVisible((flatControls.showDepth ?? legacyControls.showDepth) as boolean | undefined),
    showFrequency: isStudentControlVisible((flatControls.showFrequency ?? legacyControls.showFrequency) as boolean | undefined),
    showFocus: isStudentControlVisible((flatControls.showFocus ?? legacyControls.showFocus) as boolean | undefined),
    showDynamicRange: isStudentControlVisible(flatControls.showDynamicRange as boolean | undefined, false),
    showTransducerSelector: isStudentControlVisible(
      flatControls.showTransducerSelector as boolean | undefined,
      DEFAULT_STUDENT_CONTROLS.showTransducerSelector,
    ),
    showModeSelector: isStudentControlVisible(
      flatControls.showModeSelector as boolean | undefined,
      simulationFeatures.enableColorDoppler ? true : DEFAULT_STUDENT_CONTROLS.showModeSelector,
    ),
    lockGain: (flatControls.lockGain ?? DEFAULT_STUDENT_CONTROLS.lockGain) as boolean,
    lockDepth: (flatControls.lockDepth ?? DEFAULT_STUDENT_CONTROLS.lockDepth) as boolean,
    lockFrequency: (flatControls.lockFrequency ?? DEFAULT_STUDENT_CONTROLS.lockFrequency) as boolean,
    lockFocus: (flatControls.lockFocus ?? DEFAULT_STUDENT_CONTROLS.lockFocus) as boolean,
    lockTransducer: (flatControls.lockTransducer ?? legacyControls.lockTransducer ?? DEFAULT_STUDENT_CONTROLS.lockTransducer) as boolean,
    enableTransducerMovement: isStudentControlVisible(
      flatControls.enableTransducerMovement as boolean | undefined,
      DEFAULT_STUDENT_CONTROLS.enableTransducerMovement,
    ),
  };

  const depth =
    (data.depth as number | undefined) ??
    (nested.depth as number | undefined) ??
    preset?.recommendedDepthCm ??
    6;
  const focus =
    (data.focus as number | undefined) ??
    (nested.focus as number | undefined) ??
    preset?.recommendedFocusCm ??
    depth / 2;

  return {
    presetId,
    layers,
    acousticLayers,
    inclusions,
    transducerType:
      (data.transducerType as NormalizedUltrasoundLabConfig["transducerType"]) ??
      (nested.transducerType as NormalizedUltrasoundLabConfig["transducerType"]) ??
      preset?.transducerType ??
      "linear",
    frequency:
      (data.frequency as number | undefined) ??
      (nested.frequency as number | undefined) ??
      preset?.recommendedFrequencyMHz ??
      7.5,
    depth,
    focus,
    gain:
      (data.gain as number | undefined) ??
      (nested.gain as number | undefined) ??
      preset?.recommendedGain ??
      50,
    dynamicRange: (data.dynamicRange as number | undefined) ?? (nested.dynamicRange as number | undefined) ?? 60,
    mode: (data.mode as NormalizedUltrasoundLabConfig["mode"]) ?? (nested.mode as NormalizedUltrasoundLabConfig["mode"]) ?? "b-mode",
    simulationFeatures,
    studentControls,
    complexityLevel: (data.complexityLevel || nested.complexityLevel) as string | undefined,
    videoUrl: data.videoUrl as string | undefined,
  };
}
