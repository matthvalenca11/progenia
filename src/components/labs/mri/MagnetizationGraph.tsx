/**
 * Magnetization Graph - Shows Mz(t) and Mxy(t) during RF pulse and relaxation
 */

import { useMemo, useRef, useEffect } from "react";
import { useMRILabStore } from "@/stores/mriLabStore";
import { TISSUE_PROPERTIES } from "@/types/mriLabConfig";

export function MagnetizationGraph() {
  const { config, simulationResult } = useMRILabStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const graphData = useMemo(() => {
    if (!simulationResult) return null;
    
    // Simulate magnetization evolution over time
    const timePoints: number[] = [];
    const mzPoints: number[] = [];
    const mxyPoints: number[] = [];
    
    const tissue = TISSUE_PROPERTIES.white_matter; // Use white matter as reference
    const t1 = tissue.t1;
    const t2 = tissue.t2;
    const pd = tissue.pd;
    
    const flipAngleRad = (config.flipAngle * Math.PI) / 180;
    const tr = config.tr;
    const te = config.te;
    
    // Simulate over 2 TR cycles
    const numPoints = 100;
    const maxTime = tr * 2;
    
    for (let i = 0; i < numPoints; i++) {
      const t = (i / numPoints) * maxTime;
      timePoints.push(t);
      
      // T1 recovery (longitudinal)
      const mz0 = pd; // Initial magnetization
      const mzEquilibrium = pd;
      const mz = mzEquilibrium - (mzEquilibrium - mz0 * Math.cos(flipAngleRad)) * Math.exp(-t / t1);
      
      // T2 decay (transverse)
      const mxy0 = pd * Math.sin(flipAngleRad);
      const mxy = mxy0 * Math.exp(-t / t2);
      
      mzPoints.push(mz);
      mxyPoints.push(mxy);
    }
    
    return { timePoints, mzPoints, mxyPoints };
  }, [config, simulationResult]);
  
  useEffect(() => {
    if (!canvasRef.current || !graphData) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = 20;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, width, height);
    
    // Draw axes
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Draw grid
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (graphHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    // Find min/max for scaling
    const allValues = [...graphData.mzPoints, ...graphData.mxyPoints];
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const range = maxVal - minVal || 0.001;
    
    // Draw Mz line (longitudinal - blue)
    ctx.strokeStyle = "#4A90E2";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < graphData.timePoints.length; i++) {
      const x = padding + (graphData.timePoints[i] / graphData.timePoints[graphData.timePoints.length - 1]) * graphWidth;
      const y = height - padding - ((graphData.mzPoints[i] - minVal) / range) * graphHeight;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Draw Mxy line (transverse - yellow)
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < graphData.timePoints.length; i++) {
      const x = padding + (graphData.timePoints[i] / graphData.timePoints[graphData.timePoints.length - 1]) * graphWidth;
      const y = height - padding - ((graphData.mxyPoints[i] - minVal) / range) * graphHeight;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = "#fff";
    ctx.font = "10px monospace";
    ctx.fillText("Mz (longitudinal)", padding + 5, padding + 12);
    ctx.fillText("Mxy (transverse)", padding + 5, padding + 24);
    ctx.fillText("Tempo (ms)", width / 2 - 30, height - 5);
  }, [graphData]);
  
  if (!graphData) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-muted-foreground text-xs">Carregando gráfico...</p>
      </div>
    );
  }
  
  return (
    <div className="w-full h-full p-2">
      <canvas
        ref={canvasRef}
        width={300}
        height={150}
        className="w-full h-full"
      />
    </div>
  );
}
