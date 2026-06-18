/**
 * Coach guiado — dicas progressivas e feedback contextual.
 */

import { Lightbulb, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import {
  getContextualCoachFeedback,
  getChallengeById,
  type ChallengeEvalContext,
} from "@/config/ultrasoundTherapyChallenges";
import { cn } from "@/lib/utils";
import { utCard, utHint } from "./ultrasoundTherapyUi";

interface GuidedTherapyCoachProps {
  compact?: boolean;
  className?: string;
}

export function GuidedTherapyCoach({ compact = false, className }: GuidedTherapyCoachProps) {
  const {
    config,
    simulationResult,
    activeChallengeId,
    challengeRuntime,
    guidedHintIndex,
    advanceGuidedHint,
    viewerTab,
    challengeCompleted,
  } = useUltrasoundTherapyStore();

  if (!activeChallengeId || !simulationResult) return null;

  const def = getChallengeById(activeChallengeId);
  if (!def) return null;

  const ctx: ChallengeEvalContext = {
    config,
    result: simulationResult,
    runtime: challengeRuntime,
    viewerTab,
  };

  const feedback = getContextualCoachFeedback(activeChallengeId, ctx, guidedHintIndex);
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
        : "border-cyan-500/30 bg-cyan-500/5";

  const iconClass =
    feedback.tone === "success"
      ? "text-emerald-500"
      : feedback.tone === "warning"
        ? "text-amber-500"
        : "text-cyan-500";

  if (compact) {
    return (
      <div className={cn("rounded-lg border px-3 py-2", toneClass, className)}>
        <div className="flex items-start gap-2">
          <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconClass)} />
          <p className="text-xs leading-snug text-foreground">{feedback.message}</p>
        </div>
        {challengeCompleted && (
          <p className={cn("mt-1 pl-6 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400", utHint)}>
            Desafio concluído — revise o que funcionou.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn(utCard, "p-4", toneClass, className)}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn("h-4 w-4", iconClass)} />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Coach guiado
        </span>
      </div>
      <p className="text-sm leading-relaxed text-foreground">{feedback.message}</p>
      {challengeCompleted ? (
        <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          Parabéns — todos os objetivos foram atingidos.
        </p>
      ) : (
        hasMoreHints && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 h-8 px-2 text-xs text-muted-foreground"
            onClick={advanceGuidedHint}
          >
            Próxima dica
          </Button>
        )
      )}
    </div>
  );
}
