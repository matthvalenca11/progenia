import { useMemo } from "react";
import { TensMode } from "@/lib/tensSimulation";
import { TissueConfig } from "@/types/tissueConfig";
import { RiskResult } from "@/types/tissueConfig";

interface TensSemi3DViewProps {
  frequencyHz: number;
  pulseWidthUs: number;
  intensitymA: number;
  mode: TensMode;
  activationLevel: number;
  comfortLevel: number;
  tissueConfig: TissueConfig;
  riskResult: RiskResult;
}

export function TensSemi3DView({
  frequencyHz,
  pulseWidthUs,
  intensitymA,
  mode,
  activationLevel,
  comfortLevel,
  tissueConfig,
  riskResult,
}: TensSemi3DViewProps) {
  // Normalize parameters
  const intensityNorm = Math.min(1, intensitymA / 80);
  const pulseNorm = (pulseWidthUs - 50) / (400 - 50);
  const freqNorm = (frequencyHz - 1) / (200 - 1);
  
  // Calculate penetration depth based on parameters and tissue
  const basePenetration = intensityNorm * 0.6 + pulseNorm * 0.3;
  const fatResistance = tissueConfig.fatThickness / 100;
  const penetrationDepth = Math.max(0.2, Math.min(0.9, basePenetration * (1 - fatResistance * 0.4)));
  
  // Calculate damage/thermal load
  const thermalLoad = intensityNorm * 0.5 + pulseNorm * 0.3 + freqNorm * 0.2;
  const damageScore = Math.max(0, Math.min(100, thermalLoad * 100 * (tissueConfig.hasMetalImplant ? 1.5 : 1)));
  
  // Calculate layer percentages
  const totalDepth = tissueConfig.skinThickness + tissueConfig.fatThickness + tissueConfig.muscleThickness;
  const skinPercent = (tissueConfig.skinThickness / totalDepth) * 100;
  const fatPercent = (tissueConfig.fatThickness / totalDepth) * 100;
  const musclePercent = (tissueConfig.muscleThickness / totalDepth) * 100;
  
  // Field line animation speed
  const animSpeed = Math.max(0.5, Math.min(3, frequencyHz / 80));
  
  // Calculate hotspots
  const hotspots = useMemo(() => {
    const spots = [];
    
    // Surface hotspot
    if (intensityNorm > 0.6) {
      spots.push({ x: 50, y: 10, intensity: intensityNorm * 0.8, size: 25 });
    }
    
    // Fat-muscle interface
    if (tissueConfig.fatThickness < 15 && intensityNorm > 0.5) {
      spots.push({ x: 50, y: skinPercent + fatPercent * 0.7, intensity: 0.6, size: 30 });
    }
    
    // Muscle-bone interface
    if (tissueConfig.boneDepth < 50 && intensityNorm > 0.6) {
      spots.push({ x: 50, y: skinPercent + fatPercent + musclePercent * 0.8, intensity: 0.8, size: 35 });
    }
    
    // Metal implant
    if (tissueConfig.hasMetalImplant && tissueConfig.metalImplantDepth && intensityNorm > 0.4) {
      const implantY = (tissueConfig.metalImplantDepth / totalDepth) * 100;
      spots.push({ x: 50, y: implantY, intensity: 1, size: 40 });
    }
    
    return spots;
  }, [intensityNorm, tissueConfig, skinPercent, fatPercent, musclePercent, totalDepth]);

  // Field lines
  const fieldLines = useMemo(() => {
    const lines = [];
    const numLines = Math.floor(3 + intensityNorm * 5);
    
    for (let i = 0; i < numLines; i++) {
      const offset = (i / numLines) * 60 - 30;
      const depth = penetrationDepth * (1 - Math.abs(offset) / 50);
      lines.push({ offset, depth, index: i });
    }
    
    return lines;
  }, [intensityNorm, penetrationDepth]);

  return (
    <div className="space-y-4">
      {/* TOP PANEL - Superior View */}
      <div className="relative w-full h-48 bg-gradient-to-br from-rose-100 to-rose-50 dark:from-rose-950/40 dark:to-rose-900/20 rounded-lg overflow-hidden border border-rose-200/50 dark:border-rose-800/30">
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)`
        }} />
        
        {/* Electrodes */}
        <div className="absolute left-[20%] top-1/2 -translate-y-1/2 w-20 h-20 bg-gradient-to-br from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 rounded-xl shadow-2xl border-2 border-slate-500/50"
          style={{
            boxShadow: `0 8px 16px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.3), ${intensityNorm > 0 ? `0 0 ${20 + intensityNorm * 30}px rgba(59, 130, 246, ${0.3 + intensityNorm * 0.4})` : ''}`
          }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-slate-700 dark:text-slate-300">+</span>
          </div>
          <div className="absolute inset-2 bg-gradient-to-br from-blue-100/40 to-cyan-100/40 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg" />
        </div>
        
        <div className="absolute right-[20%] top-1/2 -translate-y-1/2 w-20 h-20 bg-gradient-to-br from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 rounded-xl shadow-2xl border-2 border-slate-500/50"
          style={{
            boxShadow: `0 8px 16px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.3), ${intensityNorm > 0 ? `0 0 ${20 + intensityNorm * 30}px rgba(59, 130, 246, ${0.3 + intensityNorm * 0.4})` : ''}`
          }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-slate-700 dark:text-slate-300">−</span>
          </div>
          <div className="absolute inset-2 bg-gradient-to-br from-blue-100/40 to-cyan-100/40 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg" />
        </div>
        
        {/* Field lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {fieldLines.map((line, idx) => {
            const startX = `${20 + 10}%`;
            const endX = `${80 - 10}%`;
            const midY = `${50 + line.offset}%`;
            const curveDepth = line.depth * 30;
            
            const pathData = `M ${startX} ${midY} Q 50% ${50 + line.offset + curveDepth}%, ${endX} ${midY}`;
            
            return (
              <g key={idx}>
                <path
                  d={pathData}
                  fill="none"
                  stroke={`rgba(59, 130, 246, ${0.15 + intensityNorm * 0.3})`}
                  strokeWidth={2 + intensityNorm * 2}
                  className="transition-all duration-300"
                  style={{
                    filter: `drop-shadow(0 0 ${4 + intensityNorm * 6}px rgba(59, 130, 246, 0.4))`
                  }}
                />
                {intensityNorm > 0 && (
                  <circle r="3" fill="rgba(59, 130, 246, 0.8)" className="animate-pulse"
                    style={{
                      animationDuration: `${2 / animSpeed}s`,
                      animationDelay: `${idx * 0.1}s`
                    }}>
                    <animateMotion
                      dur={`${1.5 / animSpeed}s`}
                      repeatCount="indefinite"
                      path={pathData}
                    />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>
        
        {/* Mode patterns */}
        <div className="absolute inset-0 pointer-events-none">
          {mode === "burst" && intensityNorm > 0 && (
            <div className="absolute inset-0 bg-blue-400/5 animate-pulse" style={{ animationDuration: "0.5s" }} />
          )}
          {mode === "modulado" && intensityNorm > 0 && (
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/5 via-blue-400/10 to-blue-400/5"
              style={{ animation: "pulse 2s ease-in-out infinite" }} />
          )}
        </div>
      </div>

      {/* MIDDLE PANEL - Lateral Cut */}
      <div className="relative w-full h-80 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700">
        {/* Skin */}
        <div 
          className="absolute top-0 left-0 right-0 bg-gradient-to-b from-rose-200 to-rose-300 dark:from-rose-900/60 dark:to-rose-800/60"
          style={{ 
            height: `${skinPercent}%`,
            clipPath: 'polygon(0 0, 100% 0, 100% 90%, 0 95%)'
          }}
        >
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.05) 1px, rgba(0,0,0,0.05) 2px)'
          }} />
        </div>
        
        {/* Fat */}
        <div 
          className="absolute left-0 right-0 bg-gradient-to-b from-amber-200 to-amber-300 dark:from-amber-900/60 dark:to-amber-800/60"
          style={{ 
            top: `${skinPercent}%`,
            height: `${fatPercent}%`,
            clipPath: 'polygon(0 5%, 100% 10%, 100% 95%, 0 90%)',
            filter: thermalLoad > 0.5 ? `hue-rotate(${(thermalLoad - 0.5) * 40}deg) brightness(${1 + thermalLoad * 0.2})` : 'none'
          }}
        >
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(0,0,0,0.1) 1px, transparent 1px)',
            backgroundSize: '8px 8px'
          }} />
          {thermalLoad > 0.4 && (
            <div className="absolute inset-0">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="absolute h-1 bg-orange-400/30 blur-sm rounded-full animate-pulse"
                  style={{
                    top: `${20 + i * 30}%`,
                    left: `${30 - penetrationDepth * 10}%`,
                    right: `${30 - penetrationDepth * 10}%`,
                    animationDelay: `${i * 0.3}s`,
                    animationDuration: "2s"
                  }}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Muscle */}
        <div 
          className="absolute left-0 right-0 bg-gradient-to-b from-red-400 to-red-500 dark:from-red-900/70 dark:to-red-800/70"
          style={{ 
            top: `${skinPercent + fatPercent}%`,
            height: `${musclePercent}%`,
            clipPath: 'polygon(0 10%, 100% 5%, 100% 100%, 0 100%)'
          }}
        >
          <div className="absolute inset-0 opacity-40" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 4px)'
          }} />
          {activationLevel > 50 && (
            <>
              {[...Array(Math.floor(activationLevel / 20))].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 bg-gradient-to-b from-orange-400/60 to-red-600/60 rounded-full animate-pulse blur-[1px]"
                  style={{
                    left: `${15 + i * 20}%`,
                    top: `${20 + i * 15}%`,
                    height: `${30 + activationLevel / 3}%`,
                    animationDelay: `${i * 0.2}s`,
                    animationDuration: "1.5s"
                  }}
                />
              ))}
            </>
          )}
        </div>
        
        {/* Bone */}
        <div 
          className="absolute left-0 right-0 bottom-0 bg-gradient-to-b from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600"
          style={{ 
            height: `${Math.min(20, 100 - skinPercent - fatPercent - musclePercent)}%`
          }}
        >
          <div className="absolute inset-0 opacity-50" style={{
            backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '6px 6px'
          }} />
          {tissueConfig.boneDepth < 50 && intensityNorm > 0.6 && (
            <div className="absolute inset-0 bg-gradient-to-t from-red-500/30 to-transparent blur-md" />
          )}
        </div>
        
        {/* Metal implant */}
        {tissueConfig.hasMetalImplant && tissueConfig.metalImplantDepth && (
          <div
            className="absolute left-1/2 -translate-x-1/2 bg-gradient-to-br from-slate-400 to-slate-600 dark:from-slate-500 dark:to-slate-700 rounded-full shadow-2xl border-2 border-slate-500"
            style={{
              top: `${(tissueConfig.metalImplantDepth / totalDepth) * 100}%`,
              width: `${tissueConfig.metalImplantSpan || 40}px`,
              height: `${(tissueConfig.metalImplantSpan || 40) * 0.3}px`,
              boxShadow: intensityNorm > 0.4 ? `0 0 20px 5px rgba(239, 68, 68, ${intensityNorm * 0.6})` : '0 4px 8px rgba(0,0,0,0.3)'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-full" />
            {intensityNorm > 0.4 && (
              <div className="absolute -inset-4 bg-red-500/20 rounded-full blur-xl animate-pulse" />
            )}
          </div>
        )}
        
        {/* Field penetration */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <linearGradient id="fieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: 'rgb(34, 211, 238)', stopOpacity: 0.6 }} />
              <stop offset={`${penetrationDepth * 100}%`} style={{ stopColor: 'rgb(251, 191, 36)', stopOpacity: 0.4 }} />
              <stop offset="100%" style={{ stopColor: 'rgb(239, 68, 68)', stopOpacity: 0.1 }} />
            </linearGradient>
          </defs>
          
          {[...Array(5)].map((_, i) => {
            const xPos = 20 + i * 15;
            const depth = penetrationDepth * 100;
            
            return (
              <ellipse
                key={i}
                cx={`${xPos}%`}
                cy={depth / 2}
                rx="3"
                ry={depth / 2}
                fill="url(#fieldGradient)"
                opacity={0.3 + intensityNorm * 0.4}
                className="transition-all duration-300"
                style={{ filter: 'blur(2px)' }}
              />
            );
          })}
        </svg>
        
        {/* Hotspots */}
        {hotspots.map((spot, idx) => (
          <div
            key={idx}
            className="absolute rounded-full animate-pulse"
            style={{
              left: `${spot.x}%`,
              top: `${spot.y}%`,
              width: `${spot.size}px`,
              height: `${spot.size}px`,
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle, rgba(239, 68, 68, ${spot.intensity * 0.4}) 0%, transparent 70%)`,
              filter: 'blur(8px)',
              animationDuration: `${1.5 + idx * 0.5}s`
            }}
          />
        ))}
      </div>

      {/* BOTTOM PANEL - Heatmap */}
      <div className="relative w-full h-24 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 via-amber-500/20 to-red-500/20" />
        
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: 'rgb(34, 197, 94)', stopOpacity: 0.3 }} />
              <stop offset="50%" style={{ stopColor: 'rgb(251, 191, 36)', stopOpacity: riskResult.riskLevel === 'moderado' || riskResult.riskLevel === 'alto' ? 0.5 : 0.2 }} />
              <stop offset="100%" style={{ stopColor: 'rgb(239, 68, 68)', stopOpacity: riskResult.riskLevel === 'alto' ? 0.6 : 0.1 }} />
            </linearGradient>
          </defs>
          
          <rect x="0" y="0" width="100%" height="100%" fill="url(#riskGradient)" />
          
          {hotspots.map((spot, idx) => (
            <ellipse
              key={idx}
              cx={`${spot.x}%`}
              cy="50%"
              rx={`${spot.size / 2}%`}
              ry="30%"
              fill={`rgba(239, 68, 68, ${spot.intensity * 0.5})`}
              filter="blur(8px)"
            />
          ))}
        </svg>
        
        <div className="absolute inset-0 flex items-center justify-between px-4 text-xs font-medium text-slate-700 dark:text-slate-300">
          <span>Superficial</span>
          <span>Subcutâneo</span>
          <span>Muscular</span>
          <span>Profundo</span>
        </div>
      </div>
    </div>
  );
}
