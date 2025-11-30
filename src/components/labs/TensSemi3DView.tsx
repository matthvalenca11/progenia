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
    tissueConfig,
    riskResult,
  } = props;

  // Cálculos físicos e fisiológicos
  const physics = useMemo(() => {
    const intensityNorm = intensitymA / 80;
    const activationNorm = activationLevel / 100;
    const freqNorm = frequencyHz / 200;
    const pulseNorm = pulseWidthUs / 400;

    // Profundidade de penetração baseada em intensidade e anatomia
    const basePenetration = intensityNorm * 0.85 + pulseNorm * 0.15;
    const fatAttenuation = 1 - tissueConfig.fatThickness * 0.5;
    const penetrationDepth = Math.min(0.95, basePenetration * fatAttenuation);

    // Densidade de linhas de campo
    const fieldLines = Math.round(4 + intensityNorm * 10);

    // Padrão de campo baseado no modo
    let fieldPattern = "continuous";
    let fieldSpread = 0.6; // largura lateral do campo
    if (mode === "convencional") {
      fieldPattern = "continuous";
      fieldSpread = 0.7; // mais disperso
    } else if (mode === "acupuntura") {
      fieldPattern = "narrow";
      fieldSpread = 0.4; // mais focado
    } else if (mode === "burst") {
      fieldPattern = "pulsed";
      fieldSpread = 0.5;
    } else if (mode === "modulado") {
      fieldPattern = "modulated";
      fieldSpread = 0.6;
    }

    // Velocidade de animação
    const animSpeed = Math.max(0.6, 2.2 - freqNorm * 1.6);

    // Risco e dano
    const riskLevel = riskResult?.riskLevel || "baixo";
    const damageScore =
      riskLevel === "alto" ? 0.85 : riskLevel === "moderado" ? 0.45 : 0.15;

    // Carga térmica
    const thermalLoad = intensityNorm * 0.5 + pulseNorm * 0.3 + freqNorm * 0.2;

    // Hotspots em interfaces críticas
    const interfaceHotspots = {
      skinFat: intensityNorm > 0.3 && thermalLoad > 0.4,
      fatMuscle: intensityNorm > 0.5 && penetrationDepth > 0.4,
      muscleBone:
        intensityNorm > 0.7 &&
        penetrationDepth > 0.7 &&
        tissueConfig.boneDepth < 0.5,
      implant:
        tissueConfig.hasMetalImplant &&
        intensityNorm > 0.5 &&
        (riskLevel === "moderado" || riskLevel === "alto"),
    };

    return {
      intensityNorm,
      activationNorm,
      freqNorm,
      pulseNorm,
      penetrationDepth,
      fieldLines,
      fieldPattern,
      fieldSpread,
      animSpeed,
      riskLevel,
      damageScore,
      thermalLoad,
      interfaceHotspots,
    };
  }, [frequencyHz, pulseWidthUs, intensitymA, mode, activationLevel, riskResult, tissueConfig]);

  // Geometria das camadas
  const layers = useMemo(() => {
    const total = 220;
    const skinH = Math.max(10, tissueConfig.skinThickness * 35);
    const fatH = tissueConfig.fatThickness * 90;
    const muscleH = tissueConfig.muscleThickness * 80;
    const remaining = total - skinH - fatH - muscleH;
    const boneH = Math.max(15, remaining);

    return {
      skin: skinH,
      fat: fatH,
      muscle: muscleH,
      bone: boneH,
      skinTop: 0,
      fatTop: skinH,
      muscleTop: skinH + fatH,
      boneTop: skinH + fatH + muscleH,
    };
  }, [tissueConfig]);

  // Posição do implante
  const implant = useMemo(() => {
    if (!tissueConfig.hasMetalImplant || !tissueConfig.metalImplantDepth) return null;
    const depth = tissueConfig.metalImplantDepth * 220;
    const span = (tissueConfig.metalImplantSpan || 0.65) * 100;
    return { depth, span };
  }, [tissueConfig]);

  return (
    <div className="relative w-full space-y-4">
      {/* HUD */}
      <div className="absolute top-2 left-2 z-30 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2.5 py-1.5 rounded font-mono shadow-lg">
        <div className="flex gap-3">
          <span>{frequencyHz}Hz</span>
          <span>{intensitymA}mA</span>
          <span>{pulseWidthUs}µs</span>
        </div>
        <div className="text-[9px] opacity-70 capitalize mt-0.5">{mode}</div>
      </div>

      {/* Badge de risco */}
      {physics.riskLevel !== "baixo" && (
        <Badge
          variant="outline"
          className={`absolute top-2 right-2 z-30 ${
            physics.riskLevel === "alto"
              ? "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/60 shadow-lg shadow-red-500/20"
              : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/60 shadow-lg shadow-amber-500/20"
          }`}
        >
          Risco {physics.riskLevel}
        </Badge>
      )}

      {/* PAINEL 1: Vista Superior com Eletrodos */}
      <div className="bg-gradient-to-br from-background via-muted/20 to-muted/40 rounded-xl p-5 border shadow-lg">
        <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Vista Superior – Superfície da Pele
        </h4>
        <div
          className="relative mx-auto rounded-xl overflow-hidden shadow-inner"
          style={{
            width: "100%",
            maxWidth: "450px",
            height: "160px",
            background: "linear-gradient(135deg, #F7D2C2 0%, #F0C0B0 100%)",
          }}
        >
          {/* Textura da pele */}
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 35% 45%, rgba(255,255,255,0.6) 1px, transparent 1px), radial-gradient(circle at 65% 55%, rgba(200,150,140,0.3) 1px, transparent 1px)",
              backgroundSize: "8px 8px, 12px 12px",
            }}
          />

          {/* Eletrodo esquerdo */}
          <div
            className="absolute top-1/2 -translate-y-1/2 rounded-xl shadow-2xl"
            style={{
              left: "16%",
              width: "85px",
              height: "85px",
            }}
          >
            {/* Base do eletrodo com gel */}
            <div
              className="absolute inset-0 rounded-xl"
              style={{
                background: "radial-gradient(circle at 40% 40%, #B8C5D0 0%, #9CA8B3 100%)",
                boxShadow:
                  "0 6px 20px rgba(0,0,0,0.35), inset 0 2px 6px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.2)",
              }}
            >
              {/* Textura de gel condutor */}
              <div
                className="absolute inset-1 rounded-lg opacity-20"
                style={{
                  background:
                    "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8) 0%, transparent 50%)",
                }}
              />
              {/* Marca + */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-white/70 drop-shadow-md">+</span>
              </div>
            </div>

            {/* Glow azul dinâmico */}
            {physics.intensityNorm > 0.12 && (
              <div
                className="absolute inset-0 rounded-xl animate-pulse"
                style={{
                  background: `radial-gradient(circle, rgba(59, 130, 246, ${
                    0.4 + physics.intensityNorm * 0.5
                  }) 0%, transparent 65%)`,
                  filter: "blur(14px)",
                  animationDuration: `${physics.animSpeed}s`,
                }}
              />
            )}

            {/* Sombra sobre pele */}
            <div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-full h-3 rounded-[50%] bg-black/15 blur-sm"
              style={{ transform: "translateX(-50%) translateY(4px)" }}
            />
          </div>

          {/* Eletrodo direito */}
          <div
            className="absolute top-1/2 -translate-y-1/2 rounded-xl shadow-2xl"
            style={{
              right: "16%",
              width: "85px",
              height: "85px",
            }}
          >
            {/* Base do eletrodo com gel */}
            <div
              className="absolute inset-0 rounded-xl"
              style={{
                background: "radial-gradient(circle at 40% 40%, #B8C5D0 0%, #9CA8B3 100%)",
                boxShadow:
                  "0 6px 20px rgba(0,0,0,0.35), inset 0 2px 6px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.2)",
              }}
            >
              {/* Textura de gel condutor */}
              <div
                className="absolute inset-1 rounded-lg opacity-20"
                style={{
                  background:
                    "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8) 0%, transparent 50%)",
                }}
              />
              {/* Marca - */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-white/70 drop-shadow-md pb-1">−</span>
              </div>
            </div>

            {/* Glow vermelho dinâmico */}
            {physics.intensityNorm > 0.12 && (
              <div
                className="absolute inset-0 rounded-xl animate-pulse"
                style={{
                  background: `radial-gradient(circle, rgba(239, 68, 68, ${
                    0.4 + physics.intensityNorm * 0.5
                  }) 0%, transparent 65%)`,
                  filter: "blur(14px)",
                  animationDuration: `${physics.animSpeed}s`,
                  animationDelay: "0.15s",
                }}
              />
            )}

            {/* Sombra sobre pele */}
            <div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-full h-3 rounded-[50%] bg-black/15 blur-sm"
              style={{ transform: "translateX(-50%) translateY(4px)" }}
            />
          </div>

          {/* Linhas de campo elétrico CURVAS entre eletrodos */}
          {physics.fieldLines > 0 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
              {Array.from({ length: physics.fieldLines }).map((_, i) => {
                const t = i / (physics.fieldLines - 1); // 0 a 1
                const yCenter = 50;
                const yOffset = (t - 0.5) * physics.fieldSpread * 60; // dispersão vertical
                const y = yCenter + yOffset;

                // Curvatura da elipse (mais rasa nas pontas)
                const curveFactor = Math.abs(yOffset) / 30;
                const controlY = y + curveFactor * 25;

                const opacity =
                  physics.fieldPattern === "pulsed"
                    ? 0.25 + (1 - Math.abs(t - 0.5) * 2) * 0.4
                    : 0.3 + (1 - Math.abs(t - 0.5) * 2) * 0.5;

                const strokeWidth =
                  physics.fieldPattern === "narrow"
                    ? 1.5 + (1 - Math.abs(t - 0.5) * 2) * 1.5
                    : 1 + (1 - Math.abs(t - 0.5) * 2) * 2;

                // Cor baseada em profundidade e dano
                let strokeColor = `rgba(59, 130, 246, ${opacity})`;
                if (physics.damageScore > 0.6) {
                  strokeColor = `rgba(239, 68, 68, ${opacity})`;
                } else if (physics.damageScore > 0.4) {
                  strokeColor = `rgba(251, 146, 60, ${opacity})`;
                }

                return (
                  <path
                    key={i}
                    d={`M 25,${y} Q 50,${controlY} 75,${y}`}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                    className={
                      physics.fieldPattern === "pulsed" || physics.fieldPattern === "modulated"
                        ? "animate-pulse"
                        : ""
                    }
                    style={{
                      animationDuration: `${physics.animSpeed * (0.8 + t * 0.4)}s`,
                      animationDelay: `${i * 0.05}s`,
                      filter: "drop-shadow(0 0 2px currentColor)",
                    }}
                    transform="translate(0, 0) scale(4, 1.6)"
                  />
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {/* PAINEL 2: Corte Lateral Anatômico */}
      <div className="bg-gradient-to-br from-background via-muted/20 to-muted/40 rounded-xl p-5 border shadow-lg">
        <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Corte Lateral – Camadas Anatômicas
        </h4>
        <div
          className="relative mx-auto rounded-lg overflow-hidden shadow-lg"
          style={{ width: "100%", maxWidth: "450px", height: "220px" }}
        >
          {/* Camada: PELE */}
          <div
            className="absolute left-0 right-0"
            style={{
              top: `${layers.skinTop}px`,
              height: `${layers.skin}px`,
              background: "linear-gradient(to right, #F7D2C2 0%, #F5CFC0 50%, #F3C8B8 100%)",
              clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 calc(100% - 2px))",
            }}
          >
            {/* Textura de pele */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 30% 40%, rgba(255,255,255,0.5) 1px, transparent 1px)",
                backgroundSize: "7px 7px",
              }}
            />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-foreground/60">
              Pele
            </span>

            {/* Eritema superficial (intensidade alta) */}
            {physics.interfaceHotspots.skinFat && (
              <div
                className="absolute inset-x-0 bottom-0 h-1/2 animate-pulse"
                style={{
                  background: `linear-gradient(to top, rgba(239, 68, 68, ${
                    physics.damageScore * 0.4
                  }) 0%, transparent 100%)`,
                  animationDuration: `${physics.animSpeed * 1.5}s`,
                }}
              />
            )}
          </div>

          {/* Camada: GORDURA */}
          <div
            className="absolute left-0 right-0"
            style={{
              top: `${layers.fatTop}px`,
              height: `${layers.fat}px`,
              background:
                physics.thermalLoad > 0.55
                  ? "linear-gradient(to right, #F6E3B5 0%, #F5D89D 50%, #F4D395 100%)"
                  : "linear-gradient(to right, #F6E3B5 0%, #F5DFB0 50%, #F4DBAA 100%)",
              clipPath:
                "polygon(0 2px, 100% 0, 100% calc(100% - 3px), 0 calc(100% - 1px))",
            }}
          >
            {/* Textura granulada */}
            <div
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.7) 2.5px, transparent 2.5px)",
                backgroundSize: "13px 13px",
              }}
            />
            <span className="absolute left-2 top-2 text-[10px] font-semibold text-foreground/60">
              Gordura
            </span>

            {/* Ondas de campo na gordura */}
            {physics.penetrationDepth > 0.35 && (
              <div
                className="absolute inset-0 animate-pulse"
                style={{
                  background: `radial-gradient(ellipse at 50% 30%, rgba(59, 130, 246, ${
                    physics.intensityNorm * 0.18
                  }) 0%, transparent 70%)`,
                  filter: "blur(20px)",
                  animationDuration: `${physics.animSpeed * 1.8}s`,
                }}
              />
            )}

            {/* Hotspot interface gordura-músculo */}
            {physics.interfaceHotspots.fatMuscle && (
              <>
                <div
                  className="absolute rounded-full animate-pulse"
                  style={{
                    left: "35%",
                    bottom: "15%",
                    width: "50px",
                    height: "25px",
                    background: `radial-gradient(ellipse, rgba(251, 146, 60, ${
                      physics.damageScore * 0.6
                    }) 0%, transparent 70%)`,
                    filter: "blur(10px)",
                  }}
                />
                <div
                  className="absolute rounded-full animate-pulse"
                  style={{
                    right: "32%",
                    bottom: "20%",
                    width: "45px",
                    height: "22px",
                    background: `radial-gradient(ellipse, rgba(251, 146, 60, ${
                      physics.damageScore * 0.5
                    }) 0%, transparent 70%)`,
                    filter: "blur(10px)",
                    animationDelay: "0.3s",
                  }}
                />
              </>
            )}
          </div>

          {/* Camada: MÚSCULO */}
          <div
            className="absolute left-0 right-0 overflow-hidden"
            style={{
              top: `${layers.muscleTop}px`,
              height: `${layers.muscle}px`,
              background: "linear-gradient(to right, #D87A76 0%, #D27068 50%, #CC6860 100%)",
              clipPath:
                "polygon(0 1px, 100% 3px, 100% calc(100% - 2px), 0 calc(100% - 1px))",
            }}
          >
            {/* Fibras musculares diagonais */}
            <svg className="absolute inset-0 w-full h-full opacity-25">
              {Array.from({ length: 50 }).map((_, i) => (
                <line
                  key={`fiber-${i}`}
                  x1={`${(i * 100) / 50}%`}
                  y1="0"
                  x2={`${(i * 100) / 50 + 5}%`}
                  y2="100%"
                  stroke="rgba(90, 35, 32, 0.6)"
                  strokeWidth="0.8"
                />
              ))}
            </svg>

            <span className="absolute left-2 top-2 text-[10px] font-semibold text-white/80 drop-shadow">
              Músculo
            </span>

            {/* Fibras ativas */}
            {physics.penetrationDepth > 0.55 && (
              <svg className="absolute inset-0 w-full h-full">
                {Array.from({ length: Math.round(physics.activationNorm * 18) }).map(
                  (_, i) => {
                    const x = 12 + (i * 76) / 18;
                    return (
                      <line
                        key={`active-${i}`}
                        x1={`${x}%`}
                        y1="0"
                        x2={`${x + 4}%`}
                        y2="100%"
                        stroke={
                          mode === "acupuntura"
                            ? "rgba(251, 191, 36, 0.75)"
                            : "rgba(239, 68, 68, 0.65)"
                        }
                        strokeWidth="2.5"
                        className="animate-pulse"
                        style={{
                          animationDuration: `${physics.animSpeed}s`,
                          animationDelay: `${i * 0.04}s`,
                          filter: "drop-shadow(0 0 2px currentColor)",
                        }}
                      />
                    );
                  }
                )}
              </svg>
            )}

            {/* Hotspots localizados no músculo */}
            {physics.interfaceHotspots.fatMuscle && physics.damageScore > 0.35 && (
              <>
                <div
                  className="absolute rounded-full animate-pulse"
                  style={{
                    left: "28%",
                    top: "35%",
                    width: "45px",
                    height: "25px",
                    background: `radial-gradient(ellipse, rgba(239, 68, 68, ${
                      physics.damageScore * 0.7
                    }) 0%, transparent 70%)`,
                    filter: "blur(9px)",
                  }}
                />
                <div
                  className="absolute rounded-full animate-pulse"
                  style={{
                    right: "30%",
                    top: "55%",
                    width: "40px",
                    height: "22px",
                    background: `radial-gradient(ellipse, rgba(239, 68, 68, ${
                      physics.damageScore * 0.65
                    }) 0%, transparent 70%)`,
                    filter: "blur(9px)",
                    animationDelay: "0.25s",
                  }}
                />
              </>
            )}

            {/* Hotspot interface músculo-osso */}
            {physics.interfaceHotspots.muscleBone && (
              <div
                className="absolute inset-x-0 bottom-0 h-1/3 animate-pulse"
                style={{
                  background: `linear-gradient(to top, rgba(239, 68, 68, ${
                    physics.damageScore * 0.55
                  }) 0%, transparent 100%)`,
                  animationDuration: `${physics.animSpeed * 1.8}s`,
                }}
              />
            )}
          </div>

          {/* Implante metálico (se existir) */}
          {implant && (
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-md overflow-hidden"
              style={{
                top: `${implant.depth}px`,
                width: `${implant.span}%`,
                height: "11px",
                background:
                  "linear-gradient(135deg, #A8B5C0 0%, #8A99A8 40%, #7A8896 60%, #6A7684 100%)",
                border: "1px solid rgba(0,0,0,0.35)",
                boxShadow: "0 3px 10px rgba(0,0,0,0.4), inset 0 1px 3px rgba(255,255,255,0.3)",
              }}
            >
              {/* Textura metálica */}
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                  backgroundSize: "20px 100%",
                }}
              />

              {/* Hotspot de aquecimento no implante */}
              {physics.interfaceHotspots.implant && (
                <>
                  <div
                    className="absolute inset-0 animate-pulse"
                    style={{
                      background: `radial-gradient(ellipse at center, rgba(239, 68, 68, ${
                        physics.damageScore * 0.8
                      }) 0%, transparent 70%)`,
                      filter: "blur(8px)",
                    }}
                  />
                  {/* Hotspots pontuais */}
                  <div
                    className="absolute top-1/2 left-1/4 w-2.5 h-2.5 rounded-full -translate-y-1/2 animate-pulse"
                    style={{
                      background: "rgba(239, 68, 68, 0.9)",
                      boxShadow: "0 0 10px rgba(239, 68, 68, 0.8)",
                    }}
                  />
                  <div
                    className="absolute top-1/2 right-1/4 w-2.5 h-2.5 rounded-full -translate-y-1/2 animate-pulse"
                    style={{
                      background: "rgba(239, 68, 68, 0.9)",
                      boxShadow: "0 0 10px rgba(239, 68, 68, 0.8)",
                      animationDelay: "0.35s",
                    }}
                  />
                </>
              )}
            </div>
          )}

          {/* Camada: OSSO */}
          <div
            className="absolute left-0 right-0"
            style={{
              top: `${layers.boneTop}px`,
              height: `${layers.bone}px`,
              background: "linear-gradient(to right, #E5E5E5 0%, #DBDBDB 50%, #D2D2D2 100%)",
              clipPath: "polygon(0 2px, 100% 1px, 100% 100%, 0 100%)",
            }}
          >
            {/* Textura cortical */}
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 30% 40%, rgba(255,255,255,0.6) 0.8px, transparent 0.8px), radial-gradient(circle at 70% 60%, rgba(100,100,100,0.3) 0.6px, transparent 0.6px)",
                backgroundSize: "8px 8px, 11px 11px",
              }}
            />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-foreground/60">
              Osso
            </span>

            {/* Halo de risco periosteal */}
            {physics.interfaceHotspots.muscleBone && (
              <div
                className="absolute inset-x-0 top-0 h-2/3 animate-pulse"
                style={{
                  background: `linear-gradient(to bottom, rgba(239, 68, 68, ${
                    physics.damageScore * 0.6
                  }) 0%, transparent 100%)`,
                  animationDuration: `${physics.animSpeed * 2.2}s`,
                }}
              />
            )}
          </div>

          {/* Linhas de campo descendo das camadas (elipses verticais) */}
          {physics.penetrationDepth > 0.25 && (
            <svg
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{ zIndex: 15 }}
            >
              {/* Campo central */}
              <ellipse
                cx="50%"
                cy={`${physics.penetrationDepth * 45}%`}
                rx={`${12 * physics.fieldSpread}%`}
                ry={`${physics.penetrationDepth * 50}%`}
                fill="none"
                stroke={
                  physics.damageScore > 0.6
                    ? "rgba(239, 68, 68, 0.5)"
                    : physics.damageScore > 0.4
                    ? "rgba(251, 146, 60, 0.45)"
                    : "rgba(59, 130, 246, 0.4)"
                }
                strokeWidth="2.5"
                className="animate-pulse"
                style={{
                  animationDuration: `${physics.animSpeed}s`,
                  filter: "drop-shadow(0 0 4px currentColor)",
                }}
              />

              {/* Campos laterais */}
              {physics.intensityNorm > 0.45 && (
                <>
                  <ellipse
                    cx="35%"
                    cy={`${physics.penetrationDepth * 42}%`}
                    rx={`${8 * physics.fieldSpread}%`}
                    ry={`${physics.penetrationDepth * 45}%`}
                    fill="none"
                    stroke={
                      physics.damageScore > 0.5
                        ? "rgba(251, 146, 60, 0.35)"
                        : "rgba(59, 130, 246, 0.35)"
                    }
                    strokeWidth="2"
                    className="animate-pulse"
                    style={{
                      animationDuration: `${physics.animSpeed * 1.3}s`,
                      animationDelay: "0.15s",
                    }}
                  />
                  <ellipse
                    cx="65%"
                    cy={`${physics.penetrationDepth * 42}%`}
                    rx={`${8 * physics.fieldSpread}%`}
                    ry={`${physics.penetrationDepth * 45}%`}
                    fill="none"
                    stroke={
                      physics.damageScore > 0.5
                        ? "rgba(251, 146, 60, 0.35)"
                        : "rgba(239, 68, 68, 0.35)"
                    }
                    strokeWidth="2"
                    className="animate-pulse"
                    style={{
                      animationDuration: `${physics.animSpeed * 1.3}s`,
                      animationDelay: "0.25s",
                    }}
                  />
                </>
              )}
            </svg>
          )}
        </div>
      </div>

      {/* PAINEL 3: Heatmap de Segurança */}
      <div className="bg-gradient-to-br from-background via-muted/20 to-muted/40 rounded-xl p-5 border shadow-lg">
        <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Mapa de Segurança Tecidual
        </h4>
        <div
          className="relative mx-auto rounded-lg overflow-hidden shadow-inner"
          style={{ width: "100%", maxWidth: "450px", height: "70px" }}
        >
          {/* Gradiente base */}
          <div
            className="absolute inset-0"
            style={{
              background:
                physics.damageScore > 0.65
                  ? "linear-gradient(to bottom, rgba(34, 197, 94, 0.25) 0%, rgba(251, 146, 60, 0.5) 35%, rgba(239, 68, 68, 0.75) 100%)"
                  : physics.damageScore > 0.4
                  ? "linear-gradient(to bottom, rgba(34, 197, 94, 0.4) 0%, rgba(251, 191, 36, 0.5) 50%, rgba(251, 146, 60, 0.5) 100%)"
                  : "linear-gradient(to bottom, rgba(34, 197, 94, 0.5) 0%, rgba(59, 130, 246, 0.35) 100%)",
            }}
          />

          {/* Grid sutil */}
          <svg className="absolute inset-0 w-full h-full opacity-15">
            {Array.from({ length: 6 }).map((_, i) => (
              <line
                key={`h-${i}`}
                x1="0"
                y1={`${(i * 100) / 6}%`}
                x2="100%"
                y2={`${(i * 100) / 6}%`}
                stroke="currentColor"
                strokeWidth="0.5"
              />
            ))}
            {Array.from({ length: 12 }).map((_, i) => (
              <line
                key={`v-${i}`}
                x1={`${(i * 100) / 12}%`}
                y1="0"
                x2={`${(i * 100) / 12}%`}
                y2="100%"
                stroke="currentColor"
                strokeWidth="0.5"
              />
            ))}
          </svg>

          {/* Manchas irregulares de risco (orgânicas) */}
          {physics.damageScore > 0.3 && (
            <>
              {/* Região central profunda */}
              <div
                className="absolute rounded-full animate-pulse"
                style={{
                  left: "38%",
                  top: `${55 + physics.penetrationDepth * 25}%`,
                  width: "80px",
                  height: "35px",
                  background: `radial-gradient(ellipse, rgba(239, 68, 68, ${
                    physics.damageScore * 0.75
                  }) 0%, rgba(251, 146, 60, ${physics.damageScore * 0.4}) 50%, transparent 80%)`,
                  filter: "blur(12px)",
                  transform: "rotate(-8deg)",
                }}
              />
              <div
                className="absolute rounded-full animate-pulse"
                style={{
                  right: "35%",
                  top: `${58 + physics.penetrationDepth * 22}%`,
                  width: "70px",
                  height: "32px",
                  background: `radial-gradient(ellipse, rgba(239, 68, 68, ${
                    physics.damageScore * 0.7
                  }) 0%, rgba(251, 146, 60, ${physics.damageScore * 0.35}) 50%, transparent 80%)`,
                  filter: "blur(12px)",
                  transform: "rotate(12deg)",
                  animationDelay: "0.3s",
                }}
              />

              {/* Hotspots nas interfaces */}
              {physics.interfaceHotspots.fatMuscle && (
                <>
                  <div
                    className="absolute rounded-full animate-pulse"
                    style={{
                      left: "30%",
                      top: "35%",
                      width: "45px",
                      height: "20px",
                      background: `radial-gradient(ellipse, rgba(251, 146, 60, ${
                        physics.damageScore * 0.65
                      }) 0%, transparent 70%)`,
                      filter: "blur(8px)",
                      transform: "rotate(-15deg)",
                    }}
                  />
                  <div
                    className="absolute rounded-full animate-pulse"
                    style={{
                      right: "28%",
                      top: "40%",
                      width: "42px",
                      height: "18px",
                      background: `radial-gradient(ellipse, rgba(251, 146, 60, ${
                        physics.damageScore * 0.6
                      }) 0%, transparent 70%)`,
                      filter: "blur(8px)",
                      transform: "rotate(18deg)",
                      animationDelay: "0.4s",
                    }}
                  />
                </>
              )}

              {/* Hotspot do implante */}
              {physics.interfaceHotspots.implant && implant && (
                <div
                  className="absolute rounded-full animate-pulse"
                  style={{
                    left: "50%",
                    top: `${(implant.depth / 220) * 100}%`,
                    transform: "translateX(-50%)",
                    width: `${implant.span * 0.7}%`,
                    height: "25px",
                    background: `radial-gradient(ellipse, rgba(239, 68, 68, ${
                      physics.damageScore * 0.85
                    }) 0%, transparent 75%)`,
                    filter: "blur(10px)",
                  }}
                />
              )}
            </>
          )}

          {/* Labels */}
          <div className="absolute left-2 top-1.5 text-[9px] font-medium text-foreground/60">
            Superficial
          </div>
          <div className="absolute left-2 bottom-1.5 text-[9px] font-medium text-foreground/60">
            Profundo
          </div>

          {/* Legenda de cores */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm" />
              <span className="text-foreground/70 font-medium">Seguro</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500 shadow-sm" />
              <span className="text-foreground/70 font-medium">Moderado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500 shadow-sm" />
              <span className="text-foreground/70 font-medium">Risco</span>
            </div>
          </div>
        </div>
      </div>

      {/* Legenda final de camadas */}
      <div className="bg-muted/40 rounded-lg px-4 py-2.5 border">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[10px]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: "#F7D2C2" }} />
            <span className="text-foreground/80 font-medium">
              Pele {Math.round(tissueConfig.skinThickness * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: "#F6E3B5" }} />
            <span className="text-foreground/80 font-medium">
              Gordura {Math.round(tissueConfig.fatThickness * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: "#D87A76" }} />
            <span className="text-foreground/80 font-medium">
              Músculo {Math.round(tissueConfig.muscleThickness * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: "#E5E5E5" }} />
            <span className="text-foreground/80 font-medium">
              Osso prof. {Math.round(tissueConfig.boneDepth * 100)}%
            </span>
          </div>
          {tissueConfig.hasMetalImplant && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: "#9EA7B3" }} />
              <span className="text-foreground/80 font-medium">Implante</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}