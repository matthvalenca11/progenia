/**
 * ControlPanel - Painel de controle compacto e limpo
 */

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap, Ruler } from "lucide-react";
import { useTensLabStore } from "@/stores/tensLabStore";
import { tissuePresets, TissuePresetId } from "@/types/tissueConfig";

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
  step = 1, 
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
          {value} <span className="text-slate-500">{unit}</span>
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

export function TensLabControlPanel() {
  const {
    labConfig,
    presetId,
    frequency,
    pulseWidth,
    intensity,
    mode,
    electrodes,
    setPreset,
    setFrequency,
    setPulseWidth,
    setIntensity,
    setMode,
    setElectrodeDistance,
    setElectrodeSize,
    setElectrodes,
  } = useTensLabStore();

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="p-3 border-b border-slate-800">
        <h2 className="text-sm font-medium text-white">Controles</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {/* Cenário */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-500 uppercase tracking-wide">Cenário</Label>
          <Select value={presetId} onValueChange={(v) => setPreset(v as TissuePresetId)}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tissuePresets.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="h-px bg-slate-800" />

        {/* Parâmetros TENS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <Label className="text-xs text-slate-500 uppercase tracking-wide">Parâmetros</Label>
          </div>

          {labConfig.enabledControls.frequency && (
            <SliderControl
              label="Frequência"
              value={frequency}
              onChange={setFrequency}
              min={labConfig.frequencyRange.min}
              max={labConfig.frequencyRange.max}
              unit="Hz"
            />
          )}

          {labConfig.enabledControls.pulseWidth && (
            <SliderControl
              label="Largura de Pulso"
              value={pulseWidth}
              onChange={setPulseWidth}
              min={labConfig.pulseWidthRange.min}
              max={labConfig.pulseWidthRange.max}
              step={10}
              unit="µs"
            />
          )}

          {labConfig.enabledControls.intensity && (
            <SliderControl
              label="Intensidade"
              value={intensity}
              onChange={setIntensity}
              min={labConfig.intensityRange.min}
              max={labConfig.intensityRange.max}
              unit="mA"
            />
          )}

          {labConfig.enabledControls.mode && labConfig.allowedModes.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">Modo</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {labConfig.allowedModes.map((m) => (
                  <Button
                    key={m}
                    variant={mode === m ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMode(m)}
                    className={`text-xs h-7 capitalize ${
                      mode === m 
                        ? 'bg-primary' 
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="h-px bg-slate-800" />

        {/* Eletrodos */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Ruler className="h-3.5 w-3.5 text-cyan-500" />
            <Label className="text-xs text-slate-500 uppercase tracking-wide">Eletrodos</Label>
          </div>

          <SliderControl
            label="Distância"
            value={electrodes.distanceCm}
            onChange={setElectrodeDistance}
            min={2}
            max={12}
            unit="cm"
            highlight={true}
          />

          <SliderControl
            label="Tamanho"
            value={electrodes.sizeCm}
            onChange={setElectrodeSize}
            min={2}
            max={6}
            step={0.5}
            unit="cm"
          />
        </div>

        {/* Info sobre distância */}
        <div className="p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {electrodes.distanceCm <= 4 
              ? "⚡ Distância curta: campo concentrado, ativação superficial"
              : electrodes.distanceCm <= 8 
                ? "✓ Distância média: boa penetração, campo balanceado"
                : "📏 Distância longa: campo espalhado, ativação profunda"
            }
          </p>
        </div>
      </div>
    </div>
  );
}
