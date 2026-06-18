/**
 * UltrasoundTherapy3DViewer - Visualizador 3D para Ultrassom Terapêutico
 * Versão V1 simplificada - mostra tecidos, feixe acústico e mapa de temperatura
 */

import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import type { Texture } from 'three';
import { LabCanvasSurface } from '@/components/labs/LabCanvasSurface';
import { PerspectiveCamera, OrbitControls, Grid } from '@react-three/drei';
import { useUltrasoundTherapyStore } from '@/stores/ultrasoundTherapyStore';
import { isAndroidNative, labCanvasStableProps } from '@/lib/labPerformance';
import {
  shouldEnableRealTimeShadows,
  shouldUseHighDensityEffects,
} from '@/lib/ultrasoundVisualQuality';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Waves, Thermometer, Layers3 } from "lucide-react";
import { TissueLayers } from './TissueLayers';
import { TemperatureHeatmap } from './TemperatureHeatmap';
import { AcousticBeamOverlays } from './AcousticBeamOverlays';
import { buildThermalHeatTexture } from '@/lib/thermalFieldTexture';
import { buildAcousticFieldTexture } from '@/lib/acousticFieldTexture';
import { buildInteractionFieldTexture } from '@/lib/interactionFieldTexture';
import { getEquivalentDiameterCm } from '@/lib/ultrasoundTherapyPhysics';
import { TOTAL_BLOCK_DEPTH } from '@/lib/ultrasoundTherapyStack';
import { resolveMixedLayerConfig } from '@/lib/ultrasoundTherapyStackConfig';
import { BoneReflection } from './BoneReflection';
import { TransducerModel } from './TransducerModel';
import { TransducerAcousticSilhouette } from './TransducerAcousticSilhouette';
import { CavitationEffect } from './CavitationEffect';
import { CouplingGelTrail } from './CouplingGelTrail';
import { TransducerContactEffects } from './TransducerContactEffects';
import { TransducerSkinDragSurface } from './TransducerSkinDragSurface';
import { MixedLayer } from './MixedLayer';
import { AcousticSafetyZoneRing } from './AcousticPropagationVolume';
import { AcousticPhenomenaToggles } from './AcousticPhenomenaToggles';
import { PhysiologyResponseOverlay } from './PhysiologyResponseOverlay';
import { TissueDamageMarkers } from './TissueDamageMarkers';
import { PhysiologyLegend } from './PhysiologyLegend';
import { ThermalColormapLegend } from './ThermalColormapLegend';
import { AcousticColormapLegend } from './AcousticColormapLegend';
import { pickRandomClinicalSkinTone } from '@/lib/clinicalSkinTones';
import { therapyBeamWorldRef } from '@/lib/therapyRuntimeRefs';
import { getHighlightLayerForGoal } from './therapyUxHelpers';
import { SHOW_PROPAGATION_LAYERS_PANEL } from './ultrasoundTherapyUi';
import { TherapyScanGroup } from './TherapyScanGroup';
import { TissueFieldOverlay } from './TissueFieldOverlay';
import { SafeStudioEnvironment } from './SafeStudioEnvironment';
import { createTissueStackSeed } from '@/lib/clinicalTissueGeometry';
import type { UltrasoundViewerTab } from '@/stores/ultrasoundTherapyStore';

const WORLD_X = 8;
const WORLD_Z = 3;

function deferGpuDispose(dispose: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(dispose);
  });
}

interface UltrasoundTherapy3DViewerProps {
  hideTabs?: boolean;
}

