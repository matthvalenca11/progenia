/**
 * TensLabV2 - Laboratório TENS com layout em 3 linhas (rows)
 * Layout similar ao Ultrassom Terapêutico e MRI
 */

import { useEffect, useState } from "react";
import { TensLabControlPanel } from "./TensLabControlPanel";
import { TensLabInsightsPanel } from "./TensLabInsightsPanel";
import { Tens3DViewer } from "./Tens3DViewer";
import { useTensLabStore } from "@/stores/tensLabStore";
import { TensLabConfig, defaultTensLabConfig } from "@/types/tensLabConfig";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, RotateCcw, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { LabMobilePanelTab, LabMobileTabBar } from "@/components/labs/LabMobileTabBar";

interface TensLabV2Props {
  config?: TensLabConfig;
  labName?: string;
  showBackButton?: boolean;
}

export function TensLabV2({ 
  config = defaultTensLabConfig, 
  labName = "Laboratório Virtual de TENS",
  showBackButton = true 
}: TensLabV2Props) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { 
    setLabConfig, 
    runSimulation,
    frequency,
    pulseWidth,
    intensity,
    mode,
    electrodes,
    simulationResult,
    resetToDefaults,
    viewerTab,
    setViewerTab
  } = useTensLabStore();
  const [mobilePanel, setMobilePanel] = useState<LabMobilePanelTab>("controls");

  useEffect(() => {
    if (config) {
      setLabConfig(config);
      runSimulation();
    }
  }, [config, setLabConfig, runSimulation]);

  const riskLevel = simulationResult?.riskLevel || "baixo";

  const riskBadgeClass =
    riskLevel === "baixo"
      ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
      : riskLevel === "moderado"
        ? "bg-amber-500/20 text-amber-600 border-amber-500/30 dark:text-amber-400"
        : "bg-red-500/20 text-red-600 border-red-500/30 dark:text-red-400";

  const viewerTabs = (
    <Tabs
      value={viewerTab}
      onValueChange={(v) => setViewerTab(v as "anatomy" | "electric" | "activation")}
      className="mt-2 w-full"
    >
      <TabsList className="grid h-auto w-full grid-cols-3 bg-muted/50">
        <TabsTrigger value="anatomy" className="px-1 text-[10px] leading-tight sm:text-xs">
          Anatomia
        </TabsTrigger>
        <TabsTrigger value="electric" className="px-1 text-[10px] leading-tight sm:text-xs">
          Campo Elétrico
        </TabsTrigger>
        <TabsTrigger value="activation" className="px-1 text-[10px] leading-tight sm:text-xs">
          Região Ativada
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );

  if (isMobile) {
    return (
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
        <header className="safe-area-top z-50 shrink-0 border-b border-border bg-card/95 px-3 py-2 backdrop-blur">
          <div className="flex items-center gap-2">
            {showBackButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/dashboard")}
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Activity className="h-4 w-4 shrink-0 text-cyan-500" />
              <h1 className="truncate text-sm font-medium">{labName}</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={resetToDefaults}
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Resetar parâmetros"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto text-[10px] text-muted-foreground">
              <span className="shrink-0 font-mono font-semibold text-foreground">{frequency} Hz</span>
              <span>·</span>
              <span className="shrink-0 font-mono font-semibold text-foreground">{pulseWidth} µs</span>
              <span>·</span>
              <span className="shrink-0 font-mono font-semibold text-foreground">{intensity} mA</span>
              <span>·</span>
              <span className="shrink-0 font-mono font-semibold text-foreground">{electrodes.distanceCm} cm</span>
            </div>
            <Badge className={`shrink-0 text-[10px] ${riskBadgeClass}`}>{riskLevel.toUpperCase()}</Badge>
          </div>

          {viewerTabs}
        </header>

        <section className="relative h-[min(48dvh,55vh)] min-h-[40dvh] shrink-0 border-b border-border bg-background">
          <div className="absolute inset-0 p-1">
            <Tens3DViewer />
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

        <section className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-card pb-[max(0.5rem,var(--sab,env(safe-area-inset-bottom,0px)))]">
          {mobilePanel === "controls" ? (
            <TensLabControlPanel hideHeader />
          ) : (
            <TensLabInsightsPanel hideHeader />
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background overflow-hidden md:h-screen">
      {/* LINHA 1 - HEADER / CONTEXTO (altura fixa) */}
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
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              <h1 className="font-medium text-sm text-foreground">{labName}</h1>
            </div>
          </div>

          {/* Center: Indicadores rápidos */}
          <div className="order-3 w-full md:order-2 md:w-auto md:flex-1 md:flex md:justify-center">
            <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1 md:pb-0">
              <div className="flex items-center gap-4 bg-muted/50 rounded-full px-4 py-1.5">
                <span className="text-muted-foreground">
                  <span className="text-cyan-400 font-mono font-medium">{frequency}</span> Hz
                </span>
                <span className="text-border">|</span>
                <span className="text-muted-foreground">
                  <span className="text-cyan-400 font-mono font-medium">{pulseWidth}</span> µs
                </span>
                <span className="text-border">|</span>
                <span className="text-muted-foreground">
                  <span className="text-cyan-400 font-mono font-medium">{intensity}</span> mA
                </span>
                <span className="text-border">|</span>
                <span className="text-muted-foreground">
                  <span className="text-amber-400 font-mono font-medium">{electrodes.distanceCm}</span> cm
                </span>
                <span className="text-border">|</span>
                <Badge variant="outline" className="text-[10px] capitalize border-border text-foreground">
                  {mode}
                </Badge>
              </div>

              <Badge className={`text-[10px] ${riskBadgeClass}`}>
                {riskLevel.toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Right: Viewer Tabs e Reset */}
          <div className="order-2 ml-auto flex items-center gap-2 md:order-3">
            <Tabs
              value={viewerTab}
              onValueChange={(v) => setViewerTab(v as "anatomy" | "electric" | "activation")}
              className="w-full sm:w-auto"
            >
              <TabsList className="bg-muted/50 w-full sm:w-auto">
                <TabsTrigger value="anatomy" className="text-xs">
                  Anatomia
                </TabsTrigger>
                <TabsTrigger value="electric" className="text-xs">
                  Campo Elétrico
                </TabsTrigger>
                <TabsTrigger value="activation" className="text-xs">
                  Região Ativada
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
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
        </div>
      </header>

      {/* LINHA 2 - SIMULADOR 3D BIOMÉDICO (principal, 60-65% altura) */}
      <main className="h-[54dvh] md:h-auto flex items-center justify-center min-w-0 overflow-hidden bg-background md:flex-1">
        <div className="w-full h-full flex items-center justify-center p-4">
          <div 
            className="w-full h-full max-w-full max-h-full"
            style={{ 
              aspectRatio: '4 / 3',
              maxWidth: '100%',
              maxHeight: '100%'
            }}
          >
            <Tens3DViewer />
          </div>
        </div>
      </main>

      {/* LINHA 3 - CONTROLES + MÉTRICAS (duas colunas) */}
      <div className="flex border-t border-border shrink-0 h-[40%]">
        <aside className="w-1/2 border-r border-border overflow-y-auto bg-card">
          <TensLabControlPanel />
        </aside>
        <aside className="w-1/2 overflow-y-auto bg-card">
          <TensLabInsightsPanel onClose={() => {}} />
        </aside>
      </div>
    </div>
  );
}

export default TensLabV2;
