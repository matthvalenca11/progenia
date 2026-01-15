/**
 * TensLabV2 - Laboratório TENS com layout limpo e profissional
 */

import { useEffect, useState } from "react";
import { TensLabTopBar } from "./TensLabTopBar";
import { TensLabControlPanel } from "./TensLabControlPanel";
import { TensLabInsightsPanel } from "./TensLabInsightsPanel";
import { TensLabBottomDock } from "./TensLabBottomDock";
import { Tens3DViewer } from "./Tens3DViewer";
import { useTensLabStore } from "@/stores/tensLabStore";
import { TensLabConfig, defaultTensLabConfig } from "@/types/tensLabConfig";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const { setLabConfig, runSimulation, controlPanelCollapsed, setControlPanelCollapsed } = useTensLabStore();
  const [showInsights, setShowInsights] = useState(false); // Colapsado por padrão para dar mais espaço ao canvas

  useEffect(() => {
    setLabConfig(config);
    runSimulation();
  }, [config]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar - compacto */}
      <TensLabTopBar labName={labName} showBackButton={showBackButton} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left - Control Panel (colapsável) - mais estreito */}
        <aside 
          className={`border-r border-border shrink-0 overflow-hidden transition-all duration-300 ${
            controlPanelCollapsed ? 'w-0' : 'w-64'
          }`}
        >
          {!controlPanelCollapsed && <TensLabControlPanel />}
        </aside>

        {/* Botão para expandir painel */}
        {controlPanelCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-muted/80 hover:bg-muted h-10 w-6 rounded-l-none"
            onClick={() => setControlPanelCollapsed(false)}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Center - 3D Viewer */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative items-center justify-center">
          {/* Botão colapsar painel esquerdo */}
          {!controlPanelCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-2 z-20 bg-muted/60 hover:bg-muted h-8 w-8"
              onClick={() => setControlPanelCollapsed(true)}
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}

          {/* Container do 3D Viewer - QUADRADO 1:1 com altura automática */}
          <div className="w-full flex items-center justify-center flex-shrink-0" style={{ height: 'fit-content', minHeight: 'fit-content' }}>
            <div 
              className="w-full"
              style={{ 
                aspectRatio: '1 / 1',
                maxWidth: '100%',
                maxHeight: '100%'
              }}
            >
              <Tens3DViewer />
            </div>
          </div>
          
          {/* Bottom Dock */}
          <TensLabBottomDock />
        </main>

        {/* Right - Insights Panel (toggle) - mais estreito e colapsável por padrão */}
        <aside 
          className={`border-l border-border shrink-0 overflow-hidden transition-all duration-300 ${
            showInsights ? 'w-56' : 'w-0'
          }`}
        >
          {showInsights && <TensLabInsightsPanel onClose={() => setShowInsights(false)} />}
        </aside>

        {/* Toggle insights quando fechado */}
        {!showInsights && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-16 z-20 bg-muted/80 hover:bg-muted"
            onClick={() => setShowInsights(true)}
          >
            Métricas
          </Button>
        )}
      </div>
    </div>
  );
}

export default TensLabV2;
