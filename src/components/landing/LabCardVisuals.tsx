/**
 * Contextual lab thumbnails — illustrated clinical / equipment scenes (SVG).
 * No external assets; readable at small card sizes.
 */

import { useId } from "react";

const wrapClass =
  "relative h-full min-h-[148px] w-full overflow-hidden rounded-2xl bg-[#0b0d12] ring-1 ring-white/[0.06]";

export function FotobioLabVisual() {
  const uid = useId().replace(/:/g, "");
  const skin = `fbmSkin-${uid}`;
  const beam = `fbmBeam-${uid}`;
  return (
    <div className={wrapClass} aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(165deg, #1a2332 0%, #0d1219 40%, #151c28 100%), radial-gradient(ellipse 90% 70% at 70% 100%, rgba(255,100,50,0.12), transparent 55%)",
        }}
      />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id={skin} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#d4a574" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#b8956a" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id={beam} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff6b35" stopOpacity="0.85" />
            <stop offset="55%" stopColor="#ff00aa" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ff00aa" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* treatment couch / surface */}
        <rect x="0" y="118" width="320" height="62" fill="#121820" />
        <ellipse cx="160" cy="118" rx="118" ry="28" fill={`url(#${skin})`} />
        <path d="M52 118 Q160 108 268 118" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        {/* cluster handpiece */}
        <rect x="132" y="28" width="56" height="72" rx="10" fill="#e8eaed" opacity="0.95" />
        <rect x="138" y="36" width="44" height="18" rx="4" fill="#c5ccd6" />
        <ellipse cx="160" cy="108" rx="22" ry="10" fill="#d8f4fc" opacity="0.35" />
        <circle cx="152" cy="98" r="3.5" fill="#ff4500" opacity="0.9" />
        <circle cx="160" cy="96" r="3.5" fill="#ff4500" opacity="0.9" />
        <circle cx="168" cy="98" r="3.5" fill="#ff4500" opacity="0.9" />
        <circle cx="156" cy="104" r="2.5" fill="#ff00aa" opacity="0.75" />
        <circle cx="164" cy="104" r="2.5" fill="#ff00aa" opacity="0.75" />
        {/* beam into tissue */}
        <path d="M148 108 L154 118 L166 118 L172 108 Z" fill={`url(#${beam})`} opacity="0.9" />
        <ellipse cx="160" cy="132" rx="18" ry="22" fill={`url(#${beam})`} opacity="0.35" />
      </svg>
    </div>
  );
}

export function UltrasoundLabVisual() {
  const uid = useId().replace(/:/g, "");
  const usSkin = `usSkin-${uid}`;
  return (
    <div className={wrapClass} aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(155deg, #0c1828 0%, #0a1420 50%, #061018 100%)",
        }}
      />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id={usSkin} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#c9a88a" />
            <stop offset="100%" stopColor="#a88b72" />
          </linearGradient>
        </defs>
        <rect x="0" y="125" width="320" height="55" fill="#0e1620" />
        <ellipse cx="165" cy="125" rx="105" ry="24" fill={`url(#${usSkin})`} />
        {/* gel layer sheen */}
        <ellipse cx="168" cy="118" rx="38" ry="12" fill="rgba(56,189,248,0.15)" />
        {/* therapy transducer head */}
        <rect x="138" y="42" width="54" height="64" rx="12" fill="#dfe6ee" />
        <rect x="144" y="50" width="42" height="14" rx="3" fill="#94a3b8" opacity="0.6" />
        <ellipse cx="165" cy="112" rx="20" ry="8" fill="#38bdf8" opacity="0.25" />
        {/* acoustic waves */}
        {[0, 1, 2, 3].map((i) => (
          <ellipse
            key={i}
            cx="165"
            cy="128"
            rx={12 + i * 14}
            ry={6 + i * 5}
            fill="none"
            stroke="rgba(34,211,238,0.35)"
            strokeWidth="1.2"
            opacity={1 - i * 0.18}
          />
        ))}
      </svg>
    </div>
  );
}

