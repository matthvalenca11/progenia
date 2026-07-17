import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isOverDose, PHOTOBIO_DOSE_THRESHOLDS } from "@/lib/photobioOptics";
import { usePhotobioStore } from "@/stores/photobioStore";
import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import { PhotobioDominantEffectCard } from "./PhotobioDominantEffectCard";
import { PhotobioDepthProfileChart } from "./PhotobioDepthProfileChart";
import { PhotobioDoseQualityCard } from "./PhotobioDoseQualityCard";
import { PhotobioTechniqueBreakdown } from "./PhotobioTechniqueBreakdown";
import { PhotobioChallengePanel } from "./PhotobioChallengePanel";
import { PhotobioPresetCards } from "./PhotobioPresetCards";
import { PhotobioSessionTimeline } from "./PhotobioSessionTimeline";
import { PhotobioComparisonPanel } from "./PhotobioComparisonPanel";
import { usePhotobioInterpretation } from "./usePhotobioInterpretation";

function zoneColor(zone: string) {
  if (zone === "Janela Terapêutica Ativa") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (zone === "Efeito Inibitório / Sedação") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  if (zone === "Bioinibição / Saturação") return "bg-red-500/15 text-red-400 border-red-500/30";
  if (zone === "Subdose / Efeito Nulo") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-muted text-foreground border-border";
}

export function PhotobioInsightsPanel() {
  const interaction = usePhotobioStore((s) => s.interaction);
  const wavelength = usePhotobioStore((s) => s.wavelength);
  const doseMap = usePhotobioStore((s) => s.doseMap);
  const resetDoseMap = usePhotobioStore((s) => s.resetDoseMap);
  const featureFlags = usePhotobioStore((s) => s.featureFlags);
  const { dominantEffect } = usePhotobioInterpretation();

  const hasDoseHistory = doseMap.some((d) => d > 0.5);
  const doseAnalysis = useMemo(() => {
    if (!hasDoseHistory) return null;
    const { therapeuticMin, therapeuticMax } = PHOTOBIO_DOSE_THRESHOLDS;
    const under = doseMap.filter((d) => d > 0.5 && d < therapeuticMin).length;
    const optimal = doseMap.filter((d) => d >= therapeuticMin && d <= therapeuticMax).length;
    const over = doseMap.filter((d) => isOverDose(d)).length;
    const untouched = doseMap.filter((d) => d <= 0.5).length;
    return { under, optimal, over, untouched, total: doseMap.length };
  }, [doseMap, hasDoseHistory]);

  return (
    <div className="space-y-4 p-4">
      {featureFlags.showGuidedMode && <PhotobioChallengePanel compact />}

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Interpretação física</h3>
        <Badge className={zoneColor(interaction.arndtSchulzZone)}>{interaction.arndtSchulzZone}</Badge>
      </div>

      <PhotobioDominantEffectCard />

      {interaction.thermalWarning && (
        <div className="rounded-lg border-2 border-red-500/50 bg-red-500/15 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-200">
                Risco térmico — {interaction.irradiance.toFixed(0)} mW/cm²
              </p>
              <p className="text-xs text-red-100/90 mt-1">
                Índice {(interaction.thermalRiskIndex * 100).toFixed(0)}%. PBM é majoritariamente não térmica na faixa
                segura; reduza irradiância ou amplie o spot.
              </p>
            </div>
          </div>
        </div>
      )}

      {interaction.anatomyWarning && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-sm text-amber-100">{interaction.anatomyWarning}</p>
        </div>
      )}

      <PhotobioDoseQualityCard />
      {featureFlags.showAdvancedPhysics && (
        <>
          <PhotobioDepthProfileChart />
          <PhotobioTechniqueBreakdown />
        </>
      )}
      {!featureFlags.showAdvancedPhysics && <PhotobioTechniqueBreakdown />}

      {wavelength === 808 && (
        <p className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-950/20 px-3 py-2 text-[10px] leading-relaxed text-fuchsia-100/90">
          No viewer 3D, 808 nm aparece em magenta/vermelho profundo como representação <strong>didática</strong> do
          infravermelho — não é luz visível clinicamente.
        </p>
      )}

      {hasDoseHistory && doseAnalysis && (
        <div className="rounded-lg border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Mapa de dose acumulada (scanning)</p>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px]" onClick={resetDoseMap}>
              Limpar mapa
            </Button>
          </div>

          <div className="flex h-3 w-full overflow-hidden rounded-full border bg-muted/30">
            {doseMap.map((dose, i) => {
              const n = Math.min(1, dose / 30);
              const color =
                dose <= 0.5 ? "transparent" : dose < PHOTOBIO_DOSE_THRESHOLDS.therapeuticMin ? "#fbbf24" : dose <= PHOTOBIO_DOSE_THRESHOLDS.therapeuticMax ? "#22c55e" : "#ef4444";
              return (
                <div
                  key={`dose-bar-${i}`}
                  className="h-full flex-1"
                  style={{ backgroundColor: color, opacity: dose <= 0.5 ? 0.15 : 0.35 + n * 0.55 }}
                  title={`Segmento ${i + 1}: ${dose.toFixed(1)} J/cm²`}
                />
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
              <span className="text-amber-300 font-semibold">{doseAnalysis.under}</span>
              <span className="text-muted-foreground"> subdosados</span>
            </div>
            <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5">
              <span className="text-emerald-300 font-semibold">{doseAnalysis.optimal}</span>
              <span className="text-muted-foreground"> na janela</span>
            </div>
            <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5">
              <span className="text-red-300 font-semibold">{doseAnalysis.over}</span>
              <span className="text-muted-foreground"> sobredosados</span>
            </div>
            <div className="rounded border bg-muted/30 px-2 py-1.5">
              <span className="font-semibold">{doseAnalysis.untouched}</span>
              <span className="text-muted-foreground"> não cobertos</span>
            </div>
          </div>
        </div>
      )}

      {interaction.techniqueWarnings.length > 0 && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 space-y-2">
          {interaction.techniqueWarnings.map((warning) => (
            <div key={warning} className="flex items-start gap-2 text-xs text-orange-100">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-orange-400" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Fenômeno óptico base: {interaction.dominantOpticalPhenomenon}. Interpretação: {dominantEffect.label}.
      </p>

      {featureFlags.showSnapshots && (
        <>
          <PhotobioSessionTimeline compact />
          <PhotobioComparisonPanel compact />
        </>
      )}
    </div>
  );
}
