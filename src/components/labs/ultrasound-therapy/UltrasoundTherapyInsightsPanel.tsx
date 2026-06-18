/**
 * InsightsPanel — métricas essenciais visíveis; detalhes em seções recolhíveis.
 */

import { useState } from "react";
import {
  AlertTriangle,
  Thermometer,
  ChevronDown,
  Layers,
  Zap,
  Waves,
  Activity,
} from "lucide-react";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { useDominantEffectInfo } from "./DominantEffect";
import { ThermalTimeline } from "./ThermalTimeline";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { utCard, utLabel, utPanel, utHint } from "./ultrasoundTherapyUi";
import {
  TRANSDUCER_BEAM_PROFILE_LABELS,
  DOMINANT_PHENOMENON_LABELS,
  TISSUE_PERFUSION_PROFILE_LABELS,
  getPerfusionVisualProfile,
} from "@/types/ultrasoundTherapyConfig";
import { isFocusDepthApplicable } from "@/config/therapeuticTransducerDefinitions";
import {
  assessDoseAlert,
  assessPowerAlert,
  assessSurfaceTempAlert,
  assessTissueTempAlert,
  metricAlertClass,
} from "@/lib/therapyMetricSafety";
import { SimulationSnapshotButton } from "./SimulationSnapshotButton";
import { SessionTimeline } from "./SessionTimeline";
import { SimulationComparisonPanel } from "./SimulationComparisonPanel";
import type { UltrasoundTherapyResult } from "@/simulation/ultrasoundTherapyEngine";

interface InsightsPanelProps {
  onClose?: () => void;
  hideHeader?: boolean;
  compact?: boolean;
  /** Preview admin — oculta ferramentas de sessão e reduz ruído visual */
  embedded?: boolean;
}

const cardShell = utCard;

function tempValueTone(temp: number, kind: "surface" | "tissue" = "tissue"): string | undefined {
  const level = kind === "surface" ? assessSurfaceTempAlert(temp) : assessTissueTempAlert(temp);
  return metricAlertClass(level);
}

function riskTone(risk: "low" | "medium" | "high"): string {
  if (risk === "high") return "text-red-500";
  if (risk === "medium") return "text-amber-500";
  return "text-foreground";
}

