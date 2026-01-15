/**
 * Viewer 3: Volume 3D with Slice Plane
 * Bloco 3D semi-translúcido com plano de slice texturizado
 * SEMPRE mostra algo, nunca fica em loading infinito
 */

import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Grid, Text, Html } from "@react-three/drei";
import { useMRILabStore } from "@/stores/mriLabStore";
import { Box } from "@react-three/drei";
import { MeshStandardMaterial, DoubleSide, CanvasTexture } from "three";
import { useMemo } from "react";
import { getSliceImageData } from "@/simulation/mriEngine";

interface Volume3DViewerProps {
  showDebug?: boolean;
}

function SlicePlane({ volume, config, scale, showDebug }: { volume: any; config: any; scale: number; showDebug: boolean }) {
  const sliceTexture = useMemo(() => {
    try {
      if (!volume || !volume.voxels || volume.voxels.length === 0) {
        return null;
      }
      
      // Get slice data using pure function
      const imageData = getSliceImageData(
        volume,
        config.sliceIndex || 0,
        config.tr,
        config.te,
        config.flipAngle,
        config.window || 2000,
        config.level || 1000
      );
      
      if (!imageData) {
        return null;
      }
      
      // Create canvas texture
      const canvas = document.createElement("canvas");
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      
      ctx.putImageData(imageData, 0, 0);
      
      // Create Three.js texture
      const texture = new CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    } catch (error) {
      console.error("Error creating slice texture:", error);
      return null;
    }
  }, [volume, config.sliceIndex, config.tr, config.te, config.flipAngle, config.window, config.level]);
  
  if (!sliceTexture || !volume) return null;
  
  const sliceZ = Math.max(0, Math.min(volume.depth - 1, config.sliceIndex || 0));
  const zPos = (sliceZ - volume.depth / 2) * scale;
  
  return (
    <mesh 
      position={[0, 0, zPos]} 
      rotation={[0, 0, 0]}
      renderOrder={10} // Render after volume block
    >
      <planeGeometry args={[volume.width * scale, volume.height * scale]} />
      <meshStandardMaterial
        map={sliceTexture}
        transparent
        opacity={0.95}
        side={DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function VolumeBlock({ showDebug }: { showDebug: boolean }) {
  const { simulationResult, config } = useMRILabStore();
  
  // Always render something, even if volume is not available
  if (!simulationResult || !simulationResult.volume || !simulationResult.volume.voxels || simulationResult.volume.voxels.length === 0) {
    return (
      <group>
        <Text
          position={[0, 0, 0]}
          fontSize={0.5}
          color="white"
          anchorX="center"
        >
          Sem volume disponível
        </Text>
        {showDebug && (
          <Html position={[0, 1, 0]}>
            <div className="bg-red-500/90 text-white text-xs px-2 py-1 rounded font-mono">
              Volume inválido ou vazio
            </div>
          </Html>
        )}
      </group>
    );
  }
  
  const { volume } = simulationResult;
  const scale = 0.05; // Scale factor for visualization
  
  // Calculate debug info
  const debugInfo = useMemo(() => {
    if (!showDebug) return null;
    
    const sliceZ = Math.max(0, Math.min(volume.depth - 1, config.sliceIndex || 0));
    const sliceVoxels = volume.voxels.filter((v: any) => v.z === sliceZ);
    const signals = sliceVoxels.map((v: any) => v.signal || 0);
    
    return {
      volumeDims: `${volume.width}×${volume.height}×${volume.depth}`,
      sliceIndex: sliceZ,
      voxelsInSlice: sliceVoxels.length,
      minIntensity: signals.length > 0 ? Math.min(...signals).toFixed(2) : "N/A",
      maxIntensity: signals.length > 0 ? Math.max(...signals).toFixed(2) : "N/A",
    };
  }, [volume, config.sliceIndex, showDebug]);
  
  return (
    <group>
      {/* Main volume block - render first (lower renderOrder) */}
      <Box
        args={[volume.width * scale, volume.height * scale, volume.depth * scale]}
        position={[0, 0, 0]}
      >
        <meshStandardMaterial
          color="#2a2a2a"
          transparent
          opacity={0.25}
          roughness={0.9}
          metalness={0}
          side={DoubleSide}
          depthWrite={true}
        />
      </Box>
      
      {/* Slice plane with texture - render after (higher renderOrder) */}
      <SlicePlane volume={volume} config={config} scale={scale} showDebug={showDebug} />
      
      {/* Debug info (admin mode only) */}
      {showDebug && debugInfo && (
        <Html position={[volume.width * scale / 2 + 1, volume.height * scale / 2 + 1, 0]}>
          <div className="bg-amber-500/90 text-black text-xs px-2 py-1 rounded font-mono whitespace-nowrap">
            <div>Vol: {debugInfo.volumeDims}</div>
            <div>Slice: {debugInfo.sliceIndex}</div>
            <div>Voxels: {debugInfo.voxelsInSlice}</div>
            <div>Int: {debugInfo.minIntensity} - {debugInfo.maxIntensity}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

export function Volume3DViewer({ showDebug = false }: Volume3DViewerProps) {
  return (
    <div className="w-full h-full">
      <Canvas>
        <PerspectiveCamera makeDefault position={[5, 5, 5]} fov={50} />
        <OrbitControls enableDamping dampingFactor={0.05} />
        
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        
        {/* Grid */}
        <Grid args={[10, 10]} cellColor="#4A90E2" sectionColor="#2A5A9A" />
        
        {/* Volume Block */}
        <VolumeBlock showDebug={showDebug} />
      </Canvas>
    </div>
  );
}
