/**
 * MRI Lab V2 - Main component
 * Layout similar to Ultrasound Therapy Lab
 */

import { useEffect, useRef } from "react";
import { MRILabControlPanel } from "./MRILabControlPanel";
import { MRILabInsightsPanel } from "./MRILabInsightsPanel";
import { Magnetization3DViewer } from "./Magnetization3DViewer";
import { Slice2DViewer } from "./Slice2DViewer";
import { Volume3DViewer } from "./Volume3DViewer";
import { DicomSlice2DViewer } from "./DicomSlice2DViewer";
import { DicomMPRViewer } from "./DicomMPRViewer";
import { CornerstoneStackViewer } from "./CornerstoneStackViewer";
import { VtkVolumeViewer } from "./VtkVolumeViewer";
import { Volume2DViewer } from "./Volume2DViewer";
import { VolumeMPRViewer } from "./VolumeMPRViewer";
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
  const store = useMRILabStore();
  const { 
    setLabConfig, 
    runSimulation, 
    config: storeConfig, 
    updateConfig, 
    volume, 
    volumeReady, 
    simulationError,
    initIfNeeded,
    isSimulating,
    dicomReady,
    dicomVolume,
    normalizedVolume,
  } = store;
  const storeInstanceId = store.storeInstanceId || "unknown";
  const lastSimulatedConfigHash = store.lastSimulatedConfigHash || "";
  const lastSimulationAt = store.lastSimulationAt || null;

  // Log mount and ensure initial simulation runs
  useEffect(() => {
    console.log("[MRILabV2] ✅ Component mounted");
    console.log("[MRILabV2] Current store state:", {
      storeInstanceId,
      volumeReady,
      hasVolume: !!volume,
      volumeDims: volume ? `${volume.width}×${volume.height}×${volume.depth}` : "null",
      hasNormalizedVolume: !!normalizedVolume,
      normalizedVolumeValid: normalizedVolume?.isValid,
      simulationError,
      isSimulating,
    });
    
    // Se já temos volume normalizado válido, não precisa re-inicializar
    if (normalizedVolume && normalizedVolume.isValid) {
      console.log("[MRILabV2] Volume normalizado já disponível, pulando initIfNeeded");
      return;
    }
    
    // CRITICAL: Initialize store on mount if needed
    console.log("[MRILabV2] Calling initIfNeeded on mount");
    initIfNeeded("MRILabV2 mount", config);
  }, []); // Empty deps - only run on mount

  // Run simulation when config prop changes (only once, with proper dependencies)
  const configKey = config ? `${config.phantomType}-${config.tr}-${config.te}-${config.flipAngle}-${config.preset}` : "";
  const prevConfigKeyRef = useRef<string>("");
  
  useEffect(() => {
    if (config && typeof config === 'object' && 'tr' in config && configKey !== prevConfigKeyRef.current) {
      prevConfigKeyRef.current = configKey;
      console.log("[MRILabV2] useEffect (config prop) triggered - config changed");
      try {
        console.log("[MRILabV2] Setting lab config from prop");
        setLabConfig(config);
      } catch (error) {
        console.error("[MRILabV2] Error setting MRI lab config:", error);
      }
    }
  }, [configKey, setLabConfig]); // Only depend on config key string
  
  // Run simulation when key parameters change (debounced to prevent loops)
  // This effect only runs if parameters actually changed
  // MAS: não roda se temos volume normalizado (DICOM/NIfTI) - ele não precisa de simulação
  const prevParamsRef = useRef<string>("");
  useEffect(() => {
    // Se temos volume normalizado válido, não precisa rodar simulação de phantom
    if (normalizedVolume && normalizedVolume.isValid) {
      console.log("[MRILabV2] Volume normalizado disponível, pulando simulação de phantom");
      return;
    }
    
    const currentParams = `${storeConfig.preset}-${storeConfig.phantomType}-${storeConfig.tr}-${storeConfig.te}-${storeConfig.flipAngle}-${storeConfig.sequenceType}`;
    
    if (currentParams !== prevParamsRef.current) {
      prevParamsRef.current = currentParams;
      console.log("[MRILabV2] useEffect (params) - parameters changed, running simulation");
      const timeoutId = setTimeout(() => {
        runSimulation();
      }, 150); // Debounce to prevent rapid successive calls
      return () => clearTimeout(timeoutId);
    }
  }, [
    storeConfig.preset,
    storeConfig.phantomType,
    storeConfig.tr,
    storeConfig.te,
    storeConfig.flipAngle,
    storeConfig.sequenceType,
    normalizedVolume,
  ]); // Removed runSimulation from deps to prevent loops
  
  // Ensure sliceIndex is valid when switching to slice viewers
  useEffect(() => {
    if ((storeConfig.activeViewer === "slice_2d" || storeConfig.activeViewer === "volume_3d") && volumeReady && volume) {
      const maxSlice = Math.max(0, volume.depth - 1);
      const currentSlice = storeConfig.sliceIndex || 0;
      if (currentSlice > maxSlice || currentSlice < 0) {
        // Set to middle slice if invalid
        const middleSlice = Math.floor(volume.depth / 2);
        updateConfig({ sliceIndex: Math.max(0, Math.min(maxSlice, middleSlice)) });
      }
    }
  }, [storeConfig.activeViewer, volumeReady, volume, storeConfig.sliceIndex, updateConfig]);

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
    
    // Debug overlay (admin mode)
    const debugOverlay = showDebug && (
      <div className="absolute top-2 left-2 z-50 bg-black/80 text-white text-xs px-3 py-2 rounded font-mono space-y-1">
        <div>Volume Ready: {volumeReady ? "✅" : "❌"}</div>
        <div>Volume: {volume ? `${volume.width}×${volume.height}×${volume.depth}` : "null"}</div>
        <div>Voxels: {volume?.voxels?.length || 0}</div>
        <div>Error: {simulationError || "none"}</div>
        <div>Preset: {storeConfig.preset}</div>
        <div>Phantom: {storeConfig.phantomType}</div>
        <div>TR: {storeConfig.tr}ms | TE: {storeConfig.te}ms</div>
      </div>
    );

    switch (storeConfig.activeViewer) {
      case "magnetization":
        // Only show magnetization if module is enabled
        if (!storeConfig.enabledModules?.magnetization) {
          return (
            <div className="w-full h-full flex items-center justify-center bg-background">
              <div className="text-center p-4 text-muted-foreground">
                Módulo de Magnetização não está habilitado para este lab.
              </div>
            </div>
          );
        }
        return (
          <div className="relative w-full h-full">
            {debugOverlay}
            <Magnetization3DViewer showDebug={showDebug} />
          </div>
        );
      case "slice_2d":
        // PRIORIDADE: Usar novo sistema unificado se disponível
        if (normalizedVolume && normalizedVolume.isValid) {
          return (
            <div className="relative w-full h-full">
              {debugOverlay}
              <Volume2DViewer showDebug={showDebug} />
            </div>
          );
        }
        
        // Fallback para sistema legado
        if ((storeConfig.dataSource === "dicom" || storeConfig.dataSource === "nifti") && dicomReady && dicomVolume) {
          return (
            <div className="relative w-full h-full">
              {debugOverlay}
              <DicomSlice2DViewer showDebug={showDebug} />
            </div>
          );
        }
        
        // Phantom viewer
        return (
          <div className="relative w-full h-full">
            {debugOverlay}
            <Slice2DViewer showDebug={showDebug} />
          </div>
        );
      case "volume_3d":
        // PRIORIDADE: Usar novo sistema unificado se disponível
        if (normalizedVolume && normalizedVolume.isValid) {
          const viewer3DMode = storeConfig.viewer3DMode || "mpr";
          if (viewer3DMode === "mpr") {
            return (
              <div className="relative w-full h-full">
                {debugOverlay}
                <VolumeMPRViewer showDebug={showDebug} />
              </div>
            );
          } else {
            return (
              <div className="relative w-full h-full">
                {debugOverlay}
                <Volume3DViewer showDebug={showDebug} />
              </div>
            );
          }
        }
        
        // Fallback para sistema legado
        if ((storeConfig.dataSource === "dicom" || storeConfig.dataSource === "nifti") && dicomReady && dicomVolume) {
          const viewer3DMode = storeConfig.viewer3DMode || "mpr";
          if (viewer3DMode === "volume") {
            return (
              <div className="relative w-full h-full">
                {debugOverlay}
                <VtkVolumeViewer showDebug={showDebug} />
              </div>
            );
          }
          return (
            <div className="relative w-full h-full">
              {debugOverlay}
              <DicomMPRViewer showDebug={showDebug} />
            </div>
          );
        }
        
        // Fallback para phantom
        return (
          <div className="relative w-full h-full">
            {debugOverlay}
            <Volume3DViewer showDebug={showDebug} />
          </div>
        );
      default:
        return (
          <div className="relative w-full h-full">
            {debugOverlay}
            <Magnetization3DViewer />
          </div>
        );
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
                      {storeConfig.enabledModules?.magnetization && (
                        <TabsTrigger value="magnetization" className="text-xs">
                          Magnetização
                        </TabsTrigger>
                      )}
                      <TabsTrigger value="slice_2d" className="text-xs">
                        Fatia 2D
                      </TabsTrigger>
                      <TabsTrigger value="volume_3d" className="text-xs">
                        {(storeConfig.dataSource === "dicom" || storeConfig.dataSource === "nifti") && dicomReady ? "MPR 3D" : "Volume 3D"}
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
