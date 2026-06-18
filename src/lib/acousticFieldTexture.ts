/**
 * Campo acústico — perfil físico do feixe (plano/focalizado), pressão em Pa, reflexões sutis.
 */

import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";
import type { UltrasoundInteractionMap } from "@/lib/ultrasoundTherapyInteractionMap";
import { pressurePaToColormapRgba } from "@/lib/acousticBeamColors";
import {
  buildStackLayers,
  getBoneStartDepth,
  type StackCustomThicknesses,
} from "@/lib/ultrasoundTherapyStack";
import {
  getBeamGeometryFactor,
  getBeamRadiusAtDepthCm,
  getEquivalentDiameterCm,
  getNearFieldLengthCm,
  getWavelengthCm,
  type AcousticPhysicsInput,
} from "@/lib/ultrasoundTherapyPhysics";
import type { AnatomicalScenario } from "@/types/ultrasoundTherapyConfig";
import { resolveMixedLayerConfig } from "@/lib/ultrasoundTherapyStackConfig";
import {
  evaluateBoneAcousticEffect,
  boneUpwardReflectionFromEffect,
  MUSCLE_BONE_REFLECTION,
  TISSUE_ACOUSTIC_HALF_W,
} from "@/lib/ultrasoundTherapyBoneAcoustics";
import { intensityWcm2ToPeakPressurePa, getAcousticIntensitySpreadFactor, getVisualColormapMaxPa } from "@/lib/acousticPressure";
import { sampleFocusedPressureField } from "@/lib/focusedPressureField";

const TISSUE_WIDTH = 20;
const TISSUE_HALF_W = TISSUE_WIDTH / 2;

const TISSUE_ATTENUATION_DB: Record<string, number> = {
  skin: 0.5,
  fat: 0.3,
  muscle: 0.7,
  bone: 2.0,
  mixed: 0.85,
};

const INTERFACE_REFLECTIVITY: Record<string, number> = {
  "skin-fat": 0.06,
  "fat-muscle": 0.14,
  "muscle-bone": 0.55,
  "muscle-mixed": 0.32,
  "fat-bone": 0.38,
};

export interface AcousticFieldTextureOptions {
  xOffset?: number;
  intensity?: number;
  coupling?: "good" | "poor";
  scenario?: AnatomicalScenario;
  customThicknesses?: StackCustomThicknesses;
  mixedLayer?: { enabled?: boolean; depth?: number; division?: number };
  acoustic?: AcousticPhysicsInput;
  texWidth?: number;
  texHeight?: number;
  blurPasses?: number;
}

