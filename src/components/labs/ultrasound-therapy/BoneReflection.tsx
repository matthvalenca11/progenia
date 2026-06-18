/**
 * BoneReflection - Visualiza reflexão do feixe no osso
 */

import { useMemo } from 'react';
import { Cone, Sphere } from '@react-three/drei';
import { useUltrasoundTherapyStore } from '@/stores/ultrasoundTherapyStore';
import { getBoneStartDepth } from '@/lib/ultrasoundTherapyStack';
import { resolveMixedLayerConfig } from '@/lib/ultrasoundTherapyStackConfig';
import { mixedLayerBoundaryXcm } from '@/lib/ultrasoundTherapyBoneAcoustics';

interface BoneReflectionProps {
  position?: { x: number; y: number };
}

export function BoneReflection({ position = { x: 0, y: 0 } }: BoneReflectionProps) {
  const { simulationResult, config } = useUltrasoundTherapyStore();

  const resolvedMixed = useMemo(
    () => resolveMixedLayerConfig(config.scenario, config.customThicknesses, config.mixedLayer),
    [config.scenario, config.customThicknesses, config.mixedLayer],
  );

  const boneDepth = useMemo(
    () => resolvedMixed?.depth ?? getBoneStartDepth(config.scenario, config.customThicknesses),
    [config.scenario, config.customThicknesses, resolvedMixed],
  );

  if (!simulationResult || simulationResult.boneReflection < 0.1 || boneDepth === null) {
    return null;
  }

  const reflectionIntensity = simulationResult.boneReflection;
  const periostealRisk = simulationResult.periostealRisk;
  const xOffset = position.x * 8;
  const zOffset = position.y * 3;

  const mixedBoundaryX =
    resolvedMixed != null ? mixedLayerBoundaryXcm(resolvedMixed.division) : 0;
  const transducerOverBone =
    resolvedMixed != null &&
    config.transducerPosition != null &&
    config.transducerPosition.x * 8 > mixedBoundaryX;

  return (
    <group position={[xOffset, 0, zOffset]}>
      <Cone
        args={[0.8, 1.0, 16]}
        position={[
          resolvedMixed && transducerOverBone ? mixedBoundaryX - xOffset : 0,
          -boneDepth,
          0.12,
        ]}
        rotation={[Math.PI, 0, 0]}
      >
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={reflectionIntensity * 0.65}
          opacity={0.28 + reflectionIntensity * 0.48}
          transparent
          depthWrite={false}
        />
      </Cone>

      {resolvedMixed && transducerOverBone && (
        <Cone
          args={[0.45, 0.7, 12]}
          position={[mixedBoundaryX - xOffset, -boneDepth + 0.35, 0.14]}
          rotation={[Math.PI * 0.55, 0, transducerOverBone ? -0.35 : 0.35]}
        >
          <meshStandardMaterial
            color="#fde68a"
            emissive="#f59e0b"
            emissiveIntensity={reflectionIntensity * 0.5}
            opacity={0.22 + reflectionIntensity * 0.35}
            transparent
            depthWrite={false}
          />
        </Cone>
      )}

      {periostealRisk > 0.3 && (
        <Sphere
          args={[0.4, 16, 16]}
          position={[
            resolvedMixed && transducerOverBone ? mixedBoundaryX - xOffset : 0,
            -boneDepth,
            0.14,
          ]}
        >
          <meshStandardMaterial
            color="#ef4444"
            emissive="#ef4444"
            emissiveIntensity={periostealRisk * 0.8}
            opacity={periostealRisk * 0.55}
            transparent
            depthWrite={false}
            roughness={0.2}
            metalness={0.1}
          />
        </Sphere>
      )}
    </group>
  );
}
