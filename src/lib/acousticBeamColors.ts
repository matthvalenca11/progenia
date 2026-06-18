/**
 * Colormap jet — legenda em escala fixa; campo 3D com mapeamento híbrido.
 */

import {
  formatPressurePaCompact,
  getAcousticColormapMaxPa,
  getAcousticFieldVisibilityRel,
  getAcousticFocusedFieldVisibilityRel,
  getAcousticLegendPressureStopsPa,
  pressureToColormapT,
  pressureToDisplayColormapT,
  pressureToPlanarFieldColormapT,
  type AcousticBeamProfileKind,
} from "@/lib/acousticPressure";

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const JET_STOPS: Array<[number, number, number]> = [
  [0, 0, 127],
  [0, 0, 255],
  [0, 127, 255],
  [0, 255, 255],
  [0, 255, 0],
  [255, 255, 0],
  [255, 127, 0],
  [255, 0, 0],
  [127, 0, 0],
];

export function jetRgb(t: number): [number, number, number] {
  const u = clamp01(t) * (JET_STOPS.length - 1);
  const i = Math.floor(u);
  const f = u - i;
  const a = JET_STOPS[Math.min(i, JET_STOPS.length - 1)];
  const b = JET_STOPS[Math.min(i + 1, JET_STOPS.length - 1)];
  return [
    Math.round(lerp(a[0], b[0], f)),
    Math.round(lerp(a[1], b[1], f)),
    Math.round(lerp(a[2], b[2], f)),
  ];
}

export interface PressureColormapOptions {
  entryPeakPa?: number;
  beamProfile?: AcousticBeamProfileKind;
  /** Intensidade da sessão (W/cm²) — abre área visível do feixe */
  intensityWcm2?: number;
  /** Pico do campo (Pa) — normalização relativa do feixe focalizado */
  fieldPeakPa?: number;
  /** Pressão relativa ao pico do campo (0–1) — alpha do feixe focalizado */
  fieldRelative01?: number;
  /** legend = escala fixa; field = híbrido com contraste local */
  mode?: "legend" | "field";
}

function resolveColormapT(pressurePa: number, options?: PressureColormapOptions): number {
  const entryPeak = options?.entryPeakPa ?? 0;

  if (options?.mode === "field" && entryPeak > 0) {
    const profile = options?.beamProfile ?? "focused";
    return pressureToDisplayColormapT(pressurePa, entryPeak, profile);
  }
  return pressureToColormapT(pressurePa);
}

/** RGBA a partir de pressão (Pa). */
export function pressurePaToColormapRgba(
  pressurePa: number,
  reflectionIndex = 0,
  options?: PressureColormapOptions,
): [number, number, number, number] {
  const isField = options?.mode === "field";
  const entryPeak = options?.entryPeakPa ?? 0;
  const isFocusedField = isField && options?.beamProfile === "focused";
  const fieldRel = options?.fieldRelative01;
  const relP =
    isFocusedField && fieldRel != null
      ? fieldRel
      : entryPeak > 0
        ? pressurePa / entryPeak
        : 0;
  const visibilityRel = isField
    ? isFocusedField
      ? getAcousticFocusedFieldVisibilityRel(options?.intensityWcm2 ?? 1.5)
      : getAcousticFieldVisibilityRel(options?.intensityWcm2 ?? 1.5)
    : 0.1;

  if (isField && reflectionIndex <= 0.05 && relP < visibilityRel) {
    return [0, 0, 0, 0];
  }

  const t = resolveColormapT(pressurePa, options);

  if (!isField && t <= 0.02 && reflectionIndex <= 0.05) {
    return [0, 0, 0, 0];
  }

  const displayGamma = isFocusedField ? 0.68 : isField ? 0.52 : 0.78;
  const displayT = clamp01(Math.pow(t, displayGamma));
  const [r, g, b] = jetRgb(displayT);

  let alpha: number;
  if (isField) {
    const alphaSpan = isFocusedField ? 0.42 : 0.55;
    const alphaT = clamp01((relP - visibilityRel) / (alphaSpan - visibilityRel));
    const alphaPow = isFocusedField ? 0.55 : 0.62;
    alpha = Math.round(lerp(0, 228, Math.pow(alphaT, alphaPow)));
    if (!isFocusedField && displayT < 0.28 && relP < 0.28) {
      const fringeFade = clamp01((relP - visibilityRel) / (0.28 - visibilityRel));
      alpha = Math.round(alpha * fringeFade * fringeFade);
    }
  } else {
    const baseAlpha = clamp01((t - 0.02) / 0.58);
    alpha = Math.round(lerp(0, 235, Math.pow(baseAlpha, 0.72)));
  }

  if (reflectionIndex > 0.05) {
    const rt = clamp01(reflectionIndex * 0.85);
    const warmR = Math.round(lerp(r, 255, rt * 0.55));
    const warmG = Math.round(lerp(g, 195, rt * 0.45));
    const warmB = Math.round(lerp(b, 60, rt * 0.7));
    return [
      warmR,
      warmG,
      warmB,
      Math.min(210, Math.max(alpha, Math.round(90 + rt * 70))),
    ];
  }

  return [r, g, b, alpha];
}

function pressureToCssColor(pressurePa: number): string {
  const [r, g, b, a] = pressurePaToColormapRgba(pressurePa, 0, { mode: "legend" });
  if (a < 8) return "rgba(0,0,0,0)";
  return `rgba(${r},${g},${b},${(a / 255).toFixed(2)})`;
}

export function getAcousticLegendStops(): Array<{
  pressurePa: number;
  color: string;
  label: string;
}> {
  return getAcousticLegendPressureStopsPa().map((pressurePa) => ({
    pressurePa,
    color: pressureToCssColor(pressurePa),
    label: pressurePa <= 0 ? "0 Pa" : formatPressurePaCompact(pressurePa),
  }));
}

export function getAcousticLegendGradient(): string {
  const stops = getAcousticLegendPressureStopsPa();
  const colors = stops.map((pa) => pressureToCssColor(pa));
  return `linear-gradient(to top, ${colors.join(", ")})`;
}
