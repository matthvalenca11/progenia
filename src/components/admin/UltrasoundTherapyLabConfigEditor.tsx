import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  UltrasoundTherapyConfig,
  AnatomicalScenario,
  TissuePerfusionProfile,
  TISSUE_PERFUSION_PROFILE_LABELS,
  TRANSDUCER_BEAM_PROFILE_LABELS,
  TransducerBeamProfile,
  TherapeuticTransducerType,
  ERA_CLINICAL_REFERENCE,
  FOCUS_DEPTH_ABSOLUTE_MIN,
  getScenarioMaxFocusDepth,
  validateFocusDepthForScenario,
} from "@/types/ultrasoundTherapyConfig";
import {
  patchStackThicknesses,
  resolveStackLayout,
  DEFAULT_STACK_THICKNESSES,
  toStackCustomThicknesses,
} from "@/lib/ultrasoundTherapyStackConfig";
import {
  configDefaultsForTransducerType,
  getTransducerDefinition,
  isFocusDepthApplicable,
} from "@/config/therapeuticTransducerDefinitions";
import { TransducerTypeField } from "@/components/labs/ultrasound-therapy/TransducerTypeField";
import { TOTAL_BLOCK_DEPTH } from "@/lib/ultrasoundTherapyStack";
import { UltrasoundTherapyLabPreview } from "./UltrasoundTherapyLabPreview";
import { TherapyStudentControlsPreview } from "./TherapyStudentControlsPreview";
import { Settings2, Sliders, AlertTriangle } from "lucide-react";

interface UltrasoundTherapyLabConfigEditorProps {
  config: UltrasoundTherapyConfig;
  onChange: (config: UltrasoundTherapyConfig) => void;
}

interface NumericRange {
  min: number;
  max: number;
  step?: number;
}

function RangeMinMaxStepEditor({
  label,
  range,
  onChange,
  unit,
  absoluteMin,
  absoluteMax,
}: {
  label: string;
  range: NumericRange;
  onChange: (next: NumericRange) => void;
  unit?: string;
  absoluteMin?: number;
  absoluteMax?: number;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Mín</Label>
          <Input
            type="number"
            value={range.min}
            step={range.step ?? 0.1}
            onChange={(e) => {
              const min = Number(e.target.value);
              onChange({ ...range, min: absoluteMin != null ? Math.max(absoluteMin, min) : min });
            }}
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Máx</Label>
          <Input
            type="number"
            value={range.max}
            step={range.step ?? 0.1}
            onChange={(e) => {
              const max = Number(e.target.value);
              onChange({ ...range, max: absoluteMax != null ? Math.min(absoluteMax, max) : max });
            }}
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Step</Label>
          <Input
            type="number"
            value={range.step ?? 0.1}
            step={0.01}
            min={0.01}
            onChange={(e) => onChange({ ...range, step: Number(e.target.value) || 0.1 })}
          />
        </div>
      </div>
      {unit && <p className="text-[10px] text-muted-foreground">Unidade: {unit}</p>}
    </div>
  );
}

