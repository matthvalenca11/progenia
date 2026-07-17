import type { PhotobioAnatomyPreset } from "@/simulation/photobioEngine";
import type { PhotobioApplicatorType } from "@/components/labs/photobio/photobioApplicatorTypes";
import type { PhotobioWavelength } from "@/lib/photobioOptics";

export type PhotobioViewerTab =
  | "anatomy"
  | "beam"
  | "fluence"
  | "penetration"
  | "bioresponse";

export type PhotobioLabMode = "free" | "guided";
export type PhotobioMode = "CW" | "Pulsed";

export type PhotobioPresetId =
  | "superficial-repair"
  | "deep-analgesia"
  | "subcutaneous-antiinflammatory"
  | "obese-deep-target"
  | "bad-overdose"
  | "bad-subdose";

export interface PhotobioClinicalPreset {
  id: PhotobioPresetId;
  name: string;
  description: string;
  explanation: string;
  educationalGoal: string;
  config: Partial<{
    wavelength: PhotobioWavelength;
    power: number;
    spotSize: number;
    exposureTime: number;
    mode: PhotobioMode;
    dutyCycle: number;
    transducerAngle: number;
    contactPressure: number;
    isDragging: boolean;
    draggingSpeed: number;
    anatomyPreset: PhotobioAnatomyPreset;
    applicatorType: PhotobioApplicatorType;
    viewerTab: PhotobioViewerTab;
  }>;
}

export const PHOTOBIO_CLINICAL_PRESETS: PhotobioClinicalPreset[] = [
  {
    id: "superficial-repair",
    name: "Reparo tecidual superficial",
    description: "660 nm, fluência moderada, foco epiderme/derme.",
    explanation:
      "Demonstra absorção superficial intensa. Ideal para comparar glow na derme e baixa transmissão muscular.",
    educationalGoal: "Visualizar por que 660 nm é mais superficial.",
    config: {
      wavelength: 660,
      power: 80,
      spotSize: 0.45,
      exposureTime: 40,
      mode: "CW",
      transducerAngle: 90,
      contactPressure: 55,
      anatomyPreset: "default",
      applicatorType: "cluster",
      viewerTab: "beam",
    },
  },
  {
    id: "deep-analgesia",
    name: "Analgesia / alvo muscular",
    description: "808 nm, spot maior, dose controlada para músculo.",
    explanation:
      "Prioriza entrega profunda com spot ampliado para irradiância segura. Observe transmissão ao músculo no painel.",
    educationalGoal: "Relacionar 808 nm + spot com entrega muscular.",
    config: {
      wavelength: 808,
      power: 120,
      spotSize: 0.85,
      exposureTime: 50,
      mode: "CW",
      transducerAngle: 90,
      contactPressure: 60,
      anatomyPreset: "athlete",
      applicatorType: "dualWavelengthCluster",
      viewerTab: "penetration",
    },
  },
  {
    id: "subcutaneous-antiinflammatory",
    name: "Anti-inflamatório subcutâneo",
    description: "808 nm, adiposo moderado — compare penetração vs 660 nm.",
    explanation:
      "Anatomia padrão com adiposo moderado. Use o modo guiado ou snapshots para comparar 660 vs 808.",
    educationalGoal: "Destacar diferença de penetração em tecido subcutâneo.",
    config: {
      wavelength: 808,
      power: 100,
      spotSize: 0.6,
      exposureTime: 45,
      mode: "Pulsed",
      dutyCycle: 50,
      anatomyPreset: "default",
      applicatorType: "dualWavelengthCluster",
      viewerTab: "penetration",
    },
  },
  {
    id: "obese-deep-target",
    name: "Adiposidade elevada",
    description: "808 nm recomendado; mostrar perda por adiposeMm.",
    explanation:
      "Preset obese com 808 nm como ponto de partida. Ajuste tempo/spot/power e observe perda no músculo.",
    educationalGoal: "Entender atenuação adiposa e compensação de dose.",
    config: {
      wavelength: 808,
      power: 150,
      spotSize: 0.75,
      exposureTime: 60,
      mode: "CW",
      transducerAngle: 90,
      contactPressure: 55,
      anatomyPreset: "obese",
      applicatorType: "dualWavelengthCluster",
      viewerTab: "penetration",
    },
  },
  {
    id: "bad-overdose",
    name: "Exemplo: overdose / saturação",
    description: "Power alto, spot pequeno, parado — alerta térmico e bioinibição.",
    explanation:
      "Configuração propositalmente inadequada: irradiância alta, transdutor parado, dose excessiva.",
    educationalGoal: "Reconhecer saturação e risco térmico.",
    config: {
      wavelength: 660,
      power: 450,
      spotSize: 0.15,
      exposureTime: 120,
      mode: "CW",
      transducerAngle: 90,
      contactPressure: 40,
      isDragging: false,
      draggingSpeed: 1,
      anatomyPreset: "default",
      applicatorType: "pointLaser",
      viewerTab: "bioresponse",
    },
  },
  {
    id: "bad-subdose",
    name: "Exemplo: subdose",
    description: "Power baixo, tempo curto, varredura rápida simulada.",
    explanation:
      "Parâmetros insuficientes + técnica de scanning rápido reduzem dose efetiva abaixo da janela.",
    educationalGoal: "Identificar subdose por parâmetros e técnica.",
    config: {
      wavelength: 660,
      power: 25,
      spotSize: 0.5,
      exposureTime: 8,
      mode: "CW",
      transducerAngle: 75,
      contactPressure: 15,
      isDragging: true,
      draggingSpeed: 2.8,
      anatomyPreset: "default",
      applicatorType: "cluster",
      viewerTab: "fluence",
    },
  },
];

export function getPhotobioPresetById(id: PhotobioPresetId): PhotobioClinicalPreset | undefined {
  return PHOTOBIO_CLINICAL_PRESETS.find((p) => p.id === id);
}
