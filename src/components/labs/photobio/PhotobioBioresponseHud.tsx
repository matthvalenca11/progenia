import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  classifyPhotobioDose,
  getPhotobioBioResponseColor,
  PHOTOBIO_DOSE_THRESHOLDS,
  PHOTOBIO_DOSE_ZONE_LABELS,
  type PhotobioDoseZone,
} from "@/lib/photobioOptics";
import { getPhotobioFieldLegendGradient } from "@/lib/photobioFieldTexture";

const ZONE_SHORT: Record<PhotobioDoseZone, string> = {
  subdose: "Subdose",
  therapeutic: "Terapêutica",
  transition: "Transição",
  inhibitory: "Inibitória",
  saturation: "Saturação",
};

const SCALE_MAX = 55;

interface PhotobioBioresponseHudProps {
  effectiveFluence: number;
  className?: string;
}

export function PhotobioBioresponseHud({
  effectiveFluence,
  className,
}: PhotobioBioresponseHudProps) {
  const classification = classifyPhotobioDose(effectiveFluence);
  const zoneColors = getPhotobioBioResponseColor(classification.zone);
  const gradient = getPhotobioFieldLegendGradient("bioresponse", 660);

  const markerPct = useMemo(
    () => Math.min(100, Math.max(2, (effectiveFluence / SCALE_MAX) * 100)),
    [effectiveFluence],
  );

  return (
    <div
      className={cn(
        "pointer-events-none absolute right-3 bottom-4 z-20 w-56 pb-[max(0px,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div className="pointer-events-none rounded-lg border border-emerald-500/35 bg-slate-950 shadow-xl">
        <div className="px-3.5 py-2.5">
          <p className="text-[13px] font-semibold leading-none text-white">Zona biológica</p>
        </div>

        <div className="space-y-2.5 border-t border-slate-800 px-3.5 pb-3.5 pt-2.5">
          <p className="text-[11px] leading-snug text-slate-400">
            Cor no tecido = ativação simulada (Arndt–Schulz, fluência efetiva local).
          </p>

          <div
            className="h-2.5 w-full rounded-full border border-slate-700"
            style={{ background: gradient }}
            aria-hidden
          />

          <div className="relative h-4">
            <div
              className="absolute top-0 h-4 w-0.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
              style={{ left: `${markerPct}%` }}
              aria-hidden
            />
          </div>

          <div className="flex justify-between text-[9px] text-slate-500">
            <span>0</span>
            <span>
              {PHOTOBIO_DOSE_THRESHOLDS.therapeuticMin}–{PHOTOBIO_DOSE_THRESHOLDS.therapeuticMax}
            </span>
            <span>{SCALE_MAX}</span>
          </div>

          <p className="text-center text-[12px] text-slate-300">
            <span className="font-semibold" style={{ color: zoneColors.emissive }}>
              {ZONE_SHORT[classification.zone]}
            </span>
            {" · "}
            <span className="font-mono font-semibold text-white">{effectiveFluence.toFixed(1)} J/cm²</span>
          </p>

          <p className="text-center text-[10px] text-slate-500">
            {PHOTOBIO_DOSE_ZONE_LABELS[classification.zone]}
          </p>
        </div>
      </div>
    </div>
  );
}
