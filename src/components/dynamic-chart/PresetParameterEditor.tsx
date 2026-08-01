import { Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import type { DynamicChartParameter, MaybeI18nText } from "@/types/dynamicChart";
import { MaybeI18nTextField } from "./MaybeI18nTextField";

interface PresetParameterEditorProps {
  parameters: DynamicChartParameter[];
  onUpdate: (parameterId: string, patch: Partial<DynamicChartParameter>) => void;
}

export function PresetParameterEditor({ parameters, onUpdate }: PresetParameterEditorProps) {
  const { language } = useLanguage();
  const isEnglish = language === "en";

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed flex gap-2">
        <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <span>
          {isEnglish
            ? "Parameter IDs are fixed for the clinical engine. You can edit label, unit, range, step, and default."
            : "IDs fixos para o motor clínico. Edite rótulo, unidade, faixa, step e valor padrão."}
        </span>
      </div>

      {parameters.map((param) => (
        <div key={param.id} className="rounded-xl border p-3 space-y-2 bg-muted/10">
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[180px]">
              <MaybeI18nTextField
                label={isEnglish ? "Label" : "Rótulo"}
                value={param.name}
                onChange={(name: MaybeI18nText) => onUpdate(param.id, { name })}
              />
            </div>
            <div className="w-32 space-y-1">
              <Label className="text-xs flex items-center gap-1">
                ID
                <Lock className="h-3 w-3 text-muted-foreground" />
              </Label>
              <Input value={param.id} disabled className="font-mono text-xs bg-muted" />
            </div>
            <div className="w-24 space-y-1">
              <Label className="text-xs">{isEnglish ? "Unit" : "Unidade"}</Label>
              <Input
                value={param.unit ?? ""}
                onChange={(e) => onUpdate(param.id, { unit: e.target.value || undefined })}
                className="text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">Min</Label>
              <Input
                type="number"
                value={param.min}
                onChange={(e) => onUpdate(param.id, { min: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs">Max</Label>
              <Input
                type="number"
                value={param.max}
                onChange={(e) => onUpdate(param.id, { max: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs">Step</Label>
              <Input
                type="number"
                value={param.step}
                onChange={(e) => onUpdate(param.id, { step: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs">{isEnglish ? "Default" : "Padrão"}</Label>
              <Input
                type="number"
                value={param.defaultValue}
                onChange={(e) =>
                  onUpdate(param.id, { defaultValue: Number(e.target.value) })
                }
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
