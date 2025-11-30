import { useMemo } from 'react';

interface TensLateral3DViewProps {
  activationLevel: number;
  comfortLevel: number;
  frequency: number;
  intensity: number;
  pulseWidth: number;
  mode: string;
}

export const TensLateral3DView = ({
  activationLevel,
  comfortLevel,
  frequency,
  intensity,
  pulseWidth,
  mode,
}: TensLateral3DViewProps) => {
  // Animation speed based on frequency
  const animationSpeed = useMemo(() => {
    if (frequency < 10) return { duration: '4s', class: 'slow' };
    if (frequency < 50) return { duration: '2s', class: 'medium' };
    return { duration: '0.8s', class: 'fast' };
  }, [frequency]);

  // Calculate depth penetration based on intensity
  const depthPenetration = useMemo(() => {
    if (intensity < 5) return 'superficial';
    if (intensity < 15) return 'subcutaneous';
    return 'deep';
  }, [intensity]);

  // Calculate filament thickness based on pulse width
  const filamentThickness = useMemo(() => {
    return Math.max(1, pulseWidth / 50);
  }, [pulseWidth]);

  // Pattern based on mode
  const modePattern = useMemo(() => {
    switch (mode) {
      case 'acupuntura':
        return 'spike';
      case 'burst':
        return 'burst';
      case 'modulado':
        return 'wave';
      default:
        return 'continuous';
    }
  }, [mode]);

  // Opacity based on intensity
  const baseOpacity = Math.min(0.9, intensity / 25);

  return (
    <div className="w-full h-[500px] relative bg-gradient-to-b from-slate-900 to-slate-950 rounded-lg overflow-hidden border border-slate-700/50">
      {/* Grid background for scientific look */}
      <div className="absolute inset-0 opacity-10">
        <div className="w-full h-full" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }} />
      </div>

      {/* Main tissue container with perspective */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: '1200px' }}>
        <div 
          className="relative w-[600px] h-[400px]"
          style={{
            transformStyle: 'preserve-3d',
            transform: 'rotateX(5deg)',
          }}
        >
          {/* CAMADA 1: PELE (Skin Layer) */}
          <div 
            className="absolute left-0 right-0 h-12 rounded-lg"
            style={{
              top: '50px',
              background: 'linear-gradient(180deg, #F2D5C4 0%, #E8C4B0 100%)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
              transform: 'translateZ(30px)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Skin texture */}
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 3px)',
            }} />
            
            {/* Label */}
            <div className="absolute -left-24 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-300">
              Pele
            </div>
            <div className="absolute -left-2 top-1/2 w-12 h-px bg-slate-400/50" style={{ transform: 'translateY(-50%)' }} />
          </div>

          {/* CAMADA 2: TECIDO SUBCUTÂNEO (Subcutaneous Fat) */}
          <div 
            className="absolute left-0 right-0 h-24 rounded-lg"
            style={{
              top: '62px',
              background: 'linear-gradient(180deg, #F6E8B5 0%, #E8D89F 100%)',
              boxShadow: '0 6px 16px rgba(0,0,0,0.25), inset 0 2px 4px rgba(255,255,255,0.2)',
              transform: 'translateZ(10px)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Fatty texture */}
            <div className="absolute inset-0 opacity-15" style={{
              backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.3) 2px, transparent 2px), radial-gradient(circle at 60% 70%, rgba(255,255,255,0.3) 2px, transparent 2px)',
              backgroundSize: '15px 15px',
            }} />
            
            {/* Label */}
            <div className="absolute -left-24 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-300">
              Subcutâneo
            </div>
            <div className="absolute -left-2 top-1/2 w-12 h-px bg-slate-400/50" style={{ transform: 'translateY(-50%)' }} />
          </div>

          {/* CAMADA 3: MÚSCULO (Muscle Layer) */}
          <div 
            className="absolute left-0 right-0 h-32 rounded-lg"
            style={{
              top: '86px',
              background: 'linear-gradient(180deg, #E17A7A 0%, #C96767 100%)',
              boxShadow: '0 8px 20px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.15)',
              transform: 'translateZ(-10px)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Muscle fiber texture */}
            <div className="absolute inset-0 opacity-25" style={{
              backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 4px)',
            }} />
            
            {/* Label */}
            <div className="absolute -left-24 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-300">
              Músculo
            </div>
            <div className="absolute -left-2 top-1/2 w-12 h-px bg-slate-400/50" style={{ transform: 'translateY(-50%)' }} />
          </div>

          {/* ELETRODO PROXIMAL (Left/Top Electrode) */}
          <div 
            className="absolute"
            style={{
              left: '150px',
              top: '30px',
              width: '60px',
              height: '60px',
              transform: 'translateZ(45px) rotateX(-3deg)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Gel pad base */}
            <div 
              className="absolute inset-0 rounded-lg"
              style={{
                background: 'radial-gradient(circle at 30% 30%, rgba(113, 233, 255, 0.4), rgba(0, 150, 255, 0.2))',
                filter: 'blur(4px)',
                transform: 'translateZ(-2px)',
              }}
            />
            
            {/* Electrode body */}
            <div 
              className="absolute inset-2 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {/* Connection point */}
              <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" style={{
                boxShadow: '0 0 6px rgba(239, 68, 68, 0.8)',
              }} />
            </div>
            
            {/* Electrode label */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-cyan-400">
              +
            </div>
          </div>

          {/* ELETRODO DISTAL (Right/Bottom Electrode) */}
          <div 
            className="absolute"
            style={{
              right: '150px',
              top: '30px',
              width: '60px',
              height: '60px',
              transform: 'translateZ(45px) rotateX(-3deg)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Gel pad base */}
            <div 
              className="absolute inset-0 rounded-lg"
              style={{
                background: 'radial-gradient(circle at 30% 30%, rgba(113, 233, 255, 0.4), rgba(0, 150, 255, 0.2))',
                filter: 'blur(4px)',
                transform: 'translateZ(-2px)',
              }}
            />
            
            {/* Electrode body */}
            <div 
              className="absolute inset-2 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {/* Connection point */}
              <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-blue-500" style={{
                boxShadow: '0 0 6px rgba(59, 130, 246, 0.8)',
              }} />
            </div>
            
            {/* Electrode label */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-blue-400">
              -
            </div>
          </div>

          {/* PROPAGAÇÃO ELÉTRICA - SUPERFICIAL (Skin Level) */}
          {intensity > 0 && (
            <svg 
              key={`superficial-${frequency}-${intensity}-${pulseWidth}-${mode}`}
              className="absolute left-0 top-0 w-full h-full pointer-events-none transition-opacity duration-300"
              style={{ 
                transform: 'translateZ(25px)',
                opacity: baseOpacity * 0.9,
              }}
            >
              <defs>
                <linearGradient id="superficial-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#71E9FF" stopOpacity="0" />
                  <stop offset="50%" stopColor="#71E9FF" stopOpacity="1" />
                  <stop offset="100%" stopColor="#71E9FF" stopOpacity="0" />
                </linearGradient>
                <filter id="glow-superficial">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              {/* Superficial current paths */}
              <path
                d="M 180,56 Q 300,58 420,56"
                fill="none"
                stroke="url(#superficial-gradient)"
                strokeWidth={filamentThickness * 1.5}
                filter="url(#glow-superficial)"
                className="transition-all duration-300"
                style={{
                  animation: `${modePattern === 'spike' ? 'spike-flow' : 'current-flow'} ${animationSpeed.duration} ease-in-out infinite`,
                }}
              />
              <path
                d="M 180,58 Q 300,60 420,58"
                fill="none"
                stroke="url(#superficial-gradient)"
                strokeWidth={filamentThickness}
                filter="url(#glow-superficial)"
                opacity="0.7"
                className="transition-all duration-300"
                style={{
                  animation: `${modePattern === 'spike' ? 'spike-flow' : 'current-flow'} ${animationSpeed.duration} ease-in-out infinite`,
                  animationDelay: '0.2s',
                }}
              />
            </svg>
          )}

          {/* PROPAGAÇÃO ELÉTRICA - SUBCUTÂNEA (Fat Level) */}
          {(depthPenetration === 'subcutaneous' || depthPenetration === 'deep') && intensity > 3 && (
            <svg 
              key={`subcutaneous-${frequency}-${intensity}-${pulseWidth}-${mode}`}
              className="absolute left-0 top-0 w-full h-full pointer-events-none transition-opacity duration-300"
              style={{ 
                transform: 'translateZ(5px)',
                opacity: baseOpacity * 0.75,
              }}
            >
              <defs>
                <radialGradient id="subcutaneous-gradient">
                  <stop offset="0%" stopColor="#FFC864" stopOpacity="1" />
                  <stop offset="100%" stopColor="#FFC864" stopOpacity="0" />
                </radialGradient>
                <filter id="glow-subcutaneous">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              {/* Subcutaneous diffuse waves */}
              <ellipse
                cx="200"
                cy="100"
                rx="40"
                ry="30"
                fill="url(#subcutaneous-gradient)"
                filter="url(#glow-subcutaneous)"
                className="transition-all duration-300"
                style={{
                  animation: `pulse-wave ${animationSpeed.duration} ease-in-out infinite`,
                }}
              />
              <ellipse
                cx="400"
                cy="100"
                rx="40"
                ry="30"
                fill="url(#subcutaneous-gradient)"
                filter="url(#glow-subcutaneous)"
                className="transition-all duration-300"
                style={{
                  animation: `pulse-wave ${animationSpeed.duration} ease-in-out infinite`,
                  animationDelay: '0.15s',
                }}
              />
              <path
                d="M 220,95 Q 300,110 380,95"
                fill="none"
                stroke="#FFC864"
                strokeWidth={filamentThickness * 2}
                filter="url(#glow-subcutaneous)"
                opacity="0.6"
                className="transition-all duration-300"
                style={{
                  animation: `${modePattern === 'burst' ? 'burst-flow' : 'wave-flow'} ${animationSpeed.duration} ease-in-out infinite`,
                }}
              />
            </svg>
          )}

          {/* PROPAGAÇÃO ELÉTRICA - PROFUNDA (Muscle Level) */}
          {depthPenetration === 'deep' && intensity > 10 && (
            <svg 
              key={`deep-${frequency}-${intensity}-${pulseWidth}-${mode}`}
              className="absolute left-0 top-0 w-full h-full pointer-events-none transition-opacity duration-300"
              style={{ 
                transform: 'translateZ(-15px)',
                opacity: baseOpacity * 0.6,
              }}
            >
              <defs>
                <linearGradient id="deep-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FF6B6B" stopOpacity="1" />
                  <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0" />
                </linearGradient>
                <filter id="glow-deep">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              {/* Deep penetration roots */}
              <path
                d="M 200,80 L 200,150 Q 200,160 210,165"
                fill="none"
                stroke="url(#deep-gradient)"
                strokeWidth={filamentThickness * 2.5}
                filter="url(#glow-deep)"
                className="transition-all duration-300"
                style={{
                  animation: `deep-penetration ${animationSpeed.duration} ease-in-out infinite`,
                }}
              />
              <path
                d="M 400,80 L 400,150 Q 400,160 390,165"
                fill="none"
                stroke="url(#deep-gradient)"
                strokeWidth={filamentThickness * 2.5}
                filter="url(#glow-deep)"
                className="transition-all duration-300"
                style={{
                  animation: `deep-penetration ${animationSpeed.duration} ease-in-out infinite`,
                  animationDelay: '0.1s',
                }}
              />
              <path
                d="M 240,95 L 240,140"
                fill="none"
                stroke="url(#deep-gradient)"
                strokeWidth={filamentThickness * 1.5}
                filter="url(#glow-deep)"
                opacity="0.7"
                className="transition-all duration-300"
                style={{
                  animation: `deep-penetration ${animationSpeed.duration} ease-in-out infinite`,
                  animationDelay: '0.3s',
                }}
              />
              <path
                d="M 360,95 L 360,140"
                fill="none"
                stroke="url(#deep-gradient)"
                strokeWidth={filamentThickness * 1.5}
                filter="url(#glow-deep)"
                opacity="0.7"
                className="transition-all duration-300"
                style={{
                  animation: `deep-penetration ${animationSpeed.duration} ease-in-out infinite`,
                  animationDelay: '0.25s',
                }}
              />
            </svg>
          )}
        </div>
      </div>

      {/* Depth indicator HUD */}
      <div className="absolute bottom-4 right-4 bg-slate-800/90 backdrop-blur-sm rounded-lg p-3 border border-slate-700/50">
        <div className="text-xs font-medium text-slate-300 mb-2">Profundidade</div>
        <div className="flex gap-2">
          <div 
            className={`w-2 h-8 rounded-full transition-all duration-300 ${intensity > 0 ? 'bg-cyan-400' : 'bg-slate-700'}`} 
            style={{ opacity: intensity > 0 ? 0.8 : 0.3 }} 
          />
          <div 
            className={`w-2 h-8 rounded-full transition-all duration-300 ${depthPenetration === 'subcutaneous' || depthPenetration === 'deep' ? 'bg-amber-400' : 'bg-slate-700'}`}
            style={{ opacity: (depthPenetration === 'subcutaneous' || depthPenetration === 'deep') ? 0.8 : 0.3 }}
          />
          <div 
            className={`w-2 h-8 rounded-full transition-all duration-300 ${depthPenetration === 'deep' ? 'bg-red-400' : 'bg-slate-700'}`}
            style={{ opacity: depthPenetration === 'deep' ? 0.8 : 0.3 }}
          />
        </div>
        <div className="flex gap-2 mt-1 text-[10px] text-slate-400">
          <div>Sup</div>
          <div>Sub</div>
          <div>Prof</div>
        </div>
      </div>

      {/* Status Badge */}
      <div className="absolute top-4 right-4">
        <div 
          className={`px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm border ${
            intensity < 5 
              ? 'bg-green-500/20 text-green-300 border-green-500/30' 
              : intensity < 15 
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              : 'bg-red-500/20 text-red-300 border-red-500/30'
          }`}
        >
          {intensity < 5 ? 'Baixo' : intensity < 15 ? 'Moderado' : 'Alto'}
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes current-flow {
          0%, 100% { stroke-dashoffset: 0; }
          50% { stroke-dashoffset: 20; }
        }
        
        @keyframes spike-flow {
          0%, 90%, 100% { opacity: 0; }
          5%, 15% { opacity: 1; }
        }
        
        @keyframes burst-flow {
          0%, 100% { opacity: 0.3; }
          20%, 40% { opacity: 1; }
          60%, 80% { opacity: 0.5; }
        }
        
        @keyframes wave-flow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        
        @keyframes pulse-wave {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.3); opacity: 0.3; }
        }
        
        @keyframes deep-penetration {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};
