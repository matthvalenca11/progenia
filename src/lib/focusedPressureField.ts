/**
 * Campo de pressão focalizado — inspirado em simulações tipo Field II.
 * Charuto alongado, interferência no campo próximo, lobos laterais em V.
 */

import { getTransducerDefinition } from "@/config/therapeuticTransducerDefinitions";
import {
  getBeamRadiusAtDepthCm,
  getEquivalentDiameterCm,
  getWavelengthCm,
  type AcousticPhysicsInput,
} from "@/lib/ultrasoundTherapyPhysics";

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Distância perpendicular de (px,pz) ao segmento (ax,az)→(bx,bz). */
function distanceToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-8) return Math.hypot(px - ax, pz - az);
  const t = clamp01(((px - ax) * dx + (pz - az) * dz) / lenSq);
  const qx = ax + t * dx;
  const qz = az + t * dz;
  return Math.hypot(px - qx, pz - qz);
}

/** Interferência de Fresnel — amostras na abertura circular. */
function apertureInterference(
  x: number,
  z: number,
  faceR: number,
  k: number,
  samples = 14,
): number {
  if (z < 0.03) return 1;
  let re = 0;
  let im = 0;
  for (let i = 0; i < samples; i++) {
    const sx = -faceR + (2 * faceR * i) / Math.max(1, samples - 1);
    const dist = Math.hypot(x - sx, z);
    const apod = 0.65 + 0.35 * Math.sqrt(Math.max(0, 1 - (sx / faceR) ** 2));
    const ph = k * dist;
    re += apod * Math.cos(ph);
    im += apod * Math.sin(ph);
  }
  const n = samples;
  re /= n;
  im /= n;
  return re * re + im * im;
}

/** Feixe focalizado com fase convergente (lente acústica). */
function focusedApertureInterference(
  x: number,
  z: number,
  faceR: number,
  focusZ: number,
  k: number,
  samples = 14,
): number {
  if (z < 0.03) return 1;
  let re = 0;
  let im = 0;
  for (let i = 0; i < samples; i++) {
    const sx = -faceR + (2 * faceR * i) / Math.max(1, samples - 1);
    const rPoint = Math.hypot(x - sx, z);
    const rFocus = Math.hypot(sx, focusZ);
    const apod = 0.7 + 0.3 * Math.sqrt(Math.max(0, 1 - (sx / faceR) ** 2));
    const ph = k * (rPoint - rFocus);
    re += apod * Math.cos(ph);
    im += apod * Math.sin(ph);
  }
  const n = samples;
  re /= n;
  im /= n;
  return re * re + im * im;
}

/** Lobos laterais em V — raios da borda da abertura à zona focal. */
function sideLobeWings(
  x: number,
  z: number,
  faceR: number,
  focusZ: number,
  lambda: number,
): number {
  if (z < 0.08 || z > focusZ * 1.55) return 0;

  const rayW = lambda * 0.42;
  const dLeft = distanceToSegment(x, z, -faceR, 0, 0, focusZ);
  const dRight = distanceToSegment(x, z, faceR, 0, 0, focusZ);

  const wingL = Math.exp(-0.5 * (dLeft / rayW) ** 2);
  const wingR = Math.exp(-0.5 * (dRight / rayW) ** 2);

  const depthFade = Math.exp(-z / (focusZ * 1.35));
  const fringe = 0.55 + 0.45 * Math.cos((2 * Math.PI * (dLeft + dRight)) / (lambda * 1.6));

  return (wingL + wingR) * depthFade * fringe * 0.52;
}

/** Charuto alongado (esferoide prolato) — núcleo da zona focal. */
function focalCigarCore(
  x: number,
  z: number,
  focusZ: number,
  waistR: number,
  isConvergent: boolean,
): number {
  const sigmaZ = focusZ * (isConvergent ? 0.42 : 0.5);
  const sigmaX = waistR * (isConvergent ? 0.88 : 1.0);
  return Math.exp(
    -0.5 * ((z - focusZ) / Math.max(sigmaZ, 0.08)) ** 2 -
      0.5 * (x / Math.max(sigmaX, 0.03)) ** 2,
  );
}

/** Nós axiais no campo próximo (antes do foco). */
function nearFieldAxialNodes(
  x: number,
  z: number,
  faceR: number,
  focusZ: number,
  k: number,
): number {
  if (z >= focusZ * 0.92) return 0;
  const onAxis = Math.exp(-0.5 * (x / (faceR * 0.22)) ** 2);
  const nodes = Math.sin(k * z * 1.35) ** 2;
  const ramp = smoothstep(0.05, focusZ * 0.35, z);
  return onAxis * nodes * ramp * 0.42;
}

function smoothstep(edge0: number, edge1: number, t: number): number {
  const u = clamp01((t - edge0) / Math.max(1e-6, edge1 - edge0));
  return u * u * (3 - 2 * u);
}

