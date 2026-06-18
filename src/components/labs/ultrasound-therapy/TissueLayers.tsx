/**
 * TissueLayers — volume anatômico opaco com texturas procedurais (aspecto de carne/tecido real)
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { MeshStandardMaterial, type Texture } from "three";
import { AnatomicalScenario } from "@/types/ultrasoundTherapyConfig";
import { buildStackLayers, TOTAL_BLOCK_DEPTH } from "@/lib/ultrasoundTherapyStack";
import type { ClinicalSkinTone } from "@/lib/clinicalSkinTones";
import {
  clinicalTissueMaterialProps,
  createClinicalTissueTextureSet,
} from "@/lib/clinicalTissueTextures";
import {
  buildOrganicLayerGeometry,
  createTissueStackSeed,
  tissueBoundarySeed,
  type OrganicLayerKind,
} from "@/lib/clinicalTissueGeometry";
import { getOrganicLayerSegments, shouldEnableRealTimeShadows } from "@/lib/ultrasoundVisualQuality";
import {
  getPerfusionVisualProfile,
  type TissuePerfusionProfile,
} from "@/types/ultrasoundTherapyConfig";
import {
  createTissueHeatBlendMaterial,
  setTissueHeatBeamCenter,
  setTissueHeatMap,
  setTissueHeatPulse,
} from "@/lib/tissueHeatBlendMaterial";
import { THERMAL_BEAM_HALF_WIDTH_CM } from "@/lib/thermalFieldTexture";
import { therapyBeamWorldRef } from "@/lib/therapyRuntimeRefs";

const CAST_SHADOWS = shouldEnableRealTimeShadows();

type TissueType = "skin" | "fat" | "muscle" | "bone";

const HEAT_STRENGTH: Record<TissueType, number> = {
  skin: 0.52,
  fat: 0.18,
  muscle: 1,
  bone: 0,
};

const INTERACTION_STRENGTH: Record<TissueType, number> = {
  skin: 0.5,
  fat: 0.7,
  muscle: 1,
  bone: 0.55,
};

const ACOUSTIC_STRENGTH: Record<TissueType, number> = {
  skin: 0,
  fat: 0.48,
  muscle: 1,
  bone: 0,
};

const HEAT_OVERLAY_POLYGON_OFFSET: Record<TissueType, { factor: number; units: number }> = {
  bone: { factor: 0, units: 0 },
  muscle: { factor: -4, units: -3 },
  fat: { factor: -3, units: -2 },
  skin: { factor: -2, units: -1 },
};

interface TissueMaterialProps {
  type: TissueType;
  textures: ReturnType<typeof createClinicalTissueTextureSet>;
  thermalHeatMap?: Texture;
  thermalStackDepth?: number;
  thermalIntensity?: number;
  thermalBeamCenterX?: number;
  thermalBeamCenterZ?: number;
  acousticFaceRadiusCm?: number;
  planarAcousticClip?: boolean;
  overlayMode?: "thermal" | "acoustic" | "interaction";
  onHeatMaterial?: (material: MeshStandardMaterial) => () => void;
  /** Profundidade fixa para amostra do mapa (camada mista horizontal) */
  thermalSampleDepthCm?: number;
  /** Recorte lateral do overlay (cm, world X) */
  thermalClipXMin?: number;
  thermalClipXMax?: number;
  layerTopY?: number;
  layerBottomY?: number;
  /** Escala do overlay feixe/calor (osso ≈ 0) */
  overlayStrengthScale?: number;
}

