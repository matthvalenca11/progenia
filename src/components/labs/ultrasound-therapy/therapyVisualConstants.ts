/** Tokens visuais — transdutor clínico PROGENIA (lab ultrassom terapêutico 3D) */

/** Plástico ABS médico — branco acinzentado clínico */
export const THERAPY_TRANSDUCER = {
  body: "#E8ECEF",
  bodyEmissive: "#ffffff",
  bodyEmissiveIntensity: 0.06,
  grip: "#BFC7CC",
  faceChamfer: "#DDE3E6",
  labelPlate: "#C5CDD2",
  screwHead: "#E8ECEF",
  rubber: "#202326",
  stainless: "#C8CDD0",
  chrome: "#C8CDD0",
  chromeMetalness: 0.82,
  chromeRoughness: 0.38,
  chromeClearcoat: 0.35,
  chromeClearcoatRoughness: 0.18,
  chromeEnvIntensity: 1.05,
  cable: "#050505",
  logo: "#64748b",
} as const;

export type { ClinicalSkinTone as TherapySkinTone } from "@/lib/clinicalSkinTones";
export {
  CLINICAL_SKIN_TONES as THERAPY_SKIN_TONES,
  pickRandomClinicalSkinTone as pickRandomTherapySkinTone,
} from "@/lib/clinicalSkinTones";

/** Gel acústico — azul claro sutil, baixa opacidade */
export const THERAPY_GEL_GOOD = {
  color: "#b8dff5",
  emissive: "#6eb8e8",
  emissiveIntensity: 0.06,
  opacity: 0.28,
  roughness: 0.72,
} as const;

export const THERAPY_GEL_POOR = {
  color: "#a8d4f0",
  emissive: "#5aa8d8",
  emissiveIntensity: 0.04,
  opacity: 0.22,
  roughness: 0.78,
} as const;

/** Face de contato — aço inox (plano) vs lente acústica + array côncavo (focalizado) */
export const THERAPY_TRANSDUCER_FACE = {
  planar: {
    ceramic: { color: "#C8CDD0", emissive: "#aeb8bf", emissiveIntensity: 0.05 },
    halo: { color: "#7dd3fc", emissive: "#38bdf8", emissiveIntensity: 0.08 },
    chromeRing: { color: "#C8CDD0", emissive: "#aeb8bf", emissiveIntensity: 0.06 },
    dorsalBand: "#BFC7CC",
  },
  focused: {
    lens: {
      color: "#C8CDD0",
      emissive: "#aeb8bf",
      emissiveIntensity: 0.05,
      roughness: 0.38,
      transmission: 0,
    },
    piezo: {
      color: "#C8CDD0",
      emissive: "#aeb8bf",
    },
    halo: { color: "#fcd34d", emissive: "#f59e0b", emissiveIntensity: 0.07 },
    recess: { color: "#303336", emissive: "#202326", emissiveIntensity: 0.04 },
    dorsalBand: "#BFC7CC",
  },
} as const;

/** Feixe acústico 3D — divergente (plano) vs convergente (focalizado) */
export const THERAPY_BEAM = {
  planar: {
    envelope: { color: "#38bdf8", emissive: "#0ea5e9" },
    core: { color: "#2563eb", emissive: "#1d4ed8" },
    nearField: "#7dd3fc",
    nearFieldLabel: "#e0f2fe",
    effectiveDepth: { color: "#22d3ee", emissive: "#06b6d4" },
    slice: ["#1e3a8a", "#1d4ed8", "#2563eb", "#38bdf8"] as const,
  },
  focused: {
    envelope: { color: "#fdba74", emissive: "#f97316" },
    core: { color: "#f97316", emissive: "#ea580c" },
    focus: { color: "#fb923c", emissive: "#f97316" },
    focusLabel: "#ffedd5",
    effectiveDepth: { color: "#fbbf24", emissive: "#f59e0b" },
    slice: ["#7c2d12", "#c2410c", "#f97316", "#fdba74"] as const,
  },
} as const;

/** Perfil do blob 3D (compartilhado: rastro + contato) */
export const GEL_BLOB_PROFILE = [
  { r: 0.002, y: 0 },
  { r: 1, y: 0 },
  { r: 0.94, y: 0.14 },
  { r: 0.62, y: 0.38 },
  { r: 0.22, y: 0.52 },
  { r: 0.004, y: 0.54 },
] as const;
