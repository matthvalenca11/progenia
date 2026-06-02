import { useEffect } from "react";
import { Canvas, type CanvasProps } from "@react-three/fiber";
import { isAndroidNative, labCanvasProps, tuneLabGlCanvas } from "@/lib/labPerformance";

type LabCanvasProps = CanvasProps;

export function LabCanvas({ onCreated, ...props }: LabCanvasProps) {
  useEffect(() => {
    if (!isAndroidNative) return;

    const resume = () => {
      if (document.visibilityState !== "visible") return;
      window.dispatchEvent(new Event("resize"));
    };

    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, []);

  return (
    <Canvas
      {...labCanvasProps}
      {...props}
      onCreated={(state) => {
        tuneLabGlCanvas(state.gl.domElement);
        state.setFrameloop("always");
        onCreated?.(state);
      }}
    />
  );
}