export function DiagnosticUltrasoundLabVisual() {
  const uid = useId().replace(/:/g, "");
  const scanClip = `dxScan-${uid}`;
  const speckle = `dxSpeck-${uid}`;
  const fieldGrad = `dxField-${uid}`;
  const cystGrad = `dxCyst-${uid}`;
  const enhance = `dxPost-${uid}`;
  const noiseF = `dxNoise-${uid}`;
  return (
    <div className={wrapClass} aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 35% 45%, rgba(56,189,248,0.07), transparent 55%), linear-gradient(155deg, #0f141c 0%, #06090e 100%)",
        }}
      />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <clipPath id={scanClip}>
            <path d="M 118 38 L 38 148 L 198 148 Z" />
          </clipPath>
          <pattern id={speckle} width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill="#05080d" />
            <circle cx="1.2" cy="2.4" r="0.45" fill="#f1f5f9" opacity="0.07" />
            <circle cx="3.6" cy="1.1" r="0.35" fill="#e2e8f0" opacity="0.06" />
            <circle cx="2.8" cy="3.8" r="0.3" fill="#cbd5e1" opacity="0.05" />
            <circle cx="0.5" cy="4.2" r="0.25" fill="#94a3b8" opacity="0.06" />
          </pattern>
          <linearGradient id={fieldGrad} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1a2332" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#0f172a" stopOpacity="1" />
            <stop offset="100%" stopColor="#020617" stopOpacity="1" />
          </linearGradient>
          <radialGradient id={cystGrad} cx="50%" cy="45%">
            <stop offset="0%" stopColor="#0b1220" stopOpacity="0.92" />
            <stop offset="55%" stopColor="#1e293b" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.2" />
          </radialGradient>
          <radialGradient id={enhance} cx="50%" cy="0%">
            <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.22" />
            <stop offset="45%" stopColor="#cbd5e1" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
          <filter id={noiseF} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="3" seed="17" result="t" />
            <feColorMatrix
              in="t"
              type="matrix"
              values="0 0 0 0 0.92
                      0 0 0 0 0.94
                      0 0 0 0 0.98
                      0 0 0 0.14 0"
              result="g"
            />
          </filter>
        </defs>

        {/* monitor */}
        <rect x="14" y="26" width="212" height="132" rx="10" fill="#1e293b" stroke="rgba(148,163,184,0.35)" strokeWidth="1.2" />
        <rect x="20" y="32" width="200" height="120" rx="5" fill="#020617" stroke="rgba(56,189,248,0.25)" strokeWidth="1" />

        {/* B-mode sector + speckle */}
        <g clipPath={`url(#${scanClip})`}>
          <rect x="20" y="28" width="200" height="130" fill={`url(#${fieldGrad})`} />
          <rect x="20" y="28" width="200" height="130" fill={`url(#${speckle})`} opacity="0.85" />
          <rect x="20" y="28" width="200" height="130" fill="#ffffff" filter={`url(#${noiseF})`} opacity="0.35" />
          {/* skin / near field */}
          <path
            d="M 38 46 Q 118 52 198 46"
            fill="none"
            stroke="#f8fafc"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.88"
          />
          <path d="M 38 46 Q 118 52 198 46" fill="none" stroke="#38bdf8" strokeWidth="0.6" strokeLinecap="round" opacity="0.35" />
          {/* reverberation lines */}
          {[1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1={42 + i * 3}
              y1={52 + i * 10}
              x2={194 - i * 2}
              y2={52 + i * 10}
              stroke="#e2e8f0"
              strokeWidth="0.55"
              opacity={0.14 - i * 0.022}
            />
          ))}
          {/* hypoechoic region + bright rim */}
          <ellipse cx="118" cy="102" rx="34" ry="28" fill={`url(#${cystGrad})`} />
          <ellipse
            cx="118"
            cy="102"
            rx="34"
            ry="28"
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="1.4"
            opacity="0.55"
          />
          {/* posterior enhancement */}
          <ellipse cx="118" cy="138" rx="40" ry="22" fill={`url(#${enhance})`} />
        </g>

        {/* sector outline */}
        <path
          d="M 118 38 L 38 148 L 198 148 Z"
          fill="none"
          stroke="rgba(56,189,248,0.35)"
          strokeWidth="0.9"
        />

        {/* depth scale */}
        <line x1="30" y1="40" x2="30" y2="150" stroke="rgba(148,163,184,0.55)" strokeWidth="1" />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line x1="28" y1={44 + i * 26} x2="34" y2={44 + i * 26} stroke="rgba(226,232,240,0.65)" strokeWidth="1" />
            <text
              x="22"
              y={47 + i * 26}
              fill="rgba(148,163,184,0.85)"
              fontSize="7"
              fontFamily="system-ui, sans-serif"
              textAnchor="end"
            >
              {i * 2}
            </text>
          </g>
        ))}

        {/* status strip */}
        <rect x="236" y="36" width="72" height="14" rx="3" fill="#0f172a" stroke="rgba(148,163,184,0.25)" strokeWidth="0.6" />
        <text x="242" y="46" fill="rgba(148,163,184,0.9)" fontSize="7" fontFamily="system-ui, sans-serif">
          B-mode · 7.5 MHz
        </text>

        {/* curvilinear probe */}
        <rect x="244" y="58" width="52" height="72" rx="14" fill="#d8dee9" stroke="#94a3b8" strokeWidth="1" />
        <rect x="250" y="64" width="40" height="22" rx="4" fill="#b8c4d4" stroke="#64748b" strokeWidth="0.5" />
        <ellipse cx="270" cy="96" rx="16" ry="7" fill="#64748b" opacity="0.45" />
        <path
          d="M 254 128 Q 270 138 286 128 L 286 134 Q 270 142 254 134 Z"
          fill="#475569"
          stroke="#334155"
          strokeWidth="0.6"
        />
        <rect x="262" y="132" width="16" height="5" rx="1" fill="#1e293b" opacity="0.85" />
        <path
          d="M 286 118 Q 302 108 308 88"
          fill="none"
          stroke="#475569"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path d="M 308 88 Q 312 78 310 68" fill="none" stroke="#334155" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function MriLabVisual() {
  const uid = useId().replace(/:/g, "");
  const donut = `mriDonut-${uid}`;
  const bore = `mriBoreHole-${uid}`;
  const cx = 158;
  const cy = 80;
  return (
    <div className={wrapClass} aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 80% at 50% 38%, rgba(226,232,240,0.1), transparent 52%), linear-gradient(180deg, #0f141c 0%, #040508 100%)",
        }}
      />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id={donut} x1="15%" y1="10%" x2="90%" y2="95%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="30%" stopColor="#e2e8f0" />
            <stop offset="65%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
          <radialGradient id={bore} cx="50%" cy="40%">
            <stop offset="0%" stopColor="#4338ca" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#020617" stopOpacity="1" />
            <stop offset="100%" stopColor="#000000" stopOpacity="1" />
          </radialGradient>
        </defs>
        <rect x="0" y="148" width="320" height="32" fill="#07090e" />
        <rect x="0" y="146" width="320" height="2" fill="rgba(148,163,184,0.12)" />
        <ellipse cx={cx} cy="152" rx="92" ry="11" fill="#1e293b" />
        <ellipse cx={cx} cy="149" rx="76" ry="7" fill="#334155" opacity="0.85" />
        {/* maca frontal subindo ao centro do “donut” */}
        <path d="M 124 178 L 196 178 L 188 94 L 132 94 Z" fill="#e8edf3" stroke="#64748b" strokeWidth="1" />
        <rect x="130" y="92" width="60" height="7" rx="2" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.5" />
        <rect x="134" y="104" width="52" height="32" rx="4" fill="#d1d9e2" stroke="#94a3b8" strokeWidth="0.7" />
        {/* fundo do túnel (atrás do anel) */}
        <circle cx={cx} cy={cy} r="34" fill={`url(#${bore})`} />
        <circle cx={cx} cy={cy} r="24" fill="#000000" />
        {/*
          Anel do ímã: traço grosso no círculo médio = silhueta clássica de RM (donut).
          r=56, strokeWidth=40 → furo interno ~r=36
        */}
        <circle
          cx={cx}
          cy={cy}
          r="56"
          fill="none"
          stroke={`url(#${donut})`}
          strokeWidth="40"
          strokeLinejoin="round"
        />
        <circle cx={cx} cy={cy} r="56" fill="none" stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
        <path
          d={`M ${cx - 52} ${cy - 50} Q ${cx} ${cy - 72} ${cx + 52} ${cy - 50}`}
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="34" fill="none" stroke="#0f172a" strokeWidth="2" />
        <circle cx={cx} cy={cy} r="34" fill="none" stroke="rgba(129,140,248,0.3)" strokeWidth="1" />
      </svg>
    </div>
  );
}

