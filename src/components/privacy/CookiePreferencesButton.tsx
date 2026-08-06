import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConsent } from "@/contexts/ConsentContext";
import { cn } from "@/lib/utils";
import { Cookie } from "lucide-react";

type Props = {
  /** Texto visível (ex.: rodapé). Se omitido, usa só ícone + tooltip. */
  variant?: "icon" | "text";
  className?: string;
  /** Empilha acima do FAB do Tutor de IA, mantendo o canto inferior direito. */
  shiftUpForAiTutorFab?: boolean;
};

/**
 * Acesso contínuo às preferências de cookies (LGPD): deve permanecer disponível,
 * mas não precisa ser um CTA grande; ícone discreto ou link em rodapé é suficiente.
 */
export const CookiePreferencesButton = ({
  variant = "icon",
  className,
  shiftUpForAiTutorFab,
}: Props) => {
  const { openPreferences, ready, hasDecision } = useConsent();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!ready) return null;

  if (variant === "icon") {
    if (!hasDecision) return null;

    const shellClass = cn(
      "pointer-events-none fixed z-[48]",
      shiftUpForAiTutorFab
        ? cn(
            "bottom-[calc(var(--sab,env(safe-area-inset-bottom,0px))+0.5rem)] right-[calc(var(--sar,env(safe-area-inset-right,0px))+1.25rem)]",
            "lg:bottom-[calc(var(--sab,env(safe-area-inset-bottom,0px))+0.625rem)] lg:right-[calc(var(--sar,env(safe-area-inset-right,0px))+1.5rem)]",
          )
        : cn(
            "bottom-[var(--sab,env(safe-area-inset-bottom,0px))] right-[calc(var(--sar,env(safe-area-inset-right,0px))+1.25rem)]",
            "lg:bottom-[calc(var(--sab,env(safe-area-inset-bottom,0px))+0.375rem)] lg:right-[calc(var(--sar,env(safe-area-inset-right,0px))+1.5rem)]",
          ),
      className,
    );

    const buttonClass =
      "pointer-events-auto !h-9 !w-9 shrink-0 rounded-full border border-border/60 bg-background/90 text-muted-foreground shadow-md backdrop-blur-sm transition-opacity hover:bg-muted/80 hover:text-foreground supports-[backdrop-filter]:bg-background/75";

    const node = (
      <div className={shellClass} aria-hidden={false}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={openPreferences}
              aria-label="Preferências de cookies"
              className={buttonClass}
            >
              <Cookie className="h-4 w-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[220px] text-xs">
            Preferências de cookies e privacidade
          </TooltipContent>
        </Tooltip>
      </div>
    );

    if (!mounted || typeof document === "undefined") return null;
    return createPortal(node, document.body);
  }

  return (
    <Button type="button" variant="link" className={className} onClick={openPreferences}>
      Preferências de cookies
    </Button>
  );
};
