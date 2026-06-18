/**
 * BottomDock — forma de onda, segurança e notas pedagógicas.
 */

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Activity, Shield, BookOpen } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { useTensLabStore, BottomDockTab } from "@/stores/tensLabStore";
import { useMemo } from "react";

export function TensLabBottomDock() {
  const {
    frequency,
    pulseWidth,
    intensity,
    mode,
    simulationResult,
    bottomDockTab,
    setBottomDockTab,
    bottomDockExpanded,
    setBottomDockExpanded,
  } = useTensLabStore();

  const chartData = useMemo(() => {
    const points = [];
    const period = 1000 / frequency;
    const totalTime = Math.min(800, period * 4);
    const samples = 120;

    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * totalTime;
      const cycleTime = t % period;
      const pulseWidthMs = pulseWidth / 1000;
      let amplitude = cycleTime < pulseWidthMs ? intensity : 0;

      if (mode === "burst") {
        const inBurst = cycleTime % (period / 2) < period / 5;
        amplitude = inBurst && cycleTime < pulseWidthMs ? intensity : 0;
      } else if (mode === "modulado") {
        const mod = Math.sin((t / totalTime) * Math.PI * 4) * 0.3 + 0.7;
        amplitude = cycleTime < pulseWidthMs ? intensity * mod : 0;
      }

      points.push({ time: t.toFixed(0), amplitude: amplitude.toFixed(0) });
    }
    return points;
  }, [frequency, pulseWidth, intensity, mode]);

  const periodMs = (1000 / frequency).toFixed(1);
  const dutyCycle = (((pulseWidth / 1000) / (1000 / frequency)) * 100).toFixed(1);
  const chargePerPulse = ((intensity * pulseWidth) / 1000).toFixed(1);

  return (
    <div
      className={`shrink-0 border-t border-border bg-card transition-all duration-300 ${
        bottomDockExpanded ? "h-44" : "h-10"
      }`}
    >
      <div className="flex items-center justify-between px-3 h-10 border-b border-border/60">
        <Tabs
          value={bottomDockTab}
          onValueChange={(v) => setBottomDockTab(v as BottomDockTab)}
        >
          <TabsList className="h-7 bg-muted/50">
            <TabsTrigger value="waveform" className="text-[10px] h-5 px-2 gap-1">
              <Activity className="h-3 w-3" />
              Forma de Onda
            </TabsTrigger>
            <TabsTrigger value="safety" className="text-[10px] h-5 px-2 gap-1">
              <Shield className="h-3 w-3" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-[10px] h-5 px-2 gap-1">
              <BookOpen className="h-3 w-3" />
              Notas
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground"
          onClick={() => setBottomDockExpanded(!bottomDockExpanded)}
          aria-label={bottomDockExpanded ? "Recolher dock" : "Expandir dock"}
        >
          {bottomDockExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {bottomDockExpanded && (
        <div className="p-3 h-[calc(100%-2.5rem)]">
          {bottomDockTab === "waveform" && (
            <div className="flex gap-4 h-full">
              <div className="flex-1 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="time"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 50, 100]}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={{ stroke: "hsl(var(--border))" }}
                      width={30}
                    />
                    <Line
                      type="stepAfter"
                      dataKey="amplitude"
                      stroke="hsl(var(--primary))"
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="w-32 flex flex-col justify-center gap-2 shrink-0">
                <div className="p-2 bg-muted/40 rounded text-center">
                  <div className="text-[9px] text-muted-foreground">Período</div>
                  <div className="text-sm font-bold">{periodMs} ms</div>
                </div>
                <div className="p-2 bg-muted/40 rounded text-center">
                  <div className="text-[9px] text-muted-foreground">Duty Cycle</div>
                  <div className="text-sm font-bold">{dutyCycle}%</div>
                </div>
                <div className="p-2 bg-muted/40 rounded text-center">
                  <div className="text-[9px] text-muted-foreground">Carga/Pulso</div>
                  <div className="text-sm font-bold">{chargePerPulse} µC</div>
                </div>
              </div>
            </div>
          )}

          {bottomDockTab === "safety" && simulationResult && (
            <div className="space-y-1.5 max-h-full overflow-y-auto">
              {simulationResult.riskMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`p-2 rounded text-xs ${
                    msg.startsWith("✅")
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {msg}
                </div>
              ))}
            </div>
          )}

          {bottomDockTab === "notes" && (
            <div className="grid grid-cols-2 gap-3 text-[11px] text-muted-foreground">
              <div className="p-2 bg-muted/30 rounded">
                <strong className="text-foreground">Convencional:</strong> Frequência alta
                (50–100 Hz) para analgesia por teoria das comportas.
              </div>
              <div className="p-2 bg-muted/30 rounded">
                <strong className="text-foreground">Acupuntura:</strong> Frequência baixa
                (2–10 Hz) para liberação de endorfinas.
              </div>
              <div className="p-2 bg-muted/30 rounded col-span-2">
                <strong className="text-foreground">Distância:</strong> Menor = superficial e
                concentrado | Maior = profundo e espalhado
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
