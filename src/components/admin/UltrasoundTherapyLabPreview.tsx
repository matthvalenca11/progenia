import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UltrasoundTherapyConfig, AnatomicalScenario } from "@/types/ultrasoundTherapyConfig";
import { simulateUltrasoundTherapy } from "@/simulation/ultrasoundTherapyEngine";
import { UltrasoundTherapy3DViewer } from "@/components/labs/ultrasound-therapy/UltrasoundTherapy3DViewer";
import { UltrasoundTherapyInsightsPanel } from "@/components/labs/ultrasound-therapy/UltrasoundTherapyInsightsPanel";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { useEffect } from "react";
import React from "react";

interface UltrasoundTherapyLabPreviewProps {
  config: UltrasoundTherapyConfig;
  scenario: AnatomicalScenario;
  frequency: number;
  intensity: number;
  era: number;
  mode: "continuous" | "pulsed";
  dutyCycle: number;
  duration: number;
  coupling: "good" | "poor";
  movement: "stationary" | "scanning";
}

export function UltrasoundTherapyLabPreview({ 
  config,
  scenario,
  frequency,
  intensity,
  era,
  mode,
  dutyCycle,
  duration,
  coupling,
  movement,
}: UltrasoundTherapyLabPreviewProps) {
  // Simular os efeitos
  const simulationResult = useMemo(() => {
    return simulateUltrasoundTherapy({
      frequency,
      intensity,
      era,
      mode,
      dutyCycle,
      duration,
      coupling,
      movement,
      scenario,
    });
  }, [frequency, intensity, era, mode, dutyCycle, duration, coupling, movement, scenario]);

  // Atualizar o store para o preview 3D
  const { setLabConfig, runSimulation } = useUltrasoundTherapyStore();
  
  useEffect(() => {
    setLabConfig({
      ...config,
      scenario,
      frequency,
      intensity,
      era,
      mode,
      dutyCycle,
      duration,
      coupling,
      movement,
    });
    runSimulation();
  }, [config, scenario, frequency, intensity, era, mode, dutyCycle, duration, coupling, movement, setLabConfig, runSimulation]);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Simulador 3D Biomédico */}
      <Card className="w-full bg-gradient-to-br from-slate-950 to-slate-900 border-cyan-500/20">
        <CardHeader className="py-3">
          <CardTitle className="text-base text-cyan-400">Simulador 3D Biomédico</CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            Visualização 3D com tecidos, feixe acústico e temperatura
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[500px]">
          <UltrasoundTherapy3DViewer />
        </CardContent>
      </Card>

      {/* Painel de Métricas */}
      <Card className="w-full bg-gradient-to-br from-slate-950 to-slate-900 border-blue-500/20">
        <CardHeader className="py-3">
          <CardTitle className="text-base text-blue-400">Métricas e Segurança</CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            Análise de temperatura, energia e risco
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UltrasoundTherapyInsightsPanel />
        </CardContent>
      </Card>
    </div>
  );
}
