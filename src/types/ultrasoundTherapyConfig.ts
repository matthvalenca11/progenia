/**
 * Configuration types for Ultrasound Therapy Lab
 */

import type { TherapeuticTransducerType } from "@/config/therapeuticTransducerDefinitions";
import { normalizeTransducerType } from "@/config/therapeuticTransducerDefinitions";
import { buildStackLayers, TOTAL_BLOCK_DEPTH } from "@/lib/ultrasoundTherapyStack";

export type { TherapeuticTransducerType };

export type AnatomicalScenario = "shoulder" | "knee" | "lumbar" | "forearm" | "custom";

export type UltrasoundMode = "continuous" | "pulsed";

export type CouplingQuality = "good" | "poor";

export type TransducerMovement = "stationary" | "scanning";

/** Modo do laboratório — livre ou guiado com desafios */
export type TherapyLabMode = "free" | "guided";

export type {
  TherapyChallengeId,
  ChallengeRuntimeState,
  TherapyChallengeDef,
} from "@/config/ultrasoundTherapyChallenges";

export type { UltrasoundTherapySnapshot } from "@/lib/ultrasoundTherapyComparison";

/** Perfil geométrico do feixe — depende do tipo de transdutor */
export type TransducerBeamProfile = "planar" | "focused";

export type TissuePerfusionProfile = "normal" | "baixa_circulacao" | "alta_circulacao";

export type {
  UltrasoundInteractionCell,
  UltrasoundInteractionMap,
  UltrasoundDominantPhenomenon,
} from "@/lib/ultrasoundTherapyInteractionMap";

export {
  INTERACTION_MAP_RESOLUTION_DESKTOP,
  INTERACTION_MAP_RESOLUTION_MOBILE,
  getDefaultInteractionMapResolution,
  DOMINANT_PHENOMENON_LABELS,
  DOMINANT_PHENOMENON_HINTS,
} from "@/lib/ultrasoundTherapyInteractionMap";

/** Opções visuais do modo Propagação nos Tecidos */
export interface UltrasoundVisualizationOptions {
  showPropagation: boolean;
  showAttenuation: boolean;
  showReflection: boolean;
  showCavitation: boolean;
  showStandingWaves: boolean;
  showTissueResponse: boolean;
  showThermalDamage: boolean;
  showAblation: boolean;
  showSafetyZones: boolean;
}

export const defaultUltrasoundVisualizationOptions: UltrasoundVisualizationOptions = {
  showPropagation: true,
  showAttenuation: true,
  showReflection: true,
  showCavitation: true,
  showStandingWaves: false,
  showTissueResponse: false,
  showThermalDamage: true,
  showAblation: false,
  showSafetyZones: false,
};

export type {
  UltrasoundPhysiologyResponse,
  UltrasoundPrimaryPhysiologyResponse,
} from "@/lib/ultrasoundPhysiologyResponse";

export {
  PRIMARY_PHYSIOLOGY_LABELS,
  PHYSIOLOGY_INDEX_LABELS,
  PRIMARY_PHYSIOLOGY_BAR_KEYS,
} from "@/lib/ultrasoundPhysiologyResponse";

export interface UltrasoundTherapyConfig {
  // Anatomical scenario
  scenario: AnatomicalScenario;
  
  // Custom tissue thicknesses (only for custom scenario)
  customThicknesses?: {
    skin: number; // cm
    fat: number; // cm
    muscle: number; // cm
    boneDepth?: number; // cm (depth from surface)
  };
  
  // Mixed layer configuration (for custom scenario)
  mixedLayer?: {
    enabled: boolean;
    depth: number; // cm (depth where mixed layer starts)
    division: number; // 0-100% (position of boundary: 0 = all muscle, 100 = all bone)
  };
  
  // Transducer position (2D control)
  transducerPosition?: {
    x: number; // -1 to 1 (relative position)
    y: number; // -1 to 1 (relative position)
  };
  
  // Transducer parameters
  /** Tipo de aplicador — define face de acoplamento e geometria do feixe */
  transducerType: TherapeuticTransducerType;
  frequency: number; // MHz (1-5)
  era: number; // cm² (Effective Radiating Area)
  /** Plano (pistão circular, IEC 61689) ou convergente focalizado (lente, IEC 61828) */
  beamProfile: TransducerBeamProfile;
  /** Profundidade focal em cm — relevante quando beamProfile = focused */
  focusDepth?: number;
  mode: UltrasoundMode;
  dutyCycle: number; // % (10-100, only for pulsed)
  
  // Energy parameters
  intensity: number; // W/cm²
  duration: number; // minutes
  
  // Technique parameters
  coupling: CouplingQuality;
  movement: TransducerMovement;

