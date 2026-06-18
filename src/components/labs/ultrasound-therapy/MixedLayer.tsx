/**
 * MixedLayer — plano músculo|osso com geometria orgânica (encaixe no STACK)
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshStandardMaterial, type Texture } from "three";
import type { ClinicalSkinTone } from "@/lib/clinicalSkinTones";
import { createClinicalTissueTextureSet } from "@/lib/clinicalTissueTextures";
import {
  buildOrganicLayerGeometry,
  tissueBoundarySeed,
  type OrganicLayerKind,
} from "@/lib/clinicalTissueGeometry";
import { getOrganicLayerSegments } from "@/lib/ultrasoundVisualQuality";
import { TOTAL_BLOCK_DEPTH } from "@/lib/ultrasoundTherapyStack";
import {
  setTissueHeatBeamCenter,
  setTissueHeatPulse,
} from "@/lib/tissueHeatBlendMaterial";
import { therapyBeamWorldRef } from "@/lib/therapyRuntimeRefs";
import { TissueOpaqueMaterial } from "./TissueLayers";

const TISSUE_HALF_W = 10;
const TISSUE_DEPTH = 8;

interface MixedLayerProps {
  depth: number;
  /** 0–100% (0 = all muscle, 100 = all bone) */
  division: number;
  thickness: number;
  skinTone?: ClinicalSkinTone;
  muscleLesionIndex?: number;
  boneReflectionIndex?: number;
  physiologyTint?: { skin?: number; muscle?: number };
  thermalHeatMap?: Texture;
  thermalStackDepth?: number;
  thermalIntensity?: number;
  thermalBeamCenterX?: number;
  thermalBeamCenterZ?: number;
  acousticFaceRadiusCm?: number;
  planarAcousticClip?: boolean;
  overlayMode?: "thermal" | "acoustic" | "interaction";
}

export function MixedLayer({
  depth,
  division,
  thickness,
  skinTone,
  muscleLesionIndex = 0,
  boneReflectionIndex = 0,
  physiologyTint,
  thermalHeatMap,
  thermalStackDepth = TOTAL_BLOCK_DEPTH,
  thermalIntensity = 1,
  thermalBeamCenterX = 0,
  thermalBeamCenterZ = 0,
  acousticFaceRadiusCm = 1.2,
  planarAcousticClip = false,
  overlayMode = "thermal",
}: MixedLayerProps) {
  const yPos = -depth - thickness / 2;
  const tissueWidth = TISSUE_HALF_W * 2;
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

  const boundaryX = useMemo(
    () => (division / 100) * tissueWidth - TISSUE_HALF_W,
    [division, tissueWidth],
  );

  const muscleWidth = boundaryX + TISSUE_HALF_W;
  const boneWidth = TISSUE_HALF_W - boundaryX;
  const muscleX = (boundaryX - TISSUE_HALF_W) / 2;
  const boneX = (boundaryX + TISSUE_HALF_W) / 2;

  const stackSeed = useMemo(() => Math.floor(depth * 1000 + division * 17), [depth, division]);
  const segments = useMemo(() => getOrganicLayerSegments(), []);
  const mixedIndex = 90;

  const textures = useMemo(
    () =>
      createClinicalTissueTextureSet({
        skinTone,
        lesionIndex: muscleLesionIndex,
        reflectionIndex: boneReflectionIndex,
      }),
    [skinTone, muscleLesionIndex, boneReflectionIndex],
  );

  const muscleGeometry = useMemo(
    () =>
      muscleWidth > 0.15
        ? buildOrganicLayerGeometry({
            width: muscleWidth,
            height: thickness,
            depth: TISSUE_DEPTH,
            boundarySeedTop: tissueBoundarySeed(stackSeed, mixedIndex),
            boundarySeedBottom: tissueBoundarySeed(stackSeed, mixedIndex + 1),
            kind: "muscle" as OrganicLayerKind,
            segments,
          })
        : null,
    [muscleWidth, thickness, stackSeed, segments],
  );

  const boneGeometry = useMemo(
    () =>
      boneWidth > 0.15
        ? buildOrganicLayerGeometry({
            width: boneWidth,
            height: thickness,
            depth: TISSUE_DEPTH,
            boundarySeedTop: tissueBoundarySeed(stackSeed, mixedIndex + 1),
            boundarySeedBottom: tissueBoundarySeed(stackSeed, mixedIndex + 2),
            kind: "bone" as OrganicLayerKind,
            segments,
          })
        : null,
    [boneWidth, thickness, stackSeed, segments],
  );

  const interfaceGlow = Math.min(1, boneReflectionIndex * 1.4 + 0.12);
  const layerTopY = yPos + thickness / 2;
  const layerBottomY = yPos - thickness / 2;

  return (
    <group>
      {muscleGeometry && (
        <mesh geometry={muscleGeometry} position={[muscleX, yPos, 0]} renderOrder={1}>
          <TissueOpaqueMaterial
            type="muscle"
            textures={textures}
            physiologyTint={physiologyTint?.muscle ?? 0}
            thermalHeatMap={thermalHeatMap}
            thermalStackDepth={thermalStackDepth}
            thermalIntensity={thermalIntensity}
            thermalBeamCenterX={thermalBeamCenterX}
            thermalBeamCenterZ={thermalBeamCenterZ}
            acousticFaceRadiusCm={acousticFaceRadiusCm}
            planarAcousticClip={planarAcousticClip}
            overlayMode={overlayMode}
            onHeatMaterial={registerHeatMaterial}
            thermalClipXMin={-TISSUE_HALF_W - 0.5}
            thermalClipXMax={TISSUE_HALF_W + 0.5}
            layerTopY={layerTopY}
            layerBottomY={layerBottomY}
          />
        </mesh>
      )}

      {boneGeometry && (
        <mesh geometry={boneGeometry} position={[boneX, yPos, 0]} renderOrder={0}>
          <TissueOpaqueMaterial
            type="bone"
            textures={textures}
            reflectionIndex={boneReflectionIndex}
            thermalHeatMap={thermalHeatMap}
            thermalStackDepth={thermalStackDepth}
            thermalIntensity={thermalIntensity}
            thermalBeamCenterX={thermalBeamCenterX}
            thermalBeamCenterZ={thermalBeamCenterZ}
            acousticFaceRadiusCm={acousticFaceRadiusCm}
            planarAcousticClip={planarAcousticClip}
            overlayMode={overlayMode}
            thermalClipXMin={boundaryX - 0.08}
            thermalClipXMax={TISSUE_HALF_W + 0.5}
            layerTopY={layerTopY}
            layerBottomY={layerBottomY}
          />
        </mesh>
      )}

      {/* Reflexão na interface de impedância (vertical) */}
      {muscleWidth > 0.15 && boneWidth > 0.15 && interfaceGlow > 0.08 && (
        <mesh position={[boundaryX, yPos, 0.04]} renderOrder={3}>
          <planeGeometry args={[0.04, thickness * 1.05, 1, 4]} />
          <meshStandardMaterial
            color="#fde68a"
            emissive="#f59e0b"
            emissiveIntensity={interfaceGlow * 0.85}
            transparent
            opacity={0.35 + interfaceGlow * 0.35}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
