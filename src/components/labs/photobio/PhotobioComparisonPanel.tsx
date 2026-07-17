/**
 * Painel de comparação A/B entre snapshots ou simulação atual — PBM
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
import { usePhotobioStore } from "@/stores/photobioStore";
import {
  buildPhotobioComparisonInsights,
  comparePhotobioInteractions,
  formatPhotobioDelta,
  suggestPhotobioSnapshotLabel,
} from "@/lib/photobioComparison";
import { cn } from "@/lib/utils";

interface PhotobioComparisonPanelProps {
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

export function PhotobioComparisonPanel({ compact = false, className }: PhotobioComparisonPanelProps) {
  const snapshots = usePhotobioStore((s) => s.snapshots);
  const interaction = usePhotobioStore((s) => s.interaction);
  const wavelength = usePhotobioStore((s) => s.wavelength);
  const power = usePhotobioStore((s) => s.power);
  const spotSize = usePhotobioStore((s) => s.spotSize);
  const exposureTime = usePhotobioStore((s) => s.exposureTime);
  const mode = usePhotobioStore((s) => s.mode);
  const dutyCycle = usePhotobioStore((s) => s.dutyCycle);
  const transducerAngle = usePhotobioStore((s) => s.transducerAngle);
  const contactPressure = usePhotobioStore((s) => s.contactPressure);
  const isDragging = usePhotobioStore((s) => s.isDragging);
  const draggingSpeed = usePhotobioStore((s) => s.draggingSpeed);
  const anatomyPreset = usePhotobioStore((s) => s.anatomyPreset);
  const applicatorType = usePhotobioStore((s) => s.applicatorType);
  const [idA, setIdA] = useState<string>("");
  const [idB, setIdB] = useState<string>(CURRENT_ID);

  const currentConfig = useMemo(
    () => ({
      wavelength,
      power,
      spotSize,
      exposureTime,
      mode,
      dutyCycle,
      transducerAngle,
      contactPressure,
      isDragging,
      draggingSpeed,
      anatomyPreset,
      applicatorType,
    }),
    [
      wavelength,
      power,
      spotSize,
      exposureTime,
      mode,
      dutyCycle,
      transducerAngle,
      contactPressure,
      isDragging,
      draggingSpeed,
      anatomyPreset,
      applicatorType,
    ],
  );

  const resolvedA = useMemo(() => {
    if (!idA) return null;
    return snapshots.find((s) => s.id === idA) ?? null;
  }, [idA, snapshots]);

  const resolvedB = useMemo(() => {
    if (!idB) return null;
    if (idB === CURRENT_ID) {
      return {
        id: CURRENT_ID,
        label: "Simulação atual",
        createdAt: Date.now(),
        config: currentConfig,
        interaction,
      };
    }
    return snapshots.find((s) => s.id === idB) ?? null;
  }, [idB, snapshots, currentConfig, interaction]);

  const comparison = useMemo(() => {
    if (!resolvedA || !resolvedB) return null;
    const deltas = comparePhotobioInteractions(
      resolvedA.interaction,
      resolvedB.interaction,
      resolvedA.config,
      resolvedB.config,
    );
    const insights = buildPhotobioComparisonInsights(resolvedA, resolvedB);
    return { deltas, insights };
  }, [resolvedA, resolvedB]);

  if (snapshots.length === 0) {
    return (
      <div className={cn("rounded-xl border border-border bg-card", compact ? "p-3" : "p-4", className)}>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Comparar simulações
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Salve pelo menos um snapshot para comparar 660 vs 808, CW vs Pulsed ou técnica ruim vs corrigida.
        </p>
      </div>
    );
  }

  const defaultA = snapshots.length >= 1 ? snapshots[0].id : "";
  const effectiveA = idA || defaultA;

  return (
    <div className={cn("rounded-xl border border-border bg-card", compact ? "p-3" : "p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <ArrowLeftRight className="h-4 w-4 text-rose-500" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Comparar simulações
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">Antes (A)</p>
          <Select value={effectiveA} onValueChange={setIdA}>
            <SelectTrigger className="h-9">
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
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Snapshot B" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CURRENT_ID}>
                Simulação atual ({suggestPhotobioSnapshotLabel(currentConfig)})
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
              <MetricDelta
                label="F eff."
                value={formatPhotobioDelta(comparison.deltas.deltaEffectiveFluence, "J/cm²")}
              />
              <MetricDelta
                label="Músculo"
                value={formatPhotobioDelta(comparison.deltas.deltaMuscleTransmission * 100, "pp", 1)}
              />
              <MetricDelta
                label="realDoseFactor"
                value={formatPhotobioDelta(comparison.deltas.deltaRealDoseFactor * 100, "%", 0)}
              />
              <MetricDelta
                label="Risco térmico"
                value={formatPhotobioDelta(comparison.deltas.deltaThermalRisk * 100, "pp", 0)}
              />
              <MetricDelta
                label="Irradiância"
                value={formatPhotobioDelta(comparison.deltas.deltaIrradiance, "mW/cm²", 0)}
              />
              <MetricDelta
                label="Fluência muscular"
                value={formatPhotobioDelta(comparison.deltas.deltaMuscleFluence, "J/cm²")}
              />
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
