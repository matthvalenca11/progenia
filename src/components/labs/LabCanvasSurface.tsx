import { type ReactNode, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { LabCanvas } from "@/components/labs/LabCanvas";
import type { CanvasProps } from "@react-three/fiber";
import { isNativeLabRuntime } from "@/lib/labRuntime";
import { cn } from "@/lib/utils";

type LabCanvasSurfaceProps = CanvasProps & {
  hostClassName?: string;
  loadingLabel?: string;
};

/**
 * No app nativo, espera o container ter tamanho antes de montar WebGL
 * (WebView Android costuma renderizar frame estático se o Canvas nasce com 0×0).
 */
export function LabCanvasSurface({
  hostClassName,
  loadingLabel = "Iniciando visualização 3D…",
  className,
  style,
  children,
  ...canvasProps
}: LabCanvasSurfaceProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hostReady, setHostReady] = useState(!isNativeLabRuntime);

  useEffect(() => {
    if (!isNativeLabRuntime) return;

    const el = hostRef.current;
    if (!el) return;

    let raf = 0;
    const markReady = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width >= 2 && height >= 2) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => setHostReady(true));
      }
    };

    markReady();
    const observer = new ResizeObserver(markReady);
    observer.observe(el);
    const retry = window.setInterval(markReady, 120);
    const timeout = window.setTimeout(() => setHostReady(true), 800);

    return () => {
      observer.disconnect();
      window.clearInterval(retry);
      window.clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, []);

  const hostClasses = cn("absolute inset-0 min-h-0 min-w-0", hostClassName);

  if (!hostReady) {
    return (
      <div ref={hostRef} className={hostClasses} style={style}>
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-950/90 px-4 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
          <p className="text-xs text-slate-400">{loadingLabel}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={hostRef} className={hostClasses} style={style}>
      <LabCanvas className={cn("!h-full !w-full !max-w-full !min-w-0", className)} style={{ display: "block" }} {...canvasProps}>
        {children}
      </LabCanvas>
    </div>
  );
}

export function LabCanvasHost({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("lab-canvas-host absolute inset-0 min-h-0 min-w-0 max-w-full overflow-hidden", className)}>{children}</div>;
}
