/**
 * Zustand store for Ultrasound Therapy Lab state management
 */

import { create } from "zustand";
import { UltrasoundTherapyConfig, defaultUltrasoundTherapyConfig, defaultUltrasoundVisualizationOptions, type UltrasoundVisualizationOptions, FOCUS_DEPTH_ABSOLUTE_MIN } from "@/types/ultrasoundTherapyConfig";
import { simulateUltrasoundTherapy, UltrasoundTherapyResult } from "@/simulation/ultrasoundTherapyEngine";
import { getDefaultInteractionMapResolution } from "@/lib/ultrasoundTherapyInteractionMap";
import { applyPreset, clinicalPresets } from "@/config/ultrasoundTherapyPresets";
import {
  configDefaultsForTransducerType,
  getTransducerDefinition,
  normalizeTransducerType,
} from "@/config/therapeuticTransducerDefinitions";
import type { TherapyTargetGoal } from "@/components/labs/ultrasound-therapy/therapyUxHelpers";
import type { TherapyLabMode } from "@/types/ultrasoundTherapyConfig";
import {
  DEFAULT_CHALLENGE_RUNTIME,
  advanceChallengeRuntime,
  buildInitialConfigForChallenge,
  evaluateAllObjectives,
  getChallengeById,
  isChallengeComplete,
  type ChallengeRuntimeState,
  type TherapyChallengeId,
} from "@/config/ultrasoundTherapyChallenges";
import { computeTherapyScore, type TherapyScoreBreakdown } from "@/lib/ultrasoundTherapyScoring";
import {
  suggestSnapshotLabel,
  type UltrasoundTherapySnapshot,
} from "@/lib/ultrasoundTherapyComparison";
import { evaluateEffectiveCoupling } from "@/lib/therapyGelCoupling";
import { getGelSurfaceRuntime } from "@/lib/therapyGelSurfaceRuntime";
import type { CouplingQuality } from "@/types/ultrasoundTherapyConfig";

const SIMULATION_DEBOUNCE_MS = 72;
let simulationTimer: ReturnType<typeof setTimeout> | null = null;

function clearSimulationTimer() {
  if (simulationTimer) {
    clearTimeout(simulationTimer);
    simulationTimer = null;
  }
}

function scheduleSimulation(run: () => void, immediate = false) {
  clearSimulationTimer();
  if (immediate) {
    run();
    return;
  }
  simulationTimer = setTimeout(() => {
    simulationTimer = null;
    run();
  }, SIMULATION_DEBOUNCE_MS);
}

export type UltrasoundViewerTab = "beam" | "thermal" | "interaction" | "physiology";

function normalizeViewerTab(tab: string): UltrasoundViewerTab {
  if (tab === "anatomy") return "beam";
  if (tab === "beam" || tab === "thermal" || tab === "interaction" || tab === "physiology") {
    return tab;
  }
  return "interaction";
}

const UI_DEFAULTS = {
  controlPanelCollapsed: false,
  insightsPanelCollapsed: false,
  viewerTab: "interaction" as UltrasoundViewerTab,
  visualizationOptions: { ...defaultUltrasoundVisualizationOptions },
  simulationPaused: false,
  therapyTargetGoal: null as TherapyTargetGoal | null,
  labMode: "free" as TherapyLabMode,
  activeChallengeId: null as TherapyChallengeId | null,
  challengeRuntime: { ...DEFAULT_CHALLENGE_RUNTIME },
  challengeObjectiveMap: {} as Record<string, boolean>,
  challengeScoreBreakdown: null as TherapyScoreBreakdown | null,
  challengeCompleted: false,
  guidedHintIndex: 0,
  challengePanelCollapsed: false,
  challengePrevCoupling: null as string | null,
  snapshots: [] as UltrasoundTherapySnapshot[],
};

function cloneConfig(config: UltrasoundTherapyConfig): UltrasoundTherapyConfig {
  return structuredClone(config);
}