export function UltrasoundTherapy3DViewer({ hideTabs = false }: UltrasoundTherapy3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const config = useUltrasoundTherapyStore((s) => s.config);
  const simulationResult = useUltrasoundTherapyStore((s) => s.simulationResult);
  const effectiveCoupling = useUltrasoundTherapyStore((s) => s.effectiveCoupling);
  const viewerTab = useUltrasoundTherapyStore((s) => s.viewerTab);
  const setViewerTab = useUltrasoundTherapyStore((s) => s.setViewerTab);
  const visualizationOptions = useUltrasoundTherapyStore((s) => s.visualizationOptions);
  const simulationPaused = useUltrasoundTherapyStore((s) => s.simulationPaused);
  const therapyTargetGoal = useUltrasoundTherapyStore((s) => s.therapyTargetGoal);

  const baseTransducerPosition = config.transducerPosition ?? { x: 0, y: 0 };
  const beamCenterWorldX = baseTransducerPosition.x * WORLD_X;
  const beamCenterWorldZ = baseTransducerPosition.y * WORLD_Z;

  useEffect(() => {
    therapyBeamWorldRef.x = beamCenterWorldX;
    therapyBeamWorldRef.z = beamCenterWorldZ;
  }, [beamCenterWorldX, beamCenterWorldZ]);

  const [draggingTransducer, setDraggingTransducer] = React.useState(false);
  const skinTone = useMemo(() => pickRandomClinicalSkinTone(), []);
  const acousticFaceRadiusCm = useMemo(
    () => getEquivalentDiameterCm(config.era, config.transducerType ?? "planar_circular") / 2,
    [config.era, config.transducerType],
  );

  const resolvedMixedLayer = useMemo(
    () => resolveMixedLayerConfig(config.scenario, config.customThicknesses, config.mixedLayer),
    [config.scenario, config.customThicknesses, config.mixedLayer],
  );

  const highlightLayer = useMemo(
    () => getHighlightLayerForGoal(therapyTargetGoal),
    [therapyTargetGoal],
  );

  const showPhysiology =
    (viewerTab === "thermal" || viewerTab === "physiology" || viewerTab === "interaction") &&
    !!simulationResult?.physiologyResponse;
  const physiology = simulationResult?.physiologyResponse;
  const physiologyTint = useMemo(
    () =>
      physiology
        ? {
            skin: physiology.hyperemiaIndex,
            muscle: physiology.muscleThermalStressIndex,
          }
        : undefined,
    [physiology],
  );

  const muscleLesionIndex = useMemo(() => {
    if (!physiology) return 0;
    return Math.min(
      1,
      physiology.muscleThermalStressIndex * 0.55 +
        physiology.irreversibleDamageIndex * 0.45 +
        physiology.coagulationIndex * 0.25,
    );
  }, [physiology]);

  const boneReflectionIndex = simulationResult?.boneReflection ?? 0;
  const premiumLighting = shouldUseHighDensityEffects();
  const useShadows = shouldEnableRealTimeShadows();
  const showPhysiologyOverlay =
    !!physiology &&
    simulationResult &&
    (viewerTab === "physiology" ||
      viewerTab === "thermal" ||
      (SHOW_PROPAGATION_LAYERS_PANEL &&
        viewerTab === "interaction" &&
        visualizationOptions.showTissueResponse));

  const thermalTint = undefined;

  const thermalHeatMap = useMemo(() => {
    if (viewerTab !== "thermal" || !simulationResult?.interactionMap) return undefined;
    return buildThermalHeatTexture(simulationResult.interactionMap, simulationResult.maxTemp, {
      xOffset: 0,
      intensity: config.intensity,
      texWidth: 220,
      texHeight: 280,
      blurPasses:
        (config.beamProfile ?? "planar") === "focused"
          ? config.movement === "scanning"
            ? 5
            : 4
          : config.movement === "scanning"
            ? 7
            : 6,
    });
  }, [
    viewerTab,
    simulationResult?.interactionMap,
    simulationResult?.maxTemp,
    config.movement,
    config.intensity,
    config.beamProfile,
  ]);

  const interactionFieldMap = useMemo(() => {
    if (
      !SHOW_PROPAGATION_LAYERS_PANEL ||
      viewerTab !== "interaction" ||
      !simulationResult?.interactionMap
    ) {
      return undefined;
    }
    return buildInteractionFieldTexture(
      simulationResult.interactionMap,
      visualizationOptions,
      {
        xOffset: 0,
        texWidth: 260,
        texHeight: 320,
      },
    );
  }, [
    viewerTab,
    simulationResult?.interactionMap,
    visualizationOptions,
  ]);

  /** Mapa acústico só na aba Feixe — Visão Geral fica só com reflexão/textura clínica. */
  const needsAcousticFieldTexture = viewerTab === "beam";

  const acousticFieldResult = useMemo(() => {
    if (!needsAcousticFieldTexture || !simulationResult?.interactionMap) {
      return { map: undefined as ReturnType<typeof buildAcousticFieldTexture> | undefined, stats: undefined };
    }
    const acoustic = {
      frequencyMHz: config.frequency,
      eraCm2: config.era,
      transducerType: config.transducerType ?? "planar_circular",
      beamProfile: config.beamProfile ?? "planar",
      focusDepthCm:
        simulationResult.acousticProfile?.focusDepthCm ??
        config.focusDepth ??
        2.5,
    };
    const isFocused = (config.beamProfile ?? "planar") === "focused";
    const map = buildAcousticFieldTexture(simulationResult.interactionMap, {
      xOffset: 0,
      intensity: config.intensity,
      coupling: effectiveCoupling,
      scenario: config.scenario,
      customThicknesses: config.customThicknesses,
      mixedLayer: config.mixedLayer,
      acoustic,
      texWidth: isFocused ? 300 : 260,
      texHeight: isFocused ? 360 : 420,
      blurPasses: isFocused ? 2 : 2,
    });
    return { map, stats: map.fieldStats };
  }, [
    needsAcousticFieldTexture,
    simulationResult?.interactionMap,
    simulationResult?.acousticProfile?.focusDepthCm,
    config.intensity,
    config.scenario,
    config.customThicknesses,
    config.mixedLayer,
    config.frequency,
    config.era,
    config.transducerType,
    config.beamProfile,
    config.focusDepth,
    effectiveCoupling,
  ]);

  const acousticFieldMap = acousticFieldResult.map;
  const acousticFieldStats = acousticFieldResult.stats;

  const tissueOverlayMap =
    viewerTab === "interaction"
      ? interactionFieldMap
      : viewerTab === "beam"
        ? acousticFieldMap
        : thermalHeatMap;
  const tissueOverlayMode = !tissueOverlayMap
    ? "thermal"
    : viewerTab === "interaction"
      ? "interaction"
      : viewerTab === "beam"
        ? "acoustic"
        : "thermal";

  const tissueStackSeed = useMemo(() => createTissueStackSeed(), []);

  /** Feixe e Térmico: overlay único ondulado — sem z-fighting entre camadas. */
  const useFieldOverlay =
    (viewerTab === "beam" && Boolean(acousticFieldMap)) ||
    (viewerTab === "thermal" && Boolean(thermalHeatMap));

  const layerHeatMap = useFieldOverlay ? undefined : tissueOverlayMap;

  const gpuTexRefs = useRef<{
    thermal?: Texture;
    interaction?: Texture;
    acoustic?: Texture;
  }>({});

  useEffect(() => {
    const prev = gpuTexRefs.current.thermal;
    if (prev && prev !== thermalHeatMap) {
      deferGpuDispose(() => prev.dispose());
    }
    gpuTexRefs.current.thermal = thermalHeatMap;
  }, [thermalHeatMap]);

  useEffect(() => {
    const prev = gpuTexRefs.current.interaction;
    if (prev && prev !== interactionFieldMap) {
      deferGpuDispose(() => prev.dispose());
    }
    gpuTexRefs.current.interaction = interactionFieldMap;
  }, [interactionFieldMap]);

  useEffect(() => {
    const prev = gpuTexRefs.current.acoustic;
    if (prev && prev !== acousticFieldMap) {
      deferGpuDispose(() => prev.dispose());
    }
    gpuTexRefs.current.acoustic = acousticFieldMap;
  }, [acousticFieldMap]);

  useEffect(
    () => () => {
      deferGpuDispose(() => {
        gpuTexRefs.current.thermal?.dispose();
        gpuTexRefs.current.interaction?.dispose();
        gpuTexRefs.current.acoustic?.dispose();
      });
    },
    [],
  );

  const showPhysiologyMarkers = viewerTab === "physiology" && !!physiology && !!simulationResult;

  const canDragTransducer =
    viewerTab === "beam" || viewerTab === "thermal" || viewerTab === "interaction";

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const syncCanvasSize = () => {
      const canvas = root.querySelector("canvas");
      if (!canvas) return;
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.maxWidth = "100%";
      canvas.style.minWidth = "0";
      canvas.style.height = "100%";
    };

    syncCanvasSize();
    const observer = new ResizeObserver(syncCanvasSize);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full min-w-0 max-w-full overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900"
    >
      {!hideTabs && (
        <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
          <Tabs value={viewerTab} onValueChange={(v) => setViewerTab(v as UltrasoundViewerTab)}>
            <TabsList className="h-8 bg-slate-800/90 backdrop-blur-sm" aria-label="Modo de visualização 3D">
              <TabsTrigger value="interaction" className="h-6 gap-1 px-3 text-[11px]" aria-label="Visão geral do ultrassom terapêutico">
                <Layers3 className="h-3 w-3" aria-hidden />Visão Geral
              </TabsTrigger>
              <TabsTrigger value="beam" className="h-6 gap-1 px-3 text-[11px]" aria-label="Visualizar feixe acústico">
                <Waves className="h-3 w-3" aria-hidden />Feixe
              </TabsTrigger>
              <TabsTrigger value="thermal" className="h-6 gap-1 px-3 text-[11px]" aria-label="Visualizar mapa térmico">
                <Thermometer className="h-3 w-3" aria-hidden />Térmico
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {SHOW_PROPAGATION_LAYERS_PANEL && viewerTab === "interaction" && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-20">
          <AcousticPhenomenaToggles variant="overlay" />
        </div>
      )}

      {viewerTab === "physiology" && <PhysiologyLegend />}
      {viewerTab === "thermal" && <ThermalColormapLegend />}
      {viewerTab === "beam" && <AcousticColormapLegend fieldStats={acousticFieldStats} />}

      {canDragTransducer && !draggingTransducer && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-slate-900/75 px-3 py-1 text-[11px] text-slate-300 backdrop-blur-sm">
          Arraste na pele para mover o transdutor
        </div>
      )}

      {/* 3D Canvas */}
      <LabCanvasSurface
        {...labCanvasStableProps}
        resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
      >
        <color attach="background" args={['#0f172a']} />
        <PerspectiveCamera makeDefault position={[0, 2.5, 10]} fov={55} />
        <OrbitControls 
          makeDefault
          enabled={!draggingTransducer}
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={Math.PI / 5}
          maxDistance={35}
          minDistance={5}
          enableDamping={!isAndroidNative}
          dampingFactor={0.05}
          rotateSpeed={isAndroidNative ? 0.85 : 1}
          zoomSpeed={isAndroidNative ? 0.9 : 1}
        />
        
        {/* IBL opcional — HDR local; fallback silencioso se indisponível */}
        <Suspense fallback={null}>
          <SafeStudioEnvironment
            environmentIntensity={premiumLighting ? 0.52 : 0.38}
          />
        </Suspense>

        {premiumLighting ? (
          <>
            <hemisphereLight intensity={0.28} groundColor="#141c28" color="#f0f4fa" />
            <ambientLight intensity={0.12} color="#dce4ef" />
            <directionalLight
              castShadow={useShadows}
              position={[6, 14, 10]}
              intensity={0.95}
              color="#fff5eb"
              shadow-mapSize={useShadows ? [2048, 2048] : [512, 512]}
              shadow-bias={-0.0002}
              shadow-normalBias={0.02}
              shadow-radius={3}
              shadow-camera-far={40}
              shadow-camera-left={-14}
              shadow-camera-right={14}
              shadow-camera-top={14}
              shadow-camera-bottom={-14}
            />
            <directionalLight position={[-10, 6, 4]} intensity={0.28} color="#a8c0e0" />
            <directionalLight position={[0, 4, -12]} intensity={0.3} color="#7090c0" />
            <directionalLight position={[0, 2, 14]} intensity={0.22} color="#ffffff" />
            <pointLight position={[0, 0.5, 8]} intensity={0.35} distance={22} decay={2} color="#e8f0ff" />
            <pointLight position={[0, 2.2, 4]} intensity={0.55} distance={18} decay={2} color="#ffffff" />
          </>
        ) : (
          <>
            <hemisphereLight intensity={0.42} groundColor="#0f1419" color="#f8fafc" />
            <ambientLight intensity={0.22} color="#e2e8f0" />
            <directionalLight position={[5, 10, 8]} intensity={0.72} color="#fff8f0" />
            <directionalLight position={[-8, 4, -6]} intensity={0.38} color="#93c5fd" />
            <directionalLight position={[0, 3, -10]} intensity={0.45} color="#bfdbfe" />
            <pointLight position={[0, 1.2, 6]} intensity={0.48} distance={20} decay={2} color="#fef3c7" />
          </>
        )}
        
        {/* Enhanced Fog - subtle depth gradient */}
        <fog attach="fog" args={['#0f172a', 15, 35]} />
        
        {/* Grid - Consistent with other labs */}
        <Grid args={[24, 24]} position={[0, -4, 0]} cellColor="#334155" sectionColor="#1e293b" />
        
        {/* Transducer Model — após tecidos para não ficar oculto pela pele */}
        {!resolvedMixedLayer && (
          <TissueLayers 
            scenario={config.scenario} 
            showLabels={false}
            skinTone={skinTone}
            customThicknesses={config.customThicknesses}
            physiologyTint={showPhysiology ? physiologyTint : undefined}
            thermalTint={thermalTint}
            thermalHeatMap={layerHeatMap}
            thermalStackDepth={TOTAL_BLOCK_DEPTH}
            thermalIntensity={config.intensity}
            thermalBeamCenterX={beamCenterWorldX}
            thermalBeamCenterZ={beamCenterWorldZ}
            acousticFaceRadiusCm={acousticFaceRadiusCm}
            planarAcousticClip={(config.beamProfile ?? "planar") === "planar"}
            overlayMode={tissueOverlayMode}
            highlightLayer={highlightLayer}
            muscleLesionIndex={muscleLesionIndex}
            boneReflectionIndex={boneReflectionIndex}
            perfusionProfile={config.tissuePerfusionProfile}
          />
        )}
        
        {/* Mixed Layer - V5: Bone/Muscle in same plane */}
        {resolvedMixedLayer && (
          <>
            <TissueLayers 
              scenario={config.scenario} 
              showLabels={false}
              skinTone={skinTone}
              customThicknesses={config.customThicknesses}
              stopAtDepth={resolvedMixedLayer.depth}
              physiologyTint={showPhysiology ? physiologyTint : undefined}
            thermalTint={thermalTint}
            thermalHeatMap={layerHeatMap}
            thermalStackDepth={TOTAL_BLOCK_DEPTH}
            thermalIntensity={config.intensity}
            thermalBeamCenterX={beamCenterWorldX}
            thermalBeamCenterZ={beamCenterWorldZ}
            acousticFaceRadiusCm={acousticFaceRadiusCm}
            planarAcousticClip={(config.beamProfile ?? "planar") === "planar"}
            overlayMode={tissueOverlayMode}
              highlightLayer={highlightLayer}
              muscleLesionIndex={muscleLesionIndex}
              boneReflectionIndex={boneReflectionIndex}
              perfusionProfile={config.tissuePerfusionProfile}
            />
            <MixedLayer
              depth={resolvedMixedLayer.depth}
              division={resolvedMixedLayer.division}
              thickness={0.5}
              skinTone={skinTone}
              muscleLesionIndex={muscleLesionIndex}
              boneReflectionIndex={boneReflectionIndex}
              physiologyTint={showPhysiology ? physiologyTint : undefined}
              thermalHeatMap={layerHeatMap}
              thermalStackDepth={TOTAL_BLOCK_DEPTH}
              thermalIntensity={config.intensity}
              thermalBeamCenterX={beamCenterWorldX}
              thermalBeamCenterZ={beamCenterWorldZ}
              acousticFaceRadiusCm={acousticFaceRadiusCm}
              planarAcousticClip={(config.beamProfile ?? "planar") === "planar"}
              overlayMode={tissueOverlayMode}
            />
          </>
        )}

        {useFieldOverlay && tissueOverlayMap && (
          <TissueFieldOverlay
            heatMap={tissueOverlayMap}
            mode={viewerTab === "thermal" ? "thermal" : "acoustic"}
            stackDepth={TOTAL_BLOCK_DEPTH}
            intensity={config.intensity}
            faceRadiusCm={acousticFaceRadiusCm}
            planarAcousticClip={(config.beamProfile ?? "planar") === "planar"}
            stackSeed={tissueStackSeed}
          />
        )}

        <CouplingGelTrail
          era={config.era}
          transducerType={config.transducerType}
          coupling={config.coupling}
          movement={config.movement}
          position={{ x: 0, y: 0 }}
        />

        <TherapyScanGroup
          basePosition={baseTransducerPosition}
          movement={config.movement}
          paused={simulationPaused}
        >
        <TransducerModel 
          transducerType={config.transducerType ?? "planar_circular"}
          era={config.era} 
          coupling={effectiveCoupling}
          mode={config.mode}
          intensity={config.intensity}
          dutyCycle={config.dutyCycle}
          position={{ x: 0, y: 0 }}
        />

        <TransducerContactEffects
          era={config.era}
          transducerType={config.transducerType}
          position={{ x: 0, y: 0 }}
        />

        {viewerTab !== "beam" && viewerTab !== "interaction" && viewerTab !== "thermal" && (
          <TransducerAcousticSilhouette
            era={config.era}
            frequency={config.frequency}
            intensity={config.intensity}
            beamProfile={config.beamProfile ?? "planar"}
            transducerType={config.transducerType ?? "planar_circular"}
            focusDepth={config.focusDepth}
            maxDepth={simulationResult?.penetrationDepth ?? 2}
            position={{ x: 0, y: 0 }}
          />
        )}

        {viewerTab === "beam" && simulationResult && (
          <AcousticBeamOverlays
            frequency={config.frequency}
            intensity={config.intensity}
            era={config.era}
            effectiveDepth={simulationResult.effectiveDepth}
            penetrationDepth={simulationResult.penetrationDepth}
            coupling={effectiveCoupling}
            beamProfile={config.beamProfile ?? "planar"}
            transducerType={config.transducerType ?? "planar_circular"}
            focusDepth={config.focusDepth}
            scenario={config.scenario}
            customThicknesses={config.customThicknesses}
            acousticProfile={simulationResult.acousticProfile}
            boneReflection={simulationResult.boneReflection}
            position={{ x: 0, y: 0 }}
          />
        )}

        {viewerTab === "physiology" && simulationResult && !simulationResult.interactionMap && (
          <TemperatureHeatmap 
            maxTemp={simulationResult.maxTemp}
            maxTempDepth={simulationResult.maxTempDepth}
            surfaceTemp={simulationResult.surfaceTemp}
            targetTemp={simulationResult.targetTemp}
            movement={config.movement}
            treatedArea={simulationResult.treatedArea}
            position={{ x: 0, y: 0 }}
            era={config.era}
          />
        )}

        {SHOW_PROPAGATION_LAYERS_PANEL && viewerTab === "interaction" && simulationResult?.interactionMap && (
          <>
            {visualizationOptions.showSafetyZones && (
              <AcousticSafetyZoneRing
                effectiveDepth={simulationResult.effectiveDepth}
                beamRadius={simulationResult.beamWidth / 2}
                position={{ x: 0, y: 0 }}
              />
            )}
          </>
        )}

        {viewerTab === "interaction" &&
          visualizationOptions.showReflection &&
          simulationResult && (
            <BoneReflection position={{ x: 0, y: 0 }} />
          )}

        {showPhysiologyOverlay && physiology && simulationResult && (
          <PhysiologyResponseOverlay
            physiology={physiology}
            result={simulationResult}
            scenario={config.scenario}
            customThicknesses={config.customThicknesses}
            era={config.era}
            position={{ x: 0, y: 0 }}
          />
        )}

        {showPhysiologyMarkers && physiology && simulationResult && (
          <TissueDamageMarkers
            physiology={physiology}
            result={simulationResult}
            position={{ x: 0, y: 0 }}
          />
        )}
        </TherapyScanGroup>

        {/* Arrastar transdutor diretamente na pele 3D */}
        {canDragTransducer && (
          <TransducerSkinDragSurface onDraggingChange={setDraggingTransducer} />
        )}

        {SHOW_PROPAGATION_LAYERS_PANEL && viewerTab === "interaction" && visualizationOptions.showCavitation && (
          <CavitationEffect />
        )}
              </LabCanvasSurface>
    </div>
  );
}
