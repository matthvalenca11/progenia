/**
 * Advanced Ultrasound Simulator Types
 * Multi-modal ultrasound simulation engine
 */

export type TransducerType = 'linear' | 'convex' | 'microconvex';
export type ImagingMode = 'b-mode' | 'color-doppler';
export type AnatomyPreset = 
  | 'msk_tendon_upper_limb'
  | 'muscle_generic'
  | 'abdominal_superficial'
  | 'vascular_superficial'
  | 'tissue_with_inclusions'
  | 'generic';

/**
 * Simulation features configuration
 */
export type UltrasoundSimulationFeatures = {
  // Core imaging
  showStructuralBMode: boolean;
  showBeamOverlay: boolean;
  
  // Physical markers
  showDepthScale: boolean;
  showFocusMarker: boolean;
  
  // Physics panel
  showPhysicsPanel: boolean;
  
  // Artifacts
  enablePosteriorEnhancement: boolean;
  enableAcousticShadow: boolean;
  enableReverberation: boolean;
  enableNearFieldClutter: boolean;
  
  // Didactic overlays
  showFieldLines: boolean;
  showAttenuationMap: boolean;
  
  // Color Doppler
  enableColorDoppler: boolean;
  
  // Anatomy labels
  showAnatomyLabels: boolean;
};

/**
 * Complexity level presets
 */
export type ComplexityLevel = 'basico' | 'intermediario' | 'avancado';

/**
 * Extended configuration for advanced ultrasound lab
 */
export type UltrasoundLabConfigAdvanced = {
  enabled: boolean;
  
  // Parameter visibility toggles
  showGain: boolean;
  showDepth: boolean;
  showFrequency: boolean;
  showFocus: boolean;
  showTGC: boolean;
  showDynamicRange: boolean;
  showTransducerSelector: boolean;
  showModeSelector: boolean;
  
  // Pre-configured anatomy target
  presetAnatomy: AnatomyPreset;
  
  // Lock parameters
  lockGain?: boolean;
  lockDepth?: boolean;
  lockFrequency?: boolean;
  lockTransducer?: boolean;
  
  // Initial values
  initialGain?: number;
  initialDepth?: number;
  initialFrequency?: number;
  initialTransducer?: TransducerType;
  initialMode?: ImagingMode;
  
  // Simulation features
  simulationFeatures?: UltrasoundSimulationFeatures;
  complexityLevel?: ComplexityLevel;
};

/**
 * Default simulation features (all enabled)
 */
export const DEFAULT_SIMULATION_FEATURES: UltrasoundSimulationFeatures = {
  showStructuralBMode: true,
  showBeamOverlay: false,
  showDepthScale: true,
  showFocusMarker: true,
  showPhysicsPanel: true,
  enablePosteriorEnhancement: false, // OFF by default - interacts poorly with acoustic shadow
  enableAcousticShadow: true,
  enableReverberation: false,
  enableNearFieldClutter: false,
  showFieldLines: false,
  showAttenuationMap: false,
  enableColorDoppler: true,
  showAnatomyLabels: false,
};

/**
 * Get preset features by complexity level
 */
export const getFeaturesByComplexity = (level: ComplexityLevel): UltrasoundSimulationFeatures => {
  switch (level) {
    case 'basico':
      return {
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
    case 'intermediario':
      return {
        showStructuralBMode: true,
        showBeamOverlay: false,
        showDepthScale: true,
        showFocusMarker: true,
        showPhysicsPanel: true,
        enablePosteriorEnhancement: false, // OFF - causes artifacts with acoustic shadow
        enableAcousticShadow: true,
        enableReverberation: false,
        enableNearFieldClutter: false,
        showFieldLines: false,
        showAttenuationMap: false,
        enableColorDoppler: false,
        showAnatomyLabels: false,
      };
    case 'avancado':
      return {
        showStructuralBMode: true,
        showBeamOverlay: true,
        showDepthScale: true,
        showFocusMarker: true,
        showPhysicsPanel: true,
        enablePosteriorEnhancement: false, // OFF - causes artifacts with acoustic shadow
        enableAcousticShadow: true,
        enableReverberation: true,
        enableNearFieldClutter: true,
        showFieldLines: true,
        showAttenuationMap: false,
        enableColorDoppler: true,
        showAnatomyLabels: true,
      };
  }
};

/**
 * Default advanced configuration
 */
export const DEFAULT_ULTRASOUND_CONFIG_ADVANCED: UltrasoundLabConfigAdvanced = {
  enabled: true,
  showGain: true,
  showDepth: true,
  showFrequency: true,
  showFocus: true,
  showTGC: true,
  showDynamicRange: true,
  showTransducerSelector: true,
  showModeSelector: true,
  presetAnatomy: 'generic',
  initialGain: 50,
  initialDepth: 6,
  initialFrequency: 7.5,
  initialTransducer: 'linear',
  initialMode: 'b-mode',
  simulationFeatures: DEFAULT_SIMULATION_FEATURES,
  complexityLevel: 'intermediario',
};

/**
 * Transducer specifications
 */
export type TransducerSpec = {
  name: string;
  type: TransducerType;
  frequencyRange: [number, number]; // MHz
  depthRange: [number, number]; // cm
  geometryType: 'linear' | 'sector' | 'trapezoid';
  aperture: number; // mm
  footprint: number; // mm
  beamAngle?: number; // degrees for sector
};

/**
 * Physics parameters for rendering
 */
export type UltrasoundPhysicsParams = {
  gain: number;
  depth: number;
  frequency: number;
  focus: number;
  dynamicRange: number;
  tgcCurve: number[]; // 8 values for TGC
  transducer: TransducerSpec;
  mode: ImagingMode;
  width: number;
  height: number;
  time: number;
};

/**
 * Scatterer point in 3D space
 */
export type Scatterer = {
  x: number;
  y: number;
  z: number;
  amplitude: number;
  anisotropy?: number;
};

/**
 * Anatomical layer definition
 */
export type AnatomyLayer = {
  name: string;
  depthRange: [number, number]; // as ratio 0-1
  reflectivity: number;
  echogenicity: 'anechoic' | 'hypoechoic' | 'isoechoic' | 'hyperechoic';
  texture: 'homogeneous' | 'heterogeneous' | 'striated' | 'fibrillar';
  attenuationCoeff: number;
  hasFlow?: boolean; // for vessels
  flowVelocity?: number; // cm/s
};

/**
 * Velocity field for Doppler
 */
export type VelocityField = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  magnitude: number;
};
