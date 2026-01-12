/**
 * TensFieldEngine - Motor de simulação para TENS com distância entre eletrodos
 * Modelo heurístico baseado em camadas teciduais para fins educativos
 */

import { TensMode } from "@/lib/tensSimulation";
import { TissueConfig } from "@/types/tissueConfig";

export type ElectrodeShape = "rectangular" | "circular";
export type ElectrodePlacement = "default" | "muscle_target" | "superficial" | "spread";

export interface ElectrodeConfig {
  distanceCm: number;           // 2-12 cm
  sizeCm: number;               // 2x2, 3x3, 4x4, 5x5 cm (lado do quadrado ou diâmetro)
  shape: ElectrodeShape;
  placement: ElectrodePlacement;
  // Posições normalizadas (0-1) para visualização
  anodePosition: [number, number, number];
  cathodePosition: [number, number, number];
}

export interface TensFieldParams {
  frequencyHz: number;          // 1-200 Hz
  pulseWidthUs: number;         // 50-400 µs
  intensitymA: number;          // 0-80 mA
  mode: TensMode;
  electrodes: ElectrodeConfig;
}

export interface TensFieldResult {
  // Campo elétrico
  E_peak_skin: number;          // V/cm na pele
  E_peak_muscle: number;        // V/cm no músculo
  fieldSpreadCm: number;        // Largura do campo

  // Região ativada
  activationDepthMm: number;    // Profundidade estimada de ativação
  activatedAreaCm2: number;     // Área ativada estimada
  sensoryActivation: number;    // 0-100 (ativação sensorial)
  motorActivation: number;      // 0-100 (ativação motora)

  // Conforto e risco
  comfortScore: number;         // 0-100 (100 = muito confortável)
  riskScore: number;            // 0-100 (0 = sem risco)
  riskLevel: "baixo" | "moderado" | "alto";

  // Mensagens educativas
  comfortMessage: string;
  distanceExplanation: string;
  riskMessages: string[];

  // Dados para visualização
  heatmapData: HeatmapPoint[];
  activationZone: ActivationZone;
}

export interface HeatmapPoint {
  x: number;      // 0-1 normalizado
  y: number;      // 0-1 normalizado (profundidade)
  intensity: number; // 0-1
}

export interface ActivationZone {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  depth: number;
}

// Condutividades relativas dos tecidos (S/m - valores simplificados)
const TISSUE_CONDUCTIVITY = {
  skin: 0.1,
  fat: 0.04,
  muscle: 0.4,
  bone: 0.02,
};

