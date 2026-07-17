/**
 * Texturas GPU do campo óptico PBM — colormaps educacionais por modo.
 */

import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";
import type { PhotobioInteractionMap } from "@/lib/photobioInteractionMap";
import type { PhotobioWavelength } from "@/lib/photobioOptics";

export type PhotobioFieldMode = "beam" | "fluence" | "absorption" | "bioresponse";

/** Escala fixa da legenda de fluência (J/cm²) — cores do campo seguem estes limites. */
export const PHOTOBIO_FLUENCE_SCALE_MAX_JCM2 = 15;

export function getPhotobioFluenceScaleLabels(): { min: number; mid: number; max: number } {
  const max = PHOTOBIO_FLUENCE_SCALE_MAX_JCM2;
  return { min: 0, mid: max / 2, max };
}

export function fluenceJcm2ToColormapT(fluenceJcm2: number): number {
  return clamp01(fluenceJcm2 / PHOTOBIO_FLUENCE_SCALE_MAX_JCM2);
}

export interface PhotobioFieldTextureOptions {
  texWidth?: number;
  texHeight?: number;
  wavelength?: PhotobioWavelength;
  blurPasses?: number;
  beamVisualDepthMm?: number;
  penetrationDepthMm?: number;
  maxDepthMm?: number;
  irradianceMwCm2?: number;
  spotSizeCm2?: number;
}

