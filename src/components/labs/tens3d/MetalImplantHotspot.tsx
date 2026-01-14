import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TissueConfig } from '@/types/tissueConfig';

interface MetalImplantHotspotProps {
  electrodePositions: {
    proximal: [number, number, number];
    distal: [number, number, number];
  };
  metalHotspot: { intensity: number; depth: number; span: number };
  tissueConfig: TissueConfig;
  intensityNorm: number;
}

export function MetalImplantHotspot({
  electrodePositions,
  metalHotspot,
  tissueConfig,
  intensityNorm,
}: MetalImplantHotspotProps) {
  const hotspotRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  // Calcular posição do implante em coordenadas 3D
  const position = useMemo(() => {
    const centerX = (electrodePositions.proximal[0] + electrodePositions.distal[0]) / 2;
    const totalDepth = tissueConfig.skinThickness + tissueConfig.fatThickness + tissueConfig.muscleThickness;
    const y = -metalHotspot.depth * totalDepth * 5; // Converter profundidade normalizada para coordenadas 3D
    const z = 0;
    
    return [centerX, y, z] as [number, number, number];
  }, [electrodePositions, metalHotspot.depth, tissueConfig]);

  // Tamanho baseado na extensão
  const size = useMemo(() => {
    const baseSize = metalHotspot.span * 1.5;
    return baseSize;
  }, [metalHotspot.span]);

  // Animar pulso baseado na intensidade
  useFrame((state) => {
    if (!hotspotRef.current || !glowRef.current) return;
    
    const time = state.clock.elapsedTime;
    const pulse = Math.sin(time * 3) * 0.15 + 0.85;
    
    // Pulsar o hotspot
    const scale = 1 + (metalHotspot.intensity * pulse * 0.2);
    hotspotRef.current.scale.set(scale, scale, scale);
    
    // Pulsar o glow
    const glowMaterial = glowRef.current.material as THREE.MeshBasicMaterial;
    glowMaterial.opacity = metalHotspot.intensity * pulse * 0.4;
  });

  return (
    <group position={position}>
      {/* Glow externo - distorção do campo */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 0.8, size * 1.5, 32]} />
        <meshBasicMaterial
          color="#3b82f6"
          transparent
          opacity={metalHotspot.intensity * 0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* Hotspot central - concentração de campo */}
      <mesh ref={hotspotRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[size * 0.5, 32]} />
        <meshStandardMaterial
          color="#60a5fa"
          transparent
          opacity={metalHotspot.intensity * 0.6}
          side={THREE.DoubleSide}
          emissive="#3b82f6"
          emissiveIntensity={metalHotspot.intensity * 0.5}
        />
      </mesh>
      
      {/* Linhas de campo distorcidas ao redor */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const radius = size * 0.7;
        const startX = Math.cos(angle) * radius;
        const startY = Math.sin(angle) * radius;
        const endX = Math.cos(angle) * size * 1.2;
        const endY = Math.sin(angle) * size * 1.2;
        
        return (
          <line key={i}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([startX, startY, 0, endX, endY, 0])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color="#3b82f6"
              transparent
              opacity={metalHotspot.intensity * 0.4}
            />
          </line>
        );
      })}
    </group>
  );
}
