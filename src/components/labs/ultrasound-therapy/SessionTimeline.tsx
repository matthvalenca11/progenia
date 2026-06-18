/**
 * Linha do tempo da sessão — snapshots salvos com restauração.
 */

import { Clock, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { cn } from "@/lib/utils";
import { utCard, utHint, utLabel } from "./ultrasoundTherapyUi";

interface SessionTimelineProps {
  compact?: boolean;
  className?: string;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function SessionTimeline({ compact = false, className }: SessionTimelineProps) {
  const { snapshots, restoreSnapshot, removeSnapshot, clearSnapshots } = useUltrasoundTherapyStore();

  if (snapshots.length === 0) {
    return (
      <div className={cn(utCard, compact ? "p-3" : "p-4", className)}>
        <p className={utLabel}>Histórico da sessão</p>
        <p className={cn("mt-2", utHint)}>
          Salve snapshots para comparar configurações ao longo da prática.
        </p>
      </div>
    );
  }

  return (
    <div className={cn(utCard, compact ? "p-3" : "p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className={utLabel}>Histórico da sessão</p>
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
                  index === snapshots.length - 1 ? "bg-cyan-500" : "bg-muted-foreground/40",
                )}
                aria-hidden
              />
              <div className="rounded-lg border border-border bg-background/60 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{snap.label}</p>
                    <p className={cn("mt-0.5 flex items-center gap-1", utHint)}>
                      <Clock className="h-3 w-3" />
                      {formatTime(snap.createdAt)}
                      <span className="text-muted-foreground/60">·</span>
                      <span className="font-mono tabular-nums">
                        {snap.result.effectiveDepth.toFixed(1)} cm
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
