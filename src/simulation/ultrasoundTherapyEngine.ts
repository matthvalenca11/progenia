/**
 * Heuristic Physics Engine for Therapeutic Ultrasound
 * 
 * Models:
 * - Attenuation with depth and frequency
 * - Beam distribution (Gaussian/conical)
 * - Thermal effects (heating and dissipation)
 * - Tissue-specific properties
 */

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
  customThicknesses?: {
    skin: number;
    fat: number;
    muscle: number;
    boneThickness?: number; // Opcional: espessura do osso (STACK model)
  };
}

type UltrasoundMode = "continuous" | "pulsed";

// Tissue properties (simplified)
const TISSUE_PROPERTIES: Record<string, Partial<TissueLayer>> = {
  skin: {
    attenuationCoeff: 0.5,
    heatCapacity: 0.8,
    perfusion: 1.0,
  },
  fat: {
    attenuationCoeff: 0.3,
    heatCapacity: 0.6,
    perfusion: 0.3, // Lower perfusion = retains heat more
  },
  muscle: {
    attenuationCoeff: 0.7,
    heatCapacity: 1.0,
    perfusion: 1.5, // Higher perfusion = dissipates heat faster
  },
  bone: {
    attenuationCoeff: 2.0,
    heatCapacity: 0.5,
    perfusion: 0.2,
  },
};

// Default tissue layers by scenario
const SCENARIO_LAYERS: Record<string, TissueLayer[]> = {
  shoulder: [
    { type: "skin", depth: 0, thickness: 0.2, ...TISSUE_PROPERTIES.skin } as TissueLayer,
    { type: "fat", depth: 0.2, thickness: 0.5, ...TISSUE_PROPERTIES.fat } as TissueLayer,
    { type: "muscle", depth: 0.7, thickness: 2.0, ...TISSUE_PROPERTIES.muscle } as TissueLayer,
    { type: "bone", depth: 2.7, thickness: 1.0, ...TISSUE_PROPERTIES.bone } as TissueLayer,
  ],
  knee: [
    { type: "skin", depth: 0, thickness: 0.2, ...TISSUE_PROPERTIES.skin } as TissueLayer,
    { type: "fat", depth: 0.2, thickness: 0.3, ...TISSUE_PROPERTIES.fat } as TissueLayer,
    { type: "muscle", depth: 0.5, thickness: 1.5, ...TISSUE_PROPERTIES.muscle } as TissueLayer,
    { type: "bone", depth: 2.0, thickness: 1.0, ...TISSUE_PROPERTIES.bone } as TissueLayer,
  ],
  lumbar: [
    { type: "skin", depth: 0, thickness: 0.2, ...TISSUE_PROPERTIES.skin } as TissueLayer,
    { type: "fat", depth: 0.2, thickness: 1.0, ...TISSUE_PROPERTIES.fat } as TissueLayer,
    { type: "muscle", depth: 1.2, thickness: 3.0, ...TISSUE_PROPERTIES.muscle } as TissueLayer,
  ],
  forearm: [
    { type: "skin", depth: 0, thickness: 0.2, ...TISSUE_PROPERTIES.skin } as TissueLayer,
    { type: "fat", depth: 0.2, thickness: 0.2, ...TISSUE_PROPERTIES.fat } as TissueLayer,
    { type: "muscle", depth: 0.4, thickness: 1.0, ...TISSUE_PROPERTIES.muscle } as TissueLayer,
  ],
  custom: [
    { type: "skin", depth: 0, thickness: 0.2, ...TISSUE_PROPERTIES.skin } as TissueLayer,
    { type: "fat", depth: 0.2, thickness: 0.5, ...TISSUE_PROPERTIES.fat } as TissueLayer,
    { type: "muscle", depth: 0.7, thickness: 2.0, ...TISSUE_PROPERTIES.muscle } as TissueLayer,
  ],
};

/**
 * Calculate intensity at depth using exponential attenuation
 */
