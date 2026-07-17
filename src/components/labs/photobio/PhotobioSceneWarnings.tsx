import { cn } from "@/lib/utils";
import type { PhotobioViewerTab } from "@/stores/photobioStore";
import { couplingVisualState } from "./photobioBeamVisual";

interface PhotobioSceneWarningsProps {
  transducerAngle: number;
  contactPressure: number;
  irradiance: number;
  thermalRiskIndex: number;
  coupling: number;
  viewerTab: PhotobioViewerTab;
  minimal?: boolean;
}

type WarningTone = "amber" | "sky" | "orange" | "red";

const TONE_CLASS: Record<WarningTone, string> = {
  amber: "border-amber-400/70 bg-amber-950/85 text-amber-100",
  sky: "border-sky-400/70 bg-sky-950/85 text-sky-100",
  orange: "border-orange-400/70 bg-orange-950/85 text-orange-100",
  red: "border-red-400/70 bg-red-950/85 text-red-50",
};

function WarningItem({ tone, children }: { tone: WarningTone; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-[10px] font-medium leading-snug shadow-lg backdrop-blur-md",
        TONE_CLASS[tone],
      )}
    >
      {children}
    </div>
  );
}

export function PhotobioSceneWarnings({
  transducerAngle,
  contactPressure,
  irradiance,
  thermalRiskIndex,
  coupling,
  viewerTab,
  minimal = false,
}: PhotobioSceneWarningsProps) {
  if (minimal || viewerTab === "penetration" || viewerTab === "fluence") {
    return null;
  }

  const badAngle = transducerAngle < 70 || transducerAngle > 110;
  const badPressureLow = contactPressure < 20;
  const badPressureHigh = contactPressure > 80;
  const thermalRisk = thermalRiskIndex > 0.55 || irradiance > 500;
  const contactState = couplingVisualState(coupling, thermalRiskIndex);

  if (!badAngle && !badPressureLow && !badPressureHigh && !thermalRisk && !contactState.low) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute left-3 bottom-4 z-10 flex w-[min(calc(100%-1.5rem),260px)] flex-col gap-1.5 pb-[max(0px,env(safe-area-inset-bottom))] sm:left-4">
      {badAngle && (
        <WarningItem tone="amber">
          Ângulo inadequado ({transducerAngle.toFixed(0)}°) — perda de incidência
        </WarningItem>
      )}

      {badPressureLow && (
        <WarningItem tone="sky">Contato insuficiente — reflexão superficial</WarningItem>
      )}

      {badPressureHigh && (
        <WarningItem tone="orange">Pressão excessiva — reduza o contato</WarningItem>
      )}

      {contactState.low && (
        <WarningItem tone="sky">Acoplamento óptico fraco — melhore o contato</WarningItem>
      )}

      {thermalRisk && (
        <WarningItem tone={thermalRiskIndex > 0.85 ? "red" : "amber"}>
          {thermalRiskIndex > 0.85 ? "⚠ " : "◆ "}
          Risco térmico elevado — {irradiance.toFixed(0)} mW/cm²
          {thermalRiskIndex <= 0.85 && (
            <span className="mt-0.5 block text-[9px] font-normal opacity-80">
              PBM geralmente não térmica
            </span>
          )}
        </WarningItem>
      )}
    </div>
  );
}
