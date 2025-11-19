/**
 * Acoustic Media Type System for Ultrasound Simulation
 * Physical properties of tissues for realistic ultrasound rendering
 */

export type AcousticMediumId =
  | "muscle"
  | "fat"
  | "tendon"
  | "water"
  | "liver"
  | "bone_cortical"
  | "cartilage"
  | "skin"
  | "blood"
  | "cyst_fluid"
  | "fascia"
  | "generic_soft";

export type Echogenicity = "hyperechoic" | "isoechoic" | "hypoechoic" | "anechoic";

export type AcousticMedium = {
  id: AcousticMediumId;
  label: string;
  description?: string;
  // Physical parameters
  speedOfSound_m_per_s: number;          // Speed of sound (c)
  acousticImpedance_MRayl: number;       // Z = ρ × c (in MRayls)
  attenuation_dB_per_cm_MHz: number;     // α (frequency-dependent attenuation)
  baseEchogenicity: Echogenicity;
};

/**
 * Predefined acoustic media with realistic physical properties
 */
export const ACOUSTIC_MEDIA: Record<AcousticMediumId, AcousticMedium> = {
  skin: {
    id: "skin",
    label: "Pele",
    description: "Camada superficial da pele",
    speedOfSound_m_per_s: 1540,
    acousticImpedance_MRayl: 1.65,
    attenuation_dB_per_cm_MHz: 1.0,
    baseEchogenicity: "isoechoic",
  },
  fat: {
    id: "fat",
    label: "Gordura",
    description: "Tecido adiposo subcutâneo",
    speedOfSound_m_per_s: 1450,
    acousticImpedance_MRayl: 1.38,
    attenuation_dB_per_cm_MHz: 0.6,
    baseEchogenicity: "hypoechoic",
  },
  muscle: {
    id: "muscle",
    label: "Músculo",
    description: "Tecido muscular estriado",
    speedOfSound_m_per_s: 1580,
    acousticImpedance_MRayl: 1.70,
    attenuation_dB_per_cm_MHz: 1.3,
    baseEchogenicity: "isoechoic",
  },
  tendon: {
    id: "tendon",
    label: "Tendão",
    description: "Tecido conjuntivo denso (tendões e ligamentos)",
    speedOfSound_m_per_s: 1650,
    acousticImpedance_MRayl: 1.75,
    attenuation_dB_per_cm_MHz: 2.0,
    baseEchogenicity: "hyperechoic",
  },
  bone_cortical: {
    id: "bone_cortical",
    label: "Osso Cortical",
    description: "Superfície óssea cortical",
    speedOfSound_m_per_s: 3500,
    acousticImpedance_MRayl: 7.80,
    attenuation_dB_per_cm_MHz: 15.0,
    baseEchogenicity: "hyperechoic",
  },
  cartilage: {
    id: "cartilage",
    label: "Cartilagem",
    description: "Tecido cartilaginoso",
    speedOfSound_m_per_s: 1660,
    acousticImpedance_MRayl: 1.72,
    attenuation_dB_per_cm_MHz: 1.5,
    baseEchogenicity: "isoechoic",
  },
  water: {
    id: "water",
    label: "Água / Fluido",
    description: "Meio aquoso (água, urina, líquido sinovial)",
    speedOfSound_m_per_s: 1480,
    acousticImpedance_MRayl: 1.48,
    attenuation_dB_per_cm_MHz: 0.002,
    baseEchogenicity: "anechoic",
  },
  cyst_fluid: {
    id: "cyst_fluid",
    label: "Líquido Cístico",
    description: "Conteúdo líquido de cistos",
    speedOfSound_m_per_s: 1500,
    acousticImpedance_MRayl: 1.50,
    attenuation_dB_per_cm_MHz: 0.01,
    baseEchogenicity: "anechoic",
  },
  blood: {
    id: "blood",
    label: "Sangue",
    description: "Sangue intravascular",
    speedOfSound_m_per_s: 1570,
    acousticImpedance_MRayl: 1.61,
    attenuation_dB_per_cm_MHz: 0.18,
    baseEchogenicity: "anechoic",
  },
  liver: {
    id: "liver",
    label: "Fígado",
    description: "Parênquima hepático",
    speedOfSound_m_per_s: 1570,
    acousticImpedance_MRayl: 1.65,
    attenuation_dB_per_cm_MHz: 0.9,
    baseEchogenicity: "isoechoic",
  },
  fascia: {
    id: "fascia",
    label: "Fáscia",
    description: "Tecido conjuntivo fascial",
    speedOfSound_m_per_s: 1620,
    acousticImpedance_MRayl: 1.68,
    attenuation_dB_per_cm_MHz: 1.8,
    baseEchogenicity: "hyperechoic",
  },
  generic_soft: {
    id: "generic_soft",
    label: "Tecido Mole Genérico",
    description: "Tecido mole padrão",
    speedOfSound_m_per_s: 1540,
    acousticImpedance_MRayl: 1.63,
    attenuation_dB_per_cm_MHz: 0.7,
    baseEchogenicity: "isoechoic",
  },
};

/**
 * Layer configuration for ultrasound simulation
 */
export type UltrasoundLayerConfig = {
  id: string;
  mediumId: AcousticMediumId;
  name: string;                 // e.g., "Pele", "Gordura", "Músculo profundo"
  thicknessCm: number;
  // Optional fine-tuning
  noiseScale?: number;          // Texture / speckle scale (0.5-2.0)
  reflectivityBias?: number;    // Adjustment to reflectivity (-1 to +1)
};

/**
 * Inclusion shapes
 */
export type UltrasoundInclusionShape = "circle" | "ellipse" | "rectangle";

/**
 * Inclusion types
 */
export type UltrasoundInclusionType =
  | "cyst"
  | "solid_mass"
  | "vessel"
  | "bone_surface"
  | "calcification"
  | "heterogeneous_lesion";

/**
 * Inclusion configuration
 */
export type UltrasoundInclusionConfig = {
  id: string;
  type: UltrasoundInclusionType;
  label: string;

  shape: UltrasoundInclusionShape;
  centerDepthCm: number;        // Distance from skin surface
  centerLateralPos: number;     // -1 (left) to +1 (right)
  sizeCm: {
    width: number;
    height: number;
  };

  mediumInsideId: AcousticMediumId;  // Medium inside the inclusion
  
  // Rendering flags
  hasStrongShadow?: boolean;         // e.g., bone, calcification
  posteriorEnhancement?: boolean;    // e.g., cyst
  borderEchogenicity?: "sharp" | "soft";
};

/**
 * Calculate reflection coefficient at interface
 * R = (Z2 - Z1) / (Z2 + Z1)
 */
export function calculateReflectionCoefficient(
  impedance1_MRayl: number,
  impedance2_MRayl: number
): number {
  return Math.abs((impedance2_MRayl - impedance1_MRayl) / (impedance2_MRayl + impedance1_MRayl));
}

/**
 * Get acoustic medium by ID
 */
export function getAcousticMedium(id: AcousticMediumId): AcousticMedium {
  return ACOUSTIC_MEDIA[id];
}

/**
 * Get all acoustic media as array
 */
export function getAllAcousticMedia(): AcousticMedium[] {
  return Object.values(ACOUSTIC_MEDIA);
}
