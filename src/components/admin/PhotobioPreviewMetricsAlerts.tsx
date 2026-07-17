import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import {
  buildPhotobioConfigSafetyGroups,
  type PhotobioLabConfig,
} from "@/types/photobioLabConfig";
import { cn } from "@/lib/utils";

interface PhotobioPreviewMetricsAlertsProps {
  config: PhotobioLabConfig;
}

/** Faixa compacta de alertas — embutida no painel de métricas do preview admin. */
export function PhotobioPreviewMetricsAlerts({ config }: PhotobioPreviewMetricsAlertsProps) {
  const groups = useMemo(() => buildPhotobioConfigSafetyGroups(config), [config]);

  if (groups.length === 0) return null;

  const hasError = groups.some((group) => group.severity === "error");

  return (
    <div
      className={cn(
        "border-b px-4 py-2.5",
        hasError
          ? "border-red-500/25 bg-red-950/40"
          : "border-amber-500/25 bg-amber-950/30",
      )}
    >
      <div className="flex gap-2">
        <AlertTriangle
          className={cn(
            "mt-0.5 h-3.5 w-3.5 shrink-0",
            hasError ? "text-red-400" : "text-amber-400",
          )}
        />
        <div className="min-w-0 space-y-1.5 text-[11px] leading-snug text-slate-400">
          {groups.map((group) => (
            <p key={group.id}>
              <span
                className={cn(
                  "font-semibold",
                  group.severity === "error" ? "text-red-300" : "text-amber-300",
                )}
              >
                {group.title}
              </span>
              {group.bullets.length > 0 && (
                <span className="text-slate-300"> · {group.bullets.join(" · ")}</span>
              )}
              {group.suggestion && (
                <span className="text-slate-500"> — {group.suggestion}</span>
              )}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
