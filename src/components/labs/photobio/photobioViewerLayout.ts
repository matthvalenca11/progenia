import type { PhotobioLayerConfig } from "@/simulation/photobioEngine";
import { photobioDepthMmToWorldUnits, type PhotobioOpticsResult } from "@/lib/photobioOptics";
import * as THREE from "three";

export const PHOTOBIO_BASE_Y = -0.6;
export const PHOTOBIO_MM_TO_WORLD = 0.09;
export const PHOTOBIO_TISSUE_WIDTH = 8.5;
export const PHOTOBIO_TISSUE_DEPTH = 3.4;
export const TRANSDUCER_BASE_OFFSET = 1.01;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Peak normalized well depth at contact center (matches applyContactIndent). */
export const CONTACT_INDENT_CENTER_FACTOR = 1;

/** Perfil radial suave — super-Gaussiana C∞, sem degrau em r=1. */
export function concentricContactBasinProfile(r: number): number {
  if (r <= 0) return 1;
  const sigma = 0.66;
  const beta = 2.05;
  return Math.exp(-Math.pow(r / sigma, beta));
}

/** Ombro periférico suave — transição contínua do poço para o tecido plano. */
export function concentricContactRimBulge(r: number, indent: number): number {
  if (r < 0.82 || r > 1.65) return 0;
  const shoulder = smoothstep01(clamp((r - 0.92) / 0.38, 0, 1));
  const fade = 1 - smoothstep01(clamp((r - 1.18) / 0.42, 0, 1));
  return shoulder * fade * indent * 0.06;
}

export function gravitationalWellProfile(radial: number, steepness = 1): number {
  const r = Math.sqrt(radial) / Math.max(steepness, 0.55);
  return concentricContactBasinProfile(r);
}

/** Raio normalizado (r=1 = borda do spot) onde a face plana do aplicador encontra o tecido. */
export const APPLICATOR_CONTACT_PROFILE_R = 0.92;

/** Gap fixo entre face do aplicador e superfície nominal da pele (sem pressão). */
export const APPLICATOR_SKIN_GAP = 0.028;

/** Ganho global da deformação visível (malha + deslocamento vertical do aplicador). */
export const CONTACT_DEFORMATION_VISUAL_GAIN = 5.35;

/** Extra na malha epidérmica — indent já inclui ganho global; complementa o poço visível. */
export const CONTACT_MESH_SINK_GAIN = 1.2;

/** Escala vertical global (+70% base; afinado em +12% adicional). */
export const CONTACT_VERTICAL_DEFORMATION_SCALE = 1.9;

/** Teto de afundamento por camada — evita atravessar a malha e envolver o transdutor. */
export const EPIDERMIS_MAX_INDENT_FRACTION = 1.58 * CONTACT_VERTICAL_DEFORMATION_SCALE;
export const DERMIS_MAX_INDENT_FRACTION = 0.45 * CONTACT_VERTICAL_DEFORMATION_SCALE;
export const ADIPOSE_MAX_INDENT_FRACTION = 0.26 * CONTACT_VERTICAL_DEFORMATION_SCALE;
export const MUSCLE_MAX_INDENT_FRACTION = 0.09 * CONTACT_VERTICAL_DEFORMATION_SCALE;

/** Ganho de malha na interface derme — acompanha esmagamento epidérmico. */
export const DERMIS_MESH_SINK_GAIN = 1.28;

/** Reforço na faixa baixa–média de pressão (~0–55%) — decai até 100%. */
export const CONTACT_LOW_MID_PRESSURE_BOOST = 1.3;

/** Multiplicador visual do poço na epiderme (posicionamento do aplicador). */
export const EPIDERMIS_GRAVITATIONAL_SINK_BOOST = 1.08;

/** Saturação suave — profundidade tende ao teto sem “explodir” a malha. */
export function capLayerIndent(raw: number, layerHeight: number, maxFraction: number): number {
  if (raw <= 0 || layerHeight <= 0) return 0;
  const cap = layerHeight * maxFraction;
  return cap * (1 - Math.exp((-0.66 * raw) / Math.max(cap, 0.001)));
}

