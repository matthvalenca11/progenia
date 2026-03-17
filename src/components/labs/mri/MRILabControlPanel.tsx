/**
 * MRI Lab Control Panel
 */

import React, { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMRILabStore } from "@/stores/mriLabStore";
import { MRILabConfig } from "@/types/mriLabConfig";
import { Magnet, Settings, Loader2 } from "lucide-react";

interface SliderControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit: string;
  disabled?: boolean;
}

function SliderControl({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  disabled = false,
}: SliderControlProps) {
  return (
    <div className={`space-y-2 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className="px-2 py-0.5 rounded text-xs font-mono bg-muted text-foreground border border-border">
          {value.toFixed(step < 1 ? 1 : 0)} <span className="text-muted-foreground">{unit}</span>
        </div>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="py-1"
      />
    </div>
  );
}

interface MRILabControlPanelProps {
  isAdmin?: boolean;
  onConfigChange?: (nextConfig: MRILabConfig) => void;
}

export function MRILabControlPanel({ isAdmin = false, onConfigChange }: MRILabControlPanelProps) {
  const {
    config,
    updateConfig,
    simulationResult,
    dicomSeries,
    realVolumeTR,
    realVolumeTE,
    currentCaseId,
    loadingCase,
    caseError,
    loadClinicalCase,
  } = useMRILabStore();

  const [displayTrSidebar, setDisplayTrSidebar] = useState<number | null>(null);
  const [displayTeSidebar, setDisplayTeSidebar] = useState<number | null>(null);

  // Transição suave TR/TE na sidebar
  useEffect(() => {
    const targetTr = realVolumeTR ?? config.tr;
    const targetTe = realVolumeTE ?? config.te;

    let frameId: number | null = null;
    const duration = 300;
    const start = performance.now();
    const startTr = displayTrSidebar ?? targetTr;
    const startTe = displayTeSidebar ?? targetTe;

    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
      setDisplayTrSidebar(lerp(startTr, targetTr, t));
      setDisplayTeSidebar(lerp(startTe, targetTe, t));
      if (t < 1) frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => {
      if (frameId != null) cancelAnimationFrame(frameId);
    };
  }, [realVolumeTR, realVolumeTE, config.tr, config.te]);
  
  const applyConfigUpdate = (updates: Partial<MRILabConfig>) => {
    updateConfig(updates);
    if (!isAdmin || !onConfigChange) return;

    // Só sincronizar mudanças relevantes de configuração (evitar poluir com estado de navegação do preview)
    const shouldSync =
      "tr" in updates || "te" in updates || "flipAngle" in updates || "sequenceType" in updates;
    if (!shouldSync) return;

    // Pegar o config real pós-update (inclui regras internas da store, se houver)
    const nextConfig = useMRILabStore.getState().config;
    onConfigChange(nextConfig);
  };
  
  if (!config) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground text-xs">Carregando controles...</p>
      </div>
    );
  }
  
  // Get max slice from simulation result
  const maxSlice = simulationResult?.volume?.depth 
    ? Math.max(0, simulationResult.volume.depth - 1)
    : 31;

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-medium text-foreground">Controles</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {/* Caso Clínico */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Caso Clínico
          </Label>
          <Select
            value={currentCaseId ?? "case01_brain_normal"}
            onValueChange={(v) => {
              void loadClinicalCase(v);
            }}
          >
            <SelectTrigger className="bg-muted border-border text-sm">
              <SelectValue placeholder="Selecione um caso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="case01_brain_normal">
                Caso 01: Encéfalo (Normal)
              </SelectItem>
            </SelectContent>
          </Select>
          {loadingCase && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Carregando caso clínico (T1/T2)...</span>
            </div>
          )}
          {caseError && !loadingCase && (
            <p className="text-xs text-red-500">{caseError}</p>
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Parâmetros de Aquisição (Simulação) */}
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Parâmetros de Aquisição (Simulação)
            </Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              TR e TE controlam o blend entre T1 e T2 na Fatia 2D (valores mais altos → mais ponderação T2).
              Em sequências de inversão (ex.: FLAIR), o TI controla o “nulled” do LCR.
            </p>
          </div>
          <SliderControl
            label="TR (Repetition Time)"
            value={config.tr}
            onChange={(v) => applyConfigUpdate({ tr: v })}
            min={config.ranges.tr.min}
            max={config.ranges.tr.max}
            step={10}
            unit="ms"
          />
          <SliderControl
            label="TE (Echo Time)"
            value={config.te}
            onChange={(v) => applyConfigUpdate({ te: v })}
            min={config.ranges.te.min}
            max={config.ranges.te.max}
            step={1}
            unit="ms"
          />
          {config.ranges.ti && (
            <SliderControl
              label="TI (Inversion Time)"
              value={config.ti ?? config.ranges.ti.min}
              onChange={(v) => applyConfigUpdate({ ti: v })}
              min={config.ranges.ti.min}
              max={config.ranges.ti.max}
              step={10}
              unit="ms"
            />
          )}
          <SliderControl
            label="Flip Angle"
            value={config.flipAngle}
            onChange={(v) => applyConfigUpdate({ flipAngle: v })}
            min={config.ranges.flipAngle.min}
            max={config.ranges.flipAngle.max}
            step={5}
            unit="°"
          />
        </div>

        <div className="h-px bg-border" />

        {/* Metadados da Imagem (somente leitura, extraídos do volume/caso) */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Metadados da Imagem
          </Label>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex flex-col">
              <span className="text-muted-foreground">TR</span>
              <span className="font-mono">
                {(displayTrSidebar ?? realVolumeTR ?? config.tr).toFixed(0)} ms
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">TE</span>
              <span className="font-mono">
                {(displayTeSidebar ?? realVolumeTE ?? config.te).toFixed(0)} ms
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">Flip Angle</span>
              <span className="font-mono">{config.flipAngle.toFixed(0)}°</span>
            </div>
            {dicomSeries?.sliceThickness != null && (
              <div className="flex flex-col">
                <span className="text-muted-foreground">Espessura de Corte</span>
                <span className="font-mono">{dicomSeries.sliceThickness} mm</span>
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Visualização: apenas pelas Tabs do topo */}

        {/* Navegação de Fatias - aplica para Fatia 2D e Planos 2D (MPR) */}
        {(config.activeViewer === "slice_2d" || config.activeViewer === "mpr_2d") && (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Índice da Fatia</Label>
              <SliderControl
                label="Fatia Z"
                value={config.sliceIndex || 0}
                onChange={(v) => {
                  const clamped = Math.max(0, Math.min(maxSlice, v));
                  applyConfigUpdate({ sliceIndex: clamped });
                }}
                min={0}
                max={maxSlice}
                step={1}
                unit=""
              />
            </div>
            
            <div className="h-px bg-border" />
            
            {/* Controles de Visualização (Window/Level) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Settings className="h-3.5 w-3.5 text-cyan-500" />
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Window/Level
                </Label>
              </div>
              <SliderControl
                label="Window"
                value={config.window || 2000}
                onChange={(v) => applyConfigUpdate({ window: v })}
                min={100}
                max={5000}
                step={100}
                unit=""
              />
              <SliderControl
                label="Level"
                value={config.level || 1000}
                onChange={(v) => applyConfigUpdate({ level: v })}
                min={0}
                max={3000}
                step={50}
                unit=""
              />
            </div>
          </>
        )}

        {/* Safety Warning */}
        <div className="p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <div className="flex items-start gap-2">
            <Magnet className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-400 mb-1">Aviso de Segurança</p>
              <p className="text-[10px] text-muted-foreground">
                Pacientes com implantes metálicos não devem ser submetidos a ressonância magnética.
                Verifique contraindicações antes do exame.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
