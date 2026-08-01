import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Activity,
  Bell,
  Bone,
  Brain,
  Check,
  Heart,
  LineChart,
  Pill,
  Search,
  TrendingDown,
  Waves,
  Wind,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  PRESET_CATALOG,
  PRESET_CATEGORIES,
  buildPresetBlockData,
  getPresetCatalogEntry,
} from "@/lib/dynamicChart/presets";
import {
  resolveI18nText,
  resolvePresetMetaField,
  type ClinicalPresetCategoryId,
  type DynamicChartPresetIcon,
  type DynamicChartPresetId,
} from "@/types/dynamicChart";
import { cn } from "@/lib/utils";

const PRESET_ICONS: Record<
  DynamicChartPresetIcon,
  ComponentType<{ className?: string }>
> = {
  curve: LineChart,
  bell: Bell,
  decay: TrendingDown,
  sigmoid: Activity,
  wave: Waves,
  heart: Heart,
  muscle: Bone,
  lung: Wind,
  nerve: Brain,
  joint: Bone,
  bone: Bone,
  pharmacy: Pill,
};

export interface PresetSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPresetId: DynamicChartPresetId;
  onApplyPreset: (presetId: DynamicChartPresetId) => void;
  /** apply_preset = modo clínico; import_to_custom = ejetar para fórmula customizada */
  variant?: "apply_preset" | "import_to_custom";
}

