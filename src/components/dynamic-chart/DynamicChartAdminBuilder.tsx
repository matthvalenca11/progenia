import { useMemo, useState } from "react";
import {
  Axis3D,
  Lock,
  MessageSquare,
  Plus,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  patchPresetFeedbackPresentation,
  patchPresetParameter,
  patchPresetPresentation,
} from "@/lib/dynamicChart/presetGuard";
import {
  applyClinicalPreset,
  ejectPresetToCustomFormula,
  getPresetCatalogEntry,
  restorePresetDefaults,
  switchSourceType,
} from "@/lib/dynamicChart/presets";
import type {
  AxisScaleMode,
  ConditionalFeedbackRule,
  DynamicChartAxis,
  DynamicChartBlockData,
  DynamicChartFeedbackDisplayMode,
  DynamicChartFormulaSeries,
  DynamicChartParameter,
  DynamicChartPresetId,
  DynamicChartSourceType,
} from "@/types/dynamicChart";
import {
  createI18nText,
  DEFAULT_DYNAMIC_CHART_PRESET_ID,
  isPresetMode,
  resolveI18nText,
  resolvePresetMetaField,
} from "@/types/dynamicChart";
import { CustomFormulasEditor } from "./CustomFormulasEditor";
import { MaybeI18nTextField } from "./MaybeI18nTextField";
import { PresetClinicalEquationsPanel } from "./PresetClinicalEquationsPanel";
import { PresetParameterEditor } from "./PresetParameterEditor";
import { PresetSelectorDialog } from "./PresetSelectorDialog";
import { PresetSummaryCard } from "./PresetSummaryCard";
import { PresetSwitchConfirmDialog } from "./PresetSwitchConfirmDialog";
import { DynamicChartViewer } from "./DynamicChartViewer";

interface DynamicChartAdminBuilderProps {
  value: DynamicChartBlockData;
  onChange: (next: DynamicChartBlockData) => void;
}

const FORMULA_COLORS = [
  "hsl(var(--primary))",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#ef4444",
];

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-mono">{value || "—"}</div>
    </div>
  );
}

