/**
 * Zustand store para estado centralizado do Laboratório TENS
 */

import { create } from "zustand";
import { TensMode } from "@/lib/tensSimulation";
import { TissueConfig, defaultTissueConfig, TissuePresetId, tissuePresets } from "@/types/tissueConfig";
import { 
  ElectrodeConfig, 
  defaultElectrodeConfig, 
  TensFieldResult, 
  simulateTensField 
} from "@/simulation/TensFieldEngine";
import { TensLabConfig, defaultTensLabConfig } from "@/types/tensLabConfig";

export type BottomDockTab = "analysis" | "waveform" | "safety" | "notes";
export type ViewerTab = "anatomy" | "electric" | "activated";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

interface TensLabState {
  // Lab config
  labConfig: TensLabConfig;
  
  // Preset and tissue
  presetId: TissuePresetId;
  tissueConfig: TissueConfig;
  
  // TENS parameters
  frequency: number;
  pulseWidth: number;
  intensity: number;
  mode: TensMode;
  
  // Electrode config
  electrodes: ElectrodeConfig;
  
  // UI state
  viewerTab: ViewerTab;
  bottomDockTab: BottomDockTab;
  bottomDockExpanded: boolean;
  controlPanelCollapsed: boolean;
  experienceLevel: ExperienceLevel;
  
  // Simulation result (computed)
  simulationResult: TensFieldResult | null;
  
  // Actions
  setLabConfig: (config: TensLabConfig) => void;
  setPreset: (presetId: TissuePresetId) => void;
  setTissueConfig: (config: TissueConfig) => void;
  setFrequency: (value: number) => void;
  setPulseWidth: (value: number) => void;
  setIntensity: (value: number) => void;
  setMode: (mode: TensMode) => void;
  setElectrodes: (config: Partial<ElectrodeConfig>) => void;
  setElectrodeDistance: (distanceCm: number) => void;
  setElectrodeSize: (sizeCm: number) => void;
  setViewerTab: (tab: ViewerTab) => void;
  setBottomDockTab: (tab: BottomDockTab) => void;
  setBottomDockExpanded: (expanded: boolean) => void;
  setControlPanelCollapsed: (collapsed: boolean) => void;
  setExperienceLevel: (level: ExperienceLevel) => void;
  resetToDefaults: () => void;
  saveConfiguration: () => void;
  runSimulation: () => void;
}

export const useTensLabStore = create<TensLabState>((set, get) => ({
  // Initial state
  labConfig: defaultTensLabConfig,
  presetId: "forearm_slim",
  tissueConfig: { ...defaultTissueConfig },
  frequency: 80,
  pulseWidth: 200,
  intensity: 20,
  mode: "convencional",
  electrodes: { ...defaultElectrodeConfig },
  viewerTab: "electric",
  bottomDockTab: "analysis",
  bottomDockExpanded: false,
  controlPanelCollapsed: false,
  experienceLevel: "intermediate",
  simulationResult: null,

  // Actions
  setLabConfig: (config) => {
    set({ labConfig: config });
    // Update ranges
    const state = get();
    set({
      frequency: Math.min(config.frequencyRange.max, Math.max(config.frequencyRange.min, state.frequency)),
      pulseWidth: Math.min(config.pulseWidthRange.max, Math.max(config.pulseWidthRange.min, state.pulseWidth)),
      intensity: Math.min(config.intensityRange.max, Math.max(config.intensityRange.min, state.intensity)),
    });
    get().runSimulation();
  },

  setPreset: (presetId) => {
    const preset = tissuePresets.find(p => p.id === presetId);
    if (preset && !preset.isCustom) {
      set({
        presetId,
        tissueConfig: { ...preset.config, id: presetId },
      });
    } else {
      set({ presetId });
    }
    get().runSimulation();
  },

  setTissueConfig: (config) => {
    set({ tissueConfig: config, presetId: "custom" });
    get().runSimulation();
  },

  setFrequency: (value) => {
    set({ frequency: value });
    get().runSimulation();
  },

  setPulseWidth: (value) => {
    set({ pulseWidth: value });
    get().runSimulation();
  },

  setIntensity: (value) => {
    set({ intensity: value });
    get().runSimulation();
  },

  setMode: (mode) => {
    set({ mode });
    get().runSimulation();
  },

  setElectrodes: (config) => {
    const current = get().electrodes;
    const updated = { ...current, ...config };
    
    // Update positions based on distance
    const halfDist = updated.distanceCm / 2;
    updated.anodePosition = [-halfDist, 0, 0];
    updated.cathodePosition = [halfDist, 0, 0];
    
    set({ electrodes: updated });
    get().runSimulation();
  },

  setElectrodeDistance: (distanceCm) => {
    const clamped = Math.max(2, Math.min(12, distanceCm));
    get().setElectrodes({ distanceCm: clamped });
  },

  setElectrodeSize: (sizeCm) => {
    const clamped = Math.max(2, Math.min(6, sizeCm));
    get().setElectrodes({ sizeCm: clamped });
  },

  setViewerTab: (tab) => set({ viewerTab: tab }),
  setBottomDockTab: (tab) => set({ bottomDockTab: tab }),
  setBottomDockExpanded: (expanded) => set({ bottomDockExpanded: expanded }),
  setControlPanelCollapsed: (collapsed) => set({ controlPanelCollapsed: collapsed }),
  setExperienceLevel: (level) => set({ experienceLevel: level }),

  resetToDefaults: () => {
    set({
      frequency: 80,
      pulseWidth: 200,
      intensity: 20,
      mode: "convencional",
      electrodes: { ...defaultElectrodeConfig },
      presetId: "forearm_slim",
    });
    const preset = tissuePresets.find(p => p.id === "forearm_slim");
    if (preset) {
      set({ tissueConfig: { ...preset.config, id: "forearm_slim" } });
    }
    get().runSimulation();
  },

  saveConfiguration: () => {
    const state = get();
    console.log("Configuração salva:", {
      frequency: state.frequency,
      pulseWidth: state.pulseWidth,
      intensity: state.intensity,
      mode: state.mode,
      electrodes: state.electrodes,
      preset: state.presetId,
    });
    // TODO: Implementar persistência
  },

  runSimulation: () => {
    const state = get();
    const result = simulateTensField(
      {
        frequencyHz: state.frequency,
        pulseWidthUs: state.pulseWidth,
        intensitymA: state.intensity,
        mode: state.mode,
        electrodes: state.electrodes,
      },
      state.tissueConfig
    );
    set({ simulationResult: result });
  },
}));

// Initialize simulation on store creation
setTimeout(() => {
  useTensLabStore.getState().runSimulation();
}, 0);