/** Ajusta ERA e transducerType para faixa clínica realista */
function normalizeConfig(config: UltrasoundTherapyConfig): UltrasoundTherapyConfig {
  const c = cloneConfig(config);
  c.transducerType = normalizeTransducerType(c.transducerType);
  c.enabledControls = {
    ...defaultUltrasoundTherapyConfig.enabledControls,
    ...c.enabledControls,
    transducerType: c.enabledControls?.transducerType !== false,
  };
  const def = getTransducerDefinition(c.transducerType);
  const eraRange = {
    min: Math.max(def.eraRange.min, c.ranges?.era?.min ?? def.eraRange.min),
    max: Math.min(def.eraRange.max, c.ranges?.era?.max ?? def.eraRange.max),
  };
  c.ranges = { ...defaultUltrasoundTherapyConfig.ranges, ...c.ranges, era: eraRange };
  c.era = Math.max(eraRange.min, Math.min(eraRange.max, c.era));
  if (def.lockBeamProfile) {
    c.beamProfile = def.defaultBeamProfile;
  }
  if (c.focusDepth != null) {
    c.focusDepth = Math.max(FOCUS_DEPTH_ABSOLUTE_MIN, c.focusDepth);
  }
  return c;
}

interface UltrasoundTherapyState {
  config: UltrasoundTherapyConfig;
  /** Snapshot do config_data original do lab (baseline para reset) */
  initialAdminConfig: UltrasoundTherapyConfig | null;
  simulationResult: UltrasoundTherapyResult | null;
  /** Acoplamento na posição atual do transdutor (gel local sob a face) */
  effectiveCoupling: CouplingQuality;
  controlPanelCollapsed: boolean;
  insightsPanelCollapsed: boolean;
  viewerTab: UltrasoundViewerTab;
  visualizationOptions: UltrasoundVisualizationOptions;
  simulationPaused: boolean;
  therapyTargetGoal: TherapyTargetGoal | null;
  /** Preset clínico ativo — sincroniza header e painel de controles */
  activeClinicalPresetId: string | null;

  labMode: TherapyLabMode;
  activeChallengeId: TherapyChallengeId | null;
  challengeRuntime: ChallengeRuntimeState;
  challengeObjectiveMap: Record<string, boolean>;
  challengeScoreBreakdown: TherapyScoreBreakdown | null;
  challengeCompleted: boolean;
  guidedHintIndex: number;
  challengePanelCollapsed: boolean;
  challengePrevCoupling: string | null;

  /** Pontuação atual (0–100) derivada do breakdown */
  challengeScore: number;

  snapshots: UltrasoundTherapySnapshot[];

  // Actions
  initializeLab: (config: UltrasoundTherapyConfig) => void;
  setLabConfig: (config: UltrasoundTherapyConfig) => void;
  updateConfig: (updates: Partial<UltrasoundTherapyConfig>) => void;
  updateTransducerPosition: (
    position: { x: number; y: number },
    options?: { commit?: boolean },
  ) => void;
  applyClinicalPreset: (presetId: string) => void;
  reset: (initialConfig?: UltrasoundTherapyConfig) => void;
  clear: () => void;
  runSimulation: () => void;
  flushSimulation: () => void;
  setControlPanelCollapsed: (collapsed: boolean) => void;
  setInsightsPanelCollapsed: (collapsed: boolean) => void;
  setViewerTab: (tab: UltrasoundViewerTab) => void;
  setSimulationPaused: (paused: boolean) => void;
  setTherapyTargetGoal: (goal: TherapyTargetGoal | null) => void;
  setVisualizationOption: <K extends keyof UltrasoundVisualizationOptions>(
    key: K,
    value: UltrasoundVisualizationOptions[K],
  ) => void;
  updateVisualizationOptions: (updates: Partial<UltrasoundVisualizationOptions>) => void;
  setLabMode: (mode: TherapyLabMode) => void;
  startChallenge: (challengeId: TherapyChallengeId) => void;
  restartChallenge: () => void;
  advanceGuidedHint: () => void;
  setChallengePanelCollapsed: (collapsed: boolean) => void;
  syncChallengeProgress: () => void;
  saveSnapshot: (label?: string) => void;
  clearSnapshots: () => void;
  restoreSnapshot: (id: string) => void;
  removeSnapshot: (id: string) => void;
}

