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

  // Deprecated - mantidos para compatibilidade
  showWaveform: boolean;
  showComfortCard: boolean;
  
  // Novas flags modulares para o painel de insights
  showFeedbackSection: boolean;
  showRiskSection: boolean;
  showWaveformSection: boolean;
  
  tissueConfigId?: string; // ID da configuração de tecido anatômico
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
  // Deprecated - mantidos para compatibilidade
  showWaveform: true,
  showComfortCard: true,
  // Novas flags modulares
  showFeedbackSection: true,
  showRiskSection: true,
  showWaveformSection: true,
};
