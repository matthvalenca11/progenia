export const TensBaseFigure = () => {
  return (
    <div className="w-full aspect-square flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.06)] p-6 lg:p-8">
      <svg
        viewBox="0 0 500 400"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Enhanced shadow and lighting filters */}
        <defs>
          {/* Electrode shadow - more realistic */}
          <filter id="electrode-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
            <feOffset dx="0" dy="3" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.25" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Subtle pattern for electrode texture */}
          <pattern id="electrode-texture" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.5" fill="black" opacity="0.04" />
          </pattern>

          {/* Radial gradient for skin volume */}
          <radialGradient id="skin-gradient" cx="50%" cy="40%">
            <stop offset="0%" stopColor="#F9EDE0" />
            <stop offset="50%" stopColor="#F4E7D6" />
            <stop offset="100%" stopColor="#E8D5C1" />
          </radialGradient>

          {/* Linear gradient for lighting effect */}
          <linearGradient id="skin-highlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.08" />
          </linearGradient>

          {/* Gel border gradient */}
          <linearGradient id="gel-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A8D5E2" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#7FB3C3" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Main forearm shape - anatomically styled */}
        <g>
          {/* Shadow beneath the forearm */}
          <ellipse
            cx="250"
            cy="215"
            rx="180"
            ry="52"
            fill="black"
            opacity="0.06"
            filter="blur(8px)"
          />

          {/* Forearm base with organic shape */}
          <path
            d="M 80 180 
               Q 70 190, 70 200 
               Q 70 210, 75 218 
               L 425 218 
               Q 430 210, 430 200 
               Q 430 190, 420 180 
               Q 410 175, 400 175 
               L 100 175 
               Q 90 175, 80 180 Z"
            fill="url(#skin-gradient)"
            stroke="#D4C4B0"
            strokeWidth="1.5"
            opacity="1"
          />

          {/* Lighting overlay */}
          <path
            d="M 80 180 
               Q 70 190, 70 200 
               Q 70 210, 75 218 
               L 425 218 
               Q 430 210, 430 200 
               Q 430 190, 420 180 
               Q 410 175, 400 175 
               L 100 175 
               Q 90 175, 80 180 Z"
            fill="url(#skin-highlight)"
            opacity="0.6"
          />

          {/* Subtle anatomical contour lines */}
          <path
            d="M 150 178 Q 250 176, 350 178"
            stroke="#E0D0BC"
            strokeWidth="0.8"
            fill="none"
            opacity="0.4"
          />
          <path
            d="M 140 215 Q 250 213, 360 215"
            stroke="#D8C8B4"
            strokeWidth="0.8"
            fill="none"
            opacity="0.4"
          />
        </g>

        {/* Left electrode - enhanced realism */}
        <g filter="url(#electrode-shadow)">
          {/* Gel border (subtle blue-green) */}
          <rect
            x="135"
            y="175"
            width="75"
            height="75"
            rx="16"
            fill="url(#gel-gradient)"
            opacity="0.5"
          />
          
          {/* Main electrode body */}
          <rect
            x="138"
            y="178"
            width="69"
            height="69"
            rx="14"
            fill="#D8D8D8"
            stroke="#A0A0A0"
            strokeWidth="1.5"
          />
          
          {/* Electrode texture */}
          <rect
            x="138"
            y="178"
            width="69"
            height="69"
            rx="14"
            fill="url(#electrode-texture)"
          />
          
          {/* Central highlight circle */}
          <circle
            cx="172.5"
            cy="212.5"
            r="18"
            fill="white"
            opacity="0.15"
          />
          
          {/* Connection point */}
          <circle
            cx="172.5"
            cy="212.5"
            r="5"
            fill="#808080"
            opacity="0.8"
          />
        </g>

        {/* Right electrode - enhanced realism */}
        <g filter="url(#electrode-shadow)">
          {/* Gel border (subtle blue-green) */}
          <rect
            x="290"
            y="175"
            width="75"
            height="75"
            rx="16"
            fill="url(#gel-gradient)"
            opacity="0.5"
          />
          
          {/* Main electrode body */}
          <rect
            x="293"
            y="178"
            width="69"
            height="69"
            rx="14"
            fill="#D8D8D8"
            stroke="#A0A0A0"
            strokeWidth="1.5"
          />
          
          {/* Electrode texture */}
          <rect
            x="293"
            y="178"
            width="69"
            height="69"
            rx="14"
            fill="url(#electrode-texture)"
          />
          
          {/* Central highlight circle */}
          <circle
            cx="327.5"
            cy="212.5"
            r="18"
            fill="white"
            opacity="0.15"
          />
          
          {/* Connection point */}
          <circle
            cx="327.5"
            cy="212.5"
            r="5"
            fill="#808080"
            opacity="0.8"
          />
        </g>
      </svg>
    </div>
  );
};