function syncChallengeFromSimulation(
  config: UltrasoundTherapyConfig,
  result: UltrasoundTherapyResult,
  state: Pick<
    UltrasoundTherapyState,
    | "activeChallengeId"
    | "challengeRuntime"
    | "challengePrevCoupling"
    | "viewerTab"
    | "labMode"
  >,
): Partial<UltrasoundTherapyState> {
  if (state.labMode !== "guided" || !state.activeChallengeId) {
    return {
      challengeScoreBreakdown: null,
      challengeObjectiveMap: {},
      challengeCompleted: false,
      challengeScore: 0,
    };
  }

  const runtime = advanceChallengeRuntime(
    state.challengeRuntime,
    config,
    result,
    state.challengePrevCoupling ?? undefined,
  );

  const ctx = {
    config,
    result,
    runtime,
    viewerTab: state.viewerTab,
  };

  const challengeObjectiveMap = evaluateAllObjectives(state.activeChallengeId, ctx);
  const challengeCompleted = isChallengeComplete(state.activeChallengeId, ctx);
  const challengeScoreBreakdown = computeTherapyScore({
    config,
    result,
    challengeId: state.activeChallengeId,
    challengeCtx: ctx,
  });

  return {
    challengeRuntime: runtime,
    challengeObjectiveMap,
    challengeCompleted,
    challengeScoreBreakdown,
    challengeScore: challengeScoreBreakdown.total,
    challengePrevCoupling: config.coupling,
  };
}

