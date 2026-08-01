import ReactMarkdown from "react-markdown";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ActiveConditionalFeedback } from "@/types/dynamicChart";
import { resolveFeedbackMarkdown } from "@/types/dynamicChart";

interface DynamicChartFeedbackProps {
  feedback: ActiveConditionalFeedback | null;
  className?: string;
}

interface DynamicChartFeedbackPanelProps {
  feedbacks: ActiveConditionalFeedback[];
  className?: string;
}

const TYPE_STYLES = {
  info: {
    icon: Info,
    bg: "bg-sky-500/10 border-sky-500/20 text-sky-950 dark:text-sky-50",
    iconColor: "text-sky-600",
  },
  warning: {
    icon: AlertCircle,
    bg: "bg-amber-500/10 border-amber-500/20 text-amber-950 dark:text-amber-50",
    iconColor: "text-amber-600",
  },
  success: {
    icon: CheckCircle2,
    bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-950 dark:text-emerald-50",
    iconColor: "text-emerald-600",
  },
};

function DynamicChartFeedbackItem({
  feedback,
  className,
}: {
  feedback: ActiveConditionalFeedback;
  className?: string;
}) {
  const { language } = useLanguage();
  const style = TYPE_STYLES[feedback.rule.type];
  const Icon = style.icon;
  const markdown = resolveFeedbackMarkdown(feedback.rule, language);

  return (
    <div
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-2xl border px-4 py-3 backdrop-blur-md",
        style.bg,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex gap-3">
        <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", style.iconColor)} />
        <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export function DynamicChartFeedback({ feedback, className }: DynamicChartFeedbackProps) {
  if (!feedback?.isActive) {
    return (
      <div
        className={cn(
          "min-h-[72px] rounded-2xl border border-dashed border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground transition-opacity duration-300",
          className,
        )}
      >
        Ajuste os parâmetros para ver o feedback clínico.
      </div>
    );
  }

  return <DynamicChartFeedbackItem feedback={feedback} className={className} />;
}

/** Empilha múltiplos feedbacks ativos (modo all_active). */
export function DynamicChartFeedbackPanel({ feedbacks, className }: DynamicChartFeedbackPanelProps) {
  const active = feedbacks.filter((f) => f.isActive);

  if (active.length === 0) {
    return (
      <div
        className={cn(
          "min-h-[72px] rounded-2xl border border-dashed border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground transition-opacity duration-300",
          className,
        )}
      >
        Ajuste os parâmetros para ver o feedback clínico.
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {active.map((feedback) => (
        <DynamicChartFeedbackItem key={feedback.rule.id} feedback={feedback} />
      ))}
    </div>
  );
}
