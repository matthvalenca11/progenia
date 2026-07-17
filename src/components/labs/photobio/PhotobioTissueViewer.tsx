import { useEffect, useMemo, useRef, useState } from "react";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { usePhotobioStore } from "@/stores/photobioStore";
import { LabCanvasSurface } from "@/components/labs/LabCanvasSurface";
import { isAndroidNative } from "@/lib/labPerformance";
import { shouldCastTherapeuticShadows, getPhotobioVisualQualityTier } from "@/lib/therapeuticLabsPerformance";
import {
  buildPhotobioOpticsProfile,
  buildPhotobioLayers,
  getPhotobioWavelengthVisualPreset,
} from "@/lib/photobioOptics";
import type { ClinicalSkinTone } from "@/lib/clinicalSkinTones";
import { skinToneFromMelaninIndex } from "@/lib/clinicalSkinTones";
import { buildPhotobioFieldTexture } from "@/lib/photobioFieldTexture";
import { buildPhotobioInteractionMap } from "@/lib/photobioInteractionMap";
import type { PhotobioInteractionMap } from "@/lib/photobioInteractionMap";
import { SafeStudioEnvironment } from "@/components/labs/ultrasound-therapy/SafeStudioEnvironment";
import { Switch } from "@/components/ui/switch";
import { PhotobioFieldOverlay } from "./PhotobioFieldOverlay";
import { PhotobioOpticalLegend } from "./PhotobioOpticalLegend";
import { PhotobioModeDock } from "./PhotobioModeDock";
import {
  getPhotobioViewerVisualConfig,
  resolvePhotobioTranslucentView,
} from "./photobioViewerModes";
import type { PhotobioViewerVisualConfig } from "./photobioViewerModes";
import { PhotobioTissueStack } from "./PhotobioTissueStack";
import { PhotobioDeviceModel } from "./PhotobioDeviceModel";
import { PhotobioBeam } from "./PhotobioBeam";
import { PhotobioBeamSurfaceGlow } from "./PhotobioBeamSurfaceGlow";
import { PhotobioDoseSurfaceMap } from "./PhotobioDoseSurfaceMap";
import { PhotobioBioresponseHud } from "./PhotobioBioresponseHud";
import { PhotobioDepthProfileOverlay } from "./PhotobioDepthProfileOverlay";
import { PhotobioDepthProfilePanel } from "./PhotobioDepthProfilePanel";
import { PhotobioSceneWarnings } from "./PhotobioSceneWarnings";
import { PhotobioScanAnimator } from "./PhotobioScanAnimator";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { clamp, computePhotobioStackLayout } from "./photobioViewerLayout";
import { getApplicatorContactRadius } from "./photobioApplicatorSpecs";

interface PhotobioTissueViewerProps {
  /** Remove borda/card externo — preview admin embutido */
  embedded?: boolean;
}

const CAST_SHADOW = shouldCastTherapeuticShadows();

