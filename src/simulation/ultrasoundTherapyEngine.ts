/**
 * Heuristic Physics Engine for Therapeutic Ultrasound
 * 
 * Models:
 * - Attenuation with depth and frequency
 * - Beam distribution (Gaussian/conical) — shared with visual via ultrasoundTherapyPhysics
 * - Thermal effects (heating and dissipation)
 * - Tissue-specific properties
 */

import type { TherapeuticTransducerType } from "@/config/therapeuticTransducerDefinitions";
import type { TransducerBeamProfile, UltrasoundTherapyConfig } from "@/types/ultrasoundTherapyConfig";
import {
  buildAcousticProfile,
  getBeamGeometryFactor,
  getThermalBeamGeometryFactor,
  getBeamRadiusAtDepthCm,
  getEquivalentDiameterCm,
  getFocusedGain,
  getNearFieldLengthCm,
  resolveFocusDepthCm,
  type AcousticPhysicsInput,
} from "@/lib/ultrasoundTherapyPhysics";
import {
  buildUltrasoundInteractionMap,
  getDefaultInteractionMapResolution,
  type UltrasoundInteractionMap,
} from "@/lib/ultrasoundTherapyInteractionMap";
import {
  buildUltrasoundPhysiologyResponse,
  type UltrasoundPhysiologyResponse,
} from "@/lib/ultrasoundPhysiologyResponse";

export interface TissueLayer {
  type: "skin" | "fat" | "muscle" | "bone";
  depth: number; // cm from surface
  thickness: number; // cm
  attenuationCoeff: number; // dB/cm/MHz
  heatCapacity: number; // J/(kg·K) - relative factor
  perfusion: number; // relative heat dissipation rate
}

export interface UltrasoundTherapyResult {
  // Energy metrics
  powerW: number; // Total power (W)
  energyJ: number; // Total energy (J)
  doseJcm2: number; // Dose (J/cm²)
  
  // Depth penetration
  effectiveDepth: number; // cm
  penetrationDepth: number; // cm (where intensity drops to 10% of surface)
  
  // Thermal effects
  surfaceTemp: number; // °C (estimated, clamped to 37-50°C)
  targetTemp: number; // °C (at effective depth, clamped to 37-50°C)
  maxTemp: number; // °C (peak temperature, clamped to 37-50°C)
  maxTempDepth: number; // cm (where max temp occurs)
  
  // Thermal dose (CEM43 equivalent)
  thermalDose: number; // CEM43 equivalent (minutes at 43°C)
  cumulativeDose: number; // Accumulated thermal dose over time
  
  // Risk assessment
  risk: "low" | "medium" | "high";
  riskFactors: string[];
  
  // Beam characteristics
  beamWidth: number; // cm (at effective depth)
  treatedArea: number; // cm²
  
  // Bone interaction
  boneReflection: number; // Fraction of energy reflected at bone (0-1)
  periostealRisk: number; // Risk factor near bone (0-1)
  /** Profundidade onde o osso começa (cm), ou null se ausente */
  boneStartDepthCm: number | null;
  /** Distância do hotspot de temperatura até a interface óssea (cm) */
  hotspotBoneDistanceCm: number | null;
  /** Na camada mista: transdutor sobre região óssea; null se camada mista desligada */
  transducerOverBone: boolean | null;

  /** Perfil acústico compartilhado com o visual 3D */
  acousticProfile?: {
    equivalentDiameterCm: number;
    wavelengthCm: number;
    nearFieldCm: number;
    focusDepthCm: number;
    focusGain: number;
    beamProfile: string;
    transducerType: string;
    depthSamples: Array<{
      depthCm: number;
      relativeIntensity: number;
      tissueKind: string;
      heatSource: number;
    }>;
  };

  /** Mapa educacional de interação acústica nos tecidos */
  interactionMap?: UltrasoundInteractionMap;

  /** Resposta fisiológica educacional heurística */
  physiologyResponse?: UltrasoundPhysiologyResponse;

  /** Perfil de perfusão usado na simulação */
  tissuePerfusionProfile?: TissuePerfusionProfile;
  /** Fator de dissipação térmica (1 = normal; menor = retém mais calor) */
  perfusionDissipationFactor?: number;
}

