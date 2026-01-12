/**
 * ControlPanel - Painel de controle lateral colapsável
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronRight, 
  Activity, 
  Layers, 
  Zap,
  CircleDot,
  Info,
  Ruler,
  Move,
  RotateCcw
} from "lucide-react";
import { useTensLabStore } from "@/stores/tensLabStore";
import { tissuePresets, TissuePresetId } from "@/types/tissueConfig";
import { electrodePlacementPresets, ElectrodePlacement } from "@/simulation/TensFieldEngine";

interface ControlSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function ControlSection({ title, icon, defaultOpen = true, children }: ControlSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between py-2 px-1 cursor-pointer hover:bg-muted/50 rounded-md transition-colors">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-medium text-sm">{title}</span>
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pb-4 space-y-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface SliderControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit: string;
  tooltip?: string;
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
  tooltip,
  disabled = false
}: SliderControlProps) {
  return (
    <div className={disabled ? "opacity-50 pointer-events-none" : ""}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <Label className="text-sm">{label}</Label>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-sm">
          <span className="font-mono font-semibold">{value}</span>
          <span className="text-muted-foreground text-xs">{unit}</span>
        </div>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="py-2"
      />
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
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
    setElectrodes,
    setElectrodeDistance,
    setElectrodeSize,
  } = useTensLabStore();

  const preset = tissuePresets.find(p => p.id === presetId);

  return (
    <Card className="h-full overflow-hidden flex flex-col">
      <CardHeader className="py-3 px-4 border-b shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Painel de Controle
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-2">
        {/* Cenário Anatômico */}
        <ControlSection
          title="Cenário e Anatomia"
          icon={<Layers className="h-4 w-4 text-rose-500" />}
        >
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Cenário anatômico</Label>
              <Select value={presetId} onValueChange={(v) => setPreset(v as TissuePresetId)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tissuePresets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {preset && (
              <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                {preset.description}
              </div>
            )}

            {/* Mini preview - camadas */}
            <div className="h-16 rounded-lg overflow-hidden border relative">
              <div 
                className="absolute inset-x-0 top-0 bg-gradient-to-b from-rose-200 to-rose-300 dark:from-rose-800/50 dark:to-rose-700/50"
                style={{ height: "15%" }}
              />
              <div 
                className="absolute inset-x-0 bg-gradient-to-b from-amber-200 to-amber-300 dark:from-amber-800/50 dark:to-amber-700/50"
                style={{ top: "15%", height: "25%" }}
              />
              <div 
                className="absolute inset-x-0 bg-gradient-to-b from-red-400 to-red-500 dark:from-red-800/50 dark:to-red-700/50"
                style={{ top: "40%", height: "40%" }}
              />
              <div 
                className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-600"
                style={{ height: "20%" }}
              />
              <div className="absolute inset-0 flex items-center justify-center gap-4">
                <div className="text-[10px] text-center">
                  <div className="font-semibold text-rose-700 dark:text-rose-300">Pele</div>
                </div>
                <div className="text-[10px] text-center">
                  <div className="font-semibold text-amber-700 dark:text-amber-300">Gordura</div>
                </div>
                <div className="text-[10px] text-center">
                  <div className="font-semibold text-red-100">Músculo</div>
                </div>
              </div>
            </div>
          </div>
        </ControlSection>

        <div className="border-t my-2" />

        {/* Parâmetros TENS */}
        <ControlSection
          title="Parâmetros TENS"
          icon={<Zap className="h-4 w-4 text-amber-500" />}
        >
          <div className="space-y-5">
            {labConfig.enabledControls.frequency && (
              <SliderControl
                label="Frequência"
                value={frequency}
                onChange={setFrequency}
                min={labConfig.frequencyRange.min}
                max={labConfig.frequencyRange.max}
                unit="Hz"
                tooltip="Frequências altas (>50Hz) favorecem analgesia por teoria das comportas. Frequências baixas (<10Hz) estimulam liberação de endorfinas."
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
                tooltip="Pulsos mais longos (>200µs) recrutam fibras motoras. Pulsos curtos (<100µs) são mais seletivos para fibras sensoriais."
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
                tooltip="Aumente gradualmente até percepção sensorial confortável. Intensidades altas podem causar contração muscular."
              />
            )}

            {labConfig.enabledControls.mode && labConfig.allowedModes.length > 0 && (
              <div>
                <Label className="text-sm mb-2 block">Modo de Estimulação</Label>
                <div className="grid grid-cols-2 gap-2">
                  {labConfig.allowedModes.map((m) => (
                    <Button
                      key={m}
                      variant={mode === m ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMode(m)}
                      className="capitalize text-xs h-8"
                    >
                      {m}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ControlSection>

        <div className="border-t my-2" />

        {/* Eletrodos */}
        <ControlSection
          title="Eletrodos"
          icon={<CircleDot className="h-4 w-4 text-blue-500" />}
        >
          <div className="space-y-5">
            <SliderControl
              label="Distância entre eletrodos"
              value={electrodes.distanceCm}
              onChange={setElectrodeDistance}
              min={2}
              max={12}
              unit="cm"
              tooltip="Distância curta: ativação superficial concentrada. Distância longa: ativação mais profunda e espalhada."
            />

            <SliderControl
              label="Tamanho do eletrodo"
              value={electrodes.sizeCm}
              onChange={setElectrodeSize}
              min={2}
              max={6}
              step={0.5}
              unit="cm"
              tooltip="Eletrodos maiores distribuem melhor a corrente, reduzindo densidade na pele e aumentando conforto."
            />

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Forma</Label>
              <div className="flex gap-2">
                <Button
                  variant={electrodes.shape === "rectangular" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setElectrodes({ shape: "rectangular" })}
                  className="flex-1 text-xs h-8"
                >
                  Retangular
                </Button>
                <Button
                  variant={electrodes.shape === "circular" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setElectrodes({ shape: "circular" })}
                  className="flex-1 text-xs h-8"
                >
                  Circular
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Preset de posicionamento</Label>
              <Select 
                value={electrodes.placement} 
                onValueChange={(v) => {
                  const preset = electrodePlacementPresets[v as ElectrodePlacement];
                  setElectrodes({ 
                    placement: v as ElectrodePlacement,
                    distanceCm: preset.distanceCm 
                  });
                }}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(electrodePlacementPresets).map(([key, preset]) => (
                    <SelectItem key={key} value={key}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8 gap-1"
                onClick={() => setElectrodes({ distanceCm: 6 })}
              >
                <Move className="h-3 w-3" />
                Centralizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8 gap-1"
                onClick={() => setElectrodes({ 
                  distanceCm: 6, 
                  sizeCm: 4, 
                  shape: "rectangular",
                  placement: "default"
                })}
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            </div>
          </div>
        </ControlSection>
      </CardContent>
    </Card>
  );
}
