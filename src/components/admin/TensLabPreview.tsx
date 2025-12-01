import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TensSemi3DView } from "@/components/labs/TensSemi3DView";
import { Tens3DSimulator } from "@/components/labs/tens3d/Tens3DSimulator";
import { TensInsightsPanel } from "@/components/labs/TensInsightsPanel";
import { TensLabConfig } from "@/types/tensLabConfig";
import { TissueConfig } from "@/types/tissueConfig";
import { simulateTens, type TensMode } from "@/lib/tensSimulation";
import { simulateTissueRisk } from "@/lib/tissueRiskSimulation";

interface TensLabPreviewProps {
  config: TensLabConfig;
  tissueConfig: TissueConfig;
  frequency: number;
  pulseWidth: number;
  intensity: number;
  mode: TensMode;
}

export function TensLabPreview({ 
  config, 
  tissueConfig, 
  frequency, 
  pulseWidth, 
  intensity, 
  mode 
}: TensLabPreviewProps) {
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
    <div className="xl:col-span-2 space-y-6">
      {/* Grid com os dois previews lado a lado */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Preview 2D da Anatomia */}
        <Card className="bg-gradient-to-br from-slate-950 to-slate-900 border-cyan-500/20">
          <CardHeader>
            <CardTitle className="text-lg text-cyan-400">Preview da Anatomia</CardTitle>
            <CardDescription className="text-slate-400">
              Visualização em tempo real das camadas anatômicas
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[500px]">
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
          <CardHeader>
            <CardTitle className="text-lg text-blue-400">Simulador 3D Biomédico</CardTitle>
            <CardDescription className="text-slate-400">
              Modelo fisiológico com campo elétrico
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[500px]">
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

      {/* Painel de Análises abaixo dos previews */}
      <TensInsightsPanel
        showFeedback={config.showFeedbackSection}
        showRisk={config.showRiskSection}
        showWaveform={config.showWaveformSection}
        feedbackData={{
          comfortLevel: sim.comfortLevel,
          activationLevel: sim.activationLevel,
          comfortMessage: sim.comfortMessage,
        }}
        riskData={riskResult}
        waveformData={{
          frequency,
          pulseWidth,
          intensity,
          mode,
        }}
        enableRiskSimulation={tissueConfig.enableRiskSimulation}
      />
    </div>
  );
}
