/**
 * Pressão acústica de pico (Pa) a partir de intensidade terapêutica.
 * I = P² / (2ρc)  →  P_peak = √(2 · Z · I), com Z = ρc ≈ 1,54×10⁶ Pa·s/m.
 */

export const TISSUE_ACOUSTIC_IMPEDANCE = 1.54e6;

/** Intensidade máxima do lab (W/cm²) — referência da escala fixa. */
export const ACOUSTIC_REFERENCE_MAX_INTENSITY_WCM2 = 5.0;
/** Ganho focal educacional máximo sobre a pressão de entrada. */
export const ACOUSTIC_REFERENCE_FOCAL_GAIN = 2.6;
/** Intensidade de referência (W/cm²) para abrir o registro quente do jet. */
export const ACOUSTIC_WARM_REFERENCE_INTENSITY_WCM2 = 2.0;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Teto fixo da escala jet (Pa) — não depende da intensidade atual. */
export function getAcousticColormapMaxPa(): number {
  const entry = intensityWcm2ToPeakPressurePa(
    ACOUSTIC_REFERENCE_MAX_INTENSITY_WCM2 * 0.95,
  );
  return entry * ACOUSTIC_REFERENCE_FOCAL_GAIN;
}

/** Mapeia pressão absoluta (Pa) → 0–1 na escala jet fixa. */
export function pressureToColormapT(pressurePa: number): number {
  const maxPa = getAcousticColormapMaxPa();
  if (maxPa <= 0) return 0;
  return clamp01(pressurePa / maxPa);
}

/** Valores fixos (Pa) para rótulos da legenda. */
export function getAcousticLegendPressureStopsPa(): number[] {
  const maxPa = getAcousticColormapMaxPa();
  const maxKpa = maxPa / 1000;
  const step = maxKpa / 5;
  return [0, step, step * 2, step * 3, step * 4, maxKpa].map((kpa) => kpa * 1000);
}

/** Piso mínimo do teto visual (Pa) — contraste em baixa intensidade. */
export const ACOUSTIC_VISUAL_MIN_CEILING_PA = 85_000;

export type AcousticBeamProfileKind = "planar" | "focused";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 0–1 — ancora da intensidade atual na faixa terapêutica do lab. */
export function getAcousticIntensityAnchor(intensityWcm2: number): number {
  return clamp01((intensityWcm2 - 0.35) / 4.2);
}

/**
 * Limiar relativo de visibilidade do campo.
 * Baixa intensidade → feixe estreito; alta → franjas fracas ainda aparecem (área maior).
 */
export function getAcousticFieldVisibilityRel(intensityWcm2: number): number {
  const t = getAcousticIntensityAnchor(intensityWcm2);
  return lerp(0.26, 0.018, Math.pow(t, 0.82));
}

/** Limiar de visibilidade do feixe focalizado — franjas e lobos laterais entram no jet. */
export function getAcousticFocusedFieldVisibilityRel(intensityWcm2: number): number {
  const t = getAcousticIntensityAnchor(intensityWcm2);
  return lerp(0.028, 0.004, Math.pow(t, 0.75));
}

/**
 * Fator de abertura lateral do feixe (1 = perfil físico base).
 * Intensidade alta amplia a área colorida — o gradiente cobre mais variação de pressão.
 */
export function getAcousticIntensitySpreadFactor(intensityWcm2: number): number {
  const t = getAcousticIntensityAnchor(intensityWcm2);
  return 1 + Math.pow(t, 1.15) * 1.65;
}

/**
 * Teto da escala de cores nesta sessão.
 * Em alta intensidade usa teto mais baixo → núcleo do feixe ocupa faixa quente do jet.
 */
