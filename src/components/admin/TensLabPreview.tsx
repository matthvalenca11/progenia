import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { TensSemi3DView } from "@/components/labs/TensSemi3DView";
import { TensLabConfig } from "@/types/tensLabConfig";
import { TissueConfig, tissuePresets } from "@/types/tissueConfig";
import { simulateTens, type TensMode } from "@/lib/tensSimulation";
import { simulateTissueRisk } from "@/lib/tissueRiskSimulation";

interface TensLabPreviewProps {
  config: TensLabConfig;
  tissueConfig: TissueConfig;
}

export function TensLabPreview({ config, tissueConfig }: TensLabPreviewProps) {
  console.log('🎬 TensLabPreview rendered with tissueConfig:', {
    skinThickness: tissueConfig.skinThickness,
    fatThickness: tissueConfig.fatThickness,
    muscleThickness: tissueConfig.muscleThickness,
    boneDepth: tissueConfig.boneDepth,
  });
  
  // Initialize with middle values
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

  // Real-time simulation
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
      {/* Controls */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Controles de Teste</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Frequency */}
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
          
          {/* Pulse Width */}
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
          
          {/* Intensity */}
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
          
          {/* Mode */}
          {config.enabledControls.mode && config.allowedModes.length > 0 && (
            <div>
              <Label className="mb-2 block">Modo de Estimulação</Label>
              <div className="flex flex-wrap gap-2">
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

      {/* Visualization */}
      <Card className="p-6 bg-gradient-to-br from-slate-950 to-slate-900">
        <h3 className="text-lg font-semibold mb-4 text-cyan-400">
          Preview da Simulação
        </h3>
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
      </Card>
      
      {/* Feedback */}
      {config.showComfortCard && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Feedback da Estimulação</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Nível de Conforto</span>
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

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Nível de Ativação</span>
                <span className="font-bold">{sim.activationLevel}/100</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${sim.activationLevel}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
