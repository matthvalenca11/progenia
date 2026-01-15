/**
 * Viewer 2: Slice 2D
 * Visualização de uma fatia do volume com intensidade baseada no sinal calculado
 * SEMPRE renderiza algo, nunca fica em loading infinito
 */

import { useMemo, useRef, useEffect, useState } from "react";
import { useMRILabStore } from "@/stores/mriLabStore";
import { getSliceImageData } from "@/simulation/mriEngine";

interface Slice2DViewerProps {
  showDebug?: boolean;
}

export function Slice2DViewer({ showDebug = false }: Slice2DViewerProps) {
  const { config, simulationResult } = useMRILabStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Generate slice data - ALWAYS returns something
  const sliceData = useMemo(() => {
    try {
      if (!simulationResult || !simulationResult.volume) {
        // Return placeholder data
        return {
          imageData: null,
          width: 256,
          height: 256,
          sliceZ: 0,
          maxSlice: 31,
          error: "Volume não disponível",
        };
      }
      
      const { volume } = simulationResult;
      
      // Validate volume
      if (!volume.voxels || volume.voxels.length === 0) {
        return {
          imageData: null,
          width: volume.width || 256,
          height: volume.height || 256,
          sliceZ: 0,
          maxSlice: Math.max(0, (volume.depth || 32) - 1),
          error: "Volume vazio (sem voxels)",
        };
      }
      
      // Clamp sliceIndex to valid range
      const maxSlice = Math.max(0, volume.depth - 1);
      const sliceZ = Math.max(0, Math.min(maxSlice, config.sliceIndex || 0));
      
      // Generate image data using pure function
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
        return {
          imageData: null,
          width: volume.width || 256,
          height: volume.height || 256,
          sliceZ,
          maxSlice,
          error: "Não foi possível gerar a fatia",
        };
      }
      
      setError(null);
      return {
        imageData,
        width: imageData.width,
        height: imageData.height,
        sliceZ,
        maxSlice,
        error: null,
      };
    } catch (err: any) {
      console.error("Error generating slice:", err);
      return {
        imageData: null,
        width: 256,
        height: 256,
        sliceZ: 0,
        maxSlice: 31,
        error: err.message || "Erro ao gerar fatia",
      };
    }
  }, [simulationResult, config.sliceIndex, config.tr, config.te, config.flipAngle, config.window, config.level]);
  
  // Render to canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    if (sliceData.imageData) {
      // Valid image data
      canvas.width = sliceData.width;
      canvas.height = sliceData.height;
      ctx.putImageData(sliceData.imageData, 0, 0);
    } else {
      // Error state - draw placeholder
      canvas.width = sliceData.width;
      canvas.height = sliceData.height;
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#666";
      ctx.font = "16px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Sem dados", canvas.width / 2, canvas.height / 2);
      if (sliceData.error) {
        ctx.font = "12px monospace";
        ctx.fillText(sliceData.error, canvas.width / 2, canvas.height / 2 + 20);
      }
    }
  }, [sliceData]);
  
  // Calculate min/max intensity for debug
  const debugInfo = useMemo(() => {
    if (!sliceData.imageData || !simulationResult?.volume) return null;
    
    const signals = simulationResult.volume.voxels
      .filter(v => v.z === sliceData.sliceZ)
      .map(v => v.signal || 0);
    
    if (signals.length === 0) return null;
    
    return {
      minIntensity: Math.min(...signals),
      maxIntensity: Math.max(...signals),
      volumeDims: {
        w: simulationResult.volume.width,
        h: simulationResult.volume.height,
        d: simulationResult.volume.depth,
      },
    };
  }, [sliceData, simulationResult]);
  
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
          Slice: {sliceData.sliceZ} / {sliceData.maxSlice}
        </div>
        
        {/* Debug info (admin mode only) */}
        {showDebug && debugInfo && (
          <div className="absolute top-2 right-2 bg-amber-500/90 text-black text-xs px-2 py-1 rounded font-mono">
            <div>Vol: {debugInfo.volumeDims.w}×{debugInfo.volumeDims.h}×{debugInfo.volumeDims.d}</div>
            <div>Slice: {sliceData.sliceZ}</div>
            <div>Int: {debugInfo.minIntensity.toFixed(2)} - {debugInfo.maxIntensity.toFixed(2)}</div>
          </div>
        )}
        
        {/* Error indicator (admin mode only) */}
        {showDebug && sliceData.error && (
          <div className="absolute top-2 left-2 bg-red-500/90 text-white text-xs px-2 py-1 rounded">
            ⚠ {sliceData.error}
          </div>
        )}
      </div>
    </div>
  );
}
