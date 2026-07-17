import { Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getPhotobioFieldLegendGradient,
  getPhotobioFieldModeDescription,
  getPhotobioFieldModeLabel,
  getPhotobioFluenceScaleLabels,
  type PhotobioFieldMode,
} from "@/lib/photobioFieldTexture";
import type { PhotobioWavelength } from "@/lib/photobioOptics";
import type { PhotobioInteractionMap } from "@/lib/photobioInteractionMap";

interface PhotobioOpticalLegendProps {
  mode: PhotobioFieldMode;
  wavelength: PhotobioWavelength;
  interactionMap?: PhotobioInteractionMap;
  penetrationDepthMm?: number;
  beamVisualDepthMm?: number;
  compact?: boolean;
  className?: string;
}

export function PhotobioOpticalLegend({
  mode,
  wavelength,
  interactionMap,
  penetrationDepthMm,
  beamVisualDepthMm,
  compact = false,
  className,
}: PhotobioOpticalLegendProps) {
  const gradient = getPhotobioFieldLegendGradient(mode, wavelength);
  const title = getPhotobioFieldModeLabel(mode);
  const description = getPhotobioFieldModeDescription(mode);
  const fluenceScale = getPhotobioFluenceScaleLabels();

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-20 w-52 pb-[max(0px,env(safe-area-inset-bottom))]",
        compact ? "right-3 bottom-[5.5rem]" : "right-3 bottom-4",
        className,
      )}
    >
      <div className="pointer-events-none rounded-lg border border-slate-700/80 bg-slate-950 shadow-lg">
        <div className="flex items-center gap-2 px-3 py-2">
          <Sun className="h-3.5 w-3.5 shrink-0 text-rose-400" />
          <span className="text-xs font-semibold text-slate-100">{title}</span>
        </div>

        <div className="space-y-2 border-t border-slate-800 px-3 pb-3 pt-2">
          <p className="text-[10px] leading-snug text-slate-400">{description}</p>
          <div className="flex items-stretch gap-2">
            <div
              className={cn("w-2.5 shrink-0 rounded-sm border border-slate-600/80", compact ? "h-14" : "h-16")}
              style={{ background: gradient }}
              aria-hidden
            />
            <div className="flex flex-col justify-between text-[9px] text-slate-400">
              {mode === "fluence" ? (
                <>
                  <span>{fluenceScale.max.toFixed(0)} J/cm²</span>
                  <span>{fluenceScale.mid.toFixed(1)}</span>
                  <span>{fluenceScale.min.toFixed(0)}</span>
                </>
              ) : mode === "beam" ? (
                <>
                  <span className="font-medium text-amber-300">Entrada</span>
                  <span className="text-yellow-200/80">Meio</span>
                  <span className="text-orange-400/70">Limite</span>
                </>
              ) : mode === "absorption" ? (
                <>
                  <span>Forte</span>
                  <span>Média</span>
                  <span>Fraca</span>
                </>
              ) : (
                <>
                  <span>Saturação</span>
                  <span>Terapêutico</span>
                  <span>Subdose</span>
                </>
              )}
            </div>
          </div>
          {mode === "beam" && penetrationDepthMm != null ? (
            <p className="text-[10px] text-slate-400">
              {wavelength} nm · penetração ~{penetrationDepthMm.toFixed(0)} mm
              {beamVisualDepthMm != null ? ` · fade ${beamVisualDepthMm.toFixed(0)} mm` : ""}
            </p>
          ) : interactionMap ? (
            <p className="text-[10px] text-slate-400">
              {wavelength} nm · alvo {interactionMap.targetDepthMm.toFixed(0)} mm
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
