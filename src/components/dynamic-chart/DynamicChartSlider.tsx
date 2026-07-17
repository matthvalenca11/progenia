import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { DynamicChartParameter } from "@/types/dynamicChart";

interface DynamicChartSliderProps {
  parameter: DynamicChartParameter;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

/** Slider estilo iOS — touch target ≥ 44px, valor flutuante, trilha preenchida */
export function DynamicChartSlider({
  parameter,
  value,
  onChange,
  className,
}: DynamicChartSliderProps) {
  const pct =
    parameter.max > parameter.min
      ? ((value - parameter.min) / (parameter.max - parameter.min)) * 100
      : 0;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3 min-h-[44px]">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{parameter.name}</p>
          {parameter.unit && (
            <p className="text-xs text-muted-foreground">{parameter.unit}</p>
          )}
        </div>
        <div
          className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold tabular-nums text-primary"
          aria-live="polite"
        >
          {formatValue(value, parameter.step)}
          {parameter.unit ? ` ${parameter.unit}` : ""}
        </div>
      </div>

      <div className="relative px-0.5">
        <div
          className="pointer-events-none absolute inset-y-0 left-0.5 rounded-full bg-primary/20"
          style={{ width: `calc(${pct}% - 2px)`, maxWidth: "100%" }}
        />
        <Slider
          value={[value]}
          min={parameter.min}
          max={parameter.max}
          step={parameter.step}
          onValueChange={([v]) => onChange(v)}
          className="relative z-10 min-h-[44px] touch-manipulation [&_[role=slider]]:h-6 [&_[role=slider]]:w-6 [&_[role=slider]]:border-2 [&_[role=slider]]:border-primary/30 [&_[role=slider]]:shadow-md"
          aria-label={parameter.name}
        />
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{parameter.min}</span>
        <span>{parameter.max}</span>
      </div>
    </div>
  );
}

function formatValue(value: number, step: number): string {
  if (step >= 1) return value.toFixed(0);
  if (step >= 0.1) return value.toFixed(1);
  return value.toFixed(2);
}
