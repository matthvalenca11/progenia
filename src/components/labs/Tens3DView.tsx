import { useMemo } from "react";

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
  
  // Determinar velocidade de animação baseada na frequência
  const animationSpeed = useMemo(() => {
    if (frequency <= 20) return { duration: "3s", class: "animate-pulse-slow" };
    if (frequency <= 80) return { duration: "1.5s", class: "animate-pulse-medium" };
    return { duration: "0.8s", class: "animate-pulse-fast" };
  }, [frequency]);

  // Determinar cores baseadas no conforto
  const layerColors = useMemo(() => {
    if (comfortLevel >= 70) {
      return {
        superficial: "from-cyan-400/60 via-teal-400/40 to-transparent",
        intermediario: "from-emerald-400/50 via-green-400/30 to-transparent",
        profundo: "from-lime-500/40 via-green-600/25 to-transparent",
      };
    }
    if (comfortLevel >= 40) {
      return {
        superficial: "from-amber-400/60 via-yellow-400/40 to-transparent",
        intermediario: "from-orange-400/50 via-amber-500/30 to-transparent",
        profundo: "from-yellow-600/40 via-orange-600/25 to-transparent",
      };
    }
    return {
      superficial: "from-rose-400/60 via-pink-400/40 to-transparent",
      intermediario: "from-red-400/50 via-rose-500/30 to-transparent",
      profundo: "from-red-600/40 via-rose-700/25 to-transparent",
    };
  }, [comfortLevel]);

  // Calcular opacidade geral baseada na intensidade
  const baseOpacity = intensity > 0 ? 0.4 + (intensity / 100) * 0.6 : 0;
  
  // Calcular espessura dos filamentos baseada na largura de pulso
  const filamentThickness = 2 + (pulseWidth / 400) * 6; // 2-8px

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
    <div className="relative w-full h-[500px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl overflow-hidden shadow-2xl">
      {/* Microgrid de fundo */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" 
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
            `,
            backgroundSize: '30px 30px'
          }}
        />
      </div>

      {/* Container 3D principal */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{
          perspective: '1200px',
          perspectiveOrigin: 'center center',
        }}
      >
        <div 
          className="relative w-[90%] h-[85%]"
          style={{
            transformStyle: 'preserve-3d',
            transform: 'rotateX(8deg) rotateY(-5deg)',
          }}
        >
          {/* Camada 3: Músculo (mais profunda) */}
          <div
            className="absolute inset-0 rounded-3xl"
            style={{
              transform: 'translateZ(-40px)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Base muscular */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-950/60 via-red-900/50 to-red-950/60 rounded-3xl border border-red-800/30 shadow-[0_0_40px_rgba(220,38,38,0.3)]">
              {/* Textura muscular */}
              <div className="absolute inset-0 opacity-20 mix-blend-overlay"
                style={{
                  backgroundImage: `repeating-linear-gradient(
                    45deg,
                    transparent,
                    transparent 10px,
                    rgba(220,38,38,0.1) 10px,
                    rgba(220,38,38,0.1) 20px
                  )`
                }}
              />
            </div>

            {/* Propagação profunda */}
            {intensity > 40 && (
              <div 
                className={`absolute inset-0 ${animationSpeed.class}`}
                style={{ opacity: baseOpacity * 0.7 }}
              >
                {/* Filamentos elétricos profundos */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 400">
                  <defs>
                    <filter id="glow-deep">
                      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  
                  {/* Linhas de corrente profunda */}
                  <path
                    d="M 150 200 Q 300 180, 450 200"
                    stroke="rgba(239, 68, 68, 0.6)"
                    strokeWidth={filamentThickness * 1.2}
                    fill="none"
                    filter="url(#glow-deep)"
                    className={modePattern === "spike" ? "animate-pulse" : ""}
                  />
                  <path
                    d="M 170 220 Q 300 200, 430 220"
                    stroke="rgba(220, 38, 38, 0.5)"
                    strokeWidth={filamentThickness}
                    fill="none"
                    filter="url(#glow-deep)"
                    style={{ animationDelay: "0.2s" }}
                  />
                </svg>

                {/* Campo elétrico profundo */}
                <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[40%] bg-gradient-radial ${layerColors.profundo} rounded-full blur-[50px]`} />
              </div>
            )}
          </div>

          {/* Camada 2: Tecido Subcutâneo (intermediária) */}
          <div
            className="absolute inset-0 rounded-3xl"
            style={{
              transform: 'translateZ(-20px)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Base subcutânea */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-100/40 via-yellow-100/35 to-amber-100/40 rounded-3xl border border-amber-200/40 backdrop-blur-sm">
              {/* Textura adiposa */}
              <div className="absolute inset-0 opacity-15"
                style={{
                  backgroundImage: `radial-gradient(circle at 20% 30%, rgba(251,191,36,0.2) 2px, transparent 2px),
                    radial-gradient(circle at 60% 70%, rgba(251,191,36,0.2) 2px, transparent 2px),
                    radial-gradient(circle at 40% 50%, rgba(251,191,36,0.2) 2px, transparent 2px)`,
                  backgroundSize: '40px 40px, 50px 50px, 35px 35px'
                }}
              />
            </div>

            {/* Propagação intermediária */}
            {intensity > 20 && (
              <div 
                className={`absolute inset-0 ${animationSpeed.class}`}
                style={{ opacity: baseOpacity * 0.85 }}
              >
                {/* Ondas intermediárias */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 400">
                  <defs>
                    <filter id="glow-mid">
                      <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  
                  {modePattern === "burst" ? (
                    // Burst: grupos de pulsos
                    <>
                      <path d="M 160 190 L 200 190" stroke="rgba(251, 146, 60, 0.7)" strokeWidth={filamentThickness * 0.9} fill="none" filter="url(#glow-mid)" className="animate-pulse" />
                      <path d="M 210 190 L 250 190" stroke="rgba(251, 146, 60, 0.7)" strokeWidth={filamentThickness * 0.9} fill="none" filter="url(#glow-mid)" className="animate-pulse" style={{ animationDelay: "0.1s" }} />
                      <path d="M 350 190 L 390 190" stroke="rgba(251, 146, 60, 0.7)" strokeWidth={filamentThickness * 0.9} fill="none" filter="url(#glow-mid)" className="animate-pulse" style={{ animationDelay: "0.2s" }} />
                      <path d="M 400 190 L 440 190" stroke="rgba(251, 146, 60, 0.7)" strokeWidth={filamentThickness * 0.9} fill="none" filter="url(#glow-mid)" className="animate-pulse" style={{ animationDelay: "0.3s" }} />
                    </>
                  ) : (
                    // Contínuo ou ondulado
                    <>
                      <path
                        d="M 160 200 Q 300 190, 440 200"
                        stroke="rgba(251, 146, 60, 0.8)"
                        strokeWidth={filamentThickness * 0.9}
                        fill="none"
                        filter="url(#glow-mid)"
                      />
                      <path
                        d="M 180 210 Q 300 200, 420 210"
                        stroke="rgba(245, 158, 11, 0.7)"
                        strokeWidth={filamentThickness * 0.8}
                        fill="none"
                        filter="url(#glow-mid)"
                        style={{ animationDelay: "0.15s" }}
                      />
                    </>
                  )}
                </svg>

                {/* Campo elétrico intermediário */}
                <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[55%] h-[35%] bg-gradient-radial ${layerColors.intermediario} rounded-full blur-[40px]`} />
              </div>
            )}
          </div>

          {/* Camada 1: Pele (superficial) */}
          <div
            className="absolute inset-0 rounded-3xl"
            style={{
              transform: 'translateZ(0px)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Base da pele */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#F5E6D3]/90 via-[#EBDCC8]/85 to-[#E0D0BC]/90 rounded-3xl border border-[#D4C4B0]/50 backdrop-blur-sm shadow-[0_10px_60px_rgba(0,0,0,0.2)]">
              {/* Textura da pele */}
              <div className="absolute inset-0 opacity-10 mix-blend-overlay"
                style={{
                  backgroundImage: `
                    linear-gradient(rgba(139,92,46,0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(139,92,46,0.03) 1px, transparent 1px)
                  `,
                  backgroundSize: '4px 4px'
                }}
              />
            </div>

            {/* Propagação superficial */}
            {intensity > 0 && (
              <div 
                className={`absolute inset-0 ${animationSpeed.class}`}
                style={{ opacity: baseOpacity }}
              >
                {/* Filamentos superficiais */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 400">
                  <defs>
                    <filter id="glow-surface">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  
                  {modePattern === "spike" ? (
                    // Acupuntura: spikes
                    <>
                      <path d="M 180 200 L 220 200" stroke="rgba(34, 211, 238, 0.9)" strokeWidth={filamentThickness} fill="none" filter="url(#glow-surface)" className="animate-pulse" />
                      <path d="M 380 200 L 420 200" stroke="rgba(34, 211, 238, 0.9)" strokeWidth={filamentThickness} fill="none" filter="url(#glow-surface)" className="animate-pulse" style={{ animationDelay: "0.5s" }} />
                    </>
                  ) : modePattern === "wave" ? (
                    // Modulado: ondas crescentes
                    <>
                      <path
                        d="M 170 200 Q 230 195, 290 200 Q 350 205, 430 200"
                        stroke="rgba(34, 211, 238, 0.9)"
                        strokeWidth={filamentThickness}
                        fill="none"
                        filter="url(#glow-surface)"
                        className="animate-pulse-slow"
                      />
                      <path
                        d="M 180 210 Q 240 207, 300 210 Q 360 213, 420 210"
                        stroke="rgba(6, 182, 212, 0.8)"
                        strokeWidth={filamentThickness * 0.8}
                        fill="none"
                        filter="url(#glow-surface)"
                        className="animate-pulse-medium"
                      />
                    </>
                  ) : (
                    // Contínuo
                    <>
                      <path
                        d="M 170 200 Q 300 195, 430 200"
                        stroke="rgba(34, 211, 238, 0.9)"
                        strokeWidth={filamentThickness}
                        fill="none"
                        filter="url(#glow-surface)"
                      />
                      <path
                        d="M 180 210 Q 300 205, 420 210"
                        stroke="rgba(6, 182, 212, 0.8)"
                        strokeWidth={filamentThickness * 0.8}
                        fill="none"
                        filter="url(#glow-surface)"
                      />
                      <path
                        d="M 190 190 Q 300 185, 410 190"
                        stroke="rgba(103, 232, 249, 0.7)"
                        strokeWidth={filamentThickness * 0.7}
                        fill="none"
                        filter="url(#glow-surface)"
                        style={{ animationDelay: "0.1s" }}
                      />
                    </>
                  )}
                </svg>

                {/* Campo elétrico superficial */}
                <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[30%] bg-gradient-radial ${layerColors.superficial} rounded-full blur-[30px]`} />
              </div>
            )}

            {/* Eletrodos 3D */}
            <div className="absolute inset-0">
              {/* Eletrodo proximal */}
              <div
                className="absolute top-1/2 left-[25%] -translate-y-1/2"
                style={{
                  transform: 'translateY(-50%) translateZ(20px) rotateX(-3deg)',
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Sombra do eletrodo */}
                <div className="absolute inset-0 w-20 h-20 bg-black/20 rounded-2xl blur-md translate-y-1" />
                
                {/* Gel pad */}
                <div className="absolute inset-0 w-20 h-20 bg-gradient-radial from-cyan-400/30 via-teal-400/20 to-transparent rounded-2xl -translate-y-0.5 blur-sm" />
                
                {/* Corpo do eletrodo */}
                <div className="relative w-20 h-20 bg-gradient-to-br from-slate-300 via-slate-200 to-slate-300 rounded-2xl border border-slate-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                  {/* Highlight */}
                  <div className="absolute inset-x-2 top-2 h-6 bg-gradient-to-b from-white/40 to-transparent rounded-t-xl" />
                  
                  {/* Textura */}
                  <div className="absolute inset-0 opacity-[0.03]"
                    style={{
                      backgroundImage: `radial-gradient(circle, black 1px, transparent 1px)`,
                      backgroundSize: '4px 4px'
                    }}
                  />
                  
                  {/* Ponto de conexão */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-slate-600 rounded-full shadow-inner" />
                  
                  {/* Glow quando ativo */}
                  {intensity > 0 && (
                    <div className={`absolute inset-0 rounded-2xl bg-cyan-400/20 ${animationSpeed.class}`} />
                  )}
                </div>
              </div>

              {/* Eletrodo distal */}
              <div
                className="absolute top-1/2 right-[25%] -translate-y-1/2"
                style={{
                  transform: 'translateY(-50%) translateZ(20px) rotateX(-3deg)',
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Sombra do eletrodo */}
                <div className="absolute inset-0 w-20 h-20 bg-black/20 rounded-2xl blur-md translate-y-1" />
                
                {/* Gel pad */}
                <div className="absolute inset-0 w-20 h-20 bg-gradient-radial from-cyan-400/30 via-teal-400/20 to-transparent rounded-2xl -translate-y-0.5 blur-sm" />
                
                {/* Corpo do eletrodo */}
                <div className="relative w-20 h-20 bg-gradient-to-br from-slate-300 via-slate-200 to-slate-300 rounded-2xl border border-slate-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                  {/* Highlight */}
                  <div className="absolute inset-x-2 top-2 h-6 bg-gradient-to-b from-white/40 to-transparent rounded-t-xl" />
                  
                  {/* Textura */}
                  <div className="absolute inset-0 opacity-[0.03]"
                    style={{
                      backgroundImage: `radial-gradient(circle, black 1px, transparent 1px)`,
                      backgroundSize: '4px 4px'
                    }}
                  />
                  
                  {/* Ponto de conexão */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-slate-600 rounded-full shadow-inner" />
                  
                  {/* Glow quando ativo */}
                  {intensity > 0 && (
                    <div className={`absolute inset-0 rounded-2xl bg-cyan-400/20 ${animationSpeed.class}`} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Linhas indicadoras de camadas (holográfico) */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-4 top-1/4 text-xs text-cyan-400/60 font-mono tracking-wider">SUPERFICIAL</div>
            <div className="absolute left-4 top-1/2 text-xs text-amber-400/60 font-mono tracking-wider">SUBCUTÂNEO</div>
            <div className="absolute left-4 bottom-1/4 text-xs text-red-400/60 font-mono tracking-wider">MUSCULAR</div>
            
            {/* Linhas conectoras */}
            <svg className="absolute inset-0 w-full h-full opacity-30">
              <line x1="120" y1="25%" x2="160" y2="25%" stroke="rgba(34, 211, 238, 0.4)" strokeWidth="1" strokeDasharray="2,2" />
              <line x1="120" y1="50%" x2="160" y2="50%" stroke="rgba(251, 146, 60, 0.4)" strokeWidth="1" strokeDasharray="2,2" />
              <line x1="120" y1="75%" x2="160" y2="75%" stroke="rgba(239, 68, 68, 0.4)" strokeWidth="1" strokeDasharray="2,2" />
            </svg>
          </div>
        </div>
      </div>

      {/* HUD Info */}
      <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur-md rounded-lg px-4 py-3 border border-cyan-400/30 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div className="text-[10px] text-cyan-400/70 font-mono mb-1">PROFUNDIDADE</div>
            <div className="flex gap-1">
              <div className={`w-2 h-6 rounded-sm ${intensity > 0 ? 'bg-cyan-400' : 'bg-slate-700'} transition-colors`} />
              <div className={`w-2 h-6 rounded-sm ${intensity > 20 ? 'bg-amber-400' : 'bg-slate-700'} transition-colors`} />
              <div className={`w-2 h-6 rounded-sm ${intensity > 40 ? 'bg-red-400' : 'bg-slate-700'} transition-colors`} />
            </div>
          </div>
          
          <div className="h-8 w-px bg-cyan-400/30" />
          
          <div>
            <div className="text-[10px] text-cyan-400/70 font-mono">STATUS</div>
            <div className="text-sm font-bold text-cyan-400">
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
