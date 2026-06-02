import { Capacitor } from "@capacitor/core";
import type { VirtualLab, VirtualLabType } from "@/services/virtualLabService";
import { defaultTensLabConfig } from "@/types/tensLabConfig";
import { defaultMRILabConfig } from "@/types/mriLabConfig";
import { defaultUltrasoundTherapyConfig } from "@/types/ultrasoundTherapyConfig";

/** App instalado (Capacitor) — labs rodam do bundle local, não do site remoto. */
export const isNativeLabRuntime = Capacitor.isNativePlatform();
export const isAndroidNativeLabRuntime =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
export const isIosNativeLabRuntime =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

/** Navegador web — mantém fluxo atual (API + WebGL completo). */
export const isWebLabRuntime = !isNativeLabRuntime;

const SLUG_TYPE_RULES: Array<{ pattern: RegExp; type: VirtualLabType }> = [
  { pattern: /tens|eletroterapia|eletro/i, type: "tens" },
  { pattern: /mri|resson|(^|[-_])rm($|[-_])/i, type: "mri" },
  { pattern: /terap|therapy|terapeut|ultrassom-ter/i, type: "ultrasound_therapy" },
  { pattern: /foto|photo|fbm|biomod/i, type: "photobiomodulation" },
  { pattern: /ultra|usg|sono|ecograf/i, type: "ultrasound" },
];

function slugToTitle(slug: string): string {
  return slug
    .split(/[-_/]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function inferLabTypeFromSlug(slug: string): VirtualLabType | null {
  const normalized = slug.trim();
  if (!normalized) return null;
  for (const rule of SLUG_TYPE_RULES) {
    if (rule.pattern.test(normalized)) return rule.type;
  }
  return null;
}

function defaultConfigForType(type: VirtualLabType): Record<string, unknown> {
  switch (type) {
    case "tens":
      return structuredClone(defaultTensLabConfig) as unknown as Record<string, unknown>;
    case "mri":
      return structuredClone(defaultMRILabConfig) as unknown as Record<string, unknown>;
    case "ultrasound_therapy":
    case "ultrassom_terapeutico":
      return structuredClone(defaultUltrasoundTherapyConfig) as unknown as Record<string, unknown>;
    default:
      return {};
  }
}

/** Lab mínimo embarcado no APK — abre instantâneo sem esperar Supabase. */
export function createBundledLabFromSlug(slug: string, labId?: string | null): VirtualLab | null {
  const labType = inferLabTypeFromSlug(slug);
  if (!labType) return null;

  const title = slugToTitle(slug);
  return {
    id: labId ?? undefined,
    slug,
    name: title,
    title,
    lab_type: labType,
    config_data: defaultConfigForType(labType),
    is_published: true,
  };
}

/** Resolve caminho de asset empacotado no Capacitor (`base: "./"`). */
export function resolveBundledAssetUrl(assetPath: string): string {
  const clean = assetPath.replace(/^\/+/, "");
  if (isWebLabRuntime) {
    return `/${clean}`;
  }
  return new URL(clean, `${window.location.origin}${window.location.pathname}`).href;
}

/** Resolução interna do canvas B-mode. Web = 800×600; app nativo reduz só no APK. */
export function getUltrasoundLabCanvasSize(nativeCompact = false) {
  if (!nativeCompact) return { width: 800, height: 600 };
  return { width: 512, height: 384 };
}

/** Escala de renderização para viewers 2D de RM no app nativo. */
export const mriNativeRenderScale = isNativeLabRuntime ? 0.5 : 1;

/** Resolução do marching cubes 3D de RM no app nativo. */
export const mriNativeSurfaceResolution = isNativeLabRuntime ? 48 : 96;
