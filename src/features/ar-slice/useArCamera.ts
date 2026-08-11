import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { isNativeApp } from "@/lib/capacitor";
import { ProgeniaArFrame } from "@/features/ar-slice/vision/ProgeniaArFrame";

type CameraMode = "off" | "native" | "web" | "error";

/**
 * Native: ARKit world-tracking camera behind a transparent WebView.
 * Web: getUserMedia video element as CSS background.
 */
export function useArCamera(enabled: boolean) {
  const [mode, setMode] = useState<CameraMode>("off");
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeRunning = useRef(false);
  const startInFlight = useRef(false);

  const stopWeb = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stopNative = useCallback(async () => {
    if (!nativeRunning.current && !startInFlight.current) return;
    startInFlight.current = false;
    try {
      await ProgeniaArFrame.stopMixedReality();
    } catch {
      // ignore
    }
    nativeRunning.current = false;
    document.documentElement.classList.remove("ar-slice-camera-bg");
  }, []);

  const startNative = useCallback(async () => {
    if (nativeRunning.current || startInFlight.current) return;
    startInFlight.current = true;
    try {
      await ProgeniaArFrame.startMixedReality();
      nativeRunning.current = true;
      document.documentElement.classList.add("ar-slice-camera-bg");
      setMode("native");
      setError(null);
    } finally {
      startInFlight.current = false;
    }
  }, []);

  const startWeb = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Câmera web não suportada neste navegador");
    }
    if (streamRef.current) {
      setMode("web");
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    setMode("web");
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!enabled) {
        await stopNative();
        stopWeb();
        if (!cancelled) setMode("off");
        return;
      }

      setError(null);
      try {
        if (isNativeApp) {
          await startNative();
        } else {
          await startWeb();
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Falha ao abrir câmera");
        setMode("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, startNative, startWeb, stopNative, stopWeb]);

  useEffect(() => {
    return () => {
      void stopNative();
      stopWeb();
    };
  }, [stopNative, stopWeb]);

  useEffect(() => {
    if (!isNativeApp || !enabled) return;
    const sub = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        void stopNative().then(() => setMode("off"));
      } else if (enabled && !nativeRunning.current) {
        void startNative().catch(() => undefined);
      }
    });
    return () => {
      void sub.then((s) => s.remove());
    };
  }, [enabled, startNative, stopNative]);

  return { mode, error, videoRef };
}
