import { FunctionSquare, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import type { DynamicChartPresetMeta } from "@/types/dynamicChart";
import { resolvePresetMetaField } from "@/types/dynamicChart";

interface PresetClinicalEquationsPanelProps {
  presetMeta: DynamicChartPresetMeta;
}

export function PresetClinicalEquationsPanel({ presetMeta }: PresetClinicalEquationsPanelProps) {
  const { language } = useLanguage();
  const isEnglish = language === "en";

  return (
    <Card className="overflow-hidden border-slate-800/20 dark:border-slate-600/30">
      <CardHeader className="border-b bg-slate-950/[0.03] dark:bg-slate-950/40 pb-4">
        <CardTitle className="text-sm flex items-center gap-2 font-semibold">
          <FunctionSquare className="h-4 w-4 text-primary" />
          {isEnglish ? "Validated equations" : "Equações validadas"}
        </CardTitle>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {isEnglish
            ? "Computed by the ProGenia engine. Switch to custom formula to rewrite."
            : "Calculadas pelo motor ProGenia. Use fórmula livre para reescrever."}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="bg-slate-950 text-slate-100 dark:bg-black/80">
          <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2 text-[11px] uppercase tracking-wide text-slate-400">
            <Lock className="h-3 w-3" />
            {resolvePresetMetaField(presetMeta.title, language)}
          </div>
          <div className="space-y-0 divide-y divide-slate-800/80">
            {presetMeta.readonly_equations.map((equation, index) => (
              <pre
                key={`${presetMeta.id}-eq-${index}`}
                className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-emerald-300/95 whitespace-pre-wrap"
              >
                {equation}
              </pre>
            ))}
          </div>
        </div>
        {presetMeta.readonly_equations.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            {isEnglish ? "No equations for this model." : "Sem equações para este modelo."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
