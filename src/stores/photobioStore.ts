import { create } from "zustand";
import {
  calculatePhotobioEnergy,
  calculatePhotobioFluence,
  calculatePhotobioIrradiance,
  calculateTissueInteraction,
  TissueInteractionResult,
  PhotobioWavelength,
  PhotobioAnatomyPreset,
  PhotobioLayerConfig,
} from "@/simulation/photobioEngine";
import type { PhotobioApplicatorType } from "@/components/labs/photobio/photobioApplicatorTypes";
import {
  getPhotobioPresetById,
  type PhotobioLabMode,
  type PhotobioMode,
  type PhotobioPresetId,
  type PhotobioViewerTab,
} from "@/config/photobioPresets";
import {
  advancePhotobioChallengeRuntime,
  DEFAULT_PHOTOBIO_CHALLENGE_RUNTIME,
  evaluateAllPhotobioObjectives,
  getPhotobioChallengeById,
  isPhotobioChallengeComplete,
  type PhotobioChallengeEvalContext,
  type PhotobioChallengeId,
  type PhotobioChallengeRuntimeState,
} from "@/config/photobioChallenges";
import { computePhotobioScore, type PhotobioScoreBreakdown } from "@/lib/photobioScoring";
import {
  defaultPhotobioLabConfig,
  mergePhotobioLabConfig,
  photobioConfigToStorePatch,
  type PhotobioControlModes,
  type PhotobioFeatureFlags,
  type PhotobioLabConfig,
  type PhotobioTargetTissue,
} from "@/types/photobioLabConfig";
import {
  suggestPhotobioSnapshotLabel,
  type PhotobioLabConfigSnapshot,
  type PhotobioSnapshot,
} from "@/lib/photobioComparison";
import { pickRandomSkinMelaninIndex } from "@/lib/clinicalSkinTones";
import { createTissueStackSeed } from "@/lib/clinicalTissueGeometry";

export type { PhotobioApplicatorType } from "@/components/labs/photobio/photobioApplicatorTypes";
export type { PhotobioLabMode, PhotobioMode, PhotobioViewerTab } from "@/config/photobioPresets";
export type { PhotobioPresetId } from "@/config/photobioPresets";
export type { PhotobioChallengeId } from "@/config/photobioChallenges";
export type { PhotobioSnapshot } from "@/lib/photobioComparison";
export type ControlDisplayMode = "hidden" | "disabled";
export type ControlVisibilityMode = "show" | "hidden" | "disabled";
export type ControlModes = PhotobioControlModes;

interface PhotobioState {
  // Inputs
  wavelength: PhotobioWavelength;
  power: number; // mW (10-500)
  spotSize: number; // cm² (0.1-1.0)
  exposureTime: number; // s (1-300)
  mode: PhotobioMode;
  dutyCycle: number; // % em modo pulsado (10–90)
  transducerAngle: number; // 30..150, default 90
  contactPressure: number; // 0..100
  isDragging: boolean;
  draggingSpeed: number; // relative speed factor
  transducerX: number; // scanning position
  anatomyPreset: PhotobioAnatomyPreset;
  layerConfig: PhotobioLayerConfig;
  controlModes: ControlModes;
  skinMelaninIndex: number;
  tissueStackSeed: number;
  targetTissue: PhotobioTargetTissue;
  parameterRanges: PhotobioLabConfig["ranges"];
  featureFlags: PhotobioFeatureFlags;
  labConfigBaseline: PhotobioLabConfig | null;
  doseMap: number[];
  viewerTab: PhotobioViewerTab;
  applicatorType: PhotobioApplicatorType;

  // Pedagogia — modo guiado, desafios, snapshots
  labMode: PhotobioLabMode;
  activeClinicalPresetId: PhotobioPresetId | null;
  activeChallengeId: PhotobioChallengeId | null;
  challengeRuntime: PhotobioChallengeRuntimeState;
  challengeObjectiveMap: Record<string, boolean>;
  challengeScoreBreakdown: PhotobioScoreBreakdown | null;
  challengeCompleted: boolean;
  challengeScore: number;
  guidedHintIndex: number;
  challengePanelCollapsed: boolean;
  snapshots: PhotobioSnapshot[];

