/**
 * Taxonomia de aplicadores — ultrassom terapêutico por contato (0,5–5 MHz)
 *
 * Referências:
 * - IEC 61689 — equipamentos de fisioterapia com transdutor circular plano NÃO focalizado
 *   (pistão, feixe estático perpendicular à face). Padrão clínico (>95% dos equipamentos).
 * - IEC 61828 — definições de transdutores focalizados (feixe convergente, lente/superfície curva).
 * - IEC 62555 / HITU — ultrassom intensivo focalizado (estética/ablação): FORA do escopo deste lab.
 * - IEC 63009 — faixa 20 kHz–500 kHz (ondas de choque / baixa frequência): modalidade distinta.
 *
 * Eixos de classificação (não misturar na UI):
 * 1. Superfície emissora: circular (padrão) | circular com lente
 * 2. Geometria do feixe: planar/não focalizado | convergente/focalizado
 *
 * Aplicadores retangulares NÃO fazem parte da IEC 61689 nem são categoria clínica
 * estabelecida em fisioterapia — foram removidos da seleção (alias legado → planar circular).
 */

import {
  ERA_CLINICAL_REFERENCE,
  type TransducerBeamProfile,
} from "@/types/ultrasoundTherapyConfig";

/** IDs estáveis no config_data */
export type TherapeuticTransducerType = "planar_circular" | "focused_convergent";

/** Família clínica do aplicador */
export type TherapeuticTransducerFamily =
  | "physiotherapy_standard"
  | "focused_deep_heating";

export type TransducerFaceShape = "circle" | "rounded_rect";

export interface TherapeuticTransducerDefinition {
  id: TherapeuticTransducerType;
  /** Nome completo para selects e admin */
  label: string;
  /** Chip compacto no header / toggles */
  shortLabel: string;
  /** Subtítulo — eixo de classificação */
  subtitle: string;
  description: string;
  /** Agrupamento pedagógico na UI */
  family: TherapeuticTransducerFamily;
  familyLabel: string;
  /** Norma técnica de referência (quando aplicável) */
  standardRef?: string;
  /** Feixe acústico associado */
  beamGeometry: "planar_unfocused" | "convergent_focused";
  faceShape: TransducerFaceShape;
  defaultBeamProfile: TransducerBeamProfile;
  lockBeamProfile: boolean;
  defaultFocusDepth?: number;
  eraRange: { min: number; max: number };
  visual: {
    faceVisualScale: number;
    headBezelRatio: number;
    ceramicProfile: "flat" | "convex";
    aspectRatio?: number;
    headBodyStyle: "pistol_circular" | "ifu_lens" | "rectangular_block";
    faceHScale?: number;
    collarHScale?: number;
    headTint?: string;
  };
  beam: {
    lateralScale?: [number, number];
    waistRatio?: number;
    nearFieldScale?: number;
  };
}

/** IDs legados — migrados automaticamente ao carregar config */
export const LEGACY_TRANSDUCER_TYPE_ALIASES: Record<string, TherapeuticTransducerType> = {
  circular_planar: "planar_circular",
  focused_ifu: "focused_convergent",
  /** Retangular não é categoria IEC/clínica — mapeia para o pistão circular padrão */
  rectangular_planar: "planar_circular",
};

export function normalizeTransducerType(
  type: string | undefined | null,
): TherapeuticTransducerType {
  if (!type) return "planar_circular";
  if (type === "planar_circular" || type === "focused_convergent") {
    return type;
  }
  return LEGACY_TRANSDUCER_TYPE_ALIASES[type] ?? "planar_circular";
}

/** Tipos expostos ao aluno — apenas os clinicamente relevantes para este lab */
export const CLINICAL_TRANSDUCER_TYPES: TherapeuticTransducerType[] = [
  "planar_circular",
  "focused_convergent",
];

export const THERAPEUTIC_TRANSDUCER_FAMILY_LABELS: Record<TherapeuticTransducerFamily, string> = {
  physiotherapy_standard: "Fisioterapia convencional (IEC 61689)",
  focused_deep_heating: "Aquecimento profundo focalizado (IEC 61828)",
};

