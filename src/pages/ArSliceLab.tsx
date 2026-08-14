import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LabCanvasHost, LabCanvasSurface } from "@/components/labs/LabCanvasSurface";
import {
  isAndroidNative,
  isNativeMobile,
  labCanvasStableProps,
} from "@/lib/labPerformance";
import { ArSliceScene } from "@/features/ar-slice/components/ArSliceScene";
import { ArSliceControls } from "@/features/ar-slice/components/ArSliceControls";
import { ArSliceOnboardingDialog } from "@/features/ar-slice/components/ArSliceOnboardingDialog";
import { useArSliceTransport } from "@/features/ar-slice/useArSliceTransport";
import { useArCamera } from "@/features/ar-slice/useArCamera";
import { useFrameTracker } from "@/features/ar-slice/vision/useFrameTracker";
import { useArSliceStore } from "@/features/ar-slice/arSliceStore";
import { cn } from "@/lib/utils";

export default function ArSliceLab() {
  const navigate = useNavigate();
  const {
    connectBleStream,
    connectDeviceMotion,
    disconnect,
    writeZero,
    writeCalibrationCommand,
    connectStatus,
    wifiMode,
    nativeRxHz,
    wsTxHz,
    bleHandTrackingEnabled,
    bleHandTrackingActive,
    setBleHandTrackingEnabled,
  } = useArSliceTransport();
  const cameraEnabled = useArSliceStore((s) => s.cameraEnabled);
  const frameTrackingEnabled = useArSliceStore((s) => s.frameTrackingEnabled);
  const { mode: cameraMode, error: cameraError, videoRef } = useArCamera(cameraEnabled);
  useFrameTracker({
    enabled: frameTrackingEnabled && cameraEnabled,
    cameraMode,
    videoRef,
  });
  const transparent = cameraEnabled && (cameraMode === "native" || cameraMode === "web");

  return (
    <div
      className={cn(
        "ar-slice-lab relative flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden",
        transparent ? "bg-transparent" : "bg-slate-950",
      )}
    >
      <ArSliceOnboardingDialog />
      {cameraEnabled && (
        <video
          ref={videoRef}
          className={cn(
            "pointer-events-none absolute inset-0 h-full w-full object-cover",
            cameraMode === "web" ? "opacity-100" : "opacity-0",
          )}
          playsInline
          muted
          autoPlay
        />
      )}

      <div className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex items-start px-3 safe-top">
        <Button
          variant="ghost"
          size="icon"
          className="pointer-events-auto h-9 w-9 shrink-0 text-slate-100 hover:bg-white/10"
          onClick={() => navigate(-1)}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <div className="relative z-10 min-h-0 flex-1 touch-none">
        <LabCanvasHost className={cn("touch-none", transparent ? "!bg-transparent" : undefined)}>
          <LabCanvasSurface
            {...labCanvasStableProps}
            dpr={
              isAndroidNative
                ? 1
                : isNativeMobile
                  ? [1.5, 2]
                  : labCanvasStableProps.dpr
            }
            shadows={false}
            gl={{
              ...labCanvasStableProps.gl,
              antialias: !isAndroidNative,
              alpha: true,
              // Premultiplied alpha is required for WKWebView to composite the
              // hologram over the native ARKit camera feed on iOS.
              premultipliedAlpha: true,
              powerPreference: "high-performance",
            }}
            hostClassName={transparent ? "!bg-transparent" : undefined}
            style={transparent ? { background: "transparent" } : undefined}
            onCreated={({ gl, scene }) => {
              gl.setClearColor(0x000000, transparent ? 0 : 1);
              gl.domElement.style.background = "transparent";
              if (transparent) scene.background = null;
            }}
          >
            <ArSliceScene transparent={transparent} />
          </LabCanvasSurface>
        </LabCanvasHost>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
        <ArSliceControls
          onConnectBle={() => void connectBleStream()}
          onConnectDeviceMotion={() => void connectDeviceMotion()}
          onDisconnect={() => void disconnect()}
          onZero={() => void writeZero()}
          handTrackingEnabled={bleHandTrackingEnabled}
          handTrackingActive={bleHandTrackingActive}
          onHandTrackingEnabledChange={setBleHandTrackingEnabled}
          onCalibrationCommand={writeCalibrationCommand}
          connectStatus={connectStatus}
          linkMode={wifiMode}
          rawRxHz={nativeRxHz}
          wsTxHz={wsTxHz}
        />
      </div>

      {cameraError && (
        <p className="safe-top absolute right-3 z-30 max-w-xs rounded-md bg-amber-950/80 px-2 py-1 text-xs text-amber-200">
          Câmera: {cameraError}
        </p>
      )}
    </div>
  );
}
