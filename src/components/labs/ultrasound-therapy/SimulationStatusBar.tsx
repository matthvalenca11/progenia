/**
 * Barra de status da simulação — risco, efeitos e controles rápidos.
 */

import { Pause, Play, RotateCcw, Thermometer, Layers, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { DOMINANT_PHENOMENON_LABELS, PRIMARY_PHYSIOLOGY_LABELS } from "@/types/ultrasoundTherapyConfig";
import { cn } from "@/lib/utils";
import { DominantEffect } from "./DominantEffect";
import { SimulationSnapshotButton } from "./SimulationSnapshotButton";

interface SimulationStatusBarProps {
  onReset: () => void;
  compact?: boolean;
  className?: string;
}

function RiskPill({ risk }: { risk: "low" | "medium" | "high" }) {
  const label = risk === "low" ? "Baixo" : risk === "medium" ? "Moderado" : "Alto";
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 text-[10px] font-semibold uppercase tracking-wide",
        risk === "low" && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
        risk === "medium" && "border-amber-500/40 text-amber-600 dark:text-amber-400",
        risk === "high" && "border-red-500/40 text-red-600 dark:text-red-400",
      )}
    >
      Risco {label}
    </Badge>
  );
}

export function SimulationStatusBar({ onReset, compact = false, className }: SimulationStatusBarProps) {
  const { simulationResult, simulationPaused, setSimulationPaused } = useUltrasoundTherapyStore();
  const result = simulationResult;

  const acousticLabel =
    result?.interactionMap?.summary.dominantPhenomenon != null
      ? DOMINANT_PHENOMENON_LABELS[result.interactionMap.summary.dominantPhenomenon]
      : "—";

  const physiologyLabel =
    result?.physiologyResponse?.summary.primaryResponse != null
      ? PRIMARY_PHYSIOLOGY_LABELS[result.physiologyResponse.summary.primaryResponse]
      : "—";

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 overflow-x-auto border-b border-border bg-card/95 px-3 py-2 backdrop-blur-sm",
          className,
        )}
      >
        {result && <RiskPill risk={result.risk} />}
        {result && (
          <>
            <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
              <Thermometer className="h-3 w-3" />
              <span className="font-mono font-semibold text-foreground">{result.maxTemp.toFixed(1)}°C</span>
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              Prof. <span className="font-mono font-semibold text-foreground">{result.effectiveDepth.toFixed(1)}</span> cm
            </span>
          </>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <SimulationSnapshotButton compact />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSimulationPaused(!simulationPaused)}
            aria-label={simulationPaused ? "Retomar animação" : "Pausar animação"}
          >
            {simulationPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onReset} aria-label="Resetar">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("border-b border-border bg-card/80 px-4 py-3 backdrop-blur-sm", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {result ? (
          <>
            <RiskPill risk={result.risk} />
            <div className="flex items-center gap-1.5 text-sm">
              <Thermometer className="h-4 w-4 text-orange-500" />
              <span className="text-muted-foreground">Máx.</span>
              <span className="font-mono font-bold tabular-nums">{result.maxTemp.toFixed(1)}°C</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Layers className="h-4 w-4 text-cyan-500" />
              <span className="text-muted-foreground">Prof. efetiva</span>
              <span className="font-mono font-bold tabular-nums">{result.effectiveDepth.toFixed(1)} cm</span>
            </div>
            <div className="hidden min-w-0 max-w-[220px] lg:block">
              <p className="truncate text-xs text-muted-foreground">
                <Activity className="mr-1 inline h-3 w-3" />
                Acústico: <span className="font-medium text-foreground">{acousticLabel}</span>
              </p>
            </div>
            <div className="hidden min-w-0 max-w-[220px] xl:block">
              <p className="truncate text-xs text-muted-foreground">
                Fisiológico: <span className="font-medium text-foreground">{physiologyLabel}</span>
              </p>
            </div>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Calculando simulação…</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <SimulationSnapshotButton />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setSimulationPaused(!simulationPaused)}
          >
            {simulationPaused ? (
              <>
                <Play className="h-3.5 w-3.5" /> Retomar
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5" /> Pausar
              </>
            )}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>

      {!compact && result && (
        <div className="mt-3 max-w-3xl">
          <DominantEffect compact />
        </div>
      )}
    </div>
  );
}