export function TissueOpaqueMaterial({
  type,
  textures,
  physiologyTint = 0,
  hyperemiaIndex = 0,
  reflectionIndex = 0,
  thermalHeatMap,
  thermalStackDepth = TOTAL_BLOCK_DEPTH,
  thermalIntensity = 1,
  thermalBeamCenterX = 0,
  thermalBeamCenterZ = 0,
  acousticFaceRadiusCm = 1.2,
  planarAcousticClip = false,
  overlayMode = "thermal",
  onHeatMaterial,
  thermalSampleDepthCm = 0,
  thermalClipXMin = -100,
  thermalClipXMax = 100,
  layerTopY,
  layerBottomY,
  overlayStrengthScale = 1,
}: TissueMaterialProps & {
  physiologyTint?: number;
  hyperemiaIndex?: number;
  reflectionIndex?: number;
}) {
  const surfaceKind = type === "skin" ? "skin" : type;
  const maps =
    type === "skin"
      ? textures.skin
      : type === "fat"
        ? textures.fat
        : type === "muscle"
          ? textures.muscle
          : textures.bone;

  const props = clinicalTissueMaterialProps(surfaceKind, maps, {
    hyperemiaIndex: type === "skin" ? hyperemiaIndex : 0,
    reflectionIndex: type === "bone" ? reflectionIndex : 0,
  });

  let emissive = props.emissive;
  let emissiveIntensity = props.emissiveIntensity ?? 0;

  if (physiologyTint > 0.02) {
    const tintColor = type === "skin" ? "#fb7185" : type === "muscle" ? "#ea580c" : "#f97316";
    emissive = tintColor;
    emissiveIntensity = Math.max(emissiveIntensity, physiologyTint * 0.32);
  }

  const heatStrength = thermalHeatMap
    ? (overlayMode === "acoustic"
        ? ACOUSTIC_STRENGTH[type]
        : overlayMode === "interaction"
          ? INTERACTION_STRENGTH[type]
          : HEAT_STRENGTH[type]) * overlayStrengthScale
    : 0;

  const intensityScale =
    overlayMode === "acoustic"
      ? 0.82 + Math.min(2.2, thermalIntensity / 1.1)
      : overlayMode === "interaction"
        ? 0.95 + Math.min(0.55, thermalIntensity / 6)
        : 0.45 + Math.min(1.35, thermalIntensity / 2.2);
  const stableIntensityScale = Math.round(intensityScale * 40) / 40;

  const hasHeatOverlay = Boolean(thermalHeatMap && heatStrength > 0);

  const polygonOffset = hasHeatOverlay
    ? HEAT_OVERLAY_POLYGON_OFFSET[type]
    : { factor: 1, units: 1 };

  const heatMaterialKey = useMemo(
    () =>
      [
        type,
        overlayMode,
        hasHeatOverlay,
        heatStrength,
        stableIntensityScale,
        thermalStackDepth,
        acousticFaceRadiusCm,
        planarAcousticClip,
        thermalSampleDepthCm,
        thermalClipXMin,
        thermalClipXMax,
        overlayStrengthScale,
        layerTopY?.toFixed(3) ?? "na",
        layerBottomY?.toFixed(3) ?? "na",
        polygonOffset.factor,
        polygonOffset.units,
      ].join("|"),
    [
      type,
      overlayMode,
      hasHeatOverlay,
      heatStrength,
      stableIntensityScale,
      thermalStackDepth,
      acousticFaceRadiusCm,
      planarAcousticClip,
      thermalSampleDepthCm,
      thermalClipXMin,
      thermalClipXMax,
      overlayStrengthScale,
      layerTopY,
      layerBottomY,
      polygonOffset.factor,
      polygonOffset.units,
    ],
  );

  const material = useMemo(() => {
    const mat = new MeshStandardMaterial({
      ...props,
      emissive: emissive || props.emissive,
      emissiveIntensity: emissiveIntensity || props.emissiveIntensity,
      polygonOffset: true,
      polygonOffsetFactor: polygonOffset.factor,
      polygonOffsetUnits: polygonOffset.units,
    });

    if (hasHeatOverlay && thermalHeatMap) {
      createTissueHeatBlendMaterial(mat, {
        heatMap: thermalHeatMap,
        stackDepth: thermalStackDepth,
        heatStrength,
        intensityScale: stableIntensityScale,
        beamCenterX: thermalBeamCenterX,
        beamCenterZ: thermalBeamCenterZ,
        beamHalfWidthCm: THERMAL_BEAM_HALF_WIDTH_CM,
        faceRadiusCm: acousticFaceRadiusCm,
        blendMode: overlayMode,
        planarAcousticClip: overlayMode === "acoustic" && planarAcousticClip,
        sampleDepthCm: thermalSampleDepthCm,
        clipXMin: thermalClipXMin,
        clipXMax: thermalClipXMax,
        layerTopY,
        layerBottomY,
      });
    }

    return mat;
  }, [heatMaterialKey, thermalHeatMap]);

  useLayoutEffect(() => {
    material.map = props.map ?? null;
    material.bumpMap = props.bumpMap ?? null;
    material.roughness = props.roughness ?? material.roughness;
    material.metalness = props.metalness ?? material.metalness;
    if (emissive) {
      material.emissive.set(emissive);
    }
    material.emissiveIntensity = emissiveIntensity;
  }, [material, props.map, props.bumpMap, props.roughness, props.metalness, emissive, emissiveIntensity]);

  useLayoutEffect(() => {
    if (!thermalHeatMap || heatStrength <= 0) return;
    if (material.userData.heatShader) {
      setTissueHeatMap(material, thermalHeatMap);
      setTissueHeatBeamCenter(material, therapyBeamWorldRef.x, therapyBeamWorldRef.z);
      return;
    }
    createTissueHeatBlendMaterial(material, {
      heatMap: thermalHeatMap,
      stackDepth: thermalStackDepth,
      heatStrength,
      intensityScale: stableIntensityScale,
      beamCenterX: thermalBeamCenterX,
      beamCenterZ: thermalBeamCenterZ,
      beamHalfWidthCm: THERMAL_BEAM_HALF_WIDTH_CM,
      faceRadiusCm: acousticFaceRadiusCm,
      blendMode: overlayMode,
      planarAcousticClip: overlayMode === "acoustic" && planarAcousticClip,
      sampleDepthCm: thermalSampleDepthCm,
      clipXMin: thermalClipXMin,
      clipXMax: thermalClipXMax,
      layerTopY,
      layerBottomY,
    });
  }, [
    material,
    thermalHeatMap,
    heatStrength,
    thermalStackDepth,
    stableIntensityScale,
    acousticFaceRadiusCm,
    overlayMode,
    planarAcousticClip,
    thermalSampleDepthCm,
    thermalClipXMin,
    thermalClipXMax,
    layerTopY,
    layerBottomY,
  ]);

  useEffect(() => {
    if (!thermalHeatMap || heatStrength <= 0 || !onHeatMaterial) return undefined;
    return onHeatMaterial(material);
  }, [material, thermalHeatMap, heatStrength, onHeatMaterial]);

  const materialRef = useRef(material);
  useEffect(() => {
    const prev = materialRef.current;
    materialRef.current = material;
    if (prev !== material) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => prev.dispose());
      });
    }
  }, [material]);

  useEffect(
    () => () => {
      materialRef.current.dispose();
    },
    [],
  );

  return <primitive object={material} attach="material" />;
}