function StatChip({
  label,
  value,
  unit,
  valueClassName,
}: {
  label: string;
  value: string;
  unit?: string;
  valueClassName?: string;
}) {
  const compactValue = value.length > 5;

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border/70 bg-background/50 px-2 py-2.5 text-center sm:px-3">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 min-w-0">
        <p
          className={cn(
            "truncate font-bold tabular-nums leading-tight",
            compactValue ? "text-sm" : "text-base sm:text-lg",
            valueClassName ?? "text-foreground",
          )}
        >
          {value}
        </p>
        {unit && (
          <p className="truncate text-[10px] font-semibold leading-tight text-muted-foreground">{unit}</p>
        )}
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-normal text-muted-foreground shadow-sm hover:bg-muted/80 hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0" />
            {title}
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function StatusOverview({ embedded = false }: { embedded?: boolean }) {
  const { simulationResult, config } = useUltrasoundTherapyStore();
  const dominant = useDominantEffectInfo();

  if (!simulationResult) return null;

  const riskLabel =
    simulationResult.risk === "low" ? "Baixo" : simulationResult.risk === "medium" ? "Moderado" : "Alto";

  const recommendations: string[] = [];
  if (simulationResult.maxTemp > 42 && config.intensity > 1.0) {
    recommendations.push("Reduza intensidade ou duração");
  }
  if (config.mode === "continuous" && simulationResult.doseJcm2 > 15) {
    recommendations.push("Considere modo pulsado");
  }
  if (config.movement === "stationary" && config.intensity > 1.2) {
    recommendations.push("Use varredura para distribuir energia");
  }
  if (simulationResult.periostealRisk > 0.22 && simulationResult.transducerOverBone !== false) {
    if (
      simulationResult.hotspotBoneDistanceCm != null &&
      simulationResult.hotspotBoneDistanceCm < 0.8
    ) {
      recommendations.push(
        `Hotspot a ${simulationResult.hotspotBoneDistanceCm.toFixed(1)} cm do osso — afaste ou use 1 MHz`,
      );
    } else {
      recommendations.push("Risco periosteal — reduza intensidade ou aumente distância do osso");
    }
  }
  if (simulationResult.transducerOverBone === false) {
    recommendations.push("Posição sobre músculo — risco periosteal reduzido nesta região");
  }

  return (
    <div className={cn(cardShell, embedded ? "p-4" : "p-5")}>
      <div className="flex items-start gap-3">
        <AlertTriangle
          className={cn("mt-0.5 h-5 w-5 shrink-0", riskTone(simulationResult.risk))}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className={utLabel}>Risco</span>
            <span className={cn("text-xl font-bold", riskTone(simulationResult.risk))}>{riskLabel}</span>
            {dominant && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-sm font-medium text-foreground">{dominant.name}</span>
              </>
            )}
          </div>
          {dominant && (
            <p className={cn("leading-relaxed", utHint)}>{dominant.description}</p>
          )}
          {!dominant && simulationResult.riskFactors[0] && (
            <p className={cn("leading-relaxed", utHint)}>{simulationResult.riskFactors[0]}</p>
          )}
        </div>
      </div>

      {recommendations.length > 0 && simulationResult.risk !== "low" && (
        <ul className="mt-3 space-y-1 border-t border-border pt-3">
          {recommendations.slice(0, embedded ? 2 : 3).map((rec) => (
            <li key={rec} className={cn("flex items-start gap-1.5", utHint)}>
              <Zap className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
              <span className={rec.includes("periosteal") ? "text-red-500" : undefined}>{rec}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KeyMetricsStrip({ embedded = false }: { embedded?: boolean }) {
  const { simulationResult, config } = useUltrasoundTherapyStore();
  if (!simulationResult) return null;

  const perfusionProfile = simulationResult.tissuePerfusionProfile ?? config.tissuePerfusionProfile ?? "normal";
  const perfusionVisual = getPerfusionVisualProfile(perfusionProfile);
  const doseAlert = assessDoseAlert(simulationResult.doseJcm2);
  const powerAlert = assessPowerAlert(simulationResult.powerW, config.era);

  return (
    <div className={cn(cardShell, embedded ? "p-3" : "p-4", "space-y-3")}>
      <div className="flex items-center gap-2">
        <Thermometer className="h-4 w-4 text-muted-foreground" />
        <span className={utLabel}>Indicadores principais</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 [&>*]:min-w-0">
        <StatChip
          label="Superfície"
          value={simulationResult.surfaceTemp.toFixed(1)}
          unit="°C"
          valueClassName={tempValueTone(simulationResult.surfaceTemp, "surface")}
        />
        <StatChip
          label="Alvo"
          value={simulationResult.targetTemp.toFixed(1)}
          unit="°C"
          valueClassName={tempValueTone(simulationResult.targetTemp, "tissue")}
        />
        <StatChip
          label="Máxima"
          value={simulationResult.maxTemp.toFixed(1)}
          unit="°C"
          valueClassName={tempValueTone(simulationResult.maxTemp, "tissue")}
        />
        <StatChip
          label="Potência"
          value={simulationResult.powerW.toFixed(2)}
          unit="W"
          valueClassName={metricAlertClass(powerAlert)}
        />
        <StatChip
          label="Dose"
          value={simulationResult.doseJcm2.toFixed(0)}
          unit="J/cm²"
          valueClassName={metricAlertClass(doseAlert)}
        />
        <StatChip
          label="Perfusão"
          value={TISSUE_PERFUSION_PROFILE_LABELS[perfusionProfile]}
          valueClassName={
            perfusionProfile === "baixa_circulacao" ? "text-orange-500 text-[11px]" : "text-[11px]"
          }
        />
      </div>
      <p className={cn("text-center", utHint)}>
        Pico a {simulationResult.maxTempDepth.toFixed(1)} cm ·{" "}
        {simulationResult.effectiveDepth.toFixed(1)} cm efetivos ·{" "}
        {perfusionVisual.dissipationLabel} (×{(simulationResult.perfusionDissipationFactor ?? perfusionVisual.multiplier).toFixed(2)})
      </p>
    </div>
  );
}

function physiologyStatusLine(result: UltrasoundTherapyResult): string {
  if (result.maxTemp >= 48) {
    return "Calor extremo no foco. Reduza intensidade, tempo ou use varredura.";
  }
  if (result.periostealRisk > 0.22 && result.transducerOverBone !== false) {
    return "Energia refletida perto do osso. Afaste o transdutor ou reduza a intensidade.";
  }
  if (result.surfaceTemp > 42 && result.boneReflection > 0.25) {
    return "Superfície quente com reflexão óssea elevada. Revise posição e parâmetros.";
  }
  if (result.maxTemp > 43) {
    return "Temperatura máxima acima da faixa confortável. Monitore tempo e intensidade.";
  }
  if (result.targetTemp > 40 && result.effectiveDepth >= 1.5) {
    return "Aquecimento muscular profundo dentro do esperado para ultrassom terapêutico.";
  }
  if (result.surfaceTemp > 39.5) {
    return "Aquecimento superficial leve. Efeito compatível com sessão terapêutica usual.";
  }
  return "Alterações térmicas discretas com os parâmetros atuais.";
}

function PhysiologyResponseSummary() {
  const { simulationResult } = useUltrasoundTherapyStore();
  if (!simulationResult) return null;

  const map = simulationResult.interactionMap?.summary;
  const cavitationPct = ((map?.maxCavitationIndex ?? simulationResult.physiologyResponse?.cavitationRiskIndex ?? 0) * 100).toFixed(0);
  const lesionPct = ((map?.maxLesionIndex ?? 0) * 100).toFixed(0);
  const reflectionPct = (simulationResult.boneReflection * 100).toFixed(0);
  const periostealPct = (simulationResult.periostealRisk * 100).toFixed(0);
  const doseAlert = assessDoseAlert(simulationResult.doseJcm2);

  const metrics: Array<{
    label: string;
    value: string;
    unit?: string;
    valueClassName?: string;
  }> = [
    {
      label: "Temp. superfície",
      value: simulationResult.surfaceTemp.toFixed(1),
      unit: "°C",
      valueClassName: tempValueTone(simulationResult.surfaceTemp, "surface"),
    },
    {
      label: "Temp. alvo",
      value: simulationResult.targetTemp.toFixed(1),
      unit: "°C",
      valueClassName: tempValueTone(simulationResult.targetTemp, "tissue"),
    },
    {
      label: "Temp. máxima",
      value: simulationResult.maxTemp.toFixed(1),
      unit: "°C",
      valueClassName: tempValueTone(simulationResult.maxTemp, "tissue"),
    },
    {
      label: "Profundidade pico",
      value: simulationResult.maxTempDepth.toFixed(1),
      unit: "cm",
    },
    {
      label: "Reflexão óssea",
      value: reflectionPct,
      unit: "%",
      valueClassName: simulationResult.boneReflection > 0.3 ? "text-orange-500" : undefined,
    },
    {
      label: "Risco periosteal",
      value: periostealPct,
      unit: "%",
      valueClassName: simulationResult.periostealRisk > 0.22 ? "text-orange-500" : undefined,
    },
    {
      label: "Cavitação",
      value: cavitationPct,
      unit: "%",
      valueClassName: Number(cavitationPct) > 45 ? "text-orange-500" : undefined,
    },
    {
      label: "Dano térmico",
      value: lesionPct,
      unit: "%",
      valueClassName: Number(lesionPct) > 35 ? "text-orange-500" : undefined,
    },
    {
      label: "Dose acústica",
      value: simulationResult.doseJcm2.toFixed(0),
      unit: "J/cm²",
      valueClassName: metricAlertClass(doseAlert),
    },
    {
      label: "Penetração",
      value: simulationResult.penetrationDepth.toFixed(1),
      unit: "cm",
    },
  ];

  return (
    <CollapsibleSection title="Efeitos no tecido" icon={Activity}>
      <div className={cn(cardShell, "space-y-3 p-4")}>
        <p className={cn("text-sm leading-relaxed", utHint)}>{physiologyStatusLine(simulationResult)}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 [&>*]:min-w-0">
          {metrics.map(({ label, value, unit, valueClassName }) => (
            <StatChip
              key={label}
              label={label}
              value={value}
              unit={unit}
              valueClassName={valueClassName}
            />
          ))}
        </div>
      </div>
    </CollapsibleSection>
  );
}

function TissueInteractionSummary() {
  const { simulationResult } = useUltrasoundTherapyStore();
  const map = simulationResult?.interactionMap;
  if (!map) return null;

  const { summary } = map;
  const phenomenonLabel =
    DOMINANT_PHENOMENON_LABELS[summary.dominantPhenomenon] ?? summary.dominantPhenomenon;

  const metrics: Array<{ label: string; display: string; alert?: boolean }> = [
    { label: "Cavitação", display: `${(summary.maxCavitationIndex * 100).toFixed(0)}%`, alert: summary.maxCavitationIndex > 0.45 },
    { label: "Reflexão", display: `${(summary.maxReflectionIndex * 100).toFixed(0)}%`, alert: summary.maxReflectionIndex > 0.4 },
    { label: "Dano térmico", display: `${(summary.maxLesionIndex * 100).toFixed(0)}%`, alert: summary.maxLesionIndex > 0.35 },
    { label: "Intensidade", display: `${(summary.maxIntensity * 100).toFixed(0)}%` },
    { label: "Pico térmico", display: `${summary.maxTemp.toFixed(1)} °C`, alert: summary.maxTemp > 43 },
  ];

  return (
    <CollapsibleSection title="Interação nos tecidos" icon={Waves}>
      <div className={cn(cardShell, "space-y-3 p-4")}>
        <p className="text-sm font-semibold text-foreground">{phenomenonLabel}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 [&>*]:min-w-0">
          {metrics.map(({ label, display, alert }) => (
            <div
              key={label}
              className="rounded-lg border border-border/70 bg-background/50 px-3 py-2"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className={cn("mt-0.5 font-mono text-sm font-semibold tabular-nums", alert ? "text-orange-500" : "text-foreground")}>
                {display}
              </p>
            </div>
          ))}
        </div>
      </div>
    </CollapsibleSection>
  );
}

function PhysicalDetails() {
  const { simulationResult, config } = useUltrasoundTherapyStore();
  if (!simulationResult) return null;

  const profile = simulationResult.acousticProfile;
  const beamProfileLabel =
    TRANSDUCER_BEAM_PROFILE_LABELS[
      (profile?.beamProfile ?? config.beamProfile) as keyof typeof TRANSDUCER_BEAM_PROFILE_LABELS
    ] ?? config.beamProfile;
  const showFocusDepth = isFocusDepthApplicable(config.transducerType, config.beamProfile);

  return (
    <CollapsibleSection title="Detalhes físicos" icon={Layers}>
      <div className={cn(cardShell, "space-y-3 p-4")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 [&>*]:min-w-0">
          {profile && (
            <>
              <StatChip label="λ" value={profile.wavelengthCm.toFixed(3)} unit="cm" />
              <StatChip label="Campo próximo" value={profile.nearFieldCm.toFixed(2)} unit="cm" />
              {showFocusDepth && (
                <StatChip label="Foco" value={profile.focusDepthCm.toFixed(1)} unit="cm" />
              )}
            </>
          )}
          <StatChip label="Área tratada" value={simulationResult.treatedArea.toFixed(1)} unit="cm²" />
          <StatChip
            label="Reflexão óssea"
            value={`${(simulationResult.boneReflection * 100).toFixed(0)}`}
            unit="%"
            valueClassName={simulationResult.boneReflection > 0.3 ? "text-orange-500" : undefined}
          />
          <StatChip label="Dose acústica" value={simulationResult.doseJcm2.toFixed(1)} unit="J/cm²" />
          <StatChip label="Penetração" value={simulationResult.penetrationDepth.toFixed(1)} unit="cm" />
          <StatChip label="Perfil" value={beamProfileLabel} />
        </div>
        <ThermalTimeline />
      </div>
    </CollapsibleSection>
  );
}

function EducationFooter() {
  return (
    <p className={cn("px-1 text-center", utHint)}>
      Modelo educacional heurístico — não substitui predição clínica real.
    </p>
  );
}

function InsightsBody({ embedded = false, compact = false }: { embedded?: boolean; compact?: boolean }) {
  const { simulationResult } = useUltrasoundTherapyStore();

  if (!simulationResult) {
    return (
      <div className="flex items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", compact ? "p-4 pb-8" : embedded ? "p-4 pb-6" : "p-6 pb-8")}>
      <StatusOverview embedded={embedded || compact} />
      <KeyMetricsStrip embedded={embedded || compact} />
      <PhysiologyResponseSummary />
      <TissueInteractionSummary />
      <PhysicalDetails />

      {!embedded && (
        <>
          <SessionTimeline compact={compact} />
          <SimulationComparisonPanel compact={compact} />
        </>
      )}

      <EducationFooter />
    </div>
  );
}

export function UltrasoundTherapyInsightsPanel({
  hideHeader = false,
  compact = false,
  embedded = false,
}: InsightsPanelProps) {
  if (compact) {
    return (
      <div className={cn("w-full min-w-0 max-w-full", embedded ? "bg-transparent" : utPanel)}>
        <InsightsBody compact embedded={embedded} />
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col", embedded ? "bg-transparent" : utPanel)}>
      {!hideHeader && (
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className={utLabel}>Análise</h2>
            {!embedded && <SimulationSnapshotButton />}
          </div>
        </div>
      )}

      <div className={cn("flex-1 overflow-y-auto", hideHeader && !embedded && "pt-2")}>
        <InsightsBody embedded={embedded} />
      </div>
    </div>
  );
}
