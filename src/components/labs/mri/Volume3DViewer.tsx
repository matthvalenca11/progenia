/**
 * Volume 3D Viewer - Visualização 3D simples e robusta
 * Bloco 3D translúcido com planos MPR internos
 */

import { useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Grid } from "@react-three/drei";
import * as THREE from "three";
import { useMRILabStore } from "@/stores/mriLabStore";

interface Volume3DViewerProps {
  showDebug?: boolean;
}

function VolumeBlock() {
  const meshRef = useRef<THREE.Mesh>(null);
  const store = useMRILabStore();
  const { normalizedVolume } = store;

  if (!normalizedVolume || !normalizedVolume.isValid) {
    return null;
  }

  const { width, height, depth, spacing } = normalizedVolume;
  
  // Escalar para unidades visuais (mm para unidades 3D)
  const scaleX = (width * spacing[0]) / 100; // Dividir por 100 para escala razoável
  const scaleY = (height * spacing[1]) / 100;
  const scaleZ = (depth * spacing[2]) / 100;

  return (
    <group>
      {/* Bloco 3D translúcido */}
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <boxGeometry args={[scaleX, scaleY, scaleZ]} />
        <meshStandardMaterial
          color="#4a5568"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Planos de referência (bordas) */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(scaleX, scaleY, scaleZ)]} />
        <lineBasicMaterial color="#ffffff" opacity={0.5} transparent />
      </lineSegments>
    </group>
  );
}

function SlicePlane({ 
  position, 
  rotation, 
  size 
}: { 
  position: [number, number, number]; 
  rotation: [number, number, number];
  size: [number, number];
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshStandardMaterial
        color="#60a5fa"
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function Volume3DViewer({ showDebug = false }: Volume3DViewerProps) {
  const store = useMRILabStore();
  const { normalizedVolume, volumeLoadError, isLoadingVolume } = store;

  if (isLoadingVolume) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-4">
          <div className="text-muted-foreground text-sm">Carregando volume...</div>
        </div>
      </div>
    );
  }

  if (volumeLoadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-4 max-w-md">
          <div className="text-red-500 font-mono text-sm mb-2">⚠ Erro ao carregar volume</div>
          <div className="text-xs text-muted-foreground font-mono bg-red-500/10 p-2 rounded">
            {volumeLoadError}
          </div>
        </div>
      </div>
    );
  }

  if (!normalizedVolume || !normalizedVolume.isValid) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-4">
          <div className="text-muted-foreground text-sm">Nenhum volume carregado</div>
        </div>
      </div>
    );
  }

  const { width, height, depth, spacing } = normalizedVolume;
  const scaleX = (width * spacing[0]) / 100;
  const scaleY = (height * spacing[1]) / 100;
  const scaleZ = (depth * spacing[2]) / 100;
  const maxDim = Math.max(scaleX, scaleY, scaleZ);

  return (
    <div className="w-full h-full bg-black">
      <Canvas>
        <PerspectiveCamera
          makeDefault
          position={[maxDim * 1.5, maxDim * 1.5, maxDim * 1.5]}
          fov={50}
        />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} />
        
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={maxDim * 0.5}
          maxDistance={maxDim * 3}
        />
        
        <Grid args={[maxDim * 2, maxDim * 2]} cellColor="#6b7280" sectionColor="#9ca3af" />
        
        <VolumeBlock />
        
        {/* Planos MPR de referência */}
        <SlicePlane
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
          size={[scaleX, scaleY]}
        />
      </Canvas>
      
      {/* Overlay Info */}
      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded font-mono">
        <div>Volume 3D: {width}×{height}×{depth}</div>
        <div>Spacing: {spacing[0].toFixed(2)} × {spacing[1].toFixed(2)} × {spacing[2].toFixed(2)} mm</div>
        <div>Source: {normalizedVolume.source}</div>
      </div>
    </div>
  );
}