export function ElectroLabVisual() {
  return (
    <div className={wrapClass} aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(160deg, #0f1419 0%, #080b0e 100%)",
        }}
      />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden>
        {/* limb / skin */}
        <ellipse cx="210" cy="118" rx="72" ry="38" fill="#c9a88a" opacity="0.9" />
        <ellipse cx="210" cy="112" rx="58" ry="28" fill="#d4b69a" opacity="0.5" />
        {/* stim device */}
        <rect x="36" y="48" width="88" height="72" rx="8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
        <rect x="44" y="56" width="72" height="36" rx="3" fill="#0f172a" />
        <rect x="50" y="64" width="8" height="20" rx="1" fill="hsl(173 68% 48%)" opacity="0.85" />
        <rect x="62" y="68" width="8" height="14" rx="1" fill="hsl(173 68% 48%)" opacity="0.6" />
        <rect x="74" y="62" width="8" height="22" rx="1" fill="hsl(173 68% 48%)" opacity="0.75" />
        <circle cx="98" cy="78" r="6" fill="#334155" />
        <rect x="44" y="100" width="28" height="10" rx="2" fill="#64748b" />
        <rect x="76" y="100" width="28" height="10" rx="2" fill="#64748b" />
        {/* leads */}
        <path d="M124 84 Q160 90 178 102" fill="none" stroke="#475569" strokeWidth="2.5" />
        <path d="M124 96 Q155 104 185 112" fill="none" stroke="#475569" strokeWidth="2.5" />
        {/* electrode pads */}
        <rect x="178" y="96" width="22" height="30" rx="4" fill="#f8fafc" stroke="#64748b" strokeWidth="1" />
        <rect x="182" y="100" width="14" height="18" rx="2" fill="#38bdf8" opacity="0.35" />
        <rect x="198" y="108" width="22" height="30" rx="4" fill="#f8fafc" stroke="#64748b" strokeWidth="1" />
        <rect x="202" y="112" width="14" height="18" rx="2" fill="#38bdf8" opacity="0.35" />
      </svg>
    </div>
  );
}
