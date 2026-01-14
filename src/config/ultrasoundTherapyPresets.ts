/**
 * Clinical Presets for Therapeutic Ultrasound Lab
 * Educational presets that demonstrate different clinical scenarios
 */

import { UltrasoundTherapyConfig } from "@/types/ultrasoundTherapyConfig";

export interface ClinicalPreset {
  id: string;
  name: string;
  description: string;
  explanation: string; // Why it works or why it's dangerous
  config: Partial<UltrasoundTherapyConfig>;
}

export const clinicalPresets: ClinicalPreset[] = [
  {
    id: "analgesia-superficial",
    name: "Analgesia Superficial",
    description: "Para tendinites e lesões superficiais",
    explanation: "Frequência alta (3 MHz) e ERA pequena concentram energia na superfície, ideal para estruturas superficiais como tendões. Modo pulsado reduz aquecimento excessivo.",
    config: {
      scenario: "shoulder",
      frequency: 3.0,
      era: 3.0,
      mode: "pulsed",
      dutyCycle: 50,
      intensity: 1.0,
      duration: 5,
      coupling: "good",
      movement: "scanning",
    },
  },
  {
    id: "aquecimento-profundo",
    name: "Aquecimento Profundo",
    description: "Para músculos e tecidos profundos",
    explanation: "Frequência baixa (1.1 MHz) e ERA maior permitem maior penetração. Modo contínuo maximiza aquecimento. Varredura distribui energia e reduz risco de hotspot.",
    config: {
      scenario: "lumbar",
      frequency: 1.1,
      era: 8.0,
      mode: "continuous",
      dutyCycle: 100,
      intensity: 1.5,
      duration: 10,
      coupling: "good",
      movement: "scanning",
    },
  },
  {
    id: "regiao-proximo-osso",
    name: "Região Próxima ao Osso",
    description: "Cuidado com risco periosteal",
    explanation: "Frequência moderada e intensidade controlada. Varredura obrigatória para evitar concentração de energia no osso. Monitorar temperatura superficial e periosteal.",
    config: {
      scenario: "knee",
      frequency: 1.5,
      era: 5.0,
      mode: "pulsed",
      dutyCycle: 50,
      intensity: 0.8,
      duration: 8,
      coupling: "good",
      movement: "scanning", // Critical: must scan near bone
    },
  },
  {
    id: "exemplo-inadequado",
    name: "⚠️ Exemplo Inadequado",
    description: "Parâmetros perigosos - NÃO usar na clínica",
    explanation: "Intensidade muito alta, modo contínuo, parado e duração longa criam risco de queimadura. Demonstra a importância de seguir protocolos seguros.",
    config: {
      scenario: "forearm",
      frequency: 3.0,
      era: 3.0,
      mode: "continuous",
      dutyCycle: 100,
      intensity: 2.5,
      duration: 20,
      coupling: "poor", // Poor coupling adds to risk
      movement: "stationary", // Stationary = dangerous hotspot
    },
  },
];

/**
 * Apply a preset to a config, preserving enabledControls and ranges
 */
export function applyPreset(
  preset: ClinicalPreset,
  currentConfig: UltrasoundTherapyConfig
): UltrasoundTherapyConfig {
  return {
    ...currentConfig,
    ...preset.config,
    // Preserve enabledControls and ranges
    enabledControls: currentConfig.enabledControls,
    ranges: currentConfig.ranges,
  };
}
