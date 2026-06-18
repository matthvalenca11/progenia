/** Classes Tailwind compatíveis com light/dark via variáveis CSS do tema */

export const utCard = "rounded-xl border border-border bg-card shadow-sm";

export const utLabel =
  "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export const utInputShell =
  "rounded-lg border border-border bg-background px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-foreground";

export const utSelectTrigger = "rounded-lg border-border bg-background text-xs shadow-sm";

export const utPanel = "bg-card";

export const utHint = "text-xs text-muted-foreground";

export const utSegmentTrack = "grid grid-cols-2 gap-2 rounded-xl bg-muted/80 p-1";

export const utSegmentActive =
  "border-primary bg-primary text-primary-foreground shadow-md";

export const utSegmentInactive =
  "border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground";

export const utAccordionItem =
  "overflow-hidden rounded-xl border border-border bg-card shadow-sm border-b-0 transition-all duration-200 ease-in-out";

export const utAccordionTrigger =
  "px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-all duration-200 ease-in-out hover:no-underline hover:bg-muted hover:text-foreground [&[data-state=open]]:bg-muted/90 [&[data-state=open]]:text-foreground";

/** Oculta painel Camadas do modo Visão Geral até a UX estar pronta. */
export const SHOW_PROPAGATION_LAYERS_PANEL = false;
