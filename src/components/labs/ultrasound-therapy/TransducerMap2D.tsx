/**
 * TransducerMap2D - Mapa 2D clicável para posicionamento do transdutor
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useUltrasoundTherapyStore } from '@/stores/ultrasoundTherapyStore';

interface TransducerMap2DProps {
  className?: string;
}

export function TransducerMap2D({ className }: TransducerMap2DProps) {
  const { config, updateConfig } = useUltrasoundTherapyStore();

  // Convert position from -1 to 1 to 0-100% for display
  const xPercent = useMemo(() => ((config.transducerPosition?.x || 0) + 1) * 50, [config.transducerPosition?.x]);
  const yPercent = useMemo(() => ((config.transducerPosition?.y || 0) + 1) * 50, [config.transducerPosition?.y]);

  // Handle click on map
  const handleMapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1 to 1
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1; // -1 to 1
    
    // Clamp to -1 to 1
    const clampedX = Math.max(-1, Math.min(1, x));
    const clampedY = Math.max(-1, Math.min(1, y));
    
    updateConfig({
      transducerPosition: {
        x: clampedX,
        y: clampedY,
      },
    });
  }, [updateConfig]);

  // Animation state for scanning
  const [scanProgress, setScanProgress] = useState(0);

  // Calculate scanning trajectory (simple zig-zag pattern)
  const scanningTrajectory = useMemo(() => {
    if (config.movement !== "scanning") return null;
    
    // Simple zig-zag pattern centered on current position
    const centerX = config.transducerPosition?.x || 0;
    const centerY = config.transducerPosition?.y || 0;
    const steps = 20;
    const points: { x: number; y: number }[] = [];
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = centerX + (-0.4 + (t * 0.8)); // Range around center
      const y = centerY + Math.sin(t * Math.PI * 4) * 0.3; // Zig-zag pattern
      points.push({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
    }
    
    return points;
  }, [config.movement, config.transducerPosition]);

  // Animate scanning
  useEffect(() => {
    if (config.movement === "scanning" && scanningTrajectory) {
      const interval = setInterval(() => {
        setScanProgress((prev) => (prev + 1) % scanningTrajectory.length);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setScanProgress(0);
    }
  }, [config.movement, scanningTrajectory]);

  return (
    <div className={`space-y-2 ${className || ''}`}>
      <div className="text-xs text-slate-400 uppercase tracking-wide">Posição do Transdutor</div>
      <div 
        className="relative w-full h-48 bg-slate-800/50 border border-slate-700 rounded-lg cursor-crosshair overflow-hidden"
        onClick={handleMapClick}
        style={{ touchAction: 'none' }}
      >
        {/* Grid background */}
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full">
            {Array.from({ length: 5 }).map((_, i) => (
              <g key={i}>
                <line 
                  x1={`${(i + 1) * 20}%`} 
                  y1="0" 
                  x2={`${(i + 1) * 20}%`} 
                  y2="100%" 
                  stroke="currentColor" 
                  strokeWidth="1"
                  className="text-slate-600"
                />
                <line 
                  x1="0" 
                  y1={`${(i + 1) * 20}%`} 
                  x2="100%" 
                  y2={`${(i + 1) * 20}%`} 
                  stroke="currentColor" 
                  strokeWidth="1"
                  className="text-slate-600"
                />
              </g>
            ))}
          </svg>
        </div>

        {/* Scanning trajectory */}
        {scanningTrajectory && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <path
              d={`M ${scanningTrajectory.map((p, i) => {
                const x = ((p.x + 1) / 2) * 100;
                const y = ((p.y + 1) / 2) * 100;
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
              }).join(' ')}`}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray="4 4"
              opacity="0.6"
            />
            {/* Animated dot along trajectory */}
            {scanningTrajectory[scanProgress] && (
              <circle
                cx={((scanningTrajectory[scanProgress].x + 1) / 2) * 100 + '%'}
                cy={((scanningTrajectory[scanProgress].y + 1) / 2) * 100 + '%'}
                r="3"
                fill="#3b82f6"
                opacity="0.8"
              >
                <animate
                  attributeName="opacity"
                  values="0.8;0.3;0.8"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </svg>
        )}

        {/* Transducer position indicator */}
        <div
          className="absolute w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200"
          style={{
            left: `${xPercent}%`,
            top: `${yPercent}%`,
          }}
        >
          <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-75" />
        </div>

        {/* Center crosshair */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-full h-px bg-slate-600/30" />
          <div className="h-full w-px bg-slate-600/30" />
        </div>
      </div>
      <div className="text-[10px] text-slate-500 text-center">
        Clique no mapa para posicionar o transdutor
      </div>
    </div>
  );
}