const RENDER_ORDER: Record<TissueType, number> = {
  bone: 0,
  muscle: 1,
  fat: 2,
  skin: 3,
};

interface OrganicTissueLayerProps {
  layerIndex: number;
  type: TissueType;
  yPos: number;
  height: number;
  kind: OrganicLayerKind;
  stackSeed: number;
  segments: [number, number, number];
  textures: ReturnType<typeof createClinicalTissueTextureSet>;
  baselineSkinFlush: number;
  physiologyTint?: { skin?: number; muscle?: number };
  thermalTint?: { skin?: number; muscle?: number };
  thermalHeatMap?: Texture;
  thermalStackDepth: number;
  thermalIntensity: number;
  thermalBeamCenterX: number;
  thermalBeamCenterZ: number;
  acousticFaceRadiusCm: number;
  planarAcousticClip: boolean;
  overlayMode: "thermal" | "acoustic" | "interaction";
  onHeatMaterial?: (material: MeshStandardMaterial) => () => void;
  boneReflectionIndex: number;
  isHighlighted: boolean;
  showLabel?: boolean;
}

function OrganicTissueLayer({
  layerIndex,
  type,
  yPos,
  height,
  kind,
  stackSeed,
  segments,
  textures,
  baselineSkinFlush,
  physiologyTint,
  thermalTint,
  thermalHeatMap,
  thermalStackDepth,
  thermalIntensity,
  thermalBeamCenterX,
  thermalBeamCenterZ,
  acousticFaceRadiusCm,
  planarAcousticClip,
  overlayMode,
  onHeatMaterial,
  boneReflectionIndex,
  isHighlighted,
  showLabel = false,
}: OrganicTissueLayerProps) {
  const geometry = useMemo(
    () =>
      buildOrganicLayerGeometry({
        width: 20,
        height,
        depth: 8,
        boundarySeedTop: tissueBoundarySeed(stackSeed, layerIndex),
        boundarySeedBottom: tissueBoundarySeed(stackSeed, layerIndex + 1),
        kind,
        topAmplitudeScale: layerIndex === 0 ? 0.012 : undefined,
        segments,
      }),
    [height, kind, layerIndex, segments, stackSeed],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      <mesh
        geometry={geometry}
        position={[0, yPos, 0]}
        renderOrder={RENDER_ORDER[type]}
        castShadow={CAST_SHADOWS}
        receiveShadow={CAST_SHADOWS}
      >
        <TissueOpaqueMaterial
          type={type}
          textures={textures}
          hyperemiaIndex={
            type === "skin" ? Math.min(1, (physiologyTint?.skin ?? 0) + baselineSkinFlush) : 0
          }
          reflectionIndex={type === "bone" ? boneReflectionIndex : 0}
          physiologyTint={
            type === "skin"
              ? Math.max(physiologyTint?.skin ?? 0, thermalTint?.skin ?? 0)
              : type === "muscle"
                ? Math.max(physiologyTint?.muscle ?? 0, thermalTint?.muscle ?? 0)
                : 0
          }
          thermalHeatMap={thermalHeatMap}
          thermalStackDepth={thermalStackDepth}
          thermalIntensity={thermalIntensity}
          thermalBeamCenterX={thermalBeamCenterX}
          thermalBeamCenterZ={thermalBeamCenterZ}
          acousticFaceRadiusCm={acousticFaceRadiusCm}
          planarAcousticClip={planarAcousticClip}
          overlayMode={overlayMode}
          onHeatMaterial={thermalHeatMap ? onHeatMaterial : undefined}
          layerTopY={yPos + height / 2}
          layerBottomY={yPos - height / 2}
        />
      </mesh>

      {isHighlighted && (
        <mesh position={[0, yPos, 0.06]} renderOrder={RENDER_ORDER[type] + 4}>
          <boxGeometry args={[20.2, height * 1.02, 8.2]} />
          <meshBasicMaterial
            color="#22d3ee"
            transparent
            opacity={0.12}
            depthWrite={false}
            wireframe
          />
        </mesh>
      )}

      {showLabel && (
        <Text position={[10.5, yPos, 0]} fontSize={0.3} color="#f1f5f9" anchorX="left">
          {type === "skin"
            ? "Pele"
            : type === "fat"
              ? "Gordura"
              : type === "muscle"
                ? "Músculo"
                : "Osso"}
        </Text>
      )}
    </group>
  );
}