export const useUltrasoundTherapyStore = create<UltrasoundTherapyState>((set, get) => ({
  config: defaultUltrasoundTherapyConfig,
  initialAdminConfig: null,
  simulationResult: null,
  effectiveCoupling: "good" as CouplingQuality,
  activeClinicalPresetId: null,
  challengeScore: 0,
  ...UI_DEFAULTS,

  initializeLab: (config) => {
    const baseline = normalizeConfig(config);
    set({
      config: baseline,
      initialAdminConfig: cloneConfig(baseline),
      activeClinicalPresetId: null,
    });
    get().runSimulation();
  },

  setLabConfig: (config) => {
    set({ config: normalizeConfig(config) });
    get().runSimulation();
  },

  updateConfig: (updates) => {
    const prev = get().config;
    let newConfig = { ...prev, ...updates };

    if (updates.transducerType && updates.transducerType !== prev.transducerType) {
      newConfig = {
        ...newConfig,
        ...configDefaultsForTransducerType(updates.transducerType),
      };
    }

    set({ config: normalizeConfig(newConfig), activeClinicalPresetId: null });
    scheduleSimulation(() => get().runSimulation());
  },

  updateTransducerPosition: (position, options) => {
    set((state) => ({
      config: {
        ...state.config,
        transducerPosition: position,
      },
      activeClinicalPresetId: null,
    }));
    if (options?.commit) {
      scheduleSimulation(() => get().runSimulation(), true);
    }
  },

  flushSimulation: () => {
    scheduleSimulation(() => get().runSimulation(), true);
  },

  applyClinicalPreset: (presetId) => {
    const preset = clinicalPresets.find((p) => p.id === presetId);
    if (!preset) return;
    const newConfig = applyPreset(preset, get().config);
    set({ config: newConfig, activeClinicalPresetId: presetId });
    get().runSimulation();
  },

  reset: (initialConfig) => {
    const baseline = initialConfig ?? get().initialAdminConfig;
    if (!baseline) {
      return;
    }
    set({ config: cloneConfig(baseline), activeClinicalPresetId: null });
    get().runSimulation();
  },

  clear: () => {
    clearSimulationTimer();
    set({
      config: cloneConfig(defaultUltrasoundTherapyConfig),
      initialAdminConfig: null,
      simulationResult: null,
      effectiveCoupling: "good",
      activeClinicalPresetId: null,
      snapshots: [],
      ...UI_DEFAULTS,
    });
  },

  runSimulation: () => {
    const config = get().config;
    const effectiveCoupling = evaluateEffectiveCoupling(
      config.transducerPosition,
      getGelSurfaceRuntime(),
      config.coupling,
    );
    const params = {
      frequency: config.frequency,
      intensity: config.intensity,
      era: config.era,
      mode: config.mode,
      dutyCycle: config.dutyCycle,
      duration: config.duration,
      coupling: effectiveCoupling,
      movement: config.movement,
      scenario: config.scenario,
      customThicknesses: config.customThicknesses,
      mixedLayer: config.mixedLayer,
      transducerPosition: config.transducerPosition,
      tissuePerfusionProfile: config.tissuePerfusionProfile,
      transducerType: config.transducerType,
      beamProfile: config.beamProfile,
      focusDepth: config.focusDepth,
      interactionMapResolution: getDefaultInteractionMapResolution(),
    };

    const result = simulateUltrasoundTherapy(params);
    const state = get();
    const challengePatch = syncChallengeFromSimulation(config, result, state);
    set({ simulationResult: result, effectiveCoupling, ...challengePatch });
  },

  setControlPanelCollapsed: (collapsed) => {
    set({ controlPanelCollapsed: collapsed });
  },

  setInsightsPanelCollapsed: (collapsed) => {
    set({ insightsPanelCollapsed: collapsed });
  },

  setViewerTab: (tab) => {
    set({ viewerTab: normalizeViewerTab(tab) });
    get().syncChallengeProgress();
  },

  setSimulationPaused: (paused) => {
    set({ simulationPaused: paused });
  },

  setTherapyTargetGoal: (goal) => {
    set({ therapyTargetGoal: goal });
  },

  setVisualizationOption: (key, value) => {
    set((state) => ({
      visualizationOptions: { ...state.visualizationOptions, [key]: value },
    }));
  },

  updateVisualizationOptions: (updates) => {
    set((state) => ({
      visualizationOptions: { ...state.visualizationOptions, ...updates },
    }));
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

  startChallenge: (challengeId) => {
    const base = get().initialAdminConfig ?? get().config;
    const challengeConfig = normalizeConfig(buildInitialConfigForChallenge(challengeId, base));
    const couplingStartedPoor = challengeConfig.coupling === "poor";
    const def = getChallengeById(challengeId);
    const suggestedTab = def?.suggestedTab;

    set({
      labMode: "guided",
      activeChallengeId: challengeId,
      config: challengeConfig,
      activeClinicalPresetId: null,
      challengeRuntime: {
        ...DEFAULT_CHALLENGE_RUNTIME,
        couplingStartedPoor,
      },
      challengeObjectiveMap: {},
      challengeCompleted: false,
      challengeScoreBreakdown: null,
      challengeScore: 0,
      guidedHintIndex: 0,
      challengePrevCoupling: challengeConfig.coupling,
      challengePanelCollapsed: false,
      ...(suggestedTab ? { viewerTab: suggestedTab } : {}),
    });
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
    const { config, simulationResult } = state;
    if (!simulationResult) return;
    const patch = syncChallengeFromSimulation(config, simulationResult, state);
    set(patch);
  },

  saveSnapshot: (label) => {
    const { config, simulationResult, snapshots } = get();
    if (!simulationResult) return;

    const snapshot: UltrasoundTherapySnapshot = {
      id: crypto.randomUUID(),
      label: label?.trim() || suggestSnapshotLabel(config),
      createdAt: Date.now(),
      config: cloneConfig(config),
      result: structuredClone(simulationResult),
    };

    set({ snapshots: [...snapshots, snapshot] });
  },

  clearSnapshots: () => {
    set({ snapshots: [] });
  },

  restoreSnapshot: (id) => {
    const snap = get().snapshots.find((s) => s.id === id);
    if (!snap) return;
    set({ config: cloneConfig(snap.config), activeClinicalPresetId: null });
    get().runSimulation();
  },

  removeSnapshot: (id) => {
    set((state) => ({
      snapshots: state.snapshots.filter((s) => s.id !== id),
    }));
  },
}));
