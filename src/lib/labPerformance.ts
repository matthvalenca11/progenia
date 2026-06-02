import { Capacitor } from "@capacitor/core";
import type { CanvasProps } from "@react-three/fiber";

export const isAndroidNative =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

export const isNativeMobile =
  Capacitor.isNativePlatform() &&
  (Capacitor.getPlatform() === "ios" || Capacitor.getPlatform() === "android");

/** DPR menor no Android WebView evita sobrecarga de GPU nos labs 3D. */
export const labCanvasDpr: [number, number] | number = isAndroidNative ? 1 : [1, 2];

export const labGlProps = {
  antialias: !isAndroidNative,
  alpha: true,
  powerPreference: "high-performance" as const,
  preserveDrawingBuffer: false,
};

export const labCanvasShadows = !isAndroidNative;

/**
 * Props padrão para Canvas nos labs.
 * No Android: frameloop fixo em "always" (evita tela estática) e sem adaptive performance.
 */
export const labCanvasProps: Partial<CanvasProps> = {
  dpr: labCanvasDpr,
  gl: labGlProps,
  frameloop: "always",
  shadows: labCanvasShadows,
  resize: { scroll: false, debounce: { scroll: 50, resize: 0 } },
  ...(isAndroidNative
    ? {}
    : {
        performance: { min: 0.5, max: 1.5, debounce: 200 },
      }),
};

export function tuneLabGlCanvas(canvas: HTMLCanvasElement) {
  canvas.style.touchAction = "none";
  canvas.style.userSelect = "none";
  canvas.style.webkitUserSelect = "none";
}
