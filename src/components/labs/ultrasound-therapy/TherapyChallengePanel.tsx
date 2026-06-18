/**
 * Painel de desafios — objetivos, progresso, iniciar/reiniciar.
 */

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Play,
  Target,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import {
  THERAPY_CHALLENGES,
  getChallengeById,
  type TherapyChallengeId,
} from "@/config/ultrasoundTherapyChallenges";
import { TherapyScoreBadge } from "./TherapyScoreBadge";
import { GuidedTherapyCoach } from "./GuidedTherapyCoach";
import { cn } from "@/lib/utils";
import { utCard, utHint, utLabel } from "./ultrasoundTherapyUi";

interface TherapyChallengePanelProps {
  compact?: boolean;
  collapsible?: boolean;
  className?: string;
}

const DIFFICULTY_LABELS = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
} as const;

export function TherapyChallengePanel({
  compact = false,
  collapsible = false,
  className,
}: TherapyChallengePanelProps) {
  const {
    labMode,
    activeChallengeId,
    challengeObjectiveMap,
    challengeScore,
    challengeCompleted,
    startChallenge,
    restartChallenge,
    setLabMode,
    challengePanelCollapsed,
    setChallengePanelCollapsed,
  } = useUltrasoundTherapyStore();

  const [pickerOpen, setPickerOpen] = useState(!activeChallengeId);

  const activeDef = activeChallengeId ? getChallengeById(activeChallengeId) : null;
  const completedCount = Object.values(challengeObjectiveMap).filter(Boolean).length;
  const totalObjectives = activeDef?.objectives.length ?? 0;
  const progressPct = totalObjectives > 0 ? (completedCount / totalObjectives) * 100 : 0;

  const handleSelectChallenge = (id: TherapyChallengeId) => {
    startChallenge(id);
    setPickerOpen(false);
  };

  if (labMode === "free") {
    return (
      <div className={cn(utCard, "p-4", className)}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <p className="text-sm font-medium">Modo livre ativo</p>
        </div>
        <p className={cn("mt-2", utHint)}>
          Alterne para modo guiado para praticar com desafios e pontuação.
        </p>
        <Button
          size="sm"
          className="mt-3 w-full"
          onClick={() => setLabMode("guided")}
        >
          Ativar modo guiado
        </Button>
      </div>
    );
  }

  const panelBody = (
    <>
      {!activeDef || pickerOpen ? (
        <div className="space-y-2">
          <p className={cn(utLabel, "mb-2")}>Escolha um desafio</p>
          {THERAPY_CHALLENGES.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => handleSelectChallenge(ch.id)}
              className="flex w-full items-start gap-3 rounded-lg border border-border bg-background/60 p-3 text-left transition-colors hover:bg-muted/80"
            >
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{ch.title}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {DIFFICULTY_LABELS[ch.difficulty]}
                  </Badge>
                </div>
                <p className={cn("mt-1 line-clamp-2", utHint)}>{ch.summary}</p>
              </div>
              <Play className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{activeDef.title}</p>
              <p className={cn("mt-1", utHint)}>{activeDef.summary}</p>
            </div>
            <TherapyScoreBadge score={challengeScore} compact />
          </div>

          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-mono tabular-nums">
                {completedCount}/{totalObjectives}
              </span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>

          <ul className="mt-3 space-y-2">
            {activeDef.objectives.map((obj) => {
              const done = challengeObjectiveMap[obj.id];
              return (
                <li key={obj.id} className="flex items-start gap-2 text-xs">
                  {done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                  )}
                  <span className={cn(done && "text-muted-foreground line-through")}>{obj.label}</span>
                </li>
              );
            })}
          </ul>

          {challengeCompleted && (
            <div className="mt-3 flex justify-center">
              <TherapyScoreBadge score={challengeScore} showLabel />
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={restartChallenge}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reiniciar
            </Button>
            <Button size="sm" variant="ghost" className="flex-1" onClick={() => setPickerOpen(true)}>
              Trocar desafio
            </Button>
          </div>

          <div className="mt-3">
            <GuidedTherapyCoach compact={compact} />
          </div>
        </>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="mt-3 w-full text-xs text-muted-foreground"
        onClick={() => setLabMode("free")}
      >
        Voltar ao modo livre
      </Button>
    </>
  );

  if (collapsible) {
    return (
      <div className={cn("border-t border-border bg-card/95 backdrop-blur-sm", className)}>
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2.5 text-left"
          onClick={() => setChallengePanelCollapsed(!challengePanelCollapsed)}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">
              {activeDef ? activeDef.title : "Desafios guiados"}
            </span>
            {activeChallengeId && (
              <TherapyScoreBadge score={challengeScore} compact />
            )}
          </div>
          {challengePanelCollapsed ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {!challengePanelCollapsed && <div className="px-3 pb-3">{panelBody}</div>}
      </div>
    );
  }

  return (
    <div className={cn(utCard, compact ? "p-3" : "p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <span className={utLabel}>Modo guiado</span>
      </div>
      {panelBody}
    </div>
  );
}
