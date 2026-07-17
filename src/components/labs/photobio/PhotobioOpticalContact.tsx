import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { couplingVisualState } from "./photobioBeamVisual";

interface PhotobioOpticalContactProps {
  transducerX: number;
  contactSurfaceY: number;
  transducerAngle: number;
  incidenceEfficiency: number;
  contactCenterOffsetX?: number;
  coupling: number;
  thermalRiskIndex: number;
  irradianceMwCm2?: number;
  spotScale: number;
  visible?: boolean;
}

export function PhotobioOpticalContact({
  transducerX,
  contactSurfaceY,
  transducerAngle,
  incidenceEfficiency,
  contactCenterOffsetX = 0,
  coupling,
  thermalRiskIndex,
  irradianceMwCm2 = 100,
  spotScale,
  visible = true,
}: PhotobioOpticalContactProps) {
  const couplingRef = useRef<THREE.Mesh>(null);
  const effectiveCoupling = coupling * incidenceEfficiency;
  const state = couplingVisualState(effectiveCoupling, thermalRiskIndex);
  const tiltRad = ((transducerAngle - 90) * Math.PI) / 180;
  const oblique = Math.abs(tiltRad) > 0.22;
  const stretch = Math.min(1.48, 1 / Math.max(incidenceEfficiency, 0.5));
  const compress = Math.max(0.62, Math.sqrt(incidenceEfficiency));
  const powerNorm = Math.min(1.4, Math.max(0.15, irradianceMwCm2 / 350));
  const innerR = 0.12 + spotScale * 0.12;
  const outerR = 0.22 + spotScale * 0.2;
  const contactX = transducerX + contactCenterOffsetX;

  useFrame(({ clock }) => {
    if (couplingRef.current && state.good && !oblique) {
      const mat = couplingRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.25 + 0.15 * Math.sin(clock.getElapsedTime() * 2.5);
    }
  });

  if (!visible || oblique) return null;

  const ringColor = state.thermal
    ? "#f59e0b"
    : state.low
      ? "#94a3b8"
      : state.good
        ? "#22d3ee"
        : "#e2e8f0";
  const emissive = state.thermal
    ? "#ef4444"
    : state.low
      ? "#64748b"
      : state.good
        ? "#06b6d4"
        : "#64748b";

  return (
    <group position={[contactX, contactSurfaceY + 0.003, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[stretch, compress, 1]} renderOrder={5}>
        <ringGeometry args={[innerR, outerR, 48]} />
        <meshStandardMaterial
          color={ringColor}
          emissive={emissive}
          emissiveIntensity={state.thermal ? 0.65 + powerNorm * 0.35 : state.low ? 0.12 : state.good ? 0.22 + powerNorm * 0.18 : 0.12}
          transparent
          opacity={
            state.thermal
              ? 0.42 + powerNorm * 0.28
              : state.low
                ? 0.14 + powerNorm * 0.06
                : 0.12 + powerNorm * 0.12
          }
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {state.low && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.001, 0]}
          scale={[stretch * 1.04, compress * 1.04, 1]}
          renderOrder={4}
        >
          <ringGeometry args={[outerR * 0.96, outerR * 1.12, 40]} />
          <meshStandardMaterial
            color="#cbd5e1"
            emissive="#94a3b8"
            emissiveIntensity={0.12}
            transparent
            opacity={0.06}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {state.good && (
        <mesh
          ref={couplingRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.001, 0]}
          scale={[stretch * 0.9, compress * 0.9, 1]}
          renderOrder={5}
        >
          <circleGeometry args={[innerR * 0.92, 32]} />
          <meshStandardMaterial
            color="#22d3ee"
            emissive="#0891b2"
            emissiveIntensity={0.28}
            transparent
            opacity={0.08 + effectiveCoupling * 0.07}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}
