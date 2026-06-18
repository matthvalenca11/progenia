/**
 * Legenda do colormap térmico — cor × temperatura (°C).
 */

import { useState } from "react";
import { ChevronDown, Thermometer } from "lucide-react";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { getThermalLegendGradient, getThermalLegendStops } from "@/lib/thermalBeamColors";

export function ThermalColormapLegend() {
  const { simulationResult, viewerTab } = useUltrasoundTherapyStore();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(isMobile);

  if (viewerTab !== "thermal" || !simulationResult) return null;

  const stops = getThermalLegendStops();
  const gradient = getThermalLegendGradient();

  const { surfaceTemp, maxTemp, targetTemp } = simulationResult;

  return (
    <div className="pointer-events-none absolute left-3 bottom-3 z-20 max-w-[min(92vw,240px)]">
      <div className="pointer-events-auto rounded-xl border border-border/80 bg-slate-900/88 text-slate-100 shadow-lg backdrop-blur-md">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-full justify-between rounded-t-xl px-3 text-[11px] font-medium text-slate-200 hover:bg-slate-800/80 hover:text-white"
          onClick={() => setCollapsed((c) => !c)}
        >
          <span className="flex items-center gap-1.5">
            <Thermometer className="h-3.5 w-3.5 text-amber-400" />
            Mapa de calor
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !collapsed && "rotate-180")} />
        </Button>

        {!collapsed && (
          <div className="space-y-2.5 border-t border-slate-700/80 px-3 py-2.5">
            <div className="flex gap-2.5">
              <div
                className="h-[108px] w-4 shrink-0 rounded-sm border border-slate-600/80"
                style={{ background: gradient }}
                aria-hidden
              />
              <div className="flex flex-col justify-between py-0.5 text-[10px] text-slate-300">
                {[...stops].reverse().map((s) => (
                  <span key={s.temp}>{s.label}</span>
                ))}
              </div>
              <div className="min-w-0 flex-1 space-y-1 text-[10px] text-slate-400">
                <p>
                  <span className="text-slate-300">Superfície:</span>{" "}
                  <span className="font-mono text-amber-200/90">{surfaceTemp.toFixed(1)} °C</span>
                </p>
                <p>
                  <span className="text-slate-300">Alvo:</span>{" "}
                  <span className="font-mono text-amber-200/90">{targetTemp.toFixed(1)} °C</span>
                </p>
                <p>
                  <span className="text-slate-300">Pico:</span>{" "}
                  <span className="font-mono text-orange-300">{maxTemp.toFixed(1)} °C</span>
                </p>
              </div>
            </div>
            <p className="border-t border-slate-700/60 pt-2 text-[9px] leading-relaxed text-slate-500">
              37 °C = baseline (sem cor). Laranja = aquecimento leve. Vermelho intenso = 40 °C ou
              mais. Escala fixa 37–43 °C.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
