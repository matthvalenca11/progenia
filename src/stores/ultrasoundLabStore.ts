/**
 * Global reactive store for Ultrasound Virtual Lab configuration
 * Uses Zustand for state management with instant reactivity
 */

import { create } from 'zustand';
import { UltrasoundInclusionConfig } from '@/types/acousticMedia';
import { UltrasoundSimulationFeatures, ComplexityLevel, AnatomyLayer } from '@/types/ultrasoundAdvanced';

export interface UltrasoundLabState {
  // Basic info
  labId: string | null;
  labName: string;
  labDescription: string;
  
  // Anatomy preset
  presetId: string;
  
  // Acoustic configuration
  layers: AnatomyLayer[];
  inclusions: UltrasoundInclusionConfig[];
  
  // Transducer and imaging parameters
  transducerType: 'linear' | 'convex' | 'microconvex';
  frequency: number; // MHz
  depth: number; // cm
  focus: number; // cm
  gain: number; // 0-100
  dynamicRange: number; // dB
  
  // Imaging mode
  mode: 'b-mode' | 'color-doppler';
  
  // Simulation features
  simulationFeatures: UltrasoundSimulationFeatures;
  
  // Complexity level
  complexityLevel: ComplexityLevel;
  
  // Student-available controls
  studentControls: {
    showGain: boolean;
    showDepth: boolean;
    showFrequency: boolean;
    showFocus: boolean;
    showTransducerSelector: boolean;
    showModeSelector: boolean;
    lockGain: boolean;
    lockDepth: boolean;
    lockFrequency: boolean;
    lockFocus: boolean;
  };
  
  // Actions
  setLabId: (id: string | null) => void;
  setLabName: (name: string) => void;
  setLabDescription: (description: string) => void;
  setPresetId: (presetId: string) => void;
  setLayers: (layers: AnatomyLayer[]) => void;
  setInclusions: (inclusions: UltrasoundInclusionConfig[]) => void;
  setTransducerType: (type: 'linear' | 'convex' | 'microconvex') => void;
  setFrequency: (freq: number) => void;
  setDepth: (depth: number) => void;
  setFocus: (focus: number) => void;
  setGain: (gain: number) => void;
  setDynamicRange: (range: number) => void;
  setMode: (mode: 'b-mode' | 'color-doppler') => void;
  setSimulationFeatures: (features: Partial<UltrasoundSimulationFeatures>) => void;
  setComplexityLevel: (level: ComplexityLevel) => void;
  setStudentControls: (controls: Partial<UltrasoundLabState['studentControls']>) => void;
  
  // Layer management
  addLayer: (layer: AnatomyLayer) => void;
  updateLayer: (index: number, layer: Partial<AnatomyLayer>) => void;
  removeLayer: (index: number) => void;
  
  // Inclusion management
  addInclusion: (inclusion: UltrasoundInclusionConfig) => void;
  updateInclusion: (index: number, inclusion: Partial<UltrasoundInclusionConfig>) => void;
  removeInclusion: (index: number) => void;
  
  // Bulk operations
  loadConfig: (config: Partial<UltrasoundLabState>) => void;
  resetToDefaults: () => void;
  
  // Validation
  validate: () => { valid: boolean; errors: string[] };
}

const DEFAULT_SIMULATION_FEATURES: UltrasoundSimulationFeatures = {
  showStructuralBMode: true,
  showBeamOverlay: false,
  showDepthScale: true,
  showFocusMarker: true,
  showPhysicsPanel: false,
  enablePosteriorEnhancement: true,
  enableAcousticShadow: true,
  enableReverberation: false,
  enableNearFieldClutter: false,
  showFieldLines: false,
  showAttenuationMap: false,
  enableColorDoppler: false,
  showAnatomyLabels: false,
};

const DEFAULT_STUDENT_CONTROLS = {
  showGain: true,
  showDepth: true,
  showFrequency: true,
  showFocus: true,
  showTransducerSelector: false,
  showModeSelector: false,
  lockGain: false,
  lockDepth: false,
  lockFrequency: false,
  lockFocus: false,
};

