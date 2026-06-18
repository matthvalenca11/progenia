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