export interface AcousticFieldStats {
  entryPeakPressurePa: number;
  maxPressurePa: number;
  maxPressureDepthCm: number;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function tissueAttenuationAlongPath(
  depthCm: number,
  frequencyMHz: number,
  scenario: AnatomicalScenario,
  customThicknesses?: StackCustomThicknesses,
): number {
  const layers = buildStackLayers(scenario, customThicknesses);
  const frequencyFactor = 0.5 + (frequencyMHz - 1) * 0.8;
  let totalDb = 0;

  for (const layer of layers) {
    const layerTop = layer.depth;
    const layerBottom = layer.depth + layer.thickness;
    if (depthCm <= layerTop) break;

    const traversed = Math.min(depthCm, layerBottom) - layerTop;
    if (traversed <= 0) continue;

    const coeff = TISSUE_ATTENUATION_DB[layer.type] ?? 0.7;
    totalDb += coeff * frequencyFactor * traversed * 1.5;
  }

  return Math.pow(10, -totalDb / 10);
}

function getLayerBoundaries(
  scenario: AnatomicalScenario,
  customThicknesses?: StackCustomThicknesses,
): Array<{ depth: number; key: string }> {
  const layers = buildStackLayers(scenario, customThicknesses);
  const out: Array<{ depth: number; key: string }> = [];
  for (let i = 1; i < layers.length; i++) {
    const prev = layers[i - 1];
    const curr = layers[i];
    out.push({ depth: curr.depth, key: `${prev.type}-${curr.type}` });
  }
  return out;
}

/** Apodização circular da ERA — pistão plano mantém borda na largura do transdutor. */
function apertureRadialGain(
  lateralCm: number,
  faceRCm: number,
  depthCm: number,
  spreadFactor: number,
  beamProfile: AcousticPhysicsInput["beamProfile"],
): number {
  const faceR = Math.max(faceRCm, 0.035);
  const rn = Math.abs(lateralCm) / faceR;

  if (beamProfile === "planar") {
    if (rn <= 0.9) return 1;
    return Math.exp(-14 * (rn - 0.9) * (rn - 0.9));
  }

  const spreadR = faceR * spreadFactor;
  const spreadRn = Math.abs(lateralCm) / spreadR;
  const circular = Math.exp(-2.45 * spreadRn * spreadRn);
  const surfaceBlend = 1 - smoothstep(0.1, 0.65, depthCm);
  return circular * surfaceBlend + (1 - surfaceBlend);
}

/** Perfil lateral — plano: cilindro reto no campo próximo; focalizado: gaussiano. */
function lateralBeamProfile(
  lateralCm: number,
  faceRCm: number,
  beamRadiusCm: number,
  depthCm: number,
  nearFieldCm: number,
  beamProfile: AcousticPhysicsInput["beamProfile"],
  spreadFactor: number,
): number {
  if (beamProfile === "planar") {
    const inNearField = depthCm <= nearFieldCm * 1.04;
    const beamR = inNearField ? faceRCm : Math.max(faceRCm, beamRadiusCm);
    const rn = Math.abs(lateralCm) / Math.max(beamR, 0.04);

    if (inNearField) {
      if (rn <= 0.78) return 1;
      return Math.exp(-5.5 * (rn - 0.78) * (rn - 0.78));
    }

    return Math.exp(-3.4 * rn * rn);
  }

  const r = Math.max(0.04, beamRadiusCm) * spreadFactor;
  const rn = Math.abs(lateralCm) / r;
  const nearSurface = depthCm < 0.45;
  const gaussK = nearSurface ? 2.15 : 2.77;
  return Math.exp(-gaussK * rn * rn);
}

/** Campo próximo plano — entrada suave, sem franjas de Fresnel visíveis. */
function planarNearFieldAxial(
  depthCm: number,
  nearFieldCm: number,
  _wavelengthCm: number,
): number {
  if (depthCm <= 0.02) return 1;
  if (depthCm >= nearFieldCm) return 1;

  const zNorm = depthCm / Math.max(nearFieldCm, 0.05);
  const entryRamp = smoothstep(0, 0.18, depthCm);
  const endSoft = 1 - smoothstep(0.9, 1.0, zNorm) * 0.06;

  return (0.94 + 0.06 * entryRamp) * endSoft;
}

/** Atenuação axial do feixe plano — queda marcada com profundidade. */
function planarAxialAttenuation(
  depthCm: number,
  frequencyMHz: number,
  maxDepthCm: number,
): number {
  const alpha = 0.5 + frequencyMHz * 0.34;
  const pathAtten = Math.exp(-alpha * Math.max(0, depthCm) * 0.26);
  const tailFade = 1 - smoothstep(maxDepthCm * 0.38, maxDepthCm * 0.93, depthCm) * 0.48;
  return pathAtten * tailFade;
}

function computeRelativeBeamIntensity(
  depthCm: number,
  lateralCm: number,
  acoustic: AcousticPhysicsInput,
  spreadFactor = 1,
  maxDepthCm = 6,
): number {
  if (acoustic.beamProfile === "focused") {
    return sampleFocusedPressureField(depthCm, lateralCm, acoustic, spreadFactor);
  }

  const diameter = getEquivalentDiameterCm(acoustic.eraCm2, acoustic.transducerType);
  const nearField = getNearFieldLengthCm(
    diameter,
    acoustic.frequencyMHz,
    acoustic.transducerType,
  );
  const wavelength = getWavelengthCm(acoustic.frequencyMHz);
  const faceR = diameter / 2;
  const beamR = getBeamRadiusAtDepthCm(depthCm, acoustic);

  const lateral = lateralBeamProfile(
    lateralCm,
    faceR,
    beamR,
    depthCm,
    nearField,
    acoustic.beamProfile,
    spreadFactor,
  );
  if (lateral <= 0.002) return 0;

  let axial = getBeamGeometryFactor(depthCm, acoustic);

  if (acoustic.beamProfile === "planar") {
    axial *= planarNearFieldAxial(depthCm, nearField, wavelength);
    axial *= planarAxialAttenuation(depthCm, acoustic.frequencyMHz, maxDepthCm);
    if (depthCm > nearField) {
      const spreadLoss = (faceR / Math.max(beamR, faceR)) ** 2;
      axial *= 0.22 + spreadLoss * 0.78;
    } else if (nearField > 0.05) {
      const zNorm = depthCm / nearField;
      axial *= 1 - Math.pow(zNorm, 0.88) * 0.32;
    }
  }

  const aperture = apertureRadialGain(
    lateralCm,
    faceR,
    depthCm,
    spreadFactor,
    acoustic.beamProfile,
  );
  return clamp01(lateral * axial * aperture);
}

/** Mapeia pressão focalizada normalizada pelo pico → faixa completa do jet. */
function pressureForFocusedJetDisplay(
  pressurePa: number,
  fieldPeakPa: number,
  entryPeakPa: number,
): number {
  if (fieldPeakPa <= 0 || pressurePa <= 0 || entryPeakPa <= 0) return 0;
  const fieldRel = clamp01(pressurePa / fieldPeakPa);
  const visualMax = getVisualColormapMaxPa(entryPeakPa, "focused");
  return Math.pow(fieldRel, 0.8) * visualMax;
}

/** Estica pressão do feixe plano para o jet, preservando gradiente axial com a profundidade. */
function pressureForPlanarJetDisplay(
  pressurePa: number,
  depthCm: number,
  lateralCm: number,
  entryPeakPa: number,
  maxDepthCm: number,
  faceRCm: number,
  visualMaxPa: number,
): number {
  if (entryPeakPa <= 0 || pressurePa <= 0) return 0;
  const rel = clamp01(pressurePa / entryPeakPa);
  const depthNorm = clamp01(depthCm / Math.max(maxDepthCm, 0.01));
  const latNorm = Math.abs(lateralCm) / Math.max(faceRCm, 0.04);
  const lateral = 1 - clamp01((latNorm - 0.58) / 0.95) * 0.42;
  const depthVisual =
    Math.exp(-depthNorm * 1.45) * (1 - Math.pow(depthNorm, 0.7) * 0.22);
  const stretched = clamp01(rel * lateral * depthVisual);
  return stretched * visualMaxPa;
}

function interfaceReflectionBand(
  depthCm: number,
  beamIntensity: number,
  boundaries: Array<{ depth: number; key: string }>,
): number {
  let reflect = 0;
  for (const b of boundaries) {
    const dist = Math.abs(depthCm - b.depth);
    if (dist > 0.07) continue;
    const coeff = INTERFACE_REFLECTIVITY[b.key] ?? 0.08;
    const proximity = 1 - dist / 0.07;
    reflect = Math.max(reflect, coeff * proximity * beamIntensity * 0.55);
  }
  return clamp01(reflect);
}

/** @deprecated use boneUpwardReflectionFromEffect */
function boneUpwardReflection(
  depthCm: number,
  lateralCm: number,
  boneDepth: number | null,
  beamRadiusCm: number,
  incidentIntensity: number,
  boneReflectCoeff: number,
  boneFx: ReturnType<typeof evaluateBoneAcousticEffect>,
): number {
  return boneUpwardReflectionFromEffect(
    depthCm,
    lateralCm,
    boneDepth,
    beamRadiusCm,
    incidentIntensity,
    boneFx,
    boneReflectCoeff,
  );
}

function sampleMapReflection(
  map: UltrasoundInteractionMap,
  beamXNorm: number,
  depthCm: number,
): number {
  const { width, height, maxDepthCm, cells } = map;
  const colF = clamp01((beamXNorm + 1) / 2) * Math.max(0, width - 1);
  const rowF = clamp01(depthCm / Math.max(0.01, maxDepthCm)) * Math.max(0, height - 1);
  const c0 = Math.floor(colF);
  const c1 = Math.min(width - 1, c0 + 1);
  const r0 = Math.floor(rowF);
  const r1 = Math.min(height - 1, r0 + 1);
  const cf = colF - c0;
  const rf = rowF - r0;
  const idx = (row: number, col: number) => row * width + col;
  const picks = [
    { w: (1 - cf) * (1 - rf), i: idx(r0, c0) },
    { w: cf * (1 - rf), i: idx(r0, c1) },
    { w: (1 - cf) * rf, i: idx(r1, c0) },
    { w: cf * rf, i: idx(r1, c1) },
  ];
  let reflection = 0;
  for (const p of picks) {
    reflection += p.w * cells[p.i].reflectionIndex;
  }
  return reflection;
}

function blurHorizontal(
  src: Float32Array,
  dst: Float32Array,
  w: number,
  h: number,
  radius: number,
): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k++) {
        sum += src[y * w + Math.min(w - 1, Math.max(0, x + k))];
        count++;
      }
      dst[y * w + x] = sum / count;
    }
  }
}

