import { DynamicChartViewer } from "@/components/dynamic-chart";
import type { ParametricChart } from "@/services/parametricChartService";
import { cn } from "@/lib/utils";

interface ParametricChartAdminPreviewProps {
  chartId?: string;
  charts: ParametricChart[];
  className?: string;
}

/** Prévia compacta abaixo do seletor no CMS (usa lista já carregada de gráficos publicados). */
export function ParametricChartAdminPreview({
  chartId,
  charts,
  className,
}: ParametricChartAdminPreviewProps) {
  const normalizedId = chartId?.trim();
  if (!normalizedId || normalizedId === "none") return null;

  const chart = charts.find((item) => item.id === normalizedId);
  if (!chart?.config_data) {
    return (
      <p className={cn("mt-2 text-xs text-muted-foreground", className)}>
        Gráfico não encontrado na lista de publicados.
      </p>
    );
  }

  return (
    <div className={cn("mt-3 space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground">Prévia do gráfico selecionado</p>
      <div className="rounded-xl border bg-muted/20 p-2 overflow-hidden">
        <DynamicChartViewer config={chart.config_data} compact />
      </div>
    </div>
  );
}
