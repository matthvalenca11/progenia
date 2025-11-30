import { useMemo } from "react";
import { TensMode } from "@/lib/tensSimulation";
import { TissueConfig, RiskResult } from "@/types/tissueConfig";

export interface TensSemi3DViewProps {
  frequencyHz: number;
  pulseWidthUs: number;
  intensitymA: number;
  mode: TensMode;
  activationLevel: number;
  comfortLevel: number;
  tissueConfig: TissueConfig;
  riskResult?: RiskResult;
}

export function TensSemi3DView(props: TensSemi3DViewProps) {
  const {
    frequencyHz,
    pulseWidthUs,
    intensitymA,
    mode,
    activationLevel,
    comfortLevel,
    tissueConfig,
    riskResult,
  } = props;

  // Cálculos derivados para animações e efeitos
  const effects = useMemo(() => {
    const intensityNorm = intensitymA / 80; // 0-1
    const activationNorm = activationLevel / 100; // 0-1
    const freqNorm = frequencyHz / 200; // 0-1
    const pulseNorm = pulseWidthUs / 400; // 0-1

    // Velocidade de pulsação baseada na frequência
    const pulseSpeed = 0.3 + freqNorm * 1.7; // 0.3s-2s

    // Brilho dos eletrodos
    const electrodeGlow = 0.3 + intensityNorm * 0.7; // 0.3-1.0

    // Profundidade de penetração
    let penetrationDepth = "superficial";
    if (intensityNorm > 0.7) penetrationDepth = "deep";
    else if (intensityNorm > 0.4) penetrationDepth = "subcutaneous";

    // Padrão de ativação baseado no modo
    let activationPattern = "continuous";
    if (mode === "acupuntura") activationPattern = "spike";
    else if (mode === "burst") activationPattern = "burst";
    else if (mode === "modulado") activationPattern = "wave";

    // Cor de risco
    let riskColor = "transparent";
    let riskOpacity = 0;
    if (riskResult) {
      if (riskResult.riskLevel === "alto") {
        riskColor = "rgb(239, 68, 68)"; // red-500
        riskOpacity = 0.4 + intensityNorm * 0.3;
      } else if (riskResult.riskLevel === "moderado") {
        riskColor = "rgb(251, 146, 60)"; // orange-400
        riskOpacity = 0.2 + intensityNorm * 0.2;
      }
    }

    // Intensidade de ativação muscular (número de fibras)
    const muscleActivation = Math.round(activationNorm * 20);

    return {
      intensityNorm,
      activationNorm,
      freqNorm,
      pulseNorm,
      pulseSpeed,
      electrodeGlow,
      penetrationDepth,
      activationPattern,
      riskColor,
      riskOpacity,
      muscleActivation,
    };
  }, [frequencyHz, pulseWidthUs, intensitymA, mode, activationLevel, riskResult]);

  // Altura das camadas em pixels (total ~300px)
  const totalHeight = 300;
  const layerHeights = useMemo(() => {
    const skin = tissueConfig.skinThickness * 40; // 0-40px
    const fat = tissueConfig.fatThickness * 100; // 0-100px
    const muscle = tissueConfig.muscleThickness * 120; // 0-120px
    const remaining = totalHeight - skin - fat - muscle;
    const bone = Math.max(20, remaining * 0.3); // min 20px

    return { skin, fat, muscle, bone };
  }, [tissueConfig]);

  const implantPosition = useMemo(() => {
    if (!tissueConfig.hasMetalImplant || !tissueConfig.metalImplantDepth) return null;
    
    const depth = tissueConfig.metalImplantDepth * totalHeight;
    const span = (tissueConfig.metalImplantSpan || 0.5) * 100; // % width
    
    return { depth, span };
  }, [tissueConfig]);

  return (
    <div className="relative w-full h-[400px] bg-gradient-to-b from-slate-900 to-slate-800 rounded-xl overflow-hidden">
      {/* Debug overlay - temporário */}
      <div className="absolute top-2 left-2 z-50 bg-black/70 text-white text-xs px-2 py-1 rounded font-mono">
        Freq: {frequencyHz}Hz | Int: {intensitymA}mA | Pulse: {pulseWidthUs}µs | {mode}
      </div>

      {/* Perspectiva 3D container */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{
          perspective: "1200px",
        }}
      >
        {/* Bloco de tecido com perspectiva oblíqua */}
        <div
          className="relative"
          style={{
            width: "320px",
            height: `${totalHeight + 60}px`,
            transformStyle: "preserve-3d",
            transform: "rotateX(20deg) rotateY(-15deg)",
          }}
        >
          {/* Tampa superior (pele com eletrodos) */}
          <div
            className="absolute top-0 left-0 right-0 bg-gradient-to-br from-pink-200 to-pink-300 border border-pink-400 rounded-t-lg"
            style={{
              height: `${layerHeights.skin}px`,
              transformStyle: "preserve-3d",
              transform: "translateZ(20px)",
              boxShadow: "0 -2px 10px rgba(0,0,0,0.3)",
            }}
          >
            {/* Textura da pele */}
            <div 
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: "radial-gradient(circle at 20% 30%, transparent 1px, rgba(255,255,255,0.3) 1px)",
                backgroundSize: "4px 4px",
              }}
            />

            {/* Eletrodos */}
            <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-700 border-2 border-slate-500 shadow-lg">
              <div 
                className="absolute inset-0 rounded-full animate-pulse"
                style={{
                  background: `radial-gradient(circle, rgba(59, 130, 246, ${effects.electrodeGlow}) 0%, transparent 70%)`,
                  animationDuration: `${effects.pulseSpeed}s`,
                }}
              />
            </div>
            <div className="absolute top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-700 border-2 border-slate-500 shadow-lg">
              <div 
                className="absolute inset-0 rounded-full animate-pulse"
                style={{
                  background: `radial-gradient(circle, rgba(239, 68, 68, ${effects.electrodeGlow}) 0%, transparent 70%)`,
                  animationDuration: `${effects.pulseSpeed}s`,
                  animationDelay: "0.1s",
                }}
              />
            </div>

            {/* Ondulações superficiais */}
            {effects.intensityNorm > 0.2 && (
              <>
                <div 
                  className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full animate-ping"
                  style={{
                    background: `radial-gradient(circle, rgba(59, 130, 246, ${effects.intensityNorm * 0.3}) 0%, transparent 70%)`,
                    animationDuration: `${effects.pulseSpeed}s`,
                  }}
                />
                <div 
                  className="absolute top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full animate-ping"
                  style={{
                    background: `radial-gradient(circle, rgba(239, 68, 68, ${effects.intensityNorm * 0.3}) 0%, transparent 70%)`,
                    animationDuration: `${effects.pulseSpeed}s`,
                    animationDelay: "0.1s",
                  }}
                />
              </>
            )}
          </div>

          {/* Camada de gordura */}
          <div
            className="absolute left-0 right-0 bg-gradient-to-br from-yellow-200 to-yellow-300 border-x border-yellow-400"
            style={{
              top: `${layerHeights.skin}px`,
              height: `${layerHeights.fat}px`,
              transformStyle: "preserve-3d",
              transform: "translateZ(20px)",
            }}
          >
            {/* Textura adiposa */}
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.5) 2px, transparent 2px)",
                backgroundSize: "12px 12px",
              }}
            />

            {/* Ondas difusas na gordura */}
            {effects.intensityNorm > 0.3 && effects.penetrationDepth !== "superficial" && (
              <div 
                className="absolute inset-0 animate-pulse"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, ${effects.intensityNorm * 0.2}) 50%, transparent 100%)`,
                  animationDuration: `${effects.pulseSpeed * 1.5}s`,
                }}
              />
            )}
          </div>

          {/* Camada muscular */}
          <div
            className="absolute left-0 right-0 bg-gradient-to-br from-red-400 to-red-500 border-x border-red-600 overflow-hidden"
            style={{
              top: `${layerHeights.skin + layerHeights.fat}px`,
              height: `${layerHeights.muscle}px`,
              transformStyle: "preserve-3d",
              transform: "translateZ(20px)",
            }}
          >
            {/* Fibras musculares */}
            <svg className="absolute inset-0 w-full h-full opacity-40">
              {Array.from({ length: 40 }).map((_, i) => (
                <line
                  key={i}
                  x1={`${(i * 100) / 40}%`}
                  y1="0"
                  x2={`${(i * 100) / 40 + 2}%`}
                  y2="100%"
                  stroke="rgba(127, 29, 29, 0.6)"
                  strokeWidth="1"
                />
              ))}
            </svg>

            {/* Ativação muscular - fibras acendem */}
            {effects.muscleActivation > 0 && (
              <svg className="absolute inset-0 w-full h-full">
                {Array.from({ length: effects.muscleActivation }).map((_, i) => {
                  const x = (i * 100) / 20;
                  const delay = (i * 0.05) % effects.pulseSpeed;
                  
                  return (
                    <line
                      key={i}
                      x1={`${x}%`}
                      y1="0"
                      x2={`${x + 2}%`}
                      y2="100%"
                      stroke={effects.activationPattern === "spike" ? "rgba(255, 255, 0, 0.8)" : "rgba(59, 130, 246, 0.6)"}
                      strokeWidth="2"
                      className="animate-pulse"
                      style={{
                        animationDuration: `${effects.pulseSpeed}s`,
                        animationDelay: `${delay}s`,
                      }}
                    />
                  );
                })}
              </svg>
            )}

            {/* Padrão burst */}
            {effects.activationPattern === "burst" && effects.intensityNorm > 0.5 && (
              <div 
                className="absolute inset-0 animate-pulse"
                style={{
                  background: `radial-gradient(ellipse at center, rgba(251, 191, 36, ${effects.intensityNorm * 0.4}) 0%, transparent 60%)`,
                  animationDuration: `${effects.pulseSpeed * 0.5}s`,
                }}
              />
            )}
          </div>

          {/* Implante metálico (se existir) */}
          {implantPosition && (
            <div
              className="absolute left-1/4 right-1/4 bg-gradient-to-br from-slate-400 to-slate-600 border border-slate-500 rounded-sm shadow-2xl"
              style={{
                top: `${implantPosition.depth}px`,
                height: "8px",
                width: `${implantPosition.span}%`,
                left: `${(100 - implantPosition.span) / 2}%`,
                transformStyle: "preserve-3d",
                transform: "translateZ(22px)",
                boxShadow: effects.riskOpacity > 0.2 
                  ? `0 0 20px ${effects.riskColor}` 
                  : "0 4px 10px rgba(0,0,0,0.5)",
              }}
            >
              {/* Hotspots de risco no metal */}
              {effects.riskOpacity > 0.2 && (
                <>
                  <div 
                    className="absolute top-0 left-1/4 w-2 h-2 rounded-full animate-pulse"
                    style={{
                      background: effects.riskColor,
                      boxShadow: `0 0 10px ${effects.riskColor}`,
                      opacity: effects.riskOpacity,
                    }}
                  />
                  <div 
                    className="absolute top-0 right-1/4 w-2 h-2 rounded-full animate-pulse"
                    style={{
                      background: effects.riskColor,
                      boxShadow: `0 0 10px ${effects.riskColor}`,
                      opacity: effects.riskOpacity,
                      animationDelay: "0.2s",
                    }}
                  />
                </>
              )}
            </div>
          )}

          {/* Camada óssea */}
          <div
            className="absolute left-0 right-0 bg-gradient-to-br from-slate-200 to-slate-300 border-x border-slate-400 rounded-b-lg"
            style={{
              top: `${layerHeights.skin + layerHeights.fat + layerHeights.muscle}px`,
              height: `${layerHeights.bone}px`,
              transformStyle: "preserve-3d",
              transform: "translateZ(20px)",
              boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
            }}
          >
            {/* Textura óssea */}
            <div 
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage: "linear-gradient(45deg, rgba(0,0,0,0.1) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.1) 75%), linear-gradient(45deg, rgba(0,0,0,0.1) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.1) 75%)",
                backgroundSize: "8px 8px",
                backgroundPosition: "0 0, 4px 4px",
              }}
            />

            {/* Destaque de risco em osso superficial */}
            {tissueConfig.boneDepth < 0.4 && effects.intensityNorm > 0.7 && (
              <div 
                className="absolute inset-0 animate-pulse"
                style={{
                  background: `linear-gradient(180deg, ${effects.riskColor} 0%, transparent 100%)`,
                  opacity: effects.riskOpacity,
                  animationDuration: `${effects.pulseSpeed * 2}s`,
                }}
              />
            )}
          </div>

          {/* Face lateral esquerda (sombra/profundidade) */}
          <div
            className="absolute left-0 top-0 w-4 bg-black/40"
            style={{
              height: `${totalHeight + 20}px`,
              transformOrigin: "top left",
              transform: "rotateY(-90deg) translateZ(-20px)",
            }}
          />

          {/* Face lateral direita */}
          <div
            className="absolute right-0 top-0 w-4 bg-black/30"
            style={{
              height: `${totalHeight + 20}px`,
              transformOrigin: "top right",
              transform: "rotateY(90deg) translateZ(300px)",
            }}
          />
        </div>
      </div>

      {/* Legenda de camadas */}
      <div className="absolute bottom-4 left-4 bg-black/60 text-white text-xs px-3 py-2 rounded-lg space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-pink-200 to-pink-300 border border-pink-400" />
          <span>Pele ({Math.round(tissueConfig.skinThickness * 100)}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-yellow-200 to-yellow-300 border border-yellow-400" />
          <span>Gordura ({Math.round(tissueConfig.fatThickness * 100)}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-red-400 to-red-500 border border-red-600" />
          <span>Músculo ({Math.round(tissueConfig.muscleThickness * 100)}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-slate-200 to-slate-300 border border-slate-400" />
          <span>Osso (prof: {Math.round(tissueConfig.boneDepth * 100)}%)</span>
        </div>
        {tissueConfig.hasMetalImplant && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-slate-400 to-slate-600 border border-slate-500" />
            <span>Implante metálico</span>
          </div>
        )}
      </div>

      {/* Indicador de risco */}
      {riskResult && riskResult.riskLevel !== "baixo" && (
        <div className="absolute top-4 right-4 bg-black/70 px-3 py-2 rounded-lg">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full animate-pulse"
              style={{
                backgroundColor: effects.riskColor,
                boxShadow: `0 0 10px ${effects.riskColor}`,
              }}
            />
            <span className="text-xs font-semibold" style={{ color: effects.riskColor }}>
              RISCO {riskResult.riskLevel.toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}