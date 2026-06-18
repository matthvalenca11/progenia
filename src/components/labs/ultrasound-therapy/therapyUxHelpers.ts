/**
 * Helpers de UX — status de parâmetros e coerência com objetivo terapêutico.
 */

import type { UltrasoundTherapyConfig } from "@/types/ultrasoundTherapyConfig";
import type { UltrasoundTherapyResult } from "@/simulation/ultrasoundTherapyEngine";

export type TherapyTargetGoal =
  | "skin_superficial"
  | "muscle_superficial"
  | "muscle_deep"
  | "near_bone"
  | "ablation_educational";

export type ParamStatus = "ok" | "warn" | "risk";

export const THERAPY_TARGET_LABELS: Record<TherapyTargetGoal, string> = {
  skin_superficial: "Pele / superficial",
  muscle_superficial: "Músculo superficial",
  muscle_deep: "Músculo profundo",
  near_bone: "Próximo ao osso",
  ablation_educational: "Ablativo / focado (educacional)",
};

export const THERAPY_TARGET_HINTS: Record<TherapyTargetGoal, string> = {
  skin_superficial: "Energia concentrada na pele — frequências mais altas ajudam.",
  muscle_superficial: "Alvo a ~1–2 cm — equilíbrio entre penetração e aquecimento local.",
  muscle_deep: "Alvo profundo — frequência baixa e feixe amplo favorecem penetração.",
  near_bone: "Cuidado com reflexão e dor periosteal — monitore risco e movimento.",
  ablation_educational: "Demonstração extrema — foco, intensidade e tempo elevados (didático).",
};

export const THERAPY_TARGET_SUGGESTIONS: Record<
  TherapyTargetGoal,
  { label: string; hint: string }[]
> = {
  skin_superficial: [
    { label: "2–3 MHz", hint: "Penetra menos, aquece mais a superfície." },
    { label: "Varredura", hint: "Distribui calor e reduz hotspot." },
    { label: "Bom gel", hint: "Melhora transmissão e reduz queimadura superficial." },
  ],
  muscle_superficial: [
    { label: "1–1,5 MHz", hint: "Boa penetração até músculo superficial." },
    { label: "1,0 W/cm²", hint: "Faixa terapêutica usual por 8–10 min." },
    { label: "Contínuo", hint: "Aquecimento estável no alvo." },
  ],
  muscle_deep: [
    { label: "≈1 MHz", hint: "Penetra mais profundamente no tecido mole." },
    { label: "ERA maior", hint: "Feixe mais amplo atinge volume muscular." },
    { label: "Varredura lenta", hint: "Evita pico térmico em um ponto só." },
  ],
  near_bone: [
    { label: "Frequência moderada", hint: "Evite concentrar energia no periósteo." },
    { label: "Varredura", hint: "Reduz risco de hotspot junto ao osso." },
    { label: "Monitorar dor simulada", hint: "Observe risco periosteal no painel." },
  ],
  ablation_educational: [
    { label: "Feixe focalizado", hint: "Concentra energia em profundidade definida." },
    { label: "Parado + alta intensidade", hint: "Só para demonstração — não clínica." },
    { label: "Tempo curto", hint: "Observe ablação educacional no visual." },
  ],
};

export function getHighlightLayerForGoal(
  goal: TherapyTargetGoal | null,
): "skin" | "fat" | "muscle" | "bone" | null {
  if (!goal) return null;
  switch (goal) {
    case "skin_superficial":
      return "skin";
    case "muscle_superficial":
    case "muscle_deep":
    case "ablation_educational":
      return "muscle";
    case "near_bone":
      return "bone";
    default:
      return null;
  }
}