export interface UltrasoundTherapyParams {
  frequency: number; // MHz
  intensity: number; // W/cm²
  era: number; // cm²
  mode: UltrasoundMode;
  dutyCycle: number; // %
  duration: number; // minutes
  coupling: "good" | "poor";
  movement: "stationary" | "scanning";
  scenario: "shoulder" | "knee" | "lumbar" | "forearm" | "custom";
  transducerType?: TherapeuticTransducerType;
  beamProfile?: TransducerBeamProfile;
  focusDepth?: number;
  customThicknesses?: {
    skin: number;
    fat: number;
    muscle: number;
    boneDepth?: number; // Profundidade (cm) onde o osso começa (modo custom)
  };
  mixedLayer?: {
    enabled: boolean;
    depth: number;
    division: number;
  };
  transducerPosition?: {
    x: number;
    y: number;
  };
  tissuePerfusionProfile?: TissuePerfusionProfile;
  /** Resolução do mapa de interação (default: desktop ou mobile) */
  interactionMapResolution?: { width: number; height: number };
}

type UltrasoundMode = "continuous" | "pulsed";

import {
  buildStackLayers,
  stackLayersToTissueLayers,
} from "@/lib/ultrasoundTherapyStack";
import { resolveMixedLayerConfig } from "@/lib/ultrasoundTherapyStackConfig";
import {
  getPerfusionProfileMultiplier,
  getPerfusionVisualProfile,
  type TissuePerfusionProfile,
} from "@/types/ultrasoundTherapyConfig";

/**
 * Atenuação tecidual linear I/I₀ (camadas em dB/cm/MHz)
 */
function getTissueAttenuationLinear(
  depth: number,
  frequency: number,
  layers: TissueLayer[],
): number {
  let totalAttenuation = 0;
  const frequencyFactor = 0.5 + (frequency - 1) * 0.8;

  for (const layer of layers) {
    if (depth <= layer.depth) break;
    const layerDepth = Math.min(depth - layer.depth, layer.thickness);
    totalAttenuation += layer.attenuationCoeff * frequencyFactor * layerDepth * 1.5;
  }

  return Math.pow(10, -totalAttenuation / 10);
}

function getLayerAtDepth(depth: number, layers: TissueLayer[]): TissueLayer {
  for (const layer of layers) {
    if (depth >= layer.depth && depth < layer.depth + layer.thickness) {
      return layer;
    }
  }
  return layers[layers.length - 1];
}

/**
 * Intensidade a uma profundidade — atenuação tecidual × geometria do feixe (compartilhada com visual)
 */
function calculateIntensityAtDepth(
  surfaceIntensity: number,
  depth: number,
  frequency: number,
  layers: TissueLayer[],
  acoustic: AcousticPhysicsInput,
): number {
  const tissueAtt = getTissueAttenuationLinear(depth, frequency, layers);
  const beamGeo = getThermalBeamGeometryFactor(depth, acoustic);
  return surfaceIntensity * tissueAtt * beamGeo;
}

/**
 * Calculate thermal effects at a specific depth with realistic temperature ranges and temporal evolution
 * V3: Properly separates surface vs target calculations
 */
