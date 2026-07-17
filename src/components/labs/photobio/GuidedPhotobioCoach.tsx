/**
 * Coach guiado — dicas progressivas e feedback contextual — PBM
 */

import { Lightbulb, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePhotobioStore } from "@/stores/photobioStore";
import {
  getPhotobioChallengeById,
  getPhotobioContextualCoachFeedback,
  type PhotobioChallengeEvalContext,
} from "@/config/photobioChallenges";
import { cn } from "@/lib/utils";

interface GuidedPhotobioCoachProps {
  compact?: boolean;
  className?: string;
}

export function GuidedPhotobioCoach({ compact = false, className }: GuidedPhotobioCoachProps) {
  const {
    wavelength,
    power,
    spotSize,
    exposureTime,
    mode,
    dutyCycle,
    transducerAngle,
    contactPressure,
    isDragging,
    draggingSpeed,
    anatomyPreset,
    interaction,
    activeChallengeId,
    challengeRuntime,
    guidedHintIndex,
    advanceGuidedHint,
    viewerTab,
    challengeCompleted,
    doseMap,
    snapshots,
    labMode,
  } = usePhotobioStore();

  if (labMode !== "guided" || !activeChallengeId) return null;

  const def = getPhotobioChallengeById(activeChallengeId);
  if (!def) return null;

  const ctx: PhotobioChallengeEvalContext = {
    wavelength,
    power,
    spotSize,
    exposureTime,
    mode,
    dutyCycle,
    transducerAngle,
    contactPressure,
    isDragging,
    draggingSpeed,
    anatomyPreset,
    interaction,
    runtime: challengeRuntime,
    viewerTab,
    doseMap,
    snapshots,
  };

  const feedback = getPhotobioContextualCoachFeedback(activeChallengeId, ctx, guidedHintIndex);
  const hasMoreHints = guidedHintIndex < def.coachHints.length - 1;

  const Icon =
    feedback.tone === "success"
      ? CheckCircle2
      : feedback.tone === "warning"
        ? AlertTriangle
        : Lightbulb;

  const toneClass =
    feedback.tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : feedback.tone === "warning"
        ? "border-amber-500/30 bg-amber-500/5"
        : "border-rose-500/30 bg-rose-500/5";

  return (
    <div
      className={cn(
        "rounded-xl border backdrop-blur-sm",
        toneClass,
        compact ? "p-2.5" : "p-3",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Icon
          className={cn(
            "shrink-0",
            compact ? "h-4 w-4 mt-0.5" : "h-5 w-5",
            feedback.tone === "success"
              ? "text-emerald-500"
              : feedback.tone === "warning"
                ? "text-amber-500"
                : "text-rose-500",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium text-foreground", compact ? "text-xs" : "text-sm")}>
            {challengeCompleted ? "Desafio concluído!" : "Coach PBM"}
          </p>
          <p className={cn("mt-1 leading-relaxed text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>
            {feedback.message}
          </p>
          {hasMoreHints && !challengeCompleted && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn("mt-2 h-7 px-2 text-[10px]", compact && "mt-1.5")}
              onClick={advanceGuidedHint}
            >
              Próxima dica
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
