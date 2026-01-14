/**
 * InsightsPanel - Painel de métricas para Ultrassom Terapêutico
 */

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X, Thermometer, AlertTriangle, Zap, Target, Droplets } from "lucide-react";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { DominantEffect } from "./DominantEffect";
import { ThermalTimeline } from "./ThermalTimeline";

interface InsightsPanelProps {
  onClose?: () => void;
}

export function UltrasoundTherapyInsightsPanel({ onClose }: InsightsPanelProps) {
  const { simulationResult, config } = useUltrasoundTherapyStore();

  if (!simulationResult) {
    return (
      <div className="h-full bg-slate-900 flex items-center justify-center">
        <p className="text-slate-500 text-xs">Carregando...</p>
      </div>
    );
  }

  const riskColorClass = 
    simulationResult.risk === "low" ? "emerald" :
    simulationResult.risk === "medium" ? "amber" : "red";

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <h2 className="text-sm font-medium text-white">Métricas</h2>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Efeito Dominante */}
        <DominantEffect />

        {/* Risco - destaque */}
        <div className={`p-3 rounded-lg ${
          riskColorClass === "emerald" ? "bg-emerald-500/10 border-emerald-500/20" :
          riskColorClass === "amber" ? "bg-amber-500/10 border-amber-500/20" :
          "bg-red-500/10 border-red-500/20"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className={`h-3.5 w-3.5 ${
                riskColorClass === "emerald" ? "text-emerald-400" :
                riskColorClass === "amber" ? "text-amber-400" :
                "text-red-400"
              }`} />
              <span className="text-xs text-slate-400">Risco</span>
            </div>
            <Badge className={`text-[10px] ${
              riskColorClass === "emerald" ? "bg-emerald-500/20 text-emerald-400" :
              riskColorClass === "amber" ? "bg-amber-500/20 text-amber-400" :
              "bg-red-500/20 text-red-400"
            }`}>
              {simulationResult.risk.toUpperCase()}
            </Badge>
          </div>
          {simulationResult.riskFactors.length > 0 && (
            <div className="mt-2 space-y-1">
              {simulationResult.riskFactors.map((factor, i) => (
                <p key={i} className="text-[10px] text-slate-400">• {factor}</p>
              ))}
            </div>
          )}
        </div>

        {/* Temperatura */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 bg-red-500/10 rounded-lg">
            <div className="flex items-center gap-1 mb-1">
              <Thermometer className="h-3 w-3 text-red-400" />
              <div className="text-[10px] text-slate-400">Superfície</div>
            </div>
            <div className="text-lg font-bold text-red-400">
              {simulationResult.surfaceTemp.toFixed(1)}°C
            </div>
          </div>
          <div className="p-2.5 bg-orange-500/10 rounded-lg">
            <div className="flex items-center gap-1 mb-1">
              <Target className="h-3 w-3 text-orange-400" />
              <div className="text-[10px] text-slate-400">Alvo</div>
            </div>
            <div className="text-lg font-bold text-orange-400">
              {simulationResult.targetTemp.toFixed(1)}°C
            </div>
          </div>
        </div>

        {/* Temperatura Máxima */}
        <div className="p-2.5 bg-amber-500/10 rounded-lg space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-amber-400" />
              <span className="text-[11px] text-slate-400">Temp. Máxima</span>
            </div>
            <span className="text-sm font-medium text-amber-400">
              {simulationResult.maxTemp.toFixed(1)}°C
            </span>
          </div>
          <div className="text-[10px] text-slate-500">
            Profundidade: {simulationResult.maxTempDepth.toFixed(1)} cm
          </div>
        </div>

        {/* Energia */}
        <div className="p-2.5 bg-slate-800/50 rounded-lg space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-cyan-400" />
              <span className="text-[11px] text-slate-400">Potência</span>
            </div>
            <span className="text-sm font-medium text-white">{simulationResult.powerW.toFixed(2)} W</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Energia Total</span>
            <span className="text-sm font-medium text-white">{simulationResult.energyJ.toFixed(0)} J</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Dose</span>
            <span className="text-sm font-medium text-white">{simulationResult.doseJcm2.toFixed(1)} J/cm²</span>
          </div>
        </div>

        {/* Dose Térmica Acumulada */}
        {simulationResult.cumulativeDose > 0 && (
          <div className={`p-2.5 rounded-lg space-y-1 ${
            simulationResult.cumulativeDose > 120 
              ? "bg-red-500/10 border border-red-500/20"
              : simulationResult.cumulativeDose > 60
                ? "bg-orange-500/10 border border-orange-500/20"
                : "bg-orange-500/10"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Thermometer className="h-3 w-3 text-orange-400" />
                <span className="text-[11px] text-slate-400">Dose Térmica (CEM43)</span>
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
            <div className={`text-[10px] ${
              simulationResult.cumulativeDose > 120 
                ? "text-red-400"
                : simulationResult.cumulativeDose > 60
                  ? "text-orange-400"
                  : "text-slate-500"
            }`}>
              {simulationResult.cumulativeDose > 120 
                ? "⚠️ Risco de dano térmico (>120 min eq. 43°C)"
                : simulationResult.cumulativeDose > 60
                  ? "⚠️ Dose moderada (60-120 min eq. 43°C)"
                  : "✓ Dose segura (<60 min eq. 43°C)"}
            </div>
          </div>
        )}

        {/* Risco Periosteal */}
        {simulationResult.periostealRisk > 0.3 && (
          <div className="p-2.5 bg-red-500/10 rounded-lg border border-red-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-red-400" />
                <span className="text-[11px] text-slate-400">Risco Periosteal</span>
              </div>
              <span className="text-sm font-medium text-red-400">
                {(simulationResult.periostealRisk * 100).toFixed(0)}%
              </span>
            </div>
            <div className="text-[10px] text-red-400 mt-1">
              Hotspot próximo ao osso - risco de dano periosteal
            </div>
          </div>
        )}

        {/* Penetração */}
        <div className="p-2.5 bg-blue-500/10 rounded-lg space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Target className="h-3 w-3 text-blue-400" />
              <span className="text-[11px] text-slate-400">Profundidade Efetiva</span>
            </div>
            <span className="text-sm font-medium text-blue-400">
              {simulationResult.effectiveDepth.toFixed(1)} cm
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Penetração Máxima</span>
            <span className="text-sm font-medium text-blue-400">
              {simulationResult.penetrationDepth.toFixed(1)} cm
            </span>
          </div>
        </div>

        {/* Área Tratada - V3: Shows scanning effect */}
        <div className="p-2.5 bg-purple-500/10 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Droplets className="h-3 w-3 text-purple-400" />
              <span className="text-[11px] text-slate-400">Área Tratada</span>
            </div>
            <span className="text-sm font-medium text-purple-400">
              {simulationResult.treatedArea.toFixed(1)} cm²
            </span>
          </div>
          {config.movement === "scanning" && (
            <div className="text-[10px] text-slate-500 mt-1">
              Varredura: área distribuída
            </div>
          )}
        </div>

        {/* Recomendações */}
        {simulationResult.risk !== "low" && (
          <div className="p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="text-[11px] font-medium text-slate-300 mb-1.5">Recomendações</div>
            <div className="space-y-1">
              {simulationResult.maxTemp > 42 && (
                <p className="text-[10px] text-slate-400">• Reduza a intensidade ou duração</p>
              )}
              {config.mode === "continuous" && simulationResult.doseJcm2 > 15 && (
                <p className="text-[10px] text-slate-400">• Considere usar modo pulsado</p>
              )}
              {config.movement === "stationary" && (
                <p className="text-[10px] text-slate-400">• Mova o transdutor para distribuir energia</p>
              )}
              {config.coupling === "poor" && (
                <p className="text-[10px] text-slate-400">• Melhore o acoplamento para reduzir risco superficial</p>
              )}
              {simulationResult.cumulativeDose > 120 && (
                <p className="text-[10px] text-slate-400">• Dose térmica acumulada muito alta - interrompa o tratamento</p>
              )}
              {simulationResult.periostealRisk > 0.5 && (
                <p className="text-[10px] text-slate-400">• Reduza intensidade ou mude posição - risco periosteal elevado</p>
              )}
            </div>
          </div>
        )}

        {/* Timeline Térmico */}
        <ThermalTimeline />
      </div>
    </div>
  );
}
