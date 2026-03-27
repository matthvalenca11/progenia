import { useEffect } from "react";
import { usePhotobioStore } from "@/stores/photobioStore";
import { TissueViewer } from "./TissueViewer";
import { PhotobioControls } from "./PhotobioControls";
import { PhotobioInsightsPanel } from "./PhotobioInsightsPanel";
import { ArrowLeft, RotateCcw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { LabConfigMenu } from "./LabConfigMenu";

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
  const setFromConfig = usePhotobioStore((s) => s.setFromConfig);
  const resetDefaults = usePhotobioStore((s) => s.resetDefaults);
  const interaction = usePhotobioStore((s) => s.interaction);
  const fluence = usePhotobioStore((s) => s.fluence());

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

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {isAdminConfigMode && <LabConfigMenu />}
      <header className="bg-card/95 border-b border-border backdrop-blur sticky top-0 z-50 px-4 py-2.5 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
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

      <main className="flex-1 flex items-center justify-center min-w-0 overflow-hidden bg-background" style={{ height: "60%" }}>
        <div className="w-full h-full p-4">
          <TissueViewer />
        </div>
      </main>

      <div className="flex border-t border-border shrink-0" style={{ height: "40%" }}>
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

