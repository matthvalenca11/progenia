/**
 * Preview admin PBM — simulador 3D + métricas dos defaults (padrão ultrassom terapêutico)
 */

import { useEffect, useMemo, type ReactNode } from "react";
import { Layers, Sun, Thermometer, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PhotobioTissueViewer } from "@/components/labs/photobio/PhotobioTissueViewer";
import { usePhotobioStore } from "@/stores/photobioStore";
import {
  computePhotobioPreviewMetrics,
  PHOTOBIO_APPLICATOR_LABELS,
  type PhotobioLabConfig,
} from "@/types/photobioLabConfig";
import { cn } from "@/lib/utils";
import { PhotobioPreviewMetricsAlerts } from "./PhotobioPreviewMetricsAlerts";

interface PhotobioLabPreviewProps {
  config: PhotobioLabConfig;
  variant?: "metrics" | "full";
}

const PREVIEW_SHELL =
  "overflow-hidden border-rose-500/20 bg-gradient-to-br from-slate-950 to-slate-900 text-slate-100 shadow-sm";
const PREVIEW_HEADER = "border-b border-slate-800/60 py-3";
const PREVIEW_DESC = "text-sm text-slate-400";

const ANATOMY_LABELS: Record<PhotobioLabConfig["anatomyPreset"], string> = {
  default: "Padrão",
  elderly: "Idoso",
  athlete: "Atleta",
  obese: "Obeso",
  custom: "Customizado",
};

export function PhotobioLabPreview({ config, variant = "metrics" }: PhotobioLabPreviewProps) {
  const metrics = computePhotobioPreviewMetrics(config);
  const configSummary = useMemo(
    () =>
      [
        `${config.wavelength} nm`,
        PHOTOBIO_APPLICATOR_LABELS[config.applicatorType],
        ANATOMY_LABELS[config.anatomyPreset],
        `Melanina ${(config.skinMelaninIndex * 100).toFixed(0)}%`,
      ].join(" · "),
    [config],
  );

  useEffect(() => {
    const store = usePhotobioStore.getState();
    if (!store.labConfigBaseline) {
      store.initializeLab(config, { preserveSessionAppearance: true });
      return;
    }
    store.syncPhotobioPreviewConfig(config);
  }, [config]);

  const simulator = (
    <Card className={cn(PREVIEW_SHELL, "w-full")}>
      <CardHeader className={PREVIEW_HEADER}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base text-rose-400">
              <Sun className="h-4 w-4" />
              Simulador 3D biomédico
            </CardTitle>
          </div>
          <Badge variant="outline" className="max-w-full shrink-0 border-slate-700 text-[10px] font-normal text-slate-300">
            {configSummary}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="relative h-[500px] min-h-[500px] p-0">
        <PhotobioTissueViewer embedded />
      </CardContent>
    </Card>
  );

  const metricsPanel = (
    <Card className={cn(PREVIEW_SHELL, "w-full")}>
      <CardHeader className={PREVIEW_HEADER}>
        <CardTitle className="text-base text-rose-300">Métricas dos defaults salvos</CardTitle>
        <CardDescription className={PREVIEW_DESC}>
          Calculado a partir da configuração — não depende do estado efêmero do aluno.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/60 px-4 py-3">
          <StatusBadge
            label={metrics.doseLabel}
            tone={
              metrics.doseZone === "therapeutic"
                ? "success"
                : metrics.doseZone === "saturation" || metrics.doseZone === "inhibitory"
                  ? "danger"
                  : "neutral"
            }
          />
          <StatusBadge
            label={`Risco térmico ${(metrics.thermalRiskIndex * 100).toFixed(0)}%`}
            tone={metrics.thermalWarning ? "danger" : "neutral"}
            icon={<Thermometer className="h-3 w-3" />}
          />
          <StatusBadge
            label={`Músculo ${(metrics.muscleTransmission * 100).toFixed(0)}%`}
            tone="neutral"
            icon={<Layers className="h-3 w-3" />}
          />
        </div>

        <PhotobioPreviewMetricsAlerts config={config} />

        <div className="grid grid-cols-2 divide-x divide-y divide-slate-800/60 border-b border-slate-800/60 sm:grid-cols-3">
          <MetricCell label="Fluência efetiva" value={`${metrics.effectiveFluence.toFixed(2)}`} unit="J/cm²" accent="text-emerald-400" />
          <MetricCell label="Fluência nominal" value={`${metrics.nominalFluence.toFixed(2)}`} unit="J/cm²" />
          <MetricCell label="Irradiância" value={`${metrics.irradiance.toFixed(0)}`} unit="mW/cm²" accent={metrics.irradiance > 400 ? "text-red-400" : undefined} />
          <MetricCell label="Fluência no músculo" value={`${metrics.muscleFluence.toFixed(2)}`} unit="J/cm²" />
          <MetricCell label="Transmissão muscular" value={`${(metrics.muscleTransmission * 100).toFixed(1)}`} unit="%" />
          <MetricCell label="Fator de dose real" value={`${(metrics.realDoseFactor * 100).toFixed(0)}`} unit="%" />
        </div>

        <div className="flex items-start gap-2 px-4 py-3 text-xs leading-relaxed text-slate-400">
          <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
          <p>
            <span className="font-medium text-slate-200">Fenômeno dominante:</span>{" "}
            {metrics.dominantPhenomenon}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  if (variant === "full") {
    return (
      <div className="flex w-full flex-col gap-4">
        {simulator}
        {metricsPanel}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {simulator}
      {metricsPanel}
    </div>
  );
}

function StatusBadge({
  label,
  tone,
  icon,
}: {
  label: string;
  tone: "success" | "danger" | "neutral";
  icon?: ReactNode;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-slate-700 text-[10px] font-medium text-slate-300",
        tone === "success" && "border-emerald-500/40 text-emerald-300",
        tone === "danger" && "border-red-500/40 text-red-300",
      )}
    >
      {icon}
      {label}
    </Badge>
  );
}

function MetricCell({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("font-mono text-lg font-semibold tabular-nums leading-none", accent ?? "text-slate-100")}>
        {value}
        <span className="ml-1 text-xs font-normal text-slate-500">{unit}</span>
      </p>
    </div>
  );
}