/** Área máxima da face no 3D/mapa quando ERA = slider máximo (cm²) */
export const ERA_VISUAL_CAP_CM2 = 3.0;

export function visualEraAreaCm2(
  era: number,
  sliderMax = ERA_CLINICAL_REFERENCE.sliderMax,
): number {
  const clamped = Math.max(0, Math.min(sliderMax, era));
  return ERA_VISUAL_CAP_CM2 * (clamped / sliderMax);
}

export function visualFaceRadiusFromEra(era: number): number {
  return Math.sqrt(visualEraAreaCm2(era) / Math.PI);
}

export interface ResolvedTransducerFace {
  kind: TransducerFaceShape;
  eqR: number;
  activeR?: number;
  headR?: number;
  activeHalfW?: number;
  activeHalfD?: number;
  headHalfW?: number;
  headHalfD?: number;
  beamScaleX: number;
  beamScaleZ: number;
  ceramicProfile: "flat" | "convex";
}

export const THERAPEUTIC_TRANSDUCER_LABELS: Record<TherapeuticTransducerType, string> = {
  planar_circular: "Planar circular (pistão)",
  focused_convergent: "Convergente focalizado (lente)",
};

export const THERAPEUTIC_TRANSDUCERS: Record<
  TherapeuticTransducerType,
  TherapeuticTransducerDefinition
> = {
  planar_circular: {
    id: "planar_circular",
    label: "Planar circular (pistão)",
    shortLabel: "Planar",
    subtitle: "Superfície circular · feixe não focalizado",
    description:
      "Aplicador padrão de fisioterapia (Sonopuls, Intelect, Sonicator): face circular plana, ERA mensurável, feixe cilíndrico no campo próximo e divergente no campo distante. Escopo da IEC 61689.",
    family: "physiotherapy_standard",
    familyLabel: THERAPEUTIC_TRANSDUCER_FAMILY_LABELS.physiotherapy_standard,
    standardRef: "IEC 61689",
    beamGeometry: "planar_unfocused",
    faceShape: "circle",
    defaultBeamProfile: "planar",
    lockBeamProfile: false,
    eraRange: { min: 2.5, max: 6.5 },
    visual: {
      faceVisualScale: 1.0,
      headBezelRatio: 1.1,
      ceramicProfile: "flat",
      headBodyStyle: "pistol_circular",
      faceHScale: 1,
      collarHScale: 1,
      headTint: "#e0f2fe",
    },
    beam: {},
  },
  focused_convergent: {
    id: "focused_convergent",
    label: "Convergente focalizado (lente acústica)",
    shortLabel: "Focalizado",
    subtitle: "Superfície circular · feixe convergente",
    description:
      "Cabeçote com lente acústica ou radiador curvo que concentra energia em profundidade (zona focal). Usado em aquecimento profundo terapêutico — não confundir com HIFU estético/de ablação (IEC 62555). Caracterização conforme IEC 61828.",
    family: "focused_deep_heating",
    familyLabel: THERAPEUTIC_TRANSDUCER_FAMILY_LABELS.focused_deep_heating,
    standardRef: "IEC 61828",
    beamGeometry: "convergent_focused",
    faceShape: "circle",
    defaultBeamProfile: "focused",
    lockBeamProfile: true,
    defaultFocusDepth: 2.5,
    eraRange: { min: 2.5, max: 5.5 },
    visual: {
      faceVisualScale: 1.0,
      headBezelRatio: 1.08,
      ceramicProfile: "convex",
      headBodyStyle: "ifu_lens",
      faceHScale: 2.05,
      collarHScale: 0.68,
      headTint: "#ffedd5",
    },
    beam: {
      waistRatio: 0.24,
    },
  },
};

export function getTransducerDefinition(
  type: TherapeuticTransducerType | string = "planar_circular",
): TherapeuticTransducerDefinition {
  const normalized = normalizeTransducerType(type);
  return THERAPEUTIC_TRANSDUCERS[normalized];
}

/** Profundidade focal só faz sentido com feixe convergente / perfil focalizado. */
export function isFocusDepthApplicable(
  transducerType: TherapeuticTransducerType | string | undefined,
  beamProfile: TransducerBeamProfile | undefined,
): boolean {
  const def = getTransducerDefinition(transducerType ?? "planar_circular");
  const effectiveProfile = def.lockBeamProfile
    ? def.defaultBeamProfile
    : (beamProfile ?? def.defaultBeamProfile ?? "planar");
  return effectiveProfile === "focused";
}

