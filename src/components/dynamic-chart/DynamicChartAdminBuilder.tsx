import { useMemo } from "react";
import {
  Activity,
  Bell,
  LineChart,
  Plus,
  Trash2,
  TrendingDown,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  ConditionalFeedbackRule,
  DynamicChartBlockData,
  DynamicChartParameter,
  DynamicChartPresetId,
  DynamicChartSourceType,
} from "@/types/dynamicChart";
import {
  PRESET_CATALOG,
  buildPresetBlockData,
  createEmptyCustomBlock,
} from "@/lib/dynamicChart/presets";
import { hasValidFormulaSyntax } from "@/lib/dynamicChart/formulaEngine";
import { DynamicChartViewer } from "./DynamicChartViewer";

interface DynamicChartAdminBuilderProps {
  value: DynamicChartBlockData;
  onChange: (next: DynamicChartBlockData) => void;
}

const PRESET_ICONS = {
  curve: LineChart,
  bell: Bell,
  decay: TrendingDown,
  sigmoid: Activity,
} as const;

export function DynamicChartAdminBuilder({ value, onChange }: DynamicChartAdminBuilderProps) {
  const patch = (partial: Partial<DynamicChartBlockData>) => onChange({ ...value, ...partial });
  const customExpression = value.formulas?.[0]?.expression ?? "";
  const hasFormulaError =
    value.source_type === "custom_formula" && !hasValidFormulaSyntax(customExpression);

  const setSourceType = (source_type: DynamicChartSourceType) => {
    if (source_type === "custom_formula") {
      onChange(createEmptyCustomBlock());
    } else {
      onChange(buildPresetBlockData("tens_strength_duration"));
    }
  };

  const selectPreset = (presetId: DynamicChartPresetId) => {
    onChange(buildPresetBlockData(presetId));
  };

  const updateParameter = (index: number, partial: Partial<DynamicChartParameter>) => {
    const parameters = value.parameters.map((p, i) =>
      i === index ? { ...p, ...partial } : p,
    );
    patch({ parameters });
  };

  const addParameter = () => {
    const id = `param_${Date.now()}`;
    patch({
      parameters: [
        ...value.parameters,
        { id, name: "Novo parâmetro", min: 0, max: 10, step: 0.1, defaultValue: 1 },
      ],
    });
  };

  const removeParameter = (index: number) => {
    patch({ parameters: value.parameters.filter((_, i) => i !== index) });
  };

  const updateFeedback = (index: number, partial: Partial<ConditionalFeedbackRule>) => {
    const conditionalFeedbacks = value.conditionalFeedbacks.map((f, i) =>
      i === index ? { ...f, ...partial } : f,
    );
    patch({ conditionalFeedbacks });
  };

  const addFeedback = () => {
    patch({
      conditionalFeedbacks: [
        ...value.conditionalFeedbacks,
        {
          id: `fb_${Date.now()}`,
          condition: "",
          feedbackText: "Texto explicativo em **Markdown**.",
          type: "info",
          priority: 1,
        },
      ],
    });
  };

  const removeFeedback = (index: number) => {
    patch({ conditionalFeedbacks: value.conditionalFeedbacks.filter((_, i) => i !== index) });
  };

  const previewConfig = useMemo(() => value, [value]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Formulário */}
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        <div className="space-y-2">
          <Label>Modo do gráfico</Label>
          <ToggleGroup
            type="single"
            value={value.source_type}
            onValueChange={(v) => v && setSourceType(v as DynamicChartSourceType)}
            className="grid grid-cols-2 w-full rounded-xl bg-muted p-1"
          >
            <ToggleGroupItem value="preset" className="rounded-lg data-[state=on]:bg-background">
              Modelo clínico
            </ToggleGroupItem>
            <ToggleGroupItem value="custom_formula" className="rounded-lg data-[state=on]:bg-background">
              Fórmula customizada
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {value.source_type === "preset" && (
          <div className="space-y-2">
            <Label>Presets clínicos</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_CATALOG.map((preset) => {
                const Icon = PRESET_ICONS[preset.icon] ?? Waves;
                const selected = value.preset_id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => selectPreset(preset.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="rounded-lg bg-muted p-2">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{preset.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{preset.discipline}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Separator />

        <div className="grid gap-3">
          <div>
            <Label>Título</Label>
            <Input value={value.title} onChange={(e) => patch({ title: e.target.value })} />
          </div>
          <div>
            <Label>Subtítulo</Label>
            <Input value={value.subtitle ?? ""} onChange={(e) => patch({ subtitle: e.target.value })} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={value.description ?? ""}
              onChange={(e) => patch({ description: e.target.value })}
              rows={2}
            />
          </div>
        </div>

        {value.source_type === "custom_formula" && (
          <div className="space-y-2 rounded-xl border p-3">
            <Label>Fórmula (y = f(x))</Label>
            <Input
              placeholder="a * sin(x) + b"
              value={customExpression}
              onChange={(e) =>
                patch({
                  formulas: [
                    {
                      id: "series1",
                      label: value.formulas?.[0]?.label ?? "Série 1",
                      expression: e.target.value,
                      color: "hsl(var(--primary))",
                    },
                  ],
                })
              }
              aria-invalid={hasFormulaError}
              className={cn(hasFormulaError && "border-destructive focus-visible:ring-destructive")}
            />
            <p className="text-xs text-muted-foreground">
              Variáveis: <code>x</code> + ids dos parâmetros ({value.parameters.map((p) => p.id).join(", ")})
            </p>
            {hasFormulaError && (
              <p className="text-xs text-destructive">
                Fórmula incompleta ou inválida. A prévia será retomada quando a expressão estiver correta.
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Parâmetros (sliders)</Label>
            <Button type="button" variant="outline" size="sm" onClick={addParameter}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>
          {value.parameters.map((param, i) => (
            <div key={param.id} className="rounded-xl border p-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Nome"
                  value={param.name}
                  onChange={(e) => updateParameter(i, { name: e.target.value })}
                  className="flex-1"
                />
                <Input
                  placeholder="id"
                  value={param.id}
                  onChange={(e) => updateParameter(i, { id: e.target.value.replace(/\s/g, "_") })}
                  className="w-24 font-mono text-xs"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeParameter(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2">
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
                  <Label className="text-xs">Padrão</Label>
                  <Input
                    type="number"
                    value={param.defaultValue}
                    onChange={(e) => updateParameter(i, { defaultValue: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Feedbacks condicionais</Label>
            <Button type="button" variant="outline" size="sm" onClick={addFeedback}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Regra
            </Button>
          </div>
          {value.conditionalFeedbacks.map((fb, i) => (
            <div key={fb.id} className="rounded-xl border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs shrink-0">SE</Label>
                <Input
                  placeholder="rheobase > 20 && chronaxie < 0.5"
                  value={fb.condition}
                  onChange={(e) => updateFeedback(i, { condition: e.target.value })}
                  className="font-mono text-xs"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeFeedback(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                placeholder="Texto em Markdown..."
                value={fb.feedbackText}
                onChange={(e) => updateFeedback(i, { feedbackText: e.target.value })}
                rows={2}
              />
              <Select
                value={fb.type}
                onValueChange={(v) => updateFeedback(i, { type: v as ConditionalFeedbackRule["type"] })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Aviso</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      {/* Live Preview */}
      <div className="lg:sticky lg:top-4">
        <Label className="mb-2 block">Pré-visualização ao vivo</Label>
        <DynamicChartViewer config={previewConfig} compact />
      </div>
    </div>
  );
}
