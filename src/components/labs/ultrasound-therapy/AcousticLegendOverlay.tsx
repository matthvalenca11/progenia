/**
 * Legenda do modo Propagação — overlay HTML sobre o canvas.
 */

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const LEGEND_ITEMS = [
  { color: "bg-sky-400", label: "Propagação / intensidade", border: "border-sky-500/40" },
  { color: "bg-slate-500/60", label: "Atenuação (fade)", border: "border-slate-400/40" },
  { color: "bg-amber-400", label: "Reflexão óssea", border: "border-amber-500/40" },
  { color: "bg-sky-200", label: "Cavitação (bolhas)", border: "border-sky-300/40" },
  { color: "bg-violet-400/70", label: "Ondas estacionárias", border: "border-violet-400/40" },
  { color: "bg-orange-500", label: "Dano térmico", border: "border-orange-500/40" },
  { color: "bg-red-700", label: "Ablação educacional", border: "border-red-600/40" },
  { color: "bg-emerald-400/80", label: "Zona segura", border: "border-emerald-500/40" },
];

export function AcousticLegendOverlay() {
  const { viewerTab, visualizationOptions } = useUltrasoundTherapyStore();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(isMobile);

  if (viewerTab !== "interaction") return null;

  const activeLabels = LEGEND_ITEMS.filter((_, i) => {
    const keys = [
      visualizationOptions.showPropagation,
      visualizationOptions.showAttenuation,
      visualizationOptions.showReflection,
      visualizationOptions.showCavitation,
      visualizationOptions.showStandingWaves,
      visualizationOptions.showThermalDamage,
      visualizationOptions.showAblation,
      visualizationOptions.showSafetyZones,
    ];
    return keys[i];
  });

  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-20 max-w-[min(92vw,240px)]">
      <div className="pointer-events-auto rounded-xl border border-border/80 bg-slate-900/88 text-slate-100 shadow-lg backdrop-blur-md">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-full justify-between rounded-t-xl px-3 text-[11px] font-medium text-slate-200 hover:bg-slate-800/80 hover:text-white"
          onClick={() => setCollapsed((c) => !c)}
        >
          <span className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-sky-400" />
            Legenda
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !collapsed && "rotate-180")} />
        </Button>

        {!collapsed && (
          <div className="space-y-2 border-t border-slate-700/80 px-3 py-2.5">
            {(activeLabels.length > 0 ? activeLabels : LEGEND_ITEMS.slice(0, 4)).map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-[10px] leading-tight text-slate-300">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm border", item.color, item.border)} />
                {item.label}
              </div>
            ))}
            <p className="border-t border-slate-700/60 pt-2 text-[9px] leading-relaxed text-slate-400">
              Modelo educacional aproximado. Não substitui simulação acústica numérica real. Índices
              relativos, não valores clínicos absolutos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
