/**
 * InsightsPanel - Painel de métricas compacto
 */

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X, Heart, AlertTriangle, Zap, ArrowDown, Target } from "lucide-react";
import { useTensLabStore } from "@/stores/tensLabStore";

interface InsightsPanelProps {
  onClose?: () => void;
}

export function TensLabInsightsPanel({ onClose }: InsightsPanelProps) {
  const { simulationResult, electrodes } = useTensLabStore();

  if (!simulationResult) {
    return (
      <div className="h-full bg-slate-900 flex items-center justify-center">
        <p className="text-slate-500 text-xs">Carregando...</p>
      </div>
    );
  }

  const {
    comfortScore,
    riskScore,
    riskLevel,
    sensoryActivation,
    motorActivation,
    activationDepthMm,
    activatedAreaCm2,
    distanceExplanation,
  } = simulationResult;

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
        {/* Risco - destaque */}
        <div className={`p-3 rounded-lg ${
          riskLevel === "baixo" ? "bg-emerald-500/10 border border-emerald-500/20" :
          riskLevel === "moderado" ? "bg-amber-500/10 border border-amber-500/20" : 
          "bg-red-500/10 border border-red-500/20"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className={`h-3.5 w-3.5 ${
                riskLevel === "baixo" ? "text-emerald-400" :
                riskLevel === "moderado" ? "text-amber-400" : "text-red-400"
              }`} />
              <span className="text-xs text-slate-400">Risco</span>
            </div>
            <Badge className={`text-[10px] ${
              riskLevel === "baixo" ? "bg-emerald-500/20 text-emerald-400" :
              riskLevel === "moderado" ? "bg-amber-500/20 text-amber-400" : 
              "bg-red-500/20 text-red-400"
            }`}>
              {riskLevel.toUpperCase()}
            </Badge>
          </div>
          <div className="text-2xl font-bold text-white">{riskScore}<span className="text-sm text-slate-500">/100</span></div>
        </div>

        {/* Conforto */}
        <div className="p-2.5 bg-slate-800/50 rounded-lg space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Heart className="h-3 w-3 text-rose-400" />
              <span className="text-[11px] text-slate-400">Conforto</span>
            </div>
            <span className="text-sm font-medium text-white">{comfortScore}</span>
          </div>
          <Progress value={comfortScore} className="h-1" />
        </div>

        {/* Ativação */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 bg-blue-500/10 rounded-lg">
            <div className="text-[10px] text-slate-400 mb-1">Sensorial</div>
            <div className="text-lg font-bold text-blue-400">{sensoryActivation}%</div>
            <Progress value={sensoryActivation} className="h-0.5 mt-1 [&>div]:bg-blue-500" />
          </div>
          <div className="p-2.5 bg-purple-500/10 rounded-lg">
            <div className="text-[10px] text-slate-400 mb-1">Motora</div>
            <div className="text-lg font-bold text-purple-400">{motorActivation}%</div>
            <Progress value={motorActivation} className="h-0.5 mt-1 [&>div]:bg-purple-500" />
          </div>
        </div>

        {/* Profundidade e Área */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-1 mb-1">
              <ArrowDown className="h-3 w-3 text-cyan-400" />
              <span className="text-[10px] text-slate-400">Profundidade</span>
            </div>
            <div className="text-lg font-bold text-white">{activationDepthMm.toFixed(0)}<span className="text-xs text-slate-500"> mm</span></div>
          </div>
          <div className="p-2.5 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-1 mb-1">
              <Target className="h-3 w-3 text-cyan-400" />
              <span className="text-[10px] text-slate-400">Área</span>
            </div>
            <div className="text-lg font-bold text-white">{activatedAreaCm2.toFixed(1)}<span className="text-xs text-slate-500"> cm²</span></div>
          </div>
        </div>

        {/* Explicação da distância */}
        <div className="p-2.5 bg-amber-500/5 rounded-lg border border-amber-500/10">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Zap className="h-3 w-3 text-amber-400" />
            <span className="text-[10px] text-amber-400 font-medium">Distância: {electrodes.distanceCm} cm</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            {distanceExplanation}
          </p>
        </div>
      </div>
    </div>
  );
}