/** Pós-foco: divergência + nulo axial logo após o charuto. */
function postFocalField(
  x: number,
  z: number,
  focusZ: number,
  beamR: number,
  lambda: number,
): number {
  if (z <= focusZ * 0.88) return 0;
  const dz = z - focusZ;
  const sigmaZ = focusZ * 0.38 + dz * 0.22;
  const spread = Math.exp(-0.5 * (dz / sigmaZ) ** 2 - 0.5 * (x / Math.max(beamR, 0.04)) ** 2);

  let nullMod = 1;
  if (dz < focusZ * 0.28) {
    nullMod = 0.25 + 0.75 * Math.sin((Math.PI * dz) / (focusZ * 0.28)) ** 2;
  }

  const ripple = 0.82 + 0.18 * Math.cos((2 * Math.PI * dz) / (lambda * 2.2));
  return spread * nullMod * ripple * 0.52;
}

/** Acoplamento na interface pele — intensidade finita em z=0 com queda radial da abertura. */
function skinEntryGain(z: number, focusZ: number): number {
  if (z >= focusZ * 0.14) return 1;
  return 0.86 + 0.14 * smoothstep(0, focusZ * 0.14, z);
}

/** Pé do feixe na pele — perfil circular da ERA (não retangular). */
function surfaceApertureGain(x: number, z: number, faceR: number, spreadFactor = 1): number {
  const rn = Math.abs(x) / Math.max(faceR * spreadFactor, 0.035);
  const aperture = Math.exp(-2.35 * rn * rn);
  const surfaceBlend = 1 - smoothstep(0.08, 0.55, z);
  return aperture * surfaceBlend + (1 - surfaceBlend);
}
/** Envoltório do feixe — queda radial suave (sem borda reta). */
function beamEnvelopeMask(
  x: number,
  z: number,
  acoustic: AcousticPhysicsInput,
  spreadFactor = 1,
): number {
  const beamR = Math.max(getBeamRadiusAtDepthCm(z, acoustic), 0.03) * spreadFactor;
  const rn = Math.abs(x) / beamR;
  return Math.exp(-1.65 * rn * rn);
}

/**
 * Intensidade relativa (0–1) do campo focalizado em (lateral, profundidade).
 * Não normalizada — chamar normalizeFocusedField() depois.
 */
export function sampleFocusedPressureField(
  depthCm: number,
  lateralCm: number,
  acoustic: AcousticPhysicsInput,
  spreadFactor = 1,
): number {
  const z = Math.max(0, depthCm);
  const x = lateralCm;
  const diameter = getEquivalentDiameterCm(acoustic.eraCm2, acoustic.transducerType);
  const faceR = diameter / 2;
  const def = getTransducerDefinition(acoustic.transducerType);
  const waistR = faceR * (def.beam.waistRatio ?? 0.24);
  const focusZ = Math.max(acoustic.focusDepthCm, 0.2);
  const lambda = getWavelengthCm(acoustic.frequencyMHz);
  const k = (2 * Math.PI) / Math.max(lambda, 0.001);
  const isConvergent = acoustic.transducerType === "focused_convergent";

  const envelope = beamEnvelopeMask(x, z, acoustic, spreadFactor);
  if (envelope <= 0.001) return 0;

  const cigar = focalCigarCore(x, z, focusZ, waistR, isConvergent);

  const interference = focusedApertureInterference(x, z, faceR, focusZ, k);
  const unfocusedRipple = apertureInterference(x, z, faceR, k);
  const rippleMix =
    z < focusZ * 0.85
      ? 0.35 + 0.65 * interference
      : 0.45 + 0.55 * unfocusedRipple * Math.exp(-(z - focusZ) / (focusZ * 0.5));

  const wings = sideLobeWings(x, z, faceR, focusZ, lambda);
  const axialNodes = nearFieldAxialNodes(x, z, faceR, focusZ, k);
  const post = postFocalField(x, z, focusZ, getBeamRadiusAtDepthCm(z, acoustic), lambda);

  const beamR = getBeamRadiusAtDepthCm(z, acoustic);
  const convergence = clamp01((faceR / Math.max(beamR, waistR * 0.4)) ** 2 / (faceR / waistR) ** 2);

  const preRamp = skinEntryGain(z, focusZ);
  const surfaceGain = surfaceApertureGain(x, z, faceR, spreadFactor);

  const raw =
    envelope *
    preRamp *
    surfaceGain *
    (cigar * 1.15 * rippleMix +
      wings +
      axialNodes +
      post * 0.85 +
      interference * convergence * 0.22 * Math.exp(-(((z - focusZ * 0.5) / (focusZ * 0.55)) ** 2)));

  return Math.max(0, raw);
}

/** Normaliza o buffer para que o pico do charuto → 1 (colormap jet completo). */
export function normalizeFocusedFieldBuffer(buffer: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < buffer.length; i++) {
    peak = Math.max(peak, buffer[i]);
  }
  const scale = peak > 1e-6 ? 1 / peak : 1;
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = clamp01(buffer[i] * scale);
  }
  return peak;
}