function calculateIntensityAtDepth(
  surfaceIntensity: number,
  depth: number,
  frequency: number,
  layers: TissueLayer[]
): number {
  let totalAttenuation = 0;
  
  // V5: Enhanced frequency effect - more perceptible
  // Higher frequency = more attenuation per cm
  const frequencyFactor = 0.5 + (frequency - 1) * 0.8; // 1 MHz = 0.5, 3 MHz = 2.1
  
  for (const layer of layers) {
    if (depth <= layer.depth) break;
    const layerDepth = Math.min(depth - layer.depth, layer.thickness);
    // V5: Frequency has stronger effect on attenuation
    totalAttenuation += layer.attenuationCoeff * frequencyFactor * layerDepth * 1.5;
  }
  
  // Convert dB to linear: I = I0 * 10^(-dB/10)
  return surfaceIntensity * Math.pow(10, -totalAttenuation / 10);
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
  isSurface: boolean = false
): { 
  temp: number; 
  thermalDose: number;
} {
  // Find tissue at depth
  let currentLayer: TissueLayer | null = null;
  for (const layer of layers) {
    if (depth >= layer.depth && depth < layer.depth + layer.thickness) {
      currentLayer = layer;
      break;
    }
  }
  
  if (!currentLayer) {
    currentLayer = layers[layers.length - 1];
  }
  
  // Calculate intensity at this specific depth (considering attenuation)
  const intensityAtDepth = isSurface 
    ? surfaceIntensity // Surface gets full intensity (with coupling losses)
    : calculateIntensityAtDepth(surfaceIntensity, depth, frequency, layers);
  
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
  const w = currentLayer.perfusion * 0.0008; // Perfusion rate (m³/s per m³ tissue) - increased for realism
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
  
  tempRise = tempRise * intensityFactor * durationFactor;
  
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
  } = params;
  
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
  
  // Get tissue layers - STACK MODEL: Empilhamento cumulativo
  let layers: TissueLayer[];
  if (scenario === "custom" && params.customThicknesses) {
    const ct = params.customThicknesses;
    const TOTAL_BLOCK_DEPTH = 6.0; // Mesmo valor usado no TissueLayers.tsx
    
    // STACK: Calcular offsets cumulativos
    const skinStart = 0;
    const skinEnd = skinStart + ct.skin;
    const fatStart = skinEnd;
    const fatEnd = fatStart + ct.fat;
    const muscleStart = fatEnd;
    
    // Validação: clamp músculo se necessário
    const boneThickness = ct.boneThickness !== undefined ? ct.boneThickness : 1.0;
    const maxMuscleEnd = TOTAL_BLOCK_DEPTH - boneThickness;
    const actualMuscleEnd = Math.min(muscleStart + ct.muscle, maxMuscleEnd);
    const actualMuscleThickness = Math.max(0, actualMuscleEnd - muscleStart);
    
    // Osso sempre começa onde músculo termina
    const boneStart = muscleStart + actualMuscleThickness;
    const actualBoneThickness = ct.boneThickness !== undefined 
      ? ct.boneThickness 
      : Math.max(0, TOTAL_BLOCK_DEPTH - boneStart);
    
    layers = [
      { type: "skin", depth: skinStart, thickness: ct.skin, ...TISSUE_PROPERTIES.skin } as TissueLayer,
      { type: "fat", depth: fatStart, thickness: ct.fat, ...TISSUE_PROPERTIES.fat } as TissueLayer,
      { type: "muscle", depth: muscleStart, thickness: actualMuscleThickness, ...TISSUE_PROPERTIES.muscle } as TissueLayer,
    ];
    
    if (actualBoneThickness > 0.01) {
      layers.push({
        type: "bone",
        depth: boneStart,
        thickness: actualBoneThickness,
        ...TISSUE_PROPERTIES.bone
      } as TissueLayer);
    }
  } else {
    layers = SCENARIO_LAYERS[scenario] || SCENARIO_LAYERS.custom;
  }
  
  // Calculate penetration depth (where intensity drops to 10% of surface)
  let penetrationDepth = 0;
  for (let d = 0; d < 10; d += 0.1) {
    const intensityAtDepth = calculateIntensityAtDepth(effectiveIntensity, d, frequency, layers);
    if (intensityAtDepth < effectiveIntensity * 0.1) {
      penetrationDepth = d;
      break;
    }
  }
  
  // Effective depth (where 50% intensity remains) - typical therapeutic target
  let effectiveDepth = 0;
  for (let d = 0; d < 10; d += 0.1) {
    const intensityAtDepth = calculateIntensityAtDepth(effectiveIntensity, d, frequency, layers);
    if (intensityAtDepth < effectiveIntensity * 0.5) {
      effectiveDepth = d;
      break;
    }
  }
  
  // Beam width (more realistic - near field and far field)
  // V5: Frequency has stronger effect on beam width
  const transducerRadius = Math.sqrt(era / Math.PI); // cm
  // V5: Higher frequency = longer near field, narrower beam
  const nearFieldLength = Math.pow(transducerRadius, 2) * frequency / 1.2; // cm (frequency dependent)
  
  let beamWidth: number;
  if (effectiveDepth < nearFieldLength) {
    // Near field: beam width approximately constant, but frequency affects it
    const baseWidth = transducerRadius * 2;
    // Higher frequency = slightly narrower near field beam
    beamWidth = baseWidth * (1.0 - (frequency - 1) * 0.1);
  } else {
    // Far field: beam diverges - frequency strongly affects divergence
    // Higher frequency = less divergence (narrower beam)
    const divergenceAngle = 1.22 / (transducerRadius * frequency * 1.2); // radians (frequency dependent)
    beamWidth = transducerRadius * 2 + 2 * effectiveDepth * Math.tan(divergenceAngle);
  }
  
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
    true // isSurface = true
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
    false // isSurface = false
  );
  
  // Scan through depths to find maximum temperature
  let maxTemp = surfaceThermal.temp;
  let maxTempDepth = 0.05;
  let maxThermalDose = surfaceThermal.thermalDose;
  
  // Check multiple depths to find peak
  for (let d = 0.1; d < Math.min(penetrationDepth, 5); d += 0.2) {
    const thermalAtDepth = calculateThermalEffectsAtDepth(
      effectiveIntensity,
      d,
      layers,
      frequency,
      duration,
      effectiveDuty * 100,
      movement,
      coupling,
      false
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
  const boneLayer = layers.find(l => l.type === "bone");
  
  // V5: Check if transducer is over bone region in mixed layer
  let isOverBone = false;
  if (params.mixedLayer?.enabled && params.transducerPosition) {
    const division = params.mixedLayer.division / 100; // 0-1
    const boundaryX = (division - 0.5) * 2; // -1 to 1
    // If transducer X position is on bone side (right side)
    isOverBone = params.transducerPosition.x > boundaryX;
  }
  
  if (boneLayer || isOverBone) {
    // STACK MODEL: boneDepth é sempre boneLayer.depth (onde o osso começa)
    const boneDepth = boneLayer?.depth || params.mixedLayer?.depth || 0;
    const intensityAtBone = calculateIntensityAtDepth(effectiveIntensity, boneDepth, frequency, layers);
    
    if (intensityAtBone > effectiveIntensity * 0.1) {
      // V5: Mixed layer bone has stronger reflection if directly over it
      const reflectionMultiplier = isOverBone ? 1.3 : 1.0;
      boneReflection = (0.3 + (intensityAtBone / effectiveIntensity) * 0.2) * reflectionMultiplier;
      
      // Periosteal risk increases if hotspot is near bone
      const distanceToBone = Math.abs(thermal.maxTempDepth - boneDepth);
      if (distanceToBone < 0.5) {
        // Hotspot within 0.5cm of bone
        periostealRisk = Math.min(1, (0.5 - distanceToBone) / 0.5);
        if (thermal.maxTemp > 42) {
          periostealRisk = Math.min(1, periostealRisk + 0.3);
        }
        // V5: Higher risk if directly over bone in mixed layer
        if (isOverBone) {
          periostealRisk = Math.min(1, periostealRisk + 0.2);
        }
      }
    }
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
  if (periostealRisk > 0.7) {
    periostealRiskLevel = "high";
    riskFactors.push(`Risco periosteal muito alto (${(periostealRisk * 100).toFixed(0)}%) - hotspot muito próximo ao osso`);
  } else if (periostealRisk > 0.5) {
    periostealRiskLevel = "high";
    riskFactors.push(`Risco periosteal alto (${(periostealRisk * 100).toFixed(0)}%) - hotspot próximo ao osso`);
  } else if (periostealRisk > 0.3) {
    periostealRiskLevel = "medium";
    riskFactors.push(`Risco periosteal moderado (${(periostealRisk * 100).toFixed(0)}%)`);
  }
  
  // Overall risk = max(thermal risk, periosteal risk)
  let risk: "low" | "medium" | "high" = thermalRisk;
  if (periostealRiskLevel === "high" || (periostealRiskLevel === "medium" && thermalRisk === "low")) {
    risk = periostealRiskLevel;
  } else if (thermalRisk === "high" || periostealRiskLevel === "high") {
    risk = "high";
  } else if (thermalRisk === "medium" || periostealRiskLevel === "medium") {
    risk = "medium";
  }
  
  // Additional contextual factors (only if risk is still low)
  if (risk === "low") {
    if (doseJcm2 > 20 && duration > 10) {
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
  
  return {
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
  };
}
