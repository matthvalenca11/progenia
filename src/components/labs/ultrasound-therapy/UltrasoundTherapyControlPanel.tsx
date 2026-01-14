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
import { Waves, Zap, Settings, BookOpen } from "lucide-react";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { AnatomicalScenario } from "@/types/ultrasoundTherapyConfig";
import { clinicalPresets, applyPreset } from "@/config/ultrasoundTherapyPresets";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TransducerMap2D } from "./TransducerMap2D";

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
  highlight = false
}: SliderControlProps) {
  return (
    <div className={`space-y-2 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-slate-400">{label}</Label>
        <div className={`px-2 py-0.5 rounded text-xs font-mono ${
          highlight ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-300'
        }`}>
          {value.toFixed(step < 1 ? 1 : 0)} <span className="text-slate-500">{unit}</span>
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

export function UltrasoundTherapyControlPanel() {
  const {
    config,
    updateConfig,
  } = useUltrasoundTherapyStore();

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="p-3 border-b border-slate-800">
        <h2 className="text-sm font-medium text-white">Controles</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {/* Presets Clínicos */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-amber-500" />
            <Label className="text-xs text-slate-500 uppercase tracking-wide">Presets Clínicos</Label>
          </div>
          <Select 
            value="" 
            onValueChange={(presetId) => {
              const preset = clinicalPresets.find(p => p.id === presetId);
              if (preset) {
                const newConfig = applyPreset(preset, config);
                updateConfig(newConfig);
              }
            }}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-sm">
              <SelectValue placeholder="Selecione um preset clínico..." />
            </SelectTrigger>
            <SelectContent>
              {clinicalPresets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Show explanation when a preset is applied (heuristic: check if config matches a preset) */}
          {(() => {
            const matchingPreset = clinicalPresets.find(p => {
              const presetConfig = p.config;
              return (
                presetConfig.scenario === config.scenario &&
                presetConfig.frequency === config.frequency &&
                presetConfig.era === config.era &&
                presetConfig.mode === config.mode &&
                presetConfig.intensity === config.intensity &&
                presetConfig.movement === config.movement
              );
            });
            return matchingPreset ? (
              <Alert className="bg-amber-500/10 border-amber-500/20">
                <AlertDescription className="text-xs text-slate-300">
                  <div className="font-medium text-amber-400 mb-1">{matchingPreset.description}</div>
                  <div className="text-slate-400">{matchingPreset.explanation}</div>
                </AlertDescription>
              </Alert>
            ) : null;
          })()}
        </div>

        {/* Cenário Anatômico */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-500 uppercase tracking-wide">Cenário</Label>
          <Select 
            value={config.scenario} 
            onValueChange={(v) => {
              const newScenario = v as AnatomicalScenario;
              // Initialize customThicknesses when switching to custom
              if (newScenario === "custom" && !config.customThicknesses) {
                updateConfig({ 
                  scenario: newScenario,
                  customThicknesses: {
                    skin: 0.2,
                    fat: 0.5,
                    muscle: 2.0,
                    boneDepth: 3.0,
                  }
                });
              } else {
                updateConfig({ scenario: newScenario });
              }
            }}
            disabled={!config.enabledControls.scenario}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="shoulder">Ombro (tendão/bursa)</SelectItem>
              <SelectItem value="knee">Joelho (tendão/ligamento)</SelectItem>
              <SelectItem value="lumbar">Lombar (musculatura)</SelectItem>
              <SelectItem value="forearm">Antebraço (superficial)</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Custom Thickness Controls - V4: Didático */}
        {config.scenario === "custom" && config.enabledControls.customThicknesses !== false && (
          <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <Label className="text-xs text-slate-400 uppercase tracking-wide">Espessuras das Camadas</Label>
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
            />
          </div>
        )}

        {/* V5: Mixed Layer Control (for custom scenario) */}
        {config.scenario === "custom" && (
          <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-400 uppercase tracking-wide">Camada Mista</Label>
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
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
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
                />
                <div className="text-[10px] text-slate-500 mt-2">
                  {config.mixedLayer.division < 50 
                    ? `Mais músculo (${100 - config.mixedLayer.division}%)` 
                    : `Mais osso (${config.mixedLayer.division}%)`}
                </div>
              </>
            )}
          </div>
        )}

        <div className="h-px bg-slate-800" />

        {/* V6: Transducer Position Control (2D Map) */}
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <TransducerMap2D />
        </div>

        <div className="h-px bg-slate-800" />

        {/* Transdutor */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Waves className="h-3.5 w-3.5 text-cyan-500" />
            <Label className="text-xs text-slate-500 uppercase tracking-wide">Transdutor</Label>
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
            />
          )}

          {config.enabledControls.era && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-400">ERA (Área Efetiva)</Label>
                <div className="px-2 py-0.5 rounded text-xs font-mono bg-slate-800 text-slate-300">
                  <Input
                    type="number"
                    value={config.era}
                    onChange={(e) => updateConfig({ era: Number(e.target.value) || 0 })}
                    min={config.ranges.era.min}
                    max={config.ranges.era.max}
                    step={0.5}
                    className="w-16 h-6 text-xs bg-slate-700 border-slate-600 text-slate-200"
                  />
                  <span className="text-slate-500 ml-1">cm²</span>
                </div>
              </div>
            </div>
          )}

          {config.enabledControls.mode && (
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">Modo</Label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => updateConfig({ mode: "continuous" })}
                  className={`text-xs h-7 rounded-md transition-colors ${
                    config.mode === "continuous" 
                      ? 'bg-primary text-white' 
                      : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Contínuo
                </button>
                <button
                  onClick={() => updateConfig({ mode: "pulsed" })}
                  className={`text-xs h-7 rounded-md transition-colors ${
                    config.mode === "pulsed" 
                      ? 'bg-primary text-white' 
                      : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
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
            />
          )}
        </div>

        <div className="h-px bg-slate-800" />

        {/* Energia */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <Label className="text-xs text-slate-500 uppercase tracking-wide">Energia</Label>
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
            />
          )}

          {config.enabledControls.duration && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-400">Duração</Label>
                <div className="px-2 py-0.5 rounded text-xs font-mono bg-slate-800 text-slate-300">
                  <Input
                    type="number"
                    value={config.duration}
                    onChange={(e) => updateConfig({ duration: Number(e.target.value) || 0 })}
                    min={config.ranges.duration.min}
                    max={config.ranges.duration.max}
                    step={1}
                    className="w-16 h-6 text-xs bg-slate-700 border-slate-600 text-slate-200"
                  />
                  <span className="text-slate-500 ml-1">min</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-px bg-slate-800" />

        {/* Técnica */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-3.5 w-3.5 text-purple-500" />
            <Label className="text-xs text-slate-500 uppercase tracking-wide">Técnica</Label>
          </div>

          {config.enabledControls.coupling && (
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">Acoplamento</Label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => updateConfig({ coupling: "good" })}
                  className={`text-xs h-7 rounded-md transition-colors ${
                    config.coupling === "good" 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Bom
                </button>
                <button
                  onClick={() => updateConfig({ coupling: "poor" })}
                  className={`text-xs h-7 rounded-md transition-colors ${
                    config.coupling === "poor" 
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                      : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Ruim
                </button>
              </div>
            </div>
          )}

          {config.enabledControls.movement && (
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">Movimento</Label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => updateConfig({ movement: "stationary" })}
                  className={`text-xs h-7 rounded-md transition-colors ${
                    config.movement === "stationary" 
                      ? 'bg-primary text-white' 
                      : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Parado
                </button>
                <button
                  onClick={() => updateConfig({ movement: "scanning" })}
                  className={`text-xs h-7 rounded-md transition-colors ${
                    config.movement === "scanning" 
                      ? 'bg-primary text-white' 
                      : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Varredura
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info sobre frequência */}
        <div className="p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {config.frequency <= 1.5 
              ? "📏 Frequência baixa: penetração profunda, ideal para estruturas profundas"
              : "🎯 Frequência alta: penetração superficial, ideal para tendões e ligamentos"
            }
          </p>
        </div>
      </div>
    </div>
  );
}
