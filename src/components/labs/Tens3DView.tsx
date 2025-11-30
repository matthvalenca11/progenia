import { useMemo, useState } from "react";

interface Tens3DViewProps {
  activationLevel: number;
  comfortLevel: number;
  frequency: number;
  intensity: number;
  pulseWidth: number;
  mode: "convencional" | "acupuntura" | "burst" | "modulado";
}

export function Tens3DView({
  activationLevel,
  comfortLevel,
  frequency,
  intensity,
  pulseWidth,
  mode,
}: Tens3DViewProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // Determinar velocidade de animação baseada na frequência
  const animationSpeed = useMemo(() => {
    if (frequency <= 20) return { duration: "3s", class: "animate-pulse-slow" };
    if (frequency <= 80) return { duration: "1.5s", class: "animate-pulse-medium" };
    return { duration: "0.8s", class: "animate-pulse-fast" };
  }, [frequency]);

  // Determinar cores holográficas baseadas no conforto
  const hologramColors = useMemo(() => {
    if (comfortLevel >= 70) {
      return {
        primary: "rgba(0, 235, 255, 0.8)", // cyan
        secondary: "rgba(11, 185, 255, 0.6)", // electric blue
        glow: "rgba(0, 235, 255, 0.3)",
      };
    }
    if (comfortLevel >= 40) {
      return {
        primary: "rgba(255, 217, 102, 0.8)", // neon amber
        secondary: "rgba(255, 165, 0, 0.6)",
        glow: "rgba(255, 217, 102, 0.3)",
      };
    }
    return {
      primary: "rgba(255, 107, 107, 0.8)", // neural red
      secondary: "rgba(255, 82, 82, 0.6)",
      glow: "rgba(255, 107, 107, 0.3)",
    };
  }, [comfortLevel]);

  // Calcular opacidade e brilho baseado na intensidade
  const baseOpacity = intensity > 0 ? 0.3 + (intensity / 100) * 0.7 : 0;
  const glowIntensity = intensity > 0 ? 0.5 + (intensity / 100) * 0.5 : 0;
  
  // Calcular espessura dos filamentos baseada na largura de pulso
  const filamentThickness = 1.5 + (pulseWidth / 400) * 4; // 1.5-5.5px
  
  // Microparallax effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
    setMousePos({ x: x * 20, y: y * 20 });
  };

  // Determinar padrão de ativação baseado no modo
  const modePattern = useMemo(() => {
    switch (mode) {
      case "acupuntura":
        return "spike"; // spikes curtos e fortes
      case "burst":
        return "burst"; // pacotes de ondas
      case "modulado":
        return "wave"; // ondas crescentes/decrescentes
      default:
        return "continuous"; // fluxo contínuo
    }
  }, [mode]);

  return (
    <div 
      className="relative w-full h-[500px] bg-gradient-to-br from-[#0a1628] via-[#1a2332] to-[#0f1b2d] rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(0,235,255,0.15)] backdrop-blur-xl border border-cyan-500/20"
      onMouseMove={handleMouseMove}
      style={{
        background: `
          radial-gradient(circle at 30% 50%, rgba(135, 91, 255, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 70% 50%, rgba(0, 235, 255, 0.06) 0%, transparent 50%),
          linear-gradient(135deg, #0a1628 0%, #1a2332 50%, #0f1b2d 100%)
        `
      }}
    >
      {/* Holographic Grid Background */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="absolute inset-0" 
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,235,255,0.4) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,235,255,0.4) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />
      </div>
      
      {/* Glow Orbs */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl" />

      {/* Holographic 3D Container */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{
          perspective: '1500px',
          perspectiveOrigin: 'center center',
        }}
      >
        <div 
          className="relative w-[85%] h-[80%] transition-transform duration-300 ease-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${5 + mousePos.y * 0.3}deg) rotateY(${-3 + mousePos.x * 0.3}deg)`,
          }}
        >
          {/* Camada 3: Músculo (profunda) - Holográfica */}
          <div
            className="absolute inset-0 rounded-3xl transition-all duration-500"
            style={{
              transform: 'translateZ(-50px)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Base muscular holográfica */}
            <div 
              className="absolute inset-0 rounded-3xl backdrop-blur-sm border shadow-[0_0_60px_rgba(255,107,107,0.2)]"
              style={{
                background: `
                  linear-gradient(135deg, 
                    rgba(139, 0, 0, 0.3) 0%, 
                    rgba(178, 34, 34, 0.25) 50%, 
                    rgba(139, 0, 0, 0.3) 100%)
                `,
                borderColor: 'rgba(255, 107, 107, 0.3)',
              }}
            >
              {/* Textura neural muscular */}
              <div className="absolute inset-0 opacity-15"
                style={{
                  backgroundImage: `repeating-linear-gradient(
                    45deg,
                    transparent,
                    transparent 12px,
                    rgba(255,107,107,0.15) 12px,
                    rgba(255,107,107,0.15) 24px
                  )`
                }}
              />
              {/* Glow interno */}
              <div className="absolute inset-0 bg-gradient-radial from-red-500/10 via-transparent to-transparent blur-xl" />
            </div>

            {/* Filamentos neurais profundos */}
            {intensity > 40 && (
              <div 
                className={`absolute inset-0 ${animationSpeed.class}`}
                style={{ opacity: baseOpacity * 0.8 }}
              >
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 400">
                  <defs>
                    <filter id="neural-glow-deep">
                      <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                    <linearGradient id="neural-grad-deep" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={hologramColors.primary} stopOpacity="0.6" />
                      <stop offset="50%" stopColor={hologramColors.secondary} stopOpacity="0.8" />
                      <stop offset="100%" stopColor={hologramColors.primary} stopOpacity="0.6" />
                    </linearGradient>
                  </defs>
                  
                  {/* Filamentos volumétricos */}
                  {[...Array(5)].map((_, i) => (
                    <path
                      key={i}
                      d={`M ${150 + i * 10} ${200 - i * 8} Q 300 ${180 - i * 5}, ${450 - i * 10} ${200 - i * 8}`}
                      stroke="url(#neural-grad-deep)"
                      strokeWidth={filamentThickness * (1.5 - i * 0.1)}
                      fill="none"
                      filter="url(#neural-glow-deep)"
                      className={modePattern === "spike" ? "animate-pulse" : ""}
                      style={{ 
                        animationDelay: `${i * 0.1}s`,
                        opacity: 0.7 - i * 0.1
                      }}
                    />
                  ))}
                </svg>

                {/* Campo volumétrico holográfico */}
                <div 
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[65%] h-[45%] rounded-full blur-[60px]"
                  style={{
                    background: `radial-gradient(circle, ${hologramColors.glow} 0%, transparent 70%)`,
                  }}
                />
              </div>
            )}
          </div>

          {/* Camada 2: Tecido Subcutâneo (intermediária) - Holográfica */}
          <div
            className="absolute inset-0 rounded-3xl transition-all duration-500"
            style={{
              transform: 'translateZ(-25px)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Base subcutânea translúcida */}
            <div 
              className="absolute inset-0 rounded-3xl backdrop-blur-md border shadow-[0_0_50px_rgba(255,217,102,0.15)]"
              style={{
                background: `
                  linear-gradient(135deg, 
                    rgba(255, 193, 7, 0.15) 0%, 
                    rgba(255, 214, 10, 0.12) 50%, 
                    rgba(255, 193, 7, 0.15) 100%)
                `,
                borderColor: 'rgba(255, 217, 102, 0.25)',
              }}
            >
              {/* Textura celular holográfica */}
              <div className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `radial-gradient(circle at 25% 35%, rgba(255,217,102,0.3) 3px, transparent 3px),
                    radial-gradient(circle at 65% 65%, rgba(255,217,102,0.3) 3px, transparent 3px),
                    radial-gradient(circle at 45% 50%, rgba(255,217,102,0.3) 3px, transparent 3px)`,
                  backgroundSize: '50px 50px, 60px 60px, 45px 45px'
                }}
              />
            </div>

            {/* Filamentos neurais intermediários */}
            {intensity > 20 && (
              <div 
                className={`absolute inset-0 ${animationSpeed.class}`}
                style={{ opacity: baseOpacity * 0.9 }}
              >
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 400">
                  <defs>
                    <filter id="neural-glow-mid">
                      <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                    <linearGradient id="neural-grad-mid" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="rgba(255,217,102,0.7)" stopOpacity="0.7" />
                      <stop offset="50%" stopColor="rgba(255,179,0,0.9)" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="rgba(255,217,102,0.7)" stopOpacity="0.7" />
                    </linearGradient>
                  </defs>
                  
                  {modePattern === "burst" ? (
                    // Burst: pacotes de pulsos holográficos
                    <>
                      {[0, 1, 2, 3].map((i) => (
                        <path 
                          key={i}
                          d={`M ${160 + i * 90} 195 L ${200 + i * 90} 195`}
                          stroke="url(#neural-grad-mid)"
                          strokeWidth={filamentThickness * 1.1}
                          fill="none"
                          filter="url(#neural-glow-mid)"
                          className="animate-pulse"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </>
                  ) : (
                    // Ondas volumétricas
                    <>
                      {[...Array(3)].map((_, i) => (
                        <path
                          key={i}
                          d={`M ${165 + i * 15} ${200 + i * 8} Q 300 ${190 + i * 5}, ${435 - i * 15} ${200 + i * 8}`}
                          stroke="url(#neural-grad-mid)"
                          strokeWidth={filamentThickness * (1 - i * 0.15)}
                          fill="none"
                          filter="url(#neural-glow-mid)"
                          style={{ 
                            animationDelay: `${i * 0.1}s`,
                            opacity: 0.9 - i * 0.15
                          }}
                        />
                      ))}
                    </>
                  )}
                </svg>

                {/* Campo holográfico intermediário */}
                <div 
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[58%] h-[38%] rounded-full blur-[45px]"
                  style={{
                    background: `radial-gradient(circle, rgba(255,217,102,0.25) 0%, transparent 70%)`,
                  }}
                />
              </div>
            )}
          </div>

          {/* Camada 1: Pele (superficial) - Holográfica */}
          <div
            className="absolute inset-0 rounded-3xl transition-all duration-500"
            style={{
              transform: 'translateZ(0px)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Base da pele translúcida */}
            <div 
              className="absolute inset-0 rounded-3xl backdrop-blur-lg border shadow-[0_0_40px_rgba(0,235,255,0.1)]"
              style={{
                background: `
                  linear-gradient(135deg, 
                    rgba(245, 230, 211, 0.08) 0%, 
                    rgba(235, 220, 200, 0.06) 50%, 
                    rgba(224, 208, 188, 0.08) 100%)
                `,
                borderColor: 'rgba(0, 235, 255, 0.2)',
              }}
            >
              {/* Microtextura holográfica */}
              <div className="absolute inset-0 opacity-[0.05]"
                style={{
                  backgroundImage: `
                    linear-gradient(rgba(0,235,255,0.1) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,235,255,0.1) 1px, transparent 1px)
                  `,
                  backgroundSize: '5px 5px'
                }}
              />
            </div>

            {/* Filamentos neurais superficiais */}
            {intensity > 0 && (
              <div 
                className={`absolute inset-0 ${animationSpeed.class}`}
                style={{ opacity: baseOpacity }}
              >
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 400">
                  <defs>
                    <filter id="neural-glow-surface">
                      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                    <linearGradient id="neural-grad-surface" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={hologramColors.primary} stopOpacity="0.9" />
                      <stop offset="50%" stopColor={hologramColors.secondary} stopOpacity="1" />
                      <stop offset="100%" stopColor={hologramColors.primary} stopOpacity="0.9" />
                    </linearGradient>
                  </defs>
                  
                  {modePattern === "spike" ? (
                    // Acupuntura: spikes holográficos
                    <>
                      {[0, 1].map((i) => (
                        <path 
                          key={i}
                          d={`M ${180 + i * 200} 200 L ${220 + i * 200} 200`}
                          stroke="url(#neural-grad-surface)"
                          strokeWidth={filamentThickness * 1.2}
                          fill="none"
                          filter="url(#neural-glow-surface)"
                          className="animate-pulse"
                          style={{ animationDelay: `${i * 0.5}s` }}
                        />
                      ))}
                    </>
                  ) : modePattern === "wave" ? (
                    // Modulado: ondas respiratórias
                    <>
                      {[...Array(2)].map((_, i) => (
                        <path
                          key={i}
                          d={`M ${175 + i * 10} ${200 + i * 10} Q ${240 + i * 10} ${195 + i * 5}, ${300 + i * 5} ${200 + i * 10} Q ${360 - i * 10} ${205 - i * 5}, ${425 - i * 10} ${200 + i * 10}`}
                          stroke="url(#neural-grad-surface)"
                          strokeWidth={filamentThickness * (1.2 - i * 0.2)}
                          fill="none"
                          filter="url(#neural-glow-surface)"
                          className={i === 0 ? "animate-pulse-slow" : "animate-pulse-medium"}
                        />
                      ))}
                    </>
                  ) : (
                    // Contínuo: filamentos múltiplos
                    <>
                      {[...Array(4)].map((_, i) => (
                        <path
                          key={i}
                          d={`M ${172 + i * 8} ${200 - i * 8 + (i % 2 === 0 ? 0 : 16)} Q 300 ${195 - i * 5}, ${428 - i * 8} ${200 - i * 8 + (i % 2 === 0 ? 0 : 16)}`}
                          stroke="url(#neural-grad-surface)"
                          strokeWidth={filamentThickness * (1 - i * 0.15)}
                          fill="none"
                          filter="url(#neural-glow-surface)"
                          style={{ 
                            animationDelay: `${i * 0.08}s`,
                            opacity: 1 - i * 0.15
                          }}
                        />
                      ))}
                    </>
                  )}
                </svg>

                {/* Campo holográfico superficial com heat bloom */}
                <div 
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[52%] h-[32%] rounded-full blur-[35px] transition-all duration-300"
                  style={{
                    background: `radial-gradient(circle, ${hologramColors.glow} 0%, transparent 70%)`,
                    filter: `brightness(${1 + glowIntensity * 0.3})`,
                  }}
                />
              </div>
            )}

            {/* Eletrodos 3D Holográficos */}
            <div className="absolute inset-0">
              {/* Eletrodo proximal */}
              <div
                className="absolute top-1/2 left-[25%] -translate-y-1/2 transition-all duration-300"
                style={{
                  transform: `translateY(-50%) translateZ(25px) rotateX(-4deg)`,
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Sombra holográfica */}
                <div 
                  className="absolute inset-0 w-20 h-20 rounded-2xl blur-xl translate-y-2"
                  style={{
                    background: `radial-gradient(circle, ${hologramColors.glow} 0%, transparent 70%)`,
                  }}
                />
                
                {/* Gel pad holográfico */}
                <div 
                  className="absolute inset-0 w-20 h-20 rounded-2xl -translate-y-1 blur-md"
                  style={{
                    background: `radial-gradient(circle, ${hologramColors.primary}40 0%, ${hologramColors.secondary}20 50%, transparent 100%)`,
                  }}
                />
                
                {/* Corpo do eletrodo holográfico */}
                <div 
                  className="relative w-20 h-20 rounded-2xl border backdrop-blur-sm transition-all duration-300"
                  style={{
                    background: `linear-gradient(135deg, 
                      rgba(226, 232, 240, 0.3) 0%, 
                      rgba(203, 213, 225, 0.25) 50%, 
                      rgba(226, 232, 240, 0.3) 100%)`,
                    borderColor: hologramColors.primary,
                    boxShadow: `0 0 30px ${hologramColors.glow}, inset 0 0 20px rgba(255,255,255,0.1)`,
                  }}
                >
                  {/* Highlight holográfico */}
                  <div 
                    className="absolute inset-x-2 top-2 h-8 rounded-t-xl opacity-40"
                    style={{
                      background: `linear-gradient(180deg, ${hologramColors.primary}60 0%, transparent 100%)`
                    }}
                  />
                  
                  {/* Conexão central */}
                  <div 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full"
                    style={{
                      background: `radial-gradient(circle, ${hologramColors.secondary} 0%, ${hologramColors.primary} 100%)`,
                      boxShadow: `0 0 15px ${hologramColors.glow}`,
                    }}
                  />
                  
                  {/* Pulsação quando ativo */}
                  {intensity > 0 && (
                    <div 
                      className={`absolute inset-0 rounded-2xl ${animationSpeed.class}`}
                      style={{
                        background: `linear-gradient(135deg, ${hologramColors.glow} 0%, transparent 100%)`,
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Eletrodo distal */}
              <div
                className="absolute top-1/2 right-[25%] -translate-y-1/2 transition-all duration-300"
                style={{
                  transform: `translateY(-50%) translateZ(25px) rotateX(-4deg)`,
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Sombra holográfica */}
                <div 
                  className="absolute inset-0 w-20 h-20 rounded-2xl blur-xl translate-y-2"
                  style={{
                    background: `radial-gradient(circle, ${hologramColors.glow} 0%, transparent 70%)`,
                  }}
                />
                
                {/* Gel pad holográfico */}
                <div 
                  className="absolute inset-0 w-20 h-20 rounded-2xl -translate-y-1 blur-md"
                  style={{
                    background: `radial-gradient(circle, ${hologramColors.primary}40 0%, ${hologramColors.secondary}20 50%, transparent 100%)`,
                  }}
                />
                
                {/* Corpo do eletrodo holográfico */}
                <div 
                  className="relative w-20 h-20 rounded-2xl border backdrop-blur-sm transition-all duration-300"
                  style={{
                    background: `linear-gradient(135deg, 
                      rgba(226, 232, 240, 0.3) 0%, 
                      rgba(203, 213, 225, 0.25) 50%, 
                      rgba(226, 232, 240, 0.3) 100%)`,
                    borderColor: hologramColors.primary,
                    boxShadow: `0 0 30px ${hologramColors.glow}, inset 0 0 20px rgba(255,255,255,0.1)`,
                  }}
                >
                  {/* Highlight holográfico */}
                  <div 
                    className="absolute inset-x-2 top-2 h-8 rounded-t-xl opacity-40"
                    style={{
                      background: `linear-gradient(180deg, ${hologramColors.primary}60 0%, transparent 100%)`
                    }}
                  />
                  
                  {/* Conexão central */}
                  <div 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full"
                    style={{
                      background: `radial-gradient(circle, ${hologramColors.secondary} 0%, ${hologramColors.primary} 100%)`,
                      boxShadow: `0 0 15px ${hologramColors.glow}`,
                    }}
                  />
                  
                  {/* Pulsação quando ativo */}
                  {intensity > 0 && (
                    <div 
                      className={`absolute inset-0 rounded-2xl ${animationSpeed.class}`}
                      style={{
                        background: `linear-gradient(135deg, ${hologramColors.glow} 0%, transparent 100%)`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Labels holográficos das camadas */}
          <div className="absolute inset-0 pointer-events-none">
            <div 
              className="absolute left-3 top-[22%] px-3 py-1.5 rounded-lg backdrop-blur-md border text-xs font-mono tracking-wider"
              style={{
                background: 'rgba(0, 235, 255, 0.08)',
                borderColor: 'rgba(0, 235, 255, 0.3)',
                color: 'rgba(0, 235, 255, 0.9)',
                boxShadow: '0 0 15px rgba(0, 235, 255, 0.2)',
              }}
            >
              SUPERFICIAL
            </div>
            <div 
              className="absolute left-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg backdrop-blur-md border text-xs font-mono tracking-wider"
              style={{
                background: 'rgba(255, 217, 102, 0.08)',
                borderColor: 'rgba(255, 217, 102, 0.3)',
                color: 'rgba(255, 217, 102, 0.9)',
                boxShadow: '0 0 15px rgba(255, 217, 102, 0.2)',
              }}
            >
              SUBCUTÂNEO
            </div>
            <div 
              className="absolute left-3 bottom-[22%] px-3 py-1.5 rounded-lg backdrop-blur-md border text-xs font-mono tracking-wider"
              style={{
                background: 'rgba(255, 107, 107, 0.08)',
                borderColor: 'rgba(255, 107, 107, 0.3)',
                color: 'rgba(255, 107, 107, 0.9)',
                boxShadow: '0 0 15px rgba(255, 107, 107, 0.2)',
              }}
            >
              MUSCULAR
            </div>
            
            {/* Linhas conectoras holográficas */}
            <svg className="absolute inset-0 w-full h-full opacity-40">
              <defs>
                <linearGradient id="line-grad-1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(0, 235, 255, 0.6)" />
                  <stop offset="100%" stopColor="rgba(0, 235, 255, 0)" />
                </linearGradient>
                <linearGradient id="line-grad-2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(255, 217, 102, 0.6)" />
                  <stop offset="100%" stopColor="rgba(255, 217, 102, 0)" />
                </linearGradient>
                <linearGradient id="line-grad-3" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(255, 107, 107, 0.6)" />
                  <stop offset="100%" stopColor="rgba(255, 107, 107, 0)" />
                </linearGradient>
              </defs>
              <line x1="140" y1="22%" x2="180" y2="22%" stroke="url(#line-grad-1)" strokeWidth="1.5" strokeDasharray="3,3" />
              <line x1="140" y1="50%" x2="180" y2="50%" stroke="url(#line-grad-2)" strokeWidth="1.5" strokeDasharray="3,3" />
              <line x1="140" y1="78%" x2="180" y2="78%" stroke="url(#line-grad-3)" strokeWidth="1.5" strokeDasharray="3,3" />
            </svg>
          </div>
        </div>
      </div>

      {/* HUD Holográfico Futurista */}
      <div 
        className="absolute bottom-4 right-4 px-5 py-4 rounded-2xl backdrop-blur-xl border transition-all duration-300"
        style={{
          background: 'rgba(10, 22, 40, 0.6)',
          borderColor: hologramColors.primary,
          boxShadow: `0 0 40px ${hologramColors.glow}, inset 0 0 20px rgba(0,235,255,0.05)`,
        }}
      >
        <div className="flex items-center gap-4">
          {/* Indicador de profundidade */}
          <div className="flex flex-col items-center">
            <div 
              className="text-[10px] font-mono mb-2 tracking-widest"
              style={{ color: hologramColors.primary }}
            >
              PROFUNDIDADE
            </div>
            <div className="flex gap-1.5">
              <div 
                className="w-2.5 h-8 rounded-full transition-all duration-300"
                style={{
                  background: intensity > 0 
                    ? `linear-gradient(180deg, ${hologramColors.primary} 0%, ${hologramColors.secondary} 100%)`
                    : 'rgba(71, 85, 105, 0.3)',
                  boxShadow: intensity > 0 ? `0 0 15px ${hologramColors.glow}` : 'none',
                  transform: intensity > 0 ? 'scaleY(1.1)' : 'scaleY(1)',
                }}
              />
              <div 
                className="w-2.5 h-8 rounded-full transition-all duration-300"
                style={{
                  background: intensity > 20 
                    ? 'linear-gradient(180deg, rgba(255,217,102,0.9) 0%, rgba(255,179,0,0.8) 100%)'
                    : 'rgba(71, 85, 105, 0.3)',
                  boxShadow: intensity > 20 ? '0 0 15px rgba(255,217,102,0.4)' : 'none',
                  transform: intensity > 20 ? 'scaleY(1.1)' : 'scaleY(1)',
                }}
              />
              <div 
                className="w-2.5 h-8 rounded-full transition-all duration-300"
                style={{
                  background: intensity > 40 
                    ? 'linear-gradient(180deg, rgba(255,107,107,0.9) 0%, rgba(220,38,38,0.8) 100%)'
                    : 'rgba(71, 85, 105, 0.3)',
                  boxShadow: intensity > 40 ? '0 0 15px rgba(255,107,107,0.4)' : 'none',
                  transform: intensity > 40 ? 'scaleY(1.1)' : 'scaleY(1)',
                }}
              />
            </div>
          </div>
          
          {/* Separador holográfico */}
          <div 
            className="h-10 w-[1.5px]"
            style={{
              background: `linear-gradient(180deg, transparent 0%, ${hologramColors.primary} 50%, transparent 100%)`,
            }}
          />
          
          {/* Status badge */}
          <div className="flex flex-col items-start">
            <div 
              className="text-[10px] font-mono mb-1.5 tracking-widest"
              style={{ color: hologramColors.primary }}
            >
              STATUS
            </div>
            <div 
              className={`text-sm font-bold tracking-wide px-3 py-1 rounded-lg backdrop-blur-sm border transition-all duration-300 ${animationSpeed.class}`}
              style={{
                color: intensity === 0 ? 'rgba(148, 163, 184, 0.7)' :
                       intensity > 50 ? 'rgba(255, 107, 107, 1)' :
                       intensity > 25 ? 'rgba(255, 217, 102, 1)' : hologramColors.primary,
                borderColor: intensity === 0 ? 'rgba(148, 163, 184, 0.2)' :
                            intensity > 50 ? 'rgba(255, 107, 107, 0.5)' :
                            intensity > 25 ? 'rgba(255, 217, 102, 0.5)' : hologramColors.primary,
                background: intensity === 0 ? 'rgba(30, 41, 59, 0.3)' :
                           intensity > 50 ? 'rgba(255, 107, 107, 0.1)' :
                           intensity > 25 ? 'rgba(255, 217, 102, 0.1)' : 'rgba(0, 235, 255, 0.1)',
                boxShadow: intensity > 0 ? (
                  intensity > 50 ? '0 0 20px rgba(255, 107, 107, 0.3)' :
                  intensity > 25 ? '0 0 20px rgba(255, 217, 102, 0.3)' : `0 0 20px ${hologramColors.glow}`
                ) : 'none',
              }}
            >
              {intensity === 0 ? "INATIVO" : 
               intensity > 50 ? "PROFUNDO" :
               intensity > 25 ? "MODERADO" : "SUPERFICIAL"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