interface TissueLayersProps {
  scenario: AnatomicalScenario;
  showLabels?: boolean;
  skinTone?: ClinicalSkinTone;
  customThicknesses?: {
    skin: number;
    fat: number;
    muscle: number;
    boneDepth?: number;
  };
  stopAtDepth?: number;
  physiologyTint?: {
    skin?: number;
    muscle?: number;
  };
  thermalTint?: {
    skin?: number;
    muscle?: number;
  };
  /** Mapa térmico suave — integra calor na textura do tecido */
  thermalHeatMap?: Texture;
  thermalStackDepth?: number;
  thermalIntensity?: number;
  thermalBeamCenterX?: number;
  thermalBeamCenterZ?: number;
  acousticFaceRadiusCm?: number;
  planarAcousticClip?: boolean;
  overlayMode?: "thermal" | "acoustic" | "interaction";
  highlightLayer?: "skin" | "fat" | "muscle" | "bone" | null;
  muscleLesionIndex?: number;
  boneReflectionIndex?: number;
  perfusionProfile?: TissuePerfusionProfile;
}

export function TissueLayers({
  scenario,
  showLabels = false,
  skinTone,
  customThicknesses,
  stopAtDepth,
  physiologyTint,
  thermalTint,
  thermalHeatMap,
  thermalStackDepth = TOTAL_BLOCK_DEPTH,
  thermalIntensity = 1,
  thermalBeamCenterX = 0,
  thermalBeamCenterZ = 0,
  acousticFaceRadiusCm = 1.2,
  planarAcousticClip = false,
  overlayMode = "thermal",
  highlightLayer,
  muscleLesionIndex = 0,
  boneReflectionIndex = 0,
  perfusionProfile = "normal",
}: TissueLayersProps) {
  const heatMaterialsRef = useRef<MeshStandardMaterial[]>([]);

  const registerHeatMaterial = useMemo(
    () => (material: MeshStandardMaterial) => {
      heatMaterialsRef.current.push(material);
      return () => {
        heatMaterialsRef.current = heatMaterialsRef.current.filter((m) => m !== material);
      };
    },
    [],
  );

  useFrame(() => {
    if (!thermalHeatMap || heatMaterialsRef.current.length === 0) return;
    const beamX = therapyBeamWorldRef.x;
    const beamZ = therapyBeamWorldRef.z;
    if (overlayMode === "acoustic" || overlayMode === "interaction" || overlayMode === "thermal") {
      for (const mat of heatMaterialsRef.current) {
        setTissueHeatPulse(mat, 1);
        setTissueHeatBeamCenter(mat, beamX, beamZ);
      }
      return;
    }
  });

  const perfusionVisual = useMemo(
    () => getPerfusionVisualProfile(perfusionProfile),
    [perfusionProfile],
  );
  const baselineSkinFlush = perfusionVisual.skinFlush * 0.15;
  const segments = useMemo(() => getOrganicLayerSegments(), []);

  const bakedLesionIndex = Math.round(muscleLesionIndex * 5) / 5;
  const bakedReflectionIndex = Math.round(boneReflectionIndex * 5) / 5;
  const bakedHyperemia = Math.round(((physiologyTint?.skin ?? 0) + baselineSkinFlush) * 5) / 5;

  const textures = useMemo(
    () =>
      createClinicalTissueTextureSet({
        skinTone,
        lesionIndex: bakedLesionIndex,
        hyperemiaIndex: Math.min(1, bakedHyperemia),
        reflectionIndex: bakedReflectionIndex,
      }),
    [skinTone, bakedLesionIndex, bakedHyperemia, bakedReflectionIndex],
  );

  const stackSeed = useMemo(() => createTissueStackSeed(), []);

  const layers = useMemo(() => {
    return buildStackLayers(scenario, customThicknesses).map((layer) => ({
      type: layer.type as TissueType,
      startDepth: layer.depth,
      endDepth: layer.depth + layer.thickness,
      thickness: layer.thickness,
    }));
  }, [scenario, customThicknesses]);

  return (
    <>
      {layers.map((layer, i) => {
        if (stopAtDepth !== undefined && layer.startDepth >= stopAtDepth) {
          return null;
        }

        const effectiveEndDepth =
          stopAtDepth !== undefined
            ? Math.min(layer.endDepth, stopAtDepth)
            : layer.endDepth;
        const effectiveThickness = effectiveEndDepth - layer.startDepth;
        if (effectiveThickness <= 0.01) {
          return null;
        }

        const centerDepth = (layer.startDepth + effectiveEndDepth) / 2;
        const yPos = -centerDepth;
        const height = effectiveThickness;
        const kind = layer.type as OrganicLayerKind;

        return (
          <OrganicTissueLayer
            key={`${layer.type}-${i}`}
            layerIndex={i}
            type={layer.type}
            yPos={yPos}
            height={height}
            kind={kind}
            stackSeed={stackSeed}
            segments={segments}
            textures={textures}
            baselineSkinFlush={baselineSkinFlush}
            physiologyTint={physiologyTint}
            thermalTint={thermalTint}
            thermalHeatMap={thermalHeatMap}
            thermalStackDepth={thermalStackDepth}
            thermalIntensity={thermalIntensity}
            thermalBeamCenterX={thermalBeamCenterX}
            thermalBeamCenterZ={thermalBeamCenterZ}
            acousticFaceRadiusCm={acousticFaceRadiusCm}
            planarAcousticClip={planarAcousticClip}
            overlayMode={overlayMode}
            onHeatMaterial={registerHeatMaterial}
            boneReflectionIndex={boneReflectionIndex}
            isHighlighted={highlightLayer === layer.type}
            showLabel={showLabels}
          />
        );
      })}
    </>
  );
}
