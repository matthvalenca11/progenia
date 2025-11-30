import { useMemo } from "react";
import { TensMode } from "@/lib/tensSimulation";
import { TissueConfig, RiskResult } from "@/types/tissueConfig";
import { Badge } from "@/components/ui/badge";

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

  // Cálculos derivados
  const effects = useMemo(() => {
    const intensityNorm = intensitymA / 80; // 0-1
    const activationNorm = activationLevel / 100; // 0-1
    const freqNorm = frequencyHz / 200; // 0-1

    // Velocidade de animação baseada na frequência
    const pulseSpeed = Math.max(0.4, 2 - freqNorm * 1.5); // 0.4s-2s

    // Brilho dos eletrodos
    const electrodeGlow = 0.2 + intensityNorm * 0.5; // 0.2-0.7

    // Profundidade de penetração
    const penetrationDepth = intensityNorm * 0.8 + activationNorm * 0.2; // 0-1

    // Padrão de ativação baseado no modo
    let wavePattern = "continuous";
    if (mode === "acupuntura") wavePattern = "flash";
    else if (mode === "burst") wavePattern = "burst";
    else if (mode === "modulado") wavePattern = "modulated";

    // Risco visual
    const hasRisk = riskResult && riskResult.riskLevel !== "baixo";
    const riskIntensity = hasRisk
      ? riskResult.riskLevel === "alto"
        ? 0.6
        : 0.3
      : 0;

    // Número de filamentos musculares ativos
    const muscleFilaments = Math.round(activationNorm * 12);

    return {
      intensityNorm,
      activationNorm,
      freqNorm,
      pulseSpeed,
      electrodeGlow,
      penetrationDepth,
      wavePattern,
      hasRisk,
      riskIntensity,
      muscleFilaments,
    };
  }, [frequencyHz, intensitymA, mode, activationLevel, riskResult]);

  // Dimensões das camadas (total ~280px altura)
  const totalHeight = 280;
  const layers = useMemo(() => {
    const skinH = tissueConfig.skinThickness * 50; // 0-50px
    const fatH = tissueConfig.fatThickness * 110; // 0-110px
    const muscleH = tissueConfig.muscleThickness * 100; // 0-100px
    const remaining = totalHeight - skinH - fatH - muscleH;
    const boneH = Math.max(20, remaining);

    return {
      skin: skinH,
      fat: fatH,
      muscle: muscleH,
      bone: boneH,
    };
  }, [tissueConfig]);

  // Posição do implante
  const implant = useMemo(() => {
    if (!tissueConfig.hasMetalImplant || !tissueConfig.metalImplantDepth) return null;

    const depth = tissueConfig.metalImplantDepth * totalHeight;
    const span = (tissueConfig.metalImplantSpan || 0.6) * 80; // % largura

    return { depth, span };
  }, [tissueConfig]);

  return (
    <div className="relative w-full h-[420px] bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 rounded-xl overflow-hidden">
      {/* HUD discreto no canto superior esquerdo */}
      <div className="absolute top-3 left-3 z-20 bg-black/40 backdrop-blur-sm text-white text-[10px] px-2.5 py-1.5 rounded-md font-mono space-y-0.5">
        <div className="flex gap-3">
          <span>{frequencyHz}Hz</span>
          <span>{intensitymA}mA</span>
          <span>{pulseWidthUs}µs</span>
        </div>
        <div className="text-[9px] opacity-70 capitalize">{mode}</div>
      </div>

      {/* Badge de risco (se houver) */}
      {effects.hasRisk && riskResult && (
        <Badge
          variant="outline"
          className={`absolute top-3 right-3 z-20 ${
            riskResult.riskLevel === "alto"
              ? "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/50"
              : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/50"
          }`}
        >
          Risco {riskResult.riskLevel}
        </Badge>
      )}

      {/* Container 3D principal */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          perspective: "1400px",
        }}
      >
        {/* Bloco de tecido com perspectiva */}
        <div
          className="relative shadow-2xl"
          style={{
            width: "340px",
            height: `${totalHeight + 40}px`,
            transformStyle: "preserve-3d",
            transform: "rotateX(28deg) rotateY(-12deg)",
          }}
        >
          {/* Camada 1: PELE (topo com eletrodos) */}
          <div
            className="absolute top-0 left-0 right-0 rounded-t-lg overflow-hidden"
            style={{
              height: `${layers.skin}px`,
              backgroundColor: "#F7D2C2",
              transformStyle: "preserve-3d",
              transform: "translateZ(25px)",
              boxShadow: "0 -3px 15px rgba(0,0,0,0.15)",
            }}
          >
            {/* Textura sutil da pele */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 25% 35%, rgba(255,255,255,0.4) 1px, transparent 1px)",
                backgroundSize: "6px 6px",
              }}
            />

            {/* Eletrodo esquerdo */}
            <div
              className="absolute top-1/2 left-[22%] -translate-x-1/2 -translate-y-1/2"
              style={{ width: "48px", height: "48px" }}
            >
              <div
                className="w-full h-full rounded-lg bg-gradient-to-br from-slate-300 to-slate-400 shadow-lg"
                style={{
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.3)",
                }}
              >
                {/* Glow dinâmico */}
                {effects.intensityNorm > 0.15 && (
                  <div
                    className="absolute inset-0 rounded-lg animate-pulse"
                    style={{
                      background: `radial-gradient(circle, rgba(59, 130, 246, ${effects.electrodeGlow}) 0%, transparent 70%)`,
                      filter: "blur(8px)",
                      animationDuration: `${effects.pulseSpeed}s`,
                    }}
                  />
                )}
              </div>
            </div>

            {/* Eletrodo direito */}
            <div
              className="absolute top-1/2 right-[22%] translate-x-1/2 -translate-y-1/2"
              style={{ width: "48px", height: "48px" }}
            >
              <div
                className="w-full h-full rounded-lg bg-gradient-to-br from-slate-300 to-slate-400 shadow-lg"
                style={{
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.3)",
                }}
              >
                {/* Glow dinâmico */}
                {effects.intensityNorm > 0.15 && (
                  <div
                    className="absolute inset-0 rounded-lg animate-pulse"
                    style={{
                      background: `radial-gradient(circle, rgba(239, 68, 68, ${effects.electrodeGlow}) 0%, transparent 70%)`,
                      filter: "blur(8px)",
                      animationDuration: `${effects.pulseSpeed}s`,
                      animationDelay: "0.15s",
                    }}
                  />
                )}
              </div>
            </div>

            {/* Halo na pele (baixa intensidade) */}
            {effects.intensityNorm > 0.1 && effects.intensityNorm < 0.4 && (
              <>
                <div
                  className="absolute top-1/2 left-[22%] -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full opacity-40"
                  style={{
                    background: "radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)",
                    filter: "blur(12px)",
                  }}
                />
                <div
                  className="absolute top-1/2 right-[22%] translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full opacity-40"
                  style={{
                    background: "radial-gradient(circle, rgba(239, 68, 68, 0.3) 0%, transparent 70%)",
                    filter: "blur(12px)",
                  }}
                />
              </>
            )}
          </div>

          {/* Camada 2: GORDURA */}
          <div
            className="absolute left-0 right-0 overflow-hidden"
            style={{
              top: `${layers.skin}px`,
              height: `${layers.fat}px`,
              backgroundColor: "#F6E3B5",
              transformStyle: "preserve-3d",
              transform: "translateZ(25px)",
              borderLeft: "1px solid rgba(0,0,0,0.05)",
              borderRight: "1px solid rgba(0,0,0,0.05)",
            }}
          >
            {/* Textura adiposa */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.6) 3px, transparent 3px)",
                backgroundSize: "14px 14px",
              }}
            />

            {/* Ondas difusas na gordura */}
            {effects.penetrationDepth > 0.2 && (
              <>
                <div
                  className="absolute inset-0 animate-pulse"
                  style={{
                    background: `linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, ${
                      effects.intensityNorm * 0.15
                    }) 50%, transparent 100%)`,
                    filter: "blur(20px)",
                    animationDuration: `${effects.pulseSpeed * 1.8}s`,
                  }}
                />
                {effects.wavePattern === "burst" && (
                  <div
                    className="absolute inset-0 animate-pulse"
                    style={{
                      background: `radial-gradient(ellipse at center, rgba(251, 191, 36, ${
                        effects.intensityNorm * 0.2
                      }) 0%, transparent 60%)`,
                      filter: "blur(15px)",
                      animationDuration: `${effects.pulseSpeed * 0.6}s`,
                    }}
                  />
                )}
              </>
            )}
          </div>

          {/* Camada 3: MÚSCULO */}
          <div
            className="absolute left-0 right-0 overflow-hidden"
            style={{
              top: `${layers.skin + layers.fat}px`,
              height: `${layers.muscle}px`,
              backgroundColor: "#D87A76",
              transformStyle: "preserve-3d",
              transform: "translateZ(25px)",
              borderLeft: "1px solid rgba(0,0,0,0.05)",
              borderRight: "1px solid rgba(0,0,0,0.05)",
            }}
          >
            {/* Fibras musculares (textura base) */}
            <svg className="absolute inset-0 w-full h-full opacity-25">
              {Array.from({ length: 60 }).map((_, i) => (
                <line
                  key={`fiber-base-${i}`}
                  x1={`${(i * 100) / 60}%`}
                  y1="0"
                  x2={`${(i * 100) / 60}%`}
                  y2="100%"
                  stroke="rgba(100, 40, 40, 0.4)"
                  strokeWidth="0.5"
                />
              ))}
            </svg>

            {/* Fibras musculares ativadas (dinâmicas) */}
            {effects.muscleFilaments > 0 && (
              <svg className="absolute inset-0 w-full h-full">
                {Array.from({ length: effects.muscleFilaments }).map((_, i) => {
                  const x = 15 + (i * 70) / effects.muscleFilaments;
                  const delay = (i * 0.08) % effects.pulseSpeed;
                  const isFlash = effects.wavePattern === "flash";

                  return (
                    <line
                      key={`fiber-active-${i}`}
                      x1={`${x}%`}
                      y1="0"
                      x2={`${x}%`}
                      y2="100%"
                      stroke={isFlash ? "rgba(251, 191, 36, 0.7)" : "rgba(239, 68, 68, 0.5)"}
                      strokeWidth="1.5"
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

            {/* Efeito de recrutamento profundo */}
            {effects.penetrationDepth > 0.5 && (
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse at center, rgba(239, 68, 68, ${
                    effects.activationNorm * 0.2
                  }) 0%, transparent 70%)`,
                  filter: "blur(25px)",
                }}
              />
            )}
          </div>

          {/* Implante metálico (se existir) */}
          {implant && (
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-md shadow-2xl"
              style={{
                top: `${implant.depth}px`,
                width: `${implant.span}%`,
                height: "10px",
                background: "linear-gradient(135deg, #9EA7B3 0%, #7C8A99 100%)",
                transformStyle: "preserve-3d",
                transform: "translateZ(27px)",
                border: "1px solid rgba(0,0,0,0.2)",
                boxShadow: effects.hasRisk
                  ? `0 0 20px rgba(251, 146, 60, ${effects.riskIntensity}), 0 4px 12px rgba(0,0,0,0.4)`
                  : "0 4px 12px rgba(0,0,0,0.4)",
              }}
            >
              {/* Hotspots de risco no metal */}
              {effects.hasRisk && (
                <>
                  <div
                    className="absolute top-1/2 left-1/4 w-2 h-2 rounded-full -translate-y-1/2 animate-pulse"
                    style={{
                      background: "rgba(251, 146, 60, 0.8)",
                      boxShadow: "0 0 8px rgba(251, 146, 60, 0.8)",
                    }}
                  />
                  <div
                    className="absolute top-1/2 right-1/4 w-2 h-2 rounded-full -translate-y-1/2 animate-pulse"
                    style={{
                      background: "rgba(251, 146, 60, 0.8)",
                      boxShadow: "0 0 8px rgba(251, 146, 60, 0.8)",
                      animationDelay: "0.3s",
                    }}
                  />
                </>
              )}
            </div>
          )}

          {/* Camada 4: OSSO */}
          <div
            className="absolute left-0 right-0 rounded-b-lg overflow-hidden"
            style={{
              top: `${layers.skin + layers.fat + layers.muscle}px`,
              height: `${layers.bone}px`,
              backgroundColor: "#E5E5E5",
              transformStyle: "preserve-3d",
              transform: "translateZ(25px)",
              borderLeft: "1px solid rgba(0,0,0,0.05)",
              borderRight: "1px solid rgba(0,0,0,0.05)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          >
            {/* Textura óssea */}
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "linear-gradient(45deg, rgba(0,0,0,0.08) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.08) 75%), linear-gradient(45deg, rgba(0,0,0,0.08) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.08) 75%)",
                backgroundSize: "10px 10px",
                backgroundPosition: "0 0, 5px 5px",
              }}
            />

            {/* Highlight de risco em osso superficial */}
            {tissueConfig.boneDepth < 0.4 && effects.intensityNorm > 0.7 && effects.hasRisk && (
              <div
                className="absolute inset-0 animate-pulse"
                style={{
                  background: `linear-gradient(180deg, rgba(251, 146, 60, ${effects.riskIntensity}) 0%, transparent 100%)`,
                  animationDuration: `${effects.pulseSpeed * 2}s`,
                }}
              />
            )}
          </div>

          {/* Face lateral esquerda (sombra/profundidade) */}
          <div
            className="absolute left-0 top-0 bg-black/20"
            style={{
              width: "6px",
              height: `${totalHeight + 20}px`,
              transformOrigin: "top left",
              transform: "rotateY(-90deg) translateZ(-20px)",
            }}
          />

          {/* Face lateral direita */}
          <div
            className="absolute right-0 top-0 bg-black/15"
            style={{
              width: "6px",
              height: `${totalHeight + 20}px`,
              transformOrigin: "top right",
              transform: "rotateY(90deg) translateZ(320px)",
            }}
          />
        </div>
      </div>

      {/* Legenda limpa abaixo da visualização */}
      <div className="absolute bottom-3 left-3 right-3 bg-white/80 dark:bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#F7D2C2" }} />
            <span className="text-foreground/80">
              Pele ({Math.round(tissueConfig.skinThickness * 100)}%)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#F6E3B5" }} />
            <span className="text-foreground/80">
              Gordura ({Math.round(tissueConfig.fatThickness * 100)}%)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#D87A76" }} />
            <span className="text-foreground/80">
              Músculo ({Math.round(tissueConfig.muscleThickness * 100)}%)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#E5E5E5" }} />
            <span className="text-foreground/80">
              Osso (prof: {Math.round(tissueConfig.boneDepth * 100)}%)
            </span>
          </div>
          {tissueConfig.hasMetalImplant && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#9EA7B3" }} />
              <span className="text-foreground/80">Implante</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}