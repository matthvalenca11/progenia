/**
 * UltrasoundTherapyLabV2 - Layout desktop 3 colunas + mobile com bottom sheet
 */

import { useEffect } from "react";
import { UltrasoundTherapyControlPanel } from "./UltrasoundTherapyControlPanel";
import { UltrasoundTherapyInsightsPanel } from "./UltrasoundTherapyInsightsPanel";
import { UltrasoundTherapy3DViewer } from "./UltrasoundTherapy3DViewer";
import { SimulationStatusBar } from "./SimulationStatusBar";
import { TherapyModeDock } from "./TherapyModeDock";
import { MobileTherapyBottomSheet } from "./MobileTherapyBottomSheet";
import { TherapyLabModeToggle } from "./TherapyLabModeToggle";
import { TherapyChallengePanel } from "./TherapyChallengePanel";
import { GuidedTherapyCoach } from "./GuidedTherapyCoach";
import { SimulationSnapshotButton } from "./SimulationSnapshotButton";
import { SessionTimeline } from "./SessionTimeline";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import {
  UltrasoundTherapyConfig,
  defaultUltrasoundTherapyConfig,
  AnatomicalScenario,
} from "@/types/ultrasoundTherapyConfig";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, Target, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { clinicalPresets } from "@/config/ultrasoundTherapyPresets";
import { DEFAULT_STACK_THICKNESSES } from "@/lib/ultrasoundTherapyStackConfig";
import { getTransducerDefinition } from "@/config/therapeuticTransducerDefinitions";
import { useIsMobile } from "@/hooks/use-mobile";
import { labMobileInsetX, labCanvasHostClass } from "@/components/labs/labMobileLayout";
import { EducationalSimulationDisclaimer } from "@/components/labs/EducationalSimulationDisclaimer";
import { utLabel, utPanel, utSelectTrigger } from "./ultrasoundTherapyUi";

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
  const {
    initializeLab,
    reset,
    config: storeConfig,
    updateConfig,
    applyClinicalPreset,
    activeClinicalPresetId,
    controlPanelCollapsed,
    insightsPanelCollapsed,
    setControlPanelCollapsed,
    setInsightsPanelCollapsed,
    labMode,
  } = useUltrasoundTherapyStore();

  useEffect(() => {
    const isDiagnosticConfig =
      config &&
      (config.gain !== undefined || config.depth !== undefined || config.layers !== undefined);

    if (isDiagnosticConfig) {
      initializeLab(defaultUltrasoundTherapyConfig);
    } else {
      initializeLab(config || defaultUltrasoundTherapyConfig);
    }
  }, [config, initializeLab]);

  const resetToDefaults = () => reset();

  const headerPresetScenario = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={activeClinicalPresetId ?? ""} onValueChange={applyClinicalPreset}>
        <SelectTrigger className={cn("h-9 w-full md:w-44", utSelectTrigger)}>
          <BookOpen className="mr-1.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
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

      <Select
        value={storeConfig.scenario}
        onValueChange={(v) => {
          const newScenario = v as AnatomicalScenario;
          if (newScenario === "custom" && !storeConfig.customThicknesses) {
            updateConfig({
              scenario: newScenario,
              customThicknesses: { ...DEFAULT_STACK_THICKNESSES },
            });
          } else {
            updateConfig({ scenario: newScenario });
          }
        }}
        disabled={!storeConfig.enabledControls.scenario}
      >
        <SelectTrigger className={cn("h-9 w-full md:w-44", utSelectTrigger)}>
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
  );

  if (isMobile) {
    const shellHeight = embedded ? "h-[min(88dvh,780px)]" : "h-[100dvh]";
    const insetX = labMobileInsetX(embedded);

    return (
      <div className={cn("flex flex-col bg-background", shellHeight)}>
        <header className={cn("safe-area-top shrink-0 border-b border-border bg-card", insetX)}>
          <div className="flex items-center gap-2 px-3 py-2">
            {showBackButton && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="h-8 w-8 shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Target className="h-4 w-4 shrink-0 text-cyan-500" />
            <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{labName}</h1>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {getTransducerDefinition(storeConfig.transducerType ?? "planar_circular").shortLabel}
            </Badge>
            <SimulationSnapshotButton compact />
          </div>
          <SimulationStatusBar compact onReset={resetToDefaults} />
          <div className="px-3 pb-2">
            <TherapyLabModeToggle compact />
          </div>
        </header>

        <section className="relative min-h-0 flex-1 overflow-hidden bg-muted/20">
          <div className={cn("h-full", labCanvasHostClass)}>
            <UltrasoundTherapy3DViewer hideTabs />
          </div>

          <div className={cn("pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-2", insetX)}>
            <TherapyModeDock compact className="pointer-events-auto max-w-full" />
          </div>

          {labMode === "guided" && (
            <div className={cn("pointer-events-none absolute inset-x-0 top-14 z-10 px-3", insetX)}>
              <div className="pointer-events-auto">
                <GuidedTherapyCoach compact />
              </div>
            </div>
          )}

          <MobileTherapyBottomSheet embedded={embedded} />
        </section>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background">
      <header className="safe-sticky-top shrink-0 border-b border-border bg-card px-4 py-2 sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {showBackButton && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <h1 className="truncate text-sm font-semibold">{labName}</h1>
            <Badge variant="secondary" className="hidden sm:inline-flex text-[10px]">
              {getTransducerDefinition(storeConfig.transducerType ?? "planar_circular").shortLabel}
            </Badge>
          </div>

          <div className="hidden flex-1 justify-center lg:flex">{headerPresetScenario}</div>

          <div className="ml-auto flex items-center gap-2">
            <SimulationSnapshotButton className="hidden md:inline-flex" />
            <TherapyLabModeToggle compact className="hidden sm:block w-52" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setControlPanelCollapsed(!controlPanelCollapsed)}
              aria-label={controlPanelCollapsed ? "Abrir controles" : "Recolher controles"}
            >
              {controlPanelCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setInsightsPanelCollapsed(!insightsPanelCollapsed)}
              aria-label={insightsPanelCollapsed ? "Abrir resultados" : "Recolher resultados"}
            >
              {insightsPanelCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 lg:hidden">
          <Label className={utLabel}>Cenário</Label>
          {headerPresetScenario}
        </div>
      </header>

      <SimulationStatusBar onReset={resetToDefaults} />

      <div className="shrink-0 border-b border-border px-3 py-1.5 md:px-4">
        <EducationalSimulationDisclaimer compact className="text-center md:text-left" />
      </div>

      <div className="flex min-h-0 flex-1">
        {!controlPanelCollapsed && (
          <aside className={cn("w-[min(100%,22rem)] shrink-0 overflow-y-auto border-r border-border", utPanel)}>
            <div className="space-y-3 p-3">
              <TherapyLabModeToggle />
              {labMode === "guided" && <TherapyChallengePanel compact />}
              <SessionTimeline compact />
            </div>
            <UltrasoundTherapyControlPanel hideHeader />
          </aside>
        )}

        <main className="relative min-w-0 flex-1 bg-muted/20">
          <div className="absolute inset-0 p-3 md:p-4">
            <div className="h-full w-full overflow-hidden rounded-xl border border-border/60 bg-slate-950 shadow-inner">
              <UltrasoundTherapy3DViewer hideTabs />
            </div>
          </div>

          {labMode === "guided" && (
            <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center px-4">
              <div className="pointer-events-auto max-w-md">
                <GuidedTherapyCoach compact />
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center px-4">
            <TherapyModeDock />
          </div>
        </main>

        {!insightsPanelCollapsed && (
          <aside className={cn("w-[min(100%,24rem)] shrink-0 overflow-y-auto border-l border-border", utPanel)}>
            <UltrasoundTherapyInsightsPanel hideHeader />
          </aside>
        )}
      </div>
    </div>
  );
}

export default UltrasoundTherapyLabV2;
