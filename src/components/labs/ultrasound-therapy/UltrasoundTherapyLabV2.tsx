/**
 * UltrasoundTherapyLabV2 - Laboratório de Ultrassom Terapêutico com layout em 3 linhas
 * Layout: Header | Simulador 3D (principal) | Controles + Métricas
 */

import { useEffect, useState } from "react";
import { UltrasoundTherapyControlPanel } from "./UltrasoundTherapyControlPanel";
import { UltrasoundTherapyInsightsPanel } from "./UltrasoundTherapyInsightsPanel";
import { UltrasoundTherapy3DViewer } from "./UltrasoundTherapy3DViewer";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { UltrasoundTherapyConfig, defaultUltrasoundTherapyConfig, AnatomicalScenario } from "@/types/ultrasoundTherapyConfig";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCcw, BookOpen, Target, Eye, Waves, Thermometer } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { clinicalPresets, applyPreset } from "@/config/ultrasoundTherapyPresets";
import { useIsMobile } from "@/hooks/use-mobile";
import { LabMobilePanelTab, LabMobileTabBar } from "@/components/labs/LabMobileTabBar";

interface UltrasoundTherapyLabV2Props {
  config?: UltrasoundTherapyConfig;
  labName?: string;
  showBackButton?: boolean;
  embedded?: boolean;
}

