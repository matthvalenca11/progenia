/**
 * Linha do tempo da sessão — snapshots salvos com restauração — PBM
 */

import { Clock, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePhotobioStore } from "@/stores/photobioStore";
import { cn } from "@/lib/utils";

interface PhotobioSessionTimelineProps {
  compact?: boolean;
  className?: string;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function PhotobioSessionTimeline({ compact = false, className }: PhotobioSessionTimelineProps) {
  const snapshots = usePhotobioStore((s) => s.snapshots);
  const restoreSnapshot = usePhotobioStore((s) => s.restoreSnapshot);
  const removeSnapshot = usePhotobioStore((s) => s.removeSnapshot);
  const clearSnapshots = usePhotobioStore((s) => s.clearSnapshots);

  if (snapshots.length === 0) {
    return (
      <div className={cn("rounded-xl border border-border bg-card", compact ? "p-3" : "p-4", className)}>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Histórico da sessão
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Salve snapshots para comparar 660 vs 808, técnica ruim vs corrigida ou anatomias diferentes.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card", compact ? "p-3" : "p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Histórico da sessão
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[10px] text-muted-foreground"
          onClick={clearSnapshots}
        >
          Limpar
        </Button>
      </div>

      <div className="relative">
        <div className="absolute bottom-3 left-3 top-3 w-px bg-border" aria-hidden />
        <ul className="space-y-2">
          {snapshots.map((snap, index) => (
            <li key={snap.id} className="relative pl-7">
              <span
                className={cn(
                  "absolute left-1.5 top-3 h-3 w-3 rounded-full border-2 border-background",
                  index === snapshots.length - 1 ? "bg-rose-500" : "bg-muted-foreground/40",
                )}
                aria-hidden
              />
              <div className="rounded-lg border border-border bg-background/60 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{snap.label}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTime(snap.createdAt)}
                      <span className="text-muted-foreground/60">·</span>
                      <span className="font-mono tabular-nums">
                        {snap.config.wavelength} nm · F eff. {snap.interaction.effectiveFluence.toFixed(1)}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => restoreSnapshot(snap.id)}
                      aria-label={`Restaurar ${snap.label}`}
                      title="Restaurar configuração"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSnapshot(snap.id)}
                      aria-label={`Remover ${snap.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
