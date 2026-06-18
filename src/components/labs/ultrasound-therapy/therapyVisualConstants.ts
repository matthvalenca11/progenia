/** Tokens visuais — transdutor e gel (lab ultrassom terapêutico 3D) */

/** Plástico clínico ABS — branco maciço opaco (sem IBL / sem transmission) */
export const THERAPY_TRANSDUCER = {
  body: "#ffffff",
  /** Emissive leve — mantém branco clínico mesmo com cena escura */
  bodyEmissive: "#ffffff",
  bodyEmissiveIntensity: 0.38,
  faceChamfer: "#fafbfc",
  labelPlate: "#c8d0d8",
  screwHead: "#e8ecf0",
  rubber: "#475569",
  chrome: "#8fa0b5",
  chromeMetalness: 0.92,
  chromeRoughness: 0.12,
  chromeClearcoat: 0.95,
  chromeClearcoatRoughness: 0.05,
  chromeEnvIntensity: 0.55,
  logo: "#788598",
} as const;

export type { ClinicalSkinTone as TherapySkinTone } from "@/lib/clinicalSkinTones";
export {
  CLINICAL_SKIN_TONES as THERAPY_SKIN_TONES,
  pickRandomClinicalSkinTone as pickRandomTherapySkinTone,
} from "@/lib/clinicalSkinTones";

/** Gel acústico — azul saturado, levemente translúcido */
export const THERAPY_GEL_GOOD = {
  color: "#1eb0f0",
  emissive: "#0a7ab8",
  emissiveIntensity: 0.16,
  opacity: 0.52,
  roughness: 0.1,
} as const;

export const THERAPY_GEL_POOR = {
  color: "#1ba3e8",
  emissive: "#0b6fa8",
  emissiveIntensity: 0.08,
  opacity: 0.34,
  roughness: 0.32,
} as const;

/** Face de contato — plano (disco cerâmico) vs focalizado (lente âmbar) */
export const THERAPY_TRANSDUCER_FACE = {
  planar: {
    ceramic: { color: "#1d4ed8", emissive: "#60a5fa", emissiveIntensity: 0.72 },
    halo: { color: "#3b82f6", emissive: "#2563eb", emissiveIntensity: 0.55 },
    chromeRing: { color: "#2563eb", emissive: "#93c5fd", emissiveIntensity: 0.35 },
    dorsalBand: "#2563eb",
  },
  focused: {
    lens: {
      color: "#ea580c",
      emissive: "#fb923c",
      emissiveIntensity: 0.9,
      roughness: 0.06,
      transmission: 0.08,
    },
    halo: { color: "#f97316", emissive: "#ea580c", emissiveIntensity: 0.65 },
    recess: { color: "#1e293b", emissive: "#0f172a", emissiveIntensity: 0.15 },
    dorsalBand: "#ea580c",
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
