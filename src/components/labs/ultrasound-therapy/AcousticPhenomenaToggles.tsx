/**
 * Toggles compactos para fenômenos acústicos no modo Propagação.
 */

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import type { UltrasoundVisualizationOptions } from "@/types/ultrasoundTherapyConfig";
import { cn } from "@/lib/utils";
import { utCard, utHint, utLabel, SHOW_PROPAGATION_LAYERS_PANEL } from "./ultrasoundTherapyUi";
import { ChevronDown, Layers3 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type ToggleKey = keyof UltrasoundVisualizationOptions;

const TOGGLE_ITEMS: Array<{
  key: ToggleKey;
  label: string;
  tooltip: string;
  color: string;
  border?: string;
  advanced?: boolean;
}> = [
  {
    key: "showPropagation",
    label: "Propagação",
    tooltip: "Feixe se espalhando nos tecidos",
    color: "bg-sky-400",
    border: "border-sky-500/40",
  },
  {
    key: "showAttenuation",
    label: "Atenuação",
    tooltip: "Perda de energia com a profundidade",
    color: "bg-slate-500/60",
    border: "border-slate-400/40",
  },
  {
    key: "showReflection",
    label: "Reflexão óssea",
    tooltip: "Reflexão na interface com o osso",
    color: "bg-amber-400",
    border: "border-amber-500/40",
  },
  {
    key: "showCavitation",
    label: "Cavitação",
    tooltip: "Microbolhas ilustrativas",
    color: "bg-sky-200",
    border: "border-sky-300/40",
  },
  {
    key: "showStandingWaves",
    label: "Ondas estacionárias",
    tooltip: "Bandas perto do osso (ilustrativo)",
    color: "bg-violet-400/70",
    border: "border-violet-400/40",
    advanced: true,
  },
  {
    key: "showTissueResponse",
    label: "Resposta tecidual",
    tooltip: "Aquecimento local estimado",
    color: "bg-rose-400",
    border: "border-rose-400/40",
    advanced: true,
  },
  {
    key: "showThermalDamage",
    label: "Dano térmico",
    tooltip: "Zona de calor excessivo",
    color: "bg-orange-500",
    border: "border-orange-500/40",
    advanced: true,
  },
  {
    key: "showAblation",
    label: "Superaquecimento",
    tooltip: "Hotspot extremo (didático)",
    color: "bg-red-700",
    border: "border-red-600/40",
    advanced: true,
  },
  {
    key: "showSafetyZones",
    label: "Zonas seguras",
    tooltip: "Faixa terapêutica moderada",
    color: "bg-emerald-400/80",
    border: "border-emerald-500/40",
    advanced: true,
  },
];

function ToggleRow({
  label,
  tooltip,
  checked,
  onCheckedChange,
  color,
  border,
  compact,
}: {
  label: string;
  tooltip: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  color: string;
  border?: string;
  compact?: boolean;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/50 px-2.5",
              compact ? "py-1.5" : "py-2",
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn("h-2 w-2 shrink-0 rounded-sm border", color, border)} />
              <Label className="cursor-pointer truncate text-[11px] font-medium text-foreground">
                {label}
              </Label>
            </div>
            <Switch checked={checked} onCheckedChange={onCheckedChange} className="scale-[0.82]" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[200px] text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ToggleGrid({
  compact,
  keys,
}: {
  compact?: boolean;
  keys?: ToggleKey[];
}) {
  const { visualizationOptions, setVisualizationOption } = useUltrasoundTherapyStore();
  const items = keys
    ? TOGGLE_ITEMS.filter((t) => keys.includes(t.key))
    : TOGGLE_ITEMS;

  return (
    <div className={cn("grid gap-1.5", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
      {items.map(({ key, label, tooltip, color, border }) => (
        <ToggleRow
          key={key}
          label={label}
          tooltip={tooltip}
          color={color}
          border={border}
          checked={visualizationOptions[key]}
          onCheckedChange={(v) => setVisualizationOption(key, v)}
          compact={compact}
        />
      ))}
    </div>
  );
}

const CORE_KEYS: ToggleKey[] = [
  "showPropagation",
  "showAttenuation",
  "showReflection",
  "showCavitation",
];

const ADVANCED_KEYS: ToggleKey[] = [
  "showStandingWaves",
  "showTissueResponse",
  "showThermalDamage",
  "showAblation",
  "showSafetyZones",
];

export function AcousticPhenomenaToggles({
  variant = "panel",
  compact = false,
}: {
  variant?: "panel" | "overlay";
  compact?: boolean;
}) {
  if (!SHOW_PROPAGATION_LAYERS_PANEL) return null;

  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(isMobile);
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (variant === "overlay") {
    return (
      <div className="pointer-events-auto w-[min(88vw,220px)]">
        <div className="rounded-xl border border-border/80 bg-slate-900/92 text-slate-100 shadow-lg backdrop-blur-md">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-between rounded-t-xl px-3 text-[11px] font-medium text-slate-200 hover:bg-slate-800/80 hover:text-white"
            onClick={() => setCollapsed((c) => !c)}
          >
            <span className="flex items-center gap-1.5">
              <Layers3 className="h-3.5 w-3.5 text-sky-400" />
              Camadas
            </span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !collapsed && "rotate-180")} />
          </Button>

          {!collapsed && (
            <div className="space-y-2 border-t border-slate-700/80 px-2.5 py-2">
              <ToggleGrid compact keys={CORE_KEYS} />
              <button
                type="button"
                className="w-full text-left text-[10px] font-medium text-slate-400 hover:text-slate-200"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? "− Menos opções" : "+ Mais opções"}
              </button>
              {showAdvanced && <ToggleGrid compact keys={ADVANCED_KEYS} />}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(utCard, compact ? "space-y-3 p-4" : "space-y-4 p-5")}>
      <div>
        <p className={utLabel}>Propagação nos tecidos</p>
        <p className={cn("mt-1", utHint)}>Ligue ou desligue camadas do mapa acústico.</p>
      </div>
      <ToggleGrid compact={compact} keys={CORE_KEYS} />
      <ToggleGrid compact={compact} keys={ADVANCED_KEYS} />
    </div>
  );
}

export function AcousticPhenomenaAccordion({ compact }: { compact?: boolean }) {
  if (!SHOW_PROPAGATION_LAYERS_PANEL) return null;

  const { viewerTab } = useUltrasoundTherapyStore();
  if (viewerTab !== "interaction") return null;

  return (
    <Accordion type="single" collapsible defaultValue="propagation">
      <AccordionItem value="propagation" className="rounded-xl border border-border bg-card px-4">
        <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
          Camadas de propagação
        </AccordionTrigger>
        <AccordionContent className="pb-4">
          <ToggleGrid compact={compact} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
