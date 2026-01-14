/**
 * Zustand store for Ultrasound Therapy Lab state management
 */

import { create } from "zustand";
import { UltrasoundTherapyConfig, defaultUltrasoundTherapyConfig } from "@/types/ultrasoundTherapyConfig";
import { simulateUltrasoundTherapy, UltrasoundTherapyResult } from "@/simulation/ultrasoundTherapyEngine";

interface UltrasoundTherapyState {
  config: UltrasoundTherapyConfig;
  simulationResult: UltrasoundTherapyResult | null;
  controlPanelCollapsed: boolean;
  insightsPanelCollapsed: boolean;
  
  // Actions
  setLabConfig: (config: UltrasoundTherapyConfig) => void;
  updateConfig: (updates: Partial<UltrasoundTherapyConfig>) => void;
  runSimulation: () => void;
  setControlPanelCollapsed: (collapsed: boolean) => void;
  setInsightsPanelCollapsed: (collapsed: boolean) => void;
}

export const useUltrasoundTherapyStore = create<UltrasoundTherapyState>((set, get) => ({
  config: defaultUltrasoundTherapyConfig,
  simulationResult: null,
  controlPanelCollapsed: false,
  insightsPanelCollapsed: true,
  
  setLabConfig: (config) => {
    set({ config });
    get().runSimulation();
  },
  
  updateConfig: (updates) => {
    const newConfig = { ...get().config, ...updates };
    set({ config: newConfig });
    get().runSimulation();
  },
  
  runSimulation: () => {
    const config = get().config;
    const params = {
      frequency: config.frequency,
      intensity: config.intensity,
      era: config.era,
      mode: config.mode,
      dutyCycle: config.dutyCycle,
      duration: config.duration,
      coupling: config.coupling,
      movement: config.movement,
      scenario: config.scenario,
      customThicknesses: config.customThicknesses,
      mixedLayer: config.mixedLayer,
      transducerPosition: config.transducerPosition,
    };
    
    const result = simulateUltrasoundTherapy(params);
    set({ simulationResult: result });
  },
  
  setControlPanelCollapsed: (collapsed) => {
    set({ controlPanelCollapsed: collapsed });
  },
  
  setInsightsPanelCollapsed: (collapsed) => {
    set({ insightsPanelCollapsed: collapsed });
  },
}));
