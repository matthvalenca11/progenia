/**
 * ThermalTimeline - Gráfico de temperatura vs tempo
 */

import { useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUltrasoundTherapyStore } from '@/stores/ultrasoundTherapyStore';

interface ThermalTimelineProps {
  className?: string;
}

export function ThermalTimeline({ className }: ThermalTimelineProps) {
  const { config, simulationResult } = useUltrasoundTherapyStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<Array<{ time: number; surface: number; target: number; cem43: number }>>([]);

  // Update history when simulation changes
  useEffect(() => {
    if (simulationResult) {
      const currentTime = config.duration; // minutes
      historyRef.current.push({
        time: currentTime,
        surface: simulationResult.surfaceTemp,
        target: simulationResult.targetTemp,
        cem43: simulationResult.thermalDose,
      });

      // Keep only last 100 points
      if (historyRef.current.length > 100) {
        historyRef.current.shift();
      }
    }
  }, [config.duration, simulationResult]);

  // Reset history when config changes significantly
  useEffect(() => {
    historyRef.current = [];
  }, [config.frequency, config.intensity, config.mode, config.movement, config.era]);

  // Draw graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (historyRef.current.length === 0) return;

    // Find ranges
    const maxTime = Math.max(...historyRef.current.map(h => h.time), config.duration);
    const minTemp = 37;
    const maxTemp = Math.max(
      ...historyRef.current.map(h => Math.max(h.surface, h.target)),
      50
    );

    // Draw grid
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (height - 2 * padding) * (1 - i / 5);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const temp = minTemp + (maxTemp - minTemp) * (i / 5);
      const y = padding + (height - 2 * padding) * (1 - i / 5);
      ctx.fillText(`${temp.toFixed(0)}°C`, padding - 5, y + 3);
    }

    ctx.textAlign = 'center';
    ctx.fillText('Tempo (min)', width / 2, height - 10);

    // Draw temperature lines
    if (historyRef.current.length > 1) {
      // Surface temperature (orange)
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.beginPath();
      historyRef.current.forEach((point, i) => {
        const x = padding + ((point.time / maxTime) * (width - 2 * padding));
        const y = padding + (height - 2 * padding) * (1 - (point.surface - minTemp) / (maxTemp - minTemp));
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Target temperature (blue)
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      historyRef.current.forEach((point, i) => {
        const x = padding + ((point.time / maxTime) * (width - 2 * padding));
        const y = padding + (height - 2 * padding) * (1 - (point.target - minTemp) / (maxTemp - minTemp));
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Draw markers for safety thresholds
      const safeThreshold = 42;
      if (maxTemp > safeThreshold) {
        const thresholdY = padding + (height - 2 * padding) * (1 - (safeThreshold - minTemp) / (maxTemp - minTemp));
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(padding, thresholdY);
        ctx.lineTo(width - padding, thresholdY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#ef4444';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Limite seguro (42°C)', padding + 5, thresholdY - 5);
      }
    }

    // Draw current point
    if (simulationResult && historyRef.current.length > 0) {
      const lastPoint = historyRef.current[historyRef.current.length - 1];
      const x = padding + ((lastPoint.time / maxTime) * (width - 2 * padding));
      
      // Surface point
      const surfaceY = padding + (height - 2 * padding) * (1 - (lastPoint.surface - minTemp) / (maxTemp - minTemp));
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(x, surfaceY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Target point
      const targetY = padding + (height - 2 * padding) * (1 - (lastPoint.target - minTemp) / (maxTemp - minTemp));
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, targetY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [historyRef.current, config.duration, simulationResult]);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Timeline Térmico</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            width={400}
            height={200}
            className="w-full h-48 border border-slate-700 rounded bg-slate-900"
          />
          <div className="flex items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-orange-500" />
              <span className="text-slate-400">Superficial</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-blue-500" />
              <span className="text-slate-400">Alvo</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
