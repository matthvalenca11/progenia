/**
 * UltrasoundTherapyLabV2 - Laboratório de Ultrassom Terapêutico com layout em 3 linhas
 * Layout: Header | Simulador 3D (principal) | Controles + Métricas
 */

import { useEffect } from "react";
import { UltrasoundTherapyControlPanel } from "./UltrasoundTherapyControlPanel";
import { UltrasoundTherapyInsightsPanel } from "./UltrasoundTherapyInsightsPanel";
import { UltrasoundTherapy3DViewer } from "./UltrasoundTherapy3DViewer";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { UltrasoundTherapyConfig, defaultUltrasoundTherapyConfig, AnatomicalScenario } from "@/types/ultrasoundTherapyConfig";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, RotateCcw, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clinicalPresets, applyPreset } from "@/config/ultrasoundTherapyPresets";

interface UltrasoundTherapyLabV2Props {
  config?: UltrasoundTherapyConfig;
  labName?: string;
  showBackButton?: boolean;
}

export function UltrasoundTherapyLabV2({ 
  config = defaultUltrasoundTherapyConfig, 
  labName = "Laboratório Virtual de Ultrassom Terapêutico",
  showBackButton = true 
}: UltrasoundTherapyLabV2Props) {
  const navigate = useNavigate();
  const { setLabConfig, runSimulation, config: storeConfig, updateConfig } = useUltrasoundTherapyStore();

  useEffect(() => {
    setLabConfig(config);
    runSimulation();
  }, [config]);

  const resetToDefaults = () => {
    updateConfig({
      frequency: 1.1,
      intensity: 1.0,
      era: 5.0,
      mode: "continuous",
      dutyCycle: 50,
      duration: 8,
      coupling: "good",
      movement: "scanning",
    });
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* LINHA 1 - HEADER (altura fixa, pequena) */}
      <header className="bg-card/95 border-b border-border backdrop-blur sticky top-0 z-50 px-4 py-2.5 shrink-0">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Título e botão voltar */}
          <div className="flex items-center gap-3">
            {showBackButton && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate("/dashboard")}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <h1 className="font-medium text-sm text-foreground">{labName}</h1>
          </div>

          {/* Center: Presets e Cenário */}
          <div className="flex items-center gap-3 flex-1 justify-center">
            {/* Presets Clínicos */}
            <div className="flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-amber-500" />
              <Select 
                value="" 
                onValueChange={(presetId) => {
                  const preset = clinicalPresets.find(p => p.id === presetId);
                  if (preset) {
                    const newConfig = applyPreset(preset, storeConfig);
                    updateConfig(newConfig);
                  }
                }}
              >
                <SelectTrigger className="bg-muted border-border text-xs h-8 w-40">
                  <SelectValue placeholder="Presets Clínicos" />
                </SelectTrigger>
                <SelectContent>
                  {clinicalPresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cenário Anatômico */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Cenário:</Label>
              <Select 
                value={storeConfig.scenario} 
                onValueChange={(v) => {
                  const newScenario = v as AnatomicalScenario;
                  if (newScenario === "custom" && !storeConfig.customThicknesses) {
                    updateConfig({ 
                      scenario: newScenario,
                      customThicknesses: {
                        skin: 0.2,
                        fat: 0.5,
                        muscle: 2.0,
                      }
                    });
                  } else {
                    updateConfig({ scenario: newScenario });
                  }
                }}
                disabled={!storeConfig.enabledControls.scenario}
              >
                <SelectTrigger className="bg-muted border-border text-xs h-8 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shoulder">Ombro</SelectItem>
                  <SelectItem value="knee">Joelho</SelectItem>
                  <SelectItem value="lumbar">Lombar</SelectItem>
                  <SelectItem value="forearm">Antebraço</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Right: Reset */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={resetToDefaults}
            className="text-muted-foreground hover:text-foreground gap-1.5 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </header>

      {/* LINHA 2 - SIMULADOR 3D (principal, altura reduzida) */}
      <main className="flex-1 flex items-center justify-center min-w-0 overflow-hidden bg-background" style={{ height: '55%' }}>
        <div className="w-full h-full flex items-center justify-center p-4">
          <div 
            className="w-full h-full max-w-full max-h-full"
            style={{ 
              aspectRatio: '4 / 3',
              maxWidth: '100%',
              maxHeight: '100%'
            }}
          >
            <UltrasoundTherapy3DViewer />
          </div>
        </div>
      </main>

      {/* LINHA 3 - CONTROLES + MÉTRICAS (duas colunas) */}
      <div className="flex border-t border-border shrink-0" style={{ height: '45%' }}>
        {/* Coluna Esquerda: Controles */}
        <aside className="w-1/2 border-r border-border overflow-y-auto bg-card">
          <UltrasoundTherapyControlPanel />
        </aside>

        {/* Coluna Direita: Métricas */}
        <aside className="w-1/2 overflow-y-auto bg-card">
          <UltrasoundTherapyInsightsPanel />
        </aside>
      </div>
    </div>
  );
}

export default UltrasoundTherapyLabV2;