export function evaluateSetupCoherence(
  goal: TherapyTargetGoal,
  config: UltrasoundTherapyConfig,
  result: UltrasoundTherapyResult | null,
): { status: ParamStatus; message: string } {
  if (!result) {
    return { status: "warn", message: "Aguardando simulação…" };
  }

  const { frequency, intensity, coupling, movement, beamProfile } = config;
  const { effectiveDepth, maxTempDepth, periostealRisk, surfaceTemp, maxTemp } = result;

  switch (goal) {
    case "skin_superficial":
      if (frequency >= 2 && effectiveDepth < 1.8 && surfaceTemp >= 39) {
        return { status: "ok", message: "Energia coerente com alvo superficial." };
      }
      if (frequency < 1.5) {
        return { status: "warn", message: "Frequência baixa — energia pode ir fundo demais para pele." };
      }
      return { status: "warn", message: "Ajuste frequência ou intensidade para aquecer mais a superfície." };

    case "muscle_superficial":
      if (effectiveDepth >= 0.8 && effectiveDepth <= 2.5 && maxTemp >= 40) {
        return { status: "ok", message: "Profundidade efetiva compatível com músculo superficial." };
      }
      return { status: "warn", message: "Profundidade efetiva pode não coincidir com o alvo escolhido." };

    case "muscle_deep":
      if (frequency <= 1.5 && effectiveDepth >= 1.5) {
        return { status: "ok", message: "Penetração adequada para músculo profundo." };
      }
      if (frequency >= 2.5) {
        return { status: "risk", message: "Frequência alta limita penetração profunda." };
      }
      return { status: "warn", message: "Considere frequência mais baixa ou ERA maior." };

    case "near_bone":
      if (periostealRisk > 0.4) {
        return { status: "risk", message: "Risco periosteal elevado — afaste ou use varredura." };
      }
      if (periostealRisk > 0.22) {
        return { status: "warn", message: "Risco periosteal moderado — monitore posição e parâmetros." };
      }
      if (Math.abs(maxTempDepth - effectiveDepth) < 1 && movement === "scanning") {
        return { status: "ok", message: "Setup moderado perto de interface óssea." };
      }
      return { status: "warn", message: "Monitore reflexão óssea e dor simulada." };

    case "ablation_educational":
      if (beamProfile === "focused" && intensity >= 1.8 && maxTemp >= 45) {
        return { status: "ok", message: "Parâmetros extremos coerentes com demo de ablação." };
      }
      return { status: "warn", message: "Para ablação educacional: foco + intensidade/duração maiores." };

    default:
      return { status: "ok", message: "" };
  }
}

export function statusForFrequency(
  config: UltrasoundTherapyConfig,
  result: UltrasoundTherapyResult | null,
): ParamStatus {
  if (config.frequency >= 2.8) return "warn";
  if (result && config.frequency >= 2.5 && result.surfaceTemp > result.targetTemp + 1.5) {
    return "warn";
  }
  return "ok";
}

export function statusForIntensity(
  config: UltrasoundTherapyConfig,
  result: UltrasoundTherapyResult | null,
): ParamStatus {
  if (config.intensity > 2.5 && config.movement === "stationary") return "risk";
  if (config.intensity > 2.0 || (result?.risk === "high")) return "warn";
  return "ok";
}

export function statusForCoupling(
  config: UltrasoundTherapyConfig,
  result: UltrasoundTherapyResult | null,
  effectiveCoupling?: "good" | "poor",
): ParamStatus {
  const coupling = effectiveCoupling ?? config.coupling;
  if (coupling === "poor" && (result?.surfaceTemp ?? 0) > 42) return "risk";
  if (coupling === "poor") return "warn";
  return "ok";
}

export function statusForMovement(config: UltrasoundTherapyConfig): ParamStatus {
  if (config.movement === "stationary" && config.intensity > 1.8) return "warn";
  return "ok";
}

export function statusForDuration(
  config: UltrasoundTherapyConfig,
  result: UltrasoundTherapyResult | null,
): ParamStatus {
  if (config.duration > 15 || (result?.cumulativeDose ?? 0) > 60) return "warn";
  if (config.duration > 20) return "risk";
  return "ok";
}

export function statusForMode(config: UltrasoundTherapyConfig): ParamStatus {
  if (config.mode === "continuous" && config.intensity > 2) return "warn";
  return "ok";
}

export const STATUS_STYLES: Record<
  ParamStatus,
  { border: string; dot: string; bg: string; label: string }
> = {
  ok: {
    border: "border-emerald-500/35",
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/5",
    label: "Adequado",
  },
  warn: {
    border: "border-amber-500/40",
    dot: "bg-amber-500",
    bg: "bg-amber-500/5",
    label: "Atenção",
  },
  risk: {
    border: "border-red-500/40",
    dot: "bg-red-500",
    bg: "bg-red-500/5",
    label: "Risco",
  },
};
