/**
 * ControlPanel - Painel de controle para Ultrassom Terapêutico
 */

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Waves, Zap, Settings, ChevronDown, BookOpen } from "lucide-react";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { TransducerMap2D } from "./TransducerMap2D";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { clinicalPresets, applyPreset } from "@/config/ultrasoundTherapyPresets";
import { AnatomicalScenario } from "@/types/ultrasoundTherapyConfig";

interface SliderControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit: string;
  disabled?: boolean;
  highlight?: boolean;
}

function SliderControl({ 
  label, 
  value, 
  onChange, 
  min, 
  max, 
  step = 0.1, 
  unit,
  disabled = false,
  highlight = false,
  compact = false,
}: SliderControlProps & { compact?: boolean }) {
  return (
    <div className={`space-y-2 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className={`px-2 py-0.5 rounded text-xs font-mono border ${
          highlight 
            ? 'bg-amber-500/20 dark:bg-amber-500/30 text-amber-600 dark:text-amber-400 border-amber-500/30 dark:border-amber-500/50' 
            : 'bg-muted text-foreground border-border'
        }`}>
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
        size={compact ? "lg" : "default"}
        className={compact ? "py-3" : "py-1"}
      />
    </div>
  );
}

export function UltrasoundTherapyControlPanel({
  hideHeader = false,
  compact = false,
}: {
  hideHeader?: boolean;
  compact?: boolean;
}) {
  const {
    config,
    updateConfig,
  } = useUltrasoundTherapyStore();

  const toggleButtonClass = (active: boolean, variant: "default" | "good" | "poor" = "default") => {
    const height = compact ? "h-9" : "h-7";
    if (variant === "good" && active) {
      return `text-xs ${height} rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30`;
    }
    if (variant === "poor" && active) {
      return `text-xs ${height} rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30`;
    }
    if (active) {
      return `text-xs ${height} rounded-md bg-primary text-primary-foreground`;
    }
    return `text-xs ${height} rounded-md bg-muted border border-border text-foreground hover:bg-muted/80`;
  };

  const customThicknessSection = config.scenario === "custom" && config.enabledControls.customThicknesses !== false && (
    <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-3">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Espessuras das Camadas</Label>
      <SliderControl
        label="Pele"
        value={config.customThicknesses?.skin || 0.2}
        onChange={(v) => updateConfig({ 
          customThicknesses: { 
            ...config.customThicknesses, 
            skin: v,
            fat: config.customThicknesses?.fat || 0.5,
            muscle: config.customThicknesses?.muscle || 2.0,
            boneDepth: config.customThicknesses?.boneDepth
          } 
        })}
        min={0.1}
        max={0.5}
        step={0.05}
        unit="cm"
        compact={compact}
      />
      <SliderControl
        label="Gordura"
        value={(config.customThicknesses && config.customThicknesses.fat) ? config.customThicknesses.fat : 0.5}
        onChange={(v) => updateConfig({ 
          customThicknesses: { 
            ...config.customThicknesses, 
            skin: config.customThicknesses?.skin || 0.2,
            fat: v,
            muscle: config.customThicknesses?.muscle || 2.0,
            boneDepth: config.customThicknesses?.boneDepth
          } 
        })}
        min={0.1}
        max={2.0}
        step={0.1}
        unit="cm"
        compact={compact}
      />
      <SliderControl
        label="Músculo"
        value={(config.customThicknesses && config.customThicknesses.muscle) ? config.customThicknesses.muscle : 2.0}
        onChange={(v) => updateConfig({ 
          customThicknesses: { 
            ...config.customThicknesses, 
            skin: config.customThicknesses?.skin || 0.2,
            fat: config.customThicknesses?.fat || 0.5,
            muscle: v,
            boneDepth: config.customThicknesses?.boneDepth
          } 
        })}
        min={0.5}
        max={5.0}
        step={0.1}
        unit="cm"
        compact={compact}
      />
      <SliderControl
        label="Profundidade do Osso"
        value={(config.customThicknesses && config.customThicknesses.boneDepth) ? config.customThicknesses.boneDepth : 3.0}
        onChange={(v) => updateConfig({ 
          customThicknesses: { 
            ...config.customThicknesses, 
            skin: config.customThicknesses?.skin || 0.2,
            fat: config.customThicknesses?.fat || 0.5,
            muscle: config.customThicknesses?.muscle || 2.0,
            boneDepth: v
          } 
        })}
        min={1.0}
        max={6.0}
        step={0.1}
        unit="cm"
        compact={compact}
      />
    </div>
  );

  const mixedLayerSection = config.scenario === "custom" && (
    <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Camada Mista</Label>
        <input
          type="checkbox"
          checked={config.mixedLayer?.enabled || false}
          onChange={(e) => updateConfig({
            mixedLayer: {
              enabled: e.target.checked,
              depth: config.mixedLayer?.depth || 2.0,
              division: config.mixedLayer?.division || 50
            }
          })}
          className="h-5 w-5 rounded border-border bg-muted text-primary focus:ring-primary"
        />
      </div>
      {config.mixedLayer?.enabled && (
        <>
          <SliderControl
            label="Profundidade da Camada Mista"
            value={config.mixedLayer.depth}
            onChange={(v) => updateConfig({ 
              mixedLayer: { 
                ...config.mixedLayer!,
                depth: v
              } 
            })}
            min={0.5}
            max={5.0}
            step={0.1}
            unit="cm"
            compact={compact}
          />
          <SliderControl
            label="Divisão Osso/Músculo"
            value={config.mixedLayer.division}
            onChange={(v) => updateConfig({ 
              mixedLayer: { 
                ...config.mixedLayer!,
                division: v
              } 
            })}
            min={0}
            max={100}
            step={1}
            unit="%"
            compact={compact}
          />
          <div className="mt-2 text-[10px] text-muted-foreground">
            {config.mixedLayer.division < 50 
              ? `Mais músculo (${100 - config.mixedLayer.division}%)` 
              : `Mais osso (${config.mixedLayer.division}%)`}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className={compact ? "w-full min-w-0 max-w-full bg-card" : "flex h-full flex-col bg-card"}>
      {!hideHeader && (
        <div className="border-b border-border p-3">
          <h2 className="text-sm font-medium text-foreground">Controles</h2>
        </div>
      )}
      
      <div className={`${compact ? "w-full min-w-0 max-w-full space-y-4 pb-8 pt-1" : "flex-1 space-y-5 overflow-y-auto p-3"} ${hideHeader && !compact ? "pb-6" : ""}`}>
        {compact && (
          <div className="grid grid-cols-2 gap-2">
            <Select
              value=""
              onValueChange={(presetId) => {
                const preset = clinicalPresets.find((p) => p.id === presetId);
                if (preset) updateConfig(applyPreset(preset, config));
              }}
            >
              <SelectTrigger className="h-9 w-full border-border bg-muted text-xs">
                <BookOpen className="mr-1 h-3 w-3 shrink-0 text-amber-500" />
                <SelectValue placeholder="Presets" />
              </SelectTrigger>
              <SelectContent>
                {clinicalPresets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={config.scenario}
              onValueChange={(v) => {
                const newScenario = v as AnatomicalScenario;
                if (newScenario === "custom" && !config.customThicknesses) {
                  updateConfig({
                    scenario: newScenario,
                    customThicknesses: { skin: 0.2, fat: 0.5, muscle: 2.0 },
                  });
                } else {
                  updateConfig({ scenario: newScenario });
                }
              }}
              disabled={!config.enabledControls.scenario}
            >
              <SelectTrigger className="h-9 w-full border-border bg-muted text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shoulder">Ombro</SelectItem>
                <SelectItem value="knee">Joelho</SelectItem>
                <SelectItem value="lumbar">Lombar</SelectItem>
                <SelectItem value="forearm">Antebraço</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {compact && config.scenario === "custom" && (customThicknessSection || mixedLayerSection) && (
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-left">
              <span className="text-xs font-medium text-foreground">Anatomia avançada</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3">
              {customThicknessSection}
              {mixedLayerSection}
            </CollapsibleContent>
          </Collapsible>
        )}

        {!compact && customThicknessSection}
        {!compact && mixedLayerSection}

        {!compact && (customThicknessSection || mixedLayerSection) && <div className="h-px bg-border" />}

        <div className="rounded-lg border border-border bg-muted/50 p-3">
          <TransducerMap2D compact={compact} />
        </div>

        <div className="h-px bg-border" />

        {/* Transdutor */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Waves className="h-3.5 w-3.5 text-cyan-500" />
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Transdutor</Label>
          </div>

          {config.enabledControls.frequency && (
            <SliderControl
              label="Frequência"
              value={config.frequency}
              onChange={(v) => updateConfig({ frequency: v })}
              min={config.ranges.frequency.min}
              max={config.ranges.frequency.max}
              step={0.1}
              unit="MHz"
              highlight={true}
              compact={compact}
            />
          )}

          {config.enabledControls.era && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">ERA (Área Efetiva)</Label>
                <div className="rounded border border-border bg-muted/50 px-2 py-0.5 text-xs font-mono">
                  <Input
                    type="number"
                    value={config.era}
                    onChange={(e) => updateConfig({ era: Number(e.target.value) || 0 })}
                    min={config.ranges.era.min}
                    max={config.ranges.era.max}
                    step={0.5}
                    className={`${compact ? "h-8 w-20" : "h-6 w-16"} border-border bg-background text-xs text-foreground`}
                  />
                  <span className="ml-1 text-muted-foreground">cm²</span>
                </div>
              </div>
            </div>
          )}

          {config.enabledControls.mode && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Modo</Label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => updateConfig({ mode: "continuous" })}
                  className={toggleButtonClass(config.mode === "continuous")}
                >
                  Contínuo
                </button>
                <button
                  onClick={() => updateConfig({ mode: "pulsed" })}
                  className={toggleButtonClass(config.mode === "pulsed")}
                >
                  Pulsado
                </button>
              </div>
            </div>
          )}

          {config.enabledControls.dutyCycle && config.mode === "pulsed" && (
            <SliderControl
              label="Duty Cycle"
              value={config.dutyCycle}
              onChange={(v) => updateConfig({ dutyCycle: v })}
              min={config.ranges.dutyCycle.min}
              max={config.ranges.dutyCycle.max}
              step={5}
              unit="%"
              compact={compact}
            />
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Energia */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Energia</Label>
          </div>

          {config.enabledControls.intensity && (
            <SliderControl
              label="Intensidade"
              value={config.intensity}
              onChange={(v) => updateConfig({ intensity: v })}
              min={config.ranges.intensity.min}
              max={config.ranges.intensity.max}
              step={0.1}
              unit="W/cm²"
              highlight={true}
              compact={compact}
            />
          )}

          {config.enabledControls.duration && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Duração</Label>
                <div className="rounded border border-border bg-muted/50 px-2 py-0.5 text-xs font-mono">
                  <Input
                    type="number"
                    value={config.duration}
                    onChange={(e) => updateConfig({ duration: Number(e.target.value) || 0 })}
                    min={config.ranges.duration.min}
                    max={config.ranges.duration.max}
                    step={1}
                    className={`${compact ? "h-8 w-20" : "h-6 w-16"} border-border bg-background text-xs text-foreground`}
                  />
                  <span className="ml-1 text-muted-foreground">min</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Técnica */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-3.5 w-3.5 text-purple-500" />
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Técnica</Label>
          </div>

          {config.enabledControls.coupling && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Acoplamento</Label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => updateConfig({ coupling: "good" })}
                  className={toggleButtonClass(config.coupling === "good", "good")}
                >
                  Bom
                </button>
                <button
                  onClick={() => updateConfig({ coupling: "poor" })}
                  className={toggleButtonClass(config.coupling === "poor", "poor")}
                >
                  Ruim
                </button>
              </div>
            </div>
          )}

          {config.enabledControls.movement && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Movimento</Label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => updateConfig({ movement: "stationary" })}
                  className={toggleButtonClass(config.movement === "stationary")}
                >
                  Parado
                </button>
                <button
                  onClick={() => updateConfig({ movement: "scanning" })}
                  className={toggleButtonClass(config.movement === "scanning")}
                >
                  Varredura
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-muted/50 p-2.5">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {config.frequency <= 1.5 
              ? "Frequência baixa: penetração profunda, ideal para estruturas profundas"
              : "Frequência alta: penetração superficial, ideal para tendões e ligamentos"
            }
          </p>
        </div>
      </div>
    </div>
  );
}