export function UltrasoundTherapyLabConfigEditor({ config, onChange }: UltrasoundTherapyLabConfigEditorProps) {
  const updateConfig = (updates: Partial<UltrasoundTherapyConfig>) => {
    onChange({ ...config, ...updates });
  };

  const updateEnabledControls = (key: keyof UltrasoundTherapyConfig["enabledControls"], value: boolean) => {
    updateConfig({
      enabledControls: {
        ...config.enabledControls,
        [key]: value,
      },
    });
  };

  const transducerDef = getTransducerDefinition(config.transducerType ?? "planar_circular");
  const beamProfileLocked = transducerDef.lockBeamProfile;
  const focusDepthEnabled = isFocusDepthApplicable(config.transducerType, config.beamProfile);
  const scenarioMaxFocus = useMemo(
    () => getScenarioMaxFocusDepth(config.scenario, config.customThicknesses),
    [config.scenario, config.customThicknesses],
  );
  const focusValidation = useMemo(
    () => validateFocusDepthForScenario(config.focusDepth ?? 2.5, config.scenario, config.customThicknesses),
    [config.focusDepth, config.scenario, config.customThicknesses],
  );

  const handleTransducerTypeChange = (type: TherapeuticTransducerType) => {
    const def = getTransducerDefinition(type);
    updateConfig({
      transducerType: type,
      ...configDefaultsForTransducerType(type),
      beamProfile: def.defaultBeamProfile,
    });
  };

  const handleFocusDepthChange = (value: number) => {
    const { value: clamped } = validateFocusDepthForScenario(value, config.scenario, config.customThicknesses);
    updateConfig({ focusDepth: clamped });
  };

  const customThicknesses = toStackCustomThicknesses(config.customThicknesses);
  const stackLayout = resolveStackLayout(customThicknesses);
  const thicknessRanges = config.ranges.customThicknesses ?? {
    skin: { min: 0.1, max: 0.5, step: 0.05 },
    fat: { min: 0.1, max: 2.0, step: 0.1 },
    muscle: { min: 0.5, max: 5.0, step: 0.1 },
  };
  const focusDepthRange = config.ranges.focusDepth ?? { min: 1.0, max: 5.0, step: 0.1 };

  const enabledSwitch = (
    key: keyof UltrasoundTherapyConfig["enabledControls"],
    id: string,
    title: string,
    description: string,
    defaultOn = true,
  ) => {
    const checked =
      config.enabledControls[key] === undefined ? defaultOn : Boolean(config.enabledControls[key]);
    return (
      <div className="flex items-center justify-between pt-4 border-t first:pt-0 first:border-t-0">
        <Label htmlFor={id} className="flex flex-col gap-1">
          <span className="font-medium">{title}</span>
          <span className="text-sm text-muted-foreground">{description}</span>
        </Label>
        <Switch id={id} checked={checked} onCheckedChange={(v) => updateEnabledControls(key, v)} />
      </div>
    );
  };

  return (
    <Tabs defaultValue="defaults" className="w-full">
      <TabsList className="mb-6 grid w-full grid-cols-2">
        <TabsTrigger value="defaults" className="flex items-center gap-2">
          <Sliders className="h-4 w-4" />
          Defaults
        </TabsTrigger>
        <TabsTrigger value="controls" className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Controles do Aluno
        </TabsTrigger>
      </TabsList>

      {/* ── Tab: Defaults (config à esquerda, preview anatômico à direita) ── */}
      <TabsContent value="defaults" className="mt-6">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cenário anatômico padrão</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={config.scenario}
                  onValueChange={(v) => {
                    const newScenario = v as AnatomicalScenario;
                    if (newScenario === "custom" && !config.customThicknesses) {
                      updateConfig({
                        scenario: newScenario,
                        customThicknesses: { ...DEFAULT_STACK_THICKNESSES },
                      });
                    } else {
                      updateConfig({ scenario: newScenario });
                    }
                  }}
                >
                  <SelectTrigger>
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
              </CardContent>
            </Card>

            {config.scenario === "custom" && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Espessuras STACK (defaults)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <div>
                          <Label>Pele</Label>
                          <p className="text-xs text-muted-foreground">Espessura · 0 – {stackLayout.skin.toFixed(2)} cm</p>
                        </div>
                        <span className="font-mono text-sm">{stackLayout.skin.toFixed(2)} cm</span>
                      </div>
                      <Slider
                        value={[stackLayout.skin]}
                        onValueChange={(v) =>
                          updateConfig({
                            customThicknesses: patchStackThicknesses(customThicknesses, { skin: v[0] }),
                          })
                        }
                        min={thicknessRanges.skin.min}
                        max={thicknessRanges.skin.max}
                        step={thicknessRanges.skin.step ?? 0.05}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <div>
                          <Label>Gordura</Label>
                          <p className="text-xs text-muted-foreground">Espessura · início {stackLayout.fatStart.toFixed(2)} cm</p>
                        </div>
                        <span className="font-mono text-sm">{stackLayout.fat.toFixed(2)} cm</span>
                      </div>
                      <Slider
                        value={[stackLayout.fat]}
                        onValueChange={(v) =>
                          updateConfig({
                            customThicknesses: patchStackThicknesses(customThicknesses, { fat: v[0] }),
                          })
                        }
                        min={thicknessRanges.fat.min}
                        max={thicknessRanges.fat.max}
                        step={thicknessRanges.fat.step ?? 0.1}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <div>
                          <Label>Músculo</Label>
                          <p className="text-xs text-muted-foreground">
                            Espessura · início {stackLayout.muscleStart.toFixed(2)} cm · osso em{" "}
                            {stackLayout.boneDepth.toFixed(2)} cm
                          </p>
                        </div>
                        <span className="font-mono text-sm">{stackLayout.muscle.toFixed(2)} cm</span>
                      </div>
                      <Slider
                        value={[stackLayout.muscle]}
                        onValueChange={(v) =>
                          updateConfig({
                            customThicknesses: patchStackThicknesses(customThicknesses, { muscle: v[0] }),
                          })
                        }
                        min={thicknessRanges.muscle.min}
                        max={thicknessRanges.muscle.max}
                        step={thicknessRanges.muscle.step ?? 0.1}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Camada mista</CardTitle>
                    <CardDescription>
                      Plano horizontal onde músculo e osso coexistem lateralmente (cenário personalizado)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Ativar camada mista</Label>
                      <Switch
                        checked={config.mixedLayer?.enabled ?? false}
                        onCheckedChange={(checked) => {
                          const boneDepth = resolveStackLayout(customThicknesses).boneDepth;
                          updateConfig({
                            mixedLayer: {
                              enabled: checked,
                              depth: boneDepth,
                              division: config.mixedLayer?.division ?? 50,
                            },
                          });
                        }}
                      />
                    </div>
                    {config.mixedLayer?.enabled && (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Profundidade automática:{" "}
                          <span className="font-mono">
                            {resolveStackLayout(customThicknesses).boneDepth.toFixed(2)} cm
                          </span>{" "}
                          (fim do músculo — ajuste pelas espessuras STACK acima)
                        </p>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <div>
                              <Label>Divisão osso / músculo</Label>
                              <p className="text-xs text-muted-foreground">
                                Esquerda = músculo · direita = osso
                              </p>
                            </div>
                            <span className="font-mono text-sm">
                              {config.mixedLayer.division}%
                            </span>
                          </div>
                          <Slider
                            value={[config.mixedLayer.division]}
                            onValueChange={(v) =>
                              updateConfig({
                                mixedLayer: { ...config.mixedLayer!, division: v[0] },
                              })
                            }
                            min={config.ranges.mixedLayer?.division.min ?? 0}
                            max={config.ranges.mixedLayer?.division.max ?? 100}
                            step={1}
                          />
                          <p className="text-xs text-muted-foreground">
                            {config.mixedLayer.division < 50
                              ? `Predomínio muscular (${100 - config.mixedLayer.division}%)`
                              : `Predomínio ósseo (${config.mixedLayer.division}%)`}
                          </p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuração inicial do transdutor</CardTitle>
            <CardDescription>
              Valores padrão ao abrir o lab — persistidos em config_data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <TransducerTypeField
              value={config.transducerType ?? "planar_circular"}
              onChange={handleTransducerTypeChange}
            />

            <div>
              <Label>Perfil do feixe</Label>
              <Select
                value={config.beamProfile}
                disabled={beamProfileLocked}
                onValueChange={(v) => updateConfig({ beamProfile: v as TransducerBeamProfile })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TRANSDUCER_BEAM_PROFILE_LABELS) as TransducerBeamProfile[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {TRANSDUCER_BEAM_PROFILE_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {beamProfileLocked && (
                <p className="mt-1 text-xs text-amber-600">
                  Aplicador convergente trava o perfil de feixe focalizado automaticamente.
                </p>
              )}
            </div>

            {focusDepthEnabled ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Profundidade focal</Label>
                  <span className="font-mono text-sm text-primary">
                    {(config.focusDepth ?? 2.5).toFixed(1)} cm
                  </span>
                </div>
                <Slider
                  value={[config.focusDepth ?? 2.5]}
                  onValueChange={(v) => handleFocusDepthChange(v[0])}
                  min={focusDepthRange.min}
                  max={focusDepthRange.max}
                  step={focusDepthRange.step ?? 0.1}
                />
                {focusValidation.warning && (
                  <Alert variant="destructive" className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{focusValidation.warning}</AlertDescription>
                  </Alert>
                )}
                <p className="text-xs text-muted-foreground">
                  Mín. {FOCUS_DEPTH_ABSOLUTE_MIN} cm · útil até ~{scenarioMaxFocus.toFixed(1)} cm neste cenário
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-3">
                <Label className="text-muted-foreground">Profundidade focal</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Indisponível no modo plano não focalizado. Ative o perfil de feixe focalizado ou use um
                  aplicador convergente.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>ERA (cm²)</Label>
                <span className="font-mono text-sm text-primary">{config.era.toFixed(1)}</span>
              </div>
              <Slider
                value={[config.era]}
                onValueChange={(v) => updateConfig({ era: v[0] })}
                min={config.ranges.era.min}
                max={config.ranges.era.max}
                step={0.25}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Frequência (MHz)</Label>
                <span className="font-mono text-sm text-primary">{config.frequency.toFixed(1)}</span>
              </div>
              <Slider
                value={[config.frequency]}
                onValueChange={(v) => updateConfig({ frequency: v[0] })}
                min={config.ranges.frequency.min}
                max={config.ranges.frequency.max}
                step={0.1}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Defaults terapêuticos</CardTitle>
            <CardDescription>Parâmetros clínicos iniciais da sessão simulada</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Intensidade (W/cm²)</Label>
                <span className="font-mono text-sm">{config.intensity.toFixed(1)}</span>
              </div>
              <Slider
                value={[config.intensity]}
                onValueChange={(v) => updateConfig({ intensity: v[0] })}
                min={config.ranges.intensity.min}
                max={config.ranges.intensity.max}
                step={0.1}
              />
            </div>

            <div>
              <Label className="mb-2 block">Modo</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={config.mode === "continuous" ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateConfig({ mode: "continuous" })}
                >
                  Contínuo
                </Button>
                <Button
                  type="button"
                  variant={config.mode === "pulsed" ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateConfig({ mode: "pulsed" })}
                >
                  Pulsado
                </Button>
              </div>
            </div>

            {config.mode === "pulsed" && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Duty cycle (%)</Label>
                  <span className="font-mono text-sm">{config.dutyCycle}%</span>
                </div>
                <Slider
                  value={[config.dutyCycle]}
                  onValueChange={(v) => updateConfig({ dutyCycle: v[0] })}
                  min={config.ranges.dutyCycle.min}
                  max={config.ranges.dutyCycle.max}
                  step={5}
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Duração (min)</Label>
                <span className="font-mono text-sm">{config.duration}</span>
              </div>
              <Slider
                value={[config.duration]}
                onValueChange={(v) => updateConfig({ duration: v[0] })}
                min={config.ranges.duration.min}
                max={config.ranges.duration.max}
                step={1}
              />
            </div>

            <div>
              <Label className="mb-2 block">Acoplamento</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={config.coupling === "good" ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateConfig({ coupling: "good" })}
                >
                  Bom
                </Button>
                <Button
                  type="button"
                  variant={config.coupling === "poor" ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateConfig({ coupling: "poor" })}
                >
                  Ruim
                </Button>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Movimento</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={config.movement === "stationary" ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateConfig({ movement: "stationary" })}
                >
                  Parado
                </Button>
                <Button
                  type="button"
                  variant={config.movement === "scanning" ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateConfig({ movement: "scanning" })}
                >
                  Varredura
                </Button>
              </div>
            </div>

            <div>
              <Label>Perfil de perfusão tecidual</Label>
              <Select
                value={config.tissuePerfusionProfile}
                onValueChange={(v) => updateConfig({ tissuePerfusionProfile: v as TissuePerfusionProfile })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TISSUE_PERFUSION_PROFILE_LABELS) as TissuePerfusionProfile[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {TISSUE_PERFUSION_PROFILE_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-muted-foreground">
                Afeta temperatura simulada, rubor vascular no 3D (anatomia/térmico) e métricas de dissipação.
              </p>
            </div>
          </CardContent>
        </Card>
          </div>

          <div className="lg:sticky lg:top-6">
            <UltrasoundTherapyLabPreview config={config} />
          </div>
        </div>
      </TabsContent>

      {/* ── Tab: Student controls + ranges ── */}
      <TabsContent value="controls" className="mt-6 space-y-6">
        <TherapyStudentControlsPreview config={config} />

        <Card>
          <CardHeader>
            <CardTitle>Controles disponíveis ao aluno</CardTitle>
            <CardDescription>enabledControls — o que o aluno pode alterar durante o lab</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            {enabledSwitch("scenario", "enable-scenario", "Cenário anatômico", "Selecionar ombro, joelho, etc.")}
            {enabledSwitch("customThicknesses", "enable-custom-thicknesses", "Espessuras personalizadas", "Camadas no cenário custom", true)}
            {enabledSwitch("mixedLayer", "enable-mixed-layer", "Camada mista", "Ajuste osso/músculo no custom", false)}
            {enabledSwitch("transducerType", "enable-transducer-type", "Aplicador terapêutico", "Planar IEC 61689 ou focalizado IEC 61828", true)}
            {enabledSwitch("beamProfile", "enable-beam-profile", "Perfil do feixe", "Plano vs focalizado", true)}
            {enabledSwitch("focusDepth", "enable-focus-depth", "Profundidade focal", "Slider de foco quando aplicável", true)}
            {enabledSwitch("frequency", "enable-frequency", "Frequência", "MHz")}
            {enabledSwitch("era", "enable-era", "ERA", "Área efetiva cm²")}
            {enabledSwitch("mode", "enable-mode", "Modo", "Contínuo / pulsado")}
            {enabledSwitch("dutyCycle", "enable-duty-cycle", "Duty cycle", "Visível só se modo pulsado estiver habilitado")}
            {enabledSwitch("intensity", "enable-intensity", "Intensidade", "W/cm²")}
            {enabledSwitch("duration", "enable-duration", "Duração", "Minutos")}
            {enabledSwitch("tissuePerfusionProfile", "enable-perfusion", "Perfil de perfusão", "Circulação tecidual", true)}
            {enabledSwitch("coupling", "enable-coupling", "Acoplamento", "Qualidade do gel")}
            {enabledSwitch("movement", "enable-movement", "Movimento", "Parado / varredura")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Limites globais dos parâmetros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Frequência mín (MHz)</Label>
                <Input
                  type="number"
                  value={config.ranges.frequency.min}
                  onChange={(e) =>
                    updateConfig({
                      ranges: { ...config.ranges, frequency: { ...config.ranges.frequency, min: Number(e.target.value) } },
                    })
                  }
                  step={0.1}
                />
              </div>
              <div>
                <Label>Frequência máx (MHz)</Label>
                <Input
                  type="number"
                  value={config.ranges.frequency.max}
                  onChange={(e) =>
                    updateConfig({
                      ranges: { ...config.ranges, frequency: { ...config.ranges.frequency, max: Number(e.target.value) } },
                    })
                  }
                  step={0.1}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ERA mín (cm²)</Label>
                <Input
                  type="number"
                  value={config.ranges.era.min}
                  onChange={(e) =>
                    updateConfig({
                      ranges: { ...config.ranges, era: { ...config.ranges.era, min: Number(e.target.value) } },
                    })
                  }
                  step={0.25}
                />
              </div>
              <div>
                <Label>ERA máx (cm²)</Label>
                <Input
                  type="number"
                  value={config.ranges.era.max}
                  onChange={(e) =>
                    updateConfig({
                      ranges: { ...config.ranges, era: { ...config.ranges.era, max: Number(e.target.value) } },
                    })
                  }
                  step={0.25}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Referência clínica ERA: {ERA_CLINICAL_REFERENCE.typicalMin}–{ERA_CLINICAL_REFERENCE.typicalMax} cm²
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranges — profundidade focal e camadas custom</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <RangeMinMaxStepEditor
              label="Profundidade focal"
              range={focusDepthRange}
              unit="cm"
              absoluteMin={FOCUS_DEPTH_ABSOLUTE_MIN}
              absoluteMax={TOTAL_BLOCK_DEPTH}
              onChange={(focusDepth) =>
                updateConfig({ ranges: { ...config.ranges, focusDepth } })
              }
            />
            <RangeMinMaxStepEditor
              label="Pele (custom)"
              range={thicknessRanges.skin}
              unit="cm"
              onChange={(skin) =>
                updateConfig({
                  ranges: { ...config.ranges, customThicknesses: { ...thicknessRanges, skin } },
                })
              }
            />
            <RangeMinMaxStepEditor
              label="Gordura (custom)"
              range={thicknessRanges.fat}
              unit="cm"
              onChange={(fat) =>
                updateConfig({
                  ranges: { ...config.ranges, customThicknesses: { ...thicknessRanges, fat } },
                })
              }
            />
            <RangeMinMaxStepEditor
              label="Músculo (custom)"
              range={thicknessRanges.muscle}
              unit="cm"
              onChange={(muscle) =>
                updateConfig({
                  ranges: { ...config.ranges, customThicknesses: { ...thicknessRanges, muscle } },
                })
              }
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