export function PresetSelectorDialog({
  open,
  onOpenChange,
  selectedPresetId,
  onApplyPreset,
  variant = "apply_preset",
}: PresetSelectorDialogProps) {
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const isImport = variant === "import_to_custom";

  const defaultCategory =
    getPresetCatalogEntry(selectedPresetId)?.category ?? PRESET_CATEGORIES[0]?.id ?? "electrotherapy";

  const [activeCategory, setActiveCategory] = useState<ClinicalPresetCategoryId>(defaultCategory);
  const [focusedPresetId, setFocusedPresetId] = useState<DynamicChartPresetId>(selectedPresetId);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const meta = getPresetCatalogEntry(selectedPresetId);
    setActiveCategory(meta?.category ?? "electrotherapy");
    setFocusedPresetId(selectedPresetId);
    setSearchQuery("");
  }, [open, selectedPresetId]);

  const categoryPresets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return PRESET_CATALOG.filter((preset) => {
      if (preset.category !== activeCategory) return false;
      if (!query) return true;
      const haystack = [
        resolvePresetMetaField(preset.title, "pt"),
        resolvePresetMetaField(preset.title, "en"),
        resolvePresetMetaField(preset.subtitle, "pt"),
        resolvePresetMetaField(preset.subtitle, "en"),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [activeCategory, searchQuery]);

  const focusedMeta = getPresetCatalogEntry(focusedPresetId);
  const focusedConfig = useMemo(() => {
    try {
      return buildPresetBlockData(focusedPresetId);
    } catch {
      return null;
    }
  }, [focusedPresetId]);

  const handleApply = () => {
    onApplyPreset(focusedPresetId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[min(96vw,960px)] max-w-[960px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4 text-left">
          <DialogTitle>
            {isImport
              ? isEnglish
                ? "Import clinical model"
                : "Importar modelo clínico"
              : isEnglish
                ? "Choose clinical model"
                : "Escolher modelo clínico"}
          </DialogTitle>
          <DialogDescription>
            {isImport
              ? isEnglish
                ? "Load parameters, axes, feedbacks, and equations into custom mode."
                : "Carrega parâmetros, eixos, feedbacks e equações no modo livre."
              : isEnglish
                ? "Browse by category, review parameters, then apply."
                : "Navegue por categoria, revise parâmetros e aplique."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Sidebar — categorias */}
          <aside className="border-b md:w-52 md:shrink-0 md:border-b-0 md:border-r">
            <ScrollArea className="h-full max-h-[120px] md:max-h-none">
              <nav className="flex gap-1 overflow-x-auto p-2 md:flex-col md:overflow-visible md:p-3">
                {PRESET_CATEGORIES.map((category) => {
                  const isActive = activeCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setActiveCategory(category.id);
                        const firstInCategory = PRESET_CATALOG.find((p) => p.category === category.id);
                        if (firstInCategory) setFocusedPresetId(firstInCategory.id);
                      }}
                      className={cn(
                        "shrink-0 rounded-lg px-3 py-2 text-left text-sm transition-colors md:w-full",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <span className="font-medium block leading-snug">
                        {resolvePresetMetaField(category.label, language)}
                      </span>
                      <span
                        className={cn(
                          "text-[11px]",
                          isActive ? "text-primary-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        {category.presetIds.length}{" "}
                        {isEnglish
                          ? category.presetIds.length === 1
                            ? "model"
                            : "models"
                          : category.presetIds.length === 1
                            ? "modelo"
                            : "modelos"}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </ScrollArea>
          </aside>

          {/* Área principal: lista + detalhes */}
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className="flex min-h-0 flex-1 flex-col border-b lg:border-b-0 lg:border-r">
              <div className="border-b px-4 py-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      isEnglish ? "Search category" : "Buscar na categoria"
                    }
                    className="pl-9"
                  />
                </div>
              </div>

              <ScrollArea className="min-h-[220px] flex-1">
                <div className="grid gap-2 p-3 sm:grid-cols-2">
                  {categoryPresets.length === 0 ? (
                    <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                      {isEnglish ? "No models found" : "Nenhum modelo encontrado"}
                    </p>
                  ) : (
                    categoryPresets.map((preset) => {
                      const Icon = PRESET_ICONS[preset.icon] ?? Waves;
                      const isFocused = focusedPresetId === preset.id;
                      const isCurrent = selectedPresetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setFocusedPresetId(preset.id)}
                          className={cn(
                            "flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
                            isFocused
                              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                              : "border-border bg-card hover:border-primary/30 hover:bg-muted/40",
                          )}
                        >
                          <div className="rounded-lg bg-muted p-2 shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold leading-tight">
                                {resolvePresetMetaField(preset.title, language)}
                              </p>
                              {isCurrent && (
                                <Badge variant="secondary" className="shrink-0 text-[10px]">
                                  {isEnglish ? "Current" : "Atual"}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {resolvePresetMetaField(preset.subtitle, language)}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Painel de detalhes */}
            <aside className="flex w-full shrink-0 flex-col bg-muted/20 lg:w-[320px]">
              {focusedMeta && focusedConfig ? (
                <>
                  <ScrollArea className="flex-1 max-h-[280px] lg:max-h-none">
                    <div className="space-y-4 p-4">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                          {resolvePresetMetaField(
                            PRESET_CATEGORIES.find((c) => c.id === focusedMeta.category)?.label ??
                              { pt: focusedMeta.category, en: focusedMeta.category },
                            language,
                          )}
                        </p>
                        <h3 className="text-base font-semibold leading-snug">
                          {resolvePresetMetaField(focusedMeta.title, language)}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {resolvePresetMetaField(focusedMeta.subtitle, language)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-foreground mb-1.5">
                          {isEnglish ? "Description" : "Descrição"}
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {resolvePresetMetaField(focusedMeta.description, language)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-foreground mb-2">
                          {isEnglish ? "Parameters" : "Parâmetros"} (
                          {focusedConfig.parameters.length})
                        </p>
                        <ul className="space-y-2">
                          {focusedConfig.parameters.map((param) => (
                            <li
                              key={param.id}
                              className="rounded-lg border bg-background/80 px-3 py-2 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">
                                  {resolveI18nText(param.name, language)}
                                </span>
                                <code className="text-[10px] text-muted-foreground">{param.id}</code>
                              </div>
                              <p className="text-muted-foreground mt-0.5">
                                {param.min} – {param.max}
                                {param.unit ? ` ${param.unit}` : ""}
                                {" · "}
                                {isEnglish ? "default" : "padrão"}: {param.defaultValue}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {focusedMeta.readonly_equations.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-foreground mb-1.5">
                            {isEnglish ? "Equations" : "Equações"}
                          </p>
                          <div className="space-y-1.5">
                            {focusedMeta.readonly_equations.map((eq, index) => (
                              <div
                                key={`${focusedMeta.id}-eq-${index}`}
                                className="rounded-md border bg-background px-2.5 py-1.5 font-mono text-[11px] leading-relaxed"
                              >
                                {eq}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  <div className="border-t bg-background p-4 flex flex-col gap-2">
                    <Button type="button" onClick={handleApply} className="w-full">
                      <Check className="h-4 w-4 mr-1.5" />
                      {isImport
                        ? isEnglish
                          ? "Import"
                          : "Importar"
                        : isEnglish
                          ? "Apply"
                          : "Aplicar"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenChange(false)}
                    >
                      {isEnglish ? "Cancel" : "Cancelar"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground text-center">
                  {isEnglish
                    ? "Select a model."
                    : "Selecione um modelo."}
                </div>
              )}
            </aside>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
