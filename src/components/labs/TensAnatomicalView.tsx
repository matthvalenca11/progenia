interface TensAnatomicalViewProps {
  activationLevel: number;
  comfortLevel: number;
  frequency: number;
  intensity: number;
}

export function TensAnatomicalView({ 
  activationLevel, 
  comfortLevel, 
  frequency,
  intensity 
}: TensAnatomicalViewProps) {
  
  // Determinar animação baseada na frequência
  const pulseClass = frequency <= 20 ? "animate-pulse-slow" : 
                     frequency <= 80 ? "animate-pulse-medium" : 
                     "animate-pulse-fast";
  
  // Determinar cor do campo baseada no conforto
  const fieldColorClass = comfortLevel >= 70 
    ? "from-emerald-400/30 via-teal-400/20 to-transparent" 
    : comfortLevel >= 40 
    ? "from-amber-400/30 via-orange-400/20 to-transparent"
    : "from-rose-400/30 via-red-400/20 to-transparent";
  
  // Calcular opacidade do campo
  const fieldOpacity = 0.3 + (activationLevel / 100) * 0.6;

  return (
    <div className="relative w-full bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 rounded-2xl p-8 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
      {/* Mesa/Maca de fundo */}
      <div className="absolute inset-4 bg-gradient-to-br from-slate-100/50 to-slate-200/30 rounded-xl" />
      
      {/* Container do antebraço */}
      <div className="relative w-full aspect-[2/1] flex items-center justify-center">
        <svg
          viewBox="0 0 600 300"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Gradiente principal da pele */}
            <linearGradient id="skin-main" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FAF0E6" />
              <stop offset="30%" stopColor="#F5E6D3" />
              <stop offset="70%" stopColor="#EBDCC8" />
              <stop offset="100%" stopColor="#E0D0BC" />
            </linearGradient>
            
            {/* Highlight superior (iluminação) */}
            <linearGradient id="skin-highlight" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
              <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </linearGradient>
            
            {/* Sombra na borda ulnar */}
            <linearGradient id="skin-shadow" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.08" />
              <stop offset="30%" stopColor="#000000" stopOpacity="0" />
            </linearGradient>
            
            {/* Sombra projetada */}
            <filter id="arm-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="8" />
              <feOffset dx="0" dy="6" result="offsetblur" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.15" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            
            {/* Sombra dos eletrodos */}
            <filter id="electrode-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <feOffset dx="0" dy="3" result="offsetblur" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.3" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            
            {/* Textura dos eletrodos */}
            <pattern id="electrode-pattern" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="3" r="0.8" fill="black" opacity="0.03" />
            </pattern>
            
            {/* Gradiente do gel condutor */}
            <radialGradient id="gel-gradient" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#A8D5E2" stopOpacity="0.4" />
              <stop offset="70%" stopColor="#7FB3C3" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#6BA5B8" stopOpacity="0.1" />
            </radialGradient>
          </defs>
          
          {/* Sombra projetada do antebraço */}
          <ellipse
            cx="300"
            cy="160"
            rx="210"
            ry="45"
            fill="black"
            opacity="0.08"
            filter="blur(12px)"
          />
          
          {/* Antebraço - forma anatômica */}
          <g filter="url(#arm-shadow)">
            {/* Corpo principal do antebraço */}
            <path
              d="M 80 120
                 Q 70 130, 70 145
                 Q 70 160, 78 172
                 Q 86 180, 100 182
                 L 480 182
                 Q 500 180, 515 170
                 Q 530 160, 530 145
                 Q 530 130, 520 120
                 Q 505 108, 485 105
                 L 120 105
                 Q 95 108, 80 120 Z"
              fill="url(#skin-main)"
              stroke="#D4C4B0"
              strokeWidth="1.2"
            />
            
            {/* Iluminação superior */}
            <path
              d="M 80 120
                 Q 70 130, 70 145
                 Q 70 160, 78 172
                 Q 86 180, 100 182
                 L 480 182
                 Q 500 180, 515 170
                 Q 530 160, 530 145
                 Q 530 130, 520 120
                 Q 505 108, 485 105
                 L 120 105
                 Q 95 108, 80 120 Z"
              fill="url(#skin-highlight)"
            />
            
            {/* Sombra na borda ulnar (lado interno) */}
            <path
              d="M 70 145
                 Q 70 160, 78 172
                 Q 86 180, 100 182
                 L 120 182
                 Q 100 178, 88 168
                 Q 80 160, 80 145
                 Q 80 130, 88 118
                 Q 95 110, 110 107
                 L 95 107
                 Q 82 112, 75 125
                 Q 70 133, 70 145 Z"
              fill="url(#skin-shadow)"
              opacity="0.6"
            />
            
            {/* Linha da prega do punho */}
            <path
              d="M 85 115 Q 95 112, 110 110"
              stroke="#D8C8B4"
              strokeWidth="1"
              fill="none"
              opacity="0.4"
              strokeLinecap="round"
            />
            
            {/* Contorno muscular sutil (flexores) */}
            <path
              d="M 180 108 Q 300 106, 420 108"
              stroke="#EFE5D8"
              strokeWidth="2.5"
              fill="none"
              opacity="0.5"
              strokeLinecap="round"
            />
            
            {/* Contorno muscular inferior */}
            <path
              d="M 170 178 Q 300 180, 450 178"
              stroke="#DDD0BE"
              strokeWidth="1.5"
              fill="none"
              opacity="0.4"
              strokeLinecap="round"
            />
            
            {/* Transição para a mão (base) */}
            <ellipse
              cx="515"
              cy="143"
              rx="20"
              ry="25"
              fill="#EFE5D8"
              opacity="0.3"
            />
          </g>
          
          {/* Eletrodo proximal (mais perto do cotovelo) */}
          <g filter="url(#electrode-shadow)">
            {/* Gel condutor */}
            <rect
              x="195"
              y="125"
              width="65"
              height="65"
              rx="14"
              fill="url(#gel-gradient)"
            />
            
            {/* Corpo do eletrodo */}
            <rect
              x="198"
              y="128"
              width="59"
              height="59"
              rx="12"
              fill="#DCDCDC"
              stroke="#A8A8A8"
              strokeWidth="1.5"
            />
            
            {/* Textura */}
            <rect
              x="198"
              y="128"
              width="59"
              height="59"
              rx="12"
              fill="url(#electrode-pattern)"
            />
            
            {/* Highlight central */}
            <circle
              cx="227.5"
              cy="157.5"
              r="16"
              fill="white"
              opacity="0.12"
            />
            
            {/* Ponto de conexão */}
            <circle
              cx="227.5"
              cy="157.5"
              r="4"
              fill="#707070"
              opacity="0.9"
            />
          </g>
          
          {/* Eletrodo distal (mais perto do punho) */}
          <g filter="url(#electrode-shadow)">
            {/* Gel condutor */}
            <rect
              x="345"
              y="125"
              width="65"
              height="65"
              rx="14"
              fill="url(#gel-gradient)"
            />
            
            {/* Corpo do eletrodo */}
            <rect
              x="348"
              y="128"
              width="59"
              height="59"
              rx="12"
              fill="#DCDCDC"
              stroke="#A8A8A8"
              strokeWidth="1.5"
            />
            
            {/* Textura */}
            <rect
              x="348"
              y="128"
              width="59"
              height="59"
              rx="12"
              fill="url(#electrode-pattern)"
            />
            
            {/* Highlight central */}
            <circle
              cx="377.5"
              cy="157.5"
              r="16"
              fill="white"
              opacity="0.12"
            />
            
            {/* Ponto de conexão */}
            <circle
              cx="377.5"
              cy="157.5"
              r="4"
              fill="#707070"
              opacity="0.9"
            />
          </g>
        </svg>
        
        {/* Campo elétrico - segue a forma do antebraço */}
        <div 
          className={`absolute inset-0 pointer-events-none flex items-center justify-center ${pulseClass}`}
          style={{ opacity: fieldOpacity }}
        >
          {/* Layer externa do campo */}
          <div 
            className={`absolute bg-gradient-radial ${fieldColorClass} blur-[50px] transition-all duration-700`}
            style={{
              width: '50%',
              height: '40%',
              borderRadius: '40% / 50%',
            }}
          />
          
          {/* Layer interna (mais intensa) */}
          <div 
            className={`absolute bg-gradient-radial ${fieldColorClass.replace('/30', '/50').replace('/20', '/35')} blur-[30px] transition-all duration-700`}
            style={{
              width: '35%',
              height: '25%',
              borderRadius: '45% / 55%',
              animationDelay: '0.2s',
            }}
          />
        </div>
        
        {/* Indicador de intensidade */}
        <div className="absolute bottom-2 right-2 bg-background/95 backdrop-blur-sm rounded-lg px-3 py-2 border shadow-lg">
          <div className="text-xs text-muted-foreground mb-1 font-medium">Campo Elétrico</div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full transition-colors ${
              intensity > 50 ? "bg-red-500 animate-pulse" :
              intensity > 25 ? "bg-amber-500" : 
              intensity > 0 ? "bg-emerald-500" : "bg-muted"
            }`} />
            <span className="text-sm font-semibold">
              {intensity === 0 ? "Inativo" : 
               intensity > 50 ? "Alto" :
               intensity > 25 ? "Médio" : "Baixo"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
