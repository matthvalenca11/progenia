/** Tons de pele realistas compartilhados — ultrassom, fotobiomodulação, eletroterapia */

export interface ClinicalSkinTone {
  id: string;
  label: string;
  /** Cor principal da superfície (MeshPhysicalMaterial) */
  color: string;
  /** Subsurface / attenuation (ultrassom 3D) */
  attenuationColor: string;
  /** Fotobiomodulação — epiderme */
  epidermis: string;
  /** Fotobiomodulação — derme */
  dermis: string;
  /** Eletroterapia — base RGB do canvas procedural */
  canvasRgb: [number, number, number];
  /** Eletroterapia — poros ruído "r,g,b" */
  poreRgb: string;
}

export const CLINICAL_SKIN_TONES: readonly ClinicalSkinTone[] = [
  {
    id: "light_olive",
    label: "Morena clara",
    color: "#D4A574",
    attenuationColor: "#B8875A",
    epidermis: "#D4A574",
    dermis: "#C49566",
    canvasRgb: [212, 165, 116],
    poreRgb: "95,68,52",
  },
  {
    id: "warm_medium",
    label: "Morena",
    color: "#C8875A",
    attenuationColor: "#9A5A35",
    epidermis: "#C8875A",
    dermis: "#B87850",
    canvasRgb: [200, 135, 90],
    poreRgb: "88,58,40",
  },
  {
    id: "golden_tan",
    label: "Mulata clara",
    color: "#B87548",
    attenuationColor: "#8F5630",
    epidermis: "#B87548",
    dermis: "#A86840",
    canvasRgb: [184, 117, 72],
    poreRgb: "82,50,34",
  },
  {
    id: "medium_brown",
    label: "Mulata",
    color: "#A6633D",
    attenuationColor: "#7A4528",
    epidermis: "#A6633D",
    dermis: "#965838",
    canvasRgb: [166, 99, 61],
    poreRgb: "75,45,30",
  },
  {
    id: "deep_tan",
    label: "Morena escura",
    color: "#945A36",
    attenuationColor: "#6B3D22",
    epidermis: "#945A36",
    dermis: "#845030",
    canvasRgb: [148, 90, 54],
    poreRgb: "68,40,26",
  },
] as const;

/** Sorteia um tom ao montar o lab (estável durante a sessão) */
export function pickRandomClinicalSkinTone(): ClinicalSkinTone {
  const idx = Math.floor(Math.random() * CLINICAL_SKIN_TONES.length);
  return CLINICAL_SKIN_TONES[idx];
}

/** Sorteia índice de melanina alinhado a um tom clínico discreto da paleta. */
export function melaninIndexForClinicalSkinTone(
  tone: ClinicalSkinTone,
  min = 0.1,
  max = 0.9,
): number {
  const palette = CLINICAL_SKIN_TONES;
  const idx = palette.findIndex((entry) => entry.id === tone.id);
  if (idx < 0) return min + (max - min) * 0.5;
  const t = idx / Math.max(palette.length - 1, 1);
  return min + t * (max - min);
}

export function pickRandomSkinMelaninIndex(min = 0.1, max = 0.9): number {
  return melaninIndexForClinicalSkinTone(pickRandomClinicalSkinTone(), min, max);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function lerpHex(a: string, b: string, t: number): string {
  const ar = hexToRgb(a);
  const br = hexToRgb(b);
  return rgbToHex([
    ar[0] + (br[0] - ar[0]) * t,
    ar[1] + (br[1] - ar[1]) * t,
    ar[2] + (br[2] - ar[2]) * t,
  ]);
}

function lerpRgbTuple(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function lerpPoreRgb(a: string, b: string, t: number): string {
  const ar = a.split(",").map((v) => Number(v.trim()));
  const br = b.split(",").map((v) => Number(v.trim()));
  return [
    Math.round(ar[0] + (br[0] - ar[0]) * t),
    Math.round(ar[1] + (br[1] - ar[1]) * t),
    Math.round(ar[2] + (br[2] - ar[2]) * t),
  ].join(",");
}

function interpolateClinicalSkinTone(a: ClinicalSkinTone, b: ClinicalSkinTone, t: number): ClinicalSkinTone {
  const pct = Math.round(t * 100);
  return {
    id: `melanin_${pct}`,
    label: `Melanina ${pct}%`,
    color: lerpHex(a.color, b.color, t),
    attenuationColor: lerpHex(a.attenuationColor, b.attenuationColor, t),
    epidermis: lerpHex(a.epidermis, b.epidermis, t),
    dermis: lerpHex(a.dermis, b.dermis, t),
    canvasRgb: lerpRgbTuple(a.canvasRgb, b.canvasRgb, t),
    poreRgb: lerpPoreRgb(a.poreRgb, b.poreRgb, t),
  };
}

/** Mapeia índice de melanina (0–1) para tom de pele clínico no viewer 3D. */
export function skinToneFromMelaninIndex(
  melaninIndex: number,
  min = 0.1,
  max = 0.9,
): ClinicalSkinTone {
  const t = clamp01((melaninIndex - min) / Math.max(max - min, 0.001));
  const palette = CLINICAL_SKIN_TONES;
  const scaled = t * (palette.length - 1);
  const lowIdx = Math.min(palette.length - 1, Math.floor(scaled));
  const highIdx = Math.min(palette.length - 1, lowIdx + 1);
  const localT = scaled - lowIdx;
  return interpolateClinicalSkinTone(palette[lowIdx], palette[highIdx], localT);
}