  // Derived + simulation output
  interaction: TissueInteractionResult;

  // Selectors
  irradiance: () => number; // mW/cm²
  energy: () => number; // J
  fluence: () => number; // J/cm²

  // Actions
  setWavelength: (value: PhotobioWavelength) => void;
  setPower: (value: number) => void;
  setSpotSize: (value: number) => void;
  setExposureTime: (value: number) => void;
  setMode: (value: PhotobioMode) => void;
  setDutyCycle: (value: number) => void;
  setTransducerAngle: (value: number) => void;
  setContactPressure: (value: number) => void;
  setIsDragging: (value: boolean) => void;
  setDraggingSpeed: (value: number) => void;
  setTransducerX: (value: number) => void;
  accumulateDoseAt: (positionX: number, doseDelta: number) => void;
  resetDoseMap: () => void;
  setViewerTab: (tab: PhotobioViewerTab) => void;
  setApplicatorType: (type: PhotobioApplicatorType) => void;
  setSkinMelaninIndex: (value: number) => void;
  setControlMode: (control: keyof ControlModes, mode: ControlVisibilityMode) => void;
  setAnatomyPreset: (preset: PhotobioAnatomyPreset) => void;
  setCustomLayerThickness: (
    layer: keyof PhotobioLayerConfig,
    value: number
  ) => void;
  setFromConfig: (config: Partial<{
    wavelength: PhotobioWavelength;
    power: number;
    spotSize: number;
    exposureTime: number;
    mode: PhotobioMode;
    dutyCycle: number;
    transducerAngle: number;
    contactPressure: number;
    isDragging: boolean;
    draggingSpeed: number;
    transducerX: number;
    anatomyPreset: PhotobioAnatomyPreset;
    layerConfig: Partial<PhotobioLayerConfig>;
    controlDisplayMode: ControlDisplayMode;
    controlModes: Partial<ControlModes>;
    visibleControls: Partial<Record<keyof ControlModes, boolean>>;
  }>) => void;
  resetDefaults: () => void;
  runSimulation: () => void;
  initializeLab: (
    config: PhotobioLabConfig | Record<string, unknown>,
    options?: { preserveSessionAppearance?: boolean },
  ) => void;
  /** Atualiza parâmetros do preview admin sem resetar aba do viewer nem sessão do aluno. */
  syncPhotobioPreviewConfig: (config: PhotobioLabConfig | Record<string, unknown>) => void;

  setLabMode: (mode: PhotobioLabMode) => void;
  applyClinicalPreset: (presetId: PhotobioPresetId) => void;
  startChallenge: (challengeId: PhotobioChallengeId) => void;
  restartChallenge: () => void;
  advanceGuidedHint: () => void;
  setChallengePanelCollapsed: (collapsed: boolean) => void;
  syncChallengeProgress: () => void;
  saveSnapshot: (label?: string) => void;
  clearSnapshots: () => void;
  restoreSnapshot: (id: string) => void;
  removeSnapshot: (id: string) => void;
}

const DEFAULTS = {
  wavelength: defaultPhotobioLabConfig.wavelength,
  power: defaultPhotobioLabConfig.power,
  spotSize: defaultPhotobioLabConfig.spotSize,
  exposureTime: defaultPhotobioLabConfig.exposureTime,
  mode: defaultPhotobioLabConfig.mode,
  dutyCycle: defaultPhotobioLabConfig.dutyCycle,
  transducerAngle: defaultPhotobioLabConfig.transducerAngle,
  contactPressure: defaultPhotobioLabConfig.contactPressure,
  isDragging: defaultPhotobioLabConfig.isDragging,
  draggingSpeed: defaultPhotobioLabConfig.draggingSpeed,
  transducerX: 0,
  anatomyPreset: defaultPhotobioLabConfig.anatomyPreset,
  layerConfig: defaultPhotobioLabConfig.layerConfig,
  controlModes: defaultPhotobioLabConfig.controlModes,
  doseMap: Array.from({ length: 56 }, () => 0),
  viewerTab: defaultPhotobioLabConfig.viewerTab,
  applicatorType: defaultPhotobioLabConfig.applicatorType,
  skinMelaninIndex: defaultPhotobioLabConfig.skinMelaninIndex,
  tissueStackSeed: createTissueStackSeed(),
  targetTissue: defaultPhotobioLabConfig.targetTissue,
  parameterRanges: defaultPhotobioLabConfig.ranges,
  featureFlags: defaultPhotobioLabConfig.featureFlags,
  labConfigBaseline: null as PhotobioLabConfig | null,
  labMode: "free" as PhotobioLabMode,
  activeClinicalPresetId: null as PhotobioPresetId | null,
  activeChallengeId: null as PhotobioChallengeId | null,
  challengeRuntime: { ...DEFAULT_PHOTOBIO_CHALLENGE_RUNTIME },
  challengeObjectiveMap: {} as Record<string, boolean>,
  challengeScoreBreakdown: null as PhotobioScoreBreakdown | null,
  challengeCompleted: false,
  challengeScore: 0,
  guidedHintIndex: 0,
  challengePanelCollapsed: false,
  snapshots: [] as PhotobioSnapshot[],
};