function PhotobioTissueScene({
  wavelength,
  irradiance,
  mode,
  dutyCycle,
  bioActive,
  translucentView,
  layerConfig,
  opticsProfile,
  transducerAngle,
  transducerX,
  contactPressure,
  isDragging,
  scanActive,
  draggingSpeed,
  effectiveFluence,
  displayDoseMap,
  spotSize,
  power,
  applicatorType,
  visualQualityTier,
  interactionMap,
  viewerTab,
  visualConfig,
  effectiveTranslucent,
  onAccumulateDose,
  onTransducerLeftDragStart,
  onTransducerLeftDragMove,
  onTransducerRightDragStart,
  onTransducerRightDragMove,
  onTransducerRightDragEnd,
  skinTone,
  fieldTexture,
  stackSeed,
  simplifiedFieldOverlay,
}: {
  wavelength: 660 | 808;
  irradiance: number;
  mode: "CW" | "Pulsed";
  dutyCycle: number;
  bioActive: boolean;
  translucentView: boolean;
  layerConfig: {
    epidermisMm: number;
    dermisMm: number;
    adiposeMm: number;
    muscleMm: number;
  };
  opticsProfile: ReturnType<typeof buildPhotobioOpticsProfile>;
  transducerAngle: number;
  transducerX: number;
  contactPressure: number;
  isDragging: boolean;
  scanActive: boolean;
  draggingSpeed: number;
  effectiveFluence: number;
  displayDoseMap: number[];
  spotSize: number;
  power: number;
  applicatorType: ReturnType<typeof usePhotobioStore.getState>["applicatorType"];
  visualQualityTier: ReturnType<typeof getPhotobioVisualQualityTier>;
  interactionMap: PhotobioInteractionMap;
  viewerTab: ReturnType<typeof usePhotobioStore.getState>["viewerTab"];
  visualConfig: PhotobioViewerVisualConfig;
  effectiveTranslucent: boolean;
  onAccumulateDose: (positionX: number, doseDelta: number) => void;
  onTransducerLeftDragStart: (clientX: number, clientY: number) => void;
  onTransducerLeftDragMove: (clientX: number, clientY: number) => void;
  onTransducerRightDragStart: (clientX: number, clientY: number) => void;
  onTransducerRightDragMove: (clientX: number, clientY: number) => void;
  onTransducerRightDragEnd: () => void;
  skinTone: ClinicalSkinTone;
  fieldTexture: THREE.Texture | null;
  stackSeed: number;
  simplifiedFieldOverlay: boolean;
}) {
  const layout = useMemo(
    () =>
      computePhotobioStackLayout(
        layerConfig,
        transducerX,
        transducerAngle,
        contactPressure,
        spotSize,
        opticsProfile,
        getApplicatorContactRadius(applicatorType, spotSize),
      ),
    [layerConfig, transducerX, transducerAngle, contactPressure, spotSize, opticsProfile, applicatorType],
  );

  const preset = getPhotobioWavelengthVisualPreset(wavelength);
  const fieldMode = visualConfig.fieldMode;
  const thermalRisk = irradiance > 500;

  return (
    <>
      <PhotobioScanAnimator enabled={isDragging && !scanActive} speed={draggingSpeed} />

      <SafeStudioEnvironment environmentIntensity={fieldMode === "beam" ? 0.32 : 0.38} />
      <ambientLight intensity={fieldMode === "beam" ? 0.2 : fieldMode ? 0.26 : 0.32} color="#f8f4ef" />
      <hemisphereLight args={["#fff8f0", "#6b5344", 0.32]} />
      <directionalLight
        castShadow={CAST_SHADOW}
        position={[5, 6, 4]}
        intensity={0.78}
        color="#fff8f0"
        shadow-mapSize={CAST_SHADOW ? [1024, 1024] : undefined}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-4, 3, -2]} intensity={0.2} color="#ffe8d8" />
      <pointLight
        position={[transducerX, layout.contactSurfaceY + 0.85, 0.15]}
        intensity={fieldMode === "beam" ? 1.5 + Math.min(1.2, irradiance / 700) : 1.2}
        color={preset.beamColor}
        distance={9}
      />

      <PhotobioTissueStack
        layerConfig={layerConfig}
        layout={layout}
        transducerX={transducerX}
        contactPressure={contactPressure}
        translucentView={effectiveTranslucent}
        skinTone={skinTone}
        stackSeed={stackSeed}
        wavelength={wavelength}
        viewerTab={viewerTab}
        showLabels={visualConfig.showLayerLabels}
      />

      {fieldMode && fieldTexture && (
        <PhotobioFieldOverlay
          fieldMap={fieldTexture}
          mode={fieldMode}
          stackHeight={layout.totalHeight}
          stackCenterY={layout.stackCenterY}
          stackTopY={layout.topSurfaceY}
          tissueDepthZ={layout.sizes.depth / 2}
          beamCenterX={transducerX}
          spotSizeCm2={spotSize}
          irradianceMwCm2={irradiance}
          thermalRiskIndex={opticsProfile.thermalRiskIndex ?? 0}
          penetrationDepthNorm={
            interactionMap.maxDepthMm > 0
              ? opticsProfile.penetrationDepthMm / interactionMap.maxDepthMm
              : 1
          }
          wavelength={wavelength}
          opacity={visualConfig.fieldOpacity}
          stackSeed={stackSeed}
          simplified={simplifiedFieldOverlay}
        />
      )}

      {fieldMode === "beam" && (
        <PhotobioBeamSurfaceGlow
          transducerX={transducerX}
          contactSurfaceY={layout.contactSurfaceY}
          spotSizeCm2={spotSize}
          wavelength={wavelength}
          irradianceMwCm2={irradiance}
          thermalRiskIndex={opticsProfile.thermalRiskIndex ?? 0}
        />
      )}

      <PhotobioDeviceModel
        applicatorType={applicatorType}
        wavelength={wavelength}
        secondaryWavelength={wavelength === 660 ? 808 : 660}
        powerMw={power}
        spotSizeCm2={spotSize}
        isActive={power > 0}
        isPulsed={mode === "Pulsed"}
        dutyCycle={dutyCycle}
        contactPressure={contactPressure}
        angleDeg={transducerAngle}
        positionX={transducerX}
        visualQualityTier={visualQualityTier}
        contactAnchorY={layout.contactAnchorY}
        contactPivotOffsetX={layout.contactPivotOffsetX}
        contactSeatOffsetY={layout.contactSeatOffsetY}
        contactCenterOffsetX={layout.contactCenterOffsetX}
        contactBodyPitchX={layout.contactBodyPitchX}
        thermalRisk={thermalRisk}
        onTransducerLeftDragStart={onTransducerLeftDragStart}
        onTransducerLeftDragMove={onTransducerLeftDragMove}
        onTransducerRightDragStart={onTransducerRightDragStart}
        onTransducerRightDragMove={onTransducerRightDragMove}
        onTransducerRightDragEnd={onTransducerRightDragEnd}
      />

      <PhotobioBeam
        wavelength={wavelength}
        irradiance={irradiance}
        mode={mode}
        dutyCycle={dutyCycle}
        bioActive={bioActive}
        translucentView={effectiveTranslucent}
        opticsProfile={opticsProfile}
        interactionMap={interactionMap}
        layout={layout}
        transducerX={transducerX}
        transducerAngle={transducerAngle}
        contactPressure={contactPressure}
        spotSizeCm2={spotSize}
        visualConfig={visualConfig}
        isDragging={isDragging || scanActive}
        effectiveFluence={effectiveFluence}
        onAccumulateDose={onAccumulateDose}
      />

      {visualConfig.showDepthProfile && (
        <PhotobioDepthProfileOverlay
          opticsProfile={opticsProfile}
          layout={layout}
        />
      )}

      {visualConfig.showDoseSurfaceMap && (
        <PhotobioDoseSurfaceMap
          doseMap={displayDoseMap}
          topSurfaceY={layout.topSurfaceY}
          enhanced={visualConfig.doseMapEnhanced}
        />
      )}
    </>
  );
}

