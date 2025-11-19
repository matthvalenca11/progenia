/**
 * Configuration for ultrasound lab per capsule
 */
export type UltrasoundLabConfig = {
  enabled: boolean;
  showGain: boolean;
  showDepth: boolean;
  showFrequency: boolean;
  showFocus: boolean;
};

/**
 * Default configuration (all controls visible)
 */
export const DEFAULT_ULTRASOUND_CONFIG: UltrasoundLabConfig = {
  enabled: true,
  showGain: true,
  showDepth: true,
  showFrequency: true,
  showFocus: true,
};

/**
 * Parameters for ultrasound image generation
 */
export type UltrasoundParams = {
  gain: number;           // 0-100
  depth: number;          // 1-10 cm
  frequency: number;      // 1-15 MHz
  focus: number;          // 1-10 cm
  width: number;          // canvas width
  height: number;         // canvas height
  time: number;           // animation time for micro-motion
};
