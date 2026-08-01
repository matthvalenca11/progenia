import { type ComponentType } from "react";
import {
  Activity,
  Bell,
  Bone,
  Brain,
  Heart,
  LineChart,
  Pill,
  RotateCcw,
  Settings2,
  TrendingDown,
  Waves,
  Wind,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { PRESET_CATEGORIES, getPresetCatalogEntry } from "@/lib/dynamicChart/presets";
import {
  resolvePresetMetaField,
  type DynamicChartPresetIcon,
  type DynamicChartPresetId,
} from "@/types/dynamicChart";

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

interface PresetSummaryCardProps {
  presetId: DynamicChartPresetId;
  onChangeModel: () => void;
  onRestoreDefaults: () => void;
}

export function PresetSummaryCard({
  presetId,
  onChangeModel,
  onRestoreDefaults,
}: PresetSummaryCardProps) {
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const meta = getPresetCatalogEntry(presetId);
  const Icon = meta ? PRESET_ICONS[meta.icon] ?? Waves : LineChart;

  const categoryLabel = meta
    ? resolvePresetMetaField(
        PRESET_CATEGORIES.find((c) => c.id === meta.category)?.label ??
          { pt: meta.category, en: meta.category },
        language,
      )
    : "";

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {categoryLabel}
            </p>
            <h3 className="text-sm font-semibold leading-snug text-foreground">
              {meta ? resolvePresetMetaField(meta.title, language) : presetId}
            </h3>
            {meta && (
              <p className="text-xs text-muted-foreground">
                {resolvePresetMetaField(meta.subtitle, language)}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={onRestoreDefaults}>
            <RotateCcw className="h-4 w-4 mr-1.5" />
            {isEnglish ? "Restore defaults" : "Restaurar padrão"}
          </Button>
          <Button type="button" variant="default" size="sm" onClick={onChangeModel}>
            <Settings2 className="h-4 w-4 mr-1.5" />
            {isEnglish ? "Change model" : "Trocar modelo"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
