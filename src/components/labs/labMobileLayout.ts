import { cn } from "@/lib/utils";

/** Padding horizontal simétrico dos painéis mobile em labs. */
export function labMobileInsetX(embedded = false) {
  return embedded ? "px-3" : "lab-mobile-inset-x";
}

/** Coluna de abas + conteúdo com um único gutter horizontal. */
export function labMobilePanelClass(embedded = false) {
  return cn(
    labMobileInsetX(embedded),
    "box-border flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden bg-card",
  );
}

/** Shell base: largura contida, sem clip horizontal (evita cortar bordas à direita). */
export const labMobileShellClass =
  "box-border w-full min-w-0 max-w-full";

/** Grid mobile: cada linha respeita a largura do pai (canvas 3D não estica o grid). */
export const labMobileGridClass = `${labMobileShellClass} lab-mobile-grid grid overflow-hidden [&>*]:min-w-0 [&>*]:max-w-full`;

/** Coluna mobile (TENS/MRI/Foto): mesma contenção de largura por filho. */
export const labMobileFlexClass = `${labMobileShellClass} flex flex-col overflow-hidden [&>*]:min-w-0 [&>*]:max-w-full`;

/** Host de canvas WebGL — isola largura intrínseca do canvas. */
export const labCanvasHostClass =
  "lab-canvas-host absolute inset-0 min-h-0 min-w-0 max-w-full overflow-hidden";
