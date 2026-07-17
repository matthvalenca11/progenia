/**
 * Layout enxuto para demonstração em aulas/cápsulas — canvas em destaque, controles sob demanda.
 */

import { useState } from "react";
import { ChevronUp, SlidersHorizontal } from "lucide-react";
import { UltrasoundTherapy3DViewer } from "./UltrasoundTherapy3DViewer";
import { TherapyModeDock } from "./TherapyModeDock";
import { ParameterQuickCards } from "./ParameterQuickCards";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { cn } from "@/lib/utils";

interface TherapyDemoShellProps {
  embedded?: boolean;
}

function riskLabel(risk: "low" | "medium" | "high" | undefined): string {
  if (risk === "high") return "Alto";
  if (risk === "medium") return "Moderado";
  return "Baixo";
}

function riskClass(risk: "low" | "medium" | "high" | undefined): string {
  if (risk === "high") return "text-red-400";
  if (risk === "medium") return "text-amber-400";
  return "text-emerald-400";
}

export function TherapyDemoShell({ embedded = false }: TherapyDemoShellProps) {
  const [controlsOpen, setControlsOpen] = useState(false);
  const simulationResult = useUltrasoundTherapyStore((s) => s.simulationResult);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden bg-background",
        embedded
          ? "h-[min(720px,78vh)] min-h-[440px] rounded-xl border border-border"
          : "h-[min(100dvh,900px)]",
      )}
    >
      <div className="relative min-h-0 flex-1 bg-muted/20">
        <UltrasoundTherapy3DViewer hideTabs demoMode />

        {simulationResult && (
          <div className="pointer-events-none absolute right-3 top-3 z-20">
            <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1 rounded-full border border-slate-700/80 bg-slate-900/88 px-3 py-1.5 text-[11px] text-slate-200 shadow-lg backdrop-blur-md">
              <span className={cn("font-semibold", riskClass(simulationResult.risk))}>
                Risco {riskLabel(simulationResult.risk)}
              </span>
              <span className="hidden text-slate-600 sm:inline">·</span>
              <span className="tabular-nums text-slate-300">
                {simulationResult.maxTemp.toFixed(1)}°C
              </span>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
          <TherapyModeDock compact className="pointer-events-auto max-w-full" />
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-card/95 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setControlsOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            Ajustar parâmetros
          </span>
          <ChevronUp
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              controlsOpen && "rotate-180",
            )}
          />
        </button>

        {controlsOpen && (
          <div className="max-h-[min(38vh,280px)] overflow-y-auto border-t border-border px-3 py-3 sm:px-4">
            <ParameterQuickCards demo compact />
          </div>
        )}
      </div>
    </div>
  );
}
