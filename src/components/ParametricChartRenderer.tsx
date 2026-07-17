import { useEffect, useState } from "react";
import { Loader2, LineChart } from "lucide-react";
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

function isInlineChartConfig(data: unknown): data is DynamicChartBlockData {
  if (!data || typeof data !== "object") return false;
  const candidate = data as DynamicChartBlockData;
  return typeof candidate.source_type === "string" && Array.isArray(candidate.parameters);
}

export function ParametricChartRenderer({
  chartId,
  inlineConfig,
  className,
}: ParametricChartRendererProps) {
  const [config, setConfig] = useState<DynamicChartBlockData | null>(
    inlineConfig ?? null,
  );
  const [loading, setLoading] = useState(!!chartId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chartId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    parametricChartService
      .getById(chartId)
      .then((chart) => {
        if (cancelled) return;
        if (!chart?.config_data) {
          setError("Gráfico não encontrado.");
          setConfig(null);
          return;
        }
        setConfig(chart.config_data);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Não foi possível carregar o gráfico.");
          setConfig(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chartId]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center text-muted-foreground",
          className,
        )}
      >
        <LineChart className="h-8 w-8 opacity-50" />
        <p className="text-sm">{error || "Gráfico indisponível."}</p>
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
  if (block.chartId) return { chartId: block.chartId };
  if (isInlineChartConfig(data)) return { inlineConfig: data };
  return {};
}
