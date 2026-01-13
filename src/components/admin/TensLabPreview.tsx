import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TensSemi3DView } from "@/components/labs/TensSemi3DView";
import { Tens3DSimulator } from "@/components/labs/tens3d/Tens3DSimulator";
import { TensInsightsPanel } from "@/components/labs/TensInsightsPanel";
import { TensLabConfig } from "@/types/tensLabConfig";
import { TissueConfig } from "@/types/tissueConfig";
import { simulateTens, type TensMode } from "@/lib/tensSimulation";
import { simulateTissueRisk } from "@/lib/tissueRiskSimulation";
import { simulateTensField, defaultElectrodeConfig } from "@/simulation/TensFieldEngine";

interface TensLabPreviewProps {
  config: TensLabConfig;
  tissueConfig: TissueConfig;
  frequency: number;
  pulseWidth: number;
  intensity: number;
  mode: TensMode;
  electrodeDistance: number;
}

export function TensLabPreview({ 
  config, 
  tissueConfig, 
  frequency, 
  pulseWidth, 
  intensity, 
  mode,
  electrodeDistance
}: TensLabPreviewProps) {
  // Criar configuração de eletrodos com a distância
  const electrodeConfig = useMemo(() => ({
    ...defaultElectrodeConfig,
    distanceCm: electrodeDistance,
    // Atualizar posições baseadas na distância
    anodePosition: [-electrodeDistance / 2, 0, 0] as [number, number, number],
    cathodePosition: [electrodeDistance / 2, 0, 0] as [number, number, number],
  }), [electrodeDistance]);

  // Simulação básica (para compatibilidade)
  const sim = useMemo(() => 
    simulateTens({
      frequencyHz: frequency,
      pulseWidthUs: pulseWidth,
      intensitymA: intensity,
      mode,
    }), 
    [frequency, pulseWidth, intensity, mode]
  );

  // Simulação avançada com campo elétrico (considera distância dos eletrodos)
  const fieldSim = useMemo(() => {
    if (intensity === 0) {
      return {
        activationLevel: sim.activationLevel,
        comfortLevel: sim.comfortLevel,
        depth: 0,
        area: 0,
        sensory: 0,
        motor: 0,
      };
    }
    return simulateTensField(
      {
        frequencyHz: frequency,
        pulseWidthUs: pulseWidth,
        intensitymA: intensity,
        mode,
        electrodes: electrodeConfig,
      },
      tissueConfig
    );
  }, [frequency, pulseWidth, intensity, mode, electrodeConfig, tissueConfig, sim]);

  // Ajustar níveis de ativação e conforto baseados na distância
  const adjustedSim = useMemo(() => {
    // Distância maior = menos intensidade superficial, mais profundo
    // Distância menor = mais intensidade superficial, menos profundo
    const distanceFactor = 1 - (electrodeDistance - 4) * 0.05; // Referência 4cm
    const adjustedActivation = Math.min(100, sim.activationLevel * distanceFactor + fieldSim.sensory * 0.3);
    const adjustedComfort = Math.max(0, sim.comfortLevel - (electrodeDistance - 4) * 2);
    
    return {
      activationLevel: Math.round(adjustedActivation),
      comfortLevel: Math.round(adjustedComfort),
      comfortMessage: sim.comfortMessage,
    };
  }, [sim, fieldSim, electrodeDistance]);
  
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
    <div className="w-full flex flex-col gap-4">
      {/* Simulador 3D Biomédico - primeiro */}
      <Card className="w-full bg-gradient-to-br from-slate-950 to-slate-900 border-blue-500/20">
        <CardHeader className="py-3">
          <CardTitle className="text-base text-blue-400">Simulador 3D Biomédico</CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            Modelo fisiológico com campo elétrico
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[500px]">
          <Tens3DSimulator
            frequencyHz={frequency}
            pulseWidthUs={pulseWidth}
            intensitymA={intensity}
            mode={mode}
            activationLevel={adjustedSim.activationLevel}
            comfortLevel={adjustedSim.comfortLevel}
            tissueConfig={tissueConfig}
            riskResult={riskResult}
            compact={true}
            electrodeDistance={electrodeDistance}
          />
        </CardContent>
      </Card>

      {/* Painel de Análises - segundo */}
      <div className="w-full">
        <TensInsightsPanel
        showFeedback={config.showFeedbackSection}
        showRisk={config.showRiskSection}
        showWaveform={config.showWaveformSection}
        feedbackData={{
          comfortLevel: adjustedSim.comfortLevel,
          activationLevel: adjustedSim.activationLevel,
          comfortMessage: adjustedSim.comfortMessage,
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

      {/* Preview 2D da Anatomia - último */}
      <Card className="w-full bg-gradient-to-br from-slate-950 to-slate-900 border-cyan-500/20">
        <CardHeader className="py-3">
          <CardTitle className="text-base text-cyan-400">Preview da Anatomia</CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            Visualização em tempo real das camadas anatômicas
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-[640px]">
          <TensSemi3DView
            frequencyHz={frequency}
            pulseWidthUs={pulseWidth}
            intensitymA={intensity}
            mode={mode}
            activationLevel={adjustedSim.activationLevel}
            comfortLevel={adjustedSim.comfortLevel}
            tissueConfig={tissueConfig}
            riskResult={riskResult}
            electrodeDistance={electrodeDistance}
          />
        </CardContent>
      </Card>
    </div>
  );
}
