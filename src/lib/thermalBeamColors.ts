/**
 * Colormap térmica — estilo IR clínico: frio transparente → quente vermelho intenso.
 * 37 °C = baseline corporal (sem cor). Quanto mais quente, mais saturado.
 */

import { Color } from "three";

export const COLORMAP_MIN_C = 37;
export const COLORMAP_MAX_C = 43;

/** RGBA — 37 °C transparente; 37–39 °C laranja suave; vermelho intenso só ≥ 40 °C. */
export const THERMAL_COLORMAP_STOPS: Array<{
  temp: number;
  rgba: [number, number, number, number];
}> = [
  { temp: 37.0, rgba: [0, 0, 0, 0] },
  { temp: 37.4, rgba: [255, 148, 52, 14] },
  { temp: 37.8, rgba: [255, 128, 44, 32] },
  { temp: 38.2, rgba: [255, 112, 38, 52] },
  { temp: 38.7, rgba: [255, 96, 32, 78] },
  { temp: 39.2, rgba: [255, 82, 28, 105] },
  { temp: 39.8, rgba: [255, 68, 24, 135] },
  { temp: 40.5, rgba: [255, 52, 18, 175] },
  { temp: 41.5, rgba: [255, 36, 12, 210] },
  { temp: 43.0, rgba: [255, 18, 6, 255] },
];

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpola cor RGBA para temperatura absoluta (°C). */
export function tempToColormapRgba(tempC: number): [number, number, number, number] {
  if (tempC <= COLORMAP_MIN_C + 0.05) {
    return [0, 0, 0, 0];
  }

  for (let i = 0; i < THERMAL_COLORMAP_STOPS.length - 1; i++) {
    const a = THERMAL_COLORMAP_STOPS[i];
    const b = THERMAL_COLORMAP_STOPS[i + 1];
    if (tempC >= a.temp && tempC <= b.temp) {
      const u = (tempC - a.temp) / Math.max(0.001, b.temp - a.temp);
      return [
        Math.round(lerp(a.rgba[0], b.rgba[0], u)),
        Math.round(lerp(a.rgba[1], b.rgba[1], u)),
        Math.round(lerp(a.rgba[2], b.rgba[2], u)),
        Math.round(lerp(a.rgba[3], b.rgba[3], u)),
      ];
    }
  }

  return THERMAL_COLORMAP_STOPS[THERMAL_COLORMAP_STOPS.length - 1].rgba;
}

/** Cor Three.js 0–1 para temperatura absoluta. */
export function tempToHeatColor(tempC: number): Color {
  const [r, g, b] = tempToColormapRgba(tempC);
  return new Color(r / 255, g / 255, b / 255);
}

export function normalizeHeatTemp(tempC: number, minC = COLORMAP_MIN_C, maxC = COLORMAP_MAX_C): number {
  return clamp01((tempC - minC) / (maxC - minC));
}

function tempToCssColor(tempC: number): string {
  const [r, g, b, a] = tempToColormapRgba(tempC);
  if (a < 8) return "rgba(0,0,0,0)";
  return `rgba(${r},${g},${b},${(a / 255).toFixed(2)})`;
}

/** Stops para legenda — frio embaixo, quente em cima, cores derivadas do colormap. */
export function getThermalLegendStops(): Array<{ temp: number; color: string; label: string }> {
  const temps = [37, 38, 39, 40, 41, 43];
  return temps.map((temp) => ({
    temp,
    color: tempToCssColor(temp),
    label: `${temp} °C`,
  }));
}

/** Cores ordenadas para gradiente CSS (frio → quente, de baixo para cima). */
export function getThermalLegendGradient(): string {
  const temps = [37, 38, 39, 40, 41, 43];
  const colors = temps.map((t) => tempToCssColor(t));
  return `linear-gradient(to top, ${colors.join(", ")})`;
}

export function heatColorFromTemp(tempC: number): Color {
  return tempToHeatColor(tempC);
}
