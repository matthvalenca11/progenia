import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";

interface FeedbackData {
  comfortLevel: number;
  activationLevel: number;
  comfortMessage: string;
}

interface RiskResult {
  riskScore: number;
  riskLevel: "baixo" | "moderado" | "alto";
  messages: string[];
}

interface WaveformData {
  frequency: number;
  pulseWidth: number;
  intensity: number;
  mode: "convencional" | "acupuntura" | "burst" | "modulado";
}

interface TensInsightsPanelProps {
  showFeedback: boolean;
  showRisk: boolean;
  showWaveform: boolean;
  feedbackData: FeedbackData;
  riskData: RiskResult;
  waveformData: WaveformData;
  enableRiskSimulation?: boolean;
}

export function TensInsightsPanel({
  showFeedback,
  showRisk,
  showWaveform,
  feedbackData,
  riskData,
  waveformData,
  enableRiskSimulation = true,
}: TensInsightsPanelProps) {
  // Gerar dados da forma de onda
  const chartData = useMemo(() => {
    const points = [];
    const period = 1000 / waveformData.frequency;
    const totalTime = Math.min(1000, period * 5);
    const samples = 200;
    
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * totalTime;
      const cycleTime = t % period;
      const pulseWidthMs = waveformData.pulseWidth / 1000;
      
      let amplitude = 0;
      
      if (waveformData.mode === "burst") {
        const burstPeriod = period / 5;
        const inBurst = (cycleTime % (period / 2)) < burstPeriod * 2;
        if (inBurst && cycleTime < pulseWidthMs) {
          amplitude = waveformData.intensity;
        }
      } else if (waveformData.mode === "modulado") {
        const modulation = Math.sin((t / totalTime) * Math.PI * 4) * 0.3 + 0.7;
        if (cycleTime < pulseWidthMs) {
          amplitude = waveformData.intensity * modulation;
        }
      } else {
        if (cycleTime < pulseWidthMs) {
          amplitude = waveformData.intensity;
        }
      }
      
      points.push({
        time: parseFloat(t.toFixed(2)),
        amplitude: parseFloat(amplitude.toFixed(2))
      });
    }
    
    return points;
  }, [waveformData]);

  const hasAnySectionEnabled = showFeedback || showRisk || showWaveform;

  if (!hasAnySectionEnabled) {
    return null;
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Análises da Estimulação</CardTitle>
        <p className="text-sm text-muted-foreground">
          Conforto, risco e forma de onda com base nos parâmetros atuais
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coluna Esquerda - Feedback e Risco */}
          <div className="space-y-6">
            {/* Seção Feedback */}
            {showFeedback && (
              <div className="space-y-4">
                <h3 className="text-base font-semibold border-b pb-2">Feedback da Estimulação</h3>
                
                {/* Barra de Conforto */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground font-medium">Nível de Conforto</span>
                    <span className="font-bold">{feedbackData.comfortLevel}/100</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        feedbackData.comfortLevel >= 70 ? "bg-green-500" :
                        feedbackData.comfortLevel >= 40 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${feedbackData.comfortLevel}%` }}
                    />
                  </div>
                </div>

                {/* Barra de Ativação */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground font-medium">Nível de Ativação Sensorial</span>
                    <span className="font-bold">{feedbackData.activationLevel}/100</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${feedbackData.activationLevel}%` }}
                    />
                  </div>
                </div>

                {/* Mensagem de Feedback */}
                <div className={`p-3 rounded-lg border-l-4 text-sm ${
                  feedbackData.comfortLevel >= 70 ? "bg-green-50 dark:bg-green-950/20 border-green-500 text-green-700 dark:text-green-400" :
                  feedbackData.comfortLevel >= 40 ? "bg-amber-50 dark:bg-amber-950/20 border-amber-500 text-amber-700 dark:text-amber-400" : 
                  "bg-red-50 dark:bg-red-950/20 border-red-500 text-red-700 dark:text-red-400"
                }`}>
                  <p className="font-semibold">
                    {feedbackData.comfortMessage}
                  </p>
                </div>
              </div>
            )}

            {/* Seção Risco */}
            {showRisk && enableRiskSimulation && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 ${
                      riskData.riskLevel === "baixo" ? "text-green-500" :
                      riskData.riskLevel === "moderado" ? "text-amber-500" :
                      "text-red-500"
                    }`} />
                    Análise de Riscos
                  </h3>
                  <Badge 
                    variant="outline"
                    className={
                      riskData.riskLevel === "baixo" ? "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/50" :
                      riskData.riskLevel === "moderado" ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/50" :
                      "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/50"
                    }
                  >
                    {riskData.riskLevel.toUpperCase()}
                  </Badge>
                </div>
                
                {/* Barra de score de risco */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground font-medium">Score de Risco</span>
                    <span className="font-bold">{riskData.riskScore}/100</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        riskData.riskLevel === "baixo" ? "bg-green-500" :
                        riskData.riskLevel === "moderado" ? "bg-amber-500" :
                        "bg-red-500"
                      }`}
                      style={{ width: `${riskData.riskScore}%` }}
                    />
                  </div>
                </div>

                {/* Mensagens de feedback */}
                <div className="space-y-2">
                  {riskData.messages.map((message, index) => (
                    <div 
                      key={index}
                      className="p-3 rounded-lg bg-muted/30 border-l-2 border-l-primary/50 text-sm"
                    >
                      {message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Coluna Direita - Forma de Onda */}
          {showWaveform && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold border-b pb-2">Forma de Onda TENS</h3>
              
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
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
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <div className="text-xs text-muted-foreground mb-1">Período</div>
                  <div className="text-sm font-bold">
                    {(1000 / waveformData.frequency).toFixed(1)} ms
                  </div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <div className="text-xs text-muted-foreground mb-1">Duty Cycle</div>
                  <div className="text-sm font-bold">
                    {((waveformData.pulseWidth / 1000) / (1000 / waveformData.frequency) * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <div className="text-xs text-muted-foreground mb-1">Carga/Pulso</div>
                  <div className="text-sm font-bold">
                    {(waveformData.intensity * waveformData.pulseWidth / 1000).toFixed(1)} µC
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
