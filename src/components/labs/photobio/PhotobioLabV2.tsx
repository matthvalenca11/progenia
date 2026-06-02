import { useEffect, useState } from "react";
import { usePhotobioStore } from "@/stores/photobioStore";
import { TissueViewer } from "./TissueViewer";
import { PhotobioControls } from "./PhotobioControls";
import { PhotobioInsightsPanel } from "./PhotobioInsightsPanel";
import { ArrowLeft, RotateCcw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { LabConfigMenu } from "./LabConfigMenu";
import { useIsMobile } from "@/hooks/use-mobile";
import { LabMobilePanelTab, LabMobileTabBar } from "@/components/labs/LabMobileTabBar";
import { labMobileFlexClass, labMobilePanelClass, labCanvasHostClass } from "@/components/labs/labMobileLayout";

interface PhotobioLabV2Props {
  config?: Record<string, unknown>;
  labName?: string;
  showBackButton?: boolean;
  isEditMode?: boolean;
}

export function PhotobioLabV2({
  config,
  labName = "Laboratório de Fotobiomodulação",
  showBackButton = true,
  isEditMode = false,
}: PhotobioLabV2Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const setFromConfig = usePhotobioStore((s) => s.setFromConfig);
  const resetDefaults = usePhotobioStore((s) => s.resetDefaults);
  const interaction = usePhotobioStore((s) => s.interaction);
  const fluence = usePhotobioStore((s) => s.fluence());
  const [mobilePanel, setMobilePanel] = useState<LabMobilePanelTab>("controls");

  const isAdminConfigMode =
    isEditMode || new URLSearchParams(location.search).get("admin") === "true";

  useEffect(() => {
    if (!config) return;
    const initialPresetRaw = String(
      (config.initialPreset as string | undefined) || ""
    ).toLowerCase();
    const initialPreset =
      initialPresetRaw === "idoso"
        ? "elderly"
        : initialPresetRaw === "atleta"
          ? "athlete"
          : initialPresetRaw === "obeso"
            ? "obese"
            : initialPresetRaw === "padrao" || initialPresetRaw === "padrão"
              ? "default"
              : undefined;
    const aliasControlModes: Record<string, "show" | "hidden"> = {
      showWavelength: typeof config.showWavelength === "boolean" ? (config.showWavelength as boolean ? "show" : "hidden") : "show",
      showPower: typeof config.showPower === "boolean" ? (config.showPower as boolean ? "show" : "hidden") : "show",
      showSpotSize: typeof config.showSpotSize === "boolean" ? (config.showSpotSize as boolean ? "show" : "hidden") : "show",
      showExposureTime: typeof config.showExposureTime === "boolean" ? (config.showExposureTime as boolean ? "show" : "hidden") : "show",
      showMode: typeof config.showMode === "boolean" ? (config.showMode as boolean ? "show" : "hidden") : "show",
      showAnatomyPresets: typeof config.showAnatomyPresets === "boolean" ? (config.showAnatomyPresets as boolean ? "show" : "hidden") : "show",
      showCustomAnatomy: typeof config.showCustomAnatomy === "boolean" ? (config.showCustomAnatomy as boolean ? "show" : "hidden") : "show",
    };
    setFromConfig({
      wavelength: (config.wavelength as 660 | 808 | undefined) ?? undefined,
      power: typeof config.power === "number" ? config.power : undefined,
      spotSize: typeof config.spotSize === "number" ? config.spotSize : undefined,
      exposureTime: typeof config.exposureTime === "number" ? config.exposureTime : undefined,
      mode: (config.mode as "CW" | "Pulsed" | undefined) ?? undefined,
      dutyCycle: typeof config.dutyCycle === "number" ? config.dutyCycle : undefined,
      anatomyPreset: (config.anatomyPreset as any) ?? (initialPreset as any) ?? undefined,
      controlModes:
        typeof config.controlModes === "object" && config.controlModes
          ? {
              ...aliasControlModes,
              ...(config.controlModes as Record<string, "show" | "hidden" | "disabled">),
            }
          : aliasControlModes,
    });
  }, [config, setFromConfig]);

  if (isMobile) {
    return (
      <div className={cn(labMobileFlexClass, "h-[100dvh] bg-background")}>
        {isAdminConfigMode && <LabConfigMenu />}
        <header className="safe-area-top lab-mobile-inset-x z-50 shrink-0 border-b border-border bg-card/95 py-2 backdrop-blur">
          <div className="flex items-center gap-2">
            {showBackButton && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="h-8 w-8 shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Sun className="h-4 w-4 shrink-0 text-rose-500" />
            <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{labName}</h1>
            <Button variant="ghost" size="icon" onClick={resetDefaults} className="h-8 w-8 shrink-0" aria-label="Resetar">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {fluence.toFixed(2)} J/cm²
            </Badge>
            <Badge className={`text-[10px] ${interaction.arndtSchulzZone === "Janela Terapêutica Ativa" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400" : "bg-muted text-foreground border-border"}`}>
              {interaction.arndtSchulzZone}
            </Badge>
          </div>
        </header>

        <section className="relative h-[min(48dvh,55vh)] min-h-[40dvh] shrink-0 overflow-hidden border-b border-border bg-background">
          <div className={labCanvasHostClass}>
            <TissueViewer />
          </div>
        </section>

        <div className={labMobilePanelClass()}>
          <LabMobileTabBar
            active={mobilePanel}
            onChange={setMobilePanel}
            disableInset
            tabs={[
              { id: "controls", label: "Controles" },
              { id: "metrics", label: "Métricas" },
            ]}
          />

          <section className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y pb-[max(0.5rem,var(--sab,env(safe-area-inset-bottom,0px)))]">
            {mobilePanel === "controls" ? <PhotobioControls /> : <PhotobioInsightsPanel />}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background overflow-hidden md:h-screen">
      {isAdminConfigMode && <LabConfigMenu />}
      <header className="safe-sticky-top bg-card/95 border-b border-border backdrop-blur px-3 py-2.5 shrink-0 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          <div className="order-3 w-full md:order-2 md:w-auto flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {showBackButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/dashboard")}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-rose-500" />
              <h1 className="font-medium text-sm text-foreground">{labName}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">
              Fluência: {fluence.toFixed(2)} J/cm²
            </Badge>
            <Badge
              className={
                interaction.arndtSchulzZone === "Janela Terapêutica Ativa"
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : interaction.arndtSchulzZone === "Bioinibição / Saturação"
                    ? "bg-red-500/15 text-red-400 border-red-500/30"
                    : "bg-muted text-foreground border-border"
              }
            >
              {interaction.arndtSchulzZone}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetDefaults}
              className="text-muted-foreground hover:text-foreground gap-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </div>
      </header>

      <main className="h-[54dvh] md:h-auto flex-1 flex items-center justify-center min-w-0 overflow-hidden bg-background">
        <div className="w-full h-full p-4">
          <TissueViewer />
        </div>
      </main>

      <div className="flex border-t border-border shrink-0 h-[40%]">
        <aside className="w-1/2 border-r border-border overflow-y-auto bg-card">
          <PhotobioControls />
        </aside>
        <aside className="w-1/2 overflow-y-auto bg-card">
          <PhotobioInsightsPanel />
        </aside>
      </div>
    </div>
  );
}

export default PhotobioLabV2;

