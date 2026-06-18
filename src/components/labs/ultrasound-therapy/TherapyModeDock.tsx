/**
 * Dock de modos visuais — botões grandes para trocar a visualização 3D.
 */

import { Waves, Thermometer, Layers3, HeartPulse } from "lucide-react";
import { useUltrasoundTherapyStore, type UltrasoundViewerTab } from "@/stores/ultrasoundTherapyStore";
import { cn } from "@/lib/utils";

const MODES: Array<{
  id: UltrasoundViewerTab;
  label: string;
  shortLabel: string;
  icon: typeof Waves;
  color: string;
}> = [
  { id: "interaction", label: "Visão Geral", shortLabel: "Geral", icon: Layers3, color: "text-violet-400" },
  { id: "beam", label: "Feixe", shortLabel: "Feixe", icon: Waves, color: "text-sky-400" },
  { id: "thermal", label: "Térmico", shortLabel: "Térm.", icon: Thermometer, color: "text-orange-400" },
  {
    id: "physiology",
    label: "Resposta fisiológica",
    shortLabel: "Fisiol.",
    icon: HeartPulse,
    color: "text-rose-400",
  },
];

interface TherapyModeDockProps {
  className?: string;
  compact?: boolean;
}

export function TherapyModeDock({ className, compact = false }: TherapyModeDockProps) {
  const { viewerTab, setViewerTab } = useUltrasoundTherapyStore();

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-1 rounded-2xl border border-border/80 bg-slate-900/90 p-1 shadow-lg backdrop-blur-md",
        compact ? "max-w-full overflow-x-auto" : "gap-1.5 p-1.5",
        className,
      )}
      role="tablist"
      aria-label="Modos de visualização"
    >
      {MODES.map(({ id, label, shortLabel, icon: Icon, color }) => {
        const active = viewerTab === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={label}
            title={label}
            onClick={() => setViewerTab(id)}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center rounded-xl transition-all",
              compact ? "h-11 min-w-[3.25rem] px-2" : "h-14 min-w-[4.5rem] px-3",
              active
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-slate-300 hover:bg-slate-800 hover:text-white",
            )}
          >
            <Icon className={cn("shrink-0", compact ? "h-4 w-4" : "h-5 w-5", !active && color)} />
            <span className={cn("mt-0.5 truncate font-medium", compact ? "text-[9px]" : "text-[10px]")}>
              {compact ? shortLabel : label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
