/**
 * Editor admin completo — Laboratório de Fotobiomodulação (PBM)
 */

import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  applyPhotobioScenario,
  PHOTOBIO_ANATOMY_LAYER_PRESETS,
  PHOTOBIO_APPLICATOR_LABELS,
  PHOTOBIO_SCENARIO_LABELS,
  PHOTOBIO_TARGET_TISSUE_LABELS,
  type PhotobioControlModes,
  type PhotobioLabConfig,
  type PhotobioNumericRange,
  type PhotobioScenarioKey,
} from "@/types/photobioLabConfig";
import type { PhotobioApplicatorType } from "@/components/labs/photobio/photobioApplicatorTypes";
import type { PhotobioViewerTab } from "@/config/photobioPresets";
import { PhotobioLabPreview } from "./PhotobioLabPreview";
import { PhotobioStudentControlsPreview } from "./PhotobioStudentControlsPreview";
import { Settings2, Sliders } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  adminLabConfigColumnClass,
  adminLabEditorGridClass,
  adminLabEditorGridTabClass,
  adminLabEditorTabsShellClass,
  adminLabPreviewColumnClass,
} from "@/components/admin/adminLabEditorLayout";

interface PhotobioLabConfigEditorProps {
  config: PhotobioLabConfig;
  onChange: (config: PhotobioLabConfig) => void;
  leadingContent?: ReactNode;
}

