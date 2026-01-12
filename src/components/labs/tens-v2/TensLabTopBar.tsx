/**
 * TopBar - Barra superior do laboratório TENS
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Activity, 
  RotateCcw, 
  Save, 
  Zap,
  Ruler,
  ArrowLeft
} from "lucide-react";
import { useTensLabStore, ExperienceLevel } from "@/stores/tensLabStore";
import { tissuePresets } from "@/types/tissueConfig";
import { useNavigate } from "react-router-dom";

interface TopBarProps {
  labName?: string;
  showBackButton?: boolean;
}

export function TensLabTopBar({ labName = "Laboratório TENS", showBackButton = true }: TopBarProps) {
  const navigate = useNavigate();
  const {
    presetId,
    frequency,
    pulseWidth,
    intensity,
    mode,
    electrodes,
    experienceLevel,
    simulationResult,
    setExperienceLevel,
    resetToDefaults,
    saveConfiguration,
  } = useTensLabStore();

  const preset = tissuePresets.find(p => p.id === presetId);
  const riskLevel = simulationResult?.riskLevel || "baixo";

  return (
    <header className="bg-card/95 backdrop-blur-sm border-b sticky top-0 z-50 px-4 py-2">
      <div className="flex items-center justify-between gap-4">
        {/* Left section - Navigation and title */}
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h1 className="font-semibold text-base md:text-lg">{labName}</h1>
          </div>
          <Badge variant="secondary" className="hidden md:flex text-xs">
            {preset?.label || "Personalizado"}
          </Badge>
        </div>

        {/* Center section - Quick summary */}
        <div className="hidden lg:flex items-center gap-4 bg-muted/50 rounded-lg px-4 py-1.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-sm">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  <span className="font-mono font-medium">{frequency}</span>
                  <span className="text-muted-foreground text-xs">Hz</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Frequência</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="w-px h-4 bg-border" />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="font-mono font-medium">{pulseWidth}</span>
                  <span className="text-muted-foreground text-xs">µs</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Largura de Pulso</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="w-px h-4 bg-border" />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="font-mono font-medium">{intensity}</span>
                  <span className="text-muted-foreground text-xs">mA</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Intensidade</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="w-px h-4 bg-border" />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-sm">
                  <Ruler className="h-3.5 w-3.5 text-blue-500" />
                  <span className="font-mono font-medium">{electrodes.distanceCm}</span>
                  <span className="text-muted-foreground text-xs">cm</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Distância entre eletrodos</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="w-px h-4 bg-border" />

          <Badge 
            variant="outline" 
            className="capitalize text-xs"
          >
            {mode}
          </Badge>

          <div className="w-px h-4 bg-border" />

          <Badge 
            variant="outline"
            className={`text-xs ${
              riskLevel === "baixo" 
                ? "bg-green-500/10 text-green-600 border-green-500/30" 
                : riskLevel === "moderado" 
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                  : "bg-red-500/10 text-red-600 border-red-500/30"
            }`}
          >
            Risco: {riskLevel.toUpperCase()}
          </Badge>
        </div>

        {/* Right section - Controls */}
        <div className="flex items-center gap-2">
          <Select 
            value={experienceLevel} 
            onValueChange={(v) => setExperienceLevel(v as ExperienceLevel)}
          >
            <SelectTrigger className="w-32 h-8 text-xs hidden md:flex">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Iniciante</SelectItem>
              <SelectItem value="intermediate">Intermediário</SelectItem>
              <SelectItem value="advanced">Avançado</SelectItem>
            </SelectContent>
          </Select>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={resetToDefaults}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Restaurar padrões</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={saveConfiguration}>
                  <Save className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Salvar configuração</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </header>
  );
}
