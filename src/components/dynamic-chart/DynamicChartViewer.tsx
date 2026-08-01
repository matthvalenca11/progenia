import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDynamicChart } from "@/hooks/useDynamicChart";
import type { DynamicChartBlockData } from "@/types/dynamicChart";
import { resolveI18nText } from "@/types/dynamicChart";
import { DynamicChartSlider } from "./DynamicChartSlider";
import { DynamicChartFeedbackPanel } from "./DynamicChartFeedback";
import { cn } from "@/lib/utils";
import { isFormulaSeriesValid, resolveFormulaExpression } from "@/lib/dynamicChart/formulaEngine";

interface DynamicChartViewerProps {
  config: DynamicChartBlockData;
  className?: string;
  /** Modo compacto para preview do admin */
  compact?: boolean;
}

export function DynamicChartViewer({ config, className, compact = false }: DynamicChartViewerProps) {
  const { language } = useLanguage();
  const {
    parameterValues,
    setParameter,
    series,
    chartData,
    yDomain,
    displayedFeedbacks,
  } = useDynamicChart(config);

  const [hoverX, setHoverX] = useState<number | null>(null);
  const hasInvalidFormula =
    config.source_type === "custom_formula" &&
    (config.formulas ?? []).some((formula) => !isFormulaSeriesValid(formula));

  const hasEmptyCustomFormulas =
    config.source_type === "custom_formula" &&
    (config.formulas ?? []).every((formula) => !resolveFormulaExpression(formula).trim());

  const chartConfig = useMemo((): ChartConfig => {
    const cfg: ChartConfig = {};
    for (const s of series) {
      cfg[s.id] = { label: s.label, color: s.color };
    }
    return cfg;
  }, [series]);

  const title = resolveI18nText(config.title, language);
  const subtitle = resolveI18nText(config.subtitle, language);
  const description = resolveI18nText(config.description, language);
  const xLabel = [
    resolveI18nText(config.axes.x.label, language),
    config.axes.x.unit,
  ]
    .filter(Boolean)
    .join(" ");
  const yLabel = [
    resolveI18nText(config.axes.y.label, language),
    config.axes.y.unit,
  ]
    .filter(Boolean)
    .join(" ");

  const showLegend = series.length > 1;

  return (
    <div
      className={cn(
        "rounded-3xl border border-border/50 bg-card/80 shadow-sm backdrop-blur-sm overflow-hidden",
        className,
      )}
    >
      <div className="border-b border-border/40 px-5 py-4 sm:px-6">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        )}
        {description && !compact && (
          <p className="text-sm text-muted-foreground/90 mt-2 leading-relaxed">{description}</p>
        )}
      </div>

      <div className={cn("grid gap-6 p-5 sm:p-6", compact ? "grid-cols-1" : "lg:grid-cols-[1fr_280px]")}>
        <div className="min-w-0 touch-pan-y">
          {hasInvalidFormula ? (
            <div
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 px-4 text-center",
                compact ? "h-[220px]" : "h-[280px] sm:h-[320px]",
              )}
            >
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <p className="text-sm font-medium">Gráfico indisponível</p>
              <p className="text-xs text-muted-foreground">
                Revise a sintaxe das fórmulas.
              </p>
            </div>
          ) : hasEmptyCustomFormulas ? (
            <div
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 text-center text-muted-foreground",
                compact ? "h-[220px]" : "h-[280px] sm:h-[320px]",
              )}
            >
              <p className="text-sm">Adicione uma equação válida.</p>
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
                  domain={[config.axes.x.min ?? "auto", config.axes.x.max ?? "auto"]}
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
                {showLegend && (
                  <Legend
                    verticalAlign="top"
                    height={28}
                    formatter={(value) => (
                      <span className="text-xs text-muted-foreground">{value}</span>
                    )}
                  />
                )}
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
                      labelFormatter={(label) =>
                        `${resolveI18nText(config.axes.x.label, language)}: ${Number(label).toFixed(2)}${config.axes.x.unit ? ` ${config.axes.x.unit}` : ""}`
                      }
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

      {!compact && (
        <div className="border-t border-border/40 px-5 py-4 sm:px-6">
          <DynamicChartFeedbackPanel feedbacks={displayedFeedbacks} />
        </div>
      )}
    </div>
  );
}
