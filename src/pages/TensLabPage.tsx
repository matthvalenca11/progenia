import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TensSemi3DView } from "@/components/labs/TensSemi3DView";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { Activity, ArrowLeft, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { simulateTens, type TensMode } from "@/lib/tensSimulation";
import { simulateTissueRisk } from "@/lib/tissueRiskSimulation";
import { TensLabConfig, defaultTensLabConfig } from "@/types/tensLabConfig";
import { TissueConfig, defaultTissueConfig, tissuePresets } from "@/types/tissueConfig";
import { tissueConfigService } from "@/services/tissueConfigService";

interface TensLabPageProps {
  config?: TensLabConfig;
}

export default function TensLabPage({ config = defaultTensLabConfig }: TensLabPageProps) {
  const navigate = useNavigate();
  
  // Estado do tissue config
  const [tissueConfig, setTissueConfig] = useState<TissueConfig>(defaultTissueConfig);
  
  // Carregar tissue config do banco ou usar preset
  useEffect(() => {
    const loadTissueConfig = async () => {
      if (config.tissueConfigId) {
        // Primeiro verifica se é um preset ID
        const preset = tissuePresets.find(p => p.id === config.tissueConfigId);
        
        if (preset && !preset.isCustom) {
          // É um preset predefinido, usar config do preset
          setTissueConfig({
            ...preset.config,
            id: preset.id,
          });
        } else {
          // Tentar carregar do banco (pode ser custom ou uma config salva)
          try {
            const loaded = await tissueConfigService.getById(config.tissueConfigId);
            if (loaded) {
              setTissueConfig(loaded);
            }
          } catch (error) {
            console.error("Error loading tissue config:", error);
          }
        }
      }
    };
    
    loadTissueConfig();
  }, [config.tissueConfigId]);
  
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
  
  // Simulação de risco em tempo real
  const riskResult = useMemo(() => 
    simulateTissueRisk(
      {
        frequencyHz: frequency,
        pulseWidthUs: pulseWidth,
        intensitymA: intensity,
        mode,
      },
      tissueConfig
    ),
    [frequency, pulseWidth, intensity, mode, tissueConfig]
  );

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
            {/* Visualização Lateral Semi-3D */}
            <Card className="p-6 shadow-2xl border-primary/10 bg-gradient-to-br from-slate-950 to-slate-900">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.8)]"></span>
                Visualização Lateral Semi-3D
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Visão anatômica das camadas e profundidade da estimulação
              </p>
              
              <TensSemi3DView
                frequencyHz={frequency}
                pulseWidthUs={pulseWidth}
                intensitymA={intensity}
                mode={mode}
                activationLevel={sim.activationLevel}
                comfortLevel={sim.comfortLevel}
                tissueConfig={tissueConfig}
                riskResult={riskResult}
              />
              
              {/* Legenda */}
              <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-xs font-medium text-slate-300">Anatomia: {tissueConfig.name}</div>
                  {tissueConfig.hasMetalImplant && (
                    <Badge variant="outline" className="text-amber-400 border-amber-400/50">
                      ⚡ Implante Metálico
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-cyan-400/80" />
                    <span className="text-slate-300">Superficial</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                    <span className="text-slate-300">Subcutâneo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400/80" />
                    <span className="text-slate-300">Muscular</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Card de Análise de Riscos */}
            {tissueConfig.enableRiskSimulation && (
              <Card className={`shadow-lg border-2 ${
                riskResult.riskLevel === "baixo" ? "border-green-500/30" :
                riskResult.riskLevel === "moderado" ? "border-amber-500/30" :
                "border-red-500/30"
              }`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className={`h-5 w-5 ${
                        riskResult.riskLevel === "baixo" ? "text-green-500" :
                        riskResult.riskLevel === "moderado" ? "text-amber-500" :
                        "text-red-500"
                      }`} />
                      Análise de Riscos
                    </CardTitle>
                    <Badge 
                      variant="outline"
                      className={
                        riskResult.riskLevel === "baixo" ? "bg-green-500/20 text-green-400 border-green-500/50" :
                        riskResult.riskLevel === "moderado" ? "bg-amber-500/20 text-amber-400 border-amber-500/50" :
                        "bg-red-500/20 text-red-400 border-red-500/50"
                      }
                    >
                      {riskResult.riskLevel.toUpperCase()}
                    </Badge>
                  </div>
                  <CardDescription>
                    Avaliação de segurança baseada nos parâmetros e anatomia
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Barra de score de risco */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground font-medium">Score de Risco</span>
                      <span className="font-bold">{riskResult.riskScore}/100</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          riskResult.riskLevel === "baixo" ? "bg-green-500" :
                          riskResult.riskLevel === "moderado" ? "bg-amber-500" :
                          "bg-red-500"
                        }`}
                        style={{ width: `${riskResult.riskScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Mensagens de feedback */}
                  <div className="space-y-2">
                    {riskResult.messages.map((message, index) => (
                      <div 
                        key={index}
                        className="p-3 rounded-lg bg-muted/30 border-l-2 border-l-primary/50 text-sm"
                      >
                        {message}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

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
                        type="number"
                        domain={[0, 100]}
                        ticks={[0, 20, 40, 60, 80, 100]}
                        allowDataOverflow={true}
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