  /** Perfil de perfusão tecidual — afeta dissipação térmica no motor */
  tissuePerfusionProfile: TissuePerfusionProfile;
  
  // Enabled controls
  enabledControls: {
    scenario: boolean;
    customThicknesses?: boolean; // Enable thickness controls for custom
    mixedLayer?: boolean; // Permite ao aluno ajustar camada mista
    tissuePerfusionProfile?: boolean;
    frequency: boolean;
    era: boolean;
    transducerType?: boolean;
    beamProfile?: boolean;
    focusDepth?: boolean;
    mode: boolean;
    dutyCycle: boolean;
    intensity: boolean;
    duration: boolean;
    coupling: boolean;
    movement: boolean;
  };
  
  // Parameter ranges
  ranges: {
    frequency: { min: number; max: number };
    era: { min: number; max: number };
    intensity: { min: number; max: number };
    duration: { min: number; max: number };
    dutyCycle: { min: number; max: number };
    customThicknesses?: {
      skin: { min: number; max: number; step?: number };
      fat: { min: number; max: number; step?: number };
      muscle: { min: number; max: number; step?: number };
      boneDepth: { min: number; max: number; step?: number };
    };
    mixedLayer?: {
      depth: { min: number; max: number };
      division: { min: number; max: number };
    };
    focusDepth?: { min: number; max: number; step?: number };
  };
}

/** Profundidade focal mínima absoluta (cm) */
export const FOCUS_DEPTH_ABSOLUTE_MIN = 0.5;

/** Profundidade máxima recomendada para foco — até o início do osso ou fim do bloco */
export function getScenarioMaxFocusDepth(
  scenario: AnatomicalScenario,
  customThicknesses?: UltrasoundTherapyConfig["customThicknesses"],
): number {
  const layers = buildStackLayers(scenario, customThicknesses);
  const bone = layers.find((l) => l.type === "bone");
  if (bone) return Math.max(FOCUS_DEPTH_ABSOLUTE_MIN, bone.depth - 0.15);
  return TOTAL_BLOCK_DEPTH - 0.15;
}

export function validateFocusDepthForScenario(
  focusDepth: number,
  scenario: AnatomicalScenario,
  customThicknesses?: UltrasoundTherapyConfig["customThicknesses"],
): { value: number; warning?: string } {
  const clamped = Math.max(FOCUS_DEPTH_ABSOLUTE_MIN, focusDepth);
  const maxDepth = getScenarioMaxFocusDepth(scenario, customThicknesses);
  let warning: string | undefined;
  if (focusDepth < FOCUS_DEPTH_ABSOLUTE_MIN) {
    warning = `Profundidade focal mínima: ${FOCUS_DEPTH_ABSOLUTE_MIN} cm`;
  } else if (clamped > maxDepth) {
    warning = `Foco (${clamped.toFixed(1)} cm) ultrapassa profundidade útil do cenário (~${maxDepth.toFixed(1)} cm)`;
  }
  return { value: Math.min(clamped, maxDepth + 0.5), warning };
}

/** Mescla config parcial do admin/DB com defaults completos */
export function mergeUltrasoundTherapyConfig(
  partial?: Partial<UltrasoundTherapyConfig> | null,
): UltrasoundTherapyConfig {
  if (!partial || typeof partial !== "object") {
    return structuredClone(defaultUltrasoundTherapyConfig);
  }

  return {
    ...defaultUltrasoundTherapyConfig,
    ...partial,
    transducerType: normalizeTransducerType(
      partial.transducerType ?? defaultUltrasoundTherapyConfig.transducerType,
    ),
    beamProfile: partial.beamProfile ?? defaultUltrasoundTherapyConfig.beamProfile,
    focusDepth: partial.focusDepth ?? defaultUltrasoundTherapyConfig.focusDepth,
    mixedLayer: {
      ...defaultUltrasoundTherapyConfig.mixedLayer,
      ...(partial.mixedLayer || {}),
    },
    customThicknesses: partial.customThicknesses ?? defaultUltrasoundTherapyConfig.customThicknesses,
    tissuePerfusionProfile:
      partial.tissuePerfusionProfile ?? defaultUltrasoundTherapyConfig.tissuePerfusionProfile,
    enabledControls: {
      ...defaultUltrasoundTherapyConfig.enabledControls,
      ...(partial.enabledControls || {}),
    },
    ranges: {
      ...defaultUltrasoundTherapyConfig.ranges,
      ...(partial.ranges || {}),
      customThicknesses: {
        ...defaultUltrasoundTherapyConfig.ranges.customThicknesses,
        ...(partial.ranges?.customThicknesses || {}),
      },
      focusDepth: {
        ...defaultUltrasoundTherapyConfig.ranges.focusDepth,
        ...(partial.ranges?.focusDepth || {}),
      },
      mixedLayer: {
        ...defaultUltrasoundTherapyConfig.ranges.mixedLayer,
        ...(partial.ranges?.mixedLayer || {}),
        depth: {
          ...defaultUltrasoundTherapyConfig.ranges.mixedLayer?.depth,
          ...(partial.ranges?.mixedLayer?.depth || {}),
        },
        division: {
          ...defaultUltrasoundTherapyConfig.ranges.mixedLayer?.division,
          ...(partial.ranges?.mixedLayer?.division || {}),
        },
      },
    },
  };
}

