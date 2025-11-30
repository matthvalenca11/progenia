import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { TensBaseFigure } from "@/components/labs/TensBaseFigure";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { Activity, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { simulateTens, type TensMode } from "@/lib/tensSimulation";
import { TensLabConfig, defaultTensLabConfig } from "@/types/tensLabConfig";

interface TensLabPageProps {
  config?: TensLabConfig;
}

export default function TensLabPage({ config = defaultTensLabConfig }: TensLabPageProps) {
  const navigate = useNavigate();
  
  // Estados dos parâmetros com valores iniciais baseados na config
  const [frequency, setFrequency] = useState(
    Math.min(80, config.frequencyRange.max, Math.max(config.frequencyRange.min, 80))
  );
  const [pulseWidth, setPulseWidth] = useState(
    Math.min(200, config.pulseWidthRange.max, Math.max(config.pulseWidthRange.min, 200))
  );
  const [intensity, setIntensity] = useState(
    Math.min(20, config.intensityRange.max, Math.max(config.intensityRange.min, 20))
  );
  const [mode, setMode] = useState<TensMode>(
    config.allowedModes[0] || "convencional"
  );

  // Simulação em tempo real
  const sim = useMemo(() => 
    simulateTens({
      frequencyHz: frequency,
      pulseWidthUs: pulseWidth,
      intensitymA: intensity,
      mode,
    }), 
    [frequency, pulseWidth, intensity, mode]
  );

  // Determinar classe de animação do halo baseada na frequência
  const haloAnimationClass = useMemo(() => {
    if (frequency <= 20) return "animate-pulse-slow";
    if (frequency <= 80) return "animate-pulse-medium";
    return "animate-pulse-fast";
  }, [frequency]);

  // Determinar cor do halo baseada no conforto (gradientes multicamada)
  const haloColors = useMemo(() => {
    if (sim.comfortLevel >= 70) {
      return {
        outer: "from-emerald-300/40 via-teal-300/30 to-transparent",
        inner: "from-emerald-400/60 via-teal-400/50 to-emerald-300/30"
      };
    }
    if (sim.comfortLevel >= 40) {
      return {
        outer: "from-amber-300/40 via-orange-300/30 to-transparent",
        inner: "from-amber-400/60 via-orange-400/50 to-amber-300/30"
      };
    }
    return {
      outer: "from-rose-300/40 via-red-300/30 to-transparent",
      inner: "from-rose-400/60 via-red-400/50 to-rose-300/30"
    };
  }, [sim.comfortLevel]);

  // Calcular opacidade do halo baseada na ativação
  const haloOpacity = useMemo(() => {
    return 0.1 + 0.5 * (sim.activationLevel / 100);
  }, [sim.activationLevel]);

  // Gerar dados da forma de onda
  const waveformData = useMemo(() => {
    const points = [];
    const period = 1000 / frequency; // período em ms
    const totalTime = Math.min(1000, period * 5); // mostrar até 1s ou 5 ciclos
    const samples = 200;
    
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * totalTime;
      const cycleTime = t % period;
      const pulseWidthMs = pulseWidth / 1000;
      
      let amplitude = 0;
      
      // Forma de onda baseada no modo
      if (mode === "burst") {
        // Burst: grupos de pulsos
        const burstPeriod = period / 5;
        const inBurst = (cycleTime % (period / 2)) < burstPeriod * 2;
        if (inBurst && cycleTime < pulseWidthMs) {
          amplitude = intensity;
        }
      } else if (mode === "modulado") {
        // Modulado: amplitude varia
        const modulation = Math.sin((t / totalTime) * Math.PI * 4) * 0.3 + 0.7;
        if (cycleTime < pulseWidthMs) {
          amplitude = intensity * modulation;
        }
      } else {
        // Convencional e Acupuntura: pulso retangular simples
        if (cycleTime < pulseWidthMs) {
          amplitude = intensity;
        }
      }
      
      points.push({
        time: parseFloat(t.toFixed(2)),
        amplitude: parseFloat(amplitude.toFixed(2))
      });
    }
    
    return points;
  }, [frequency, pulseWidth, intensity, mode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header com botão de voltar */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          
          <div className="flex items-center gap-3 mb-2">
            <Activity className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold">
              Laboratório Virtual de Eletroterapia – TENS
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Ajuste os parâmetros do equipamento TENS (estimulação elétrica transcutânea) e visualize, 
            em tempo real, os efeitos simulados da estimulação entre os eletrodos. 
            Experimente diferentes configurações para compreender como cada parâmetro influencia a terapia.
          </p>
        </div>

        {/* Layout principal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coluna Esquerda - Controles */}
          <div className="space-y-6">
            {/* Card de Controles Principais */}
            {(config.enabledControls.frequency || config.enabledControls.pulseWidth || config.enabledControls.intensity) && (
              <Card className="p-6 shadow-lg">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  Parâmetros de Estimulação
                </h2>
                
                <div className="space-y-8">
                  {/* Frequência */}
                  {config.enabledControls.frequency && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <Label className="text-base font-medium">Frequência</Label>
                        <span className="text-lg font-bold text-primary">
                          {frequency} <span className="text-sm font-normal text-muted-foreground">Hz</span>
                        </span>
                      </div>
                      <Slider
                        value={[frequency]}
                        onValueChange={(v) => setFrequency(v[0])}
                        min={config.frequencyRange.min}
                        max={config.frequencyRange.max}
                        step={1}
                        className="py-4"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{config.frequencyRange.min} Hz</span>
                        <span>{config.frequencyRange.max} Hz</span>
                      </div>
                    </div>
                  )}

                  {/* Largura de Pulso */}
                  {config.enabledControls.pulseWidth && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <Label className="text-base font-medium">Largura de Pulso</Label>
                        <span className="text-lg font-bold text-primary">
                          {pulseWidth} <span className="text-sm font-normal text-muted-foreground">µs</span>
                        </span>
                      </div>
                      <Slider
                        value={[pulseWidth]}
                        onValueChange={(v) => setPulseWidth(v[0])}
                        min={config.pulseWidthRange.min}
                        max={config.pulseWidthRange.max}
                        step={10}
                        className="py-4"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{config.pulseWidthRange.min} µs</span>
                        <span>{config.pulseWidthRange.max} µs</span>
                      </div>
                    </div>
                  )}

                  {/* Intensidade */}
                  {config.enabledControls.intensity && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <Label className="text-base font-medium">Intensidade</Label>
                        <span className="text-lg font-bold text-primary">
                          {intensity} <span className="text-sm font-normal text-muted-foreground">mA</span>
                        </span>
                      </div>
                      <Slider
                        value={[intensity]}
                        onValueChange={(v) => setIntensity(v[0])}
                        min={config.intensityRange.min}
                        max={config.intensityRange.max}
                        step={1}
                        className="py-4"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{config.intensityRange.min} mA</span>
                        <span>{config.intensityRange.max} mA</span>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Modo TENS */}
            {config.enabledControls.mode && config.allowedModes.length > 0 && (
              <Card className="p-6 shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Modo de Estimulação</h3>
                <div className="grid grid-cols-2 gap-3">
                  {config.allowedModes.map((m) => (
                    <Button
                      key={m}
                      variant={mode === m ? "default" : "outline"}
                      onClick={() => setMode(m)}
                      className="capitalize h-auto py-3"
                    >
                      {m}
                    </Button>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {mode === "convencional" && "Estimulação contínua de alta frequência (50-100 Hz) para alívio de dor aguda através da teoria das comportas."}
                    {mode === "acupuntura" && "Baixa frequência (2-10 Hz) com pulsos longos para liberação de endorfinas e alívio de dor crônica."}
                    {mode === "burst" && "Grupos de pulsos de alta frequência entregues em baixa frequência de repetição, combinando efeitos sensoriais e motores."}
                    {mode === "modulado" && "Amplitude modulada para prevenir acomodação sensorial e manter eficácia ao longo do tempo."}
                  </p>
                </div>
              </Card>
            )}

            {/* Feedback de Simulação */}
            {config.showComfortCard && (
              <Card className="p-6 border-2 shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Feedback da Estimulação</h3>
                
                <div className="space-y-4">
                  {/* Barra de Conforto */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground font-medium">Nível de Conforto</span>
                      <span className="font-bold">{sim.comfortLevel}/100</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          sim.comfortLevel >= 70 ? "bg-green-500" :
                          sim.comfortLevel >= 40 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${sim.comfortLevel}%` }}
                      />
                    </div>
                  </div>

                  {/* Barra de Ativação */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground font-medium">Nível de Ativação Sensorial</span>
                      <span className="font-bold">{sim.activationLevel}/100</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${sim.activationLevel}%` }}
                      />
                    </div>
                  </div>

                  {/* Mensagem de Feedback */}
                  <div className={`p-4 rounded-lg border-l-4 ${
                    sim.comfortLevel >= 70 ? "bg-green-50 dark:bg-green-950/20 border-green-500" :
                    sim.comfortLevel >= 40 ? "bg-amber-50 dark:bg-amber-950/20 border-amber-500" : 
                    "bg-red-50 dark:bg-red-950/20 border-red-500"
                  }`}>
                    <p className={`text-sm font-semibold ${
                      sim.comfortLevel >= 70 ? "text-green-700 dark:text-green-400" :
                      sim.comfortLevel >= 40 ? "text-amber-700 dark:text-amber-400" : 
                      "text-red-700 dark:text-red-400"
                    }`}>
                      {sim.comfortMessage}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Coluna Direita - Visualização */}
          <div className="space-y-6">
            {/* Figura Base com Halo Animado */}
            <Card className="p-6 shadow-lg border-primary/10">
              <h3 className="text-lg font-semibold mb-4">Visualização da Estimulação</h3>
              
              <div className="relative">
                {/* Figura base */}
                <TensBaseFigure />
                
                {/* Campo elétrico multicamadas - Layer 1: difuso externo */}
                <div 
                  className={`absolute inset-0 pointer-events-none flex items-center justify-center ${haloAnimationClass}`}
                  style={{ 
                    opacity: haloOpacity * 0.6,
                  }}
                >
                  <div 
                    className={`w-3/5 h-2/5 bg-gradient-radial ${haloColors.outer} rounded-full blur-[60px] transition-all duration-500`}
                  />
                </div>
                
                {/* Campo elétrico multicamadas - Layer 2: pulsação central */}
                <div 
                  className={`absolute inset-0 pointer-events-none flex items-center justify-center ${haloAnimationClass}`}
                  style={{ 
                    opacity: haloOpacity * 0.9,
                    animationDelay: "0.15s"
                  }}
                >
                  <div 
                    className={`w-2/5 h-1/4 bg-gradient-radial ${haloColors.inner} rounded-full blur-[40px] transition-all duration-500`}
                  />
                </div>
                
                {/* Indicador de intensidade */}
                <div className="absolute bottom-4 right-4 bg-background/95 backdrop-blur-sm rounded-lg px-3 py-2 border shadow-md">
                  <div className="text-xs text-muted-foreground mb-1">Campo Elétrico</div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      intensity > 50 ? "bg-red-500 animate-pulse" :
                      intensity > 25 ? "bg-amber-500" : 
                      intensity > 0 ? "bg-green-500" : "bg-muted"
                    }`} />
                    <span className="text-sm font-medium">
                      {intensity === 0 ? "Inativo" : 
                       intensity > 50 ? "Alto" :
                       intensity > 25 ? "Médio" : "Baixo"}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Gráfico de Forma de Onda */}
            {config.showWaveform && (
              <Card className="p-6 shadow-lg">
                <h3 className="text-lg font-semibold mb-4">Forma de Onda TENS</h3>
                
                <div className="h-64 mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={waveformData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="time" 
                        label={{ value: 'Tempo (ms)', position: 'insideBottom', offset: -5 }}
                        className="text-xs"
                        type="number"
                        domain={[0, 'dataMax']}
                      />
                      <YAxis 
                        label={{ value: 'Amplitude (mA)', angle: -90, position: 'insideLeft' }}
                        className="text-xs"
                        domain={[0, 'dataMax']}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))' 
                        }}
                      />
                      <Line 
                        type="stepAfter" 
                        dataKey="amplitude" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Métricas calculadas */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <div className="text-xs text-muted-foreground mb-1">Período</div>
                    <div className="text-sm font-bold">
                      {(1000 / frequency).toFixed(1)} ms
                    </div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <div className="text-xs text-muted-foreground mb-1">Duty Cycle</div>
                    <div className="text-sm font-bold">
                      {((pulseWidth / 1000) / (1000 / frequency) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <div className="text-xs text-muted-foreground mb-1">Carga/Pulso</div>
                    <div className="text-sm font-bold">
                      {(intensity * pulseWidth / 1000).toFixed(1)} µC
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
