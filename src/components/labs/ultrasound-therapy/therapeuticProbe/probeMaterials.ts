/** Materiais PBR — transdutor clínico de ultrassom terapêutico */

export const PROBE_COLORS = {
  body: "#E8ECEF",
  bodySecondary: "#DDE3E6",
  detail: "#BFC7CC",
  rubber: "#202326",
  rubberSoft: "#303336",
  activeMetal: "#C8CDD0",
  button: "#4E8DBD",
  cable: "#050505",
  seam: "#C5CDD2",
  label: "#1e293b",
} as const;

export const PROBE_PLASTIC = {
  color: PROBE_COLORS.body,
  roughness: 0.55,
  metalness: 0.04,
  clearcoat: 0.18,
  clearcoatRoughness: 0.38,
  envMapIntensity: 0.65,
} as const;

export const PROBE_PLASTIC_DETAIL = {
  color: PROBE_COLORS.detail,
  roughness: 0.62,
  metalness: 0.04,
} as const;

export const PROBE_RUBBER = {
  color: PROBE_COLORS.rubber,
  roughness: 0.94,
  metalness: 0,
} as const;

export const PROBE_ACTIVE_METAL = {
  color: "#B0B8BE",
  metalness: 0.88,
  roughness: 0.32,
  clearcoat: 0.45,
  clearcoatRoughness: 0.15,
  envMapIntensity: 1.2,
} as const;

export const PROBE_BUTTON = {
  color: PROBE_COLORS.button,
  roughness: 0.48,
  metalness: 0.08,
} as const;

export const PROBE_CABLE = {
  color: PROBE_COLORS.cable,
  roughness: 0.9,
  metalness: 0.04,
} as const;

export const PROBE_GEL_GOOD = {
  color: "#b8dff5",
  emissive: "#6eb8e8",
  emissiveIntensity: 0.06,
  opacity: 0.28,
  roughness: 0.72,
} as const;

export const PROBE_GEL_POOR = {
  color: "#a8d4f0",
  emissive: "#5aa8d8",
  emissiveIntensity: 0.04,
  opacity: 0.22,
  roughness: 0.78,
} as const;

export const PROBE_HALO = {
  planar: { color: "#7dd3fc", emissive: "#38bdf8", emissiveIntensity: 0.08 },
  focused: { color: "#fcd34d", emissive: "#f59e0b", emissiveIntensity: 0.07 },
} as const;