export function getVisualColormapMaxPa(
  entryPeakPa: number,
  beamProfile: AcousticBeamProfileKind = "planar",
): number {
  const fixedMax = getAcousticColormapMaxPa();
  const refEntry = intensityWcm2ToPeakPressurePa(ACOUSTIC_WARM_REFERENCE_INTENSITY_WCM2 * 0.95);
  const intensityAnchor = clamp01(entryPeakPa / Math.max(refEntry, 1));

  const lowFloor = Math.max(ACOUSTIC_VISUAL_MIN_CEILING_PA, entryPeakPa * 1.15);
  const midCeiling = entryPeakPa * (beamProfile === "focused" ? 1.55 : 1.38);
  const highTight = entryPeakPa * (beamProfile === "focused" ? 1.22 : 1.02);

  let ceiling: number;
  if (intensityAnchor < 0.38) {
    ceiling = Math.max(entryPeakPa * (beamProfile === "focused" ? 2.0 : 1.45), lowFloor);
  } else if (intensityAnchor < 0.72) {
    ceiling = midCeiling;
  } else {
    ceiling = highTight;
  }

  return Math.min(fixedMax, ceiling);
}

/**
 * Mapeamento do feixe plano: cor ligada à pressão relativa à entrada (gradiente com profundidade).
 */
export function pressureToPlanarFieldColormapT(
  pressurePa: number,
  entryPeakPa: number,
): number {
  if (entryPeakPa <= 0) return 0;
  const relP = clamp01(pressurePa / entryPeakPa);
  return clamp01(Math.pow(relP, 0.9));
}

/**
 * Mapeamento híbrido: contraste local + deslocamento térmico conforme intensidade.
 */
export function pressureToDisplayColormapT(
  pressurePa: number,
  entryPeakPa: number,
  beamProfile: AcousticBeamProfileKind = "planar",
): number {
  const isPlanar = beamProfile === "planar";
  const isFocused = beamProfile === "focused";
  const visualMax = getVisualColormapMaxPa(entryPeakPa, beamProfile);
  const localT = visualMax > 0 ? pressurePa / visualMax : 0;

  const refEntry = intensityWcm2ToPeakPressurePa(ACOUSTIC_WARM_REFERENCE_INTENSITY_WCM2 * 0.95);
  const sessionAnchor = clamp01(entryPeakPa / Math.max(refEntry, 1));

  const stretch = isPlanar
    ? 0.72 + sessionAnchor * 0.18
    : isFocused
      ? 0.94 + sessionAnchor * 0.14
      : 0.7 + sessionAnchor * 0.38;
  const warmShift = isPlanar
    ? sessionAnchor * sessionAnchor * 0.04
    : isFocused
      ? sessionAnchor * sessionAnchor * 0.04
      : sessionAnchor * sessionAnchor * 0.28;
  const powerExp = isPlanar
    ? 0.74 - sessionAnchor * 0.1
    : isFocused
      ? 0.74 - sessionAnchor * 0.2
      : 1.08 - sessionAnchor * 0.42;
  const shaped = Math.pow(localT, powerExp);

  return clamp01(shaped * stretch + warmShift * (1 - shaped * 0.35));
}

/** Intensidade em W/cm² → pressão de pico em Pa (onda contínua, tecido mole). */
export function intensityWcm2ToPeakPressurePa(intensityWcm2: number): number {
  const intensityWm2 = Math.max(0, intensityWcm2) * 10000;
  return Math.sqrt(2 * TISSUE_ACOUSTIC_IMPEDANCE * intensityWm2);
}

/** Pressão local = pico de entrada × fator relativo do campo (0–1). */
export function relativeToPressurePa(relative01: number, entryPeakPa: number): number {
  return Math.max(0, relative01) * entryPeakPa;
}

export function formatPressurePa(pa: number): string {
  if (!Number.isFinite(pa) || pa <= 0) return "0 Pa";
  if (pa >= 1e6) return `${(pa / 1e6).toFixed(2)} MPa`;
  if (pa >= 10000) return `${(pa / 1000).toFixed(0)} kPa`;
  if (pa >= 1000) return `${(pa / 1000).toFixed(1)} kPa`;
  return `${Math.round(pa)} Pa`;
}

export function formatPressurePaCompact(pa: number): string {
  if (!Number.isFinite(pa) || pa <= 0) return "0";
  if (pa >= 1e6) return `${(pa / 1e6).toFixed(1)} MPa`;
  return `${Math.round(pa / 1000)} kPa`;
}
