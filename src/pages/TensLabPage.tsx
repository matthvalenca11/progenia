import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { TensBaseFigure } from "@/components/labs/TensBaseFigure";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Activity } from "lucide-react";

type TensMode = "convencional" | "acupuntura" | "burst" | "modulado";

export default function TensLabPage() {
  // Estados dos parâmetros
  const [frequencia, setFrequencia] = useState(80); // Hz
  const [larguraPulso, setLarguraPulso] = useState(200); // µs
  const [intensidade, setIntensidade] = useState(20); // mA
  const [modo, setModo] = useState<TensMode>("convencional");

  // Cálculo de níveis derivados
  const { comfortLevel, activationLevel, feedbackMessage, feedbackColor } = useMemo(() => {
    // Peso para cada parâmetro
    const intensityWeight = intensidade / 80; // 0-1
    const pulseWeight = larguraPulso / 400; // 0-1
    
    // Fator de modo (modos mais agressivos reduzem conforto)
    const modoFactor = {
      convencional: 1.0,
      acupuntura: 0.9,
      burst: 0.85,
      modulado: 0.95
    }[modo];

    // Comfort Level (0-100): inversamente proporcional à intensidade
    const rawComfort = 100 - (intensityWeight * 50 + pulseWeight * 30);
    const comfort = Math.max(0, Math.min(100, rawComfort * modoFactor));

    // Activation Level (0-100): proporcional à intensidade e frequência
    const freqWeight = Math.min(frequencia / 150, 1); // normalizado
    const activation = Math.min(100, intensityWeight * 60 + freqWeight * 40);

    // Mensagem de feedback
    let message = "";
    let color = "";
    
    if (comfort > 70) {
      message = "Estimulação confortável - Parâmetros adequados para uso prolongado";
      color = "text-green-600 dark:text-green-400";
    } else if (comfort >= 40) {
      message = "Estimulação intensa - Ajuste a intensidade se houver desconforto";
      color = "text-amber-600 dark:text-amber-400";
    } else {
      message = "Parâmetros potencialmente desconfortáveis - Considere reduzir intensidade ou largura de pulso";
      color = "text-red-600 dark:text-red-400";
    }

    return {
      comfortLevel: comfort,
      activationLevel: activation,
      feedbackMessage: message,
      feedbackColor: color
    };
  }, [frequencia, larguraPulso, intensidade, modo]);

  // Gerar dados da forma de onda
  const waveformData = useMemo(() => {
    const points = [];
    const cycles = 3; // mostrar 3 ciclos completos
    const period = 1000 / frequencia; // período em ms
    const totalTime = period * cycles;
    const samples = 150;
    
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * totalTime;
      const cycleTime = t % period;
      const pulseWidth = larguraPulso / 1000; // converter µs para ms
      
      let amplitude = 0;
      
      // Forma de onda baseada no modo
      if (modo === "burst") {
        // Burst: grupos de pulsos
        const burstPeriod = period / 5;
        const inBurst = (cycleTime % (period / 2)) < burstPeriod * 2;
        if (inBurst && cycleTime < pulseWidth) {
          amplitude = intensidade;
        }
      } else if (modo === "modulado") {
        // Modulado: amplitude varia
        const modulation = Math.sin((t / totalTime) * Math.PI * 2) * 0.3 + 0.7;
        if (cycleTime < pulseWidth) {
          amplitude = intensidade * modulation;
        }
      } else {
        // Convencional e Acupuntura: pulso retangular simples
        if (cycleTime < pulseWidth) {
          amplitude = intensidade;
        }
      }
      
      points.push({
        time: t.toFixed(2),
        amplitude: amplitude
      });
    }
    
    return points;
  }, [frequencia, larguraPulso, intensidade, modo]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold">
              Laboratório Virtual de Eletroterapia – TENS
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Ajuste os parâmetros do equipamento TENS e visualize, em tempo real, os efeitos simulados 
            da estimulação elétrica transcutânea. Experimente diferentes configurações para compreender 
            como cada parâmetro influencia a terapia.
          </p>
        </div>

        {/* Layout principal */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Coluna Esquerda - Controles */}
          <div className="space-y-6">
            {/* Card de Controles Principais */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                Parâmetros de Estimulação
              </h2>
              
              <div className="space-y-8">
                {/* Frequência */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label className="text-base font-medium">Frequência</Label>
                    <span className="text-lg font-bold text-primary">
                      {frequencia} <span className="text-sm font-normal text-muted-foreground">Hz</span>
                    </span>
                  </div>
                  <Slider
                    value={[frequencia]}
                    onValueChange={(v) => setFrequencia(v[0])}
                    min={1}
                    max={200}
                    step={1}
                    className="py-4"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>1 Hz</span>
                    <span>200 Hz</span>
                  </div>
                </div>

                {/* Largura de Pulso */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label className="text-base font-medium">Largura de Pulso</Label>
                    <span className="text-lg font-bold text-primary">
                      {larguraPulso} <span className="text-sm font-normal text-muted-foreground">µs</span>
                    </span>
                  </div>
                  <Slider
                    value={[larguraPulso]}
                    onValueChange={(v) => setLarguraPulso(v[0])}
                    min={50}
                    max={400}
                    step={10}
                    className="py-4"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>50 µs</span>
                    <span>400 µs</span>
                  </div>
                </div>

                {/* Intensidade */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label className="text-base font-medium">Intensidade</Label>
                    <span className="text-lg font-bold text-primary">
                      {intensidade} <span className="text-sm font-normal text-muted-foreground">mA</span>
                    </span>
                  </div>
                  <Slider
                    value={[intensidade]}
                    onValueChange={(v) => setIntensidade(v[0])}
                    min={0}
                    max={80}
                    step={1}
                    className="py-4"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0 mA</span>
                    <span>80 mA</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Modo TENS */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Modo de Estimulação</h3>
              <div className="grid grid-cols-2 gap-3">
                {(["convencional", "acupuntura", "burst", "modulado"] as TensMode[]).map((m) => (
                  <Button
                    key={m}
                    variant={modo === m ? "default" : "outline"}
                    onClick={() => setModo(m)}
                    className="capitalize h-auto py-3"
                  >
                    {m === "acupuntura" ? "Acupuntura-like" : m}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                {modo === "convencional" && "Estimulação contínua de alta frequência para alívio de dor aguda"}
                {modo === "acupuntura" && "Baixa frequência com pulsos longos para liberação de endorfinas"}
                {modo === "burst" && "Grupos de pulsos de alta frequência em baixa frequência de repetição"}
                {modo === "modulado" && "Amplitude modulada para prevenir acomodação sensorial"}
              </p>
            </Card>

            {/* Feedback */}
            <Card className="p-6 border-2">
              <h3 className="text-lg font-semibold mb-4">Análise da Estimulação</h3>
              
              <div className="space-y-4">
                {/* Barras de nível */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Nível de Conforto</span>
                    <span className="font-medium">{Math.round(comfortLevel)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${comfortLevel}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Nível de Ativação</span>
                    <span className="font-medium">{Math.round(activationLevel)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${activationLevel}%` }}
                    />
                  </div>
                </div>

                {/* Mensagem */}
                <div className={`p-4 rounded-lg bg-muted/50 border-l-4 ${
                  comfortLevel > 70 ? "border-green-500" : 
                  comfortLevel >= 40 ? "border-amber-500" : "border-red-500"
                }`}>
                  <p className={`text-sm font-medium ${feedbackColor}`}>
                    {feedbackMessage}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Coluna Direita - Visualização */}
          <div className="space-y-6">
            {/* Figura Base com Overlay */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Visualização da Estimulação</h3>
              
              <div className="relative">
                {/* Figura base */}
                <TensBaseFigure />
                
                {/* Overlay de estimulação */}
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `radial-gradient(ellipse at center, 
                      hsla(var(--primary), ${activationLevel / 200}) 0%, 
                      transparent 70%)`,
                    animation: `pulse ${2 / (frequencia / 50)}s ease-in-out infinite`,
                  }}
                />
                
                {/* Indicador de intensidade */}
                <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 border">
                  <div className="text-xs text-muted-foreground">Campo Elétrico</div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-3 h-3 rounded-full ${
                      intensidade > 50 ? "bg-red-500 animate-pulse" :
                      intensidade > 25 ? "bg-amber-500" : "bg-green-500"
                    }`} />
                    <span className="text-sm font-medium">
                      {intensidade === 0 ? "Inativo" : 
                       intensidade > 50 ? "Alto" :
                       intensidade > 25 ? "Médio" : "Baixo"}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Gráfico de Forma de Onda */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Forma de Onda</h3>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={waveformData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="time" 
                      label={{ value: 'Tempo (ms)', position: 'insideBottom', offset: -5 }}
                      className="text-xs"
                    />
                    <YAxis 
                      label={{ value: 'Amplitude (mA)', angle: -90, position: 'insideLeft' }}
                      className="text-xs"
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

              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Período</div>
                  <div className="text-sm font-bold mt-1">
                    {(1000 / frequencia).toFixed(1)} ms
                  </div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Duty Cycle</div>
                  <div className="text-sm font-bold mt-1">
                    {((larguraPulso / 1000) / (1000 / frequencia) * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Carga/Pulso</div>
                  <div className="text-sm font-bold mt-1">
                    {(intensidade * larguraPulso / 1000).toFixed(1)} µC
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
