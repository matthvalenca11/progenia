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
    <div className="space-y-6">
      <Card className="p-4 bg-muted/30">
        <h3 className="text-lg font-semibold mb-1">Preview do Simulador</h3>
        <p className="text-sm text-muted-foreground">
          Visualize como o laboratório aparecerá para os alunos
        </p>
      </Card>

      {/* Cenário anatômico selecionado */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold">Cenário anatômico selecionado</h4>
            <p className="text-sm text-muted-foreground mt-1">{tissueConfig.name || "Antebraço..."}</p>
          </div>
        </div>
      </Card>

      {/* Parâmetros de Estimulação */}
      <Card className="p-6">
        <h3 className="text-base font-semibold mb-4">Parâmetros de Estimulação</h3>
        <div className="space-y-6">
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
        </div>
      </Card>

      {/* Preview 2D e Simulador 3D lado a lado */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Preview da Anatomia 2D */}
        <Card className="bg-gradient-to-br from-slate-950 to-slate-900 border-cyan-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-cyan-400">Preview da Anatomia</CardTitle>
            <CardDescription className="text-slate-400">
              Visualização em tempo real das camadas anatômicas configuradas
            </CardDescription>
          </CardHeader>
          <CardContent>
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

        {/* Simulador 3D Biomédico */}
        <Card className="bg-gradient-to-br from-slate-950 to-slate-900 border-blue-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-blue-400">Simulador 3D Biomédico</CardTitle>
            <CardDescription className="text-slate-400">
              Modelo fisiológico tridimensional com campo elétrico e análise de riscos
            </CardDescription>
          </CardHeader>
          <CardContent>
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
    </div>
  );
}
