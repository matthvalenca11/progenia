/**
 * Campo térmico suave — temperatura absoluta no colormap, dissipação radial, escala com intensidade.
 */

import { CanvasTexture, SRGBColorSpace } from "three";
import type { UltrasoundInteractionMap } from "@/lib/ultrasoundTherapyInteractionMap";
import { tempToColormapRgba } from "@/lib/thermalBeamColors";

const TISSUE_WIDTH = 20;
const TISSUE_HALF_W = TISSUE_WIDTH / 2;
const LATERAL_SPAN = 4.4;
/** Largura máxima do feixe na textura (cm) — evita bleed nas bordas do bloco */
export const THERMAL_BEAM_HALF_WIDTH_CM = LATERAL_SPAN * 1.1;

export interface ThermalFieldTextureOptions {
  xOffset?: number;
  intensity?: number;
  maxTemp?: number;
  texWidth?: number;
  texHeight?: number;
  blurPasses?: number;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function applyLateralBeamMask(
  blurred: Float32Array,
  w: number,
  h: number,
  xOffset: number,
): void {
  const halfWidth = THERMAL_BEAM_HALF_WIDTH_CM;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const idx = j * w + i;
      const rise = blurred[idx] - 37;
      if (rise <= 0) continue;
      const worldX = -TISSUE_HALF_W + (i / Math.max(1, w - 1)) * TISSUE_WIDTH;
      const mask = 1 - smoothstep(halfWidth * 0.85, halfWidth * 1.2, Math.abs(worldX - xOffset));
      blurred[idx] = 37 + rise * mask;
    }
  }
}

function sampleCellTemp(
  map: UltrasoundInteractionMap,
  beamXNorm: number,
  depthCm: number,
): number {
  if (Math.abs(beamXNorm) > 1.2 || depthCm < 0 || depthCm > map.maxDepthCm + 0.01) {
    return 37;
  }

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
  const samples = [
    cells[idx(r0, c0)],
    cells[idx(r0, c1)],
    cells[idx(r1, c0)],
    cells[idx(r1, c1)],
  ];
  const weights = [
    (1 - cf) * (1 - rf),
    cf * (1 - rf),
    (1 - cf) * rf,
    cf * rf,
  ];

  let temp = 0;
  for (let i = 0; i < 4; i++) {
    temp += weights[i] * samples[i].estimatedTemp;
  }
  return temp;
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
        const sx = Math.min(w - 1, Math.max(0, x + k));
        sum += src[y * w + sx];
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
        const sy = Math.min(h - 1, Math.max(0, y + k));
        sum += src[sy * w + x];
        count++;
      }
      dst[y * w + x] = sum / count;
    }
  }
}

function blurTemperatureField(data: Float32Array, w: number, h: number, passes: number): Float32Array {
  const radius = Math.max(2, Math.round(Math.min(w, h) * 0.022));
  const bufA = new Float32Array(data);
  const bufB = new Float32Array(w * h);
  let src = bufA;
  let dst = bufB;

  for (let p = 0; p < passes; p++) {
    blurHorizontal(src, dst, w, h, radius);
    blurVertical(dst, src, w, h, radius);
    const swap = src;
    src = dst;
    dst = swap;
  }

  return src;
}

export function buildThermalHeatTexture(
  interactionMap: UltrasoundInteractionMap,
  maxTemp: number,
  options: ThermalFieldTextureOptions = {},
): CanvasTexture {
  const {
    xOffset = 0,
    intensity = 1,
    texWidth = 200,
    texHeight = 256,
    blurPasses = 7,
  } = options;

  const w = texWidth;
  const h = texHeight;
  const raw = new Float32Array(w * h);

  for (let j = 0; j < h; j++) {
    const depthCm = (j / Math.max(1, h - 1)) * interactionMap.maxDepthCm;
    for (let i = 0; i < w; i++) {
      const worldX = -TISSUE_HALF_W + (i / Math.max(1, w - 1)) * TISSUE_WIDTH;
      const beamXNorm = (worldX - xOffset) / LATERAL_SPAN;
      raw[j * w + i] = sampleCellTemp(interactionMap, beamXNorm, depthCm);
    }
  }

  const blurred = blurTemperatureField(raw, w, h, blurPasses);
  applyLateralBeamMask(blurred, w, h, xOffset);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = new CanvasTexture(canvas);
    fallback.colorSpace = SRGBColorSpace;
    return fallback;
  }

  const image = ctx.createImageData(w, h);

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const tempC = blurred[j * w + i];
      const [r, g, b, a] = tempToColormapRgba(tempC);
      const px = (j * w + i) * 4;
      image.data[px] = r;
      image.data[px + 1] = g;
      image.data[px + 2] = b;
      image.data[px + 3] = a;
    }
  }

  ctx.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
