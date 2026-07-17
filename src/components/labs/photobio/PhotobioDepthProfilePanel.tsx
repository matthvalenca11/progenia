import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { getPhotobioFieldLegendGradient } from "@/lib/photobioFieldTexture";
import type { PhotobioOpticsResult, PhotobioWavelength } from "@/lib/photobioOptics";
import type { PhotobioInteractionMap } from "@/lib/photobioInteractionMap";

const LAYER_COLORS: Record<string, string> = {
  epidermis: "#fbbf24",
  dermis: "#f97316",
  adipose: "#fde047",
  muscle: "#a855f7",
};

interface PhotobioDepthProfilePanelProps {
  opticsProfile: PhotobioOpticsResult;
  wavelength: PhotobioWavelength;
  interactionMap?: PhotobioInteractionMap;
  className?: string;
}

export function PhotobioDepthProfilePanel({
  opticsProfile,
  wavelength,
  interactionMap,
  className,
}: PhotobioDepthProfilePanelProps) {
  const samples = opticsProfile.depthSamples ?? opticsProfile.samples ?? [];

  const chart = useMemo(() => {
    const maxZ = Math.max(...samples.map((s) => s.zMm), 1);
    const step = Math.max(1, Math.floor(samples.length / 24));
    const points = samples
      .filter((_, i) => i % step === 0)
      .map((s) => ({
        x: s.fluenceRelative * 100,
        y: s.zMm,
        layer: s.layerType,
      }));
    return { maxZ, points };
  }, [samples]);

  const penetração = opticsProfile.penetrationDepthMm.toFixed(0);
  const alvo = interactionMap?.targetDepthMm.toFixed(0);

  return (
    <div className={cn("pointer-events-none absolute right-3 bottom-4 z-20 w-56 pb-[max(0px,env(safe-area-inset-bottom))]", className)}>
      <div className="pointer-events-none rounded-lg border border-violet-400/40 bg-slate-950 shadow-xl">
        <div className="px-3.5 py-2.5">
          <p className="text-[13px] font-semibold leading-none text-white">Fluência × profundidade</p>
          <p className="mt-1 text-[11px] text-slate-400">
            {wavelength} nm · penetração ~{penetração} mm
          </p>
        </div>

        <div className="border-t border-slate-800 px-3.5 pb-3.5 pt-2.5">
          <svg viewBox="0 0 168 132" className="h-[132px] w-full" role="img" aria-label="Perfil de fluência">
            <rect x="34" y="8" width="124" height="100" fill="#0f172a" rx="3" stroke="#334155" strokeWidth="0.75" />
            {chart.points.map((p, i) => {
              const y = 8 + (p.y / chart.maxZ) * 96;
              const w = (p.x / 100) * 116;
              return (
                <rect
                  key={`bar-${i}`}
                  x="38"
                  y={y}
                  width={Math.max(1.5, w)}
                  height={3}
                  fill={LAYER_COLORS[p.layer] ?? "#64748b"}
                  opacity={0.8}
                />
              );
            })}
            <polyline
              fill="none"
              stroke="#f8fafc"
              strokeWidth="2.25"
              strokeLinejoin="round"
              points={chart.points
                .map((p) => `${38 + (p.x / 100) * 116},${8 + (p.y / chart.maxZ) * 96}`)
                .join(" ")}
            />
            <text x="4" y="16" fill="#e2e8f0" fontSize="11" fontWeight="600">
              100%
            </text>
            <text x="8" y="112" fill="#94a3b8" fontSize="10">
              0%
            </text>
            <text x="96" y="124" fill="#cbd5e1" fontSize="11" textAnchor="middle">
              {chart.maxZ.toFixed(0)} mm
            </text>
          </svg>

          <p className="mt-2 text-center text-[12px] leading-snug text-slate-300">
            Penetração{" "}
            <span className="font-mono font-semibold text-white">~{penetração} mm</span>
            {alvo ? (
              <>
                {" · "}
                alvo <span className="font-mono font-semibold text-violet-200">{alvo} mm</span>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  );
}
