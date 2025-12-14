/**
 * Ultrasound Anatomy Preset Types
 * Real clinical anatomy configurations for ultrasound simulator
 */

export type UltrasoundAnatomyPresetId = 
  | "custom"
  | "msk_tendon_upper_limb"
  | "carotid_trans"
  | "muscle_generic"
  | "liver_standard"
  | "gallbladder_standard";

export type TissueProfile = "muscle" | "tendon" | "vascular" | "bone_surface" | "liver_like" | "abdominal";

export type UltrasoundAnatomyPreset = {
  id: UltrasoundAnatomyPresetId;
  label: string;
  shortDescription: string;
  clinicalTagline: string;
  transducerType: "linear" | "convex" | "microconvex";
  recommendedFrequencyMHz: number;
  recommendedDepthCm: number;
  recommendedFocusCm: number;
  recommendedGain: number;
  
  // Internal rendering parameters
  tissueProfile: TissueProfile;
  vesselCount?: number;
  hasBoneInterface?: boolean;
  hasStrongShadow?: boolean;
  noiseSeed?: number;
  speckleIntensity?: number;
  layerBrightness?: number[];
};
