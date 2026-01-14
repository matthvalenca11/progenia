/**
 * BoneReflection - Visualiza reflexão do feixe no osso
 */

import { useMemo } from 'react';
import { Sphere, Cone } from '@react-three/drei';
import { useUltrasoundTherapyStore } from '@/stores/ultrasoundTherapyStore';

export function BoneReflection() {
  const { simulationResult, config } = useUltrasoundTherapyStore();
  
  if (!simulationResult || simulationResult.boneReflection < 0.1) {
    return null;
  }

  // Find bone depth from scenario
  const boneDepths: Record<string, number> = {
    shoulder: 2.7,
    knee: 2.0,
    lumbar: -1, // No bone
    forearm: -1, // No bone
    custom: -1,
  };
  
  const boneDepth = boneDepths[config.scenario] || -1;
  if (boneDepth < 0) return null;

  const reflectionIntensity = simulationResult.boneReflection;
  const periostealRisk = simulationResult.periostealRisk;

  return (
    <group>
      {/* Reflected beam cone (going back up) */}
      <Cone
        args={[0.8, 1.0, 16]}
        position={[0, -boneDepth, 0]}
        rotation={[0, 0, 0]}
      >
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={reflectionIntensity * 0.4}
          opacity={reflectionIntensity * 0.3}
          transparent
        />
      </Cone>
      
      {/* Periosteal hotspot if risk is high */}
      {periostealRisk > 0.3 && (
        <Sphere args={[0.4, 16, 16]} position={[0, -boneDepth, 0]}>
          <meshStandardMaterial
            color="#ef4444"
            emissive="#ef4444"
            emissiveIntensity={periostealRisk * 0.8}
            opacity={periostealRisk * 0.6}
            transparent
            roughness={0.2}
            metalness={0.1}
          />
        </Sphere>
      )}
    </group>
  );
}
