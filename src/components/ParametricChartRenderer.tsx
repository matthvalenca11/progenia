import { useEffect, useState } from "react";
import { Loader2, LineChart, Wrench } from "lucide-react";
import { DynamicChartViewer } from "@/components/dynamic-chart";
import { parametricChartService } from "@/services/parametricChartService";
import type { DynamicChartBlockData } from "@/types/dynamicChart";
import { cn } from "@/lib/utils";

interface ParametricChartRendererProps {
  chartId?: string;
  /** Config inline legada (antes da separação em entidade reutilizável) */
  inlineConfig?: DynamicChartBlockData;
  className?: string;
}

export type ParametricChartLoadState = "loading" | "ready" | "maintenance" | "unavailable";

const MAINTENANCE_MESSAGE =
  "Este gráfico está em manutenção ou foi atualizado.";

function isInlineChartConfig(data: unknown): data is DynamicChartBlockData {
  if (!data || typeof data !== "object") return false;
  const candidate = data as DynamicChartBlockData;
  return typeof candidate.source_type === "string" && Array.isArray(candidate.parameters);
}

function ParametricChartMaintenanceFallback({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 px-6 py-10 text-center",
        className,
      )}
      role="status"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
        <Wrench className="h-6 w-6 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="space-y-1 max-w-sm">
        <p className="text-sm font-medium text-foreground">{MAINTENANCE_MESSAGE}</p>
        <p className="text-xs text-muted-foreground">
          O conteúdo pode ter sido despublicado ou substituído. Tente novamente mais tarde ou
          continue com os demais materiais da aula.
        </p>
      </div>
      <LineChart className="h-5 w-5 text-muted-foreground/40" aria-hidden />
    </div>
  );
}

export function ParametricChartRenderer({
  chartId,
  inlineConfig,
  className,
}: ParametricChartRendererProps) {
  const [config, setConfig] = useState<DynamicChartBlockData | null>(inlineConfig ?? null);
  const [loadState, setLoadState] = useState<ParametricChartLoadState>(
    chartId ? "loading" : inlineConfig ? "ready" : "unavailable",
  );

  useEffect(() => {
    if (inlineConfig) {
      setConfig(inlineConfig);
      setLoadState("ready");
    }
  }, [inlineConfig]);

  useEffect(() => {
    if (!chartId) return;

    let cancelled = false;
    setLoadState("loading");

    parametricChartService
      .getById(chartId)
      .then((chart) => {
        if (cancelled) return;
        if (!chart?.config_data) {
          setConfig(null);
          setLoadState("maintenance");
          return;
        }
        setConfig(chart.config_data);
        setLoadState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setConfig(null);
        setLoadState("maintenance");
      });

    return () => {
      cancelled = true;
    };
  }, [chartId]);

  if (loadState === "loading") {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadState === "maintenance") {
    return <ParametricChartMaintenanceFallback className={className} />;
  }

  if (loadState === "unavailable" || !config) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center text-muted-foreground",
          className,
        )}
      >
        <LineChart className="h-8 w-8 opacity-50" />
        <p className="text-sm">Gráfico indisponível.</p>
      </div>
    );
  }

  return <DynamicChartViewer config={config} className={className} />;
}

/** Resolve bloco de aula/cápsula que pode ser referência ou config legada inline. */
export function resolveParametricChartBlockData(
  data: unknown,
): { chartId?: string; inlineConfig?: DynamicChartBlockData } {
  if (!data || typeof data !== "object") return {};

  const block = data as { chartId?: string } & Partial<DynamicChartBlockData>;
  if (block.chartId?.trim()) return { chartId: block.chartId.trim() };
  if (isInlineChartConfig(data)) return { inlineConfig: data };
  return {};
}
