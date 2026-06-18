/**
 * Badge de pontuação do modo guiado (0–100).
 */

import { Trophy, Star, TrendingUp, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { scoreTone, SCORE_TONE_LABELS } from "@/lib/ultrasoundTherapyScoring";

interface TherapyScoreBadgeProps {
  score: number;
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
}

const TONE_STYLES = {
  excellent: "border-amber-400/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  fair: "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  low: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
} as const;

function ToneIcon({ tone }: { tone: ReturnType<typeof scoreTone> }) {
  if (tone === "excellent") return <Trophy className="h-3.5 w-3.5" />;
  if (tone === "good") return <Star className="h-3.5 w-3.5" />;
  if (tone === "fair") return <TrendingUp className="h-3.5 w-3.5" />;
  return <AlertCircle className="h-3.5 w-3.5" />;
}

export function TherapyScoreBadge({
  score,
  compact = false,
  showLabel = true,
  className,
}: TherapyScoreBadgeProps) {
  const tone = scoreTone(score);

  if (compact) {
    return (
      <Badge
        variant="outline"
        className={cn("gap-1 font-mono text-[10px] font-bold tabular-nums", TONE_STYLES[tone], className)}
      >
        <ToneIcon tone={tone} />
        {score}
      </Badge>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2",
        TONE_STYLES[tone],
        className,
      )}
    >
      <ToneIcon tone={tone} />
      <div className="min-w-0">
        <p className="font-mono text-lg font-bold leading-none tabular-nums">{score}</p>
        {showLabel && (
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide opacity-80">
            {SCORE_TONE_LABELS[tone]}
          </p>
        )}
      </div>
    </div>
  );
}