/** Smoothstep 0→1 — resposta gradual (ex.: slider de pressão). */
export function smoothstep01(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Potencial grav. — núcleo profundo + base larga (área extensa afunda visivelmente). */
export function gravitationalPotentialNormalized(r: number, softening = 0.1): number {
  const rs = Math.max(r, softening * 0.12) / Math.max(softening, 0.001);
  const core = 1 / (1 + rs * rs * 0.22) ** 0.95;
  const wide = Math.exp(-(rs * rs) / 2.1);
  return Math.min(1.12, core * 0.48 + wide * 0.52);
}

/** Perfil radial do poço — alias para compatibilidade com testes legados. */
export function epidermisRadialBasinProfile(r: number): number {
  return concentricContactBasinProfile(r);
}

/** Mantido para compatibilidade; perfil liso substitui ondulações artificiais. */
export function equipotentialRingRipple(_r: number): number {
  return 1;
}

export interface TissueLayerSizes {
  width: number;
  depth: number;
  epidermis: number;
  dermis: number;
  adipose: number;
  muscle: number;
}

/** Derme acompanha o excedente comprimido da epiderme — evita “vazar” sob alta pressão. */
export function coupleDermisIndentToEpidermis(
  epidermisIndent: number,
  dermisIndent: number,
  sizes: Pick<TissueLayerSizes, "epidermis" | "dermis">,
  pressureNorm: number,
): number {
  if (dermisIndent <= 0 && epidermisIndent <= 0) return 0;
  const pressureT = smoothstep01(clamp((pressureNorm - 0.22) / 0.78, 0, 1));
  const cap = sizes.dermis * DERMIS_MAX_INDENT_FRACTION;
  if (pressureT <= 0.001) return Math.min(dermisIndent, cap);

  const epidermisOverflow = Math.max(0, epidermisIndent - sizes.epidermis * 0.9);
  const followEpidermis = epidermisIndent * (0.42 + pressureT * 0.32);
  const overflowTransfer = epidermisOverflow * (0.88 + pressureT * 0.16);

  return Math.min(Math.max(dermisIndent, followEpidermis, dermisIndent + overflowTransfer), cap);
}

/** Curva de pressão → intensidade de deformação (resposta cedo no slider). */
export function computeContactPressureResponse(pressureNorm: number): {
  gradualPressure: number;
  lowMidBoost: number;
  pressureScale: number;
  highPressureAmp: number;
  deepPressure: number;
  dermisHighAmp: number;
  adiposeHighAmp: number;
} {
  const pressureT = clamp(pressureNorm, 0, 1);
  const midResponse = smoothstep01(clamp((pressureT - 0.14) / 0.5, 0, 1));
  const highResponse = smoothstep01(clamp((pressureT - 0.62) / 0.38, 0, 1));
  const gradualPressure = clamp(0.11 + midResponse * 0.45 + highResponse * 0.54, 0, 1);
  const lowMidBlend = 1 - smoothstep01(clamp((pressureT - 0.55) / 0.45, 0, 1));
  const lowMidBoost = 1 + (CONTACT_LOW_MID_PRESSURE_BOOST - 1) * lowMidBlend;
  const pressureScale = gradualPressure * lowMidBoost;
  const highPressureAmp =
    1 + smoothstep01(clamp((pressureT - 0.55) / 0.45, 0, 1)) * 1.05;
  const deepPressure = smoothstep01(clamp((pressureT - 0.18) / 0.82, 0, 1));
  const dermisHighAmp =
    1 + smoothstep01(clamp((pressureT - 0.58) / 0.42, 0, 1)) * 0.62;
  const adiposeHighAmp =
    1 + smoothstep01(clamp((pressureT - 0.68) / 0.32, 0, 1)) * 0.38;

  return {
    gradualPressure,
    lowMidBoost,
    pressureScale,
    highPressureAmp,
    deepPressure,
    dermisHighAmp,
    adiposeHighAmp,
  };
}

/** Pressure-driven indent depths in world units, scaled to each layer thickness. */
export function computeLayerContactIndents(
  pressureNorm: number,
  sizes: TissueLayerSizes,
): {
  epidermis: number;
  dermis: number;
  adipose: number;
  muscle: number;
} {
  if (pressureNorm <= 0) {
    return { epidermis: 0, dermis: 0, adipose: 0, muscle: 0 };
  }

  const pressureT = clamp(pressureNorm, 0, 1);
  const {
    pressureScale,
    highPressureAmp,
    deepPressure,
    dermisHighAmp,
    adiposeHighAmp,
  } = computeContactPressureResponse(pressureT);
  const gain = CONTACT_DEFORMATION_VISUAL_GAIN * CONTACT_VERTICAL_DEFORMATION_SCALE;

  const epidermis = capLayerIndent(
    sizes.epidermis * pressureScale * 1.14 * gain * highPressureAmp,
    sizes.epidermis,
    EPIDERMIS_MAX_INDENT_FRACTION,
  );
  const dermisBase = capLayerIndent(
    sizes.dermis * pressureScale * 1.05 * gain * dermisHighAmp,
    sizes.dermis,
    DERMIS_MAX_INDENT_FRACTION,
  );
  const dermis = coupleDermisIndentToEpidermis(epidermis, dermisBase, sizes, pressureT);

  return {
    epidermis,
    dermis,
    adipose: capLayerIndent(
      sizes.adipose * 0.21 * pressureScale * gain * deepPressure * adiposeHighAmp,
      sizes.adipose,
      ADIPOSE_MAX_INDENT_FRACTION,
    ),
    muscle: capLayerIndent(
      sizes.muscle *
        0.05 *
        pressureScale *
        gain *
        smoothstep01(clamp((pressureT - 0.12) / 0.88, 0, 1)),
      sizes.muscle,
      MUSCLE_MAX_INDENT_FRACTION,
    ),
  };
}

export function sampleContactSurfaceSink(
  indent: number,
  radialNorm = 0,
): number {
  if (indent <= 0) return 0;
  return indent * concentricContactBasinProfile(radialNorm) * CONTACT_INDENT_CENTER_FACTOR;
}

/** Deslocamento vertical da superfície deformada em relação ao topo original (negativo = afundado). */
export function sampleDeformedSurfaceLift(
  indent: number,
  radialNorm: number,
): number {
  if (indent <= 0) return 0;
  const sink =
    sampleContactSurfaceSink(indent, radialNorm) * EPIDERMIS_GRAVITATIONAL_SINK_BOOST;
  const bulge = concentricContactRimBulge(radialNorm, indent);
  return bulge - sink;
}

/** Ponto mais elevado da pele sob o spot (plano de apoio de face plana). */
export function computeHighestContactZoneLift(layerIndents: {
  epidermis: number;
}): number {
  const indent = layerIndents.epidermis;
  if (indent <= 0) return 0;

  let highest = -Infinity;
  for (let i = 0; i <= 64; i += 1) {
    const radialNorm = (i / 64) * 1.65;
    highest = Math.max(highest, sampleDeformedSurfaceLift(indent, radialNorm));
  }
  return highest;
}

/** Lift médio da superfície sob a face — transdutor acompanha a compressão real do tecido. */
export function computeApplicatorContactPlaneLift(
  layerIndents: { epidermis: number },
  footprint?: Pick<
    AngleContactFootprint,
    "asymmetricBias"
  >,
): number {
  const indent = layerIndents.epidermis;
  if (indent <= 0) return 0;

  const bias = footprint?.asymmetricBias ?? 0;
  let weightedSum = 0;
  let weightSum = 0;
  const steps = 24;
  const profileR = APPLICATOR_CONTACT_PROFILE_R;
  const angularSteps = 10;

  for (let i = 1; i <= steps; i += 1) {
    const rPrev = ((i - 1) / steps) * profileR;
    const rNext = (i / steps) * profileR;
    const rMid = (rPrev + rNext) * 0.5;
    const ringWeight = (rNext * rNext - rPrev * rPrev) / angularSteps;

    for (let a = 0; a < angularSteps; a += 1) {
      const theta = (a / angularSteps) * Math.PI * 2;
      const uNorm = rMid * Math.cos(theta);
      const radialNorm = Math.min(Math.hypot(uNorm, rMid * Math.sin(theta)), profileR);
      const edgeFactor = clamp(1 + bias * uNorm, 0.42, 1.58);
      const localIndent = indent * edgeFactor;
      weightedSum += sampleDeformedSurfaceLift(localIndent, radialNorm) * ringWeight;
      weightSum += ringWeight;
    }
  }

  const centerLift = sampleDeformedSurfaceLift(indent, 0);
  const centerWeight = 0.08 * profileR * profileR;
  const meanLift = (weightedSum + centerLift * centerWeight) / (weightSum + centerWeight);
  return meanLift;
}

/** @deprecated Alias — use computeApplicatorContactPlaneLift */
export function computeApplicatorSupportLift(layerIndents: {
  epidermis: number;
}): number {
  return computeApplicatorContactPlaneLift(layerIndents);
}

export function computeContactCenterSink(layerIndents: {
  epidermis: number;
}): number {
  return (
    sampleContactSurfaceSink(layerIndents.epidermis, 0) *
    EPIDERMIS_GRAVITATIONAL_SINK_BOOST
  );
}

/** Afundamento na borda do spot — referência legada. */
export function computeApplicatorRestSink(layerIndents: {
  epidermis: number;
}): number {
  return (
    sampleContactSurfaceSink(layerIndents.epidermis, APPLICATOR_CONTACT_PROFILE_R) *
    EPIDERMIS_GRAVITATIONAL_SINK_BOOST
  );
}

/** Y de repouso nominal acima da superfície (sem afundamento). */
export function computeApplicatorAnchorY(topSurfaceY: number): number {
  return topSurfaceY + APPLICATOR_SKIN_GAP;
}

export interface AngleContactFootprint {
  tiltRad: number;
  incidenceEfficiency: number;
  contactRadiusX: number;
  contactRadiusZ: number;
  /** Borda downstream comprime mais (+u alinhado ao tilt). */
  asymmetricBias: number;
  /** Pivô de rotação na borda upstream do contato (local X). */
  contactPivotOffsetX: number;
  /** Centro do spot desloca levemente com o tilt. */
  contactCenterOffsetX: number;
  /** Assentar a face inclinada sobre a pele (local/world Y). */
  contactSeatOffsetY: number;
  /** Inclinação fixa do corpo — reduzida quando o ângulo já é obliquo. */
  bodyPitchX: number;
}

/** Footprint elíptico e assimétrico do contato com a pele inclinada. */
export function computeAngleContactFootprint(
  transducerAngleDeg: number,
  baseRadiusX: number,
  baseRadiusZ: number,
  applicatorContactRadius?: number,
): AngleContactFootprint {
  const tiltRad = ((transducerAngleDeg - 90) * Math.PI) / 180;
  const incidenceEfficiency = Math.max(0.05, Math.cos(Math.abs(tiltRad)));
  const stretch = Math.min(1.52, 1 / Math.max(incidenceEfficiency, 0.48));
  const compress = Math.max(0.58, Math.sqrt(incidenceEfficiency));
  const sinT = Math.sin(tiltRad);
  const absSin = Math.abs(sinT);
  return {
    tiltRad,
    incidenceEfficiency,
    contactRadiusX: baseRadiusX * stretch,
    contactRadiusZ: baseRadiusZ * compress,
    asymmetricBias: clamp(sinT * 0.62, -0.5, 0.5),
    /** Rotação em torno do centro da face — pele conforma ao plano inclinado. */
    contactPivotOffsetX: 0,
    contactCenterOffsetX: 0,
    contactSeatOffsetY: 0,
    bodyPitchX: absSin > 0.22 ? 0 : 0.08 * clamp(incidenceEfficiency + 0.18, 0.32, 1),
  };
}

/** Ancoragem alinhada ao plano inclinado de contato (face ↔ pele conformada). */
export function computeApplicatorContactAnchorY(
  topSurfaceY: number,
  layerIndents: { epidermis: number },
  footprint: AngleContactFootprint,
  applicatorContactRadius: number,
): number {
  const baseAnchor = computeApplicatorRestY(topSurfaceY, layerIndents, footprint);
  const sinT = Math.sin(footprint.tiltRad);
  const absSin = Math.abs(sinT);
  if (absSin < 0.04 || layerIndents.epidermis <= 0) return baseAnchor;

  const centerLift = sampleDeformedSurfaceLift(layerIndents.epidermis, 0);
  /** Ponto mais comprimido assenta no poço; reduz gap fixo conforme o tilt. */
  const gapRelief = absSin * APPLICATOR_SKIN_GAP * 0.92;
  const pressSeat = centerLift * 0.22 - absSin * applicatorContactRadius * 0.06;
  return baseAnchor + pressSeat - gapRelief;
}

function scaleLayerIndentsByIncidence(
  indents: { epidermis: number; dermis: number; adipose: number; muscle: number },
  incidenceEfficiency: number,
  tiltRad = 0,
  pressureNorm = 1,
) {
  const highPressureRelief =
    1 + smoothstep01(clamp((pressureNorm - 0.62) / 0.38, 0, 1)) * 0.24;
  const scale = (0.58 + 0.42 * incidenceEfficiency) * highPressureRelief;
  const conformBoost = 1 + Math.abs(Math.sin(tiltRad)) * 0.28;
  return {
    epidermis: indents.epidermis * scale * conformBoost,
    dermis: indents.dermis * scale * highPressureRelief,
    adipose: indents.adipose * scale * highPressureRelief,
    muscle: indents.muscle * scale,
  };
}

/**
 * Y da raiz do aplicador — desce com a compressão média sob a face de contato.
 */
export function computeApplicatorRestY(
  topSurfaceY: number,
  layerIndents?: { epidermis: number },
  footprint?: Pick<AngleContactFootprint, "asymmetricBias">,
): number {
  const contactLift = layerIndents
    ? computeApplicatorContactPlaneLift(layerIndents, footprint)
    : 0;
  const compressionT = layerIndents
    ? clamp(layerIndents.epidermis / (0.19 * CONTACT_VERTICAL_DEFORMATION_SCALE), 0, 1)
    : 0;
  const gap = APPLICATOR_SKIN_GAP * (1 - compressionT * 0.82);
  return topSurfaceY + gap + contactLift;
}

export interface ContactIndentParams {
  height: number;
  centerX: number;
  indent: number;
  radiusX: number;
  radiusZ: number;
  topWeighted?: boolean;
  wellSteepness?: number;
  radialLimit?: number;
  /** Poço côncentrico com convergência radial (epiderme/derme). */
  gravitationalField?: boolean;
  /** Deslocamento horizontal — tecido comprimido converge para o centro. */
  radialConvergence?: number;
  /** Gaussiana legada exp(-r²·k) — mais legível na epiderme fina. */
  legacyGaussian?: boolean;
  /** Amplifica afundamento visual (epiderme). */
  fieldSinkBoost?: number;
  /** Fração da espessura da camada que recebe deformação (só topo). Default: epiderme 1, camadas profundas menores. */
  surfaceShellRatio?: number;
  /** Escala do anel periférico elevado — 0 em camadas profundas. */
  rimBulgeScale?: number;
  /** Expoente de atenuação com a profundidade dentro da camada. */
  depthFalloff?: number;
  /** Rotação do footprint de contato (rad) — alinha poço ao tilt do transdutor. */
  tiltRad?: number;
  /** Assimetria de pressão ao longo do eixo inclinado (+ downstream). */
  asymmetricBias?: number;
  /** Raio da face física — inclina o plano de contato do tecido. */
  skinConformRadius?: number;
  /** Ganho extra de afundamento na malha (ex.: interface derme). */
  meshSinkGain?: number;
  /** Teto de indent relativo à espessura (camadas profundas). */
  maxIndentFraction?: number;
}

function computeAngledContactDisplacement(
  u: number,
  r: number,
  basin: number,
  sinT: number,
  conformR: number,
  sink: number,
  rimBulge: number,
  surfaceWeight: number,
): number {
  const absSin = Math.abs(sinT);
  if (absSin <= 0.04) return rimBulge - sink;

  const sinSign = Math.sign(sinT);
  const uPad = clamp(u / Math.max(conformR, 0.001), -1.05, 1.05);
  const radialFade = smoothstep01(clamp(1.25 - r, 0, 0.55));
  const envelope = basin * radialFade * surfaceWeight;
  /** Plano inclinado só sob a pastilha do aplicador — evita “montanhas” no spot. */
  const planeMatch = uPad * sinT * conformR * envelope;
  const compressSide = smoothstep01(clamp(0.58 - uPad * sinSign * 0.42, 0, 1));
  const directedSink = sink * (0.48 + 0.52 * compressSide);

  return rimBulge - directedSink + planeMatch;
}

/** Saturação suave — atinge maxSink pleno em t=1 (preserva gradiente sem perder profundidade). */
export function softLimitVerticalDisplacement(
  displacement: number,
  maxSink: number,
  maxRaise: number,
): number {
  if (displacement >= 0) {
    if (maxRaise <= 0) return 0;
    const t = clamp(displacement / maxRaise, 0, 1.8);
    if (t <= 1) {
      const eased = t * t * (3 - 2 * t);
      return maxRaise * eased;
    }
    const overshoot = t - 1;
    return maxRaise * (1 + 0.1 * overshoot / (1 + overshoot * 1.5));
  }
  if (maxSink <= 0) return displacement;
  const t = clamp(-displacement / maxSink, 0, 2.2);
  if (t <= 1) {
    const eased = t * t * (3 - 2 * t);
    return -maxSink * eased;
  }
  const overshoot = t - 1;
  return -maxSink * (1 + 0.14 * overshoot / (1 + overshoot * 1.35));
}

/** Limites de deslocamento — afundamento forte, elevação contida (anti-“gola”). */
export function contactDisplacementLimits(
  height: number,
  indent: number,
  boost: number,
  topWeighted?: boolean,
  maxIndentFraction = DERMIS_MAX_INDENT_FRACTION,
  meshSinkGain = DERMIS_MESH_SINK_GAIN,
): { maxRaise: number; maxSink: number } {
  const maxRaise = Math.min(height * 0.05, indent * 0.1);
  if (!topWeighted) {
    const indentRatio = clamp(indent / Math.max(height, 0.001), 0, EPIDERMIS_MAX_INDENT_FRACTION);
    const sinkByIndent = indent * CONTACT_MESH_SINK_GAIN * 1.06;
    const sinkByHeight = height * (1.04 + indentRatio * 0.34);
    const maxSink = Math.min(
      Math.max(sinkByIndent, sinkByHeight),
      height * 1.72 * CONTACT_VERTICAL_DEFORMATION_SCALE,
    );
    return {
      maxRaise,
      maxSink,
    };
  }
  const indentRatio = clamp(indent / Math.max(height, 0.001), 0, maxIndentFraction);
  const sinkByIndent = indent * meshSinkGain * 1.04;
  const maxSink = Math.min(
    Math.max(sinkByIndent, height * (0.9 + Math.min(indentRatio, 1.1) * 0.38)),
    height * Math.min(indentRatio * 1.06, maxIndentFraction),
  );
  return {
    maxRaise,
    maxSink: Math.max(maxSink, height * 0.1),
  };
}
function contactSurfaceWeight(
  y: number,
  halfH: number,
  height: number,
  shellDepth: number,
  topWeighted?: boolean,
  depthFalloff = 2.4,
): number {
  const distFromTop = halfH - y;

  if (!topWeighted) {
    // Epiderme orgânica: picos acima do topo nominal ainda comprimem com peso pleno.
    if (distFromTop <= 0) {
      return 1;
    }
    const surfaceShell = clamp(distFromTop / shellDepth, 0, 1);
    const envelope = Math.pow(smoothstep01(1 - surfaceShell), depthFalloff);
    return clamp(0.25 + 0.75 * envelope, 0, 1);
  }

  if (distFromTop <= 0) {
    return 1;
  }

  const interfaceBand = clamp(1 - distFromTop / Math.max(shellDepth * 0.35, 0.004), 0, 1);
  const surfaceShell = clamp(distFromTop / shellDepth, 0, 1);
  const envelope = Math.pow(smoothstep01(1 - surfaceShell), depthFalloff);
  const yNorm = clamp((y + halfH) / Math.max(height, 0.001), 0, 1);
  const bottomAttenuation = smoothstep01(1 - yNorm);
  const deepWeight = clamp(envelope * (0.28 + 0.72 * bottomAttenuation), 0, 1);
  return clamp(Math.max(deepWeight, interfaceBand * 0.92), 0, 1);
}

export function applyContactIndent(
  geometry: THREE.BufferGeometry,
  params: ContactIndentParams,
) {
  if (params.gravitationalField) {
    applyGravitationalFieldIndent(geometry, params);
    return;
  }

  applyConcentricLayerIndent(geometry, params);
}

/** Depressão côncentrica — máximo no centro, decai com a distância, anel periférico elevado. */
export function applyConcentricLayerIndent(
  geometry: THREE.BufferGeometry,
  {
    height,
    centerX,
    indent,
    radiusX,
    radiusZ,
    topWeighted,
    radialLimit,
    fieldSinkBoost,
    radialConvergence,
    surfaceShellRatio,
    rimBulgeScale,
    depthFalloff,
    tiltRad,
    asymmetricBias,
    skinConformRadius,
    meshSinkGain,
    maxIndentFraction,
  }: ContactIndentParams,
) {
  if (indent <= 0) return;
  const pos = geometry.attributes.position;
  const halfH = height / 2;
  const limit = radialLimit ?? 2.6;
  const shellRatio = surfaceShellRatio ?? (topWeighted ? 0.42 : 0.55);
  const shellDepth = Math.max(height * shellRatio, 0.008);
  const boost = fieldSinkBoost ?? 1;
  const convergeStrength = radialConvergence ?? (topWeighted ? 0.1 : 0.32);
  const rimScale = rimBulgeScale ?? (topWeighted ? 0.35 : 1);
  const falloff = depthFalloff ?? (topWeighted ? 2.8 : 1.35);
  const tilt = tiltRad ?? 0;
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  const bias = asymmetricBias ?? 0;
  const conformR = skinConformRadius ?? radiusX * 0.58;
  const absSin = Math.abs(sinT);

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const dx = x - centerX;
    const dz = z;
    const u = dx * cosT + dz * sinT;
    const v = -dx * sinT + dz * cosT;
    const nu = u / Math.max(radiusX, 0.001);
    const nv = v / Math.max(radiusZ, 0.001);
    const radial = nu * nu + nv * nv;
    if (radial > limit * limit) continue;

    const r = Math.sqrt(radial);
    const outerFeather =
      r > limit * 0.82
        ? smoothstep01(clamp((limit - r) / Math.max(limit * 0.18, 0.001), 0, 1))
        : 1;
    const basin = concentricContactBasinProfile(r) * outerFeather;
    if (basin <= 0.00005) continue;

    const surfaceWeight = contactSurfaceWeight(
      y,
      halfH,
      height,
      shellDepth,
      topWeighted,
      falloff,
    );
    if (surfaceWeight <= 0.0005) continue;

    const edgeFactor = clamp(1 + bias * clamp(nu, -1.25, 1.25), 0.38, 1.62);
    const localIndent = indent * edgeFactor;
    const meshGain =
      meshSinkGain ?? (topWeighted ? 1 : CONTACT_MESH_SINK_GAIN);
    const sink = basin * localIndent * surfaceWeight * meshGain;
    const rimBulge = concentricContactRimBulge(r, localIndent) * surfaceWeight * rimScale;
    const displacement = computeAngledContactDisplacement(
      u,
      r,
      basin,
      sinT,
      conformR,
      sink,
      rimBulge,
      surfaceWeight,
    );
    const { maxRaise, maxSink } = contactDisplacementLimits(
      height,
      localIndent,
      boost,
      topWeighted,
      maxIndentFraction ?? DERMIS_MAX_INDENT_FRACTION,
      meshSinkGain ?? DERMIS_MESH_SINK_GAIN,
    );
    pos.setY(
      i,
      y + softLimitVerticalDisplacement(displacement, maxSink, maxRaise),
    );

    if (convergeStrength > 0.001 && r > 1.05 && r < limit * 0.95) {
      const converge = basin * localIndent * convergeStrength * surfaceWeight;
      const invR = 1 / Math.max(r, 0.05);
      pos.setX(i, x - (nu * cosT - nv * sinT) * invR * converge);
      pos.setZ(i, z - (nu * sinT + nv * cosT) * invR * converge);
    }
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

/** Epiderme — contato superficial com convergência radial visível. */
export function applyGravitationalFieldIndent(
  geometry: THREE.BufferGeometry,
  params: ContactIndentParams,
) {
  applyConcentricLayerIndent(geometry, {
    ...params,
    radialConvergence: params.radialConvergence ?? 0.28,
    fieldSinkBoost: params.fieldSinkBoost ?? EPIDERMIS_GRAVITATIONAL_SINK_BOOST,
    depthFalloff: params.depthFalloff ?? 1.05,
    surfaceShellRatio: params.surfaceShellRatio ?? 1,
    rimBulgeScale: params.rimBulgeScale ?? 0.12,
  });
}

function applyIndentToGeometry(
  geometry: THREE.BufferGeometry,
  basePositions: Float32Array,
  params: ContactIndentParams | null,
) {
  if (!params || params.indent <= 0.00005) {
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const i3 = i * 3;
      pos.setXYZ(i, basePositions[i3], basePositions[i3 + 1], basePositions[i3 + 2]);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  } else {
    resetAndApplyContactIndent(geometry, basePositions, params);
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

export function buildDeformedLayerGeometry(
  baseGeometry: THREE.BufferGeometry,
  params: ContactIndentParams | null,
): THREE.BufferGeometry {
  const geometry = baseGeometry.clone();
  const basePositions = Float32Array.from(
    baseGeometry.attributes.position.array as ArrayLike<number>,
  );
  applyIndentToGeometry(geometry, basePositions, params);
  return geometry;
}

export function resetAndApplyContactIndent(
  geometry: THREE.BufferGeometry,
  basePositions: Float32Array,
  params: ContactIndentParams,
) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const i3 = i * 3;
    pos.setXYZ(i, basePositions[i3], basePositions[i3 + 1], basePositions[i3 + 2]);
  }
  pos.needsUpdate = true;
  applyContactIndent(geometry, params);
}

export function resetLayerGeometry(
  geometry: THREE.BufferGeometry,
  basePositions: Float32Array,
) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const i3 = i * 3;
    pos.setXYZ(i, basePositions[i3], basePositions[i3 + 1], basePositions[i3 + 2]);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

export interface PhotobioStackLayout {
  sizes: TissueLayerSizes;
  totalHeight: number;
  topSurfaceY: number;
  stackCenterY: number;
  epidermisCenterY: number;
  dermisCenterY: number;
  adiposeCenterY: number;
  muscleCenterY: number;
  contactSurfaceY: number;
  /** Y world da raiz do aplicador — desce com pressão junto ao afundamento. */
  applicatorRestY: number;
  beamDepth: number;
  tiltZ: number;
  spotScale: number;
  contactRadiusX: number;
  contactRadiusZ: number;
  contactIndent: number;
  contactCenterSink: number;
  contactTiltRad: number;
  contactAsymmetricBias: number;
  incidenceEfficiency: number;
  contactPivotOffsetX: number;
  contactCenterOffsetX: number;
  contactSeatOffsetY: number;
  contactAnchorY: number;
  contactBodyPitchX: number;
  applicatorContactRadius: number;
  layerIndents: {
    epidermis: number;
    dermis: number;
    adipose: number;
    muscle: number;
  };
  pressureNorm: number;
  pressureFocusing: number;
}

export function computePhotobioStackLayout(
  layerConfig: PhotobioLayerConfig,
  transducerX: number,
  transducerAngle: number,
  contactPressure: number,
  spotSize: number,
  opticsProfile: PhotobioOpticsResult,
  applicatorContactRadius = spotSize > 0 ? 0.18 : 0.18,
): PhotobioStackLayout {
  const mmToWorld = PHOTOBIO_MM_TO_WORLD;
  const sizes: TissueLayerSizes = {
    width: PHOTOBIO_TISSUE_WIDTH,
    depth: PHOTOBIO_TISSUE_DEPTH,
    epidermis: clamp(layerConfig.epidermisMm * mmToWorld, 0.08, 0.35),
    dermis: clamp(layerConfig.dermisMm * mmToWorld, 0.2, 1.2),
    adipose: clamp(layerConfig.adiposeMm * mmToWorld, 0.25, 3.6),
    muscle: clamp(layerConfig.muscleMm * mmToWorld, 0.8, 4.2),
  };
  const totalHeight = sizes.epidermis + sizes.dermis + sizes.adipose + sizes.muscle;
  const topSurfaceY = PHOTOBIO_BASE_Y + totalHeight / 2;
  const tiltZ = ((transducerAngle - 90) * Math.PI) / 180;
  const pressureNorm = clamp(contactPressure / 100, 0, 1);
  const layerIndents = computeLayerContactIndents(pressureNorm, sizes);
  const spotNorm = clamp((spotSize - 0.1) / 0.9, 0, 1);
  const spotScale = 0.75 + spotNorm * 1.25;
  const baseRadiusX = 0.32 + spotScale * 0.78;
  const baseRadiusZ = 0.28 + spotScale * 0.62;
  const footprint = computeAngleContactFootprint(
    transducerAngle,
    baseRadiusX,
    baseRadiusZ,
    applicatorContactRadius,
  );
  const visualIndents = scaleLayerIndentsByIncidence(
    layerIndents,
    footprint.incidenceEfficiency,
    footprint.tiltRad,
    pressureNorm,
  );
  const contactCenterSink = computeContactCenterSink(visualIndents);
  const contactSupportLift = computeApplicatorContactPlaneLift(visualIndents, footprint);
  const applicatorRestY = computeApplicatorRestY(topSurfaceY, visualIndents, footprint);
  const contactAnchorY = computeApplicatorContactAnchorY(
    topSurfaceY,
    visualIndents,
    footprint,
    applicatorContactRadius,
  );
  const contactIndent = visualIndents.epidermis;
  const beamDepth = Math.max(
    1.2,
    Math.min(
      totalHeight - 0.12,
      photobioDepthMmToWorldUnits(opticsProfile.beamVisualDepthMm, mmToWorld),
    ),
  );

  return {
    sizes,
    totalHeight,
    topSurfaceY,
    stackCenterY: topSurfaceY - totalHeight / 2,
    epidermisCenterY: topSurfaceY - sizes.epidermis / 2,
    dermisCenterY: topSurfaceY - sizes.epidermis - sizes.dermis / 2,
    adiposeCenterY: topSurfaceY - sizes.epidermis - sizes.dermis - sizes.adipose / 2,
    muscleCenterY:
      topSurfaceY - sizes.epidermis - sizes.dermis - sizes.adipose - sizes.muscle / 2,
    contactSurfaceY: topSurfaceY + contactSupportLift,
    applicatorRestY,
    beamDepth,
    tiltZ,
    spotScale,
    contactRadiusX: footprint.contactRadiusX,
    contactRadiusZ: footprint.contactRadiusZ,
    contactIndent,
    contactCenterSink,
    contactTiltRad: footprint.tiltRad,
    contactAsymmetricBias: footprint.asymmetricBias,
    incidenceEfficiency: footprint.incidenceEfficiency,
    contactPivotOffsetX: footprint.contactPivotOffsetX,
    contactCenterOffsetX: footprint.contactCenterOffsetX,
    contactSeatOffsetY: footprint.contactSeatOffsetY,
    contactAnchorY,
    contactBodyPitchX: footprint.bodyPitchX,
    applicatorContactRadius,
    layerIndents: visualIndents,
    pressureNorm,
    pressureFocusing: 1 - clamp((contactPressure - 50) / 100, -0.2, 0.35),
  };
}