export function UltrasoundTherapyLabV2({ 
  config = defaultUltrasoundTherapyConfig, 
  labName = "Laboratório Virtual de Ultrassom Terapêutico",
  showBackButton = true,
  embedded = false,
}: UltrasoundTherapyLabV2Props) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { setLabConfig, runSimulation, config: storeConfig, updateConfig, simulationResult, viewerTab, setViewerTab } = useUltrasoundTherapyStore();
  const [mobilePanel, setMobilePanel] = useState<LabMobilePanelTab>("controls");

  useEffect(() => {
    console.log('🔧 UltrasoundTherapyLabV2: Recebendo config', {
      hasConfig: !!config,
      configKeys: config ? Object.keys(config).slice(0, 15) : [],
      scenario: config?.scenario,
      frequency: config?.frequency,
      mode: config?.mode,
      hasEra: config?.era !== undefined,
      hasGain: config?.gain !== undefined, // Não deveria ter!
      hasDepth: config?.depth !== undefined, // Não deveria ter!
    });
    
    // Validar que não é config de diagnóstico
    if (config && (config.gain !== undefined || config.depth !== undefined || config.layers !== undefined)) {
      console.error('❌ UltrasoundTherapyLabV2: Config parece ser de DIAGNÓSTICO! Usando default.');
      setLabConfig(defaultUltrasoundTherapyConfig);
    } else {
      setLabConfig(config || defaultUltrasoundTherapyConfig);
    }
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

  const scenarioSelect = (
    <Select
      value={storeConfig.scenario}
      onValueChange={(v) => {
        const newScenario = v as AnatomicalScenario;
        if (newScenario === "custom" && !storeConfig.customThicknesses) {
          updateConfig({
            scenario: newScenario,
            customThicknesses: { skin: 0.2, fat: 0.5, muscle: 2.0 },
          });
        } else {
          updateConfig({ scenario: newScenario });
        }
      }}
      disabled={!storeConfig.enabledControls.scenario}
    >
      <SelectTrigger className="h-9 w-full border-border bg-muted text-xs">
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
  );

  const presetSelect = (
    <Select
      value=""
      onValueChange={(presetId) => {
        const preset = clinicalPresets.find((p) => p.id === presetId);
        if (preset) {
          updateConfig(applyPreset(preset, storeConfig));
        }
      }}
    >
      <SelectTrigger className="h-9 w-full border-border bg-muted text-xs">
        <BookOpen className="mr-1.5 h-3 w-3 shrink-0 text-amber-500" />
        <SelectValue placeholder="Presets clínicos" />
      </SelectTrigger>
      <SelectContent>
        {clinicalPresets.map((preset) => (
          <SelectItem key={preset.id} value={preset.id}>
            {preset.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const riskLevel = simulationResult?.risk ?? "low";
  const riskLabel =
    riskLevel === "low" ? "BAIXO" : riskLevel === "medium" ? "MODERADO" : "ALTO";
  const riskBadgeClass =
    riskLevel === "low"
      ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
      : riskLevel === "medium"
        ? "bg-amber-500/20 text-amber-600 border-amber-500/30 dark:text-amber-400"
        : "bg-red-500/20 text-red-600 border-red-500/30 dark:text-red-400";

  if (isMobile) {
    const shellHeight = embedded ? "h-[min(88dvh,780px)]" : "h-[100dvh]";

    return (
      <div
        className={cn(
          "grid w-full min-w-0 max-w-full overflow-hidden bg-background",
          shellHeight,
          "grid-rows-[auto_minmax(34dvh,40dvh)_auto_minmax(0,1fr)]",
        )}
      >
        <header className="safe-area-top z-50 shrink-0 border-b border-border bg-card/95 px-2 py-2 backdrop-blur sm:px-3">
          <div className="flex items-center gap-1.5">
            {showBackButton && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="h-8 w-8 shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <Target className="h-4 w-4 shrink-0 text-cyan-500" />
              <h1 className="truncate text-sm font-medium">{labName}</h1>
            </div>
            <Badge className={`shrink-0 text-[10px] ${riskBadgeClass}`}>{riskLabel}</Badge>
            <Button variant="ghost" size="icon" onClick={resetToDefaults} className="h-8 w-8 shrink-0" aria-label="Resetar">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">{storeConfig.frequency.toFixed(1)} MHz</span>
            <span>·</span>
            <span className="font-mono font-semibold text-foreground">{storeConfig.intensity.toFixed(1)} W/cm²</span>
            <span>·</span>
            <span className="font-mono font-semibold text-foreground">{storeConfig.duration} min</span>
          </div>
        </header>

        <section className="relative min-h-0 min-w-0 border-b border-border bg-background">
          <div className="absolute inset-0 p-0.5">
            <UltrasoundTherapy3DViewer hideTabs />
          </div>
          <div className="absolute bottom-2 left-2 right-2 z-10">
            <div
              className="grid grid-cols-3 gap-1 rounded-lg border border-border/60 bg-background/95 p-1 shadow-sm backdrop-blur"
              style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
            >
              {([
                { value: "anatomy" as const, label: "Anatomia", icon: Eye },
                { value: "beam" as const, label: "Feixe", icon: Waves },
                { value: "thermal" as const, label: "Térmico", icon: Thermometer },
              ]).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-label={label}
                  title={label}
                  onClick={() => setViewerTab(value)}
                  className={cn(
                    "flex h-8 min-w-0 items-center justify-center rounded-md transition-colors",
                    viewerTab === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </section>

        <LabMobileTabBar
          active={mobilePanel}
          onChange={setMobilePanel}
          tabs={[
            { id: "controls", label: "Controles" },
            { id: "metrics", label: "Métricas" },
          ]}
        />

        <section className="min-h-0 w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y bg-card pb-14 pr-1 pl-1 sm:pb-[max(0.5rem,var(--sab,env(safe-area-inset-bottom,0px)))] sm:px-0">
          {mobilePanel === "controls" ? (
            <UltrasoundTherapyControlPanel hideHeader compact />
          ) : (
            <UltrasoundTherapyInsightsPanel hideHeader compact />
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background overflow-hidden md:h-screen">
      {/* LINHA 1 - HEADER (altura fixa, pequena) */}
      <header className="safe-sticky-top bg-card/95 border-b border-border backdrop-blur px-3 py-2.5 shrink-0 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
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
          <div className="order-3 w-full md:order-2 md:w-auto flex flex-col items-stretch gap-2 md:flex-row md:items-center md:gap-3 md:flex-1 md:justify-center">
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
                <SelectTrigger className="bg-muted border-border text-xs h-8 w-full md:w-40">
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
                <SelectTrigger className="bg-muted border-border text-xs h-8 w-full md:w-48">
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
            className="order-2 ml-auto md:order-3 text-muted-foreground hover:text-foreground gap-1.5 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </header>

      {/* LINHA 2 - SIMULADOR 3D (principal, altura reduzida) */}
      <main className="h-[54dvh] md:h-auto flex-1 flex items-center justify-center min-w-0 overflow-hidden bg-background">
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
      <div className="flex border-t border-border shrink-0 h-[45%]">
        <aside className="w-1/2 border-r border-border overflow-y-auto bg-card">
          <UltrasoundTherapyControlPanel />
        </aside>
        <aside className="w-1/2 overflow-y-auto bg-card">
          <UltrasoundTherapyInsightsPanel />
        </aside>
      </div>
    </div>
  );
}

export default UltrasoundTherapyLabV2;