// Espessuras típicas em mm para referência
const TYPICAL_THICKNESS_MM = {
  skin: 2,
  fat_min: 2,
  fat_max: 40,
  muscle_min: 10,
  muscle_max: 60,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calcula a resistência equivalente do tecido entre os eletrodos
 */
function calculateTissueResistance(
  tissue: TissueConfig,
  electrodes: ElectrodeConfig
): number {
  const d = electrodes.distanceCm;
  const area = electrodes.shape === "circular" 
    ? Math.PI * (electrodes.sizeCm / 2) ** 2 
    : electrodes.sizeCm ** 2;

  // Modelo simplificado: R = rho * L / A, com rho composto
  const skinR = (1 / TISSUE_CONDUCTIVITY.skin) * tissue.skinThickness * 0.5;
  const fatR = (1 / TISSUE_CONDUCTIVITY.fat) * tissue.fatThickness * 0.8;
  const muscleR = (1 / TISSUE_CONDUCTIVITY.muscle) * tissue.muscleThickness * 0.3;

  // Resistência aumenta com distância, diminui com área do eletrodo
  const baseR = (skinR + fatR + muscleR) * 1000; // Em ohms
  const distanceFactor = 1 + (d - 4) * 0.1; // Referência 4 cm
  const areaFactor = Math.sqrt(4 / area); // Referência 2x2 cm

  return baseR * distanceFactor * areaFactor;
}

/**
 * Calcula o campo elétrico nas diferentes camadas
 */
function calculateElectricField(
  params: TensFieldParams,
  tissue: TissueConfig
): { E_skin: number; E_muscle: number; spread: number } {
  const { intensitymA, electrodes } = params;
  const d = electrodes.distanceCm;

  // Corrente em A
  const I = intensitymA / 1000;

  // Área do eletrodo em cm²
  const area = electrodes.shape === "circular" 
    ? Math.PI * (electrodes.sizeCm / 2) ** 2 
    : electrodes.sizeCm ** 2;

  // Densidade de corrente na superfície (A/cm²)
  const J_surface = I / area;

  // Campo elétrico aproximado (V/cm)
  // E = J / sigma, onde sigma é condutividade
  const E_skin = (J_surface / TISSUE_CONDUCTIVITY.skin) * 100;

  // Campo no músculo é atenuado pela camada de gordura
  const fatAttenuation = Math.exp(-tissue.fatThickness * 2);
  const E_muscle = E_skin * fatAttenuation * (TISSUE_CONDUCTIVITY.skin / TISSUE_CONDUCTIVITY.muscle);

  // Spread do campo aumenta com distância
  // Modelo simplificado: campo se espalha proporcionalmente à distância
  const spread = d * 0.7 + electrodes.sizeCm * 0.3;

  return { E_skin, E_muscle, spread };
}

/**
 * Calcula profundidade e área de ativação neural
 */
function calculateActivation(
  params: TensFieldParams,
  tissue: TissueConfig,
  E_muscle: number
): { depth: number; area: number; sensory: number; motor: number } {
  const { intensitymA, pulseWidthUs, frequencyHz, mode, electrodes } = params;
  const d = electrodes.distanceCm;

  // Normalizar parâmetros
  const intensityNorm = intensitymA / 80;
  const pulseNorm = (pulseWidthUs - 50) / 350;
  const freqNorm = frequencyHz / 200;

  // Profundidade base aumenta com distância e intensidade
  // Distância maior = campo mais profundo mas menos intenso na superfície
  const distanceEffect = 1 + (d - 4) * 0.15; // Referência 4 cm
  const baseDepth = (intensityNorm * 0.6 + pulseNorm * 0.4) * distanceEffect;

  // Atenuação pela gordura
  const fatPenalty = tissue.fatThickness * 0.5;
  const depthMm = clamp(baseDepth * 30 - fatPenalty * 10, 2, 50);

  // Área ativada aumenta com distância (campo mais espalhado)
  const baseArea = electrodes.sizeCm ** 2;
  const spreadFactor = 1 + (d - 4) * 0.2;
  const areaCm2 = baseArea * spreadFactor * (0.3 + intensityNorm * 0.7);

  // Ativação sensorial vs motora
  // Sensorial: favorece frequência alta, distância curta
  // Motora: favorece frequência baixa, distância média-longa, pulso largo
  let sensory = 0;
  let motor = 0;

  switch (mode) {
    case "convencional":
      sensory = 60 + freqNorm * 30 - (d / 12) * 20;
      motor = 20 + intensityNorm * 30;
      break;
    case "acupuntura":
      sensory = 40 + (1 - freqNorm) * 20;
      motor = 50 + intensityNorm * 40 + pulseNorm * 20;
      break;
    case "burst":
      sensory = 50 + freqNorm * 20;
      motor = 60 + intensityNorm * 30;
      break;
    case "modulado":
      sensory = 55 + freqNorm * 25;
      motor = 35 + intensityNorm * 25;
      break;
  }

  // Distância afeta distribuição sensorial/motora
  // Menor distância = mais superficial = mais sensorial
  // Maior distância = mais profundo = mais motor
  const distanceBias = (d - 4) / 8; // -0.25 a 1.0
  sensory = clamp(sensory - distanceBias * 15, 0, 100);
  motor = clamp(motor + distanceBias * 15, 0, 100);

  return {
    depth: depthMm,
    area: areaCm2,
    sensory: Math.round(sensory * intensityNorm),
    motor: Math.round(motor * intensityNorm),
  };
}

/**
 * Calcula conforto baseado em parâmetros e distância
 */
function calculateComfort(
  params: TensFieldParams,
  tissue: TissueConfig,
  E_skin: number
): { score: number; message: string } {
  const { intensitymA, pulseWidthUs, electrodes } = params;
  const d = electrodes.distanceCm;

  const intensityNorm = intensitymA / 80;
  const pulseNorm = (pulseWidthUs - 50) / 350;

  // Base de desconforto
  let discomfort = intensityNorm * 0.5 + pulseNorm * 0.3;

  // Distância curta = hotspot mais intenso = mais desconforto cutâneo
  if (d < 4) {
    discomfort += (4 - d) * 0.1;
  }

  // Eletrodo pequeno = maior densidade de corrente = mais desconforto
  if (electrodes.sizeCm < 3) {
    discomfort += (3 - electrodes.sizeCm) * 0.1;
  }

  // Pele fina aumenta sensibilidade
  if (tissue.skinThickness < 0.15) {
    discomfort += 0.1;
  }

  // Osso superficial pode causar desconforto
  if (tissue.boneDepth < 0.4 && intensityNorm > 0.5) {
    discomfort += 0.15;
  }

  const score = Math.round(clamp((1 - discomfort) * 100, 0, 100));

  let message = "";
  if (score >= 70) {
    message = "Estimulação confortável para a maioria dos pacientes.";
  } else if (score >= 50) {
    message = "Sensação intensa. Monitore o conforto do paciente.";
  } else if (score >= 30) {
    message = "Potencialmente desconfortável. Considere aumentar área do eletrodo ou distância.";
  } else {
    message = "Parâmetros intensos demais. Reduza intensidade ou aumente distância entre eletrodos.";
  }

  return { score, message };
}

/**
 * Calcula risco baseado em configuração
 */
function calculateRisk(
  params: TensFieldParams,
  tissue: TissueConfig,
  E_skin: number
): { score: number; level: "baixo" | "moderado" | "alto"; messages: string[] } {
  const { intensitymA, pulseWidthUs, frequencyHz, electrodes } = params;
  const d = electrodes.distanceCm;

  const intensityNorm = intensitymA / 80;
  const pulseNorm = (pulseWidthUs - 50) / 350;

  let riskScore = 0;
  const messages: string[] = [];

  // Risco 1: Implante metálico
  if (tissue.hasMetalImplant) {
    riskScore += 30 * intensityNorm;
    if (intensityNorm > 0.5) {
      messages.push("⚠️ Implante metálico: risco de aquecimento com alta intensidade.");
    }
  }

  // Risco 2: Distância muito curta + alta intensidade = queimadura
  if (d < 3 && intensityNorm > 0.6) {
    riskScore += 20;
    messages.push("⚡ Eletrodos muito próximos: concentração excessiva de corrente na pele.");
  }

  // Risco 3: Eletrodo pequeno + alta intensidade
  if (electrodes.sizeCm < 3 && intensitymA > 40) {
    riskScore += 15;
    messages.push("📐 Eletrodo pequeno com alta intensidade: aumente o tamanho do eletrodo.");
  }

  // Risco 4: Carga por pulso alta
  const chargePerPulse = intensitymA * pulseWidthUs / 1000;
  if (chargePerPulse > 25) {
    riskScore += 20;
    messages.push("⚡ Carga por pulso elevada. Monitore irritação cutânea.");
  }

  // Risco 5: Osso superficial
  if (tissue.boneDepth < 0.35 && intensityNorm > 0.6) {
    riskScore += 15;
    messages.push("🦴 Osso superficial: risco de desconforto periosteal.");
  }

  // Risco 6: Pele fina + alta intensidade
  if (tissue.skinThickness < 0.12 && intensityNorm > 0.5) {
    riskScore += 10;
    messages.push("🔥 Pele fina: maior risco de irritação. Use gel condutor adequado.");
  }

  riskScore = clamp(riskScore, 0, 100);

  let level: "baixo" | "moderado" | "alto";
  if (riskScore < 25) {
    level = "baixo";
    if (messages.length === 0) {
      messages.push("✅ Configuração segura dentro dos parâmetros recomendados.");
    }
  } else if (riskScore < 60) {
    level = "moderado";
  } else {
    level = "alto";
  }

  return { score: Math.round(riskScore), level, messages: messages.slice(0, 3) };
}

/**
 * Gera explicação educativa sobre o efeito da distância
 */
function generateDistanceExplanation(
  electrodes: ElectrodeConfig,
  activation: { depth: number; area: number }
): string {
  const d = electrodes.distanceCm;

  if (d < 4) {
    return `Distância curta (${d} cm): campo elétrico concentrado e superficial. Maior ativação sensorial cutânea, região ativada menor (${activation.area.toFixed(1)} cm²). Ideal para analgesia localizada.`;
  } else if (d < 8) {
    return `Distância média (${d} cm): boa distribuição do campo entre superfície e profundidade. Ativação balanceada sensorial/motora, profundidade ~${activation.depth.toFixed(0)} mm.`;
  } else {
    return `Distância longa (${d} cm): campo mais espalhado e profundo. Maior área ativada (${activation.area.toFixed(1)} cm²), pode alcançar fibras motoras mais profundas.`;
  }
}

/**
 * Gera dados do heatmap para visualização
 */
function generateHeatmapData(
  params: TensFieldParams,
  tissue: TissueConfig,
  E_skin: number,
  E_muscle: number
): HeatmapPoint[] {
  const points: HeatmapPoint[] = [];
  const d = params.electrodes.distanceCm;
  const intensityNorm = params.intensitymA / 80;

  // Centro horizontal baseado na distância
  const centerX = 0.5;

  // Gerar grade de pontos
  for (let x = 0; x < 20; x++) {
    for (let y = 0; y < 15; y++) {
      const px = x / 19;
      const py = y / 14;

      // Distância do centro horizontal
      const dx = Math.abs(px - centerX);

      // Atenuação com profundidade (y) e distância lateral
      const depthDecay = Math.exp(-py * 3);
      const lateralDecay = Math.exp(-dx * (10 / d));

      // Intensidade base
      let intensity = E_skin * depthDecay * lateralDecay * intensityNorm;

      // Normalizar
      intensity = clamp(intensity / 10, 0, 1);

      // Adicionar hotspot na interface tecidual se implante
      if (tissue.hasMetalImplant && tissue.metalImplantDepth) {
        const implantY = tissue.metalImplantDepth;
        if (Math.abs(py - implantY) < 0.1) {
          intensity = clamp(intensity * 1.5, 0, 1);
        }
      }

      points.push({ x: px, y: py, intensity });
    }
  }

  return points;
}

/**
 * Motor principal de simulação
 */
export function simulateTensField(
  params: TensFieldParams,
  tissue: TissueConfig
): TensFieldResult {
  // Calcular campo elétrico
  const { E_skin, E_muscle, spread } = calculateElectricField(params, tissue);

  // Calcular ativação
  const activation = calculateActivation(params, tissue, E_muscle);

  // Calcular conforto
  const comfort = calculateComfort(params, tissue, E_skin);

  // Calcular risco
  const risk = calculateRisk(params, tissue, E_skin);

  // Gerar explicação da distância
  const distanceExplanation = generateDistanceExplanation(params.electrodes, activation);

  // Gerar heatmap
  const heatmapData = generateHeatmapData(params, tissue, E_skin, E_muscle);

  // Zona de ativação
  const activationZone: ActivationZone = {
    centerX: 0.5,
    centerY: activation.depth / 100,
    radiusX: Math.sqrt(activation.area) / 20,
    radiusY: activation.depth / 200,
    depth: activation.depth,
  };

  return {
    E_peak_skin: E_skin,
    E_peak_muscle: E_muscle,
    fieldSpreadCm: spread,

    activationDepthMm: activation.depth,
    activatedAreaCm2: activation.area,
    sensoryActivation: activation.sensory,
    motorActivation: activation.motor,

    comfortScore: comfort.score,
    riskScore: risk.score,
    riskLevel: risk.level,

    comfortMessage: comfort.message,
    distanceExplanation,
    riskMessages: risk.messages,

    heatmapData,
    activationZone,
  };
}

/**
 * Configuração padrão de eletrodos
 */
export const defaultElectrodeConfig: ElectrodeConfig = {
  distanceCm: 6,
  sizeCm: 4,
  shape: "rectangular",
  placement: "default",
  anodePosition: [-3, 0, 0],
  cathodePosition: [3, 0, 0],
};

/**
 * Presets de posicionamento de eletrodos
 */
export const electrodePlacementPresets: Record<ElectrodePlacement, { label: string; description: string; distanceCm: number }> = {
  default: {
    label: "Padrão",
    description: "Posicionamento padrão sobre a região alvo",
    distanceCm: 6,
  },
  muscle_target: {
    label: "Sobre músculo alvo",
    description: "Eletrodos posicionados diretamente sobre o ventre muscular",
    distanceCm: 5,
  },
  superficial: {
    label: "Mais superficial",
    description: "Eletrodos próximos para ativação cutânea/sensorial",
    distanceCm: 3,
  },
  spread: {
    label: "Mais espalhado",
    description: "Maior distância para cobertura ampla e ativação profunda",
    distanceCm: 10,
  },
};
