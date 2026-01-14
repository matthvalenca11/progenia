/**
 * TensFieldEngine - Motor de simulação para TENS com distância entre eletrodos
 * Modelo heurístico baseado em camadas teciduais para fins educativos
 */

import { TensMode } from "@/lib/tensSimulation";
import { TissueConfig } from "@/types/tissueConfig";

export type ElectrodeShape = "circular";
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
  
  // Efeitos de implante metálico e inclusões
  metalHotspot?: { intensity: number; depth: number; span: number };
  thermalHotspot?: { intensity: number; depth: number };
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
  // Sempre usar formato circular
  const area = Math.PI * (electrodes.sizeCm / 2) ** 2;

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
 * Agora considera implantes metálicos e inclusões anatômicas
 */
function calculateElectricField(
  params: TensFieldParams,
  tissue: TissueConfig
): { E_skin: number; E_muscle: number; spread: number; metalHotspot?: { intensity: number; depth: number; span: number } } {
  const { intensitymA, electrodes } = params;
  const d = electrodes.distanceCm;

  // Corrente em A
  const I = intensitymA / 1000;

  // Área do eletrodo em cm²
  // Sempre usar formato circular
  const area = Math.PI * (electrodes.sizeCm / 2) ** 2;

  // Densidade de corrente na superfície (A/cm²)
  const J_surface = I / area;

  // Campo elétrico aproximado (V/cm)
  // E = J / sigma, onde sigma é condutividade
  let E_skin = (J_surface / TISSUE_CONDUCTIVITY.skin) * 100;

  // Campo no músculo é atenuado pela camada de gordura
  const fatAttenuation = Math.exp(-tissue.fatThickness * 2);
  let E_muscle = E_skin * fatAttenuation * (TISSUE_CONDUCTIVITY.skin / TISSUE_CONDUCTIVITY.muscle);

  // EFEITO DO IMPLANTE METÁLICO: alta condutividade distorce o campo
  let metalHotspot: { intensity: number; depth: number; span: number } | undefined;
  if (tissue.hasMetalImplant && tissue.metalImplantDepth !== undefined && tissue.metalImplantSpan !== undefined) {
    const implantDepth = tissue.metalImplantDepth;
    const implantSpan = tissue.metalImplantSpan;
    
    // Metal tem condutividade ~100x maior que tecido (aproximação)
    const METAL_CONDUCTIVITY = 40; // vs 0.4 do músculo = 100x
    
    // Campo elétrico concentrado no implante (efeito de "short circuit")
    // Intensidade do hotspot baseada na profundidade e extensão
    const depthFactor = 1 - Math.abs(implantDepth - 0.5) * 0.5; // Mais intenso quando central
    const spanFactor = implantSpan; // Maior extensão = maior área afetada
    
    // Intensidade do hotspot aumenta com intensidade da corrente
    const hotspotIntensity = (intensitymA / 80) * depthFactor * spanFactor * 2.5; // Multiplicador para visibilidade
    
    // Campo elétrico local no implante (muito maior devido à condutividade)
    const E_metal = E_muscle * (METAL_CONDUCTIVITY / TISSUE_CONDUCTIVITY.muscle) * depthFactor;
    
    // O campo ao redor do implante é distorcido (concentrado)
    E_muscle *= (1 + hotspotIntensity * 0.3); // Aumenta campo geral devido à distorção
    
    metalHotspot = {
      intensity: Math.min(1, hotspotIntensity),
      depth: implantDepth,
      span: implantSpan
    };
  }

  // EFEITO DAS INCLUSÕES ANATÔMICAS
  if (tissue.inclusions && tissue.inclusions.length > 0) {
    let inclusionEffect = 1.0;
    
    tissue.inclusions.forEach(inclusion => {
      const inclusionDepth = inclusion.depth;
      const inclusionSpan = inclusion.span;
      
      // Efeito baseado no tipo de inclusão
      if (inclusion.type === 'bone') {
        // Osso = barreira elétrica (baixa condutividade)
        // Reduz campo elétrico na região
        const boneResistance = 1 + (inclusionSpan * 0.4); // Até 40% de redução
        inclusionEffect *= (1 / boneResistance);
      } else if (inclusion.type === 'muscle') {
        // Músculo = boa condução
        // Aumenta campo localmente
        inclusionEffect *= (1 + inclusionSpan * 0.2);
      } else if (inclusion.type === 'fat') {
        // Gordura = baixa condução
        // Reduz campo localmente
        inclusionEffect *= (1 - inclusionSpan * 0.3);
      } else if (inclusion.type === 'metal_implant') {
        // Implante metálico nas inclusões (mesmo efeito do hasMetalImplant)
        const depthFactor = 1 - Math.abs(inclusionDepth - 0.5) * 0.5;
        const spanFactor = inclusionSpan;
        const hotspotIntensity = (intensitymA / 80) * depthFactor * spanFactor * 2.5;
        inclusionEffect *= (1 + hotspotIntensity * 0.4);
        
        // Adicionar ao hotspot se não existir ou combinar
        if (!metalHotspot) {
          metalHotspot = {
            intensity: Math.min(1, hotspotIntensity),
            depth: inclusionDepth,
            span: inclusionSpan
          };
        } else {
          // Combinar hotspots se houver múltiplos
          metalHotspot.intensity = Math.min(1, metalHotspot.intensity + hotspotIntensity * 0.5);
        }
      }
    });
    
    // Aplicar efeito das inclusões ao campo muscular
    E_muscle *= inclusionEffect;
  }

  // Spread do campo aumenta com distância
  // Modelo simplificado: campo se espalha proporcionalmente à distância
  let spread = d * 0.7 + electrodes.sizeCm * 0.3;
  
  // Implante metálico distorce o spread (concentra o campo)
  if (tissue.hasMetalImplant && tissue.metalImplantSpan !== undefined) {
    spread *= (1 - tissue.metalImplantSpan * 0.2); // Reduz spread quando há implante
  }

  return { E_skin, E_muscle, spread, metalHotspot };
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
 * Agora considera profundidade e extensão do implante para cálculo de hotspot térmico
 */
function calculateRisk(
  params: TensFieldParams,
  tissue: TissueConfig,
  E_skin: number
): { score: number; level: "baixo" | "moderado" | "alto"; messages: string[]; thermalHotspot?: { intensity: number; depth: number } } {
  const { intensitymA, pulseWidthUs, frequencyHz, electrodes } = params;
  const d = electrodes.distanceCm;

  const intensityNorm = intensitymA / 80;
  const pulseNorm = (pulseWidthUs - 50) / 350;

  let riskScore = 0;
  const messages: string[] = [];
  let thermalHotspot: { intensity: number; depth: number } | undefined;

  // Risco 1: Implante metálico - AGORA CONSIDERA PROFUNDIDADE E EXTENSÃO
  if (tissue.hasMetalImplant && tissue.metalImplantDepth !== undefined && tissue.metalImplantSpan !== undefined) {
    const implantDepth = tissue.metalImplantDepth;
    const implantSpan = tissue.metalImplantSpan;
    
    // Risco base aumenta com intensidade
    let implantRisk = 30 * intensityNorm;
    
    // Profundidade afeta risco:
    // - Implante superficial (0.2-0.4) = maior risco de queimadura cutânea
    // - Implante profundo (0.6-0.8) = menor risco superficial, mas pode afetar tecido profundo
    if (implantDepth < 0.4) {
      implantRisk += 20 * intensityNorm; // Risco adicional se superficial
      messages.push(`⚠️ Implante metálico superficial (${Math.round(implantDepth * 100)}%): risco elevado de aquecimento cutâneo.`);
    } else if (implantDepth > 0.6) {
      implantRisk += 15 * intensityNorm; // Risco moderado se profundo
      messages.push(`⚠️ Implante metálico profundo (${Math.round(implantDepth * 100)}%): possível aquecimento em tecido profundo.`);
    } else {
      messages.push(`⚠️ Implante metálico em profundidade intermediária: monitore aquecimento local.`);
    }
    
    // Extensão afeta área de risco
    // Maior extensão = maior área afetada = maior risco térmico total
    implantRisk *= (1 + implantSpan * 0.5); // Até 50% de aumento com maior extensão
    
    // Calcular intensidade do hotspot térmico
    // Baseado em: intensidade da corrente, profundidade, extensão, e largura de pulso
    const thermalIntensity = intensityNorm * pulseNorm * implantSpan * (1 + (1 - implantDepth) * 0.5);
    
    riskScore += implantRisk;
    
    if (thermalIntensity > 0.3) {
      thermalHotspot = {
        intensity: Math.min(1, thermalIntensity),
        depth: implantDepth
      };
    }
  }
  
  // Verificar inclusões do tipo metal_implant também
  if (tissue.inclusions) {
    tissue.inclusions.forEach(inclusion => {
      if (inclusion.type === 'metal_implant') {
        const inclusionRisk = 25 * intensityNorm * inclusion.span;
        riskScore += inclusionRisk;
        
        const thermalIntensity = intensityNorm * pulseNorm * inclusion.span * (1 + (1 - inclusion.depth) * 0.5);
        if (thermalIntensity > 0.3) {
          if (!thermalHotspot || thermalIntensity > thermalHotspot.intensity) {
            thermalHotspot = {
              intensity: Math.min(1, thermalIntensity),
              depth: inclusion.depth
            };
          }
        }
      }
    });
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

  return { 
    score: Math.round(riskScore), 
    level, 
    messages: messages.slice(0, 3),
    thermalHotspot 
  };
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
  // Calcular campo elétrico (agora retorna metalHotspot)
  const { E_skin, E_muscle, spread, metalHotspot } = calculateElectricField(params, tissue);

  // Calcular ativação
  const activation = calculateActivation(params, tissue, E_muscle);

  // Calcular conforto
  const comfort = calculateComfort(params, tissue, E_skin);

  // Calcular risco (agora retorna thermalHotspot)
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
    
    // Novos campos para visualização de implantes e inclusões
    metalHotspot,
    thermalHotspot: risk.thermalHotspot,
  };
}

/**
 * Configuração padrão de eletrodos
 */
export const defaultElectrodeConfig: ElectrodeConfig = {
  distanceCm: 6,
  sizeCm: 4,
  shape: "circular",
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
