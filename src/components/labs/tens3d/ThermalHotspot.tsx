import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TissueConfig } from '@/types/tissueConfig';

interface ThermalHotspotProps {
  electrodePositions: {
    proximal: [number, number, number];
    distal: [number, number, number];
  };
  thermalHotspot: { intensity: number; depth: number };
  tissueConfig: TissueConfig;
}

export function ThermalHotspot({
  electrodePositions,
  thermalHotspot,
  tissueConfig,
}: ThermalHotspotProps) {
  const hotspotRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // Calcular posição do hotspot térmico
  const position = useMemo(() => {
    const centerX = (electrodePositions.proximal[0] + electrodePositions.distal[0]) / 2;
    const totalDepth = tissueConfig.skinThickness + tissueConfig.fatThickness + tissueConfig.muscleThickness;
    const y = -thermalHotspot.depth * totalDepth * 5;
    const z = 0;
    
    return [centerX, y, z] as [number, number, number];
  }, [electrodePositions, thermalHotspot.depth, tissueConfig]);

  // Tamanho baseado na intensidade
  const size = useMemo(() => {
    return 0.8 + thermalHotspot.intensity * 0.8;
  }, [thermalHotspot.intensity]);

  // Partículas de calor
  const particleGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const numParticles = Math.floor(20 + thermalHotspot.intensity * 30);
    const positions = new Float32Array(numParticles * 3);
    
    for (let i = 0; i < numParticles; i++) {
      const angle = (i / numParticles) * Math.PI * 2;
      const radius = size * (0.5 + Math.random() * 0.5);
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [size, thermalHotspot.intensity]);

  // Animar pulso térmico
  useFrame((state) => {
    if (!hotspotRef.current) return;
    
    const time = state.clock.elapsedTime;
    const pulse = Math.sin(time * 4) * 0.2 + 0.8;
    
    // Pulsar o hotspot
    const scale = 1 + (thermalHotspot.intensity * pulse * 0.3);
    hotspotRef.current.scale.set(scale, scale, scale);
    
    const material = hotspotRef.current.material as THREE.MeshBasicMaterial;
    material.opacity = thermalHotspot.intensity * pulse * 0.7;
    
    // Animar partículas
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length / 3; i++) {
        const offset = Math.sin(time * 2 + i * 0.1) * 0.05;
        positions[i * 3 + 1] += offset;
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  // Cor baseada na intensidade (amarelo -> laranja -> vermelho)
  const color = useMemo(() => {
    if (thermalHotspot.intensity > 0.7) return '#ff4444'; // Vermelho intenso
    if (thermalHotspot.intensity > 0.5) return '#ff6b00'; // Laranja
    return '#ffaa00'; // Amarelo
  }, [thermalHotspot.intensity]);

  return (
    <group position={position}>
      {/* Hotspot térmico principal */}
      <mesh ref={hotspotRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[size, 32]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={thermalHotspot.intensity * 0.6}
          side={THREE.DoubleSide}
          emissive={color}
          emissiveIntensity={thermalHotspot.intensity * 0.8}
        />
      </mesh>
      
      {/* Halo externo - radiação térmica */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size, size * 1.8, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={thermalHotspot.intensity * 0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* Partículas de calor */}
      <points ref={particlesRef} geometry={particleGeometry}>
        <pointsMaterial
          size={0.08}
          color={color}
          transparent
          opacity={thermalHotspot.intensity * 0.8}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
    </group>
  );
}
