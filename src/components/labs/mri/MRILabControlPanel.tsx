/**
 * MRI Lab Control Panel
 */

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
import { MRIPreset, MRIViewerType, MRIPhantomType } from "@/types/mriLabConfig";
import { Magnet, Radio, Settings } from "lucide-react";

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

export function MRILabControlPanel() {
  const { config, updateConfig, simulationResult } = useMRILabStore();
  
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
        {/* Presets */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Presets</Label>
          <Select
            value={config.preset}
            onValueChange={(v) => updateConfig({ preset: v as MRIPreset })}
            disabled={!config.enabledControls.preset}
          >
            <SelectTrigger className="bg-muted border-border text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="t1_weighted">T1-weighted</SelectItem>
              <SelectItem value="t2_weighted">T2-weighted</SelectItem>
              <SelectItem value="proton_density">Proton Density</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="h-px bg-border" />

        {/* Phantom Type */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Phantom</Label>
          <Select
            value={config.phantomType || "brain"}
            onValueChange={(v) => updateConfig({ phantomType: v as MRIPhantomType })}
          >
            <SelectTrigger className="bg-muted border-border text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="brain">Cérebro</SelectItem>
              <SelectItem value="knee">Joelho</SelectItem>
              <SelectItem value="abdomen">Abdômen</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="h-px bg-border" />

        {/* Acquisition Parameters */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-cyan-500" />
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Parâmetros de Aquisição
            </Label>
          </div>

          {config.enabledControls.tr && (
            <SliderControl
              label="TR (Repetition Time)"
              value={config.tr}
              onChange={(v) => updateConfig({ tr: v })}
              min={config.ranges.tr.min}
              max={config.ranges.tr.max}
              step={10}
              unit="ms"
            />
          )}

          {config.enabledControls.te && (
            <SliderControl
              label="TE (Echo Time)"
              value={config.te}
              onChange={(v) => updateConfig({ te: v })}
              min={config.ranges.te.min}
              max={config.ranges.te.max}
              step={1}
              unit="ms"
            />
          )}

          {config.enabledControls.flipAngle && (
            <SliderControl
              label="Flip Angle"
              value={config.flipAngle}
              onChange={(v) => updateConfig({ flipAngle: v })}
              min={config.ranges.flipAngle.min}
              max={config.ranges.flipAngle.max}
              step={5}
              unit="°"
            />
          )}

          {config.enabledControls.sequenceType && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Tipo de Sequência</Label>
              <Select
                value={config.sequenceType}
                onValueChange={(v) =>
                  updateConfig({ sequenceType: v as any })
                }
              >
                <SelectTrigger className="bg-muted border-border text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spin_echo">Spin Echo</SelectItem>
                  <SelectItem value="gradient_echo">Gradient Echo</SelectItem>
                  <SelectItem value="inversion_recovery">Inversion Recovery</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Viewer Selection */}
        {config.enabledControls.viewer && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Settings className="h-3.5 w-3.5 text-purple-500" />
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Visualização
              </Label>
            </div>
            <Select
              value={config.activeViewer}
              onValueChange={(v) => updateConfig({ activeViewer: v as MRIViewerType })}
            >
              <SelectTrigger className="bg-muted border-border text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="magnetization">Magnetização 3D</SelectItem>
                <SelectItem value="slice_2d">Fatia 2D</SelectItem>
                <SelectItem value="volume_3d">Volume 3D</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Slice Index (for 2D and 3D viewers) */}
        {(config.activeViewer === "slice_2d" || config.activeViewer === "volume_3d") && (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Índice da Fatia</Label>
              <SliderControl
                label="Fatia Z"
                value={config.sliceIndex || 0}
                onChange={(v) => {
                  const clamped = Math.max(0, Math.min(maxSlice, v));
                  updateConfig({ sliceIndex: clamped });
                }}
                min={0}
                max={maxSlice}
                step={1}
                unit=""
              />
            </div>
            
            <div className="h-px bg-border" />
            
            {/* Window/Level Controls */}
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
                onChange={(v) => updateConfig({ window: v })}
                min={100}
                max={5000}
                step={100}
                unit=""
              />
              <SliderControl
                label="Level"
                value={config.level || 1000}
                onChange={(v) => updateConfig({ level: v })}
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
