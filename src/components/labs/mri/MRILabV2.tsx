/**
 * MRI Lab V2 - Main component
 * Layout similar to Ultrasound Therapy Lab
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { MRILabControlPanel } from "./MRILabControlPanel";
import { MRILabInsightsPanel } from "./MRILabInsightsPanel";
import { Magnetization3DViewer } from "./Magnetization3DViewer";
import { Slice2DViewer } from "./Slice2DViewer";
import { Volume3DViewer } from "./Volume3DViewer";
import { DicomSlice2DViewer } from "./DicomSlice2DViewer";
import { DicomMPRViewer } from "./DicomMPRViewer";
import { ThreeVolumeSurfaceViewer } from "./ThreeVolumeSurfaceViewer";
import { Volume2DViewer } from "./Volume2DViewer";
import { VolumeMPRViewer } from "./VolumeMPRViewer";
import { CornerstoneStackViewer } from "./CornerstoneStackViewer";
import { MagnetizationGraph } from "./MagnetizationGraph";
import { useMRILabStore } from "@/stores/mriLabStore";
import { MRILabConfig, defaultMRILabConfig, MRIViewerType } from "@/types/mriLabConfig";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, RotateCcw, Magnet, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface MRILabV2Props {
  config?: MRILabConfig;
  labName?: string;
  showBackButton?: boolean;
  showDebug?: boolean;
  onConfigChange?: (nextConfig: MRILabConfig) => void;
}

export function MRILabV2({
  config = defaultMRILabConfig,
  labName = "Laboratório Virtual de Ressonância Magnética",
  showBackButton = true,
  showDebug = false,
  onConfigChange,
}: MRILabV2Props) {
  const navigate = useNavigate();
  const store = useMRILabStore();
  const [showReferences, setShowReferences] = useState(false);
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
    dicomVolumeA,
    normalizedVolume,
    loadClinicalCase,
  } = store;
  const storeInstanceId = store.storeInstanceId || "unknown";
  const lastSimulatedConfigHash = store.lastSimulatedConfigHash || "";
  const lastSimulationAt = store.lastSimulationAt || null;
  const physicsActiveOnRealVolume = !!(normalizedVolume && normalizedVolume.isValid);

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
      dataSource: storeConfig.dataSource,
    });
    
    // Sempre carregar caso clínico BraTS: modo nifti/dicom ou phantom (legacy = tratar como nifti)
    const useClinical = storeConfig.dataSource === "nifti" || storeConfig.dataSource === "dicom" || storeConfig.dataSource === "phantom";
    if (useClinical) {
      console.log("[MRILabV2] Carregando caso clínico BraTS (case01_brain_normal). dataSource:", storeConfig.dataSource);
      void loadClinicalCase("case01_brain_normal");
      return;
    }
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
    // Simulador phantom desativado: este efeito permanece apenas como no-op para configs legacy.
    return;
  }, [
    storeConfig.preset,
    storeConfig.phantomType,
    storeConfig.tr,
    storeConfig.te,
    storeConfig.flipAngle,
    storeConfig.sequenceType,
    normalizedVolume,
  ]);
  
  // Ensure sliceIndex is valid when switching to slice viewers
  useEffect(() => {
    if ((storeConfig.activeViewer === "slice_2d" || storeConfig.activeViewer === "mpr_2d") && volumeReady && volume) {
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
    const base = (config && typeof config === "object" && "tr" in config) ? config : defaultMRILabConfig;
    updateConfig({
      preset: base.preset,
      phantomType: base.phantomType,
      tr: base.tr,
      te: base.te,
      ti: base.ti,
      flipAngle: base.flipAngle,
      sequenceType: base.sequenceType,
      matrixSize: base.matrixSize,
      nex: base.nex,
      simulateArtifacts: base.simulateArtifacts,
      window: base.window,
      level: base.level,
      sliceIndex: base.sliceIndex,
    });
    if (!showDebug || !onConfigChange) return;
    const nextConfig = useMRILabStore.getState().config;
    onConfigChange(nextConfig);
  };

  const applyViewerTabChange = (nextViewer: MRIViewerType) => {
    updateConfig({ activeViewer: nextViewer });
    if (!showDebug || !onConfigChange) return;
    const nextConfig = useMRILabStore.getState().config;
    onConfigChange(nextConfig);
  };

  const availableViewers = useMemo(() => {
    const viewers: MRIViewerType[] = [];
    viewers.push("slice_2d");
    viewers.push("mpr_2d");
    viewers.push("volume_3d");
    return viewers;
  }, [storeConfig.dataSource]);

  // Se o professor desligar um módulo, garantir que o viewer ativo ainda seja válido.
  useEffect(() => {
    if (!availableViewers.length) return;
    if (availableViewers.includes(storeConfig.activeViewer)) return;
    applyViewerTabChange(availableViewers[0]);
  }, [availableViewers, storeConfig.activeViewer]);

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
      case "slice_2d":
        // Em modo NIfTI/DICOM, sempre permitir viewer clínico
        // PRIORIDADE: Usar novo sistema unificado se disponível
        if (normalizedVolume && normalizedVolume.isValid) {
          return (
            <div className="relative w-full h-full">
              {debugOverlay}
              <Volume2DViewer showDebug={showDebug} />
            </div>
          );
        }
        
        // Viewer de fusão T1/T2 + segmentação (caso clínico BraTS)
        if (dicomReady && dicomVolumeA) {
          return (
            <div className="relative w-full h-full">
              {debugOverlay}
              <CornerstoneStackViewer showDebug={showDebug} />
            </div>
          );
        }
        // Fallback para sistema legado (apenas dicomVolume)
        if ((storeConfig.dataSource === "dicom" || storeConfig.dataSource === "nifti") && dicomReady && dicomVolume) {
          return (
            <div className="relative w-full h-full">
              {debugOverlay}
              <DicomSlice2DViewer showDebug={showDebug} />
            </div>
          );
        }
        // Phantom viewer (sem volume)
        return (
          <div className="relative w-full h-full">
            {debugOverlay}
            <Slice2DViewer showDebug={showDebug} />
          </div>
        );
      case "mpr_2d":
        // Em modo NIfTI/DICOM, sempre permitir viewer clínico
        // PRIORIDADE: Usar novo sistema unificado se disponível
        if (normalizedVolume && normalizedVolume.isValid) {
          return (
            <div className="relative w-full h-full">
              {debugOverlay}
              <VolumeMPRViewer showDebug={showDebug} />
            </div>
          );
        }
        
        // MPR/Volume quando temos volume clínico (dicomVolume preenchido por loadClinicalCase)
        if (dicomReady && (dicomVolumeA || dicomVolume)) {
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
      case "volume_3d":
        // Volume 3D real (superfície/camada cortical) usando Three.js
        if (normalizedVolume?.isValid || dicomReady) {
          return (
            <div className="relative w-full h-full">
              {debugOverlay}
              <ThreeVolumeSurfaceViewer showDebug={showDebug} />
            </div>
          );
        }
        // Fallback: visualização 3D sintética do phantom
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
    <div className="h-screen flex flex-col bg-background overflow-y-auto">
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
              onValueChange={(v) => applyViewerTabChange(v as MRIViewerType)}
              className="w-auto"
            >
              <TabsList className="bg-muted/50">
                <TabsTrigger value="slice_2d" className="text-xs">
                  Fatia 2D
                </TabsTrigger>
                <TabsTrigger value="mpr_2d" className="text-xs">
                  Planos 2D (MPR)
                </TabsTrigger>
                <TabsTrigger value="volume_3d" className="text-xs">
                  Volume 3D
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Right: Reset + Physics indicator */}
          <div className="flex items-center gap-2">
            {physicsActiveOnRealVolume && (
              <div className="flex items-center gap-1 text-xs text-emerald-500">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Física ativa</span>
              </div>
            )}
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

      {/* LINHA 2 - SIMULADOR 3D (principal) */}
      <main className="flex-[11] flex items-center justify-center min-w-0 min-h-0 overflow-hidden bg-background">
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
      <div className="flex-[9] flex flex-col border-t border-border min-h-0">
        {/* Linha 3a: Controles + Métricas */}
        <div className="flex flex-1 min-h-0">
          {/* Coluna Esquerda: Controles */}
          <aside className="w-1/2 border-r border-border overflow-y-auto bg-card">
            <MRILabControlPanel isAdmin={showDebug} onConfigChange={onConfigChange} />
          </aside>

          {/* Coluna Direita: Métricas */}
          <aside className="w-1/2 overflow-y-auto bg-card flex flex-col">
            <MRILabInsightsPanel />
            {/* Magnetization Graph em hold */}
          </aside>
        </div>
      </div>

      {/* Barra fixa de Referências (sempre acessível) */}
      <div className="sticky bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
        <div className="px-3 py-2 flex items-center justify-between gap-2">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Referências (BraTS / TCGA)
          </div>
          <Button
            type="button"
            size="sm"
            variant={showReferences ? "default" : "outline"}
            className={`h-7 px-2.5 text-[10px] font-semibold tracking-wide ${
              showReferences ? "bg-blue-600 text-white border-blue-600" : "border-blue-500 text-blue-500"
            }`}
            onClick={() => setShowReferences((prev) => !prev)}
          >
            {showReferences ? "Ocultar Referências" : "Ver Referências"}
          </Button>
        </div>

        {showReferences && (
          <div className="px-3 pb-3">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 max-h-56 overflow-y-auto">
              <div className="space-y-1.5 text-[10px] text-muted-foreground">
                <p className="break-words">
                  [1] B. H. Menze, A. Jakab, S. Bauer, J. Kalpathy-Cramer, K. Farahani, J. Kirby, et al.{" "}
                  <span className="italic">
                    "The Multimodal Brain Tumor Image Segmentation Benchmark (BRATS)"
                  </span>
                  , IEEE Transactions on Medical Imaging 34(10), 1993-2024 (2015) DOI: 10.1109/TMI.2014.2377694
                </p>
                <p className="break-words">
                  [2] S. Bakas, H. Akbari, A. Sotiras, M. Bilello, M. Rozycki, J.S. Kirby, et al.,{" "}
                  <span className="italic">
                    "Advancing The Cancer Genome Atlas glioma MRI collections with expert segmentation labels and radiomic features"
                  </span>
                  , Nature Scientific Data, 4:170117 (2017) DOI: 10.1038/sdata.2017.117
                </p>
                <p className="break-words">
                  [3] S. Bakas, M. Reyes, A. Jakab, S. Bauer, M. Rempfler, A. Crimi, et al.,{" "}
                  <span className="italic">
                    "Identifying the Best Machine Learning Algorithms for Brain Tumor Segmentation, Progression Assessment, and Overall Survival Prediction in the BRATS Challenge"
                  </span>
                  , arXiv preprint arXiv:1811.02629 (2018)
                </p>
                <p className="break-words">
                  [4] S. Bakas, H. Akbari, A. Sotiras, M. Bilello, M. Rozycki, J. Kirby, et al.,{" "}
                  <span className="italic">
                    "Segmentation Labels and Radiomic Features for the Pre-operative Scans of the TCGA-GBM collection"
                  </span>
                  , The Cancer Imaging Archive, 2017. DOI: 10.7937/K9/TCIA.2017.KLXWJJ1Q
                </p>
                <p className="break-words">
                  [5] S. Bakas, H. Akbari, A. Sotiras, M. Bilello, M. Rozycki, J. Kirby, et al.,{" "}
                  <span className="italic">
                    "Segmentation Labels and Radiomic Features for the Pre-operative Scans of the TCGA-LGG collection"
                  </span>
                  , The Cancer Imaging Archive, 2017. DOI: 10.7937/K9/TCIA.2017.GJQ7R0EF
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MRILabV2;
