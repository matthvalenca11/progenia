/**
 * MRI Lab V2 - Main component
 * Layout similar to Ultrasound Therapy Lab
 */

import { useEffect } from "react";
import { MRILabControlPanel } from "./MRILabControlPanel";
import { MRILabInsightsPanel } from "./MRILabInsightsPanel";
import { Magnetization3DViewer } from "./Magnetization3DViewer";
import { Slice2DViewer } from "./Slice2DViewer";
import { Volume3DViewer } from "./Volume3DViewer";
import { MagnetizationGraph } from "./MagnetizationGraph";
import { useMRILabStore } from "@/stores/mriLabStore";
import { MRILabConfig, defaultMRILabConfig, MRIViewerType } from "@/types/mriLabConfig";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, RotateCcw, Magnet } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface MRILabV2Props {
  config?: MRILabConfig;
  labName?: string;
  showBackButton?: boolean;
  showDebug?: boolean;
}

export function MRILabV2({
  config = defaultMRILabConfig,
  labName = "Laboratório Virtual de Ressonância Magnética",
  showBackButton = true,
  showDebug = false,
}: MRILabV2Props) {
  const navigate = useNavigate();
  const { setLabConfig, runSimulation, config: storeConfig, updateConfig, simulationResult } = useMRILabStore();

  useEffect(() => {
    if (config && typeof config === 'object' && 'tr' in config) {
      try {
        setLabConfig(config);
        // runSimulation is called automatically by setLabConfig
      } catch (error) {
        console.error("Error setting MRI lab config:", error);
      }
    } else {
      // Even if config is invalid, ensure simulation runs with defaults
      runSimulation();
    }
  }, [config, setLabConfig, runSimulation]);
  
  // Ensure sliceIndex is valid when switching to slice viewers
  useEffect(() => {
    if ((storeConfig.activeViewer === "slice_2d" || storeConfig.activeViewer === "volume_3d") && simulationResult) {
      const maxSlice = Math.max(0, (simulationResult.volume.depth || 32) - 1);
      const currentSlice = storeConfig.sliceIndex || 0;
      if (currentSlice > maxSlice || currentSlice < 0) {
        updateConfig({ sliceIndex: Math.max(0, Math.min(maxSlice, 0)) });
      }
    }
  }, [storeConfig.activeViewer, simulationResult, storeConfig.sliceIndex, updateConfig]);

  const resetToDefaults = () => {
    updateConfig({
      tr: 500,
      te: 20,
      flipAngle: 90,
      sequenceType: "spin_echo",
      preset: "t1_weighted",
    });
  };

  const renderViewer = () => {
    if (!storeConfig || !storeConfig.activeViewer) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Carregando viewer...</p>
        </div>
      );
    }
    
    switch (storeConfig.activeViewer) {
      case "magnetization":
        return <Magnetization3DViewer />;
      case "slice_2d":
        return <Slice2DViewer showDebug={showDebug} />;
      case "volume_3d":
        return <Volume3DViewer showDebug={showDebug} />;
      default:
        return <Magnetization3DViewer />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* LINHA 1 - HEADER */}
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
              <Magnet className="h-4 w-4 text-cyan-400" />
              <h1 className="font-medium text-sm text-foreground">{labName}</h1>
            </div>
          </div>

          {/* Center: Viewer Tabs */}
          <div className="flex-1 flex justify-center">
            <Tabs
              value={storeConfig.activeViewer}
              onValueChange={(v) => updateConfig({ activeViewer: v as MRIViewerType })}
              className="w-auto"
            >
              <TabsList className="bg-muted/50">
                <TabsTrigger value="magnetization" className="text-xs">
                  Magnetização
                </TabsTrigger>
                <TabsTrigger value="slice_2d" className="text-xs">
                  Fatia 2D
                </TabsTrigger>
                <TabsTrigger value="volume_3d" className="text-xs">
                  Volume 3D
                </TabsTrigger>
              </TabsList>
            </Tabs>
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

      {/* LINHA 2 - SIMULADOR 3D (principal) */}
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
            {renderViewer()}
          </div>
        </div>
      </main>

      {/* LINHA 3 - CONTROLES + MÉTRICAS */}
      <div className="flex border-t border-border shrink-0" style={{ height: '45%' }}>
        {/* Coluna Esquerda: Controles */}
        <aside className="w-1/2 border-r border-border overflow-y-auto bg-card">
          <MRILabControlPanel />
        </aside>

        {/* Coluna Direita: Métricas */}
        <aside className="w-1/2 overflow-y-auto bg-card flex flex-col">
          <MRILabInsightsPanel />
          {/* Magnetization Graph (only in magnetization viewer) */}
          {storeConfig.activeViewer === "magnetization" && (
            <div className="p-3 border-t border-border">
              <MagnetizationGraph />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default MRILabV2;