export function getTransducersByFamily(): Array<{
  family: TherapeuticTransducerFamily;
  label: string;
  types: TherapeuticTransducerDefinition[];
}> {
  const groups = new Map<TherapeuticTransducerFamily, TherapeuticTransducerDefinition[]>();
  for (const type of CLINICAL_TRANSDUCER_TYPES) {
    const def = THERAPEUTIC_TRANSDUCERS[type];
    const list = groups.get(def.family) ?? [];
    list.push(def);
    groups.set(def.family, list);
  }
  return Array.from(groups.entries()).map(([family, types]) => ({
    family,
    label: THERAPEUTIC_TRANSDUCER_FAMILY_LABELS[family],
    types,
  }));
}

export function resolveTransducerFace(
  type: TherapeuticTransducerType | string,
  era: number,
): ResolvedTransducerFace {
  const def = getTransducerDefinition(type);
  const eqR = Math.sqrt(era / Math.PI);
  const scale = def.visual.faceVisualScale;
  const visualArea = visualEraAreaCm2(era) * scale * scale;
  const HEAD_BEZEL_MARGIN_CM = 0.04;

  if (def.faceShape === "rounded_rect") {
    const ar = def.visual.aspectRatio ?? 1.45;
    const activeHalfW = Math.sqrt((visualArea * ar) / 4);
    const activeHalfD = Math.sqrt(visualArea / (4 * ar));
    const headHalfW = activeHalfW * def.visual.headBezelRatio + HEAD_BEZEL_MARGIN_CM;
    const headHalfD = activeHalfD * def.visual.headBezelRatio + HEAD_BEZEL_MARGIN_CM;
    const physicsHalfW = Math.sqrt((era * ar) / 4);
    const physicsHalfD = Math.sqrt(era / (4 * ar));
    const [beamScaleX, beamScaleZ] = def.beam.lateralScale ?? [
      physicsHalfW / eqR,
      physicsHalfD / eqR,
    ];
    return {
      kind: "rounded_rect",
      eqR,
      activeHalfW,
      activeHalfD,
      headHalfW,
      headHalfD,
      beamScaleX,
      beamScaleZ,
      ceramicProfile: def.visual.ceramicProfile,
    };
  }

  const activeR = Math.sqrt(visualArea / Math.PI);
  const headR = Math.max(
    activeR * def.visual.headBezelRatio + HEAD_BEZEL_MARGIN_CM,
    activeR + HEAD_BEZEL_MARGIN_CM * 1.5,
  );

  return {
    kind: "circle",
    eqR,
    activeR,
    headR,
    beamScaleX: 1,
    beamScaleZ: 1,
    ceramicProfile: def.visual.ceramicProfile,
  };
}

export function configDefaultsForTransducerType(
  type: TherapeuticTransducerType | string,
): Partial<{
  beamProfile: TransducerBeamProfile;
  focusDepth: number;
  era: number;
}> {
  const def = getTransducerDefinition(type);
  return {
    beamProfile: def.defaultBeamProfile,
    ...(def.defaultFocusDepth != null ? { focusDepth: def.defaultFocusDepth } : {}),
  };
}

/** Modalidades terapêuticas com US fora do escopo deste simulador (referência pedagógica) */
export const OUT_OF_SCOPE_THERAPEUTIC_MODALITIES = [
  {
    id: "hifu",
    label: "HIFU (ultrassom intensivo focalizado)",
    note: "Estética / ablação — IEC 62555. Intensidades e mecanismos distintos da fisioterapia.",
  },
  {
    id: "shockwave_low_freq",
    label: "Ondas de choque / baixa frequência (20 kHz–500 kHz)",
    note: "IEC 63009 — modalidade mecânica, não contínua como US terapêutico convencional.",
  },
  {
    id: "phased_array",
    label: "Arranjo faseado / multifocal",
    note: "Pesquisa e equipamentos especializados — não aplicador único de contato clínico.",
  },
] as const;
