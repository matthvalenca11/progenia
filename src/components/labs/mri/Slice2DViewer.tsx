/**
 * Viewer 2: Slice 2D
 * CONTRATO FORTE: Só renderiza se volumeReady === true
 * Se volume null, mostra erro técnico explícito (admin)
 */

import { useMemo, useRef, useEffect } from "react";
import { useMRILabStore } from "@/stores/mriLabStore";
import { getSliceImageData } from "@/simulation/mriEngine";

interface Slice2DViewerProps {
  showDebug?: boolean;
}

export function Slice2DViewer({ showDebug = false }: Slice2DViewerProps) {
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // STRICT: Only proceed if volume is ready
  if (!volumeReady || !volume) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-4">
          <div className="text-red-500 font-mono text-sm mb-2">
            ⚠ ERRO: Volume não disponível
          </div>
          {showDebug && simulationError && (
            <div className="text-xs text-muted-foreground font-mono bg-red-500/10 p-2 rounded">
              {simulationError}
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Clamp sliceIndex to valid range
  const maxSlice = Math.max(0, volume.depth - 1);
  const sliceZ = Math.max(0, Math.min(maxSlice, config.sliceIndex || 0));
  
  // Generate slice image data
  const sliceImageData = useMemo(() => {
    try {
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
        throw new Error("getSliceImageData returned null");
      }
      
      return imageData;
    } catch (error: any) {
      console.error("Error generating slice image data:", error);
      if (showDebug) {
        return { error: error.message || "Failed to generate slice" };
      }
      return null;
    }
  }, [volume, sliceZ, config.tr, config.te, config.flipAngle, config.window, config.level, showDebug]);
  
  // Render to canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    if (sliceImageData && !('error' in sliceImageData)) {
      canvas.width = sliceImageData.width;
      canvas.height = sliceImageData.height;
      ctx.putImageData(sliceImageData, 0, 0);
    } else {
      // Error state - show error message
      canvas.width = volume.width || 256;
      canvas.height = volume.height || 256;
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ff4444";
      ctx.font = "14px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ERRO ao gerar fatia", canvas.width / 2, canvas.height / 2);
      if (sliceImageData && 'error' in sliceImageData) {
        ctx.font = "10px monospace";
        ctx.fillStyle = "#ff8888";
        ctx.fillText(sliceImageData.error, canvas.width / 2, canvas.height / 2 + 20);
      }
    }
  }, [sliceImageData, volume]);
  
  // Calculate min/max intensity for debug
  const debugInfo = useMemo(() => {
    if (!showDebug || !volume) return null;
    
    const sliceVoxels = volume.voxels.filter(v => v.z === sliceZ);
    const signals = sliceVoxels.map(v => v.signal || 0);
    
    if (signals.length === 0) return null;
    
    return {
      minIntensity: Math.min(...signals),
      maxIntensity: Math.max(...signals),
      volumeDims: `${volume.width}×${volume.height}×${volume.depth}`,
      sliceIndex: sliceZ,
      preset: config.preset,
      status: volumeReady ? "OK" : "ERROR",
    };
  }, [volume, sliceZ, config.preset, volumeReady, showDebug]);
  
  return (
    <div className="w-full h-full flex items-center justify-center bg-background relative">
      <div className="relative" style={{ minWidth: "256px", minHeight: "256px" }}>
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full"
          style={{ 
            imageRendering: "pixelated",
            display: "block",
          }}
        />
        
        {/* Slice info overlay */}
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          Slice: {sliceZ} / {maxSlice}
        </div>
        
        {/* Debug overlay (admin mode only) */}
        {showDebug && (
          <div className="absolute top-2 right-2 bg-amber-500/90 text-black text-xs px-2 py-1 rounded font-mono space-y-0.5 max-w-xs">
            <div className="font-bold border-b border-black/20 pb-0.5">Store Debug</div>
            <div>ID: {storeInstanceId.slice(0, 12)}...</div>
            <div>Ready: {volumeReady ? "✅" : "❌"}</div>
            <div>Simulating: {isSimulating ? "⏳" : "✓"}</div>
            <div>Vol: {volume ? `${volume.width}×${volume.height}×${volume.depth}` : "null"}</div>
            <div>Voxels: {volume?.voxels?.length || 0}</div>
            {debugInfo && (
              <>
                <div className="border-t border-black/20 pt-0.5 mt-0.5">Slice: {debugInfo.sliceIndex}</div>
                <div>Int: {debugInfo.minIntensity.toFixed(2)} - {debugInfo.maxIntensity.toFixed(2)}</div>
                <div>Preset: {debugInfo.preset}</div>
              </>
            )}
            <div className="border-t border-black/20 pt-0.5 mt-0.5">Config Hash: {lastSimulatedConfigHash.slice(0, 20)}...</div>
            <div>Last Sim: {lastSimulationAt ? new Date(lastSimulationAt).toLocaleTimeString() : "never"}</div>
            {simulationError && (
              <div className="text-red-600 border-t border-black/20 pt-0.5 mt-0.5">Error: {simulationError}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
