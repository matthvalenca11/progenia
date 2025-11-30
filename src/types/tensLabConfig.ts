export interface TensLabConfig {
  enabledControls: {
    frequency: boolean;
    pulseWidth: boolean;
    intensity: boolean;
    mode: boolean;
  };

  allowedModes: ("convencional" | "acupuntura" | "burst" | "modulado")[];

  frequencyRange: { min: number; max: number };   // Hz
  pulseWidthRange: { min: number; max: number };  // µs
  intensityRange: { min: number; max: number };   // mA

  showWaveform: boolean;
  showComfortCard: boolean;
}

export const defaultTensLabConfig: TensLabConfig = {
  enabledControls: {
    frequency: true,
    pulseWidth: true,
    intensity: true,
    mode: true,
  },
  allowedModes: ["convencional", "acupuntura", "burst", "modulado"],
  frequencyRange: { min: 1, max: 200 },
  pulseWidthRange: { min: 50, max: 400 },
  intensityRange: { min: 0, max: 80 },
  showWaveform: true,
  showComfortCard: true,
};
