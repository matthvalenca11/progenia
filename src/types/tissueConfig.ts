export type TissueType = "soft" | "muscular" | "mixed";

export interface TissueConfig {
  id: string;
  name: string;
  description?: string;
  
  // Espessura relativa das camadas (0-1 normalizadas)
  skinThickness: number;         // 0-1
  fatThickness: number;          // 0-1
  muscleThickness: number;       // 0-1
  boneDepth: number;             // 0-1 (profundidade em relação à superfície)
  
  // Implantes metálicos
  hasMetalImplant: boolean;
  metalImplantDepth?: number;    // 0-1 (profundidade da prótese)
  metalImplantSpan?: number;     // 0-1 (quanto se estende entre os eletrodos)
  
  tissueType: TissueType;
  
  // Flags de risco
  enableRiskSimulation: boolean;
  
  created_at?: string;
  updated_at?: string;
}

export interface RiskResult {
  riskScore: number;            // 0-100
  riskLevel: "baixo" | "moderado" | "alto";
  messages: string[];           // textos sobre risco
}

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
};
