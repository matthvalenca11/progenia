/**
 * Legenda da resposta fisiológica educacional.
 */

import { useState } from "react";
import { ChevronDown, HeartPulse } from "lucide-react";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const LEGEND_ITEMS = [
  { color: "bg-rose-400", label: "Hiperemia superficial" },
  { color: "bg-pink-200/80", label: "Edema (ilustrativo)" },
  { color: "bg-orange-500", label: "Stress / dano muscular" },
  { color: "bg-red-500", label: "Risco periosteal" },
  { color: "bg-slate-100", label: "Ablação educacional (núcleo)" },
];

export function PhysiologyLegend() {
  const { simulationResult, viewerTab } = useUltrasoundTherapyStore();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(isMobile);

  const physiology = simulationResult?.physiologyResponse;
  const showOnTab = viewerTab === "physiology";

  if (!showOnTab || !physiology) return null;

  const hasEffect =
    physiology.hyperemiaIndex > 0.06 ||
    physiology.muscleThermalStressIndex > 0.08 ||
    physiology.ablationIndex > 0.08;

  if (!hasEffect && physiology.summary.primaryResponse === "none") return null;

  return (
    <div className="pointer-events-none absolute left-3 bottom-3 z-20 max-w-[min(92vw,220px)]">
      <div className="pointer-events-auto rounded-xl border border-border/80 bg-slate-900/88 text-slate-100 shadow-lg backdrop-blur-md">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-full justify-between rounded-t-xl px-3 text-[11px] font-medium text-slate-200 hover:bg-slate-800/80 hover:text-white"
          onClick={() => setCollapsed((c) => !c)}
        >
          <span className="flex items-center gap-1.5">
            <HeartPulse className="h-3.5 w-3.5 text-rose-400" />
            Resposta fisiológica
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !collapsed && "rotate-180")} />
        </Button>

        {!collapsed && (
          <div className="space-y-2 border-t border-slate-700/80 px-3 py-2.5">
            {LEGEND_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-[10px] text-slate-300">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", item.color)} />
                {item.label}
              </div>
            ))}
            <p className="border-t border-slate-700/60 pt-2 text-[9px] leading-relaxed text-slate-400">
              Visualização educacional heurística. Não substitui avaliação clínica ou predição
              real de lesão tecidual.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
