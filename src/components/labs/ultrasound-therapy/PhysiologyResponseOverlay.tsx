/**
 * Overlay educacional de resposta fisiológica sobre os tecidos.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, Mesh, MeshBasicMaterial } from "three";
import { buildStackLayers, getBoneStartDepth } from "@/lib/ultrasoundTherapyStack";
import type { UltrasoundPhysiologyResponse } from "@/lib/ultrasoundPhysiologyResponse";
import type { AnatomicalScenario } from "@/types/ultrasoundTherapyConfig";
import type { UltrasoundTherapyResult } from "@/simulation/ultrasoundTherapyEngine";

interface PhysiologyResponseOverlayProps {
  physiology: UltrasoundPhysiologyResponse;
  result: UltrasoundTherapyResult;
  scenario: AnatomicalScenario;
  customThicknesses?: {
    skin: number;
    fat: number;
    muscle: number;
    boneDepth?: number;
  };
  era?: number;
  position?: { x: number; y: number };
}

const SKIN_Y = 0;

export function PhysiologyResponseOverlay({
  physiology,
  result,
  scenario,
  customThicknesses,
  era = 5,
  position = { x: 0, y: 0 },
}: PhysiologyResponseOverlayProps) {
  const edemaRef = useRef<Mesh>(null);
  const hyperemiaRef = useRef<Mesh>(null);

  const xOffset = position.x * 8;
  const zOffset = position.y * 3;
  const faceRadius = Math.sqrt(era / Math.PI);

  const layers = useMemo(
    () => buildStackLayers(scenario, customThicknesses),
    [scenario, customThicknesses],
  );

  const muscleLayer = layers.find((l) => l.type === "muscle");
  const boneDepth = getBoneStartDepth(scenario, customThicknesses);

  const muscleCenterY = muscleLayer
    ? -(muscleLayer.depth + muscleLayer.thickness / 2)
    : -2;
  const boneY = boneDepth != null ? -boneDepth : null;

  const hasVisibleEffect =
    physiology.hyperemiaIndex > 0.05 ||
    physiology.edemaIndex > 0.05 ||
    physiology.muscleThermalStressIndex > 0.08 ||
    physiology.periostealPainIndex > 0.08 ||
    physiology.ablationIndex > 0.08 ||
    physiology.collagenDenaturationIndex > 0.08;

  useFrame(({ clock }) => {
    const pulse = 0.88 + Math.sin(clock.getElapsedTime() * 2) * 0.12;
    if (hyperemiaRef.current?.material && !Array.isArray(hyperemiaRef.current.material)) {
      const mat = hyperemiaRef.current.material as MeshBasicMaterial;
      mat.opacity = physiology.hyperemiaIndex * 0.42 * pulse;
    }
    if (edemaRef.current?.material && !Array.isArray(edemaRef.current.material)) {
      const mat = edemaRef.current.material as MeshBasicMaterial;
      mat.opacity = physiology.edemaIndex * 0.28 * pulse;
    }
  });

  if (!hasVisibleEffect) return null;

  const hotspotY = SKIN_Y - result.maxTempDepth;
  const ablationSize = faceRadius * (0.35 + physiology.ablationIndex * 0.55);

  return (
    <group position={[xOffset, 0, zOffset]} renderOrder={12}>
      {/* Hiperemia superficial — vermelho/rosa na pele */}
      {physiology.hyperemiaIndex > 0.06 && (
        <mesh
          ref={hyperemiaRef}
          position={[0, SKIN_Y - 0.04, 0.02]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={13}
        >
          <circleGeometry args={[faceRadius * 1.08, 48]} />
          <meshBasicMaterial
            color="#fb7185"
            transparent
            opacity={physiology.hyperemiaIndex * 0.4}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      )}

      {/* Edema — brilho volumétrico leve */}
      {physiology.edemaIndex > 0.06 && (
        <mesh ref={edemaRef} position={[0, SKIN_Y - 0.12, 0]} renderOrder={12}>
          <sphereGeometry args={[faceRadius * 0.95, 16, 12]} />
          <meshBasicMaterial
            color="#fecdd3"
            transparent
            opacity={physiology.edemaIndex * 0.22}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Dano muscular — manchas laranja/vermelhas */}
      {physiology.muscleThermalStressIndex > 0.1 && muscleLayer && (
        <>
          <mesh position={[0, muscleCenterY, 0.05]} renderOrder={11}>
            <boxGeometry args={[faceRadius * 1.6, muscleLayer.thickness * 0.85, 0.08]} />
            <meshBasicMaterial
              color="#ea580c"
              transparent
              opacity={physiology.muscleThermalStressIndex * 0.35}
              depthWrite={false}
            />
          </mesh>
          {(physiology.collagenDenaturationIndex > 0.12 ||
            physiology.coagulationIndex > 0.1) && (
            <mesh position={[0, muscleCenterY, 0.08]} renderOrder={11}>
              <boxGeometry args={[faceRadius * 1.1, muscleLayer.thickness * 0.5, 0.06]} />
              <meshBasicMaterial
                color="#dc2626"
                transparent
                opacity={
                  Math.max(physiology.collagenDenaturationIndex, physiology.coagulationIndex) * 0.4
                }
                depthWrite={false}
              />
            </mesh>
          )}
        </>
      )}

      {/* Risco periosteal — halo vermelho no osso */}
      {physiology.periostealPainIndex > 0.08 && boneY != null && (
        <mesh position={[0, boneY, 0.06]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={14}>
          <ringGeometry args={[faceRadius * 0.5, faceRadius * 1.35, 48]} />
          <meshBasicMaterial
            color="#ef4444"
            transparent
            opacity={physiology.periostealPainIndex * 0.45}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      )}

      {/* Ablação educacional — núcleo no hotspot */}
      {physiology.ablationIndex > 0.1 && (
        <group position={[0, hotspotY, 0.1]}>
          <mesh renderOrder={15}>
            <sphereGeometry args={[ablationSize, 16, 12]} />
            <meshBasicMaterial
              color="#fafafa"
              transparent
              opacity={physiology.ablationIndex * 0.55}
              depthWrite={false}
            />
          </mesh>
          <mesh renderOrder={16}>
            <sphereGeometry args={[ablationSize * 0.55, 12, 10]} />
            <meshBasicMaterial
              color="#7f1d1d"
              transparent
              opacity={physiology.ablationIndex * 0.65}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}
