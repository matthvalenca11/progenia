/**
 * Alternância Modo livre / Modo guiado.
 */

import { Sparkles, FlaskConical } from "lucide-react";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import type { TherapyLabMode } from "@/types/ultrasoundTherapyConfig";
import { cn } from "@/lib/utils";
import { utSegmentTrack, utSegmentActive, utSegmentInactive } from "./ultrasoundTherapyUi";
import { TherapyScoreBadge } from "./TherapyScoreBadge";

interface TherapyLabModeToggleProps {
  compact?: boolean;
  className?: string;
}

export function TherapyLabModeToggle({ compact = false, className }: TherapyLabModeToggleProps) {
  const { labMode, setLabMode, challengeScore, activeChallengeId } = useUltrasoundTherapyStore();

  const setMode = (mode: TherapyLabMode) => setLabMode(mode);

  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn(utSegmentTrack, compact && "gap-1 p-0.5")}>
        <button
          type="button"
          onClick={() => setMode("free")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
            labMode === "free" ? utSegmentActive : utSegmentInactive,
          )}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          Livre
        </button>
        <button
          type="button"
          onClick={() => setMode("guided")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
            labMode === "guided" ? utSegmentActive : utSegmentInactive,
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Guiado
        </button>
      </div>
      {labMode === "guided" && activeChallengeId && (
        <div className="flex justify-end">
          <TherapyScoreBadge score={challengeScore} compact />
        </div>
      )}
    </div>
  );
}
