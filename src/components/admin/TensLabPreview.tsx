import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { TensSemi3DView } from "@/components/labs/TensSemi3DView";
import { Tens3DSimulator } from "@/components/labs/tens3d/Tens3DSimulator";
import { TensLabConfig } from "@/types/tensLabConfig";
import { TissueConfig } from "@/types/tissueConfig";
import { simulateTens, type TensMode } from "@/lib/tensSimulation";
import { simulateTissueRisk } from "@/lib/tissueRiskSimulation";

interface TensLabPreviewProps {
  config: TensLabConfig;
  tissueConfig: TissueConfig;
}

export function TensLabPreview({ config, tissueConfig }: TensLabPreviewProps) {
  const [frequency, setFrequency] = useState(
    Math.floor((config.frequencyRange.min + config.frequencyRange.max) / 2)
  );
  const [pulseWidth, setPulseWidth] = useState(
    Math.floor((config.pulseWidthRange.min + config.pulseWidthRange.max) / 2)
  );
  const [intensity, setIntensity] = useState(
    Math.floor((config.intensityRange.min + config.intensityRange.max) / 2)
  );
  const [mode, setMode] = useState<TensMode>(
    config.allowedModes[0] || "convencional"
  );

  const sim = useMemo(() => 
    simulateTens({
      frequencyHz: frequency,
      pulseWidthUs: pulseWidth,
      intensitymA: intensity,
      mode,
    }), 
    [frequency, pulseWidth, intensity, mode]
  );
  
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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Coluna 1: Controles de Estimulação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Parâmetros de Estimulação</CardTitle>
          <CardDescription>
            Ajuste os parâmetros para testar o laboratório
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {config.enabledControls.frequency && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Frequência</Label>
                <span className="text-sm font-bold text-primary">{frequency} Hz</span>
              </div>
              <Slider
                value={[frequency]}
                onValueChange={(v) => setFrequency(v[0])}
                min={config.frequencyRange.min}
                max={config.frequencyRange.max}
                step={1}
              />
            </div>
          )}
          
          {config.enabledControls.pulseWidth && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Largura de Pulso</Label>
                <span className="text-sm font-bold text-primary">{pulseWidth} µs</span>
              </div>
              <Slider
                value={[pulseWidth]}
                onValueChange={(v) => setPulseWidth(v[0])}
                min={config.pulseWidthRange.min}
                max={config.pulseWidthRange.max}
                step={10}
              />
            </div>
          )}
          
          {config.enabledControls.intensity && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Intensidade</Label>
                <span className="text-sm font-bold text-primary">{intensity} mA</span>
              </div>
              <Slider
                value={[intensity]}
                onValueChange={(v) => setIntensity(v[0])}
                min={config.intensityRange.min}
                max={config.intensityRange.max}
                step={1}
              />
            </div>
          )}
          
          {config.enabledControls.mode && config.allowedModes.length > 0 && (
            <div>
              <Label className="mb-3 block">Modo de Estimulação</Label>
              <div className="grid grid-cols-2 gap-2">
                {config.allowedModes.map((m) => (
                  <Button
                    key={m}
                    variant={mode === m ? "default" : "outline"}
                    onClick={() => setMode(m)}
                    size="sm"
                    className="capitalize"
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coluna 2: Preview 2D da Anatomia */}
      <Card className="bg-gradient-to-br from-slate-950 to-slate-900 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="text-lg text-cyan-400">Preview da Anatomia</CardTitle>
          <CardDescription className="text-slate-400">
            Visualização em tempo real das camadas anatômicas
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[600px]">
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
        </CardContent>
      </Card>

      {/* Coluna 3: Simulador 3D Biomédico */}
      <Card className="bg-gradient-to-br from-slate-950 to-slate-900 border-blue-500/20">
        <CardHeader>
          <CardTitle className="text-lg text-blue-400">Simulador 3D Biomédico</CardTitle>
          <CardDescription className="text-slate-400">
            Modelo fisiológico com campo elétrico
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[600px]">
          <Tens3DSimulator
            frequencyHz={frequency}
            pulseWidthUs={pulseWidth}
            intensitymA={intensity}
            mode={mode}
            activationLevel={sim.activationLevel}
            comfortLevel={sim.comfortLevel}
            tissueConfig={tissueConfig}
            riskResult={riskResult}
            compact={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}
