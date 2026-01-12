/**
 * InsightsPanel - Painel lateral direito com métricas e feedback
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Heart, 
  Zap, 
  Activity, 
  AlertTriangle, 
  Layers,
  ArrowDown,
  Target,
  Info
} from "lucide-react";
import { useTensLabStore } from "@/stores/tensLabStore";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color?: "default" | "success" | "warning" | "danger" | "info";
  tooltip?: string;
  progress?: number;
}

function MetricCard({ 
  title, 
  value, 
  unit, 
  icon, 
  color = "default",
  tooltip,
  progress
}: MetricCardProps) {
  const colorClasses = {
    default: "text-foreground",
    success: "text-green-600 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
    info: "text-blue-600 dark:text-blue-400",
  };

  const bgClasses = {
    default: "bg-muted/50",
    success: "bg-green-500/10",
    warning: "bg-amber-500/10",
    danger: "bg-red-500/10",
    info: "bg-blue-500/10",
  };

  return (
    <div className={`p-3 rounded-lg ${bgClasses[color]} space-y-2`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={colorClasses[color]}>{icon}</span>
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <p className="text-xs">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-bold ${colorClasses[color]}`}>{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {progress !== undefined && (
        <Progress value={progress} className="h-1.5" />
      )}
    </div>
  );
}

export function TensLabInsightsPanel() {
  const { simulationResult, electrodes } = useTensLabStore();

  if (!simulationResult) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-muted-foreground text-sm">Carregando simulação...</p>
        </CardContent>
      </Card>
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
    riskMessages,
    comfortMessage,
  } = simulationResult;

  const getComfortColor = (score: number) => {
    if (score >= 70) return "success";
    if (score >= 40) return "warning";
    return "danger";
  };

  const getRiskColor = (level: string) => {
    if (level === "baixo") return "success";
    if (level === "moderado") return "warning";
    return "danger";
  };

  return (
    <Card className="h-full overflow-hidden flex flex-col">
      <CardHeader className="py-3 px-4 border-b shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Análise em Tempo Real
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Conforto */}
        <MetricCard
          title="Conforto"
          value={comfortScore}
          unit="/ 100"
          icon={<Heart className="h-4 w-4" />}
          color={getComfortColor(comfortScore)}
          progress={comfortScore}
          tooltip="Estimativa de conforto do paciente baseada nos parâmetros atuais"
        />

        {/* Risco */}
        <div className={`p-3 rounded-lg space-y-2 ${
          riskLevel === "baixo" ? "bg-green-500/10" :
          riskLevel === "moderado" ? "bg-amber-500/10" : "bg-red-500/10"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${
                riskLevel === "baixo" ? "text-green-600" :
                riskLevel === "moderado" ? "text-amber-600" : "text-red-600"
              }`} />
              <span className="text-xs font-medium text-muted-foreground">Risco</span>
            </div>
            <Badge 
              variant="outline" 
              className={`text-xs uppercase ${
                riskLevel === "baixo" 
                  ? "bg-green-500/20 text-green-600 border-green-500/30" 
                  : riskLevel === "moderado" 
                    ? "bg-amber-500/20 text-amber-600 border-amber-500/30"
                    : "bg-red-500/20 text-red-600 border-red-500/30"
              }`}
            >
              {riskLevel}
            </Badge>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-xl font-bold ${
              riskLevel === "baixo" ? "text-green-600" :
              riskLevel === "moderado" ? "text-amber-600" : "text-red-600"
            }`}>{riskScore}</span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
          <Progress 
            value={riskScore} 
            className={`h-1.5 ${
              riskLevel === "alto" ? "[&>div]:bg-red-500" :
              riskLevel === "moderado" ? "[&>div]:bg-amber-500" : ""
            }`} 
          />
        </div>

        <div className="border-t my-3" />

        {/* Ativação */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Zap className="h-3.5 w-3.5" />
            <span>Ativação Neural</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Sensorial</div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-blue-600">{sensoryActivation}</span>
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <Progress value={sensoryActivation} className="h-1 mt-1 [&>div]:bg-blue-500" />
            </div>
            
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Motora</div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-purple-600">{motorActivation}</span>
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <Progress value={motorActivation} className="h-1 mt-1 [&>div]:bg-purple-500" />
            </div>
          </div>
        </div>

        <div className="border-t my-3" />

        {/* Profundidade e Área */}
        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            title="Profundidade"
            value={activationDepthMm.toFixed(0)}
            unit="mm"
            icon={<ArrowDown className="h-4 w-4" />}
            color="info"
            tooltip="Profundidade estimada de penetração do campo elétrico"
          />
          
          <MetricCard
            title="Área ativada"
            value={activatedAreaCm2.toFixed(1)}
            unit="cm²"
            icon={<Target className="h-4 w-4" />}
            color="info"
            tooltip="Área estimada de tecido com ativação neural"
          />
        </div>

        <div className="border-t my-3" />

        {/* Explicação da distância */}
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium">Distância: {electrodes.distanceCm} cm</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {distanceExplanation}
          </p>
        </div>

        {/* Alertas */}
        {riskMessages.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Alertas</div>
            {riskMessages.map((msg, idx) => (
              <div 
                key={idx}
                className={`p-2 rounded text-xs leading-relaxed ${
                  msg.startsWith("✅") 
                    ? "bg-green-500/10 text-green-700 dark:text-green-400" 
                    : msg.startsWith("⚠️") || msg.startsWith("⚡")
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "bg-muted/50 text-muted-foreground"
                }`}
              >
                {msg}
              </div>
            ))}
          </div>
        )}

        {/* Mensagem de conforto */}
        <div className={`p-3 rounded-lg text-xs ${
          comfortScore >= 70 
            ? "bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400" 
            : comfortScore >= 40
              ? "bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400"
              : "bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400"
        }`}>
          {comfortMessage}
        </div>
      </CardContent>
    </Card>
  );
}
