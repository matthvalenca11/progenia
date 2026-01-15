/**
 * Viewer 3: Volume 3D with Slice Plane
 * CONTRATO FORTE: Só renderiza se volumeReady === true
 * Bloco 3D baseado nas dimensões reais do volume
 */

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Grid, Text, Html } from "@react-three/drei";
import { useMRILabStore } from "@/stores/mriLabStore";
import { Box } from "@react-three/drei";
import { MeshStandardMaterial, DoubleSide, CanvasTexture } from "three";
import { useMemo, useEffect } from "react";
import { getSliceImageData } from "@/simulation/mriEngine";

interface Volume3DViewerProps {
  showDebug?: boolean;
}

function SlicePlane({ volume, config, scale, showDebug }: { volume: any; config: any; scale: number; showDebug: boolean }) {
  const sliceTexture = useMemo(() => {
    if (!volume || !volume.voxels || volume.voxels.length === 0) {
      return null;
    }
    
    // Clamp sliceIndex
    const maxSlice = Math.max(0, volume.depth - 1);
    const sliceZ = Math.max(0, Math.min(maxSlice, config.sliceIndex || 0));
    
    // Get slice data using pure function
    const imageData = getSliceImageData(
      volume,
      sliceZ,
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
    if (!ctx) {
      return null;
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Create Three.js texture
    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, [volume, config.sliceIndex, config.tr, config.te, config.flipAngle, config.window, config.level]);
  
  if (!volume || !volume.voxels || volume.voxels.length === 0) {
    return null;
  }
  
  if (!sliceTexture) {
    return null; // Don't render placeholder - let error show
  }
  
  const sliceZ = Math.max(0, Math.min(volume.depth - 1, config.sliceIndex || 0));
  const zPos = (sliceZ - volume.depth / 2 + 0.5) * scale; // +0.5 to center voxel
  
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
  const store = useMRILabStore();
  const { 
    volume, 
    volumeReady, 
    config, 
    simulationError,
    isSimulating,
  } = store;
  const storeInstanceId = store.storeInstanceId || "unknown";
  const lastSimulatedConfigHash = store.lastSimulatedConfigHash || "";
  const lastSimulationAt = store.lastSimulationAt || null;
  
  // STRICT: Only render if volume is ready
  if (!volumeReady || !volume) {
    return (
      <group>
        <Text
          position={[0, 0, 0]}
          fontSize={0.5}
          color="#ff4444"
          anchorX="center"
        >
          ERRO: Volume não disponível
        </Text>
        {showDebug && simulationError && (
          <Html position={[0, 1, 0]}>
            <div className="bg-red-500/90 text-white text-xs px-2 py-1 rounded font-mono">
              {simulationError}
            </div>
          </Html>
        )}
      </group>
    );
  }
  
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
      preset: config.preset,
      status: volumeReady ? "OK" : "ERROR",
    };
  }, [volume, config.sliceIndex, config.preset, volumeReady, showDebug]);
  
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
      {showDebug && (
        <Html position={[volume.width * scale / 2 + 1, volume.height * scale / 2 + 1, 0]}>
          <div className="bg-amber-500/90 text-black text-xs px-2 py-1 rounded font-mono whitespace-nowrap space-y-0.5 max-w-xs">
            <div className="font-bold border-b border-black/20 pb-0.5">Store Debug</div>
            <div>ID: {storeInstanceId.slice(0, 12)}...</div>
            <div>Ready: {volumeReady ? "✅" : "❌"}</div>
            <div>Simulating: {isSimulating ? "⏳" : "✓"}</div>
            {debugInfo && (
              <>
                <div className="border-t border-black/20 pt-0.5 mt-0.5">Vol: {debugInfo.volumeDims}</div>
                <div>Slice: {debugInfo.sliceIndex}</div>
                <div>Voxels: {debugInfo.voxelsInSlice}</div>
                <div>Int: {debugInfo.minIntensity} - {debugInfo.maxIntensity}</div>
                <div>Preset: {debugInfo.preset}</div>
              </>
            )}
            <div className="border-t border-black/20 pt-0.5 mt-0.5">Config Hash: {lastSimulatedConfigHash.slice(0, 20)}...</div>
            <div>Last Sim: {lastSimulationAt ? new Date(lastSimulationAt).toLocaleTimeString() : "never"}</div>
            {simulationError && (
              <div className="text-red-600 border-t border-black/20 pt-0.5 mt-0.5">Error: {simulationError}</div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

function AutoCamera() {
  const { volume } = useMRILabStore();
  const { camera } = useThree();
  
  useEffect(() => {
    if (!volume) return;
    
    const scale = 0.05;
    const maxDim = Math.max(volume.width, volume.height, volume.depth) * scale;
    const distance = maxDim * 2.5;
    
    // Position camera to frame the volume
    camera.position.set(distance, distance, distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [volume, camera]);
  
  return null;
}

export function Volume3DViewer({ showDebug = false }: Volume3DViewerProps) {
  return (
    <div className="w-full h-full">
      <Canvas>
        <PerspectiveCamera makeDefault position={[5, 5, 5]} fov={50} />
        <AutoCamera />
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