function calculateThermalEffectsAtDepth(
  surfaceIntensity: number,
  depth: number,
  layers: TissueLayer[],
  frequency: number,
  duration: number,
  dutyCycle: number,
  movement: "stationary" | "scanning",
  coupling: "good" | "poor",
  acoustic: AcousticPhysicsInput,
  isSurface: boolean = false,
  perfusionMultiplier: number = 1.0,
  perfusionHeatRetention: number = 1.0,
): {
  temp: number; 
  thermalDose: number;
} {
  const currentLayer = getLayerAtDepth(depth, layers);
  
  const intensityAtDepth = isSurface 
    ? surfaceIntensity
    : calculateIntensityAtDepth(surfaceIntensity, depth, frequency, layers, acoustic);
  
  // Effective intensity considering duty cycle
  const effectiveIntensity = intensityAtDepth * (dutyCycle / 100);
  
  // Movement reduces peak heating (distributes energy over larger area)
  // For scanning: energy is spread over ~3x the area
  const movementFactor = movement === "scanning" ? 0.4 : 1.0;
  
  // Coupling affects surface heating differently
  // Poor coupling: more energy lost at surface (heats surface more), less reaches target
  let couplingFactor = 1.0;
  if (isSurface) {
    couplingFactor = coupling === "good" ? 1.0 : 1.4; // Poor coupling = more surface heating
  } else {
    couplingFactor = coupling === "good" ? 1.0 : 0.85; // Poor coupling = less reaches target
  }
  
  // V5: More realistic thermal calculation
  // Heat generation rate (W/cm³) - simplified bioheat equation
  // Q = alpha * I, where alpha is absorption coefficient
  const absorptionCoeff = currentLayer.attenuationCoeff * 0.15; // ~15% of attenuation is absorption (more realistic)
  const heatGenRate = absorptionCoeff * effectiveIntensity * movementFactor * couplingFactor; // W/cm³
  
  // Heat dissipation rate (W/cm³) - depends on perfusion
  // Perfusion removes heat: Q_perf = rho * c * w * (T - T_blood)
  const rho = 1000; // kg/m³ (water density)
  const c = 4180; // J/(kg·K) (specific heat)
  const w = currentLayer.perfusion * 0.0008 * perfusionMultiplier;
  const T_blood = 37; // °C
  
  // Steady-state temperature (simplified)
  // At steady state: Q_gen = Q_perf
  // heatGenRate = rho * c * w * (T - T_blood)
  // T = T_blood + heatGenRate / (rho * c * w)
  const steadyStateTemp = T_blood + (heatGenRate * 1000) / (rho * c * w + 0.001); // +0.001 to avoid division by zero
  
  // V5: More realistic temporal evolution
  // Temporal evolution (exponential approach to steady state)
  // T(t) = T_blood + (T_steady - T_blood) * (1 - exp(-t/tau))
  // tau = thermal time constant (depends on tissue properties)
  const tau = 180 + (currentLayer.heatCapacity * 40); // seconds - longer time constant for realism (3-5 min)
  const timeSec = duration * 60;
  
  // V5: Temperature rise is more gradual and realistic
  // For short durations, temperature rises slowly
  // For long durations, approaches steady state
  let tempRise = (steadyStateTemp - T_blood) * (1 - Math.exp(-timeSec / tau));
  
  // V5: Scale by intensity and duration more realistically
  // Temperature rise should be proportional to intensity * duration, but with limits
  // Typical therapeutic: 1 W/cm² for 5-10 min = ~2-3°C rise
  // Higher intensity or longer duration = more heating
  const intensityFactor = Math.min(2.0, effectiveIntensity * 0.8); // Scale by intensity (1 W/cm² = 0.8x, 2 W/cm² = 1.6x)
  const durationFactor = Math.min(1.5, 0.3 + (duration / 10) * 0.4); // Scale by duration (5 min = 0.5x, 10 min = 0.7x, 15 min = 0.9x)
  
  tempRise = tempRise * intensityFactor * durationFactor * perfusionHeatRetention;
  
  // Base temperature
  const baseTemp = 37; // °C
  
  // V5: More realistic temperature range (37-48°C for therapy)
  // Typical therapeutic ultrasound: 38-43°C
  // Higher intensities/longer durations: up to 45-48°C (risk zone)
  // Clamp temperatures to realistic therapeutic range
  const temp = Math.min(48, Math.max(37, baseTemp + tempRise));
  
  // Calculate thermal dose (CEM43 equivalent)
  // CEM43 = t * R^(43-T), where R = 0.5 for T > 43°C, R = 0.25 for T < 43°C
  const R = temp > 43 ? 0.5 : 0.25;
  const thermalDose = duration * Math.pow(R, Math.max(0, 43 - temp));
  
  return {
    temp,
    thermalDose,
  };
}

/**
 * Main simulation function
 */
