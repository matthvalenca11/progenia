/**
 * MRI Lab Insights Panel
 */

import { Badge } from "@/components/ui/badge";
import { useMRILabStore } from "@/stores/mriLabStore";
import { TISSUE_PROPERTIES } from "@/types/mriLabConfig";
import { Signal, TrendingUp, AlertTriangle, Info } from "lucide-react";

export function MRILabInsightsPanel() {
  const { simulationResult, config } = useMRILabStore();

  if (!simulationResult) {
    return (
      <div className="h-full bg-card flex items-center justify-center">
        <p className="text-muted-foreground text-xs">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-medium text-foreground">Métricas</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Signal Intensity */}
        <div className="p-2.5 bg-cyan-500/10 rounded-lg space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Signal className="h-3 w-3 text-cyan-400" />
              <span className="text-[11px] text-muted-foreground">Sinal Médio</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {simulationResult.averageSignal.toFixed(3)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Min: {simulationResult.minSignal.toFixed(3)}</span>
            <span>Max: {simulationResult.maxSignal.toFixed(3)}</span>
          </div>
        </div>

        {/* Tissue Signals */}
        <div className="p-2.5 bg-muted/50 rounded-lg space-y-2">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-purple-400" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Sinal por Tecido
            </span>
          </div>
          <div className="space-y-1.5">
            {Object.entries(simulationResult.tissueSignals).map(([tissue, signal]) => {
              const tissueProps = TISSUE_PROPERTIES[tissue];
              return (
                <div key={tissue} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: tissueProps?.color || "#ffffff" }}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {tissueProps?.name || tissue}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-foreground">{signal.toFixed(3)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Acquisition Info */}
        <div className="p-2.5 bg-muted/50 rounded-lg space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Info className="h-3 w-3 text-blue-400" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Parâmetros Ativos
            </span>
          </div>
          <div className="space-y-1 text-[10px] text-muted-foreground">
            <div>TR: {config.tr} ms</div>
            <div>TE: {config.te} ms</div>
            <div>Flip Angle: {config.flipAngle}°</div>
            <div>Sequência: {config.sequenceType.replace("_", " ")}</div>
          </div>
        </div>

        {/* Recommendations */}
        {simulationResult.recommendations.length > 0 && (
          <div className="p-2.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Info className="h-3 w-3 text-blue-400" />
              <span className="text-[11px] font-medium text-blue-400">Recomendações</span>
            </div>
            <div className="space-y-1">
              {simulationResult.recommendations.map((rec, i) => (
                <p key={i} className="text-[10px] text-muted-foreground">
                  • {rec}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Risk Factors */}
        {simulationResult.riskFactors.length > 0 && (
          <div className="p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              <span className="text-[11px] font-medium text-amber-400">Atenção</span>
            </div>
            <div className="space-y-1">
              {simulationResult.riskFactors.map((factor, i) => (
                <p key={i} className="text-[10px] text-muted-foreground">
                  • {factor}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