export function PhotobioTissueViewer({ embedded = false }: PhotobioTissueViewerProps) {
  const wavelength = usePhotobioStore((s) => s.wavelength);
  const irradiance = usePhotobioStore((s) => s.irradiance());
  const fluence = usePhotobioStore((s) => s.fluence());
  const mode = usePhotobioStore((s) => s.mode);
  const dutyCycle = usePhotobioStore((s) => s.dutyCycle);
  const spotSize = usePhotobioStore((s) => s.spotSize);
  const power = usePhotobioStore((s) => s.power);
  const applicatorType = usePhotobioStore((s) => s.applicatorType);
  const zone = usePhotobioStore((s) => s.interaction.arndtSchulzZone);
  const effectiveFluence = usePhotobioStore((s) => s.interaction.effectiveFluence);
  const layerConfig = usePhotobioStore((s) => s.layerConfig);
  const transducerAngle = usePhotobioStore((s) => s.transducerAngle);
  const transducerX = usePhotobioStore((s) => s.transducerX);
  const contactPressure = usePhotobioStore((s) => s.contactPressure);
  const skinMelaninIndex = usePhotobioStore((s) => s.skinMelaninIndex);
  const tissueStackSeed = usePhotobioStore((s) => s.tissueStackSeed);
  const parameterRanges = usePhotobioStore((s) => s.parameterRanges);
  const isDragging = usePhotobioStore((s) => s.isDragging);
  const draggingSpeed = usePhotobioStore((s) => s.draggingSpeed);
  const doseMap = usePhotobioStore((s) => s.doseMap);
  const viewerTab = usePhotobioStore((s) => s.viewerTab);
  const setTransducerAngle = usePhotobioStore((s) => s.setTransducerAngle);
  const setTransducerX = usePhotobioStore((s) => s.setTransducerX);
  const setDraggingSpeed = usePhotobioStore((s) => s.setDraggingSpeed);
  const accumulateDoseAt = usePhotobioStore((s) => s.accumulateDoseAt);

  const bioActive = zone === "Janela Terapêutica Ativa";
  const isMobile = useIsMobile();
  const [translucentView, setTranslucentView] = useState(false);
  const [pointerDragging, setPointerDragging] = useState(false);
  const visualConfig = useMemo(() => getPhotobioViewerVisualConfig(viewerTab), [viewerTab]);
  const effectiveTranslucent = resolvePhotobioTranslucentView(viewerTab, translucentView);

  const displayDoseMap = useMemo(() => {
    if (!visualConfig.doseMapEnhanced) return doseMap;
    if (doseMap.some((d) => d > 0.5)) return doseMap;
    const center = (doseMap.length - 1) / 2;
    return doseMap.map((_, index) => {
      const dist = Math.abs(index - center) / Math.max(center, 1);
      return effectiveFluence * Math.exp(-dist * dist * 5);
    });
  }, [doseMap, effectiveFluence, visualConfig.doseMapEnhanced]);
  const skinTone = useMemo(
    () =>
      skinToneFromMelaninIndex(
        skinMelaninIndex,
        parameterRanges.skinMelaninIndex.min,
        parameterRanges.skinMelaninIndex.max,
      ),
    [skinMelaninIndex, parameterRanges.skinMelaninIndex.min, parameterRanges.skinMelaninIndex.max],
  );
  const visualQualityTier = useMemo(() => getPhotobioVisualQualityTier(), []);
  const dragRef = useRef<{ x: number; y: number; t: number; button: number } | null>(null);

  const fieldMode = visualConfig.fieldMode;

  const interactionMap = useMemo(
    () =>
      buildPhotobioInteractionMap({
        wavelength,
        fluenceJcm2: fluence,
        effectiveFluenceJcm2: effectiveFluence,
        irradianceMwCm2: irradiance,
        spotSizeCm2: spotSize,
        layers: buildPhotobioLayers(layerConfig),
        layerConfig,
        transducerXWorld: transducerX,
        transducerAngleDeg: transducerAngle,
        contactPressure,
        skinMelaninIndex,
      }),
    [
      wavelength,
      fluence,
      effectiveFluence,
      irradiance,
      spotSize,
      layerConfig,
      transducerX,
      transducerAngle,
      contactPressure,
      skinMelaninIndex,
    ],
  );

  const opticsProfile = useMemo(
    () =>
      buildPhotobioOpticsProfile({
        wavelength,
        fluenceJcm2: fluence,
        effectiveFluenceJcm2: effectiveFluence,
        irradianceMwCm2: irradiance,
        spotSizeCm2: spotSize,
        layers: buildPhotobioLayers(layerConfig),
        transducerAngleDeg: transducerAngle,
        contactPressure,
        skinMelaninIndex,
      }),
    [wavelength, fluence, effectiveFluence, irradiance, spotSize, layerConfig, transducerAngle, contactPressure, skinMelaninIndex],
  );

  const fieldTexture = useMemo(() => {
    if (!fieldMode) return null;
    return buildPhotobioFieldTexture(interactionMap, fieldMode, {
      wavelength,
      blurPasses: isAndroidNative ? 1 : fieldMode === "beam" ? 3 : 2,
      maxDepthMm: interactionMap.maxDepthMm,
      beamVisualDepthMm: opticsProfile.beamVisualDepthMm,
      penetrationDepthMm: opticsProfile.penetrationDepthMm,
      irradianceMwCm2: irradiance,
      spotSizeCm2: spotSize,
    });
  }, [
    interactionMap,
    fieldMode,
    wavelength,
    irradiance,
    spotSize,
    skinMelaninIndex,
    opticsProfile.beamVisualDepthMm,
    opticsProfile.penetrationDepthMm,
  ]);

  useEffect(() => {
    return () => {
      fieldTexture?.dispose();
    };
  }, [fieldTexture]);

  const handleTransducerRightDragStart = (clientX: number, clientY: number) => {
    dragRef.current = { x: clientX, y: clientY, t: performance.now(), button: 2 };
    setPointerDragging(true);
  };

  const handleTransducerRightDragMove = (clientX: number, clientY: number) => {
    const prev = dragRef.current;
    if (!prev || prev.button !== 2) return;
    const now = performance.now();
    const dx = clientX - prev.x;
    const dy = clientY - prev.y;
    const dt = Math.max(1, now - prev.t);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const pxPerMs = distance / dt;
    const speedFactor = clamp(pxPerMs * 6, 0.2, 5);
    setDraggingSpeed(speedFactor);
    setTransducerAngle(transducerAngle + dx * 0.25);
    dragRef.current = { x: clientX, y: clientY, t: now, button: 2 };
  };

  const handleTransducerLeftDragStart = (clientX: number, clientY: number) => {
    dragRef.current = { x: clientX, y: clientY, t: performance.now(), button: 0 };
    setPointerDragging(true);
  };

  const handleTransducerLeftDragMove = (clientX: number, clientY: number) => {
    const prev = dragRef.current;
    if (!prev || prev.button !== 0) return;
    const now = performance.now();
    const dx = clientX - prev.x;
    const dy = clientY - prev.y;
    const dt = Math.max(1, now - prev.t);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const pxPerMs = distance / dt;
    const speedFactor = clamp(pxPerMs * 6, 0.2, 5);
    setDraggingSpeed(speedFactor);
    setTransducerX(transducerX + dx * 0.01);
    dragRef.current = { x: clientX, y: clientY, t: now, button: 0 };
  };

  const handleTransducerRightDragEnd = () => {
    dragRef.current = null;
    setPointerDragging(false);
    if (!isDragging) {
      setDraggingSpeed(1);
    }
  };

  return (
    <div
      className={cn(
        "relative h-full w-full",
        embedded ? "min-h-0" : "rounded-xl border bg-card p-3",
      )}
    >
      {visualConfig.showTranslucentToggle && (
        <label
          className={cn(
            "absolute z-20 flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-100 shadow-lg touch-manipulation",
            isMobile
              ? "right-3 bottom-[5.5rem] pb-[max(0px,env(safe-area-inset-bottom))]"
              : "right-3 bottom-4 pb-[max(0px,env(safe-area-inset-bottom))]",
          )}
        >
          <Switch
            checked={translucentView}
            onCheckedChange={setTranslucentView}
            aria-label="Alternar visão translúcida dos tecidos"
          />
          <span className={isMobile ? "text-[11px]" : "text-xs"}>
            {effectiveTranslucent ? "Translúcido" : "Opaco"}
          </span>
        </label>
      )}

      <div
        className={cn(
          "absolute left-1/2 z-10 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2",
          isMobile
            ? "bottom-3 pb-[max(0px,env(safe-area-inset-bottom))]"
            : "top-3",
        )}
      >
        <PhotobioModeDock compact={!isMobile} />
      </div>

      {fieldMode && viewerTab !== "penetration" && viewerTab !== "bioresponse" && (
        <PhotobioOpticalLegend
          mode={fieldMode}
          wavelength={wavelength}
          interactionMap={interactionMap}
          penetrationDepthMm={opticsProfile.penetrationDepthMm}
          beamVisualDepthMm={opticsProfile.beamVisualDepthMm}
          compact={isMobile}
        />
      )}

      {viewerTab === "bioresponse" && (
        <PhotobioBioresponseHud effectiveFluence={effectiveFluence} />
      )}

      {visualConfig.showDepthProfile && (
        <PhotobioDepthProfilePanel
          opticsProfile={opticsProfile}
          wavelength={wavelength}
          interactionMap={interactionMap}
        />
      )}

      {visualConfig.showSceneWarnings && (
        <PhotobioSceneWarnings
          transducerAngle={transducerAngle}
          contactPressure={contactPressure}
          irradiance={irradiance}
          thermalRiskIndex={opticsProfile.thermalRiskIndex ?? clamp(irradiance / 500, 0, 1)}
          coupling={opticsProfile.contactTransmission ?? 0.95}
          viewerTab={viewerTab}
          minimal={isMobile}
        />
      )}

      <div className={cn("h-full w-full overflow-hidden bg-[#0f0f12]", !embedded && "rounded-lg")}>
        <LabCanvasSurface onContextMenu={(e) => e.preventDefault()}>
          <PerspectiveCamera makeDefault position={[0, 1.25, 8.6]} fov={42} />
          <PhotobioTissueScene
            wavelength={wavelength}
            irradiance={irradiance}
            mode={mode}
            dutyCycle={dutyCycle}
            bioActive={bioActive}
            translucentView={translucentView}
            layerConfig={layerConfig}
            opticsProfile={opticsProfile}
            transducerAngle={transducerAngle}
            transducerX={transducerX}
            contactPressure={contactPressure}
            isDragging={isDragging}
            scanActive={pointerDragging}
            draggingSpeed={draggingSpeed}
            effectiveFluence={effectiveFluence}
            displayDoseMap={displayDoseMap}
            spotSize={spotSize}
            power={power}
            applicatorType={applicatorType}
            visualQualityTier={visualQualityTier}
            interactionMap={interactionMap}
            viewerTab={viewerTab}
            visualConfig={visualConfig}
            effectiveTranslucent={effectiveTranslucent}
            onAccumulateDose={accumulateDoseAt}
            onTransducerRightDragStart={handleTransducerRightDragStart}
            onTransducerRightDragMove={handleTransducerRightDragMove}
            onTransducerLeftDragStart={handleTransducerLeftDragStart}
            onTransducerLeftDragMove={handleTransducerLeftDragMove}
            onTransducerRightDragEnd={handleTransducerRightDragEnd}
            skinTone={skinTone}
            fieldTexture={fieldTexture}
            stackSeed={tissueStackSeed}
            simplifiedFieldOverlay={isAndroidNative}
          />
          <OrbitControls
            makeDefault
            enablePan={false}
            minDistance={6.5}
            maxDistance={11.5}
            maxPolarAngle={Math.PI * 0.6}
            enableDamping={!isAndroidNative}
          />
        </LabCanvasSurface>
      </div>
    </div>
  );
}

/** Compatibilidade com imports legados */
export { PhotobioTissueViewer as TissueViewer };
