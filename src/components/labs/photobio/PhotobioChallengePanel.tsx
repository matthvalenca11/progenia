/**
 * Painel de desafios — objetivos, progresso, iniciar/reiniciar — PBM
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
  FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { usePhotobioStore } from "@/stores/photobioStore";
import {
  PHOTOBIO_CHALLENGES,
  getPhotobioChallengeById,
  type PhotobioChallengeId,
} from "@/config/photobioChallenges";
import { PhotobioScoreBadge } from "./PhotobioScoreBadge";
import { GuidedPhotobioCoach } from "./GuidedPhotobioCoach";
import { cn } from "@/lib/utils";

interface PhotobioChallengePanelProps {
  compact?: boolean;
  collapsible?: boolean;
  className?: string;
}

const DIFFICULTY_LABELS = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
} as const;

export function PhotobioChallengePanel({
  compact = false,
  collapsible = false,
  className,
}: PhotobioChallengePanelProps) {
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
  } = usePhotobioStore();

  const [pickerOpen, setPickerOpen] = useState(!activeChallengeId);

  const activeDef = activeChallengeId ? getPhotobioChallengeById(activeChallengeId) : null;
  const completedCount = Object.values(challengeObjectiveMap).filter(Boolean).length;
  const totalObjectives = activeDef?.objectives.length ?? 0;
  const progressPct = totalObjectives > 0 ? (completedCount / totalObjectives) * 100 : 0;

  const handleSelectChallenge = (id: PhotobioChallengeId) => {
    startChallenge(id);
    setPickerOpen(false);
  };

  const modeToggle = (
    <div className={cn("grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-0.5", compact && "gap-0.5")}>
      <button
        type="button"
        onClick={() => setLabMode("free")}
        className={cn(
          "flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
          labMode === "free"
            ? "border border-border bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <FlaskConical className="h-3.5 w-3.5" />
        Livre
      </button>
      <button
        type="button"
        onClick={() => setLabMode("guided")}
        className={cn(
          "flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
          labMode === "guided"
            ? "border border-border bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Guiado
      </button>
    </div>
  );

  if (labMode === "free") {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
        {modeToggle}
        <div className="mt-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-rose-500" />
          <p className="text-sm font-medium">Modo livre ativo</p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Alterne para modo guiado para praticar com desafios, pontuação e comparação A/B.
        </p>
        <Button size="sm" className="mt-3 w-full" onClick={() => setLabMode("guided")}>
          Ativar modo guiado
        </Button>
      </div>
    );
  }

  const panelBody = (
    <>
      {!activeDef || pickerOpen ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Escolha um desafio
          </p>
          {PHOTOBIO_CHALLENGES.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => handleSelectChallenge(ch.id)}
              className="flex w-full items-start gap-3 rounded-lg border border-border bg-background/60 p-3 text-left transition-colors hover:bg-muted/80"
            >
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{ch.title}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {DIFFICULTY_LABELS[ch.difficulty]}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{ch.summary}</p>
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
              <p className="mt-0.5 text-[11px] text-muted-foreground">{activeDef.summary}</p>
            </div>
            <PhotobioScoreBadge score={challengeScore} compact />
          </div>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                {completedCount}/{totalObjectives} objetivos
              </span>
              {challengeCompleted && (
                <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-600">
                  Concluído
                </Badge>
              )}
            </div>
            <Progress value={progressPct} className="h-1.5" />
          </div>

          <ul className="mt-3 space-y-2">
            {activeDef.objectives.map((obj) => {
              const done = challengeObjectiveMap[obj.id];
              return (
                <li
                  key={obj.id}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs",
                    done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/20",
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">{obj.label}</p>
                    {!done && <p className="mt-0.5 text-[10px] text-muted-foreground">{obj.hint}</p>}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => setPickerOpen(true)}>
              Trocar desafio
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={restartChallenge}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reiniciar
            </Button>
          </div>

          {!compact && (
            <div className="mt-3">
              <GuidedPhotobioCoach compact={compact} />
            </div>
          )}
        </>
      )}
    </>
  );

  if (collapsible && activeDef && !pickerOpen) {
    return (
      <div className={cn("rounded-xl border border-border bg-card", className)}>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 p-3 text-left"
          onClick={() => setChallengePanelCollapsed(!challengePanelCollapsed)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Target className="h-4 w-4 shrink-0 text-rose-500" />
            <span className="truncate text-sm font-medium">{activeDef.title}</span>
            <PhotobioScoreBadge score={challengeScore} compact />
          </div>
          {challengePanelCollapsed ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronUp className="h-4 w-4 shrink-0" />
          )}
        </button>
        {!challengePanelCollapsed && <div className="border-t border-border p-3 pt-0">{panelBody}</div>}
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 space-y-3", className)}>
      {modeToggle}
      {labMode === "guided" && activeChallengeId && (
        <div className="flex justify-end">
          <PhotobioScoreBadge score={challengeScore} compact />
        </div>
      )}
      {panelBody}
    </div>
  );
}
