import { Activity, Layers3, ScanLine, Sun, Waves } from "lucide-react";
import { usePhotobioStore, type PhotobioViewerTab } from "@/stores/photobioStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const MODES: Array<{
  id: PhotobioViewerTab;
  label: string;
  shortLabel: string;
  icon: typeof Layers3;
  color: string;
}> = [
  { id: "anatomy", label: "Anatomia", shortLabel: "Anat.", icon: Layers3, color: "text-amber-300" },
  { id: "beam", label: "Feixe", shortLabel: "Feixe", icon: Waves, color: "text-rose-400" },
  { id: "fluence", label: "Fluência", shortLabel: "Flu.", icon: Sun, color: "text-yellow-300" },
  { id: "penetration", label: "Penetração", shortLabel: "Pen.", icon: ScanLine, color: "text-violet-400" },
  { id: "bioresponse", label: "Resposta", shortLabel: "Bio", icon: Activity, color: "text-emerald-400" },
];

interface PhotobioModeDockProps {
  className?: string;
  compact?: boolean;
}

export function PhotobioModeDock({ className, compact = false }: PhotobioModeDockProps) {
  const isMobile = useIsMobile();
  const viewerTab = usePhotobioStore((s) => s.viewerTab);
  const setViewerTab = usePhotobioStore((s) => s.setViewerTab);

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-[min(100vw-1.25rem,440px)] items-stretch gap-1 rounded-2xl border border-border/80 bg-slate-900/95 p-1 shadow-lg backdrop-blur-md",
        isMobile ? "overflow-x-auto overscroll-x-contain" : "gap-1.5 p-1.5",
        className,
      )}
      role="tablist"
      aria-label="Modos de visualização PBM"
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
                "flex shrink-0 flex-col items-center justify-center rounded-xl border transition-all touch-manipulation",
                compact
                  ? "min-h-[44px] min-w-[4rem] px-2"
                  : isMobile
                    ? "min-h-[52px] min-w-[3.75rem] flex-1 px-1.5"
                    : "min-h-[56px] min-w-[4.5rem] px-2.5",
                active
                  ? "border-primary/60 bg-primary text-primary-foreground shadow-md"
                  : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white active:scale-[0.98]",
              )}
            >
              <Icon className={cn("shrink-0", isMobile ? "h-5 w-5" : "h-5 w-5", !active && color)} />
              <span className={cn("mt-1 truncate font-medium leading-none", isMobile ? "text-[10px]" : "text-[11px]")}>
                {isMobile ? shortLabel : label}
              </span>
            </button>
          );
        })}
    </div>
  );
}

export { photobioViewerTabToFieldMode } from "./photobioViewerModes";
