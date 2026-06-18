/**
 * Limites de performance compartilhados entre labs terapêuticos (US, Fotobio, TENS).
 * Android WebView: menos instâncias, sem sombras reais, menos partículas.
 */

import { isAndroidNative } from "@/lib/labPerformance";

export { isAndroidNative, isNativeMobile, labCanvasDpr, labCanvasProps } from "@/lib/labPerformance";

export function shouldCastTherapeuticShadows(): boolean {
  return !isAndroidNative;
}

/** Máximo de linhas de campo elétrico TENS visíveis */
export function getMaxTensFieldLines(intensityNorm: number): number {
  const base = Math.floor(6 + intensityNorm * 10);
  return isAndroidNative ? Math.min(base, 10) : Math.min(base, 20);
}

/** Pontos por linha de campo elétrico */
export function getTensFieldLineSegments(): number {
  return isAndroidNative ? 28 : 50;
}

/** Partículas do campo elétrico TENS */
export function getMaxTensFieldParticles(intensityNorm: number): number {
  const base = Math.floor(40 + intensityNorm * 80);
  return isAndroidNative ? Math.min(base, 60) : Math.min(base, 150);
}

/** Nós de feixe / scatter Fotobio */
export function getPhotobioBeamNodeCount(wavelength: 660 | 808): number {
  if (isAndroidNative) return wavelength === 660 ? 6 : 8;
  return 12;
}

export function getPhotobioScatterCount(wavelength: 660 | 808): number {
  if (isAndroidNative) return wavelength === 660 ? 4 : 6;
  return wavelength === 660 ? 8 : 12;
}

export function getPhotobioLedCount(): number {
  return isAndroidNative ? 13 : 19;
}

export function getPhotobioRingCount(): number {
  return isAndroidNative ? 6 : 10;
}

/** Raios ao redor de implante metálico TENS */
export function getMetalHotspotRayCount(): number {
  return isAndroidNative ? 4 : 8;
}

/** Atualização de cores do volume acústico — pular frames no Android */
export function getPropagationColorUpdateInterval(): number {
  return isAndroidNative ? 3 : 1;
}
