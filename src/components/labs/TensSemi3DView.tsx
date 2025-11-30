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
    const pulseNorm = pulseWidthUs / 400; // 0-1

    // Velocidade de animação
    const animSpeed = Math.max(0.5, 2.5 - freqNorm * 2); // 0.5s-2.5s

    // Brilho dos eletrodos
    const electrodeGlow = 0.3 + intensityNorm * 0.6;

    // Profundidade de penetração (0-1)
    const basePenetration = intensityNorm * 0.7 + activationNorm * 0.3;
    // Ajustar pela anatomia
    const fatFactor = 1 - tissueConfig.fatThickness * 0.4; // gordura atenua
    const penetrationDepth = Math.min(1, basePenetration * fatFactor);

    // Densidade de linhas de corrente
    const currentLines = Math.round(3 + intensityNorm * 8); // 3-11 linhas

    // Risco e dano
    const riskLevel = riskResult?.riskLevel || "baixo";
    const damageIntensity =
      riskLevel === "alto" ? 0.8 : riskLevel === "moderado" ? 0.4 : 0.1;

    // Aquecimento de tecidos
    const thermalLoad = intensityNorm * 0.5 + pulseNorm * 0.3 + freqNorm * 0.2;

    // Hotspots (pontos de concentração)
    const hasHotspots = intensityNorm > 0.6 && (thermalLoad > 0.5 || riskLevel !== "baixo");

    return {
      intensityNorm,
      activationNorm,
      freqNorm,
      pulseNorm,
      animSpeed,
      electrodeGlow,
      penetrationDepth,
      currentLines,
      riskLevel,
      damageIntensity,
      thermalLoad,
      hasHotspots,
    };
  }, [frequencyHz, pulseWidthUs, intensitymA, mode, activationLevel, riskResult, tissueConfig]);

  // Dimensões das camadas (altura total ~200px)
  const layers = useMemo(() => {
    const total = 200;
    const skinH = Math.max(8, tissueConfig.skinThickness * 30);
    const fatH = tissueConfig.fatThickness * 80;
    const muscleH = tissueConfig.muscleThickness * 70;
    const remaining = total - skinH - fatH - muscleH;
    const boneH = Math.max(12, remaining);

    return { skin: skinH, fat: fatH, muscle: muscleH, bone: boneH };
  }, [tissueConfig]);

  // Posição do implante
  const implant = useMemo(() => {
    if (!tissueConfig.hasMetalImplant || !tissueConfig.metalImplantDepth) return null;
    const depth = tissueConfig.metalImplantDepth * 200;
    const span = (tissueConfig.metalImplantSpan || 0.6) * 100;
    return { depth, span };
  }, [tissueConfig]);

  return (
    <div className="relative w-full space-y-3">
      {/* HUD discreto no canto superior esquerdo */}
      <div className="absolute top-2 left-2 z-20 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded font-mono">
        {frequencyHz}Hz · {intensitymA}mA · {pulseWidthUs}µs · {mode}
      </div>

      {/* Badge de risco no canto superior direito */}
      {effects.riskLevel !== "baixo" && (
        <Badge
          variant="outline"
          className={`absolute top-2 right-2 z-20 ${
            effects.riskLevel === "alto"
              ? "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/50"
              : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/50"
          }`}
        >
          Risco {effects.riskLevel}
        </Badge>
      )}

      {/* PAINEL 1: Vista Superior (Pele + Eletrodos) */}
      <div className="bg-gradient-to-b from-background to-muted/30 rounded-lg p-4 border">
        <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Vista Superior – Eletrodos
        </h4>
        <div
          className="relative mx-auto rounded-lg overflow-hidden"
          style={{
            width: "100%",
            maxWidth: "400px",
            height: "140px",
            backgroundColor: "#F7D2C2",
            backgroundImage:
              "radial-gradient(circle at 30% 40%, rgba(255,255,255,0.2) 1px, transparent 1px)",
            backgroundSize: "8px 8px",
          }}
        >
          {/* Eletrodo esquerdo */}
          <div
            className="absolute top-1/2 -translate-y-1/2 rounded-lg shadow-xl"
            style={{
              left: "18%",
              width: "70px",
              height: "70px",
              background: "linear-gradient(135deg, #D1D5DB 0%, #9CA3AF 100%)",
              boxShadow:
                "0 4px 12px rgba(0,0,0,0.25), inset 0 2px 4px rgba(255,255,255,0.3)",
            }}
          >
            {/* Glow azul */}
            {effects.intensityNorm > 0.1 && (
              <div
                className="absolute inset-0 rounded-lg animate-pulse"
                style={{
                  background: `radial-gradient(circle, rgba(59, 130, 246, ${effects.electrodeGlow}) 0%, transparent 65%)`,
                  filter: "blur(10px)",
                  animationDuration: `${effects.animSpeed}s`,
                }}
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/60">
              +
            </div>
          </div>

          {/* Eletrodo direito */}
          <div
            className="absolute top-1/2 -translate-y-1/2 rounded-lg shadow-xl"
            style={{
              right: "18%",
              width: "70px",
              height: "70px",
              background: "linear-gradient(135deg, #D1D5DB 0%, #9CA3AF 100%)",
              boxShadow:
                "0 4px 12px rgba(0,0,0,0.25), inset 0 2px 4px rgba(255,255,255,0.3)",
            }}
          >
            {/* Glow vermelho */}
            {effects.intensityNorm > 0.1 && (
              <div
                className="absolute inset-0 rounded-lg animate-pulse"
                style={{
                  background: `radial-gradient(circle, rgba(239, 68, 68, ${effects.electrodeGlow}) 0%, transparent 65%)`,
                  filter: "blur(10px)",
                  animationDuration: `${effects.animSpeed}s`,
                  animationDelay: "0.1s",
                }}
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/60">
              −
            </div>
          </div>

          {/* Linhas de corrente entre eletrodos */}
          {effects.currentLines > 0 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {Array.from({ length: effects.currentLines }).map((_, i) => {
                const y = 30 + (i * 80) / effects.currentLines;
                const opacity = 0.3 + (effects.intensityNorm * 0.5);
                const strokeWidth = 1 + effects.intensityNorm * 1.5;

                // Padrão baseado no modo
                let pathD = `M 25% ${y} L 75% ${y}`;
                if (mode === "burst") {
                  // Grupos de linhas
                  const offset = (i % 3) * 3;
                  pathD = `M ${25 + offset}% ${y} L ${75 - offset}% ${y}`;
                } else if (mode === "modulado") {
                  // Ondulação
                  const curve = 10 * Math.sin((i / effects.currentLines) * Math.PI);
                  pathD = `M 25% ${y} Q 50% ${y + curve} 75% ${y}`;
                }

                return (
                  <path
                    key={i}
                    d={pathD}
                    stroke={`rgba(59, 130, 246, ${opacity})`}
                    strokeWidth={strokeWidth}
                    fill="none"
                    className={mode === "acupuntura" ? "animate-pulse" : ""}
                    style={{
                      animationDuration: `${effects.animSpeed * 0.7}s`,
                      animationDelay: `${i * 0.05}s`,
                    }}
                  />
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {/* PAINEL 2: Corte Lateral (Camadas Anatômicas) */}
      <div className="bg-gradient-to-b from-background to-muted/30 rounded-lg p-4 border">
        <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Corte Lateral – Anatomia
        </h4>
        <div className="relative mx-auto" style={{ width: "100%", maxWidth: "400px" }}>
          {/* Camada: Pele */}
          <div
            className="relative w-full"
            style={{
              height: `${layers.skin}px`,
              background: "linear-gradient(to bottom, #F7D2C2 0%, #F0C5B5 100%)",
              borderTop: "1px solid rgba(0,0,0,0.1)",
              borderLeft: "1px solid rgba(0,0,0,0.05)",
              borderRight: "1px solid rgba(0,0,0,0.05)",
            }}
          >
            {/* Textura */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
                backgroundSize: "6px 6px",
              }}
            />
            {/* Label */}
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-medium text-foreground/60">
              Pele
            </span>
          </div>

          {/* Camada: Gordura */}
          <div
            className="relative w-full overflow-hidden"
            style={{
              height: `${layers.fat}px`,
              background: effects.thermalLoad > 0.6
                ? "linear-gradient(to bottom, #F6E3B5 0%, #F5D89D 100%)" // mais quente
                : "linear-gradient(to bottom, #F6E3B5 0%, #F4E0A8 100%)",
              borderLeft: "1px solid rgba(0,0,0,0.05)",
              borderRight: "1px solid rgba(0,0,0,0.05)",
            }}
          >
            {/* Textura */}
            <div
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(255,255,255,0.6) 2px, transparent 2px)",
                backgroundSize: "12px 12px",
              }}
            />
            {/* Label */}
            <span className="absolute left-2 top-2 text-[9px] font-medium text-foreground/60">
              Gordura
            </span>

            {/* Ondas de campo na gordura */}
            {effects.penetrationDepth > 0.3 && (
              <div
                className="absolute inset-0 animate-pulse"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, ${
                    effects.intensityNorm * 0.2
                  }) 50%, transparent 100%)`,
                  filter: "blur(15px)",
                  animationDuration: `${effects.animSpeed * 1.5}s`,
                }}
              />
            )}
          </div>

          {/* Camada: Músculo */}
          <div
            className="relative w-full overflow-hidden"
            style={{
              height: `${layers.muscle}px`,
              background: "linear-gradient(to bottom, #D87A76 0%, #C96A66 100%)",
              borderLeft: "1px solid rgba(0,0,0,0.05)",
              borderRight: "1px solid rgba(0,0,0,0.05)",
            }}
          >
            {/* Fibras musculares base */}
            <svg className="absolute inset-0 w-full h-full opacity-20">
              {Array.from({ length: 40 }).map((_, i) => (
                <line
                  key={`base-${i}`}
                  x1={`${(i * 100) / 40}%`}
                  y1="0"
                  x2={`${(i * 100) / 40}%`}
                  y2="100%"
                  stroke="rgba(80, 30, 30, 0.5)"
                  strokeWidth="0.5"
                />
              ))}
            </svg>

            {/* Label */}
            <span className="absolute left-2 top-2 text-[9px] font-medium text-white/70">
              Músculo
            </span>

            {/* Fibras ativadas */}
            {effects.penetrationDepth > 0.5 && (
              <svg className="absolute inset-0 w-full h-full">
                {Array.from({ length: Math.round(effects.activationNorm * 15) }).map((_, i) => {
                  const x = 10 + (i * 80) / 15;
                  return (
                    <line
                      key={`active-${i}`}
                      x1={`${x}%`}
                      y1="0"
                      x2={`${x}%`}
                      y2="100%"
                      stroke={
                        mode === "acupuntura"
                          ? "rgba(251, 191, 36, 0.7)"
                          : "rgba(239, 68, 68, 0.6)"
                      }
                      strokeWidth="2"
                      className="animate-pulse"
                      style={{
                        animationDuration: `${effects.animSpeed}s`,
                        animationDelay: `${i * 0.05}s`,
                      }}
                    />
                  );
                })}
              </svg>
            )}

            {/* Hotspots de dano muscular */}
            {effects.hasHotspots && effects.damageIntensity > 0.3 && (
              <>
                <div
                  className="absolute rounded-full animate-pulse"
                  style={{
                    left: "30%",
                    top: "40%",
                    width: "40px",
                    height: "20px",
                    background: `radial-gradient(ellipse, rgba(239, 68, 68, ${
                      effects.damageIntensity * 0.7
                    }) 0%, transparent 70%)`,
                    filter: "blur(8px)",
                  }}
                />
                <div
                  className="absolute rounded-full animate-pulse"
                  style={{
                    right: "30%",
                    top: "60%",
                    width: "35px",
                    height: "18px",
                    background: `radial-gradient(ellipse, rgba(251, 146, 60, ${
                      effects.damageIntensity * 0.6
                    }) 0%, transparent 70%)`,
                    filter: "blur(8px)",
                    animationDelay: "0.3s",
                  }}
                />
              </>
            )}
          </div>

          {/* Implante metálico (se existir) */}
          {implant && (
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-sm"
              style={{
                top: `${implant.depth}px`,
                width: `${implant.span}%`,
                height: "8px",
                background: "linear-gradient(135deg, #9EA7B3 0%, #7C8A99 100%)",
                border: "1px solid rgba(0,0,0,0.3)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              {/* Hotspot de aquecimento no metal */}
              {effects.hasHotspots && effects.damageIntensity > 0.4 && (
                <div
                  className="absolute inset-0 rounded-sm animate-pulse"
                  style={{
                    background: `radial-gradient(ellipse, rgba(239, 68, 68, ${
                      effects.damageIntensity
                    }) 0%, transparent 80%)`,
                    filter: "blur(6px)",
                  }}
                />
              )}
            </div>
          )}

          {/* Camada: Osso */}
          <div
            className="relative w-full"
            style={{
              height: `${layers.bone}px`,
              background: "linear-gradient(to bottom, #E5E5E5 0%, #D0D0D0 100%)",
              borderBottom: "1px solid rgba(0,0,0,0.1)",
              borderLeft: "1px solid rgba(0,0,0,0.05)",
              borderRight: "1px solid rgba(0,0,0,0.05)",
            }}
          >
            {/* Textura óssea */}
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.1) 4px, rgba(0,0,0,0.1) 5px)",
              }}
            />
            {/* Label */}
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-medium text-foreground/60">
              Osso
            </span>

            {/* Destaque de risco em osso superficial */}
            {tissueConfig.boneDepth < 0.4 &&
              effects.intensityNorm > 0.7 &&
              effects.damageIntensity > 0.3 && (
                <div
                  className="absolute inset-0 animate-pulse"
                  style={{
                    background: `linear-gradient(180deg, rgba(239, 68, 68, ${
                      effects.damageIntensity * 0.5
                    }) 0%, transparent 100%)`,
                    animationDuration: `${effects.animSpeed * 2}s`,
                  }}
                />
              )}
          </div>

          {/* Raios de campo elétrico descendo */}
          {effects.penetrationDepth > 0.2 && (
            <svg
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{ zIndex: 10 }}
            >
              {/* Raio central */}
              <line
                x1="50%"
                y1="0"
                x2="50%"
                y2={`${Math.min(100, effects.penetrationDepth * 100)}%`}
                stroke={
                  effects.damageIntensity > 0.5
                    ? "rgba(239, 68, 68, 0.6)"
                    : effects.damageIntensity > 0.3
                    ? "rgba(251, 146, 60, 0.6)"
                    : "rgba(34, 197, 94, 0.5)"
                }
                strokeWidth="3"
                strokeDasharray={mode === "burst" ? "8 4" : "none"}
                className="animate-pulse"
                style={{
                  animationDuration: `${effects.animSpeed}s`,
                  filter: "drop-shadow(0 0 4px currentColor)",
                }}
              />

              {/* Raios laterais */}
              {effects.intensityNorm > 0.4 && (
                <>
                  <line
                    x1="35%"
                    y1="0"
                    x2="35%"
                    y2={`${Math.min(90, effects.penetrationDepth * 90)}%`}
                    stroke={
                      effects.damageIntensity > 0.4
                        ? "rgba(251, 146, 60, 0.4)"
                        : "rgba(59, 130, 246, 0.4)"
                    }
                    strokeWidth="2"
                    className="animate-pulse"
                    style={{
                      animationDuration: `${effects.animSpeed * 1.2}s`,
                      animationDelay: "0.1s",
                    }}
                  />
                  <line
                    x1="65%"
                    y1="0"
                    x2="65%"
                    y2={`${Math.min(90, effects.penetrationDepth * 90)}%`}
                    stroke={
                      effects.damageIntensity > 0.4
                        ? "rgba(251, 146, 60, 0.4)"
                        : "rgba(239, 68, 68, 0.4)"
                    }
                    strokeWidth="2"
                    className="animate-pulse"
                    style={{
                      animationDuration: `${effects.animSpeed * 1.2}s`,
                      animationDelay: "0.2s",
                    }}
                  />
                </>
              )}
            </svg>
          )}
        </div>
      </div>

      {/* PAINEL 3: Mapa de Dano/Segurança (Heatmap) */}
      <div className="bg-gradient-to-b from-background to-muted/30 rounded-lg p-4 border">
        <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Mapa de Segurança Tecidual
        </h4>
        <div
          className="relative mx-auto rounded overflow-hidden"
          style={{ width: "100%", maxWidth: "400px", height: "60px" }}
        >
          {/* Background gradiente baseado no risco */}
          <div
            className="absolute inset-0"
            style={{
              background:
                effects.damageIntensity > 0.6
                  ? "linear-gradient(to bottom, rgba(34, 197, 94, 0.3) 0%, rgba(251, 146, 60, 0.5) 40%, rgba(239, 68, 68, 0.7) 100%)"
                  : effects.damageIntensity > 0.3
                  ? "linear-gradient(to bottom, rgba(34, 197, 94, 0.4) 0%, rgba(251, 191, 36, 0.5) 60%, rgba(251, 146, 60, 0.4) 100%)"
                  : "linear-gradient(to bottom, rgba(34, 197, 94, 0.5) 0%, rgba(59, 130, 246, 0.3) 100%)",
            }}
          />

          {/* Grid de referência */}
          <svg className="absolute inset-0 w-full h-full opacity-20">
            {Array.from({ length: 5 }).map((_, i) => (
              <line
                key={`h-${i}`}
                x1="0"
                y1={`${(i * 100) / 5}%`}
                x2="100%"
                y2={`${(i * 100) / 5}%`}
                stroke="currentColor"
                strokeWidth="0.5"
              />
            ))}
            {Array.from({ length: 9 }).map((_, i) => (
              <line
                key={`v-${i}`}
                x1={`${(i * 100) / 9}%`}
                y1="0"
                x2={`${(i * 100) / 9}%`}
                y2="100%"
                stroke="currentColor"
                strokeWidth="0.5"
              />
            ))}
          </svg>

          {/* Hotspots de concentração */}
          {effects.hasHotspots && (
            <>
              <div
                className="absolute rounded-full animate-pulse"
                style={{
                  left: "30%",
                  top: `${50 + effects.penetrationDepth * 30}%`,
                  width: "60px",
                  height: "30px",
                  background: `radial-gradient(ellipse, rgba(239, 68, 68, ${
                    effects.damageIntensity * 0.8
                  }) 0%, transparent 70%)`,
                  filter: "blur(10px)",
                }}
              />
              <div
                className="absolute rounded-full animate-pulse"
                style={{
                  right: "30%",
                  top: `${50 + effects.penetrationDepth * 30}%`,
                  width: "60px",
                  height: "30px",
                  background: `radial-gradient(ellipse, rgba(239, 68, 68, ${
                    effects.damageIntensity * 0.8
                  }) 0%, transparent 70%)`,
                  filter: "blur(10px)",
                  animationDelay: "0.2s",
                }}
              />
            </>
          )}

          {/* Labels de profundidade */}
          <div className="absolute left-1 top-1 text-[8px] font-medium text-foreground/50">
            Superficial
          </div>
          <div className="absolute left-1 bottom-1 text-[8px] font-medium text-foreground/50">
            Profundo
          </div>

          {/* Legenda de cores */}
          <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] space-y-0.5">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-foreground/60">Seguro</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-foreground/60">Moderado</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-foreground/60">Risco</span>
            </div>
          </div>
        </div>
      </div>

      {/* Legenda de camadas (abaixo de tudo) */}
      <div className="bg-muted/50 rounded-lg px-3 py-2 border">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#F7D2C2" }} />
            <span className="text-foreground/70">
              Pele {Math.round(tissueConfig.skinThickness * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#F6E3B5" }} />
            <span className="text-foreground/70">
              Gordura {Math.round(tissueConfig.fatThickness * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#D87A76" }} />
            <span className="text-foreground/70">
              Músculo {Math.round(tissueConfig.muscleThickness * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#E5E5E5" }} />
            <span className="text-foreground/70">
              Osso prof. {Math.round(tissueConfig.boneDepth * 100)}%
            </span>
          </div>
          {tissueConfig.hasMetalImplant && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#9EA7B3" }} />
              <span className="text-foreground/70">Implante</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}