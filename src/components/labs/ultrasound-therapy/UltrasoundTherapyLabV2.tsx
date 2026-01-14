/**
 * UltrasoundTherapyLabV2 - Laboratório de Ultrassom Terapêutico com layout limpo e profissional
 */

import { useEffect, useState } from "react";
import { UltrasoundTherapyTopBar } from "./UltrasoundTherapyTopBar";
import { UltrasoundTherapyControlPanel } from "./UltrasoundTherapyControlPanel";
import { UltrasoundTherapyInsightsPanel } from "./UltrasoundTherapyInsightsPanel";
import { UltrasoundTherapy3DViewer } from "./UltrasoundTherapy3DViewer";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { UltrasoundTherapyConfig, defaultUltrasoundTherapyConfig } from "@/types/ultrasoundTherapyConfig";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const { setLabConfig, runSimulation, controlPanelCollapsed, setControlPanelCollapsed, insightsPanelCollapsed, setInsightsPanelCollapsed } = useUltrasoundTherapyStore();
  const [showInsights, setShowInsights] = useState(false);

  useEffect(() => {
    setLabConfig(config);
    runSimulation();
  }, [config]);

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* Top Bar - compacto */}
      <UltrasoundTherapyTopBar labName={labName} showBackButton={showBackButton} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left - Control Panel (colapsável) */}
        <aside 
          className={`border-r border-slate-800 shrink-0 overflow-hidden transition-all duration-300 ${
            controlPanelCollapsed ? 'w-0' : 'w-64'
          }`}
        >
          {!controlPanelCollapsed && <UltrasoundTherapyControlPanel />}
        </aside>

        {/* Botão para expandir painel */}
        {controlPanelCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-slate-800/80 hover:bg-slate-700 h-10 w-6 rounded-l-none"
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
              className="absolute left-2 top-2 z-20 bg-slate-800/60 hover:bg-slate-700 h-8 w-8"
              onClick={() => setControlPanelCollapsed(true)}
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}

          {/* Container do 3D Viewer - QUADRADO 1:1 */}
          <div className="w-full flex items-center justify-center flex-shrink-0" style={{ height: 'fit-content', minHeight: 'fit-content' }}>
            <div 
              className="w-full"
              style={{ 
                aspectRatio: '1 / 1',
                maxWidth: '100%',
                maxHeight: '100%'
              }}
            >
              <UltrasoundTherapy3DViewer />
            </div>
          </div>
        </main>

        {/* Right - Insights Panel (toggle) */}
        <aside 
          className={`border-l border-slate-800 shrink-0 overflow-hidden transition-all duration-300 ${
            showInsights ? 'w-56' : 'w-0'
          }`}
        >
          {showInsights && <UltrasoundTherapyInsightsPanel onClose={() => setShowInsights(false)} />}
        </aside>

        {/* Toggle insights quando fechado */}
        {!showInsights && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-16 z-20 bg-slate-800/80 hover:bg-slate-700"
            onClick={() => setShowInsights(true)}
          >
            Métricas
          </Button>
        )}
      </div>
    </div>
  );
}

export default UltrasoundTherapyLabV2;
