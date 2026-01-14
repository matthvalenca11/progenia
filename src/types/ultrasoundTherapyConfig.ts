/**
 * Configuration types for Ultrasound Therapy Lab
 */

export type AnatomicalScenario = "shoulder" | "knee" | "lumbar" | "forearm" | "custom";

export type UltrasoundMode = "continuous" | "pulsed";

export type CouplingQuality = "good" | "poor";

export type TransducerMovement = "stationary" | "scanning";

export interface UltrasoundTherapyConfig {
  // Anatomical scenario
  scenario: AnatomicalScenario;
  
  // Custom tissue thicknesses (only for custom scenario)
  customThicknesses?: {
    skin: number; // cm
    fat: number; // cm
    muscle: number; // cm
    boneDepth?: number; // cm (depth from surface)
  };
  
  // Mixed layer configuration (for custom scenario)
  mixedLayer?: {
    enabled: boolean;
    depth: number; // cm (depth where mixed layer starts)
    division: number; // 0-100% (position of boundary: 0 = all muscle, 100 = all bone)
  };
  
  // Transducer position (2D control)
  transducerPosition?: {
    x: number; // -1 to 1 (relative position)
    y: number; // -1 to 1 (relative position)
  };
  
  // Transducer parameters
  frequency: number; // MHz (1-5)
  era: number; // cm² (Effective Radiating Area)
  mode: UltrasoundMode;
  dutyCycle: number; // % (10-100, only for pulsed)
  
  // Energy parameters
  intensity: number; // W/cm²
  duration: number; // minutes
  
  // Technique parameters
  coupling: CouplingQuality;
  movement: TransducerMovement;
  
  // Enabled controls
  enabledControls: {
    scenario: boolean;
    customThicknesses?: boolean; // Enable thickness controls for custom
    frequency: boolean;
    era: boolean;
    mode: boolean;
    dutyCycle: boolean;
    intensity: boolean;
    duration: boolean;
    coupling: boolean;
    movement: boolean;
  };
  
  // Parameter ranges
  ranges: {
    frequency: { min: number; max: number };
    era: { min: number; max: number };
    intensity: { min: number; max: number };
    duration: { min: number; max: number };
    dutyCycle: { min: number; max: number };
    customThicknesses?: {
      skin: { min: number; max: number };
      fat: { min: number; max: number };
      muscle: { min: number; max: number };
      boneDepth: { min: number; max: number };
    };
  };
}

export const defaultUltrasoundTherapyConfig: UltrasoundTherapyConfig = {
  scenario: "shoulder",
  customThicknesses: {
    skin: 0.2,
    fat: 0.5,
    muscle: 2.0,
    boneDepth: 3.0,
  },
  mixedLayer: {
    enabled: false,
    depth: 2.0,
    division: 50, // 50% = middle
  },
  transducerPosition: {
    x: 0, // centered
    y: 0, // centered
  },
  frequency: 1.1,
  era: 5.0,
  mode: "continuous",
  dutyCycle: 50,
  intensity: 1.0,
  duration: 8,
  coupling: "good",
  movement: "scanning",
  enabledControls: {
    scenario: true,
    customThicknesses: true,
    frequency: true,
    era: true,
    mode: true,
    dutyCycle: true,
    intensity: true,
    duration: true,
    coupling: true,
    movement: true,
  },
  ranges: {
    frequency: { min: 1, max: 3 },
    era: { min: 3, max: 10 },
    intensity: { min: 0.1, max: 100 },
    duration: { min: 1, max: 30 },
    dutyCycle: { min: 10, max: 100 },
    customThicknesses: {
      skin: { min: 0.1, max: 0.5 },
      fat: { min: 0.1, max: 2.0 },
      muscle: { min: 0.5, max: 5.0 },
      boneDepth: { min: 1.0, max: 6.0 },
    },
  },
};