export const TRANSDUCER_BEAM_PROFILE_LABELS: Record<TransducerBeamProfile, string> = {
  planar: "Plano (não focalizado)",
  focused: "Convergente (focalizado)",
};

/**
 * ERA clínica em transdutores terapêuticos (IEC 61689).
 * Literatura: ~3–6 cm² na maioria dos equipamentos; raramente >6 cm².
 * @see Robertson & Baker, Arch Phys Med Rehabil 2006; Johns & Strauss, JAT 2007
 */
export const ERA_CLINICAL_REFERENCE = {
  typicalMin: 3,
  typicalMax: 6,
  sliderMin: 2.5,
  sliderMax: 6.5,
} as const;

export function getPerfusionVisualProfile(profile: TissuePerfusionProfile): {
  multiplier: number;
  heatRetention: number;
  skinFlush: number;
  dissipationLabel: string;
} {
  switch (profile) {
    case "baixa_circulacao":
      return {
        multiplier: 0.28,
        heatRetention: 1.48,
        skinFlush: 0.12,
        dissipationLabel: "Dissipação reduzida",
      };
    case "alta_circulacao":
      return {
        multiplier: 1.78,
        heatRetention: 0.62,
        skinFlush: 0.35,
        dissipationLabel: "Dissipação elevada",
      };
    default:
      return {
        multiplier: 1.0,
        heatRetention: 1.0,
        skinFlush: 0.2,
        dissipationLabel: "Dissipação normal",
      };
  }
}

export function getPerfusionProfileMultiplier(profile: TissuePerfusionProfile): number {
  return getPerfusionVisualProfile(profile).multiplier;
}

export const TISSUE_PERFUSION_PROFILE_LABELS: Record<TissuePerfusionProfile, string> = {
  normal: "Normal",
  baixa_circulacao: "Baixa circulação",
  alta_circulacao: "Alta circulação",
};

export const defaultUltrasoundTherapyConfig: UltrasoundTherapyConfig = {
  scenario: "shoulder",
  customThicknesses: {
    skin: 0.2,
    fat: 0.5,
    muscle: 2.0,
    boneDepth: 2.7,
  },
  mixedLayer: {
    enabled: false,
    depth: 2.7,
    division: 50, // 50% = middle
  },
  transducerPosition: {
    x: 0, // centered
    y: 0, // centered
  },
  frequency: 2,
  transducerType: "planar_circular",
  era: 5.0,
  beamProfile: "planar",
  focusDepth: 2.5,
  mode: "continuous",
  dutyCycle: 50,
  intensity: 5.0,
  duration: 8,
  coupling: "good",
  movement: "scanning",
  tissuePerfusionProfile: "normal",
  enabledControls: {
    scenario: true,
    customThicknesses: true,
    mixedLayer: false,
    tissuePerfusionProfile: true,
    frequency: true,
    era: true,
    transducerType: true,
    beamProfile: true,
    focusDepth: true,
    mode: true,
    dutyCycle: true,
    intensity: true,
    duration: true,
    coupling: true,
    movement: true,
  },
  ranges: {
    frequency: { min: 1, max: 3 },
    era: { min: ERA_CLINICAL_REFERENCE.sliderMin, max: ERA_CLINICAL_REFERENCE.sliderMax },
    intensity: { min: 0.1, max: 5.0 },
    duration: { min: 1, max: 30 },
    dutyCycle: { min: 10, max: 100 },
    customThicknesses: {
      skin: { min: 0.1, max: 0.5, step: 0.05 },
      fat: { min: 0.1, max: 2.0, step: 0.1 },
      muscle: { min: 0.5, max: 5.0, step: 0.1 },
      boneDepth: { min: 1.0, max: 6.0, step: 0.1 },
    },
    mixedLayer: {
      depth: { min: 0.5, max: 5.0 },
      division: { min: 0, max: 100 },
    },
    focusDepth: { min: 1.0, max: 5.0, step: 0.1 },
  },
};
