import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useDynamicChart } from "@/hooks/useDynamicChart";
import type { DynamicChartBlockData } from "@/types/dynamicChart";
import { DynamicChartSlider } from "./DynamicChartSlider";
import { DynamicChartFeedback } from "./DynamicChartFeedback";
import { cn } from "@/lib/utils";
import { hasValidFormulaSyntax } from "@/lib/dynamicChart/formulaEngine";

interface DynamicChartViewerProps {
  config: DynamicChartBlockData;
  className?: string;
  /** Modo compacto para preview do admin */
  compact?: boolean;
}

export function DynamicChartViewer({ config, className, compact = false }: DynamicChartViewerProps) {
  const {
    parameterValues,
    setParameter,
    series,
    chartData,
    yDomain,
    primaryFeedback,
  } = useDynamicChart(config);

  const [hoverX, setHoverX] = useState<number | null>(null);
  const hasInvalidFormula =
    config.source_type === "custom_formula" &&
    (config.formulas ?? []).some((formula) => !hasValidFormulaSyntax(formula.expression));

  const chartConfig = useMemo((): ChartConfig => {
    const cfg: ChartConfig = {};
    for (const s of series) {
      cfg[s.id] = { label: s.label, color: s.color };
    }
    return cfg;
  }, [series]);

  const xLabel = [config.axes.x.label, config.axes.x.unit].filter(Boolean).join(" ");
  const yLabel = [config.axes.y.label, config.axes.y.unit].filter(Boolean).join(" ");

  return (
    <div
      className={cn(
        "rounded-3xl border border-border/50 bg-card/80 shadow-sm backdrop-blur-sm overflow-hidden",
        className,
      )}
    >
      {/* Cabeçalho */}
      <div className="border-b border-border/40 px-5 py-4 sm:px-6">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{config.title}</h3>
        {config.subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">{config.subtitle}</p>
        )}
        {config.description && !compact && (
          <p className="text-sm text-muted-foreground/90 mt-2 leading-relaxed">{config.description}</p>
        )}
      </div>

      <div className={cn("grid gap-6 p-5 sm:p-6", compact ? "grid-cols-1" : "lg:grid-cols-[1fr_280px]")}>
        {/* Gráfico */}
        <div className="min-w-0 touch-pan-y">
          {hasInvalidFormula ? (
            <div
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 px-4 text-center",
                compact ? "h-[220px]" : "h-[280px] sm:h-[320px]",
              )}
            >
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <p className="text-sm font-medium">Não foi possível desenhar este gráfico.</p>
              <p className="text-xs text-muted-foreground">
                A fórmula está incompleta ou contém um erro de sintaxe.
              </p>
            </div>
          ) : (
            <ChartContainer
              config={chartConfig}
              className={cn("w-full", compact ? "h-[220px]" : "h-[280px] sm:h-[320px]")}
            >
              <LineChart
              data={chartData}
              margin={{ top: 12, right: 12, left: 4, bottom: 8 }}
              onMouseMove={(e) => {
                if (e?.activeLabel != null) setHoverX(Number(e.activeLabel));
              }}
              onMouseLeave={() => setHoverX(null)}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
              <XAxis
                dataKey="x"
                type="number"
                domain={[
                  config.axes.x.min ?? "auto",
                  config.axes.x.max ?? "auto",
                ]}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v) => Number(v).toFixed(1)}
                label={
                  xLabel
                    ? { value: xLabel, position: "insideBottom", offset: -2, fontSize: 11 }
                    : undefined
                }
              />
              <YAxis
                domain={yDomain}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={44}
                tickFormatter={(v) => Number(v).toFixed(0)}
                label={
                  yLabel
                    ? { value: yLabel, angle: -90, position: "insideLeft", fontSize: 11 }
                    : undefined
                }
              />
              {hoverX != null && (
                <ReferenceLine
                  x={hoverX}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                />
              )}
              <Tooltip
                content={
                  <ChartTooltipContent
                    className="rounded-xl border-border/50 bg-background/80 backdrop-blur-xl shadow-lg"
                    labelFormatter={(label) => `${config.axes.x.label}: ${Number(label).toFixed(2)}${config.axes.x.unit ? ` ${config.axes.x.unit}` : ""}`}
                  />
                }
                cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeOpacity: 0.35 }}
              />
              {series.map((s) => (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={s.id}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={s.strokeWidth}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                  isAnimationActive
                  animationDuration={400}
                  animationEasing="ease-out"
                />
              ))}
              </LineChart>
            </ChartContainer>
          )}
        </div>

        {/* Sliders */}
        <div className="space-y-5">
          {config.parameters.map((param) => (
            <DynamicChartSlider
              key={param.id}
              parameter={param}
              value={parameterValues[param.id] ?? param.defaultValue}
              onChange={(v) => setParameter(param.id, v)}
            />
          ))}
        </div>
      </div>

      {/* Feedback dinâmico */}
      {!compact && (
        <div className="border-t border-border/40 px-5 py-4 sm:px-6">
          <DynamicChartFeedback feedback={primaryFeedback} />
        </div>
      )}
    </div>
  );
}