export const useUltrasoundLabStore = create<UltrasoundLabState>((set, get) => ({
  // Initial state
  labId: null,
  labName: '',
  labDescription: '',
  presetId: 'muscle_generic',
  layers: [],
  inclusions: [],
  transducerType: 'linear',
  frequency: 10, // 10 MHz
  depth: 5, // 5 cm
  focus: 2.5, // 2.5 cm
  gain: 50,
  dynamicRange: 60,
  mode: 'b-mode',
  simulationFeatures: DEFAULT_SIMULATION_FEATURES,
  complexityLevel: 'intermediario',
  studentControls: DEFAULT_STUDENT_CONTROLS,
  
  // Basic setters
  setLabId: (id) => set({ labId: id }),
  setLabName: (name) => set({ labName: name }),
  setLabDescription: (description) => set({ labDescription: description }),
  setPresetId: (presetId) => set({ presetId }),
  setLayers: (layers) => set({ layers }),
  setInclusions: (inclusions) => set({ inclusions }),
  setTransducerType: (type) => set({ transducerType: type }),
  setFrequency: (frequency) => set({ frequency }),
  setDepth: (depth) => set({ depth }),
  setFocus: (focus) => set({ focus }),
  setGain: (gain) => set({ gain }),
  setDynamicRange: (range) => set({ dynamicRange: range }),
  setMode: (mode) => set({ mode }),
  
  setSimulationFeatures: (features) => 
    set((state) => ({
      simulationFeatures: { ...state.simulationFeatures, ...features }
    })),
  
  setComplexityLevel: (level) => {
    // Auto-adjust simulation features based on complexity
    let features: Partial<UltrasoundSimulationFeatures> = {};
    
    if (level === 'basico') {
      features = {
        showStructuralBMode: true,
        showBeamOverlay: false,
        showDepthScale: true,
        showFocusMarker: false,
        showPhysicsPanel: false,
        enablePosteriorEnhancement: false,
        enableAcousticShadow: false,
        enableReverberation: false,
        enableNearFieldClutter: false,
        showFieldLines: false,
        showAttenuationMap: false,
        enableColorDoppler: false,
        showAnatomyLabels: false,
      };
    } else if (level === 'intermediario') {
      features = {
        showStructuralBMode: true,
        showBeamOverlay: false,
        showDepthScale: true,
        showFocusMarker: true,
        showPhysicsPanel: true,
        enablePosteriorEnhancement: true,
        enableAcousticShadow: true,
        enableReverberation: false,
        enableNearFieldClutter: false,
        showFieldLines: false,
        showAttenuationMap: false,
        enableColorDoppler: false,
        showAnatomyLabels: true,
      };
    } else { // avancado
      features = {
        showStructuralBMode: true,
        showBeamOverlay: true,
        showDepthScale: true,
        showFocusMarker: true,
        showPhysicsPanel: true,
        enablePosteriorEnhancement: true,
        enableAcousticShadow: true,
        enableReverberation: true,
        enableNearFieldClutter: true,
        showFieldLines: true,
        showAttenuationMap: true,
        enableColorDoppler: true,
        showAnatomyLabels: true,
      };
    }
    
    set((state) => ({
      complexityLevel: level,
      simulationFeatures: { ...state.simulationFeatures, ...features }
    }));
  },
  
  setStudentControls: (controls) =>
    set((state) => ({
      studentControls: { ...state.studentControls, ...controls }
    })),
  
  // Layer management
  addLayer: (layer) =>
    set((state) => ({
      layers: [...state.layers, layer]
    })),
  
  updateLayer: (index, updates) =>
    set((state) => ({
      layers: state.layers.map((layer, i) =>
        i === index ? { ...layer, ...updates } : layer
      )
    })),
  
  removeLayer: (index) =>
    set((state) => ({
      layers: state.layers.filter((_, i) => i !== index)
    })),
  
  // Inclusion management
  addInclusion: (inclusion) =>
    set((state) => ({
      inclusions: [...state.inclusions, inclusion]
    })),
  
  updateInclusion: (index, updates) =>
    set((state) => ({
      inclusions: state.inclusions.map((inclusion, i) =>
        i === index ? { ...inclusion, ...updates } : inclusion
      )
    })),
  
  removeInclusion: (index) =>
    set((state) => ({
      inclusions: state.inclusions.filter((_, i) => i !== index)
    })),
  
  // Bulk operations
  loadConfig: (config) => set((state) => ({ ...state, ...config })),
  
  resetToDefaults: () => set({
    labId: null,
    labName: '',
    labDescription: '',
    presetId: 'muscle_generic',
    layers: [],
    inclusions: [],
    transducerType: 'linear',
    frequency: 10,
    depth: 5,
    focus: 2.5,
    gain: 50,
    dynamicRange: 60,
    mode: 'b-mode',
    simulationFeatures: DEFAULT_SIMULATION_FEATURES,
    complexityLevel: 'intermediario',
    studentControls: DEFAULT_STUDENT_CONTROLS,
  }),
  
  // Validation
  validate: () => {
    const state = get();
    const errors: string[] = [];
    
    if (!state.labName || state.labName.trim() === '') {
      errors.push('Nome do laboratório é obrigatório');
    }
    
    if (state.layers.length === 0) {
      errors.push('Pelo menos uma camada acústica é necessária');
    }
    
    // Check if layers have valid depth ranges
    for (const layer of state.layers) {
      if (layer.depthRange[1] > 1.0 || layer.depthRange[0] < 0) {
        errors.push(`Camada "${layer.name}" tem intervalo de profundidade inválido`);
      }
    }
    
    if (state.focus > state.depth) {
      errors.push('Foco não pode ser maior que a profundidade');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  },
}));