export interface PhotobioFieldTextureStats {
  maxFluenceJcm2: number;
  maxAbsorption: number;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

function sampleMapBilinear(
  map: PhotobioInteractionMap,
  xNorm: number,
  zNorm: number,
): {
  fluenceRelative: number;
  fluenceJcm2: number;
  absorbedRelative: number;
  scatteredRelative: number;
  biologicalActivation: number;
  inhibitionRisk: number;
  thermalRisk: number;
  layerType: string;
} {
  const colF = clamp01((xNorm + 1) / 2) * Math.max(0, map.width - 1);
  const rowF = clamp01(zNorm) * Math.max(0, map.height - 1);
  const c0 = Math.floor(colF);
  const c1 = Math.min(map.width - 1, c0 + 1);
  const r0 = Math.floor(rowF);
  const r1 = Math.min(map.height - 1, r0 + 1);
  const cf = colF - c0;
  const rf = rowF - r0;

  const idx = (row: number, col: number) => row * map.width + col;
  const cells = [
    map.cells[idx(r0, c0)],
    map.cells[idx(r0, c1)],
    map.cells[idx(r1, c0)],
    map.cells[idx(r1, c1)],
  ];
  const w = [
    (1 - cf) * (1 - rf),
    cf * (1 - rf),
    (1 - cf) * rf,
    cf * rf,
  ];

  let fluenceRelative = 0;
  let fluenceJcm2 = 0;
  let absorbedRelative = 0;
  let scatteredRelative = 0;
  let biologicalActivation = 0;
  let inhibitionRisk = 0;
  let thermalRisk = 0;

  for (let i = 0; i < 4; i += 1) {
    const cell = cells[i];
    if (!cell) continue;
    fluenceRelative += cell.fluenceRelative * w[i];
    fluenceJcm2 += cell.fluenceJcm2 * w[i];
    absorbedRelative += cell.absorbedRelative * w[i];
    scatteredRelative += cell.scatteredRelative * w[i];
    biologicalActivation += cell.biologicalActivation * w[i];
    inhibitionRisk += cell.inhibitionRisk * w[i];
    thermalRisk += cell.thermalRisk * w[i];
  }

  return {
    fluenceRelative,
    fluenceJcm2,
    absorbedRelative,
    scatteredRelative,
    biologicalActivation,
    inhibitionRisk,
    thermalRisk,
    layerType: cells[0]?.layerType ?? "dermis",
  };
}

const FLUENCE_STOPS: Array<[number, number, number]> = [
  [8, 12, 48],
  [24, 72, 180],
  [40, 180, 120],
  [220, 220, 40],
  [220, 60, 30],
];

const LAYER_TINT: Record<string, [number, number, number]> = {
  epidermis: [255, 190, 150],
  dermis: [240, 150, 130],
  adipose: [255, 240, 170],
  muscle: [200, 110, 110],
  bone: [230, 230, 220],
};

const BEAM_660_STOPS: Array<[number, number, number]> = [
  [255, 255, 245],
  [255, 240, 80],
  [255, 160, 0],
  [255, 70, 0],
  [140, 10, 0],
];

const BEAM_808_STOPS: Array<[number, number, number]> = [
  [255, 245, 255],
  [255, 120, 255],
  [255, 0, 220],
  [180, 0, 180],
  [70, 0, 110],
];

function sampleMultiStop(stops: Array<[number, number, number]>, t: number): [number, number, number] {
  const u = clamp01(t) * (stops.length - 1);
  const i = Math.floor(u);
  const f = u - i;
  const a = stops[Math.min(i, stops.length - 1)];
  const b = stops[Math.min(i + 1, stops.length - 1)];
  return lerpRgb(a, b, f);
}

function beamColormap(
  intensity: number,
  wavelength: PhotobioWavelength,
  depthNorm: number,
): [number, number, number, number] {
  const u = clamp01(intensity);
  const depth = clamp01(depthNorm);
  const stops = wavelength === 660 ? BEAM_660_STOPS : BEAM_808_STOPS;

  const energyT = Math.pow(u, 0.62);
  const depthT = Math.pow(depth, 0.78);
  const combined = clamp01(energyT * (1 - depth * 0.35) + depthT * 0.4);

  const rgb = sampleMultiStop(stops, combined);
  const satBoost = 1.08 + u * 0.22;
  const vivid: [number, number, number] = [
    Math.min(255, Math.round(rgb[0] * satBoost)),
    Math.min(255, Math.round(rgb[1] * satBoost)),
    Math.min(255, Math.round(rgb[2] * satBoost)),
  ];

  const alpha = (0.2 + u * 0.78) * (1 - depth * 0.22);
  return [...vivid, Math.round(alpha * 255)];
}

function fluenceColormap(t: number): [number, number, number, number] {
  const u = clamp01(t);
  const scaled = u * (FLUENCE_STOPS.length - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = FLUENCE_STOPS[Math.min(i, FLUENCE_STOPS.length - 1)];
  const b = FLUENCE_STOPS[Math.min(i + 1, FLUENCE_STOPS.length - 1)];
  const rgb = lerpRgb(a, b, f);
  return [...rgb, Math.round(30 + u * 215)];
}

function absorptionColormap(
  absorbed: number,
  layerType: string,
): [number, number, number, number] {
  const tint = LAYER_TINT[layerType] ?? [200, 200, 200];
  const u = clamp01(absorbed);
  const rgb = lerpRgb([12, 12, 18], tint, 0.35 + u * 0.65);
  return [...rgb, Math.round(25 + u * 220)];
}

function bioresponseColormap(
  activation: number,
  inhibition: number,
): [number, number, number, number] {
  if (inhibition > 0.55) {
    return [220, 40, 40, Math.round(120 + inhibition * 120)];
  }
  if (activation > 0.5) {
    const rgb = lerpRgb([80, 90, 100], [40, 220, 180], activation);
    return [...rgb, Math.round(80 + activation * 160)];
  }
  const gray = Math.round(60 + activation * 80);
  return [gray, gray + 8, gray + 16, Math.round(40 + activation * 100)];
}

function blurFieldBuffer(
  colorBuffer: Uint8ClampedArray,
  alphaField: Float32Array,
  w: number,
  h: number,
  passes: number,
): void {
  const rgb = new Float32Array(w * h * 3);
  const alpha = alphaField.slice();
  const nextRgb = new Float32Array(w * h * 3);
  const nextAlpha = new Float32Array(w * h);

  for (let i = 0; i < w * h; i += 1) {
    rgb[i * 3] = colorBuffer[i * 4];
    rgb[i * 3 + 1] = colorBuffer[i * 4 + 1];
    rgb[i * 3 + 2] = colorBuffer[i * 4 + 2];
  }

  for (let p = 0; p < passes; p += 1) {
    for (let j = 0; j < h; j += 1) {
      for (let i = 0; i < w; i += 1) {
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let aSum = 0;
        let count = 0;
        for (let dj = -1; dj <= 1; dj += 1) {
          for (let di = -1; di <= 1; di += 1) {
            const ni = i + di;
            const nj = j + dj;
            if (ni < 0 || ni >= w || nj < 0 || nj >= h) continue;
            const idx = nj * w + ni;
            rSum += rgb[idx * 3];
            gSum += rgb[idx * 3 + 1];
            bSum += rgb[idx * 3 + 2];
            aSum += alpha[idx];
            count += 1;
          }
        }
        const inv = 1 / Math.max(1, count);
        const out = j * w + i;
        nextRgb[out * 3] = rSum * inv;
        nextRgb[out * 3 + 1] = gSum * inv;
        nextRgb[out * 3 + 2] = bSum * inv;
        nextAlpha[out] = aSum * inv;
      }
    }
    rgb.set(nextRgb);
    alpha.set(nextAlpha);
  }

  for (let i = 0; i < w * h; i += 1) {
    colorBuffer[i * 4] = Math.round(rgb[i * 3]);
    colorBuffer[i * 4 + 1] = Math.round(rgb[i * 3 + 1]);
    colorBuffer[i * 4 + 2] = Math.round(rgb[i * 3 + 2]);
    colorBuffer[i * 4 + 3] = Math.round(alpha[i] * 255);
  }
}

export function buildPhotobioFieldTexture(
  map: PhotobioInteractionMap,
  mode: PhotobioFieldMode,
  options: PhotobioFieldTextureOptions = {},
): CanvasTexture {
  const wavelength = options.wavelength ?? map.wavelength;
  const w =
    options.texWidth ??
    (mode === "beam" ? Math.min(320, map.width * 4) : Math.min(256, map.width * 3));
  const h =
    options.texHeight ??
    (mode === "beam" ? Math.min(400, map.height * 5) : Math.min(320, map.height * 4));
  const blurPasses = options.blurPasses ?? (mode === "beam" ? 4 : 3);
  const maxDepthMm = options.maxDepthMm ?? map.maxDepthMm;
  const beamVisualDepthMm = options.beamVisualDepthMm ?? maxDepthMm;
  const penetrationDepthMm = options.penetrationDepthMm ?? beamVisualDepthMm;
  const beamDepthNorm = clamp01(beamVisualDepthMm / Math.max(maxDepthMm, 0.1));
  const penetrationNorm = clamp01(penetrationDepthMm / Math.max(maxDepthMm, 0.1));
  const irradianceMwCm2 = options.irradianceMwCm2 ?? 100;
  const irradianceNorm = clamp01(irradianceMwCm2 / 650);
  const powerGain = 0.18 + irradianceNorm * 1.05;
  const thermalRisk = clamp01((irradianceMwCm2 - 420) / 380);

  const alphaField = new Float32Array(w * h);
  const colorBuffer = new Uint8ClampedArray(w * h * 4);

  const maxAbs = Math.max(map.maxAbsorption, 0.01);

  for (let j = 0; j < h; j += 1) {
    const zNorm = j / Math.max(1, h - 1);
    for (let i = 0; i < w; i += 1) {
      const xNorm = (i / Math.max(1, w - 1)) * 2 - 1;
      const sample = sampleMapBilinear(map, xNorm, zNorm);
      let rgba: [number, number, number, number];

      if (mode === "beam") {
        const depthMask =
          zNorm <= beamDepthNorm
            ? 1
            : Math.max(0, 1 - (zNorm - beamDepthNorm) / 0.07);
        const penetrationMask =
          zNorm <= penetrationNorm
            ? 1
            : Math.max(0, 1 - (zNorm - penetrationNorm) / 0.05);
        const mask = depthMask * penetrationMask;
        const scatterBoost = 1 + sample.scatteredRelative * 0.18;
        const visIntensity = clamp01(sample.fluenceRelative * powerGain * mask * scatterBoost);
        rgba = beamColormap(visIntensity, wavelength, zNorm);
        if (thermalRisk > 0.05 && zNorm < 0.22) {
          const superficial = (1 - zNorm / 0.22) * thermalRisk * visIntensity;
          rgba[0] = Math.min(255, rgba[0] + superficial * 180);
          rgba[1] = Math.max(0, rgba[1] - superficial * 55);
          rgba[2] = Math.max(0, rgba[2] - superficial * 45);
        }
        rgba[3] = Math.round(rgba[3] * clamp01(visIntensity * 1.08));
      } else if (mode === "fluence") {
        rgba = fluenceColormap(fluenceJcm2ToColormapT(sample.fluenceJcm2));
        rgba[3] = Math.min(255, Math.round(rgba[3] * 1.25));
      } else if (mode === "absorption") {
        rgba = absorptionColormap(sample.absorbedRelative / maxAbs, sample.layerType);
        rgba[3] = Math.min(255, Math.round(rgba[3] * 1.35));
      } else {
        rgba = bioresponseColormap(sample.biologicalActivation, sample.inhibitionRisk);
        rgba[3] = Math.min(255, Math.round(rgba[3] * 1.2));
      }

      const idx = j * w + i;
      alphaField[idx] = rgba[3] / 255;
      const px = idx * 4;
      colorBuffer[px] = rgba[0];
      colorBuffer[px + 1] = rgba[1];
      colorBuffer[px + 2] = rgba[2];
      colorBuffer[px + 3] = rgba[3];
    }
  }

  if (mode === "beam") {
    blurFieldBuffer(colorBuffer, alphaField, w, h, blurPasses);
  } else {
    const blurredAlpha = alphaField.slice();
    for (let p = 0; p < blurPasses; p += 1) {
      const next = new Float32Array(w * h);
      for (let j = 0; j < h; j += 1) {
        for (let i = 0; i < w; i += 1) {
          let sum = 0;
          let count = 0;
          for (let dj = -1; dj <= 1; dj += 1) {
            for (let di = -1; di <= 1; di += 1) {
              const ni = i + di;
              const nj = j + dj;
              if (ni < 0 || ni >= w || nj < 0 || nj >= h) continue;
              sum += blurredAlpha[nj * w + ni];
              count += 1;
            }
          }
          next[j * w + i] = sum / Math.max(1, count);
        }
      }
      blurredAlpha.set(next);
    }
    for (let i = 0; i < w * h; i += 1) {
      colorBuffer[i * 4 + 3] = Math.round(blurredAlpha[i] * 255);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = new CanvasTexture(canvas);
    fallback.colorSpace = SRGBColorSpace;
    return fallback;
  }

  const image = new ImageData(colorBuffer, w, h);
  ctx.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function getPhotobioFieldLegendGradient(mode: PhotobioFieldMode, wavelength: PhotobioWavelength): string {
  const stops = 8;
  const parts: string[] = [];
  for (let i = 0; i <= stops; i += 1) {
    const t = i / stops;
    const pct = (t * 100).toFixed(1);
    let rgb: [number, number, number];
    if (mode === "beam") {
      rgb = beamColormap(t, wavelength, 1 - t * 0.55).slice(0, 3) as [number, number, number];
    } else if (mode === "fluence") {
      rgb = fluenceColormap(t).slice(0, 3) as [number, number, number];
    } else if (mode === "absorption") {
      rgb = absorptionColormap(t, "dermis").slice(0, 3) as [number, number, number];
    } else {
      rgb = bioresponseColormap(t, t > 0.7 ? 0.8 : 0).slice(0, 3) as [number, number, number];
    }
    parts.push(`rgb(${rgb[0]},${rgb[1]},${rgb[2]}) ${pct}%`);
  }
  return `linear-gradient(to top, ${parts.join(", ")})`;
}

export function getPhotobioFieldModeLabel(mode: PhotobioFieldMode): string {
  switch (mode) {
    case "beam":
      return "Feixe";
    case "fluence":
      return "Fluência";
    case "absorption":
      return "Absorção";
    case "bioresponse":
      return "Resposta";
    default:
      return mode;
  }
}

export function getPhotobioFieldModeDescription(mode: PhotobioFieldMode): string {
  switch (mode) {
    case "beam":
      return "Energia óptica — o feixe esmaece onde a luz deixa de penetrar (ver legenda)";
    case "fluence":
      return "Fluência acumulada (J/cm²)";
    case "absorption":
      return "Deposição óptica por camada";
    case "bioresponse":
      return "Verde = janela terapêutica · vermelho = inibição (por célula simulada)";
    default:
      return "";
  }
}
