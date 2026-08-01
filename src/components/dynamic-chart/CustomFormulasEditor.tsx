import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { hasValidFormulaSyntax, resolveFormulaExpression } from "@/lib/dynamicChart/formulaEngine";
import type { DynamicChartFormulaSeries, DynamicChartParameter } from "@/types/dynamicChart";
import { MaybeI18nTextField } from "./MaybeI18nTextField";
import { FormulaEquationInput, type FormulaEquationInputHandle } from "./FormulaEquationInput";

const FORMULA_COLORS = [
  "hsl(var(--primary))",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#ef4444",
];

interface CustomFormulasEditorProps {
  formulas: DynamicChartFormulaSeries[];
  parameters: DynamicChartParameter[];
  onAdd: () => void;
  onUpdate: (index: number, partial: Partial<DynamicChartFormulaSeries>) => void;
  onRemove: (index: number) => void;
}

export function CustomFormulasEditor({
  formulas,
  parameters,
  onAdd,
  onUpdate,
  onRemove,
}: CustomFormulasEditorProps) {
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const equationRefs = useRef<Array<FormulaEquationInputHandle | null>>([]);
  const [activeFormulaIndex, setActiveFormulaIndex] = useState(0);

  const snippets = ["x", ...parameters.map((p) => p.id)];

  const insertSnippet = (formulaIndex: number, snippet: string) => {
    equationRefs.current[formulaIndex]?.insertAtCursor(snippet);
  };

  const handleSnippetClick = (snippet: string) => {
    const targetIndex = Math.min(
      Math.max(activeFormulaIndex, 0),
      Math.max(formulas.length - 1, 0),
    );
    insertSnippet(targetIndex, snippet);
    equationRefs.current[targetIndex]?.focus();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {isEnglish ? "One line per curve" : "Uma linha por curva"} ({formulas.length})
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {isEnglish ? "Add curve" : "Adicionar curva"}
          </Button>
        </div>

        {formulas.map((formula, i) => {
          const equation = resolveFormulaExpression(formula);
          const seriesHasError =
            equation.trim().length > 0 && !hasValidFormulaSyntax(equation);

          return (
            <div key={formula.id} className="rounded-xl border p-4 space-y-3 bg-muted/20">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-[180px] flex-1">
                  <MaybeI18nTextField
                    label={isEnglish ? "Curve name" : "Nome da curva"}
                    value={formula.name ?? formula.label}
                    onChange={(name) => onUpdate(i, { name })}
                  />
                </div>
                <div className="flex items-end gap-2 shrink-0">
                  <div className="space-y-1">
                    <Label className="text-xs">{isEnglish ? "Color" : "Cor"}</Label>
                    <Input
                      type="color"
                      value={formula.color ?? FORMULA_COLORS[0]}
                      onChange={(e) => onUpdate(i, { color: e.target.value })}
                      className="h-9 w-12 cursor-pointer p-1"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{isEnglish ? "Width" : "Espessura"}</Label>
                    <Input
                      type="number"
                      min={0.5}
                      max={8}
                      step={0.25}
                      value={formula.thickness ?? formula.strokeWidth ?? 2.5}
                      onChange={(e) => onUpdate(i, { thickness: Number(e.target.value) })}
                      className="w-16"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => onRemove(i)}
                    disabled={formulas.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Equação y = f(x)</Label>
                <FormulaEquationInput
                  ref={(el) => {
                    equationRefs.current[i] = el;
                  }}
                  value={equation}
                  onChange={(next) => onUpdate(i, { equation: next })}
                  onFocus={() => setActiveFormulaIndex(i)}
                  hasError={seriesHasError}
                  placeholder="a * sin(x) + b"
                />
                {seriesHasError && (
                  <p className="text-xs text-destructive mt-1">
                    {isEnglish ? "Invalid equation" : "Equação inválida"}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5 lg:hidden">
                  {snippets.map((snippet) => (
                    <Button
                      key={`${formula.id}-${snippet}-mobile`}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2 font-mono text-xs"
                      onClick={() => insertSnippet(i, snippet)}
                    >
                      {snippet}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Card className="h-fit lg:sticky lg:top-4 hidden lg:block">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Snippets</CardTitle>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isEnglish
              ? "Inserts at the cursor in the active field."
              : "Insere no cursor do campo ativo."}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
              {isEnglish ? "Variables" : "Variáveis"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {snippets.map((snippet) => (
                <Badge
                  key={snippet}
                  variant="outline"
                  className={cn(
                    "cursor-pointer font-mono text-xs hover:bg-primary/10 hover:border-primary/40 transition-colors",
                    snippet === "x" && "border-primary/30 bg-primary/5",
                  )}
                  onClick={() => handleSnippetClick(snippet)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSnippetClick(snippet);
                    }
                  }}
                >
                  {snippet}
                </Badge>
              ))}
            </div>
          </div>
          {parameters.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {isEnglish
                ? "Add parameters under Parameters first."
                : "Adicione parâmetros na aba Parâmetros."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
