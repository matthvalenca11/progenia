/**
 * ControlPanel - Painel de controle para Ultrassom Terapêutico
 * Progressive disclosure: básico aberto, avançado fechado
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BookOpen, Info } from "lucide-react";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { TransducerMap2D } from "./TransducerMap2D";
import { clinicalPresets, ClinicalPreset } from "@/config/ultrasoundTherapyPresets";
import { AnatomicalScenario } from "@/types/ultrasoundTherapyConfig";
import {
  patchStackThicknesses,
  resolveStackLayout,
  resolveMixedLayerConfig,
  DEFAULT_STACK_THICKNESSES,
} from "@/lib/ultrasoundTherapyStackConfig";
import {
  TissuePerfusionProfile,
  TISSUE_PERFUSION_PROFILE_LABELS,
  getPerfusionVisualProfile,
  TRANSDUCER_BEAM_PROFILE_LABELS,
  TransducerBeamProfile,
  TherapeuticTransducerType,
  ERA_CLINICAL_REFERENCE,
} from "@/types/ultrasoundTherapyConfig";
import {
  getTransducerDefinition,
  isFocusDepthApplicable,
} from "@/config/therapeuticTransducerDefinitions";
import { TransducerTypeVisualPicker } from "./TransducerTypeField";
import { cn } from "@/lib/utils";
import {
  utCard,
  utLabel,
  utInputShell,
  utSelectTrigger,
  utPanel,
  utHint,
  utSegmentTrack,
  utSegmentActive,
  utSegmentInactive,
  utAccordionItem,
  utAccordionTrigger,
  SHOW_PROPAGATION_LAYERS_PANEL,
} from "./ultrasoundTherapyUi";
import { AcousticPhenomenaToggles } from "./AcousticPhenomenaToggles";
import { ParameterQuickCards } from "./ParameterQuickCards";
import { TargetTissueSelector } from "./TargetTissueSelector";

interface SliderControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  hint?: string;
  min: number;
  max: number;
  step?: number;
  unit: string;
  disabled?: boolean;
  compact?: boolean;
}

const cardShell = utCard;

function SliderControl({
  label,
  value,
  onChange,
  onCommit,
  hint,
  min,
  max,
  step = 0.1,
  unit,
  disabled = false,
  compact = false,
}: SliderControlProps) {
  return (
    <div className={cn("space-y-3", disabled && "pointer-events-none opacity-40")}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Label className={utLabel}>{label}</Label>
          {hint ? (
            <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <div className={utInputShell}>
          {value.toFixed(step < 1 ? 1 : 0)}{" "}
          <span className="font-normal text-muted-foreground">{unit}</span>
        </div>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        onValueCommit={(v) => onCommit?.(v[0])}
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

function PresetExplanationCard({ preset }: { preset: ClinicalPreset }) {
  const isWarning = preset.id === "exemplo-inadequado";

  return (
    <div className={cn(cardShell, "flex gap-3 p-4")}>
      <Info
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          isWarning ? "text-amber-500" : "text-muted-foreground",
        )}
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{preset.name}</p>
        <p className={cn("mt-1 leading-relaxed", utHint)}>{preset.explanation}</p>
      </div>
    </div>
  );
}

function ToggleGroup({
  options,
  value,
  onChange,
  compact = false,
  columns = 2,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
  columns?: 2 | 3;
}) {
  return (
    <div
      className={cn(
        utSegmentTrack,
        columns === 3 && "grid-cols-3",
      )}
    >
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-lg border text-xs font-medium transition-all duration-200 ease-in-out",
              compact ? "h-10" : "h-9",
              isActive ? utSegmentActive : utSegmentInactive,
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const accordionItemClass = utAccordionItem;
const accordionTriggerClass = utAccordionTrigger;
const accordionContentClass = "transition-all duration-200 ease-in-out";

export function UltrasoundTherapyControlPanel({
  hideHeader = false,
  compact = false,
}: {
  hideHeader?: boolean;
  compact?: boolean;
}) {
  const { config, updateConfig, flushSimulation, applyClinicalPreset, activeClinicalPresetId, viewerTab, simulationResult } =
    useUltrasoundTherapyStore();
  const commitSim = () => flushSimulation();

  const focusDepthEnabled = isFocusDepthApplicable(config.transducerType, config.beamProfile);

  const selectedPreset = activeClinicalPresetId
    ? clinicalPresets.find((p) => p.id === activeClinicalPresetId) ?? null
    : null;

  const handleScenarioChange = (v: string) => {
    const newScenario = v as AnatomicalScenario;
    if (newScenario === "custom" && !config.customThicknesses) {
      updateConfig({
        scenario: newScenario,
        customThicknesses: { ...DEFAULT_STACK_THICKNESSES },
      });
    } else {
      updateConfig({ scenario: newScenario });
    }
  };

  const presetSelect = (
    <Select value={activeClinicalPresetId ?? ""} onValueChange={applyClinicalPreset}>
      <SelectTrigger
        className={cn(
          "w-full",
          utSelectTrigger,
          compact ? "h-10" : "h-9",
        )}
      >
        <BookOpen className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Presets clínicos" />
      </SelectTrigger>
      <SelectContent>
        {clinicalPresets.map((preset) => (
          <SelectItem key={preset.id} value={preset.id}>
            {preset.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const scenarioSelect = (
    <Select
      value={config.scenario}
      onValueChange={handleScenarioChange}
      disabled={!config.enabledControls.scenario}
    >
      <SelectTrigger
        className={cn(
          "w-full",
          utSelectTrigger,
          compact ? "h-10" : "h-9",
        )}
      >
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
  );

  const customThicknessSection =
    config.scenario === "custom" &&
    config.enabledControls.customThicknesses !== false && (
      <div className={cn(cardShell, "space-y-4 p-5")}>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Espessuras das camadas (empilhadas)
        </Label>
        {(() => {
          const stack = resolveStackLayout(config.customThicknesses);
          return (
            <>
        <SliderControl
          label="Pele"
          hint={`Espessura · 0 – ${stack.skin.toFixed(2)} cm`}
          value={stack.skin}
          onChange={(v) =>
            updateConfig({
              customThicknesses: patchStackThicknesses(config.customThicknesses, { skin: v }),
            })
          }
          onCommit={commitSim}
          min={0.1}
          max={0.5}
          step={0.05}
          unit="cm"
          compact={compact}
        />
        <SliderControl
          label="Gordura"
          hint={`Espessura · início ${stack.fatStart.toFixed(2)} cm`}
          value={stack.fat}
          onChange={(v) =>
            updateConfig({
              customThicknesses: patchStackThicknesses(config.customThicknesses, { fat: v }),
            })
          }
          onCommit={commitSim}
          min={0.1}
          max={2.0}
          step={0.1}
          unit="cm"
          compact={compact}
        />
        <SliderControl
          label="Músculo"
          hint={`Espessura · início ${stack.muscleStart.toFixed(2)} cm · osso em ${stack.boneDepth.toFixed(2)} cm`}
          value={stack.muscle}
          onChange={(v) =>
            updateConfig({
              customThicknesses: patchStackThicknesses(config.customThicknesses, { muscle: v }),
            })
          }
          onCommit={commitSim}
          min={0.5}
          max={5.0}
          step={0.1}
          unit="cm"
          compact={compact}
        />
            </>
          );
        })()}
      </div>
    );

  const mixedLayerSection =
    config.scenario === "custom" &&
    config.mixedLayer?.enabled &&
    config.enabledControls.mixedLayer !== false && (
    <div className={cn(cardShell, "space-y-4 p-5")}>
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Camada mista (osso / músculo)
      </Label>
      {(() => {
        const mixed = resolveMixedLayerConfig(
          config.scenario,
          config.customThicknesses,
          config.mixedLayer,
        );
        const stack = resolveStackLayout(config.customThicknesses);
        if (!mixed) return null;
        return (
          <>
            <p className="text-xs text-muted-foreground">
              Plano na profundidade {mixed.depth.toFixed(2)} cm (fim do músculo · pele{" "}
              {stack.skin.toFixed(2)} + gordura {stack.fat.toFixed(2)} + músculo{" "}
              {stack.muscle.toFixed(2)} cm)
            </p>
            <SliderControl
              label="Divisão osso / músculo"
              hint="Esquerda = músculo · direita = osso"
              value={mixed.division}
              onChange={(v) =>
                updateConfig({
                  mixedLayer: { ...config.mixedLayer!, division: v },
                })
              }
              onCommit={commitSim}
              min={config.ranges.mixedLayer?.division.min ?? 0}
              max={config.ranges.mixedLayer?.division.max ?? 100}
              step={1}
              unit="%"
              compact={compact}
            />
            <p className="text-xs text-muted-foreground">
              {mixed.division < 50
                ? `Predomínio muscular (${100 - mixed.division}%)`
                : `Predomínio ósseo (${mixed.division}%)`}
            </p>
          </>
        );
      })()}
    </div>
  );

  const transducerTypeSection =
    config.enabledControls.transducerType !== false ? (
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Aplicador terapêutico
        </Label>
        <TransducerTypeVisualPicker
          compact={compact}
          value={config.transducerType ?? "planar_circular"}
          onChange={(v) => updateConfig({ transducerType: v })}
        />
        <p className="text-xs text-muted-foreground">
          {getTransducerDefinition(config.transducerType ?? "planar_circular").subtitle}
        </p>
      </div>
    ) : null;

  const basicParams = (
    <div className="space-y-5 px-5 pb-6 pt-1">
      {transducerTypeSection}

      {config.enabledControls.mode && (
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modo</Label>
          <ToggleGroup
            compact={compact}
            value={config.mode}
            onChange={(v) => updateConfig({ mode: v as "continuous" | "pulsed" })}
            options={[
              { value: "continuous", label: "Contínuo" },
              { value: "pulsed", label: "Pulsado" },
            ]}
          />
        </div>
      )}

      {config.enabledControls.frequency && (
        <SliderControl
          label="Frequência"
          value={config.frequency}
          onChange={(v) => updateConfig({ frequency: v })}
          onCommit={() => flushSimulation()}
          min={config.ranges.frequency.min}
          max={config.ranges.frequency.max}
          step={0.1}
          unit="MHz"
          compact={compact}
        />
      )}

      {config.enabledControls.frequency && (
        <p className={cn("px-1", utHint)}>
          {config.frequency <= 1.5
            ? "Frequência baixa (≈1 MHz) penetra mais profundamente no músculo."
            : config.frequency >= 2.5
              ? "Frequência alta (≈3 MHz) concentra energia na pele e tecidos superficiais."
              : "Frequência intermediária equilibra penetração e aquecimento local."}
        </p>
      )}

      {config.enabledControls.intensity && (
        <SliderControl
          label="Intensidade"
          value={config.intensity}
          onChange={(v) => updateConfig({ intensity: v })}
          onCommit={() => flushSimulation()}
          min={config.ranges.intensity.min}
          max={config.ranges.intensity.max}
          step={0.1}
          unit="W/cm²"
          compact={compact}
        />
      )}

      {config.enabledControls.intensity && (
        <p className={cn("px-1", utHint)}>
          Intensidade alta com transdutor parado aumenta risco de hotspot — prefira varredura lenta.
        </p>
      )}

      {config.enabledControls.duration && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tempo
            </Label>
            <div className={cn("flex items-center gap-1", utInputShell)}>
              <Input
                type="number"
                value={config.duration}
                onChange={(e) => updateConfig({ duration: Number(e.target.value) || 0 })}
                min={config.ranges.duration.min}
                max={config.ranges.duration.max}
                step={1}
                className={cn(
                  "border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0",
                  compact ? "h-7 w-12" : "h-6 w-10",
                )}
              />
              <span className="font-normal text-muted-foreground">min</span>
            </div>
          </div>
        </div>
      )}

      {config.enabledControls.dutyCycle && config.mode === "pulsed" && (
        <SliderControl
          label="Duty cycle"
          value={config.dutyCycle}
          onChange={(v) => updateConfig({ dutyCycle: v })}
          onCommit={commitSim}
          min={config.ranges.dutyCycle.min}
          max={config.ranges.dutyCycle.max}
          step={5}
          unit="%"
          compact={compact}
        />
      )}

      <div className={cn(cardShell, "p-5")}>
        <TransducerMap2D compact={compact} />
      </div>
    </div>
  );

  const advancedParams = (
    <div className="space-y-5 px-5 pb-6 pt-1">
      {config.enabledControls.era && (
        <div className="space-y-3">
          <SliderControl
            label="ERA (área efetiva)"
            value={config.era}
            onChange={(v) => updateConfig({ era: v })}
            onCommit={commitSim}
            min={config.ranges.era.min}
            max={config.ranges.era.max}
            step={0.25}
            unit="cm²"
            compact={compact}
          />
          <p className={utHint}>
            Clínico típico: {ERA_CLINICAL_REFERENCE.typicalMin}–{ERA_CLINICAL_REFERENCE.typicalMax}{" "}
            cm² (superfície que emite ultrassom, menor que o cabeçote físico).
          </p>
        </div>
      )}

      {config.enabledControls.beamProfile !== false &&
        !getTransducerDefinition(config.transducerType ?? "planar_circular").lockBeamProfile && (
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Perfil do transdutor / feixe
          </Label>
          <ToggleGroup
            compact={compact}
            value={config.beamProfile ?? "planar"}
            onChange={(v) => updateConfig({ beamProfile: v as TransducerBeamProfile })}
            options={[
              { value: "planar", label: "Plano" },
              { value: "focused", label: "Focalizado" },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            {TRANSDUCER_BEAM_PROFILE_LABELS[config.beamProfile ?? "planar"]} — altera a
            geometria do feixe na aba Feixe.
          </p>
        </div>
      )}

      {config.enabledControls.focusDepth !== false && focusDepthEnabled && (
          <SliderControl
            label="Profundidade focal"
            value={config.focusDepth ?? 2.5}
            onChange={(v) => updateConfig({ focusDepth: v })}
            onCommit={commitSim}
            min={config.ranges.focusDepth?.min ?? 1}
            max={config.ranges.focusDepth?.max ?? 5}
            step={0.1}
            unit="cm"
            compact={compact}
          />
        )}

      {config.enabledControls.coupling && (
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Acoplamento
          </Label>
          <ToggleGroup
            compact={compact}
            value={config.coupling}
            onChange={(v) => updateConfig({ coupling: v as "good" | "poor" })}
            options={[
              { value: "good", label: "Bom gel" },
              { value: "poor", label: "Ruim" },
            ]}
          />
          <p className={utHint}>
            Acoplamento ruim reduz transmissão e aumenta aquecimento superficial.
          </p>
        </div>
      )}

      {config.enabledControls.movement && (
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Movimento do transdutor
          </Label>
          <ToggleGroup
            compact={compact}
            value={config.movement}
            onChange={(v) => updateConfig({ movement: v as "stationary" | "scanning" })}
            options={[
              { value: "stationary", label: "Parado" },
              { value: "scanning", label: "Varredura" },
            ]}
          />
          <p className={utHint}>
            Movimento estacionário concentra energia; varredura distribui calor e reduz picos.
          </p>
        </div>
      )}

      {mixedLayerSection}
      {customThicknessSection}

      {config.enabledControls.tissuePerfusionProfile !== false && (
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Perfil de perfusão
          </Label>
          <Select
            value={config.tissuePerfusionProfile}
            onValueChange={(v) =>
              updateConfig({ tissuePerfusionProfile: v as TissuePerfusionProfile })
            }
          >
            <SelectTrigger className={cn("h-9 w-full", utSelectTrigger)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TISSUE_PERFUSION_PROFILE_LABELS) as TissuePerfusionProfile[]).map(
                (key) => (
                  <SelectItem key={key} value={key}>
                    {TISSUE_PERFUSION_PROFILE_LABELS[key]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <p className={utHint}>
            {getPerfusionVisualProfile(config.tissuePerfusionProfile).dissipationLabel}
            {simulationResult
              ? ` · T máx ${simulationResult.maxTemp.toFixed(1)}°C · alvo ${simulationResult.targetTemp.toFixed(1)}°C`
              : " · altera dissipação térmica e rubor vascular no 3D"}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className={compact ? cn("w-full min-w-0 max-w-full", utPanel) : cn("flex h-full flex-col", utPanel)}>
      {!hideHeader && (
        <div className="border-b border-border px-6 py-4">
          <h2 className={utLabel}>Controles</h2>
        </div>
      )}

      <div
        className={cn(
          compact
            ? "w-full min-w-0 max-w-full space-y-4 p-4 pb-8"
            : "flex-1 space-y-5 overflow-y-auto p-6",
          hideHeader && !compact && "pb-8",
        )}
      >
        <div className={cn(compact ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-3")}>
          {presetSelect}
          {scenarioSelect}
        </div>

        {selectedPreset && <PresetExplanationCard preset={selectedPreset} />}

        <ParameterQuickCards compact={compact} />

        <TargetTissueSelector compact={compact} />

        <Accordion type="multiple" defaultValue={["basic"]} className="space-y-4">
          <AccordionItem value="basic" className={accordionItemClass}>
            <AccordionTrigger className={accordionTriggerClass}>
              Parâmetros básicos
            </AccordionTrigger>
            <AccordionContent className={accordionContentClass}>{basicParams}</AccordionContent>
          </AccordionItem>

          {SHOW_PROPAGATION_LAYERS_PANEL && viewerTab === "interaction" && (
            <AccordionItem value="propagation" className={accordionItemClass}>
              <AccordionTrigger className={accordionTriggerClass}>
                Camadas de visualização
              </AccordionTrigger>
              <AccordionContent className={accordionContentClass}>
                <AcousticPhenomenaToggles compact={compact} />
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="advanced" className={accordionItemClass}>
            <AccordionTrigger className={accordionTriggerClass}>
              Avançado
            </AccordionTrigger>
            <AccordionContent className={accordionContentClass}>{advancedParams}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
