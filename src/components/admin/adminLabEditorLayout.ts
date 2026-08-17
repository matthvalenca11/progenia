import { cn } from "@/lib/utils";
import { isNativeApp } from "@/lib/capacitor";

/** Base de painel rolável — altura limitada pelo pai flex. */
const adminLabScrollPanelBaseClass = cn(
  "admin-lab-scroll-panel min-h-0 min-w-0 touch-pan-y overscroll-contain",
  "overflow-y-auto overscroll-y-contain admin-touch-scroll",
  "[-webkit-overflow-scrolling:touch]",
);

/** Página do editor de lab. */
export const adminLabEditorPageClass = cn(
  "admin-lab-editor w-full touch-pan-y bg-background native-page-top",
  isNativeApp && "flex min-h-0 flex-1 flex-col overflow-hidden",
);

/** Área abaixo do header — repassa altura, sem scroll próprio. */
export const adminLabEditorBodyClass = cn(
  "admin-lab-editor-body min-h-0 flex-1 overflow-hidden touch-pan-y",
  isNativeApp && "flex flex-col",
);

/** Wrapper do editor com grid (eletroterapia, ultrassom, etc.). */
export const adminLabEditorDualPanelEditorClass = cn(
  "admin-lab-editor-dual-editor min-h-0 flex-1 basis-0 overflow-hidden",
  "flex flex-col",
);

/** Shell quando há painel config + preview. */
export const adminLabEditorDualShellClass = cn(
  "admin-lab-editor-dual-shell container mx-auto flex w-full min-w-0 flex-col gap-4 overflow-hidden pb-2",
  isNativeApp ? "min-h-0 flex-1 basis-0" : "space-y-6 pb-8",
);

/** Abas (eletroterapia, FBM…) — preenchem altura no nativo. */
export const adminLabEditorTabsShellClass = cn(
  "admin-lab-editor-tabs-shell w-full",
  isNativeApp && "flex min-h-0 flex-1 basis-0 flex-col overflow-hidden",
);

/** Tab com grid config + preview. */
export const adminLabEditorGridTabClass = cn(
  "admin-lab-editor-grid-tab",
  isNativeApp
    ? "mt-4 flex min-h-0 flex-1 basis-0 flex-col overflow-hidden"
    : "mt-6",
);

/**
 * Dois painéis lado a lado (lg+) ou empilhados — scroll independente em cada coluna.
 * Flex + basis-0 funciona no iOS; grid com fr falha sem altura explícita.
 */
export const adminLabEditorGridClass = cn(
  "admin-lab-editor-grid flex w-full min-w-0 touch-pan-y gap-4 overflow-hidden lg:gap-6",
  "min-h-0 flex-col lg:flex-row",
  isNativeApp ? "min-h-0 flex-1 basis-0" : "h-[min(calc(100dvh-13rem),920px)] lg:h-[calc(100dvh-9rem)]",
);

/** Coluna esquerda — configuração. */
export const adminLabConfigColumnClass = cn(
  "admin-lab-config-column min-w-0 space-y-6",
  adminLabScrollPanelBaseClass,
  isNativeApp ? "min-h-0 flex-1 basis-0" : "min-h-0",
);

/** Coluna direita — pré-visualização. */
export const adminLabPreviewColumnClass = cn(
  "admin-lab-preview-column min-w-0 space-y-4",
  adminLabScrollPanelBaseClass,
  isNativeApp ? "min-h-0 flex-1 basis-0 lg:flex-none lg:basis-auto" : "min-h-0",
);

/** Frame de canvas. */
export const adminLabCanvasFrameClass =
  "relative w-full overflow-hidden touch-pan-y [&_canvas]:touch-none";

/** Conteúdo sem grid (ex.: escolha de tipo). */
export const adminLabEditorSimpleScrollClass = cn(
  "container mx-auto min-h-0 w-full space-y-6 overflow-y-auto overscroll-contain pb-8 touch-pan-y admin-touch-scroll",
  "[-webkit-overflow-scrolling:touch]",
  isNativeApp && "flex-1 basis-0",
);
