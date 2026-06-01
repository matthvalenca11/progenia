/**
 * InsightsPanel - Painel de métricas para Ultrassom Terapêutico
 */

import { Badge } from "@/components/ui/badge";
import { Thermometer, AlertTriangle, Zap, Target, Droplets, ChevronDown } from "lucide-react";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { DominantEffect } from "./DominantEffect";
import { ThermalTimeline } from "./ThermalTimeline";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface InsightsPanelProps {
  onClose?: () => void;
}

function MetricCell({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "red" | "orange" | "amber" | "emerald" | "blue" | "purple";
}) {
  const toneClass =
    tone === "red"
      ? "text-red-500"
      : tone === "orange"
        ? "text-orange-500"
        : tone === "amber"
          ? "text-amber-500"
          : tone === "emerald"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "blue"
              ? "text-blue-500"
              : tone === "purple"
                ? "text-purple-500"
                : "text-foreground";

  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-border/60 bg-muted/30 px-1 py-1.5 text-center">
      <p className="truncate text-[8px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 truncate text-xs font-bold leading-none ${toneClass}`}>{value}</p>
    </div>
  );
}

function CompactMetricsPanel() {
  const { simulationResult, config } = useUltrasoundTherapyStore();

  if (!simulationResult) {
    return (
      <div className="flex items-center justify-center p-6">
        <p className="text-xs text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const riskLabel =
    simulationResult.risk === "low" ? "BAIXO" :
    simulationResult.risk === "medium" ? "MÉD." : "ALTO";

  const riskTone =
    simulationResult.risk === "low" ? "emerald" :
    simulationResult.risk === "medium" ? "amber" : "red";

  const hasAlerts =
    simulationResult.risk !== "low" ||
    simulationResult.periostealRisk > 0.3 ||
    simulationResult.cumulativeDose > 60;

  return (
    <div className="w-full min-w-0 max-w-full space-y-2 p-1.5 pb-4 sm:p-2">
      <div
        className="grid grid-cols-2 gap-1.5"
        style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
      >
        <MetricCell label="Risco" value={riskLabel} tone={riskTone as "emerald" | "amber" | "red"} />
        <MetricCell label="Sup." value={`${simulationResult.surfaceTemp.toFixed(1)}°`} tone="red" />
        <MetricCell label="Alvo" value={`${simulationResult.targetTemp.toFixed(1)}°`} tone="orange" />
        <MetricCell label="Máx." value={`${simulationResult.maxTemp.toFixed(1)}°`} tone="amber" />
      </div>

      <DominantEffect compact />

      <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-2 py-2 text-[10px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Dose</span>
          <span className="font-semibold">{simulationResult.doseJcm2.toFixed(1)} J/cm²</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Área</span>
          <span className="font-semibold">{simulationResult.treatedArea.toFixed(1)} cm²</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Profundidade</span>
          <span className="font-semibold">{simulationResult.effectiveDepth.toFixed(1)} cm</span>
        </div>
      </div>

      {hasAlerts && (
        <Collapsible defaultOpen={simulationResult.risk !== "low"}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-left">
            <span className="text-[11px] font-medium text-foreground">Alertas e recomendações</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-1.5">
            {simulationResult.riskFactors.map((factor, i) => (
              <p key={i} className="text-[10px] text-muted-foreground">• {factor}</p>
            ))}
            {simulationResult.maxTemp > 42 && (
              <p className="text-[10px] text-muted-foreground">• Reduza intensidade ou duração</p>
            )}
            {config.movement === "stationary" && (
              <p className="text-[10px] text-muted-foreground">• Mova o transdutor para distribuir energia</p>
            )}
            {simulationResult.periostealRisk > 0.3 && (
              <p className="text-[10px] text-red-500">• Risco periosteal {(simulationResult.periostealRisk * 100).toFixed(0)}%</p>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border/60 px-2.5 py-2 text-left">
          <span className="text-[11px] font-medium text-muted-foreground">Detalhes técnicos</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2">
          <div className="grid min-w-0 grid-cols-2 gap-1 text-[10px]">
            <div className="min-w-0 overflow-hidden rounded-md bg-muted/30 px-1.5 py-1.5">
              <span className="text-muted-foreground">Pot. </span>
              <span className="font-semibold">{simulationResult.powerW.toFixed(2)} W</span>
            </div>
            <div className="min-w-0 overflow-hidden rounded-md bg-muted/30 px-1.5 py-1.5">
              <span className="text-muted-foreground">Energ. </span>
              <span className="font-semibold">{simulationResult.energyJ.toFixed(0)} J</span>
            </div>
            <div className="min-w-0 overflow-hidden rounded-md bg-muted/30 px-1.5 py-1.5">
              <span className="text-muted-foreground">Penet. </span>
              <span className="font-semibold">{simulationResult.penetrationDepth.toFixed(1)} cm</span>
            </div>
            <div className="min-w-0 overflow-hidden rounded-md bg-muted/30 px-1.5 py-1.5">
              <span className="text-muted-foreground">CEM43 </span>
              <span className="font-semibold">{simulationResult.cumulativeDose.toFixed(1)} min</span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function UltrasoundTherapyInsightsPanel({
  onClose,
  hideHeader = false,
  compact = false,
}: InsightsPanelProps & { hideHeader?: boolean; compact?: boolean }) {
  const { simulationResult, config } = useUltrasoundTherapyStore();

  if (compact) {
    return (
      <div className="w-full min-w-0 max-w-full bg-card">
        <CompactMetricsPanel />
      </div>
    );
  }

  if (!simulationResult) {
    return (
      <div className="flex h-full items-center justify-center bg-card">
        <p className="text-xs text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const riskColorClass = 
    simulationResult.risk === "low" ? "emerald" :
    simulationResult.risk === "medium" ? "amber" : "red";

  const riskLabel =
    simulationResult.risk === "low" ? "BAIXO" :
    simulationResult.risk === "medium" ? "MODERADO" : "ALTO";

  return (
    <div className="flex h-full flex-col bg-card">
      {!hideHeader && (
        <div className="border-b border-border p-3">
          <h2 className="text-sm font-medium text-foreground">Métricas</h2>
        </div>
      )}

      <div className={`flex-1 space-y-3 overflow-y-auto p-3 ${hideHeader ? "pb-6" : ""}`}>
        <DominantEffect />

        <div className={`rounded-lg p-3 ${
          riskColorClass === "emerald" ? "bg-emerald-500/10 border-emerald-500/20" :
          riskColorClass === "amber" ? "bg-amber-500/10 border-amber-500/20" :
          "bg-red-500/10 border-red-500/20"
        }`}>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className={`h-3.5 w-3.5 ${
                riskColorClass === "emerald" ? "text-emerald-400" :
                riskColorClass === "amber" ? "text-amber-400" :
                "text-red-400"
              }`} />
              <span className="text-xs text-muted-foreground">Risco</span>
            </div>
            <Badge className={`text-[10px] ${
              riskColorClass === "emerald" ? "bg-emerald-500/20 text-emerald-400" :
              riskColorClass === "amber" ? "bg-amber-500/20 text-amber-400" :
              "bg-red-500/20 text-red-400"
            }`}>
              {riskLabel}
            </Badge>
          </div>
          {simulationResult.riskFactors.length > 0 && (
            <div className="mt-2 space-y-1">
              {simulationResult.riskFactors.map((factor, i) => (
                <p key={i} className="text-[10px] text-muted-foreground">• {factor}</p>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-red-500/10 p-2.5">
            <div className="mb-1 flex items-center gap-1">
              <Thermometer className="h-3 w-3 text-red-400" />
              <div className="text-[10px] text-muted-foreground">Superfície</div>
            </div>
            <div className="text-lg font-bold text-red-400">
              {simulationResult.surfaceTemp.toFixed(1)}°C
            </div>
          </div>
          <div className="rounded-lg bg-orange-500/10 p-2.5">
            <div className="mb-1 flex items-center gap-1">
              <Target className="h-3 w-3 text-orange-400" />
              <div className="text-[10px] text-muted-foreground">Alvo</div>
            </div>
            <div className="text-lg font-bold text-orange-400">
              {simulationResult.targetTemp.toFixed(1)}°C
            </div>
          </div>
        </div>

        <div className="space-y-1 rounded-lg bg-amber-500/10 p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-amber-400" />
              <span className="text-[11px] text-muted-foreground">Temp. Máxima</span>
            </div>
            <span className="text-sm font-medium text-amber-400">
              {simulationResult.maxTemp.toFixed(1)}°C
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Profundidade: {simulationResult.maxTempDepth.toFixed(1)} cm
          </div>
        </div>

        <div className="space-y-1.5 rounded-lg bg-muted/50 p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-cyan-400" />
              <span className="text-[11px] text-muted-foreground">Potência</span>
            </div>
            <span className="text-sm font-medium text-foreground">{simulationResult.powerW.toFixed(2)} W</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Energia Total</span>
            <span className="text-sm font-medium text-foreground">{simulationResult.energyJ.toFixed(0)} J</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Dose</span>
            <span className="text-sm font-medium text-foreground">{simulationResult.doseJcm2.toFixed(1)} J/cm²</span>
          </div>
        </div>

        {simulationResult.cumulativeDose > 0 && (
          <div className={`space-y-1 rounded-lg p-2.5 ${
            simulationResult.cumulativeDose > 120 
              ? "border border-red-500/20 bg-red-500/10"
              : simulationResult.cumulativeDose > 60
                ? "border border-orange-500/20 bg-orange-500/10"
                : "bg-orange-500/10"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Thermometer className="h-3 w-3 text-orange-400" />
                <span className="text-[11px] text-muted-foreground">Dose Térmica (CEM43)</span>
              </div>
              <span className={`text-sm font-medium ${
                simulationResult.cumulativeDose > 120 
                  ? "text-red-400"
                  : simulationResult.cumulativeDose > 60
                    ? "text-orange-400"
                    : "text-orange-300"
              }`}>
                {simulationResult.cumulativeDose.toFixed(1)} min
              </span>
            </div>
          </div>
        )}

        {simulationResult.periostealRisk > 0.3 && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-red-400" />
                <span className="text-[11px] text-muted-foreground">Risco Periosteal</span>
              </div>
              <span className="text-sm font-medium text-red-400">
                {(simulationResult.periostealRisk * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        )}

        <div className="space-y-1.5 rounded-lg bg-blue-500/10 p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Target className="h-3 w-3 text-blue-400" />
              <span className="text-[11px] text-muted-foreground">Profundidade Efetiva</span>
            </div>
            <span className="text-sm font-medium text-blue-400">
              {simulationResult.effectiveDepth.toFixed(1)} cm
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Penetração Máxima</span>
            <span className="text-sm font-medium text-blue-400">
              {simulationResult.penetrationDepth.toFixed(1)} cm
            </span>
          </div>
        </div>

        <div className="rounded-lg bg-purple-500/10 p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Droplets className="h-3 w-3 text-purple-400" />
              <span className="text-[11px] text-muted-foreground">Área Tratada</span>
            </div>
            <span className="text-sm font-medium text-purple-400">
              {simulationResult.treatedArea.toFixed(1)} cm²
            </span>
          </div>
        </div>

        {simulationResult.risk !== "low" && (
          <div className="rounded-lg border border-border bg-muted/50 p-2.5">
            <div className="mb-1.5 text-[11px] font-medium text-foreground">Recomendações</div>
            <div className="space-y-1">
              {simulationResult.maxTemp > 42 && (
                <p className="text-[10px] text-muted-foreground">• Reduza a intensidade ou duração</p>
              )}
              {config.mode === "continuous" && simulationResult.doseJcm2 > 15 && (
                <p className="text-[10px] text-muted-foreground">• Considere usar modo pulsado</p>
              )}
              {config.movement === "stationary" && (
                <p className="text-[10px] text-muted-foreground">• Mova o transdutor para distribuir energia</p>
              )}
            </div>
          </div>
        )}

        <ThermalTimeline />
      </div>
    </div>
  );
}
