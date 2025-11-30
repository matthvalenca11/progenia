import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

interface ElectrodeModelProps {
  position: [number, number, number];
  label: '+' | '-';
  isActive: boolean;
  intensity: number;
}

export function ElectrodeModel({
  position,
  label,
  isActive,
  intensity,
}: ElectrodeModelProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  // Pulsing animation
  useFrame((state) => {
    if (meshRef.current && isActive) {
      const pulse = Math.sin(state.clock.elapsedTime * 4) * 0.05 + 1;
      meshRef.current.scale.setScalar(pulse);
    }
    
    if (glowRef.current && isActive) {
      const glow = Math.sin(state.clock.elapsedTime * 3) * 0.3 + 0.7;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = intensity * glow * 0.5;
    }
  });

  return (
    <group position={position}>
      {/* Electrode pad */}
      <mesh ref={meshRef} position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 0.1, 32]} />
        <meshStandardMaterial
          color={label === '+' ? '#ff4444' : '#4444ff'}
          roughness={0.3}
          metalness={0.7}
          emissive={isActive ? (label === '+' ? '#ff0000' : '#0000ff') : '#000000'}
          emissiveIntensity={isActive ? intensity * 0.8 : 0}
        />
      </mesh>

      {/* Gel layer effect */}
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 0.05, 32]} />
        <meshStandardMaterial
          color="#88ccff"
          transparent
          opacity={0.4}
          roughness={0.1}
          metalness={0.3}
        />
      </mesh>

      {/* Glow effect when active */}
      {isActive && (
        <mesh ref={glowRef} position={[0, 0.5, 0]}>
          <cylinderGeometry args={[1.2, 1.2, 0.15, 32]} />
          <meshBasicMaterial
            color={label === '+' ? '#ff6666' : '#6666ff'}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Label */}
      <Text
        position={[0, 0.55, 0]}
        fontSize={0.4}
        color="white"
        anchorX="center"
        anchorY="middle"
        font="/fonts/inter-bold.woff"
      >
        {label}
      </Text>

      {/* Wire connection visualization */}
      <mesh position={[0, 1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 1, 8]} />
        <meshStandardMaterial
          color="#333333"
          roughness={0.5}
          metalness={0.8}
        />
      </mesh>
    </group>
  );
}
