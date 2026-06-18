/**
 * Tier de qualidade visual — Ultrassom Terapêutico 3D
 * Desktop: efeitos densos + sombras reais
 * Android WebView: fill/rim + AO fake, sem sombras
 */

import { isAndroidNative } from "@/lib/labPerformance";

export type VisualQualityTier = "android" | "desktop";

export function getVisualQualityTier(): VisualQualityTier {
  return isAndroidNative ? "android" : "desktop";
}

export function shouldUseHighDensityEffects(): boolean {
  return getVisualQualityTier() === "desktop";
}

export function shouldUseContactShadowFallback(): boolean {
  return getVisualQualityTier() === "android";
}

export function shouldEnableRealTimeShadows(): boolean {
  return shouldUseHighDensityEffects();
}

export function getMaxPropagationInstances(): number {
  return shouldUseHighDensityEffects() ? 1200 : 400;
}

export function getMaxBubbleCount(): number {
  return shouldUseHighDensityEffects() ? 64 : 22;
}

export function getTissueTextureSize(): number {
  return shouldUseHighDensityEffects() ? 768 : 512;
}

export function getOrganicLayerSegments(): [number, number, number] {
  return shouldUseHighDensityEffects() ? [40, 9, 22] : [28, 6, 16];
}

export function getTextureDetailScale(): number {
  return shouldUseHighDensityEffects() ? 1 : 0.55;
}

export function getGelStampCountRange(coupling: "good" | "poor"): { min: number; max: number } {
  if (shouldUseHighDensityEffects()) {
    return coupling === "good" ? { min: 26, max: 32 } : { min: 9, max: 13 };
  }
  return coupling === "good" ? { min: 14, max: 18 } : { min: 5, max: 8 };
}

export function getGelVoidBubbleCount(coupling: "good" | "poor"): number {
  if (coupling === "good") return 0;
  return shouldUseHighDensityEffects() ? 16 : 7;
}

export function getGelGridResolution(): number {
  return shouldUseHighDensityEffects() ? 56 : 36;
}
