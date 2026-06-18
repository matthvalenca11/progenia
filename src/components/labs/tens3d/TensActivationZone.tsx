/**
 * Visualização 3D da região ativada estimada pelo motor TENS.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ActivationZone } from "@/simulation/TensFieldEngine";
import { TissueConfig } from "@/types/tissueConfig";

interface TensActivationZoneProps {
  zone: ActivationZone;
  tissueConfig: TissueConfig;
  electrodePositions: {
    proximal: [number, number, number];
    distal: [number, number, number];
  };
  sensoryActivation: number;
}

export function TensActivationZone({
  zone,
  tissueConfig,
  electrodePositions,
  sensoryActivation,
}: TensActivationZoneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  const totalDepth =
    tissueConfig.skinThickness + tissueConfig.fatThickness + tissueConfig.muscleThickness;
  const depthScale = totalDepth * 5;

  const [x1] = electrodePositions.proximal;
  const [x2] = electrodePositions.distal;
  const centerX = x1 + (x2 - x1) * zone.centerX;
  const centerY = -zone.depth / 100 * depthScale;
  const radiusX = Math.max(0.4, zone.radiusX * 2.5);
  const radiusY = Math.max(0.25, zone.radiusY * depthScale * 2);
  const activationNorm = Math.min(1, sensoryActivation / 100);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = 0.75 + Math.sin(t * 3.2) * 0.25;
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = activationNorm * pulse * 1.2;
      mat.opacity = 0.18 + activationNorm * 0.35 * pulse;
    }
    if (haloRef.current) {
      const mat = haloRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = activationNorm * 0.12 * pulse;
      haloRef.current.scale.setScalar(1 + Math.sin(t * 2.5) * 0.06);
    }
  });

  return (
    <group position={[centerX, centerY, 0]}>
      <mesh ref={meshRef} scale={[radiusX, radiusY, 1.8]}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#06b6d4"
          emissiveIntensity={activationNorm * 0.8}
          transparent
          opacity={0.25 + activationNorm * 0.3}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={haloRef} scale={[radiusX * 1.35, radiusY * 1.35, 2.2]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial
          color="#67e8f9"
          transparent
          opacity={activationNorm * 0.1}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