function blurVertical(
  src: Float32Array,
  dst: Float32Array,
  w: number,
  h: number,
  radius: number,
): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k++) {
        sum += src[Math.min(h - 1, Math.max(0, y + k)) * w + x];
        count++;
      }
      dst[y * w + x] = sum / count;
    }
  }
}

function blurField(
  data: Float32Array,
  w: number,
  h: number,
  passes: number,
  includeHorizontal = true,
  radiusScale = 0.014,
): Float32Array {
  const radius = Math.max(1, Math.round(Math.min(w, h) * radiusScale));
  const bufA = new Float32Array(data);
  const bufB = new Float32Array(w * h);
  let src = bufA;
  let dst = bufB;

  if (passes <= 0) {
    return src;
  }

  for (let p = 0; p < passes; p++) {
    if (includeHorizontal) {
      blurHorizontal(src, dst, w, h, radius);
      blurVertical(dst, src, w, h, radius);
    } else {
      blurVertical(src, dst, w, h, radius);
      const swap = src;
      src = dst;
      dst = swap;
    }
  }

  return src;
}

function applyLateralBeamMask(
  pressure: Float32Array,
  reflection: Float32Array,
  w: number,
  h: number,
  xOffset: number,
  maxDepthCm: number,
  acoustic: AcousticPhysicsInput,
  spreadFactor: number,
): void {
  const diameter = getEquivalentDiameterCm(acoustic.eraCm2, acoustic.transducerType);
  const faceR = diameter / 2;
  const nearField = getNearFieldLengthCm(
    diameter,
    acoustic.frequencyMHz,
    acoustic.transducerType,
  );

  for (let j = 0; j < h; j++) {
    const depthCm = (j / Math.max(1, h - 1)) * maxDepthCm;
    const beamR = getBeamRadiusAtDepthCm(depthCm, acoustic);
    const limitR =
      acoustic.beamProfile === "planar"
        ? depthCm <= nearField * 1.04
          ? faceR * 1.02
          : beamR * 1.05
        : Math.max(beamR * (depthCm < 0.45 ? 1.55 : 1.22) * spreadFactor, 0.3);

    for (let i = 0; i < w; i++) {
      const idx = j * w + i;
      if (pressure[idx] <= 500 && reflection[idx] <= 0.03) continue;
      const worldX = -TISSUE_HALF_W + (i / Math.max(1, w - 1)) * TISSUE_WIDTH;
      const lateralDist = Math.abs(worldX - xOffset);
      const mask =
        acoustic.beamProfile === "planar"
          ? Math.exp(
              -0.5 *
                (Math.max(0, lateralDist - limitR * 0.9) / Math.max(limitR * 0.12, 0.02)) **
                  2,
            )
          : Math.exp(-0.5 * (lateralDist / limitR) ** 2);
      pressure[idx] *= mask;
      reflection[idx] *= mask;
    }
  }
}

