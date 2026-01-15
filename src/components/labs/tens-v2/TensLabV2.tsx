/**
 * TensLabV2 - Laboratório TENS com layout em 3 linhas (rows)
 * Layout similar ao Ultrassom Terapêutico e MRI
 */

import { useEffect } from "react";
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

  useEffect(() => {
    if (config) {
      setLabConfig(config);
      runSimulation();
    }
  }, [config, setLabConfig, runSimulation]);

  const riskLevel = simulationResult?.riskLevel || "baixo";

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* LINHA 1 - HEADER / CONTEXTO (altura fixa) */}
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
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              <h1 className="font-medium text-sm text-foreground">{labName}</h1>
            </div>
          </div>

          {/* Center: Indicadores rápidos */}
          <div className="flex-1 flex justify-center">
            <div className="hidden md:flex items-center gap-3 text-xs">
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

              <Badge 
                className={`text-[10px] ${
                  riskLevel === "baixo" 
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                    : riskLevel === "moderado" 
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30"
                }`}
              >
                {riskLevel.toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Right: Viewer Tabs e Reset */}
          <div className="flex items-center gap-2">
            <Tabs
              value={viewerTab}
              onValueChange={(v) => setViewerTab(v as any)}
              className="w-auto"
            >
              <TabsList className="bg-muted/50">
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
      <main className="flex-1 flex items-center justify-center min-w-0 overflow-hidden bg-background" style={{ height: '60%' }}>
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
      <div className="flex border-t border-border shrink-0" style={{ height: '40%' }}>
        {/* Coluna Esquerda: Controles */}
        <aside className="w-1/2 border-r border-border overflow-y-auto bg-card">
          <TensLabControlPanel />
        </aside>

        {/* Coluna Direita: Métricas */}
        <aside className="w-1/2 overflow-y-auto bg-card">
          <TensLabInsightsPanel onClose={() => {}} />
        </aside>
      </div>
    </div>
  );
}

export default TensLabV2;
