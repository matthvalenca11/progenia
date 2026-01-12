/**
 * BottomDock - Dock inferior com tabs para análises
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, BarChart3, Activity, Shield, BookOpen } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { useTensLabStore } from "@/stores/tensLabStore";
import { useMemo } from "react";

export function TensLabBottomDock() {
  const { bottomDockExpanded, setBottomDockExpanded, bottomDockTab, setBottomDockTab, frequency, pulseWidth, intensity, mode, simulationResult } = useTensLabStore();

  const chartData = useMemo(() => {
    const points = [];
    const period = 1000 / frequency;
    const totalTime = Math.min(1000, period * 5);
    const samples = 150;
    
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * totalTime;
      const cycleTime = t % period;
      const pulseWidthMs = pulseWidth / 1000;
      let amplitude = cycleTime < pulseWidthMs ? intensity : 0;
      
      if (mode === "burst") {
        const inBurst = (cycleTime % (period / 2)) < (period / 5);
        amplitude = inBurst && cycleTime < pulseWidthMs ? intensity : 0;
      } else if (mode === "modulado") {
        const mod = Math.sin((t / totalTime) * Math.PI * 4) * 0.3 + 0.7;
        amplitude = cycleTime < pulseWidthMs ? intensity * mod : 0;
      }
      
      points.push({ time: parseFloat(t.toFixed(1)), amplitude: parseFloat(amplitude.toFixed(1)) });
    }
    return points;
  }, [frequency, pulseWidth, intensity, mode]);

  const periodMs = (1000 / frequency).toFixed(1);
  const dutyCycle = ((pulseWidth / 1000) / (1000 / frequency) * 100).toFixed(1);
  const chargePerPulse = (intensity * pulseWidth / 1000).toFixed(1);

  return (
    <Card className={`border-t transition-all duration-300 ${bottomDockExpanded ? 'h-64' : 'h-12'}`}>
      <div className="flex items-center justify-between px-4 h-12 border-b">
        <Tabs value={bottomDockTab} onValueChange={(v) => setBottomDockTab(v as any)} className="flex-1">
          <TabsList className="h-8">
            <TabsTrigger value="analysis" className="text-xs h-7 gap-1"><BarChart3 className="h-3 w-3" />Análises</TabsTrigger>
            <TabsTrigger value="waveform" className="text-xs h-7 gap-1"><Activity className="h-3 w-3" />Forma de Onda</TabsTrigger>
            <TabsTrigger value="safety" className="text-xs h-7 gap-1"><Shield className="h-3 w-3" />Segurança</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs h-7 gap-1"><BookOpen className="h-3 w-3" />Notas</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setBottomDockExpanded(!bottomDockExpanded)}>
          {bottomDockExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>

      {bottomDockExpanded && (
        <div className="p-4 h-[calc(100%-3rem)] overflow-auto">
          {bottomDockTab === "waveform" && (
            <div className="flex gap-4 h-full">
              <div className="flex-1 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="time" label={{ value: 'ms', position: 'insideBottom', offset: -5 }} className="text-xs" />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} className="text-xs" />
                    <Tooltip />
                    <Line type="stepAfter" dataKey="amplitude" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="w-48 space-y-2">
                <div className="p-2 bg-muted/50 rounded text-center"><div className="text-xs text-muted-foreground">Período</div><div className="font-bold">{periodMs} ms</div></div>
                <div className="p-2 bg-muted/50 rounded text-center"><div className="text-xs text-muted-foreground">Duty Cycle</div><div className="font-bold">{dutyCycle}%</div></div>
                <div className="p-2 bg-muted/50 rounded text-center"><div className="text-xs text-muted-foreground">Carga/Pulso</div><div className="font-bold">{chargePerPulse} µC</div></div>
              </div>
            </div>
          )}
          {bottomDockTab === "analysis" && simulationResult && (
            <div className="grid grid-cols-4 gap-4 h-full">
              <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground mb-1">E pico (pele)</div><div className="text-lg font-bold">{simulationResult.E_peak_skin.toFixed(2)} V/cm</div></div>
              <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground mb-1">E pico (músculo)</div><div className="text-lg font-bold">{simulationResult.E_peak_muscle.toFixed(2)} V/cm</div></div>
              <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground mb-1">Spread do campo</div><div className="text-lg font-bold">{simulationResult.fieldSpreadCm.toFixed(1)} cm</div></div>
              <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground mb-1">Área ativada</div><div className="text-lg font-bold">{simulationResult.activatedAreaCm2.toFixed(1)} cm²</div></div>
            </div>
          )}
          {bottomDockTab === "safety" && simulationResult && (
            <div className="space-y-2">{simulationResult.riskMessages.map((msg, i) => <div key={i} className="p-2 bg-muted/30 rounded text-sm">{msg}</div>)}</div>
          )}
          {bottomDockTab === "notes" && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>TENS Convencional:</strong> Alta frequência (50-100Hz) para analgesia por teoria das comportas.</p>
              <p><strong>TENS Acupuntura:</strong> Baixa frequência (2-10Hz) para liberação de endorfinas.</p>
              <p><strong>Distância entre eletrodos:</strong> Menor = superficial e concentrado. Maior = profundo e espalhado.</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
