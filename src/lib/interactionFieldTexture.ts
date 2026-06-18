/**
 * Textura do modo Propagação — fenômenos acústicos na face da seção transversal.
 * Cada toggle liga/desliga uma camada de cor de forma independente.
 */

import { CanvasTexture, SRGBColorSpace } from "three";
import type { UltrasoundInteractionCell, UltrasoundInteractionMap } from "@/lib/ultrasoundTherapyInteractionMap";
import type { UltrasoundVisualizationOptions } from "@/types/ultrasoundTherapyConfig";

const TISSUE_WIDTH = 20;
const TISSUE_HALF_W = TISSUE_WIDTH / 2;
const LATERAL_SPAN = 4.4;

export interface InteractionFieldTextureOptions {
  xOffset?: number;
  texWidth?: number;
  texHeight?: number;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hasActiveLayer(options: UltrasoundVisualizationOptions): boolean {
  return (
    options.showPropagation ||
    options.showAttenuation ||
    options.showReflection ||
    options.showCavitation ||
    options.showStandingWaves ||
    options.showTissueResponse ||
    options.showThermalDamage ||
    options.showAblation ||
    options.showSafetyZones
  );
}

function sampleCell(
  map: UltrasoundInteractionMap,
  beamXNorm: number,
  depthCm: number,
): UltrasoundInteractionCell | null {
  if (Math.abs(beamXNorm) > 1.25 || depthCm < 0 || depthCm > map.maxDepthCm + 0.01) {
    return null;
  }

  const { width, height, maxDepthCm, cells } = map;
  const colF = clamp01((beamXNorm + 1) / 2) * Math.max(0, width - 1);
  const rowF = clamp01(depthCm / Math.max(0.01, maxDepthCm)) * Math.max(0, height - 1);

  const c0 = Math.floor(colF);
  const c1 = Math.min(width - 1, c0 + 1);
  const r0 = Math.floor(rowF);
  const r1 = Math.min(height - 1, r0 + 1);

  const idx = (row: number, col: number) => row * width + col;
  const samples = [
    cells[idx(r0, c0)],
    cells[idx(r0, c1)],
    cells[idx(r1, c0)],
    cells[idx(r1, c1)],
  ];
  const weights = [
    (1 - (colF - c0)) * (1 - (rowF - r0)),
    (colF - c0) * (1 - (rowF - r0)),
    (1 - (colF - c0)) * (rowF - r0),
    (colF - c0) * (rowF - r0),
  ];

  const blend = (pick: (c: UltrasoundInteractionCell) => number) => {
    let v = 0;
    for (let i = 0; i < 4; i++) v += weights[i] * pick(samples[i]);
    return v;
  };

  return {
    xNorm: blend((c) => c.xNorm),
    depthCm,
    tissueKind: samples[0].tissueKind,
    relativeIntensity: blend((c) => c.relativeIntensity),
    pressureProxy: blend((c) => c.pressureProxy),
    attenuationLoss: blend((c) => c.attenuationLoss),
    thermalRate: blend((c) => c.thermalRate),
    estimatedTemp: blend((c) => c.estimatedTemp),
    cavitationIndex: blend((c) => c.cavitationIndex),
    reflectionIndex: blend((c) => c.reflectionIndex),
    standingWaveIndex: blend((c) => c.standingWaveIndex),
    tissueStressIndex: blend((c) => c.tissueStressIndex),
    lesionIndex: blend((c) => c.lesionIndex),
    ablationIndex: blend((c) => c.ablationIndex),
  };
}

function cellToRgba(
  cell: UltrasoundInteractionCell,
  depthCm: number,
  options: UltrasoundVisualizationOptions,
): [number, number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;

  if (options.showPropagation && cell.relativeIntensity > 0.04) {
    const t = clamp01(cell.relativeIntensity);
    r += lerp(20, 80, t);
    g += lerp(120, 210, t);
    b += lerp(220, 255, t);
    a = Math.max(a, Math.round(lerp(55, 220, Math.pow(t, 0.72))));
  }

  if (options.showAttenuation && cell.relativeIntensity > 0.03) {
    const loss = clamp01(cell.attenuationLoss);
    const depthShade = clamp01(depthCm / 5.5);
    const t = loss * 0.55 + depthShade * 0.45;
    r += 40 + t * 35;
    g += 55 + t * 40;
    b += 75 + t * 55;
    a = Math.max(a, Math.round(35 + t * 120));
  }

  if (options.showReflection && cell.reflectionIndex > 0.06) {
    const t = clamp01(cell.reflectionIndex);
    r += 180 + t * 75;
    g += 110 + t * 70;
    b += 20 + t * 25;
    a = Math.max(a, Math.round(80 + t * 175));
  }

  if (options.showStandingWaves && cell.standingWaveIndex > 0.04) {
    const band = 0.5 + 0.5 * Math.sin(depthCm * 13.5);
    const t = clamp01(cell.standingWaveIndex * band);
    r += 90 + t * 60;
    g += 50 + t * 40;
    b += 170 + t * 85;
    a = Math.max(a, Math.round(45 + t * 165));
  }

  if (options.showTissueResponse) {
    const heat = clamp01((cell.estimatedTemp - 37) / 11);
    if (heat > 0.04) {
      r += 160 + heat * 95;
      g += 55 + heat * 55;
      b += 45 + heat * 20;
      a = Math.max(a, Math.round(50 + heat * 185));
    }
  }

  if (options.showThermalDamage && cell.lesionIndex > 0.05) {
    const t = clamp01(cell.lesionIndex);
    r += 200 + t * 55;
    g += 75 + t * 45;
    b += 10;
    a = Math.max(a, Math.round(70 + t * 185));
  }

  if (options.showAblation && cell.ablationIndex > 0.06) {
    const t = clamp01(cell.ablationIndex);
    r += 230 + t * 25;
    g += 30 + t * 20;
    b += 25;
    a = Math.max(a, Math.round(85 + t * 170));
  }

  if (options.showCavitation && cell.cavitationIndex > 0.05) {
    const t = clamp01(cell.cavitationIndex);
    r += 70 + t * 40;
    g += 140 + t * 80;
    b += 220 + t * 35;
    a = Math.max(a, Math.round(40 + t * 155));
  }

  if (options.showSafetyZones && cell.estimatedTemp <= 41 && cell.lesionIndex < 0.14) {
    const safe = clamp01(1 - cell.lesionIndex * 3) * clamp01((41.5 - cell.estimatedTemp) / 4.5);
    if (safe > 0.12 && cell.relativeIntensity > 0.05) {
      r += 40 * safe;
      g += 130 + safe * 110;
      b += 55 + safe * 45;
      a = Math.max(a, Math.round(28 + safe * 95));
    }
  }

  if (a < 12) return [0, 0, 0, 0];

  const peak = Math.max(r, g, b, 1);
  if (peak > 255) {
    const s = 255 / peak;
    r *= s;
    g *= s;
    b *= s;
  }

  return [Math.round(r), Math.round(g), Math.round(b), Math.min(245, Math.round(a))];
}

export function buildInteractionFieldTexture(
  interactionMap: UltrasoundInteractionMap,
  options: UltrasoundVisualizationOptions,
  textureOptions: InteractionFieldTextureOptions = {},
): CanvasTexture {
  const { xOffset = 0, texWidth = 240, texHeight = 300 } = textureOptions;
  const canvas = document.createElement("canvas");
  canvas.width = texWidth;
  canvas.height = texHeight;

  const empty = new CanvasTexture(canvas);
  empty.colorSpace = SRGBColorSpace;

  if (!hasActiveLayer(options)) {
    return empty;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return empty;

  const image = ctx.createImageData(texWidth, texHeight);
  const w = texWidth;
  const h = texHeight;

  for (let j = 0; j < h; j++) {
    const depthCm = (j / Math.max(1, h - 1)) * interactionMap.maxDepthCm;
    for (let i = 0; i < w; i++) {
      const worldX = -TISSUE_HALF_W + (i / Math.max(1, w - 1)) * TISSUE_WIDTH;
      const beamXNorm = (worldX - xOffset) / LATERAL_SPAN;
      const cell = sampleCell(interactionMap, beamXNorm, depthCm);
      const px = (j * w + i) * 4;

      if (!cell) {
        image.data[px] = 0;
        image.data[px + 1] = 0;
        image.data[px + 2] = 0;
        image.data[px + 3] = 0;
        continue;
      }

      const [r, g, b, a] = cellToRgba(cell, depthCm, options);
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
