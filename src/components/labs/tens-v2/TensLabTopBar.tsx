/**
 * TopBar - Barra superior minimalista
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useTensLabStore } from "@/stores/tensLabStore";
import { useNavigate } from "react-router-dom";

interface TopBarProps {
  labName?: string;
  showBackButton?: boolean;
}

export function TensLabTopBar({ labName = "Laboratório TENS", showBackButton = true }: TopBarProps) {
  const navigate = useNavigate();
  const {
    frequency,
    pulseWidth,
    intensity,
    mode,
    electrodes,
    simulationResult,
    resetToDefaults,
  } = useTensLabStore();

  const riskLevel = simulationResult?.riskLevel || "baixo";

  return (
    <header className="bg-card/95 border-b border-border backdrop-blur sticky top-0 z-50 px-4 py-2 shrink-0">
      <div className="flex items-center justify-between gap-4">
        {/* Left */}
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <h1 className="font-medium text-sm text-foreground">{labName}</h1>
        </div>

        {/* Center - Resumo compacto */}
        <div className="hidden md:flex items-center gap-3 text-xs">
          <div className="flex items-center gap-4 bg-muted/50 rounded-full px-4 py-1.5">
            <span className="text-muted-foreground">
              <span className="text-cyan-400 font-mono font-medium">{frequency}</span> Hz
            </span>
            <span className="text-border">|</span>
            <span className="text-muted-foreground">
              <span className="text-cyan-400 font-mono font-medium">{pulseWidth}</span> µs
            </span>
            <span className="text-border">|</span>
            <span className="text-muted-foreground">
              <span className="text-cyan-400 font-mono font-medium">{intensity}</span> mA
            </span>
            <span className="text-border">|</span>
            <span className="text-muted-foreground">
              <span className="text-amber-400 font-mono font-medium">{electrodes.distanceCm}</span> cm
            </span>
            <span className="text-border">|</span>
            <Badge variant="outline" className="text-[10px] capitalize border-border text-foreground">
              {mode}
            </Badge>
          </div>

          <Badge 
            className={`text-[10px] ${
              riskLevel === "baixo" 
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                : riskLevel === "moderado" 
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  : "bg-red-500/20 text-red-400 border-red-500/30"
            }`}
          >
            {riskLevel.toUpperCase()}
          </Badge>
        </div>

        {/* Right */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={resetToDefaults}
          className="text-muted-foreground hover:text-foreground gap-1.5 text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>
    </header>
  );
}