function RangeMinMaxStepEditor({
  label,
  range,
  onChange,
  unit,
}: {
  label: string;
  range: PhotobioNumericRange;
  onChange: (next: PhotobioNumericRange) => void;
  unit?: string;
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
            onChange={(e) => onChange({ ...range, min: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Máx</Label>
          <Input
            type="number"
            value={range.max}
            step={range.step ?? 0.1}
            onChange={(e) => onChange({ ...range, max: Number(e.target.value) })}
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

export function PhotobioLabConfigEditor({
  config,
  onChange,
  leadingContent,
}: PhotobioLabConfigEditorProps) {
  const updateConfig = (updates: Partial<PhotobioLabConfig>) => {
    onChange({ ...config, ...updates });
  };

  const updateControlMode = (key: keyof PhotobioControlModes, mode: PhotobioControlModes[typeof key]) => {
    updateConfig({
      controlModes: { ...config.controlModes, [key]: mode },
    });
  };

  const updateFeatureFlag = (key: keyof PhotobioLabConfig["featureFlags"], value: boolean) => {
    updateConfig({
      featureFlags: { ...config.featureFlags, [key]: value },
    });
  };

  const handleScenarioChange = (scenario: PhotobioScenarioKey) => {
    if (scenario === "custom") {
      updateConfig({ scenario: "custom" });
      return;
    }
    const patch = applyPhotobioScenario(scenario);
    onChange({ ...config, ...patch, scenario });
  };

  const controlModeRow = (
    key: keyof PhotobioControlModes,
    id: string,
    title: string,
    description: string,
  ) => {
    const mode = config.controlModes[key] ?? "show";
    return (
      <div key={key} className="space-y-2 rounded-md border px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={id} className="flex flex-col gap-0.5">
            <span className="font-medium">{title}</span>
            <span className="text-xs font-normal text-muted-foreground">{description}</span>
          </Label>
          <Switch
            id={id}
            checked={mode === "show"}
            onCheckedChange={(checked) => updateControlMode(key, checked ? "show" : "hidden")}
          />
        </div>
        {mode !== "show" && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "hidden" ? "default" : "outline"}
              onClick={() => updateControlMode(key, "hidden")}
            >
              Ocultar
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "disabled" ? "default" : "outline"}
              onClick={() => updateControlMode(key, "disabled")}
            >
              Desabilitar
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Tabs defaultValue="defaults" className={cn("w-full", adminLabEditorTabsShellClass)}>
      <TabsList className="mb-6 grid w-full shrink-0 grid-cols-2">
        <TabsTrigger value="defaults" className="flex items-center gap-2">
          <Sliders className="h-4 w-4" />
          Defaults
        </TabsTrigger>
        <TabsTrigger value="controls" className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Controles do Aluno
        </TabsTrigger>
      </TabsList>

      <TabsContent value="defaults" className={adminLabEditorGridTabClass}>
        <div className={adminLabEditorGridClass}>
          <div className={adminLabConfigColumnClass}>
            {leadingContent}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cenário pedagógico</CardTitle>
                <CardDescription>Presets clínico-educacionais — aplica defaults ao lab</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={config.scenario} onValueChange={(v) => handleScenarioChange(v as PhotobioScenarioKey)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PHOTOBIO_SCENARIO_LABELS) as PhotobioScenarioKey[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {PHOTOBIO_SCENARIO_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selecionar um cenário sobrescreve wavelength, dose, anatomia e aba inicial sugerida.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Parâmetros ópticos iniciais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-2 block">Comprimento de onda</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={config.wavelength === 660 ? "default" : "outline"}
                      onClick={() => updateConfig({ wavelength: 660 })}
                    >
                      660 nm
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={config.wavelength === 808 ? "default" : "outline"}
                      onClick={() => updateConfig({ wavelength: 808 })}
                    >
                      808 nm
                    </Button>
                  </div>
                </div>

                <SliderField
                  label="Potência"
                  value={config.power}
                  range={config.ranges.power}
                  unit=" mW"
                  onChange={(v) => updateConfig({ power: v })}
                />
                <SliderField
                  label="Área do spot"
                  value={config.spotSize}
                  range={config.ranges.spotSize}
                  unit=" cm²"
                  decimals={2}
                  onChange={(v) => updateConfig({ spotSize: v })}
                />
                <SliderField
                  label="Tempo de exposição"
                  value={config.exposureTime}
                  range={config.ranges.exposureTime}
                  unit=" s"
                  onChange={(v) => updateConfig({ exposureTime: v })}
                />

                <div>
                  <Label className="mb-2 block">Modo</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={config.mode === "CW" ? "default" : "outline"}
                      onClick={() => updateConfig({ mode: "CW" })}
                    >
                      CW
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={config.mode === "Pulsed" ? "default" : "outline"}
                      onClick={() => updateConfig({ mode: "Pulsed" })}
                    >
                      Pulsed
                    </Button>
                  </div>
                </div>

                {config.mode === "Pulsed" && (
                  <SliderField
                    label="Duty cycle"
                    value={config.dutyCycle}
                    range={config.ranges.dutyCycle}
                    unit=" %"
                    onChange={(v) => updateConfig({ dutyCycle: v })}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Técnica e aplicador</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SliderField
                  label="Ângulo do transdutor"
                  value={config.transducerAngle}
                  range={config.ranges.transducerAngle}
                  unit="°"
                  onChange={(v) => updateConfig({ transducerAngle: v })}
                />
                <SliderField
                  label="Pressão de contato"
                  value={config.contactPressure}
                  range={config.ranges.contactPressure}
                  unit=" %"
                  onChange={(v) => updateConfig({ contactPressure: v })}
                />

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label>Simular varredura (scanning)</Label>
                  <Switch
                    checked={config.isDragging}
                    onCheckedChange={(checked) => updateConfig({ isDragging: checked })}
                  />
                </div>

                {config.isDragging && (
                  <SliderField
                    label="Velocidade relativa de varredura"
                    value={config.draggingSpeed}
                    range={{ min: 0.2, max: 5, step: 0.1 }}
                    onChange={(v) => updateConfig({ draggingSpeed: v })}
                  />
                )}

                <div>
                  <Label className="mb-2 block">Tipo de aplicador</Label>
                  <Select
                    value={config.applicatorType}
                    onValueChange={(v) => updateConfig({ applicatorType: v as PhotobioApplicatorType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PHOTOBIO_APPLICATOR_LABELS) as PhotobioApplicatorType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {PHOTOBIO_APPLICATOR_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Anatomia e alvo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-2 block">Preset anatômico</Label>
                  <Select
                    value={config.anatomyPreset}
                    onValueChange={(v) => {
                      const preset = v as PhotobioLabConfig["anatomyPreset"];
                      updateConfig({
                        anatomyPreset: preset,
                        layerConfig: { ...PHOTOBIO_ANATOMY_LAYER_PRESETS[preset] },
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Padrão</SelectItem>
                      <SelectItem value="elderly">Idoso</SelectItem>
                      <SelectItem value="athlete">Atleta</SelectItem>
                      <SelectItem value="obese">Obeso</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {config.anatomyPreset === "custom" && (
                  <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                    {(
                      [
                        ["epidermisMm", "Epiderme"],
                        ["dermisMm", "Derme"],
                        ["adiposeMm", "Adiposo"],
                        ["muscleMm", "Músculo"],
                      ] as const
                    ).map(([key, label]) => (
                      <SliderField
                        key={key}
                        label={label}
                        value={config.layerConfig[key]}
                        range={config.ranges.layerThickness[key]}
                        unit=" mm"
                        decimals={1}
                        onChange={(v) =>
                          updateConfig({
                            layerConfig: { ...config.layerConfig, [key]: v },
                          })
                        }
                      />
                    ))}
                  </div>
                )}

                <SliderField
                  label="Índice de melanina (pele)"
                  value={config.skinMelaninIndex}
                  range={config.ranges.skinMelaninIndex}
                  unit=""
                  decimals={2}
                  onChange={(v) => updateConfig({ skinMelaninIndex: v })}
                />

                <div>
                  <Label className="mb-2 block">Tecido-alvo pedagógico</Label>
                  <Select
                    value={config.targetTissue}
                    onValueChange={(v) =>
                      updateConfig({ targetTissue: v as PhotobioLabConfig["targetTissue"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PHOTOBIO_TARGET_TISSUE_LABELS) as PhotobioLabConfig["targetTissue"][]).map(
                        (t) => (
                          <SelectItem key={t} value={t}>
                            {PHOTOBIO_TARGET_TISSUE_LABELS[t]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Experiência inicial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-2 block">Aba inicial do viewer</Label>
                  <Select
                    value={config.viewerTab}
                    onValueChange={(v) => updateConfig({ viewerTab: v as PhotobioViewerTab })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anatomy">Anatomia</SelectItem>
                      <SelectItem value="beam">Feixe</SelectItem>
                      <SelectItem value="fluence">Fluência</SelectItem>
                      <SelectItem value="penetration">Penetração</SelectItem>
                      <SelectItem value="bioresponse">Resposta biológica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-2 block">Modo inicial do lab</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={config.initialLabMode === "free" ? "default" : "outline"}
                      onClick={() => updateConfig({ initialLabMode: "free" })}
                    >
                      Livre
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={config.initialLabMode === "guided" ? "default" : "outline"}
                      onClick={() => updateConfig({ initialLabMode: "guided" })}
                    >
                      Guiado
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className={adminLabPreviewColumnClass}>
            <PhotobioLabPreview config={config} />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="controls" className="mt-6 space-y-6">
        <PhotobioStudentControlsPreview config={config} />

        <Card>
          <CardHeader>
            <CardTitle>Controles disponíveis ao aluno</CardTitle>
            <CardDescription>controlModes — show / hidden / disabled</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {controlModeRow("showWavelength", "cm-wl", "Comprimento de onda", "660 vs 808 nm")}
            {controlModeRow("showPower", "cm-power", "Potência", "mW")}
            {controlModeRow("showSpotSize", "cm-spot", "Área do spot", "cm²")}
            {controlModeRow("showExposureTime", "cm-time", "Tempo de exposição", "segundos")}
            {controlModeRow("showMode", "cm-mode", "Modo CW/Pulsed", "Contínuo ou pulsado")}
            {controlModeRow("showDutyCycle", "cm-duty", "Duty cycle", "Modo pulsado")}
            {controlModeRow("showTechnique", "cm-tech", "Técnica", "Ângulo, pressão, varredura")}
            {controlModeRow("showAnatomyPresets", "cm-anat", "Presets anatômicos", "Padrão, idoso, atleta, obeso")}
            {controlModeRow("showCustomAnatomy", "cm-custom-anat", "Anatomia customizada", "Espessuras por camada")}
            {controlModeRow("showMelanin", "cm-melanin", "Melanina", "Índice de absorção superficial")}
            {controlModeRow("showApplicatorType", "cm-applicator", "Aplicador", "Cluster, laser, painel")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Funcionalidades pedagógicas</CardTitle>
            <CardDescription>featureFlags — módulos visíveis no lab</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(
              [
                ["showGuidedMode", "Modo guiado e desafios", "Painel de desafios, coach e pontuação"],
                ["showSnapshots", "Snapshots A/B", "Salvar, timeline e comparação"],
                ["showAdvancedPhysics", "Física avançada", "Perfil de profundidade e breakdown técnico"],
                ["showClinicalPresets", "Presets clínicos", "Cards de cenários no painel do aluno"],
              ] as const
            ).map(([key, title, desc]) => (
              <div key={key} className="flex items-center justify-between border-b pb-3 last:border-0">
                <Label className="flex flex-col gap-0.5">
                  <span>{title}</span>
                  <span className="text-xs font-normal text-muted-foreground">{desc}</span>
                </Label>
                <Switch
                  checked={config.featureFlags[key]}
                  onCheckedChange={(v) => updateFeatureFlag(key, v)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Limites globais dos parâmetros</CardTitle>
            <CardDescription>ranges — sliders do estudante respeitam estes limites</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RangeMinMaxStepEditor
              label="Potência"
              range={config.ranges.power}
              unit="mW"
              onChange={(power) => updateConfig({ ranges: { ...config.ranges, power } })}
            />
            <RangeMinMaxStepEditor
              label="Área do spot"
              range={config.ranges.spotSize}
              unit="cm²"
              onChange={(spotSize) => updateConfig({ ranges: { ...config.ranges, spotSize } })}
            />
            <RangeMinMaxStepEditor
              label="Tempo de exposição"
              range={config.ranges.exposureTime}
              unit="s"
              onChange={(exposureTime) => updateConfig({ ranges: { ...config.ranges, exposureTime } })}
            />
            <RangeMinMaxStepEditor
              label="Duty cycle"
              range={config.ranges.dutyCycle}
              unit="%"
              onChange={(dutyCycle) => updateConfig({ ranges: { ...config.ranges, dutyCycle } })}
            />
            <div className="grid grid-cols-2 gap-3">
              <RangeMinMaxStepEditor
                label="Ângulo min/max"
                range={config.ranges.transducerAngle}
                unit="°"
                onChange={(transducerAngle) =>
                  updateConfig({ ranges: { ...config.ranges, transducerAngle } })
                }
              />
              <RangeMinMaxStepEditor
                label="Pressão de contato"
                range={config.ranges.contactPressure}
                unit="%"
                onChange={(contactPressure) =>
                  updateConfig({ ranges: { ...config.ranges, contactPressure } })
                }
              />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Espessuras de camada (anatomia custom)</p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["epidermisMm", "Epiderme"],
                  ["dermisMm", "Derme"],
                  ["adiposeMm", "Adiposo"],
                  ["muscleMm", "Músculo"],
                ] as const
              ).map(([key, label]) => (
                <RangeMinMaxStepEditor
                  key={key}
                  label={label}
                  range={config.ranges.layerThickness[key]}
                  unit="mm"
                  onChange={(next) =>
                    updateConfig({
                      ranges: {
                        ...config.ranges,
                        layerThickness: { ...config.ranges.layerThickness, [key]: next },
                      },
                    })
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function SliderField({
  label,
  value,
  range,
  unit = "",
  decimals = 0,
  onChange,
}: {
  label: string;
  value: number;
  range: PhotobioNumericRange;
  unit?: string;
  decimals?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <Label>{label}</Label>
        <span className="font-mono text-sm text-primary">
          {value.toFixed(decimals)}
          {unit}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? value)}
        min={range.min}
        max={range.max}
        step={range.step ?? 0.1}
      />
    </div>
  );
}
