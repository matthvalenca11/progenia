/**
 * MRI Lab Store - Zustand store for MRI Lab state
 */

import { create } from "zustand";
import { MRILabConfig, defaultMRILabConfig } from "@/types/mriLabConfig";
import { simulateMRI, MRISimulationResult, applyMRIPreset } from "@/simulation/mriEngine";

interface MRILabStore {
  config: MRILabConfig;
  simulationResult: MRISimulationResult | null;
  setLabConfig: (config: MRILabConfig) => void;
  updateConfig: (updates: Partial<MRILabConfig>) => void;
  runSimulation: () => void;
}

export const useMRILabStore = create<MRILabStore>((set, get) => {
  // Initialize with default config and run simulation immediately
  const initialState = {
    config: defaultMRILabConfig,
    simulationResult: null as MRISimulationResult | null,
  };
  
  // Run initial simulation
  try {
    initialState.simulationResult = simulateMRI(defaultMRILabConfig);
  } catch (error) {
    console.error("Error running initial MRI simulation:", error);
  }
  
  return {
    ...initialState,
    
    setLabConfig: (config) => {
      set({ config });
      get().runSimulation();
    },
  
  updateConfig: (updates) => {
    const currentConfig = get().config;
    const newConfig = { ...currentConfig, ...updates };
    
    // Apply preset if preset changed
    if (updates.preset && updates.preset !== currentConfig.preset) {
      const presetConfig = applyMRIPreset(updates.preset);
      Object.assign(newConfig, presetConfig);
    }
    
    // Reset sliceIndex if phantomType changed
    if (updates.phantomType && updates.phantomType !== currentConfig.phantomType) {
      newConfig.sliceIndex = 0;
    }
    
    set({ config: newConfig });
    get().runSimulation();
  },
  
  runSimulation: () => {
    try {
      const config = get().config;
      const result = simulateMRI(config);
      set({ simulationResult: result });
    } catch (error) {
      console.error("Error running MRI simulation:", error);
      set({ simulationResult: null });
    }
  },
  };
});
