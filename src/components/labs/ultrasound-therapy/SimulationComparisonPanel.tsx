/**
 * Painel de comparação A/B entre snapshots ou simulação atual.
 */

import { useMemo, useState } from "react";
import { ArrowLeftRight, TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import {
  buildComparisonInsights,
  compareUltrasoundResults,
  formatDelta,
  suggestSnapshotLabel,
} from "@/lib/ultrasoundTherapyComparison";
import { cn } from "@/lib/utils";
import { utCard, utHint, utLabel, utSelectTrigger } from "./ultrasoundTherapyUi";

interface SimulationComparisonPanelProps {
  compact?: boolean;
  className?: string;
}

const CURRENT_ID = "__current__";

const INSIGHT_TONE = {
  positive: "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200",
  negative: "border-red-500/30 bg-red-500/5 text-red-800 dark:text-red-200",
  neutral: "border-border bg-muted/40 text-foreground",
} as const;

function ToneIcon({ tone }: { tone: "positive" | "negative" | "neutral" }) {
  if (tone === "positive") return <TrendingUp className="h-4 w-4 shrink-0 text-emerald-500" />;
  if (tone === "negative") return <TrendingDown className="h-4 w-4 shrink-0 text-red-500" />;
  return <Minus className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

export function SimulationComparisonPanel({ compact = false, className }: SimulationComparisonPanelProps) {
  const { snapshots, config, simulationResult } = useUltrasoundTherapyStore();
  const [idA, setIdA] = useState<string>("");
  const [idB, setIdB] = useState<string>(CURRENT_ID);

  const resolvedA = useMemo(() => {
    if (!idA) return null;
    return snapshots.find((s) => s.id === idA) ?? null;
  }, [idA, snapshots]);

  const resolvedB = useMemo(() => {
    if (!idB) return null;
    if (idB === CURRENT_ID && simulationResult) {
      return {
        id: CURRENT_ID,
        label: "Simulação atual",
        createdAt: Date.now(),
        config,
        result: simulationResult,
      };
    }
    return snapshots.find((s) => s.id === idB) ?? null;
  }, [idB, snapshots, config, simulationResult]);

  const comparison = useMemo(() => {
    if (!resolvedA || !resolvedB) return null;
    const deltas = compareUltrasoundResults(
      resolvedA.result,
      resolvedB.result,
      resolvedA.config,
      resolvedB.config,
    );
    const insights = buildComparisonInsights(resolvedA, resolvedB);
    return { deltas, insights };
  }, [resolvedA, resolvedB]);

  if (snapshots.length === 0) {
    return (
      <div className={cn(utCard, compact ? "p-3" : "p-4", className)}>
        <p className={utLabel}>Comparar simulações</p>
        <p className={cn("mt-2", utHint)}>
          Salve pelo menos um snapshot para comparar antes e depois.
        </p>
      </div>
    );
  }

  const defaultA = snapshots.length >= 1 ? snapshots[0].id : "";
  const effectiveA = idA || defaultA;

  return (
    <div className={cn(utCard, compact ? "p-3" : "p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <ArrowLeftRight className="h-4 w-4 text-cyan-500" />
        <p className={utLabel}>Comparar simulações</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">Antes (A)</p>
          <Select value={effectiveA} onValueChange={setIdA}>
            <SelectTrigger className={cn("h-9", utSelectTrigger)}>
              <SelectValue placeholder="Snapshot A" />
            </SelectTrigger>
            <SelectContent>
              {snapshots.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">Depois (B)</p>
          <Select value={idB || CURRENT_ID} onValueChange={setIdB}>
            <SelectTrigger className={cn("h-9", utSelectTrigger)}>
              <SelectValue placeholder="Snapshot B" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CURRENT_ID}>
                Simulação atual ({suggestSnapshotLabel(config)})
              </SelectItem>
              {snapshots.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {comparison && resolvedA && resolvedB && (
        <>
          <ul className="mt-4 space-y-2">
            {comparison.insights.map((insight) => (
              <li
                key={insight.id}
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed",
                  INSIGHT_TONE[insight.tone],
                )}
              >
                <ToneIcon tone={insight.tone} />
                <span>{insight.message}</span>
              </li>
            ))}
          </ul>

          {!compact && (
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-[11px]">
              <MetricDelta label="Prof. efetiva" value={formatDelta(comparison.deltas.deltaEffectiveDepth, "cm", 2)} />
              <MetricDelta label="Temp. superfície" value={formatDelta(comparison.deltas.deltaSurfaceTemp, "°C", 1)} />
              <MetricDelta label="Temp. alvo" value={formatDelta(comparison.deltas.deltaTargetTemp, "°C", 1)} />
              <MetricDelta label="Risco periosteal" value={formatDelta(comparison.deltas.deltaPeriostealRisk, "", 2)} />
              <MetricDelta label="Cavitação" value={formatDelta(comparison.deltas.deltaCavitationIndex, "", 2)} />
              <MetricDelta label="Ablação" value={formatDelta(comparison.deltas.deltaAblationIndex, "", 2)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricDelta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-2 py-1.5">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-mono font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
