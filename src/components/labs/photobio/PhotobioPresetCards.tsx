/**
 * Cards de presets clínico-educacionais — PBM
 */

import { BookOpen, AlertTriangle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PHOTOBIO_CLINICAL_PRESETS,
  type PhotobioPresetId,
} from "@/config/photobioPresets";
import { usePhotobioStore } from "@/stores/photobioStore";

interface PhotobioPresetCardsProps {
  compact?: boolean;
  className?: string;
}

const BAD_PRESETS: PhotobioPresetId[] = ["bad-overdose", "bad-subdose"];

export function PhotobioPresetCards({ compact = false, className }: PhotobioPresetCardsProps) {
  const activeClinicalPresetId = usePhotobioStore((s) => s.activeClinicalPresetId);
  const applyClinicalPreset = usePhotobioStore((s) => s.applyClinicalPreset);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-rose-500" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Presets clínico-educacionais
        </p>
      </div>

      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
        {PHOTOBIO_CLINICAL_PRESETS.map((preset) => {
          const isBad = BAD_PRESETS.includes(preset.id);
          const isActive = activeClinicalPresetId === preset.id;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyClinicalPreset(preset.id)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors hover:bg-muted/60",
                isActive
                  ? "border-rose-500/50 bg-rose-500/5 ring-1 ring-rose-500/30"
                  : "border-border bg-background/60",
                isBad && !isActive && "border-amber-500/25",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium leading-tight">{preset.name}</span>
                    {isBad && (
                      <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-600">
                        Exemplo
                      </Badge>
                    )}
                    {isActive && (
                      <Badge variant="secondary" className="text-[9px]">
                        Ativo
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                    {preset.description}
                  </p>
                </div>
                {isBad ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                ) : (
                  <Sparkles className="h-4 w-4 shrink-0 text-rose-400" />
                )}
              </div>
              {!compact && (
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/90">
                  {preset.educationalGoal}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