const PRESET_LAYER_CONFIGS: Record<PhotobioAnatomyPreset, PhotobioLayerConfig> = {
  default: { epidermisMm: 1, dermisMm: 4, adiposeMm: 15, muscleMm: 25 },
  elderly: { epidermisMm: 0.5, dermisMm: 2, adiposeMm: 10, muscleMm: 12 },
  athlete: { epidermisMm: 1, dermisMm: 4, adiposeMm: 5, muscleMm: 35 },
  obese: { epidermisMm: 1, dermisMm: 4, adiposeMm: 40, muscleMm: 10 },
  custom: { epidermisMm: 1, dermisMm: 4, adiposeMm: 15, muscleMm: 25 },
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const clampWithRange = (
  value: number,
  range: { min: number; max: number },
) => clamp(value, range.min, range.max);

function pickRandomSessionAppearance(ranges: PhotobioLabConfig["ranges"]) {
  const step = ranges.skinMelaninIndex.step ?? 0.05;
  const rawMelanin = pickRandomSkinMelaninIndex(
    ranges.skinMelaninIndex.min,
    ranges.skinMelaninIndex.max,
  );
  const skinMelaninIndex = step > 0 ? Math.round(rawMelanin / step) * step : rawMelanin;

  return {
    skinMelaninIndex: clamp(
      skinMelaninIndex,
      ranges.skinMelaninIndex.min,
      ranges.skinMelaninIndex.max,
    ),
    tissueStackSeed: createTissueStackSeed(),
  };
}

const round = (value: number, digits = 4) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

const computeIrradiance = calculatePhotobioIrradiance;

const computeEnergy = (
  power: number,
  exposureTime: number,
  mode: PhotobioMode,
  dutyCycle: number
) => calculatePhotobioEnergy(power, exposureTime, mode, dutyCycle);

const computeFluence = calculatePhotobioFluence;

function buildEvalContext(state: PhotobioState): PhotobioChallengeEvalContext {
  return {
    wavelength: state.wavelength,
    power: state.power,
    spotSize: state.spotSize,
    exposureTime: state.exposureTime,
    mode: state.mode,
    dutyCycle: state.dutyCycle,
    transducerAngle: state.transducerAngle,
    contactPressure: state.contactPressure,
    isDragging: state.isDragging,
    draggingSpeed: state.draggingSpeed,
    anatomyPreset: state.anatomyPreset,
    interaction: state.interaction,
    runtime: state.challengeRuntime,
    viewerTab: state.viewerTab,
    doseMap: state.doseMap,
    snapshots: state.snapshots,
  };
}

function buildConfigSnapshot(state: PhotobioState): PhotobioLabConfigSnapshot {
  return {
    wavelength: state.wavelength,
    power: state.power,
    spotSize: state.spotSize,
    exposureTime: state.exposureTime,
    mode: state.mode,
    dutyCycle: state.dutyCycle,
    transducerAngle: state.transducerAngle,
    contactPressure: state.contactPressure,
    isDragging: state.isDragging,
    draggingSpeed: state.draggingSpeed,
    anatomyPreset: state.anatomyPreset,
    applicatorType: state.applicatorType,
  };
}

function syncChallengeFromSimulation(
  state: PhotobioState,
  interaction: TissueInteractionResult,
): Partial<PhotobioState> {
  if (state.labMode !== "guided" || !state.activeChallengeId) {
    return {
      challengeScoreBreakdown: null,
      challengeObjectiveMap: {},
      challengeCompleted: false,
      challengeScore: 0,
    };
  }

  const ctxBase = { ...state, interaction };
  const runtime = advancePhotobioChallengeRuntime(
    state.challengeRuntime,
    buildEvalContext(ctxBase),
    state.snapshots,
  );
  const ctx = buildEvalContext({ ...state, interaction, challengeRuntime: runtime });
  const challengeObjectiveMap = evaluateAllPhotobioObjectives(state.activeChallengeId, ctx);
  const challengeCompleted = isPhotobioChallengeComplete(state.activeChallengeId, ctx);
  const challengeScoreBreakdown = computePhotobioScore({
    interaction,
    wavelength: state.wavelength,
    isDragging: state.isDragging,
    doseMap: state.doseMap,
    challengeId: state.activeChallengeId,
    challengeCtx: ctx,
  });

  return {
    challengeRuntime: runtime,
    challengeObjectiveMap,
    challengeCompleted,
    challengeScoreBreakdown,
    challengeScore: challengeScoreBreakdown.total,
  };
}

export const usePhotobioStore = create<PhotobioState>((set, get) => ({
  wavelength: DEFAULTS.wavelength,
  power: DEFAULTS.power,
  spotSize: DEFAULTS.spotSize,
  exposureTime: DEFAULTS.exposureTime,
  mode: DEFAULTS.mode,
  dutyCycle: DEFAULTS.dutyCycle,
  transducerAngle: DEFAULTS.transducerAngle,
  contactPressure: DEFAULTS.contactPressure,
  isDragging: DEFAULTS.isDragging,
  draggingSpeed: DEFAULTS.draggingSpeed,
  transducerX: DEFAULTS.transducerX,
  anatomyPreset: DEFAULTS.anatomyPreset,
  layerConfig: DEFAULTS.layerConfig,
  controlModes: DEFAULTS.controlModes,
  skinMelaninIndex: DEFAULTS.skinMelaninIndex,
  tissueStackSeed: DEFAULTS.tissueStackSeed,
  targetTissue: DEFAULTS.targetTissue,
  parameterRanges: DEFAULTS.parameterRanges,
  featureFlags: DEFAULTS.featureFlags,
  labConfigBaseline: DEFAULTS.labConfigBaseline,
  doseMap: DEFAULTS.doseMap,
  viewerTab: DEFAULTS.viewerTab,
  applicatorType: DEFAULTS.applicatorType,
  labMode: DEFAULTS.labMode,
  activeClinicalPresetId: DEFAULTS.activeClinicalPresetId,
  activeChallengeId: DEFAULTS.activeChallengeId,
  challengeRuntime: DEFAULTS.challengeRuntime,
  challengeObjectiveMap: DEFAULTS.challengeObjectiveMap,
  challengeScoreBreakdown: DEFAULTS.challengeScoreBreakdown,
  challengeCompleted: DEFAULTS.challengeCompleted,
  challengeScore: DEFAULTS.challengeScore,
  guidedHintIndex: DEFAULTS.guidedHintIndex,
  challengePanelCollapsed: DEFAULTS.challengePanelCollapsed,
  snapshots: DEFAULTS.snapshots,

  interaction: calculateTissueInteraction({
    wavelength: DEFAULTS.wavelength,
    irradiance: round(computeIrradiance(DEFAULTS.power, DEFAULTS.spotSize)),
    energy: round(
      computeEnergy(
        DEFAULTS.power,
        DEFAULTS.exposureTime,
        DEFAULTS.mode,
        DEFAULTS.dutyCycle
      )
    ),
    fluence: round(
      computeFluence(
        computeEnergy(
          DEFAULTS.power,
          DEFAULTS.exposureTime,
          DEFAULTS.mode,
          DEFAULTS.dutyCycle
        ),
        DEFAULTS.spotSize
      )
    ),
    spotSize: DEFAULTS.spotSize,
    layerConfig: DEFAULTS.layerConfig,
    transducerAngle: DEFAULTS.transducerAngle,
    contactPressure: DEFAULTS.contactPressure,
    isDragging: DEFAULTS.isDragging,
    draggingSpeed: DEFAULTS.draggingSpeed,
    skinMelaninIndex: DEFAULTS.skinMelaninIndex,
  }),

  irradiance: () => {
    const { power, spotSize } = get();
    return round(computeIrradiance(power, spotSize));
  },

  energy: () => {
    const { power, exposureTime, mode, dutyCycle } = get();
    return round(computeEnergy(power, exposureTime, mode, dutyCycle));
  },

  fluence: () => {
    const { spotSize } = get();
    const e = get().energy();
    return round(computeFluence(e, spotSize));
  },

  setWavelength: (value) => {
    set({ wavelength: value, activeClinicalPresetId: null });
    get().runSimulation();
  },

  setPower: (value) => {
    const { parameterRanges } = get();
    set({
      power: clampWithRange(value, parameterRanges.power),
      activeClinicalPresetId: null,
    });
    get().runSimulation();
  },

  setSpotSize: (value) => {
    const { parameterRanges } = get();
    set({
      spotSize: clampWithRange(value, parameterRanges.spotSize),
      activeClinicalPresetId: null,
    });
    get().runSimulation();
  },

  setExposureTime: (value) => {
    const { parameterRanges } = get();
    set({
      exposureTime: clampWithRange(value, parameterRanges.exposureTime),
      activeClinicalPresetId: null,
    });
    get().runSimulation();
  },

  setMode: (value) => {
    set({ mode: value, activeClinicalPresetId: null });
    get().runSimulation();
  },

  setDutyCycle: (value) => {
    const { parameterRanges } = get();
    set({
      dutyCycle: clampWithRange(value, parameterRanges.dutyCycle),
      activeClinicalPresetId: null,
    });
    get().runSimulation();
  },

  setTransducerAngle: (value) => {
    const { parameterRanges } = get();
    set({
      transducerAngle: clampWithRange(value, parameterRanges.transducerAngle),
      activeClinicalPresetId: null,
    });
    get().runSimulation();
  },

  setContactPressure: (value) => {
    const { parameterRanges } = get();
    set({
      contactPressure: clampWithRange(value, parameterRanges.contactPressure),
      activeClinicalPresetId: null,
    });
    get().runSimulation();
  },

  setIsDragging: (value) => {
    set({ isDragging: value, activeClinicalPresetId: null });
    get().runSimulation();
  },

  setDraggingSpeed: (value) => {
    set({ draggingSpeed: clamp(value, 0.2, 5), activeClinicalPresetId: null });
    get().runSimulation();
  },

  setTransducerX: (value) => {
    set({ transducerX: clamp(value, -2.8, 2.8) });
  },

  accumulateDoseAt: (positionX, doseDelta) => {
    const map = get().doseMap;
    const index = Math.max(
      0,
      Math.min(
        map.length - 1,
        Math.round(((clamp(positionX, -2.8, 2.8) + 2.8) / 5.6) * (map.length - 1))
      )
    );
    const next = [...map];
    for (let offset = -2; offset <= 2; offset += 1) {
      const i = index + offset;
      if (i < 0 || i >= next.length) continue;
      const spread = offset === 0 ? 1 : offset === -1 || offset === 1 ? 0.55 : 0.25;
      next[i] = Math.max(0, Math.min(80, next[i] + doseDelta * spread));
    }
    set({ doseMap: next });
  },

  resetDoseMap: () => {
    set({ doseMap: Array.from({ length: DEFAULTS.doseMap.length }, () => 0) });
  },

  setViewerTab: (tab) => {
    set({ viewerTab: tab });
    get().syncChallengeProgress();
  },

  setApplicatorType: (type) => set({ applicatorType: type, activeClinicalPresetId: null }),

  setSkinMelaninIndex: (value) => {
    const { parameterRanges } = get();
    set({
      skinMelaninIndex: clampWithRange(value, parameterRanges.skinMelaninIndex),
      activeClinicalPresetId: null,
    });
    get().runSimulation();
  },

  setControlMode: (control, mode) => {
    set((prev) => ({
      controlModes: {
        ...prev.controlModes,
        [control]: mode,
      },
    }));
  },

  setAnatomyPreset: (preset) => {
    const presetConfig = { ...PRESET_LAYER_CONFIGS[preset] };
    set({
      anatomyPreset: preset,
      layerConfig: presetConfig,
      activeClinicalPresetId: null,
    });
    get().runSimulation();
  },

  setCustomLayerThickness: (layer, value) => {
    const range = get().parameterRanges.layerThickness[layer];
    set((prev) => ({
      anatomyPreset: "custom",
      activeClinicalPresetId: null,
      layerConfig: {
        ...prev.layerConfig,
        [layer]: clampWithRange(value, range),
      },
    }));
    get().runSimulation();
  },

  initializeLab: (rawConfig, options) => {
    const merged = mergePhotobioLabConfig(rawConfig);
    const patch = photobioConfigToStorePatch(merged);
    const ranges = patch.parameterRanges ?? defaultPhotobioLabConfig.ranges;
    const current = get();
    const preserveInteractiveState =
      Boolean(options?.preserveSessionAppearance && current.labConfigBaseline);
    const sessionAppearance = options?.preserveSessionAppearance
      ? preserveInteractiveState
        ? {
            viewerTab: current.viewerTab,
            tissueStackSeed: current.tissueStackSeed,
          }
        : {}
      : pickRandomSessionAppearance(ranges);
    set({
      ...patch,
      ...sessionAppearance,
      labConfigBaseline: structuredClone(merged),
      activeClinicalPresetId: null,
      activeChallengeId: null,
      challengeRuntime: { ...DEFAULT_PHOTOBIO_CHALLENGE_RUNTIME },
      challengeObjectiveMap: {},
      challengeCompleted: false,
      challengeScoreBreakdown: null,
      challengeScore: 0,
      guidedHintIndex: 0,
      snapshots: [],
      doseMap: Array.from({ length: DEFAULTS.doseMap.length }, () => 0),
      transducerX: preserveInteractiveState ? current.transducerX : 0,
    });
    get().runSimulation();
  },

  syncPhotobioPreviewConfig: (rawConfig) => {
    const merged = mergePhotobioLabConfig(rawConfig);
    const current = get();
    if (!current.labConfigBaseline) {
      get().initializeLab(merged, { preserveSessionAppearance: true });
      return;
    }
    const patch = photobioConfigToStorePatch(merged);
    const { viewerTab: _viewerTab, ...paramPatch } = patch;
    set({
      ...paramPatch,
      labConfigBaseline: structuredClone(merged),
    });
    get().runSimulation();
  },

  setFromConfig: (config) => {
    const ranges = get().parameterRanges;
    const next = {
      wavelength: config.wavelength ?? get().wavelength,
      power: clampWithRange(config.power ?? get().power, ranges.power),
      spotSize: clampWithRange(config.spotSize ?? get().spotSize, ranges.spotSize),
      exposureTime: clampWithRange(config.exposureTime ?? get().exposureTime, ranges.exposureTime),
      mode: config.mode ?? get().mode,
      dutyCycle: clampWithRange(config.dutyCycle ?? get().dutyCycle, ranges.dutyCycle),
      transducerAngle: clampWithRange(config.transducerAngle ?? get().transducerAngle, ranges.transducerAngle),
      contactPressure: clampWithRange(config.contactPressure ?? get().contactPressure, ranges.contactPressure),
      isDragging: config.isDragging ?? get().isDragging,
      draggingSpeed: clamp(config.draggingSpeed ?? get().draggingSpeed, 0.2, 5),
      transducerX: clamp(config.transducerX ?? get().transducerX, -2.8, 2.8),
      anatomyPreset: config.anatomyPreset ?? get().anatomyPreset,
      layerConfig: {
        epidermisMm: clampWithRange(
          config.layerConfig?.epidermisMm ?? get().layerConfig.epidermisMm,
          ranges.layerThickness.epidermisMm,
        ),
        dermisMm: clampWithRange(
          config.layerConfig?.dermisMm ?? get().layerConfig.dermisMm,
          ranges.layerThickness.dermisMm,
        ),
        adiposeMm: clampWithRange(
          config.layerConfig?.adiposeMm ?? get().layerConfig.adiposeMm,
          ranges.layerThickness.adiposeMm,
        ),
        muscleMm: clampWithRange(
          config.layerConfig?.muscleMm ?? get().layerConfig.muscleMm,
          ranges.layerThickness.muscleMm,
        ),
      },
      controlModes: {
        ...get().controlModes,
        ...(config.controlModes ?? {}),
      },
    };
    // Backward compatibility: old shape (visibleControls + global display mode)
    if (config.visibleControls) {
      (Object.keys(config.visibleControls) as Array<keyof ControlModes>).forEach((key) => {
        const isVisible = config.visibleControls?.[key];
        if (typeof isVisible === "boolean") {
          next.controlModes[key] = isVisible
            ? "show"
            : (config.controlDisplayMode ?? "hidden");
        }
      });
    }
    set(next);
    get().runSimulation();
  },

  resetDefaults: () => {
    const baseline = get().labConfigBaseline;
    if (baseline) {
      get().initializeLab(baseline);
      return;
    }
    set({
      wavelength: DEFAULTS.wavelength,
      power: DEFAULTS.power,
      spotSize: DEFAULTS.spotSize,
      exposureTime: DEFAULTS.exposureTime,
      mode: DEFAULTS.mode,
      dutyCycle: DEFAULTS.dutyCycle,
      transducerAngle: DEFAULTS.transducerAngle,
      contactPressure: DEFAULTS.contactPressure,
      isDragging: DEFAULTS.isDragging,
      draggingSpeed: DEFAULTS.draggingSpeed,
      transducerX: DEFAULTS.transducerX,
      anatomyPreset: DEFAULTS.anatomyPreset,
      layerConfig: DEFAULTS.layerConfig,
      controlModes: DEFAULTS.controlModes,
      ...pickRandomSessionAppearance(DEFAULTS.parameterRanges),
      targetTissue: DEFAULTS.targetTissue,
      parameterRanges: DEFAULTS.parameterRanges,
      featureFlags: DEFAULTS.featureFlags,
      doseMap: DEFAULTS.doseMap,
      viewerTab: DEFAULTS.viewerTab,
      applicatorType: DEFAULTS.applicatorType,
      labMode: DEFAULTS.labMode,
      activeClinicalPresetId: DEFAULTS.activeClinicalPresetId,
      activeChallengeId: DEFAULTS.activeChallengeId,
      challengeRuntime: { ...DEFAULT_PHOTOBIO_CHALLENGE_RUNTIME },
      challengeObjectiveMap: {},
      challengeScoreBreakdown: null,
      challengeCompleted: false,
      challengeScore: 0,
      guidedHintIndex: 0,
      challengePanelCollapsed: DEFAULTS.challengePanelCollapsed,
      snapshots: [],
    });
    get().runSimulation();
  },

  runSimulation: () => {
    const state = get();
    const irradiance = round(computeIrradiance(state.power, state.spotSize));
    const energy = round(
      computeEnergy(state.power, state.exposureTime, state.mode, state.dutyCycle)
    );
    const fluence = round(computeFluence(energy, state.spotSize));

    const interaction = calculateTissueInteraction({
      wavelength: state.wavelength,
      irradiance,
      energy,
      fluence,
      spotSize: state.spotSize,
      layerConfig: state.layerConfig,
      transducerAngle: state.transducerAngle,
      contactPressure: state.contactPressure,
      isDragging: state.isDragging,
      draggingSpeed: state.draggingSpeed,
      skinMelaninIndex: state.skinMelaninIndex,
    });

    const challengePatch = syncChallengeFromSimulation(state, interaction);
    set({ interaction, ...challengePatch });
  },

  setLabMode: (mode) => {
    if (mode === "free") {
      set({
        labMode: "free",
        challengeCompleted: false,
        challengeScoreBreakdown: null,
        challengeScore: 0,
        challengeObjectiveMap: {},
      });
      return;
    }
    set({ labMode: "guided", challengePanelCollapsed: false });
  },

  applyClinicalPreset: (presetId) => {
    const preset = getPhotobioPresetById(presetId);
    if (!preset) return;
    const c = preset.config;
    if (c.anatomyPreset) {
      const presetConfig = { ...PRESET_LAYER_CONFIGS[c.anatomyPreset] };
      set({
        anatomyPreset: c.anatomyPreset,
        layerConfig: presetConfig,
      });
    }
    get().setFromConfig(c);
    set({
      activeClinicalPresetId: presetId,
      activeChallengeId: null,
      ...(c.viewerTab ? { viewerTab: c.viewerTab } : {}),
      ...(c.applicatorType ? { applicatorType: c.applicatorType } : {}),
    });
    get().runSimulation();
  },

  startChallenge: (challengeId) => {
    const def = getPhotobioChallengeById(challengeId);
    if (!def) return;
    const initial = def.initialConfig;
    const techniqueStartedBad =
      challengeId === "fix-technique" ||
      (initial.transducerAngle != null && Math.abs(initial.transducerAngle - 90) > 25);
    const doseStartedHigh = challengeId === "avoid-bioinhibition";

    set({
      labMode: "guided",
      activeChallengeId: challengeId,
      activeClinicalPresetId: null,
      challengeRuntime: {
        ...DEFAULT_PHOTOBIO_CHALLENGE_RUNTIME,
        techniqueStartedBad,
        doseStartedHigh,
        realDoseFactorStarted: null,
      },
      challengeObjectiveMap: {},
      challengeCompleted: false,
      challengeScoreBreakdown: null,
      challengeScore: 0,
      guidedHintIndex: 0,
      challengePanelCollapsed: false,
      doseMap: Array.from({ length: DEFAULTS.doseMap.length }, () => 0),
      ...(def.suggestedTab ? { viewerTab: def.suggestedTab } : {}),
    });

    if (initial.anatomyPreset) {
      const presetConfig = { ...PRESET_LAYER_CONFIGS[initial.anatomyPreset] };
      set({
        anatomyPreset: initial.anatomyPreset,
        layerConfig: presetConfig,
      });
    }
    get().setFromConfig(initial);
    if (initial.applicatorType) {
      set({ applicatorType: initial.applicatorType });
    }
    get().runSimulation();
  },

  restartChallenge: () => {
    const id = get().activeChallengeId;
    if (!id) return;
    get().startChallenge(id);
  },

  advanceGuidedHint: () => {
    set((s) => ({ guidedHintIndex: s.guidedHintIndex + 1 }));
  },

  setChallengePanelCollapsed: (collapsed) => {
    set({ challengePanelCollapsed: collapsed });
  },

  syncChallengeProgress: () => {
    const state = get();
    const challengePatch = syncChallengeFromSimulation(state, state.interaction);
    set(challengePatch);
  },

  saveSnapshot: (label) => {
    const state = get();
    const config = buildConfigSnapshot(state);
    const snapshot: PhotobioSnapshot = {
      id: crypto.randomUUID(),
      label: label?.trim() || suggestPhotobioSnapshotLabel(config),
      createdAt: Date.now(),
      config,
      interaction: structuredClone(state.interaction),
    };
    const snapshots = [...state.snapshots, snapshot];
    const challengePatch = syncChallengeFromSimulation({ ...state, snapshots }, state.interaction);
    set({ snapshots, ...challengePatch });
  },

  clearSnapshots: () => {
    set({ snapshots: [] });
    get().syncChallengeProgress();
  },

  restoreSnapshot: (id) => {
    const snap = get().snapshots.find((s) => s.id === id);
    if (!snap) return;
    if (snap.config.anatomyPreset) {
      const presetConfig = { ...PRESET_LAYER_CONFIGS[snap.config.anatomyPreset] };
      set({
        anatomyPreset: snap.config.anatomyPreset,
        layerConfig: presetConfig,
      });
    }
    get().setFromConfig(snap.config);
    set({
      activeClinicalPresetId: null,
      applicatorType: snap.config.applicatorType,
    });
    get().runSimulation();
  },

  removeSnapshot: (id) => {
    set((state) => ({
      snapshots: state.snapshots.filter((s) => s.id !== id),
    }));
    get().syncChallengeProgress();
  },
}));

setTimeout(() => {
  usePhotobioStore.getState().runSimulation();
}, 0);