export function simulateUltrasoundTherapy(
  params: UltrasoundTherapyParams
): UltrasoundTherapyResult {
  const {
    frequency,
    intensity,
    era,
    mode,
    dutyCycle,
    duration,
    coupling,
    movement,
    scenario,
    transducerType = "planar_circular",
    beamProfile = "planar",
    focusDepth,
  } = params;

  const resolvedMixedLayer = resolveMixedLayerConfig(
    scenario,
    params.customThicknesses,
    params.mixedLayer,
  );

  const focusDepthCm = resolveFocusDepthCm(
    beamProfile === "focused" ? focusDepth : undefined,
    frequency,
    beamProfile,
    transducerType,
  );
  const acousticInput: AcousticPhysicsInput = {
    frequencyMHz: frequency,
    eraCm2: era,
    transducerType,
    beamProfile,
    focusDepthCm,
  };

  const perfusionProfile = params.tissuePerfusionProfile ?? "normal";
  const perfusionVisual = getPerfusionVisualProfile(perfusionProfile);
  const perfusionMultiplier = perfusionVisual.multiplier;
  const perfusionHeatRetention = perfusionVisual.heatRetention;
  
  // Coupling efficiency
  const couplingEfficiency = coupling === "good" ? 0.95 : 0.7;
  const effectiveIntensity = intensity * couplingEfficiency;
  
  // Duty cycle
  const effectiveDuty = mode === "continuous" ? 1.0 : dutyCycle / 100;
  
  // Energy calculations
  const powerW = effectiveIntensity * era;
  const timeSec = duration * 60;
  const energyJ = powerW * timeSec * effectiveDuty;
  const doseJcm2 = effectiveIntensity * timeSec * effectiveDuty;
  
  // Get tissue layers — STACK model (boneDepth = início do osso)
  const layers = stackLayersToTissueLayers(
    buildStackLayers(scenario, params.customThicknesses),
  ) as TissueLayer[];
  
  // Calculate penetration depth (where intensity drops to 10% of surface)
  let penetrationDepth = 0;
  for (let d = 0; d < 10; d += 0.1) {
    const intensityAtDepth = calculateIntensityAtDepth(
      effectiveIntensity,
      d,
      frequency,
      layers,
      acousticInput,
    );
    if (intensityAtDepth < effectiveIntensity * 0.1) {
      penetrationDepth = d;
      break;
    }
  }
  
  // Effective depth (where 50% intensity remains) - typical therapeutic target
  let effectiveDepth = 0;
  for (let d = 0; d < 10; d += 0.1) {
    const intensityAtDepth = calculateIntensityAtDepth(
      effectiveIntensity,
      d,
      frequency,
      layers,
      acousticInput,
    );
    if (intensityAtDepth < effectiveIntensity * 0.5) {
      effectiveDepth = d;
      break;
    }
  }

  const equivalentDiameterCm = getEquivalentDiameterCm(era, transducerType);
  const nearFieldLength = getNearFieldLengthCm(
    equivalentDiameterCm,
    frequency,
    transducerType,
  );

  const beamRadiusAtEffective = getBeamRadiusAtDepthCm(effectiveDepth, acousticInput);
  const beamWidth = beamRadiusAtEffective * 2;
  
  // Calculate treated area considering movement
  let treatedArea: number;
  if (movement === "scanning") {
    // Scanning movement: energy is distributed over a larger area
    // Assume scanning covers ~3x the beam area in a pattern
    const baseArea = Math.PI * Math.pow(beamWidth / 2, 2);
    treatedArea = baseArea * 2.5; // Larger area when scanning
  } else {
    // Stationary: energy concentrated in beam area
    treatedArea = Math.PI * Math.pow(beamWidth / 2, 2);
  }
  
  // Surface thermal effects (at 0.05 cm - just below skin surface)
  const surfaceThermal = calculateThermalEffectsAtDepth(
    effectiveIntensity,
    0.05,
    layers,
    frequency,
    duration,
    effectiveDuty * 100,
    movement,
    coupling,
    acousticInput,
    true,
    perfusionMultiplier,
    perfusionHeatRetention,
  );
  
  // Target thermal effects (at effective depth - therapeutic target)
  const targetThermal = calculateThermalEffectsAtDepth(
    effectiveIntensity,
    effectiveDepth,
    layers,
    frequency,
    duration,
    effectiveDuty * 100,
    movement,
    coupling,
    acousticInput,
    false,
    perfusionMultiplier,
    perfusionHeatRetention,
  );
  
  // Scan through depths to find maximum temperature
  let maxTemp = surfaceThermal.temp;
  let maxTempDepth = 0.05;
  let maxThermalDose = surfaceThermal.thermalDose;
  
  const scanMaxDepth = Math.max(penetrationDepth, focusDepthCm + 1, nearFieldLength + 0.5, 5);
  for (let d = 0.1; d < Math.min(scanMaxDepth, 6); d += 0.1) {
    const thermalAtDepth = calculateThermalEffectsAtDepth(
      effectiveIntensity,
      d,
      layers,
      frequency,
      duration,
      effectiveDuty * 100,
      movement,
      coupling,
      acousticInput,
      false,
      perfusionMultiplier,
      perfusionHeatRetention,
    );
    
    if (thermalAtDepth.temp > maxTemp) {
      maxTemp = thermalAtDepth.temp;
      maxTempDepth = d;
      maxThermalDose = thermalAtDepth.thermalDose;
    }
  }
  
  // Also check target depth
  if (targetThermal.temp > maxTemp) {
    maxTemp = targetThermal.temp;
    maxTempDepth = effectiveDepth;
    maxThermalDose = targetThermal.thermalDose;
  }
  
  const thermal = {
    temp: targetThermal.temp,
    maxTemp,
    maxTempDepth,
    thermalDose: maxThermalDose,
  };
  
  // V5: Check for bone interaction (including mixed layer)
  let boneReflection = 0;
  let periostealRisk = 0;
  const boneLayer = layers.find((l) => l.type === "bone");
  const boneStartDepthCm =
    resolvedMixedLayer?.depth ?? boneLayer?.depth ?? null;
  let hotspotBoneDistanceCm: number | null = null;

  const mixedLayerEnabled = resolvedMixedLayer != null;
  let transducerOverBone: boolean | null = null;
  let isOverBone = false;
  if (mixedLayerEnabled && params.transducerPosition) {
    const division = resolvedMixedLayer.division / 100;
    const boundaryX = (division - 0.5) * 2;
    isOverBone = params.transducerPosition.x > boundaryX;
    transducerOverBone = isOverBone;
  }

  const boneClinicallyRelevant =
    boneStartDepthCm != null && (!mixedLayerEnabled || isOverBone);

  if (boneClinicallyRelevant && boneStartDepthCm != null) {
    const boneDepth = boneStartDepthCm;
    const intensityAtBone = calculateIntensityAtDepth(
      effectiveIntensity,
      boneDepth,
      frequency,
      layers,
      acousticInput,
    );

    if (intensityAtBone > effectiveIntensity * 0.08) {
      const reflectionMultiplier = isOverBone ? 1.25 : 1.0;
      // R = ((Z_osso − Z_músculo) / (Z_osso + Z_músculo))² ≈ 0,41
      const impedanceReflection = ((7.8 - 1.65) / (7.8 + 1.65)) ** 2;
      boneReflection = Math.min(
        1,
        (impedanceReflection * 0.92 +
          (intensityAtBone / effectiveIntensity) * 0.22) *
          reflectionMultiplier,
      );

      hotspotBoneDistanceCm = Math.abs(thermal.maxTempDepth - boneDepth);
      const proximityWindow = 1.0;
      const proximity = Math.max(0, Math.min(1, 1 - hotspotBoneDistanceCm / proximityWindow));

      if (proximity > 0.04) {
        const thermalStress = Math.max(0, Math.min(1, (thermal.maxTemp - 38) / 10));
        const boneEnergy = Math.max(0, Math.min(1, intensityAtBone / effectiveIntensity));
        const movementMitigation = movement === "scanning" ? 0.5 : 1.0;
        const frequencyFactor = frequency >= 2.5 ? 1.08 : frequency <= 1.5 ? 0.92 : 1.0;

        periostealRisk =
          proximity *
          boneEnergy *
          (0.28 + thermalStress * 0.72) *
          movementMitigation *
          frequencyFactor;
        periostealRisk = Math.min(1, periostealRisk);
      }
    }
  } else if (mixedLayerEnabled && boneStartDepthCm != null && !isOverBone) {
    boneReflection = 0.04;
    periostealRisk = 0;
    hotspotBoneDistanceCm = Math.abs(thermal.maxTempDepth - boneStartDepthCm);
  }
  
  // Cumulative thermal dose (simplified - accumulates over time)
  const cumulativeDose = thermal.thermalDose + surfaceThermal.thermalDose * 0.3;
  
  // Risk assessment - V3: Separate thermal risk and periosteal risk, more coherent
  const riskFactors: string[] = [];
  
  // Thermal risk (based on temperature and CEM43)
  let thermalRisk: "low" | "medium" | "high" = "low";
  
  // Temperature-based thermal risk
  if (thermal.maxTemp > 48) {
    thermalRisk = "high";
    riskFactors.push("Temperatura muito alta (>48°C) - risco de queimadura");
  } else if (thermal.maxTemp > 45) {
    thermalRisk = "high";
    riskFactors.push("Temperatura alta (>45°C) - risco elevado");
  } else if (thermal.maxTemp > 43) {
    thermalRisk = "medium";
    riskFactors.push("Temperatura elevada (>43°C) - monitorar");
  } else if (thermal.maxTemp > 42) {
    // Only medium if other factors present
    if (cumulativeDose > 30 || duration > 15) {
      thermalRisk = "medium";
      riskFactors.push("Temperatura moderada (>42°C) com dose/duração elevada");
    }
  }
  
  // Thermal dose risk (CEM43 > 120 min = risk of thermal damage)
  if (cumulativeDose > 120) {
    thermalRisk = "high";
    riskFactors.push(`Dose térmica acumulada muito alta (${cumulativeDose.toFixed(0)} min eq. 43°C) - risco de dano`);
  } else if (cumulativeDose > 60) {
    if (thermalRisk === "low") thermalRisk = "medium";
    riskFactors.push(`Dose térmica acumulada moderada (${cumulativeDose.toFixed(0)} min eq. 43°C)`);
  } else if (cumulativeDose < 5 && thermal.maxTemp < 43) {
    // Very low dose and safe temperature = low risk
    thermalRisk = "low";
  }
  
  // Periosteal risk (separate from thermal risk)
  let periostealRiskLevel: "low" | "medium" | "high" = "low";
  if (periostealRisk > 0.65) {
    periostealRiskLevel = "high";
    const distHint =
      hotspotBoneDistanceCm != null
        ? ` — hotspot a ${hotspotBoneDistanceCm.toFixed(1)} cm do osso`
        : "";
    riskFactors.push(
      `Risco periosteal muito alto (${(periostealRisk * 100).toFixed(0)}%)${distHint}`,
    );
  } else if (periostealRisk > 0.4) {
    periostealRiskLevel = "high";
    const distHint =
      hotspotBoneDistanceCm != null
        ? ` — hotspot a ${hotspotBoneDistanceCm.toFixed(1)} cm do osso`
        : "";
    riskFactors.push(`Risco periosteal alto (${(periostealRisk * 100).toFixed(0)}%)${distHint}`);
  } else if (periostealRisk > 0.22) {
    periostealRiskLevel = "medium";
    riskFactors.push(`Risco periosteal moderado (${(periostealRisk * 100).toFixed(0)}%)`);
  }
  
  // Overall risk = max(thermal risk, periosteal risk)
  let risk: "low" | "medium" | "high" = thermalRisk;
  if (periostealRiskLevel === "high") {
    risk = "high";
  } else if (periostealRiskLevel === "medium" && thermalRisk === "low") {
    risk = "medium";
  }
  // Ensure high risk is captured
  if (thermalRisk === "high") {
    risk = "high";
  }
  
  // Additional contextual factors (only if risk is still low)
  if (risk === "low") {
    if (params.tissuePerfusionProfile === "baixa_circulacao" && thermal.maxTemp > 41) {
      risk = "medium";
      riskFactors.push("Baixa circulação local reduz dissipação de calor");
    } else if (doseJcm2 > 20 && duration > 10) {
      risk = "medium";
      riskFactors.push("Dose alta (>20 J/cm²) por tempo prolongado");
    } else if (intensity > 2.0 && movement === "stationary") {
      risk = "medium";
      riskFactors.push("Intensidade alta (>2.0 W/cm²) com transdutor parado");
    } else if (coupling === "poor" && surfaceThermal.temp > 42) {
      risk = "medium";
      riskFactors.push("Acoplamento ruim com aquecimento superficial elevado");
    }
  }
  
  const acousticProfile = buildAcousticProfile({
    ...acousticInput,
    maxDepthCm: Math.max(6, penetrationDepth + 0.5, focusDepthCm + 1),
    stepCm: 0.2,
    getTissueAttenuationLinear: (depthCm) =>
      getTissueAttenuationLinear(depthCm, frequency, layers),
    getTissueKindAtDepth: (depthCm) => getLayerAtDepth(depthCm, layers).type,
    getAbsorptionCoeff: (depthCm) =>
      getLayerAtDepth(depthCm, layers).attenuationCoeff * 0.15,
  });

  const interactionMap = buildUltrasoundInteractionMap({
    scenario,
    customThicknesses: params.customThicknesses,
    mixedLayer: resolvedMixedLayer,
    frequencyMHz: frequency,
    intensity,
    eraCm2: era,
    transducerType,
    beamProfile,
    focusDepthCm,
    mode,
    dutyCycle,
    coupling,
    movement,
    surfaceTemp: Math.min(50, Math.max(37, surfaceThermal.temp)),
    maxTemp: Math.min(50, Math.max(37, thermal.maxTemp)),
    maxTempDepth: thermal.maxTempDepth,
    thermalDose: thermal.thermalDose,
    cumulativeDose,
    boneReflection,
    acoustic: acousticInput,
    resolution: params.interactionMapResolution ?? getDefaultInteractionMapResolution(),
  });

  const simulationResultBase = {
    powerW,
    energyJ,
    doseJcm2,
    effectiveDepth,
    penetrationDepth,
    surfaceTemp: Math.min(50, Math.max(37, surfaceThermal.temp)),
    targetTemp: Math.min(50, Math.max(37, thermal.temp)),
    maxTemp: Math.min(50, Math.max(37, thermal.maxTemp)),
    maxTempDepth: thermal.maxTempDepth,
    thermalDose: thermal.thermalDose,
    cumulativeDose,
    risk,
    riskFactors,
    beamWidth,
    treatedArea,
    boneReflection,
    periostealRisk,
    boneStartDepthCm,
    hotspotBoneDistanceCm,
    transducerOverBone,
    acousticProfile: {
      ...acousticProfile,
      focusGain: getFocusedGain(
        focusDepthCm,
        focusDepthCm,
        beamProfile,
        transducerType,
      ),
    },
    interactionMap,
  };

  const physiologyConfig: UltrasoundTherapyConfig = {
    scenario,
    customThicknesses: params.customThicknesses,
    transducerType,
    beamProfile,
    focusDepth: focusDepthCm,
    mode,
    dutyCycle,
    intensity,
    duration,
    coupling,
    movement,
    era,
    frequency,
    tissuePerfusionProfile: params.tissuePerfusionProfile ?? "normal",
    enabledControls: { scenario: true, frequency: true, era: true, mode: true, dutyCycle: true, intensity: true, duration: true, coupling: true, movement: true, tissuePerfusionProfile: true },
    ranges: { frequency: { min: 1, max: 3 }, era: { min: 2.5, max: 6.5 }, intensity: { min: 0.1, max: 5 }, duration: { min: 1, max: 30 }, dutyCycle: { min: 10, max: 100 } },
  };

  const physiologyResponse = buildUltrasoundPhysiologyResponse({
    result: simulationResultBase,
    interactionMap,
    config: physiologyConfig,
  });

  return {
    ...simulationResultBase,
    physiologyResponse,
    tissuePerfusionProfile: perfusionProfile,
    perfusionDissipationFactor: perfusionMultiplier,
  };
}
