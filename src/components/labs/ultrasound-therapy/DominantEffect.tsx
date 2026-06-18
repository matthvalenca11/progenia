/**
 * DominantEffect - Efeito dominante na simulação (hook compartilhado com o painel de insights)
 */

import { useMemo } from "react";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { Thermometer, AlertTriangle, Waves, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { utCard, utLabel, utHint } from "./ultrasoundTherapyUi";

export interface DominantEffectInfo {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  accentClass: string;
}

function periostealSeverityLabel(risk: number): string {
  if (risk > 0.65) return "muito alto";
  if (risk > 0.4) return "alto";
  return "moderado";
}

function buildPeriostealDescription(
  periostealRisk: number,
  maxTempDepth: number,
  hotspotBoneDistanceCm: number | null,
  frequency: number,
  intensity: number,
  movement: "stationary" | "scanning",
  transducerOverBone: boolean | null,
): string {
  const pct = (periostealRisk * 100).toFixed(0);
  const severity = periostealSeverityLabel(periostealRisk);

  let distPart = "";
  if (hotspotBoneDistanceCm != null) {
    distPart = `Hotspot a ${maxTempDepth.toFixed(1)} cm de profundidade, ${hotspotBoneDistanceCm.toFixed(1)} cm da interface óssea. `;
  }

  const drivers: string[] = [];
  if (frequency >= 2.5) drivers.push(`${frequency} MHz concentra energia mais superficialmente`);
  if (intensity > 2.0) drivers.push(`${intensity} W/cm² aumenta reflexão periosteal`);
  if (movement === "stationary" && intensity > 1.2) drivers.push("transdutor parado concentra calor");
  if (transducerOverBone === true) drivers.push("transdutor sobre região óssea");

  const driverText =
    drivers.length > 0 ? ` ${drivers.slice(0, 2).join("; ")}.` : "";

  return `Risco periosteal ${severity} (${pct}%). ${distPart}${driverText}`.trim();
}

export function useDominantEffectInfo(): DominantEffectInfo | null {
  const { config, simulationResult } = useUltrasoundTherapyStore();

  return useMemo((): DominantEffectInfo | null => {
    if (!simulationResult) return null;

    const {
      surfaceTemp,
      targetTemp,
      periostealRisk,
      thermalDose,
      maxTemp,
      maxTempDepth,
      hotspotBoneDistanceCm,
      transducerOverBone,
      boneStartDepthCm,
    } = simulationResult;
    const { frequency, era, intensity, mode, movement } = config;

    const hasBoneContext = boneStartDepthCm != null;
    const periostealRelevant =
      hasBoneContext &&
      periostealRisk > 0.22 &&
      (transducerOverBone !== false);

    const thermalDominant =
      maxTemp > 44 ||
      (maxTemp > 42 && periostealRisk < 0.35) ||
      (intensity > 3 && maxTemp > 41 && periostealRisk < 0.45);

    if (thermalDominant && maxTemp >= periostealRisk * 20 + 38) {
      return {
        id: "thermal-risk",
        name: "Risco Térmico",
        description: `Pico de ${maxTemp.toFixed(1)}°C a ${maxTempDepth.toFixed(1)} cm. Intensidade ${intensity} W/cm² por ${config.duration} min pode superaquecer o tecido antes da reflexão óssea.`,
        icon: Thermometer,
        accentClass: "text-red-500",
      };
    }

    if (periostealRelevant) {
      return {
        id: "periosteal-risk",
        name: "Risco Periosteal",
        description: buildPeriostealDescription(
          periostealRisk,
          maxTempDepth,
          hotspotBoneDistanceCm,
          frequency,
          intensity,
          movement,
          transducerOverBone,
        ),
        icon: AlertTriangle,
        accentClass: periostealRisk > 0.4 ? "text-red-500" : "text-amber-500",
      };
    }

    if (transducerOverBone === false && boneStartDepthCm != null) {
      return {
        id: "muscle-region",
        name: "Região Muscular",
        description: `Transdutor sobre músculo (fora da zona óssea). Risco periosteal baixo nesta posição — o osso está a ${boneStartDepthCm.toFixed(1)} cm de profundidade.`,
        icon: Zap,
        accentClass: "text-emerald-600",
      };
    }

    if (frequency >= 2.5 && era <= 4 && movement === "stationary" && surfaceTemp > targetTemp + 1) {
      return {
        id: "superficial-heating",
        name: "Aquecimento Superficial",
        description: `Frequência alta (${frequency} MHz) + ERA pequena (${era} cm²) + parado concentram energia na superfície. Temperatura superficial: ${surfaceTemp.toFixed(1)}°C.`,
        icon: Thermometer,
        accentClass: "text-orange-500",
      };
    }

    if (frequency <= 1.5 && era >= 5.5 && mode === "continuous" && targetTemp > surfaceTemp + 1) {
      return {
        id: "deep-heating",
        name: "Aquecimento Profundo",
        description: `Frequência baixa (${frequency} MHz) + ERA grande (${era} cm²) + contínuo permitem penetração profunda. Temperatura no alvo: ${targetTemp.toFixed(1)}°C.`,
        icon: Thermometer,
        accentClass: "text-foreground",
      };
    }

    if (mode === "pulsed" && intensity >= 2.0 && frequency >= 2.5) {
      return {
        id: "cavitation",
        name: "Efeito Mecânico / Cavitação",
        description: `Modo pulsado + intensidade alta (${intensity} W/cm²) + frequência alta (${frequency} MHz) podem causar cavitação.`,
        icon: Waves,
        accentClass: "text-foreground",
      };
    }

    if (movement === "scanning" && simulationResult.treatedArea > era * 2) {
      return {
        id: "distributed",
        name: "Efeito Distribuído",
        description: `Varredura distribui energia sobre área maior (${simulationResult.treatedArea.toFixed(1)} cm²).`,
        icon: Zap,
        accentClass: "text-foreground",
      };
    }

    if (thermalDose > 10) {
      return {
        id: "thermal-dose",
        name: "Dose Térmica Acumulada",
        description: `CEM43 = ${thermalDose.toFixed(1)} min. Dose térmica acumulada é o fator dominante.`,
        icon: Thermometer,
        accentClass: "text-amber-500",
      };
    }

    return {
      id: "balanced",
      name: "Efeito Balanceado",
      description: `Parâmetros equilibrados. Superfície ${surfaceTemp.toFixed(1)}°C, alvo ${targetTemp.toFixed(1)}°C.`,
      icon: Thermometer,
      accentClass: "text-muted-foreground",
    };
  }, [config, simulationResult]);
}

export function DominantEffect({ compact = false }: { compact?: boolean }) {
  const dominantEffect = useDominantEffectInfo();
  if (!dominantEffect) return null;

  const Icon = dominantEffect.icon;

  if (compact) {
    return (
      <div className={cn(utCard, "p-4")}>
        <div className="flex min-w-0 items-start gap-3">
          <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", dominantEffect.accentClass)} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{dominantEffect.name}</p>
            <p className={cn("mt-1 line-clamp-2 leading-relaxed", utHint)}>{dominantEffect.description}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(utCard, "p-6")}>
      <p className={utLabel}>Efeito dominante</p>
      <div className="mt-3 flex items-center gap-2.5">
        <Icon className={cn("h-5 w-5 shrink-0", dominantEffect.accentClass)} />
        <span className="text-base font-semibold text-foreground">{dominantEffect.name}</span>
      </div>
      <p className={cn("mt-2 leading-relaxed", utHint)}>{dominantEffect.description}</p>
    </div>
  );
}