function AxisEditor({
  title,
  axis,
  onChange,
  readOnly = false,
}: {
  title: string;
  axis: DynamicChartAxis;
  onChange: (next: DynamicChartAxis) => void;
  readOnly?: boolean;
}) {
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const patch = (partial: Partial<DynamicChartAxis>) => onChange({ ...axis, ...partial });

  if (readOnly) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {title}
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <ReadOnlyField label="Rótulo" value={resolveI18nText(axis.label, language)} />
          <ReadOnlyField label="Unidade" value={axis.unit ?? ""} />
          <ReadOnlyField label="Modo de escala" value={axis.scaleMode} />
          <ReadOnlyField label="Mínimo" value={axis.min != null ? String(axis.min) : "auto"} />
          <ReadOnlyField label="Máximo" value={axis.max != null ? String(axis.max) : "auto"} />
          {title.startsWith("Eixo X") && (
            <ReadOnlyField
              label="Pontos amostrados"
              value={String(axis.sampleCount ?? 120)}
            />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <MaybeI18nTextField
            label={isEnglish ? "Axis label" : "Rótulo do eixo"}
            value={axis.label}
            onChange={(label) => patch({ label })}
            placeholder={isEnglish ? "Pulse width" : "Largura do pulso"}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Unidade</Label>
          <Input
            value={axis.unit ?? ""}
            onChange={(e) => patch({ unit: e.target.value || undefined })}
            placeholder="mmHg, mA, %..."
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Modo de escala</Label>
          <Select
            value={axis.scaleMode}
            onValueChange={(v) => patch({ scaleMode: v as AxisScaleMode })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixo</SelectItem>
              <SelectItem value="auto">Automático</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Mínimo</Label>
          <Input
            type="number"
            value={axis.min ?? ""}
            onChange={(e) =>
              patch({ min: e.target.value === "" ? undefined : Number(e.target.value) })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Máximo</Label>
          <Input
            type="number"
            value={axis.max ?? ""}
            onChange={(e) =>
              patch({ max: e.target.value === "" ? undefined : Number(e.target.value) })
            }
          />
        </div>
        {title.startsWith("Eixo X") && (
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Amostras no eixo X</Label>
            <Input
              type="number"
              min={20}
              max={500}
              value={axis.sampleCount ?? 120}
              onChange={(e) => patch({ sampleCount: Number(e.target.value) || 120 })}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DynamicChartAdminBuilder({ value, onChange }: DynamicChartAdminBuilderProps) {
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const [activeTab, setActiveTab] = useState("general");
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [importPresetDialogOpen, setImportPresetDialogOpen] = useState(false);
  const [switchConfirmOpen, setSwitchConfirmOpen] = useState(false);
  const [pendingPresetId, setPendingPresetId] = useState<DynamicChartPresetId | null>(null);
  const presetLocked = isPresetMode(value);
  const presetMeta = value.preset_id ? getPresetCatalogEntry(value.preset_id) : undefined;

  const patchCustom = (partial: Partial<DynamicChartBlockData>) => {
    onChange({ ...value, ...partial });
  };

  const patchPresentation = (
    partial: Partial<
      Pick<DynamicChartBlockData, "title" | "subtitle" | "description" | "feedbackDisplayMode">
    >,
  ) => {
    onChange(patchPresetPresentation(value, partial));
  };

  const setSourceType = (source_type: DynamicChartSourceType) => {
    onChange(switchSourceType(value, source_type));
  };

  const handleApplyPreset = (presetId: DynamicChartPresetId) => {
    if (value.preset_id === presetId) {
      setPresetDialogOpen(false);
      return;
    }
    setPendingPresetId(presetId);
    setPresetDialogOpen(false);
    setSwitchConfirmOpen(true);
  };

  const confirmPresetSwitch = (preserveAxesAndFeedbacks: boolean) => {
    if (!pendingPresetId) return;
    onChange(
      applyClinicalPreset(value, pendingPresetId, {
        preservePresentation: true,
        preserveAxesAndFeedbacks,
      }),
    );
    setPendingPresetId(null);
    setSwitchConfirmOpen(false);
  };

  const handleRestorePresetDefaults = () => {
    onChange(restorePresetDefaults(value));
  };

  const handleImportPresetToCustom = (presetId: DynamicChartPresetId) => {
    onChange(ejectPresetToCustomFormula(value, presetId));
    setImportPresetDialogOpen(false);
    setActiveTab("formulas");
  };

  const formulas = value.formulas ?? [];

  const updateFormula = (index: number, partial: Partial<DynamicChartFormulaSeries>) => {
    patchCustom({
      formulas: formulas.map((f, i) => (i === index ? { ...f, ...partial } : f)),
    });
  };

  const addFormula = () => {
    const index = formulas.length;
    patchCustom({
      formulas: [
        ...formulas,
        {
          id: `series_${Date.now()}`,
          name: createI18nText(`Curva ${index + 1}`, `Curve ${index + 1}`),
          equation: "",
          color: FORMULA_COLORS[index % FORMULA_COLORS.length],
          thickness: 2.5,
        },
      ],
    });
    setActiveTab("formulas");
  };

  const removeFormula = (index: number) => {
    patchCustom({ formulas: formulas.filter((_, i) => i !== index) });
  };

  const updateParameter = (index: number, partial: Partial<DynamicChartParameter>) => {
    const param = value.parameters[index];
    if (!param) return;

    if (presetLocked) {
      if ("id" in partial && partial.id !== param.id) return;
      const { id: _ignored, ...safePatch } = partial;
      onChange(patchPresetParameter(value, param.id, safePatch));
      return;
    }

    patchCustom({
      parameters: value.parameters.map((p, i) => (i === index ? { ...p, ...partial } : p)),
    });
  };

  const addParameter = () => {
    const id = `param_${Date.now()}`;
    patchCustom({
      parameters: [
        ...value.parameters,
        { id, name: createI18nText("Novo parâmetro", "New parameter"), min: 0, max: 10, step: 0.1, defaultValue: 1 },
      ],
    });
    setActiveTab("parameters");
  };

  const removeParameter = (index: number) => {
    patchCustom({ parameters: value.parameters.filter((_, i) => i !== index) });
  };

  const updateFeedback = (index: number, partial: Partial<ConditionalFeedbackRule>) => {
    const rule = value.conditionalFeedbacks[index];
    if (!rule) return;

    if (presetLocked) {
      const { feedbackText, markdown, type, priority } = partial;
      onChange(
        patchPresetFeedbackPresentation(value, rule.id, {
          feedbackText,
          markdown,
          type,
          priority,
        }),
      );
      return;
    }

    patchCustom({
      conditionalFeedbacks: value.conditionalFeedbacks.map((f, i) =>
        i === index ? { ...f, ...partial } : f,
      ),
    });
  };

  const addFeedback = () => {
    if (presetLocked) return;
    patchCustom({
      conditionalFeedbacks: [
        ...value.conditionalFeedbacks,
        {
          id: `fb_${Date.now()}`,
          condition: "",
          feedbackText: createI18nText(
            "Texto em **markdown**.",
            "**Markdown** text.",
          ),
          type: "info",
          priority: 1,
        },
      ],
    });
    setActiveTab("feedbacks");
  };

  const removeFeedback = (index: number) => {
    if (presetLocked) return;
    patchCustom({
      conditionalFeedbacks: value.conditionalFeedbacks.filter((_, i) => i !== index),
    });
  };

  const updateAxis = (axisKey: "x" | "y", axis: DynamicChartAxis) => {
    if (presetLocked) return;
    patchCustom({ axes: { ...value.axes, [axisKey]: axis } });
  };

  const previewConfig = useMemo(() => value, [value]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <Card className="min-w-0">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>
              {isEnglish ? "Chart configuration" : "Configuração do gráfico"}
            </CardTitle>
            <CardDescription>
              {isEnglish
                ? "Clinical models lock IDs and equations. Custom mode allows full editing."
                : "Modelos clínicos travam IDs e equações. No modo livre, tudo é editável."}
            </CardDescription>
          </div>
          {presetLocked && value.preset_id && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={handleRestorePresetDefaults}
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              {isEnglish ? "Restore defaults" : "Restaurar padrão"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4 grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5">
              <TabsTrigger value="general" className="gap-1.5 text-xs sm:text-sm">
                <Settings2 className="h-3.5 w-3.5" />
                {isEnglish ? "General" : "Geral"}
              </TabsTrigger>
              <TabsTrigger value="axes" className="gap-1.5 text-xs sm:text-sm">
                <Axis3D className="h-3.5 w-3.5" />
                {isEnglish ? "Axes" : "Eixos"}
              </TabsTrigger>
              <TabsTrigger value="parameters" className="gap-1.5 text-xs sm:text-sm">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {isEnglish ? "Parameters" : "Parâmetros"}
              </TabsTrigger>
              <TabsTrigger value="formulas" className="gap-1.5 text-xs sm:text-sm">
                {isEnglish ? "Formulas" : "Fórmulas"}
              </TabsTrigger>
              <TabsTrigger value="feedbacks" className="gap-1.5 text-xs sm:text-sm">
                <MessageSquare className="h-3.5 w-3.5" />
                Feedbacks
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-5 mt-0">
              <div className="space-y-2">
                <Label>{isEnglish ? "Mode" : "Modo"}</Label>
                <ToggleGroup
                  type="single"
                  value={value.source_type}
                  onValueChange={(v) => v && setSourceType(v as DynamicChartSourceType)}
                  className="grid grid-cols-2 w-full rounded-xl bg-muted p-1"
                >
                  <ToggleGroupItem value="preset" className="rounded-lg data-[state=on]:bg-background">
                    {isEnglish ? "Clinical model" : "Modelo clínico"}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="custom_formula"
                    className="rounded-lg data-[state=on]:bg-background"
                  >
                    {isEnglish ? "Custom formula" : "Fórmula livre"}
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {value.source_type === "preset" && value.preset_id && (
                <>
                  <PresetSummaryCard
                    presetId={value.preset_id}
                    onChangeModel={() => setPresetDialogOpen(true)}
                    onRestoreDefaults={handleRestorePresetDefaults}
                  />
                  <PresetSelectorDialog
                    open={presetDialogOpen}
                    onOpenChange={setPresetDialogOpen}
                    selectedPresetId={value.preset_id}
                    onApplyPreset={handleApplyPreset}
                  />
                  <PresetSwitchConfirmDialog
                    open={switchConfirmOpen}
                    onOpenChange={(open) => {
                      setSwitchConfirmOpen(open);
                      if (!open) setPendingPresetId(null);
                    }}
                    targetPresetId={pendingPresetId}
                    onConfirm={confirmPresetSwitch}
                  />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isEnglish
                      ? "Fixed IDs and equations. Edit student-facing text below."
                      : "IDs e equações fixos. Edite o texto ao aluno abaixo."}
                  </p>
                </>
              )}

              {value.source_type === "custom_formula" && (
                <div className="flex flex-col gap-3 rounded-lg border border-dashed border-blue-500/30 bg-blue-500/5 px-4 py-3">
                  <Badge className="w-fit bg-blue-600/10 text-blue-700 hover:bg-blue-600/10 dark:text-blue-300">
                    {isEnglish ? "Custom mode" : "Modo livre"}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {isEnglish
                      ? "Editable axes, parameters, formulas, and feedback rules."
                      : "Eixos, parâmetros, fórmulas e feedbacks editáveis."}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() => setImportPresetDialogOpen(true)}
                  >
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    {isEnglish ? "Import clinical model" : "Importar modelo clínico"}
                  </Button>
                  <PresetSelectorDialog
                    open={importPresetDialogOpen}
                    onOpenChange={setImportPresetDialogOpen}
                    selectedPresetId={DEFAULT_DYNAMIC_CHART_PRESET_ID}
                    onApplyPreset={handleImportPresetToCustom}
                    variant="import_to_custom"
                  />
                </div>
              )}

              <div className="space-y-3 pt-1">
                <div className="border-t pt-4">
                  <p className="text-sm font-semibold text-foreground">
                    {isEnglish ? "Student copy" : "Texto ao aluno"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                    {isEnglish
                      ? "Shown in lessons, capsules, and the public chart page."
                      : "Aparece em aulas, cápsulas e na página pública do gráfico."}
                  </p>
                </div>
                <MaybeI18nTextField
                  label={isEnglish ? "Title" : "Título"}
                  value={value.title}
                  onChange={(title) => patchPresentation({ title })}
                />
                <MaybeI18nTextField
                  label={isEnglish ? "Subtitle" : "Subtítulo"}
                  value={value.subtitle}
                  onChange={(subtitle) => patchPresentation({ subtitle })}
                />
                <MaybeI18nTextField
                  label={isEnglish ? "Description" : "Descrição"}
                  value={value.description}
                  onChange={(description) => patchPresentation({ description })}
                  multiline
                  rows={3}
                  placeholder={
                    isEnglish
                      ? "Context above the chart"
                      : "Contexto acima do gráfico"
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="axes" className="space-y-4 mt-0">
              {presetLocked && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  {isEnglish
                    ? "Axes set by the clinical model. Read only."
                    : "Eixos definidos pelo modelo clínico. Somente leitura."}
                </p>
              )}
              <AxisEditor
                title="Eixo X"
                axis={value.axes.x}
                onChange={(axis) => updateAxis("x", axis)}
                readOnly={presetLocked}
              />
              <AxisEditor
                title="Eixo Y"
                axis={value.axes.y}
                onChange={(axis) => updateAxis("y", axis)}
                readOnly={presetLocked}
              />
            </TabsContent>

            <TabsContent value="parameters" className="space-y-3 mt-0">
              {presetLocked ? (
                <PresetParameterEditor
                  parameters={value.parameters}
                  onUpdate={(parameterId, patch) =>
                    onChange(patchPresetParameter(value, parameterId, patch))
                  }
                />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {isEnglish ? "Parameters" : "Parâmetros"} ({value.parameters.length})
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={addParameter}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> {isEnglish ? "Add" : "Adicionar"}
                    </Button>
                  </div>
                  {value.parameters.length === 0 && (
                    <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
                      {isEnglish ? "No parameters yet" : "Nenhum parâmetro ainda"}
                    </p>
                  )}
                  {value.parameters.map((param, i) => (
                    <div key={param.id} className="rounded-xl border p-3 space-y-2">
                      <div className="flex flex-wrap gap-2 items-start">
                        <div className="flex-1 min-w-[180px]">
                          <MaybeI18nTextField
                            label={isEnglish ? "Name" : "Nome"}
                            value={param.name}
                            onChange={(name) => updateParameter(i, { name })}
                          />
                        </div>
                        <Input
                          placeholder="id"
                          value={param.id}
                          onChange={(e) =>
                            updateParameter(i, { id: e.target.value.replace(/\s/g, "_") })
                          }
                          className="w-28 font-mono text-xs"
                        />
                        <Input
                          placeholder="unidade"
                          value={param.unit ?? ""}
                          onChange={(e) => updateParameter(i, { unit: e.target.value || undefined })}
                          className="w-20 text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeParameter(i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <Label className="text-xs">Min</Label>
                          <Input
                            type="number"
                            value={param.min}
                            onChange={(e) => updateParameter(i, { min: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Max</Label>
                          <Input
                            type="number"
                            value={param.max}
                            onChange={(e) => updateParameter(i, { max: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Step</Label>
                          <Input
                            type="number"
                            value={param.step}
                            onChange={(e) => updateParameter(i, { step: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">{isEnglish ? "Default" : "Padrão"}</Label>
                          <Input
                            type="number"
                            value={param.defaultValue}
                            onChange={(e) =>
                              updateParameter(i, { defaultValue: Number(e.target.value) })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </TabsContent>

            <TabsContent value="formulas" className="space-y-3 mt-0">
              {presetLocked && presetMeta ? (
                <PresetClinicalEquationsPanel presetMeta={presetMeta} />
              ) : value.source_type !== "custom_formula" ? (
                <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4">
                  {isEnglish
                    ? 'Switch to "Custom formula" under General to edit curves.'
                    : 'Ative "Fórmula livre" na aba Geral para editar curvas.'}
                </p>
              ) : (
                <CustomFormulasEditor
                  formulas={formulas}
                  parameters={value.parameters}
                  onAdd={addFormula}
                  onUpdate={updateFormula}
                  onRemove={removeFormula}
                />
              )}
            </TabsContent>

            <TabsContent value="feedbacks" className="space-y-3 mt-0">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {isEnglish ? "Display" : "Exibição"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={value.feedbackDisplayMode ?? "highest_priority"}
                    onValueChange={(v) =>
                      patchPresentation({ feedbackDisplayMode: v as DynamicChartFeedbackDisplayMode })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="highest_priority">
                        {isEnglish ? "Highest priority" : "Maior prioridade"}
                      </SelectItem>
                      <SelectItem value="all_active">
                        {isEnglish ? "All active" : "Todos os ativos"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {isEnglish ? "Rules" : "Regras"} ({value.conditionalFeedbacks.length})
                </p>
                {!presetLocked && (
                  <Button type="button" variant="outline" size="sm" onClick={addFeedback}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> {isEnglish ? "Rule" : "Regra"}
                  </Button>
                )}
              </div>

              {presetLocked && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  {isEnglish
                    ? "Fixed conditions. Edit text, type, and priority."
                    : "Condições fixas. Edite texto, tipo e prioridade."}
                </p>
              )}

              {value.conditionalFeedbacks.map((fb, i) => (
                <div key={fb.id} className="rounded-xl border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs shrink-0 font-semibold">SE</Label>
                    {presetLocked ? (
                      <div className="flex-1 rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs">
                        {fb.condition}
                      </div>
                    ) : (
                      <Input
                        placeholder="rheobase > 20 && chronaxie < 0.5"
                        value={fb.condition}
                        onChange={(e) => updateFeedback(i, { condition: e.target.value })}
                        className="font-mono text-xs"
                      />
                    )}
                    <Input
                      type="number"
                      min={1}
                      value={fb.priority ?? 1}
                      onChange={(e) => updateFeedback(i, { priority: Number(e.target.value) })}
                      className="w-16"
                      title={isEnglish ? "Priority" : "Prioridade"}
                    />
                    {!presetLocked && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFeedback(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <MaybeI18nTextField
                    label={isEnglish ? "Feedback" : "Feedback"}
                    value={fb.feedbackText ?? fb.markdown}
                    onChange={(feedbackText) => updateFeedback(i, { feedbackText })}
                    multiline
                    rows={2}
                    placeholder={isEnglish ? "Markdown" : "Markdown"}
                  />
                  <Select
                    value={fb.type}
                    onValueChange={(v) =>
                      updateFeedback(i, { type: v as ConditionalFeedbackRule["type"] })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">{isEnglish ? "Warning" : "Aviso"}</SelectItem>
                      <SelectItem value="success">{isEnglish ? "Success" : "Sucesso"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="xl:sticky xl:top-4 xl:self-start min-w-0">
        <Label className="mb-2 block text-sm font-medium">
          {isEnglish ? "Preview" : "Prévia"}
        </Label>
        <DynamicChartViewer config={previewConfig} compact />
      </div>
    </div>
  );
}
