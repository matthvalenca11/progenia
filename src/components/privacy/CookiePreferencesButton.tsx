import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConsent } from "@/contexts/ConsentContext";
import { cn } from "@/lib/utils";
import { Cookie } from "lucide-react";

type Props = {
  /** Texto visível (ex.: rodapé). Se omitido, usa só ícone + tooltip. */
  variant?: "icon" | "text";
  className?: string;
  /**
   * No desktop, posiciona o ícone à esquerda do FAB do Tutor de IA.
   */
  shiftUpForAiTutorFab?: boolean;
};

/**
 * Acesso contínuo às preferências de cookies (LGPD): deve permanecer disponível,
 * mas não precisa ser um CTA grande; ícone discreto ou link em rodapé é suficiente.
 */
export const CookiePreferencesButton = ({ variant = "icon", className, shiftUpForAiTutorFab }: Props) => {
  const { openPreferences, ready, hasDecision } = useConsent();

  if (!ready) return null;

  if (variant === "icon") {
    if (!hasDecision) return null;
    const iconFabClass = cn(
      "fixed right-[max(0.75rem,env(safe-area-inset-right))] z-[35] h-9 w-9 rounded-full border border-border/60 bg-background/85 text-muted-foreground shadow-sm backdrop-blur-sm transition-opacity hover:bg-muted/80 hover:text-foreground supports-[backdrop-filter]:bg-background/70",
      "bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
      shiftUpForAiTutorFab && "md:bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem+0.625rem)]",
      shiftUpForAiTutorFab && "md:right-[calc(env(safe-area-inset-right,0px)+1.5rem+9.5rem)]",
    );
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={openPreferences}
            aria-label="Preferências de cookies"
            className={className ? cn(iconFabClass, className) : iconFabClass}
          >
            <Cookie className="h-4 w-4" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[220px] text-xs">
          Preferências de cookies e privacidade
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button type="button" variant="link" className={className} onClick={openPreferences}>
      Preferências de cookies
    </Button>
  );
};