export function buildAcousticFieldTexture(
  interactionMap: UltrasoundInteractionMap,
  options: AcousticFieldTextureOptions = {},
): CanvasTexture & { fieldStats?: AcousticFieldStats } {
  const {
    xOffset = 0,
    intensity = 1,
    coupling = "good",
    scenario = "shoulder",
    customThicknesses,
    mixedLayer,
    acoustic,
    texWidth = 220,
    texHeight = 280,
    blurPasses = 4,
  } = options;

  if (!acoustic) {
    const empty = new CanvasTexture(document.createElement("canvas")) as CanvasTexture & {
      fieldStats?: AcousticFieldStats;
    };
    empty.colorSpace = SRGBColorSpace;
    empty.fieldStats = {
      entryPeakPressurePa: 0,
      maxPressurePa: 0,
      maxPressureDepthCm: 0,
    };
    return empty;
  }

  const couplingFactor = coupling === "good" ? 0.95 : 0.68;
  const entryPeakPa = intensityWcm2ToPeakPressurePa(intensity * couplingFactor);
  const spreadFactor = getAcousticIntensitySpreadFactor(intensity);
  const isPlanar = acoustic.beamProfile === "planar";
  const boundaries = getLayerBoundaries(scenario, customThicknesses);
  const resolvedMixedLayer = resolveMixedLayerConfig(scenario, customThicknesses, mixedLayer);
  const boneDepth = resolvedMixedLayer?.depth ?? getBoneStartDepth(scenario, customThicknesses);
  const boneReflectCoeff = Math.max(
    interactionMap.summary.maxReflectionIndex,
    MUSCLE_BONE_REFLECTION * 0.65,
  );

  const blurPassesResolved = isPlanar
    ? 1
    : acoustic.beamProfile === "focused"
      ? Math.min(2, blurPasses)
      : blurPasses + Math.round(spreadFactor * 0.8);
  const blurHorizontal = !isPlanar;
  const blurRadiusScale = isPlanar ? 0.028 : 0.014;
  const w = texWidth;
  const h = texHeight;
  const maxDepthCm = interactionMap.maxDepthCm;
  const rawPressure = new Float32Array(w * h);
  const rawReflection = new Float32Array(w * h);

  let maxPressurePa = 0;
  let maxPressureDepthCm = 0;

  for (let j = 0; j < h; j++) {
    const depthCm = (j / Math.max(1, h - 1)) * maxDepthCm;
    const tissueAtt = tissueAttenuationAlongPath(
      depthCm,
      acoustic.frequencyMHz,
      scenario,
      customThicknesses,
    );

    for (let i = 0; i < w; i++) {
      const worldX = -TISSUE_HALF_W + (i / Math.max(1, w - 1)) * TISSUE_WIDTH;
      const lateralCm = worldX - xOffset;
      const beamXNorm = lateralCm / Math.max(0.01, getBeamRadiusAtDepthCm(maxDepthCm, acoustic) * 1.1);

      const beamShape = computeRelativeBeamIntensity(
        depthCm,
        lateralCm,
        acoustic,
        spreadFactor,
        maxDepthCm,
      );
      let relI = beamShape * tissueAtt;
      if (isPlanar) {
        relI *= Math.pow(tissueAtt, 0.62);
      }

      const boneFx = evaluateBoneAcousticEffect(
        depthCm,
        worldX,
        scenario,
        customThicknesses,
        resolvedMixedLayer,
      );
      relI *= boneFx.transmission;

      if (acoustic.beamProfile !== "focused") {
        relI = clamp01(relI);
      }

      const beamR = getBeamRadiusAtDepthCm(depthCm, acoustic);
      const ifaceReflect =
        interfaceReflectionBand(depthCm, relI, boundaries) * (isPlanar ? 0.32 : 1);
      const boneUp = boneUpwardReflection(
        depthCm,
        lateralCm,
        boneDepth,
        beamR,
        relI,
        boneReflectCoeff,
        boneFx,
      );

      let reflect = Math.max(
        ifaceReflect,
        boneUp,
        boneFx.reflection * relI * 0.72,
        sampleMapReflection(interactionMap, beamXNorm, depthCm) * relI * 0.42,
      );

      if (boneUp > 0.02) {
        relI = clamp01(relI + boneUp * 0.72);
        reflect = clamp01(reflect * 0.65);
      } else if (boneFx.inBone) {
        relI *= 0.35;
        reflect = clamp01(Math.max(reflect, boneFx.reflection * 0.85));
      } else if (boneFx.interfaceProximity > 0.25) {
        reflect = clamp01(reflect + boneFx.interfaceProximity * relI * 0.45);
        relI *= 1 - boneFx.interfaceProximity * 0.35;
      }

      const pressurePa = entryPeakPa * relI;

      const idx = j * w + i;
      rawPressure[idx] = pressurePa;
      rawReflection[idx] = reflect;

      if (pressurePa > maxPressurePa) {
        maxPressurePa = pressurePa;
        maxPressureDepthCm = depthCm;
      }
    }
  }

  const blurredPressure = blurField(
    rawPressure,
    w,
    h,
    blurPassesResolved,
    blurHorizontal,
    blurRadiusScale,
  );
  const blurredReflection = blurField(
    rawReflection,
    w,
    h,
    Math.max(2, blurPassesResolved - 1),
    blurHorizontal,
    blurRadiusScale,
  );
  applyLateralBeamMask(blurredPressure, blurredReflection, w, h, xOffset, maxDepthCm, acoustic, spreadFactor);

  const diameter = getEquivalentDiameterCm(acoustic.eraCm2, acoustic.transducerType);
  const faceRCm = diameter / 2;
  const isFocusedProfile = acoustic.beamProfile === "focused";
  const visualColormapMax = getVisualColormapMaxPa(entryPeakPa, "planar");

  for (let i = 0; i < blurredPressure.length; i++) {
    if (blurredPressure[i] > maxPressurePa) {
      maxPressurePa = blurredPressure[i];
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = new CanvasTexture(canvas) as CanvasTexture & { fieldStats?: AcousticFieldStats };
    fallback.colorSpace = SRGBColorSpace;
    fallback.fieldStats = {
      entryPeakPressurePa: entryPeakPa,
      maxPressurePa,
      maxPressureDepthCm,
    };
    return fallback;
  }

  const image = ctx.createImageData(w, h);
  for (let j = 0; j < h; j++) {
    const depthCm = (j / Math.max(1, h - 1)) * maxDepthCm;
    for (let i = 0; i < w; i++) {
      const idx = j * w + i;
      const worldX = -TISSUE_HALF_W + (i / Math.max(1, w - 1)) * TISSUE_WIDTH;
      const lateralCm = worldX - xOffset;
      let pressureForColor = blurredPressure[idx];
      const fieldRelative01 =
        isFocusedProfile && maxPressurePa > 0
          ? clamp01(blurredPressure[idx] / maxPressurePa)
          : undefined;
      if (isPlanar) {
        pressureForColor = pressureForPlanarJetDisplay(
          blurredPressure[idx],
          depthCm,
          lateralCm,
          entryPeakPa,
          maxDepthCm,
          faceRCm,
          visualColormapMax,
        );
      } else if (isFocusedProfile) {
        pressureForColor = pressureForFocusedJetDisplay(
          blurredPressure[idx],
          maxPressurePa,
          entryPeakPa,
        );
      }
      const [r, g, b, a] = pressurePaToColormapRgba(
        pressureForColor,
        blurredReflection[idx],
        {
          mode: "field",
          entryPeakPa,
          intensityWcm2: intensity,
          beamProfile: isPlanar ? "planar" : "focused",
          fieldPeakPa: isFocusedProfile ? maxPressurePa : undefined,
          fieldRelative01,
        },
      );
      const px = idx * 4;
      image.data[px] = r;
      image.data[px + 1] = g;
      image.data[px + 2] = b;
      image.data[px + 3] = a;
    }
  }

  ctx.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas) as CanvasTexture & { fieldStats?: AcousticFieldStats };
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  texture.fieldStats = {
    entryPeakPressurePa: entryPeakPa,
    maxPressurePa,
    maxPressureDepthCm,
  };
  return texture;
}

export function getBeamRadiusAtWorldDepth(
  depthCm: number,
  acoustic: AcousticPhysicsInput,
): number {
  return getBeamRadiusAtDepthCm(depthCm, acoustic);
}
