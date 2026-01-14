/**
 * TopBar - Barra superior minimalista para Ultrassom Terapêutico
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { useNavigate } from "react-router-dom";

interface TopBarProps {
  labName?: string;
  showBackButton?: boolean;
}

export function UltrasoundTherapyTopBar({ labName = "Ultrassom Terapêutico", showBackButton = true }: TopBarProps) {
  const navigate = useNavigate();
  const {
    config,
    simulationResult,
    updateConfig,
  } = useUltrasoundTherapyStore();

  const riskLevel = simulationResult?.risk || "low";

  const resetToDefaults = () => {
    updateConfig({
      frequency: 1.0,
      intensity: 1.0,
      era: 5.0,
      mode: "continuous",
      dutyCycle: 50,
      duration: 8,
      coupling: "good",
      movement: "scanning",
    });
  };

  return (
    <header className="bg-slate-900/95 border-b border-slate-800 px-4 py-2 shrink-0">
      <div className="flex items-center justify-between gap-4">
        {/* Left */}
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="h-8 w-8 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <h1 className="font-medium text-sm text-white">{labName}</h1>
        </div>

        {/* Center - Resumo compacto */}
        <div className="hidden md:flex items-center gap-3 text-xs">
          <div className="flex items-center gap-4 bg-slate-800/50 rounded-full px-4 py-1.5">
            <span className="text-slate-400">
              <span className="text-cyan-400 font-mono font-medium">{config.frequency}</span> MHz
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              <span className="text-cyan-400 font-mono font-medium">{config.intensity.toFixed(1)}</span> W/cm²
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              <span className="text-amber-400 font-mono font-medium">{config.duration}</span> min
            </span>
            <span className="text-slate-600">|</span>
            <Badge variant="outline" className="text-[10px] capitalize border-slate-600 text-slate-300">
              {config.mode === "continuous" ? "Contínuo" : "Pulsado"}
            </Badge>
          </div>

          <Badge 
            className={`text-[10px] ${
              riskLevel === "low" 
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                : riskLevel === "medium" 
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
          className="text-slate-400 hover:text-white gap-1.5 text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>
    </header>
  );
}
