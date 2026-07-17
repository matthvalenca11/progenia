import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePhotobioInterpretation } from "./usePhotobioInterpretation";

interface PhotobioDominantEffectCardProps {
  compact?: boolean;
  className?: string;
}

export function PhotobioDominantEffectCard({ compact = false, className }: PhotobioDominantEffectCardProps) {
  const { dominantEffect, interaction } = usePhotobioInterpretation();

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3",
        compact ? "p-2.5" : "p-3.5",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Zap className={cn("mt-0.5 h-4 w-4 shrink-0", dominantEffect.accentClass)} />
        <div className="min-w-0 space-y-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Fenômeno dominante
            </p>
            <p className={cn("text-sm font-semibold", dominantEffect.accentClass)}>{dominantEffect.label}</p>
          </div>
          <p className={cn("leading-relaxed text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>
            {dominantEffect.explanation}
          </p>
          {!compact && (
            <p className="text-[10px] leading-relaxed text-muted-foreground/80">
              {interaction.insight}
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            {dominantEffect.causes.slice(0, compact ? 4 : 6).map((cause) => (
              <span
                key={cause}
                className="rounded-full border border-border/80 bg-muted/40 px-2 py-0.5 text-[9px] text-muted-foreground"
              >
                {cause}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
