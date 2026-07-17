import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPhotobioFraction } from "@/lib/photobioOptics";
import { usePhotobioStore } from "@/stores/photobioStore";
import { usePhotobioInterpretation } from "./usePhotobioInterpretation";

const LAYER_COLORS: Record<string, string> = {
  epidermis: "#fbbf24",
  dermis: "#f97316",
  adipose: "#fde047",
  muscle: "#a855f7",
  bone: "#e2e8f0",
};

export function PhotobioDepthProfileChart() {
  const fluence = usePhotobioStore((s) => s.fluence());
  const { interaction, depthSamples, muscleEntryDepthMm } = usePhotobioInterpretation();
  const layerConfig = usePhotobioStore((s) => s.layerConfig);

  const chartData = useMemo(() => {
    const step = Math.max(1, Math.floor(depthSamples.length / 40));
    return depthSamples
      .filter((_, i) => i % step === 0)
      .map((s) => ({
        zMm: s.zMm,
        fluenceRelative: Number((s.fluenceRelative * 100).toFixed(1)),
        layer: s.layerType,
        color: LAYER_COLORS[s.layerType] ?? "#94a3b8",
      }));
  }, [depthSamples]);

  const maxZ = useMemo(
    () => Math.max(...depthSamples.map((s) => s.zMm), layerConfig.muscleMm + muscleEntryDepthMm, 1),
    [depthSamples, layerConfig.muscleMm, muscleEntryDepthMm],
  );

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Perfil F(z) — fluência relativa</p>
        <p className="text-[10px] text-muted-foreground/80 mt-0.5">
          Linha tracejada = início do músculo ({muscleEntryDepthMm.toFixed(0)} mm)
        </p>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="pbmDepthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="zMm"
              type="number"
              tick={{ fontSize: 10 }}
              domain={[0, maxZ]}
              label={{ value: "mm", position: "insideBottomRight", offset: -4, fontSize: 10 }}
            />
            <YAxis tick={{ fontSize: 10 }} domain={[0, 105]} unit="%" />
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(1)}%`, "Fluência rel."]}
              labelFormatter={(z) => `Profundidade ${Number(z).toFixed(1)} mm`}
            />
            <Area
              type="monotone"
              dataKey="fluenceRelative"
              stroke="#f97316"
              fill="url(#pbmDepthGrad)"
              strokeWidth={2}
              dot={false}
            />
            <ReferenceLine
              x={muscleEntryDepthMm}
              stroke="#a855f7"
              strokeDasharray="4 4"
              label={{ value: "Músculo", position: "top", fontSize: 9, fill: "#a855f7" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded border bg-muted/20 px-2 py-1.5">
          <p className="text-muted-foreground">Fluência nominal</p>
          <p className="font-mono font-semibold">{fluence.toFixed(2)} J/cm²</p>
        </div>
        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5">
          <p className="text-emerald-600/80 dark:text-emerald-400/80">Fluência efetiva</p>
          <p className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            {interaction.effectiveFluence.toFixed(2)} J/cm²
          </p>
        </div>
        <div className="rounded border bg-muted/20 px-2 py-1.5">
          <p className="text-muted-foreground">No músculo (efetiva)</p>
          <p className="font-mono font-semibold">{interaction.muscleFluence.toFixed(2)} J/cm²</p>
        </div>
        <div className="rounded border bg-muted/20 px-2 py-1.5">
          <p className="text-muted-foreground">Transmissão muscular (efetiva)</p>
          <p className="font-mono font-semibold">{formatPhotobioFraction(interaction.muscleFluenceRatio)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[9px]">
        {Object.entries(LAYER_COLORS)
          .slice(0, 4)
          .map(([layer, color]) => (
            <span key={layer} className="flex items-center gap-1 text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
              {layer}
            </span>
          ))}
      </div>
    </div>
  );
}
