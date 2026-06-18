/**
 * Seletor de objetivo terapêutico — destaca camada e avalia coerência do setup.
 */

import { Target } from "lucide-react";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import {
  THERAPY_TARGET_HINTS,
  THERAPY_TARGET_LABELS,
  THERAPY_TARGET_SUGGESTIONS,
  evaluateSetupCoherence,
  STATUS_STYLES,
  type TherapyTargetGoal,
} from "./therapyUxHelpers";
import { cn } from "@/lib/utils";
import { utCard, utHint, utLabel } from "./ultrasoundTherapyUi";

const GOALS: TherapyTargetGoal[] = [
  "skin_superficial",
  "muscle_superficial",
  "muscle_deep",
  "near_bone",
  "ablation_educational",
];

export function TargetTissueSelector({ compact = false }: { compact?: boolean }) {
  const { therapyTargetGoal, setTherapyTargetGoal, config, simulationResult } =
    useUltrasoundTherapyStore();

  const coherence = therapyTargetGoal
    ? evaluateSetupCoherence(therapyTargetGoal, config, simulationResult)
    : null;
  const coherenceStyle = coherence ? STATUS_STYLES[coherence.status] : null;

  return (
    <div className={cn(utCard, compact ? "space-y-3 p-4" : "space-y-4 p-5")}>
      <div className="flex items-start gap-2">
        <Target className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" />
        <div>
          <p className={utLabel}>Objetivo do tratamento</p>
          <p className={cn("mt-1", utHint)}>
            Escolha o que você quer observar — o lab sugere parâmetros, sem alterar tudo sozinho.
          </p>
        </div>
      </div>

      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
        {GOALS.map((goal) => {
          const active = therapyTargetGoal === goal;
          return (
            <button
              key={goal}
              type="button"
              onClick={() => setTherapyTargetGoal(active ? null : goal)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-all",
                active
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border bg-background hover:border-primary/30 hover:bg-muted/50",
              )}
            >
              <p className="text-sm font-medium text-foreground">{THERAPY_TARGET_LABELS[goal]}</p>
              <p className={cn("mt-0.5 line-clamp-2", utHint)}>{THERAPY_TARGET_HINTS[goal]}</p>
            </button>
          );
        })}
      </div>

      {therapyTargetGoal && (
        <div className="space-y-3 border-t border-border pt-3">
          {coherence && coherenceStyle && (
            <div
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                coherenceStyle.border,
                coherenceStyle.bg,
              )}
            >
              <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-full align-middle", coherenceStyle.dot)} />
              {coherence.message}
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sugestões pedagógicas
            </p>
            <ul className="mt-2 space-y-1.5">
              {THERAPY_TARGET_SUGGESTIONS[therapyTargetGoal].map((s) => (
                <li key={s.label} className={cn("text-xs leading-relaxed", utHint)}>
                  <span className="font-medium text-foreground">{s.label}</span> — {s.hint}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
