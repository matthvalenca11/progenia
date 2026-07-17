/**
 * Legenda jet — pressão acústica em Pa (pico estimado).
 */

import { useState } from "react";
import { ChevronDown, Waves } from "lucide-react";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { getAcousticLegendGradient, getAcousticLegendStops } from "@/lib/acousticBeamColors";
import {
  formatPressurePa,
  getAcousticColormapMaxPa,
  intensityWcm2ToPeakPressurePa,
} from "@/lib/acousticPressure";
import { getTransducerDefinition } from "@/config/therapeuticTransducerDefinitions";
import type { AcousticFieldStats } from "@/lib/acousticFieldTexture";

interface AcousticColormapLegendProps {
  fieldStats?: AcousticFieldStats;
  demo?: boolean;
}

export function AcousticColormapLegend({ fieldStats, demo = false }: AcousticColormapLegendProps) {
  const { simulationResult, config, viewerTab, effectiveCoupling } = useUltrasoundTherapyStore();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(demo || isMobile);

  if (viewerTab !== "beam" || !simulationResult) return null;

  const couplingFactor = effectiveCoupling === "good" ? 0.95 : 0.68;
  const entryPeakPa =
    fieldStats?.entryPeakPressurePa ??
    intensityWcm2ToPeakPressurePa(config.intensity * couplingFactor);
  const maxPressurePa =
    fieldStats?.maxPressurePa ??
    intensityWcm2ToPeakPressurePa(config.intensity * couplingFactor);
  const maxPressureDepth =
    fieldStats?.maxPressureDepthCm ?? simulationResult.effectiveDepth;

  const stops = getAcousticLegendStops();
  const gradient = getAcousticLegendGradient();
  const scaleMaxPa = getAcousticColormapMaxPa();
  const maxReflect =
    simulationResult.interactionMap?.summary.maxReflectionIndex ??
    simulationResult.boneReflection;
  const transducerDef = getTransducerDefinition(config.transducerType ?? "planar_circular");
  const beamLabel =
    config.beamProfile === "focused"
      ? `Focalizado · ${transducerDef.shortLabel}`
      : `Plano · ${transducerDef.shortLabel}`;

  const nearField = simulationResult.acousticProfile?.nearFieldCm;

  if (demo) {
    return (
      <div className="pointer-events-none absolute left-3 bottom-3 z-20">
        <div
          className="pointer-events-auto flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/85 px-2 py-1.5 shadow backdrop-blur-md"
          title="Pressão acústica (escala jet)"
        >
          <div
            className="h-14 w-3 shrink-0 rounded-sm border border-slate-600/80"
            style={{ background: gradient }}
            aria-hidden
          />
          <span className="text-[9px] font-medium uppercase tracking-wide text-slate-400">Pa</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "pointer-events-none absolute left-3 bottom-3 z-20",
      demo ? "max-w-[min(92vw,140px)]" : "max-w-[min(92vw,272px)]",
    )}>
      <div className="pointer-events-auto rounded-xl border border-border/80 bg-slate-900/88 text-slate-100 shadow-lg backdrop-blur-md">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-full justify-between px-3 text-[11px] font-medium text-slate-200 hover:bg-slate-800/80 hover:text-white",
            demo && collapsed && "rounded-xl",
            !demo && "rounded-t-xl",
          )}
          onClick={() => setCollapsed((c) => !c)}
        >
          <span className="flex items-center gap-1.5">
            <Waves className="h-3.5 w-3.5 text-sky-400" />
            {demo ? "Pressão" : "Campo acústico"}
          </span>
          {!demo && (
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !collapsed && "rotate-180")} />
          )}
        </Button>

        {!collapsed && (
          <div className={cn("space-y-2.5 border-t border-slate-700/80 px-3 py-2.5", demo && "border-t-0 pt-0")}>
            <div className="flex gap-2.5">
              <div
                className={cn(
                  "w-4 shrink-0 rounded-sm border border-slate-600/80",
                  demo ? "h-16" : "h-[108px]",
                )}
                style={{ background: gradient }}
                aria-hidden
              />
              {!demo && (
                <>
                  <div className="flex flex-col justify-between py-0.5 text-[10px] text-slate-300">
                    {[...stops].reverse().map((s) => (
                      <span key={s.pressurePa}>{s.label}</span>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1 text-[10px] text-slate-400">
                    <p>
                      <span className="text-slate-300">Feixe:</span>{" "}
                      <span className="text-sky-200/90">{beamLabel}</span>
                    </p>
                    <p>
                      <span className="text-slate-300">P entrada:</span>{" "}
                      <span className="font-mono text-cyan-200/90">{formatPressurePa(entryPeakPa)}</span>
                    </p>
                    <p>
                      <span className="text-slate-300">P máx:</span>{" "}
                      <span className="font-mono text-orange-300">{formatPressurePa(maxPressurePa)}</span>
                      <span className="text-slate-500"> @ {maxPressureDepth.toFixed(1)} cm</span>
                    </p>
                    {config.beamProfile !== "focused" && nearField != null && (
                      <p>
                        <span className="text-slate-300">Campo próx.:</span>{" "}
                        <span className="font-mono text-slate-200">{nearField.toFixed(1)} cm</span>
                      </p>
                    )}
                    <p>
                      <span className="text-slate-300">Reflexão osso:</span>{" "}
                      <span className="font-mono text-amber-200/80">{(maxReflect * 100).toFixed(0)}%</span>
                    </p>
                  </div>
                </>
              )}
            </div>
            {!demo && (
              <p className="border-t border-slate-700/60 pt-2 text-[9px] leading-relaxed text-slate-500">
                Legenda fixa 0–{formatPressurePa(scaleMaxPa)} (referência absoluta). As cores do
                feixe usam contraste local em baixa intensidade e aproximam essa escala quando a
                pressão sobe.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
