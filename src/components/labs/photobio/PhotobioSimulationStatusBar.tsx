import { RotateCcw, Sun, Zap, Thermometer, Activity, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatPhotobioFraction } from "@/lib/photobioOptics";
import { usePhotobioStore } from "@/stores/photobioStore";
import { usePhotobioInterpretation } from "./usePhotobioInterpretation";
import { PhotobioSnapshotButton } from "./PhotobioSnapshotButton";
import { PhotobioScoreBadge } from "./PhotobioScoreBadge";

interface PhotobioSimulationStatusBarProps {
  onReset?: () => void;
  compact?: boolean;
  className?: string;
}

function MetricPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
      <span>{label}</span>
      <span className={cn("font-mono font-semibold tabular-nums text-foreground", accent)}>{value}</span>
    </span>
  );
}

export function PhotobioSimulationStatusBar({
  onReset,
  compact = false,
  className,
}: PhotobioSimulationStatusBarProps) {
  const resetDefaults = usePhotobioStore((s) => s.resetDefaults);
  const wavelength = usePhotobioStore((s) => s.wavelength);
  const irradiance = usePhotobioStore((s) => s.irradiance());
  const fluence = usePhotobioStore((s) => s.fluence());
  const labMode = usePhotobioStore((s) => s.labMode);
  const challengeScore = usePhotobioStore((s) => s.challengeScore);
  const activeChallengeId = usePhotobioStore((s) => s.activeChallengeId);
  const featureFlags = usePhotobioStore((s) => s.featureFlags);
  const skinMelaninIndex = usePhotobioStore((s) => s.skinMelaninIndex);
  const { interaction, dominantEffect } = usePhotobioInterpretation();

  const handleReset = onReset ?? resetDefaults;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 overflow-x-auto border-b border-border bg-card/95 px-3 py-2 backdrop-blur-sm",
          className,
        )}
      >
        <Badge variant="outline" className="shrink-0 text-[10px] font-mono">
          {wavelength} nm
        </Badge>
        <MetricPill label="F eff." value={`${interaction.effectiveFluence.toFixed(1)}`} accent="text-emerald-500" />
        <MetricPill label="T_músc." value={formatPhotobioFraction(interaction.muscleFluenceRatio)} />
        <MetricPill label="Abs_sup." value={formatPhotobioFraction(interaction.superficialAbsorptionIndex)} />
        <MetricPill label="Mel." value={`${(skinMelaninIndex * 100).toFixed(0)}%`} />
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 text-[10px]",
            interaction.thermalWarning && "border-red-500/40 text-red-500",
          )}
        >
          {interaction.thermalWarning ? "Térm." : "Térm. OK"}
        </Badge>
        <span className={cn("shrink-0 truncate text-[10px] font-medium max-w-[140px]", dominantEffect.accentClass)}>
          {dominantEffect.label}
        </span>
        {labMode === "guided" && activeChallengeId && featureFlags.showGuidedMode && (
          <PhotobioScoreBadge score={challengeScore} compact />
        )}
        {featureFlags.showSnapshots && <PhotobioSnapshotButton compact />}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto h-8 w-8 shrink-0"
          onClick={handleReset}
          aria-label="Resetar"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("border-b border-border bg-card/80 px-4 py-3 backdrop-blur-sm", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5 text-sm">
          <Sun className="h-4 w-4 text-rose-500" />
          <span className="font-mono font-bold tabular-nums">{wavelength} nm</span>
        </div>

        <MetricPill label="Fluência efetiva" value={`${interaction.effectiveFluence.toFixed(2)} J/cm²`} accent="text-emerald-500" />
        <MetricPill label="Nominal" value={`${fluence.toFixed(2)} J/cm²`} />
        <MetricPill label="Irradiância" value={`${irradiance.toFixed(0)} mW/cm²`} />

        <div className="flex items-center gap-1.5 text-sm">
          <Layers className="h-4 w-4 text-violet-500" />
          <span className="text-muted-foreground">Transm. muscular</span>
          <span className="font-mono font-bold tabular-nums">
            {formatPhotobioFraction(interaction.muscleFluenceRatio)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sm">
          <Sun className="h-4 w-4 text-amber-500" />
          <span className="text-muted-foreground">Abs. epiderme+derme</span>
          <span className="font-mono font-bold tabular-nums">
            {formatPhotobioFraction(interaction.superficialAbsorptionIndex)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sm">
          <Activity className="h-4 w-4 text-orange-500" />
          <span className="text-muted-foreground">Melanina</span>
          <span className="font-mono font-bold tabular-nums">
            {(skinMelaninIndex * 100).toFixed(0)}%
          </span>
        </div>

        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-semibold",
            interaction.arndtSchulzZone === "Janela Terapêutica Ativa"
              ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
              : "border-border",
          )}
        >
          {interaction.arndtSchulzZone}
        </Badge>

        <div className="flex items-center gap-1.5 text-sm">
          <Thermometer className={cn("h-4 w-4", interaction.thermalWarning ? "text-red-500" : "text-muted-foreground")} />
          <span className="text-muted-foreground">Risco térmico</span>
          <span className={cn("font-mono font-bold tabular-nums", interaction.thermalWarning && "text-red-500")}>
            {(interaction.thermalRiskIndex * 100).toFixed(0)}%
          </span>
        </div>

        <div className="hidden min-w-0 max-w-[280px] lg:flex items-center gap-1.5 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Fenômeno:{" "}
            <span className={cn("font-medium", dominantEffect.accentClass)}>{dominantEffect.label}</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {labMode === "guided" && activeChallengeId && featureFlags.showGuidedMode && (
            <PhotobioScoreBadge score={challengeScore} compact />
          )}
          {featureFlags.showSnapshots && <PhotobioSnapshotButton />}
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>

      <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
        <Zap className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", dominantEffect.accentClass)} />
        <p className="leading-relaxed">
          <span className={cn("font-semibold", dominantEffect.accentClass)}>{dominantEffect.label}</span>
          {" — "}
          {interaction.dominantOpticalPhenomenon}
        </p>
      </div>
    </div>
  );
}
