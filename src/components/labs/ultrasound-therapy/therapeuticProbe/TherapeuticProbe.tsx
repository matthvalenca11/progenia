import { useMemo, type RefObject } from "react";
import { Text } from "@react-three/drei";
import type { Mesh } from "three";
import type { TherapeuticTransducerType } from "@/config/therapeuticTransducerDefinitions";
import { TRANSDUCER_ENGRAVING } from "../transducerBranding";
import { buildProbeBodyGeometry } from "./probeGeometry";
import { computeProbeLayout, HANDLE_TILT } from "./probeLayout";
import { PROBE_BUTTON, PROBE_PLASTIC, PROBE_PLASTIC_DETAIL } from "./probeMaterials";
import { PlanarProbeHead } from "./PlanarProbeHead";
import { FocusedProbeHead } from "./FocusedProbeHead";
import { ProbeCable } from "./ProbeCable";

export interface TherapeuticProbeDims {
  headR: number;
  activeR: number;
  faceH: number;
  neckR: number;
  neckH: number;
  handleR: number;
  handleLen: number;
  cableR: number;
}

interface TherapeuticProbeProps {
  transducerType: TherapeuticTransducerType;
  isFocused: boolean;
  dims: TherapeuticProbeDims;
  faceBottomY: number;
  ceramicRef: RefObject<Mesh>;
  ledRef: RefObject<Mesh>;
  castShadow: boolean;
}

export function TherapeuticProbe({
  transducerType,
  isFocused,
  dims,
  faceBottomY,
  ceramicRef,
  ledRef,
  castShadow,
}: TherapeuticProbeProps) {
  const layout = useMemo(
    () =>
      computeProbeLayout(
        faceBottomY,
        dims.faceH,
        dims.neckH,
        dims.handleR,
        dims.handleLen,
      ),
    [faceBottomY, dims],
  );

  const bodyGeo = useMemo(
    () =>
      buildProbeBodyGeometry(
        dims.headR,
        dims.activeR,
        faceBottomY,
        dims.faceH,
        dims.neckR,
        dims.neckH,
        isFocused,
      ),
    [dims, faceBottomY, isFocused],
  );

  const engravingLines = TRANSDUCER_ENGRAVING[transducerType].lines;
  const handleTopY = layout.capR * 2 + layout.capLen;

  return (
    <group name="therapeutic-probe">
      {/* Corpo cabeça+pescoço — peça única */}
      <mesh geometry={bodyGeo} castShadow={castShadow} receiveShadow={castShadow}>
        <meshPhysicalMaterial {...PROBE_PLASTIC} />
      </mesh>

      {/* Chanfro superior da cabeça */}
      <mesh position={[0, layout.faceTopY + 0.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[dims.headR * 0.58, 0.0025, 8, 64]} />
        <meshStandardMaterial {...PROBE_PLASTIC_DETAIL} />
      </mesh>

      {isFocused ? (
        <FocusedProbeHead
          activeR={dims.activeR}
          faceBottomY={faceBottomY}
          ceramicRef={ceramicRef}
          castShadow={castShadow}
        />
      ) : (
        <PlanarProbeHead
          activeR={dims.activeR}
          faceBottomY={faceBottomY}
          ceramicRef={ceramicRef}
          castShadow={castShadow}
        />
      )}

      {isFocused && (
        <Text
          position={[0, layout.faceTopY + dims.neckH * 0.45, dims.headR * 0.42]}
          rotation={[-0.28, 0, 0]}
          fontSize={0.013}
          color="#64748b"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.04}
        >
          FUS
        </Text>
      )}

      {/* Haste + cabo + botão — grupo único no topo do pescoço */}
      <group position={[0, layout.neckTopY, 0]} rotation={[-HANDLE_TILT, 0, 0]}>
        <mesh position={[0, layout.capR + layout.capLen * 0.5, 0]} castShadow={castShadow}>
          <capsuleGeometry args={[layout.capR, layout.capLen, 8, 32]} />
          <meshPhysicalMaterial {...PROBE_PLASTIC} />
        </mesh>

        <mesh position={layout.buttonPos} rotation={[0, 0, 0.1]} castShadow={castShadow}>
          <capsuleGeometry args={[0.01, 0.026, 4, 10]} />
          <meshStandardMaterial {...PROBE_BUTTON} />
        </mesh>

        <group position={[0, layout.capR * 0.92, layout.capR * 0.88]}>
          {engravingLines.map((line, index) => (
            <Text
              key={line}
              position={[0, -index * 0.022, 0]}
              fontSize={0.015}
              color="#475569"
              anchorX="center"
              anchorY="middle"
              maxWidth={0.24}
            >
              {line}
            </Text>
          ))}
        </group>

        <ProbeCable localY={handleTopY} cableR={dims.cableR} castShadow={castShadow} />

        <mesh ref={ledRef} position={[layout.ledPos.x, layout.ledPos.y, layout.ledPos.z]}>
          <sphereGeometry args={[0.008, 8, 8]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.3} />
        </mesh>
      </group>
    </group>
  );
}
