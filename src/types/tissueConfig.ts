export type TissueType = "soft" | "muscular" | "mixed";

export type TissuePresetId = 
  | "forearm_slim"
  | "forearm_muscular"
  | "thigh_obese_implant"
  | "ankle_bony"
  | "custom";

export type TissueInclusionType = "bone" | "metal_implant";

export interface TissueInclusion {
  id: string;
  type: TissueInclusionType;
  depth: number;      // 0–1 (superfície → profundo)
  span: number;       // largura / extensão relativa (0-1)
  position: number;   // posição entre os eletrodos (0–1)
}

export interface TissueConfig {
  id: string;
  name: string;
  description?: string;
  
  // Espessura relativa das camadas (0-1 normalizadas)
  skinThickness: number;         // 0-1
  fatThickness: number;          // 0-1
  muscleThickness: number;       // 0-1
  boneDepth: number;             // 0-1 (profundidade em relação à superfície)
  
  // Implantes metálicos (legacy - mantido para compatibilidade)
  hasMetalImplant: boolean;
  metalImplantDepth?: number;    // 0-1 (profundidade da prótese)
  metalImplantSpan?: number;     // 0-1 (quanto se estende entre os eletrodos)
  
  // Sistema moderno de inclusões
  inclusions?: TissueInclusion[];
  
  tissueType: TissueType;
  
  // Flags de risco
  enableRiskSimulation: boolean;
  
  created_at?: string;
  updated_at?: string;
}

export interface TissuePreset {
  id: TissuePresetId;
  label: string;
  description: string;
  config: Omit<TissueConfig, "id" | "created_at" | "updated_at">;
  isCustom: boolean;
}

export interface RiskResult {
  riskScore: number;            // 0-100
  riskLevel: "baixo" | "moderado" | "alto";
  messages: string[];           // textos sobre risco
}

// Presets anatômicos predefinidos
export const tissuePresets: TissuePreset[] = [
  {
    id: "forearm_slim",
    label: "Antebraço magro",
    description: "Pouca gordura subcutânea, músculo moderado, sem implantes.",
    isCustom: false,
    config: {
      name: "Antebraço magro",
      description: "Pouca gordura subcutânea, músculo moderado, sem implantes.",
      skinThickness: 0.15,
      fatThickness: 0.10,
      muscleThickness: 0.55,
      boneDepth: 0.80,
      hasMetalImplant: false,
      tissueType: "soft",
      enableRiskSimulation: true,
      inclusions: [],
    },
  },
  {
    id: "forearm_muscular",
    label: "Antebraço musculoso",
    description: "Camada muscular espessa, pouca gordura, osso mais profundo.",
    isCustom: false,
    config: {
      name: "Antebraço musculoso",
      description: "Camada muscular espessa, pouca gordura, osso mais profundo.",
      skinThickness: 0.15,
      fatThickness: 0.05,
      muscleThickness: 0.70,
      boneDepth: 0.90,
      hasMetalImplant: false,
      tissueType: "muscular",
      enableRiskSimulation: true,
      inclusions: [],
    },
  },
  {
    id: "thigh_obese_implant",
    label: "Coxa obesa com prótese",
    description: "Gordura e músculo espessos, com implante metálico em profundidade intermediária.",
    isCustom: false,
    config: {
      name: "Coxa obesa com prótese",
      description: "Gordura e músculo espessos, com implante metálico em profundidade intermediária.",
      skinThickness: 0.20,
      fatThickness: 0.55,
      muscleThickness: 0.50,
      boneDepth: 0.85,
      hasMetalImplant: true,
      metalImplantDepth: 0.55,
      metalImplantSpan: 0.80,
      tissueType: "mixed",
      enableRiskSimulation: true,
      inclusions: [],
    },
  },
  {
    id: "ankle_bony",
    label: "Região maleolar óssea",
    description: "Pouca gordura e músculo, osso muito superficial, maior risco de desconforto.",
    isCustom: false,
    config: {
      name: "Região maleolar óssea",
      description: "Pouca gordura e músculo, osso muito superficial, maior risco de desconforto.",
      skinThickness: 0.10,
      fatThickness: 0.05,
      muscleThickness: 0.20,
      boneDepth: 0.30,
      hasMetalImplant: false,
      tissueType: "soft",
      enableRiskSimulation: true,
      inclusions: [],
    },
  },
  {
    id: "custom",
    label: "Personalizado",
    description: "Permite ajustar manualmente espessuras de pele, gordura, músculo, osso e inclusões.",
    isCustom: true,
    config: {
      name: "Personalizado",
      description: "Configuração customizada pelo administrador",
      skinThickness: 0.15,
      fatThickness: 0.25,
      muscleThickness: 0.45,
      boneDepth: 0.75,
      hasMetalImplant: false,
      tissueType: "mixed",
      enableRiskSimulation: true,
      inclusions: [],
    },
  },
];

// Configuração padrão
export const defaultTissueConfig: TissueConfig = {
  id: 'default',
  name: "Antebraço Padrão",
  description: "Anatomia padrão de antebraço adulto saudável",
  skinThickness: 0.15,
  fatThickness: 0.25,
  muscleThickness: 0.60,
  boneDepth: 0.85,
  hasMetalImplant: false,
  tissueType: "muscular",
  enableRiskSimulation: true,
  inclusions: [],
};
