import { useEffect, useState } from "react";
import { usePhotobioStore } from "@/stores/photobioStore";
import { TissueViewer } from "./TissueViewer";
import { PhotobioControls } from "./PhotobioControls";
import { PhotobioInsightsPanel } from "./PhotobioInsightsPanel";
import { PhotobioSimulationStatusBar } from "./PhotobioSimulationStatusBar";
import { GuidedPhotobioCoach } from "./GuidedPhotobioCoach";
import { ArrowLeft, RotateCcw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import { LabConfigMenu } from "./LabConfigMenu";
import { useIsMobile } from "@/hooks/use-mobile";
import { LabMobilePanelTab, LabMobileTabBar } from "@/components/labs/LabMobileTabBar";
import { labMobileFlexClass, labMobilePanelClass, labCanvasHostClass } from "@/components/labs/labMobileLayout";
import { cn } from "@/lib/utils";
import { EducationalSimulationDisclaimer } from "@/components/labs/EducationalSimulationDisclaimer";
import { mergePhotobioLabConfig, type PhotobioLabConfig } from "@/types/photobioLabConfig";

interface PhotobioLabV2Props {
  config?: Partial<PhotobioLabConfig> | Record<string, unknown>;
  labName?: string;
  showBackButton?: boolean;
  isEditMode?: boolean;
  previewMode?: boolean;
}

export function PhotobioLabV2({
  config,
  labName = "Laboratório de Fotobiomodulação",
  showBackButton = true,
  isEditMode = false,
  previewMode = false,
}: PhotobioLabV2Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const initializeLab = usePhotobioStore((s) => s.initializeLab);
  const resetDefaults = usePhotobioStore((s) => s.resetDefaults);
  const featureFlags = usePhotobioStore((s) => s.featureFlags);
  const [mobilePanel, setMobilePanel] = useState<LabMobilePanelTab>("controls");

  const isAdminConfigMode =
    isEditMode || new URLSearchParams(location.search).get("admin") === "true";

  useEffect(() => {
    if (!config) return;
    initializeLab(mergePhotobioLabConfig(config), {
      preserveSessionAppearance: previewMode,
    });
  }, [config, initializeLab, previewMode]);

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
        </header>

        <PhotobioSimulationStatusBar compact onReset={resetDefaults} />

        <section className="relative h-[min(52dvh,58vh)] min-h-[42dvh] shrink-0 overflow-hidden border-b border-border bg-background">
          <div className={labCanvasHostClass}>
            <TissueViewer />
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 max-w-md">
            {featureFlags.showGuidedMode && (
              <GuidedPhotobioCoach compact className="pointer-events-auto shadow-lg" />
            )}
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
            <div className="border-b border-border px-3 py-2">
              <EducationalSimulationDisclaimer compact />
            </div>
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
        </div>
      </header>

      <PhotobioSimulationStatusBar onReset={resetDefaults} />

      <main className="relative h-[54dvh] md:h-auto flex-1 flex items-center justify-center min-w-0 overflow-hidden bg-background">
        <div className="w-full h-full p-4">
          <TissueViewer />
        </div>
        <div className="pointer-events-none absolute bottom-6 left-6 z-10 max-w-sm">
          {featureFlags.showGuidedMode && (
            <GuidedPhotobioCoach compact className="pointer-events-auto shadow-lg" />
          )}
        </div>
      </main>

      <div className="flex border-t border-border shrink-0 h-[40%] flex-col">
        <div className="shrink-0 border-b border-border px-3 py-1.5">
          <EducationalSimulationDisclaimer compact />
        </div>
        <div className="flex min-h-0 flex-1">
          <aside className="w-1/2 border-r border-border overflow-y-auto bg-card">
            <PhotobioControls />
          </aside>
          <aside className="w-1/2 overflow-y-auto bg-card">
            <PhotobioInsightsPanel />
          </aside>
        </div>
      </div>
    </div>
  );
}

export default PhotobioLabV2;

