export const TensBaseFigure = () => {
  return (
    <div className="w-full aspect-square flex items-center justify-center bg-background/50 rounded-lg">
      <svg
        viewBox="0 0 400 400"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shadow filter for electrodes */}
        <defs>
          <filter id="electrode-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="2" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Skin band - horizontal beige strip */}
        <rect
          x="50"
          y="150"
          width="300"
          height="100"
          rx="12"
          fill="hsl(30, 35%, 85%)"
          stroke="hsl(30, 25%, 75%)"
          strokeWidth="1"
        />

        {/* Left electrode */}
        <g filter="url(#electrode-shadow)">
          <rect
            x="100"
            y="165"
            width="70"
            height="70"
            rx="8"
            fill="hsl(0, 0%, 82%)"
            stroke="hsl(0, 0%, 60%)"
            strokeWidth="2"
          />
          {/* Electrode center detail */}
          <circle
            cx="135"
            cy="200"
            r="4"
            fill="hsl(0, 0%, 60%)"
          />
        </g>

        {/* Right electrode */}
        <g filter="url(#electrode-shadow)">
          <rect
            x="230"
            y="165"
            width="70"
            height="70"
            rx="8"
            fill="hsl(0, 0%, 82%)"
            stroke="hsl(0, 0%, 60%)"
            strokeWidth="2"
          />
          {/* Electrode center detail */}
          <circle
            cx="265"
            cy="200"
            r="4"
            fill="hsl(0, 0%, 60%)"
          />
        </g>
      </svg>
    </div>
  );
};
