import { Flame } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { WeeklyStreakSnapshot } from "@/lib/streak/weeklyStreakLogic";

type Props = {
  snapshot: WeeklyStreakSnapshot;
  isEnglish: boolean;
  compact?: boolean;
};

export function WeeklyStreakSummary({ snapshot, isEnglish, compact = false }: Props) {
  const lang = isEnglish ? "en" : "pt";

  if (snapshot.weeks <= 0 && !snapshot.lastCapsuleAt) {
    return (
      <div className={cn("rounded-lg border border-dashed border-orange-500/30 bg-orange-500/5 p-3", compact && "p-2.5")}>
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <p className="text-sm font-medium">
            {lang === "en" ? "Weekly streak" : "Ofensiva semanal"}
          </p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {lang === "en"
            ? "Complete a capsule to start your streak. You have 7 days per cycle."
            : "Complete uma cápsula para iniciar sua ofensiva. Você tem 7 dias em cada ciclo."}
        </p>
      </div>
    );
  }

  if (snapshot.isExpired) {
    return (
      <div className={cn("rounded-lg border border-border bg-muted/40 p-3", compact && "p-2.5")}>
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">
            {lang === "en" ? "Streak reset" : "Ofensiva reiniciada"}
          </p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {lang === "en"
            ? "A full week passed without a capsule. Complete one now to start again."
            : "Passou uma semana sem cápsulas. Complete uma agora para recomeçar."}
        </p>
      </div>
    );
  }

  const weekLabel =
    lang === "en"
      ? snapshot.weeks === 1
        ? "1 week"
        : `${snapshot.weeks} weeks`
      : snapshot.weeks === 1
        ? "1 semana"
        : `${snapshot.weeks} semanas`;

  const timeLeft =
    snapshot.daysRemaining > 1
      ? lang === "en"
        ? `${snapshot.daysRemaining} days left`
        : `${snapshot.daysRemaining} dias restantes`
      : snapshot.hoursRemaining > 1
        ? lang === "en"
          ? `${snapshot.hoursRemaining} hours left`
          : `${snapshot.hoursRemaining} horas restantes`
        : lang === "en"
          ? "Less than 1 hour left"
          : "Menos de 1 hora";

  const progressPct = Math.min(
    100,
    Math.max(0, ((7 * 24 * 60 * 60 * 1000 - snapshot.msUntilDeadline) / (7 * 24 * 60 * 60 * 1000)) * 100),
  );

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        snapshot.isUrgent
          ? "border-red-500/40 bg-red-500/5"
          : snapshot.isAtRisk
            ? "border-orange-500/40 bg-orange-500/5"
            : "border-orange-500/25 bg-orange-500/5",
        compact && "p-2.5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Flame
            className={cn(
              "h-4 w-4 shrink-0",
              snapshot.isUrgent ? "text-red-500" : "text-orange-500",
            )}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">
              {lang === "en" ? `${weekLabel} streak` : `Ofensiva de ${weekLabel}`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lang === "en"
                ? "Complete at least one capsule every 7 days"
                : "Complete pelo menos uma cápsula a cada 7 dias"}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "text-xs font-semibold shrink-0",
            snapshot.isUrgent ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400",
          )}
        >
          {timeLeft}
        </span>
      </div>
      <Progress value={progressPct} className="mt-3 h-1.5" />
      {snapshot.isAtRisk && (
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          {snapshot.isUrgent
            ? lang === "en"
              ? "Only a few hours left — finish a capsule to keep your streak."
              : "Só faltam algumas horas — conclua uma cápsula para manter a ofensiva."
            : lang === "en"
              ? "1 day left in this cycle. Complete a capsule to stay on track."
              : "Falta 1 dia neste ciclo. Complete uma cápsula para não perder a ofensiva."}
        </p>
      )}
    </div>
  );
}
