import { useEffect, useState } from "react";
import {
  Bluetooth,
  Camera,
  ChevronDown,
  CircleGauge,
  Power,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { AR_SLICE_CAMERA } from "@/features/ar-slice/arSliceSceneConfig";
import { useArSliceStore } from "@/features/ar-slice/arSliceStore";
import { AxisCalibrationDialog } from "@/features/ar-slice/components/AxisCalibrationDialog";
import { useArSliceMriStore } from "@/features/ar-slice/mri/arSliceMriStore";

type Props = {
  onConnectBle: () => void;
  onDisconnect: () => void;
  onZero: () => void;
  connectStatus?: string | null;
};

export function ArSliceControls({
  onConnectBle,
  onDisconnect,
  onZero,
  connectStatus = null,
}: Props) {
  const {
    connectionState,
    error,
    depthOffset,
    autoSliceFromGravity,
    cameraDistance,
    cameraEnabled,
    frameTrackingEnabled,
    axisCalStep,
    hasLocalZero,
    lastPacketAgeMs,
    sampleHz,
    setCameraDistance,
    setDepthOffset,
    setAutoSliceFromGravity,
    setCameraEnabled,
    setFrameTrackingEnabled,
    startAxisCalibration,
  } = useArSliceStore();

  const mriLoading = useArSliceMriStore((s) => s.loading);
  const mriError = useArSliceMriStore((s) => s.error);
  const mriReady = useArSliceMriStore((s) => !!s.volume);
  const [panelOpen, setPanelOpen] = useState(true);

  const connected =
    connectionState === "streaming" || connectionState === "connected";
  const connecting =
    connectionState === "connecting" ||
    connectionState === "scanning" ||
    connectionState === "reconnecting";
  const streamHealthy = connected && lastPacketAgeMs < 1_000;
  const arModeEnabled = cameraEnabled && frameTrackingEnabled;

  useEffect(() => {
    if (connectionState === "streaming") setPanelOpen(false);
  }, [connectionState]);

  const toggleArMode = (enabled: boolean) => {
    setCameraEnabled(enabled);
    setFrameTrackingEnabled(enabled);
  };

  if (!panelOpen) {
    return (
      <>
        <AxisCalibrationDialog />
        <div className="pointer-events-auto flex max-w-full items-center gap-2">
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="flex h-11 items-center gap-2.5 rounded-full border border-white/10 bg-slate-950/88 px-3.5 text-xs text-slate-100 shadow-xl backdrop-blur-xl"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                streamHealthy ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            <Bluetooth className="h-4 w-4 text-cyan-300" />
            <span className="font-semibold">BLE</span>
            <span className="font-mono text-cyan-200">{sampleHz} Hz</span>
            {mriReady ? <span className="text-slate-400">RM</span> : null}
          </button>
          <Button
            size="sm"
            className="h-11 rounded-full px-4 shadow-xl"
            onClick={onZero}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Zerar
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <AxisCalibrationDialog />
      <section className="pointer-events-auto w-full max-w-[22rem] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 text-slate-100 shadow-2xl backdrop-blur-xl">
        <header className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                streamHealthy
                  ? "bg-emerald-500/15 text-emerald-300"
                  : connecting
                    ? "bg-cyan-500/15 text-cyan-300"
                    : "bg-white/8 text-slate-400"
              }`}
            >
              <Bluetooth className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">AR Slice</h2>
              <p className="truncate text-[11px] text-slate-400">
                {connecting
                  ? connectStatus || "Conectando…"
                  : connected
                    ? `Bluetooth conectado · ${sampleHz} Hz`
                    : "Moldura desconectada"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Minimizar controles"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[min(55vh,30rem)] space-y-3 overflow-y-auto p-4">
          {!connected ? (
            <Button
              className="h-11 w-full rounded-xl"
              disabled={connecting}
              onClick={onConnectBle}
            >
              <Bluetooth className="mr-2 h-4 w-4" />
              {connecting ? "Preparando Bluetooth…" : "Conectar moldura"}
            </Button>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-emerald-200">
                  Moldura pronta
                </p>
                <p className="text-[10px] text-slate-400">
                  {sampleHz} Hz · atraso {lastPacketAgeMs.toFixed(0)} ms
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-slate-300 hover:text-white"
                onClick={onDisconnect}
              >
                <Power className="mr-1.5 h-3.5 w-3.5" />
                Sair
              </Button>
            </div>
          )}

          {error ? (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs leading-relaxed text-amber-200">
              {error}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={arModeEnabled ? "default" : "secondary"}
              className="h-10 rounded-xl"
              onClick={() => toggleArMode(!arModeEnabled)}
            >
              <Camera className="mr-1.5 h-4 w-4" />
              {arModeEnabled ? "AR ligado" : "Ligar AR"}
            </Button>
            <Button
              variant="secondary"
              className="h-10 rounded-xl"
              disabled={!connected}
              onClick={onZero}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              {hasLocalZero ? "Rezerar" : "Zerar"}
            </Button>
          </div>

          <Button
            variant="outline"
            className="h-10 w-full rounded-xl border-white/10 bg-white/5"
            disabled={!connected || axisCalStep > 0}
            onClick={startAxisCalibration}
          >
            <CircleGauge className="mr-2 h-4 w-4 text-cyan-300" />
            Calibrar movimento da fatia
          </Button>

          <details className="group rounded-xl border border-white/8 bg-white/[0.03]">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-medium text-slate-300">
              Ajustes da visualização
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <div className="space-y-4 border-t border-white/8 px-3 pb-3 pt-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-300">Zoom</Label>
                  <span className="font-mono text-[10px] text-slate-500">
                    {cameraDistance.toFixed(1)} m
                  </span>
                </div>
                <Slider
                  value={[cameraDistance]}
                  min={AR_SLICE_CAMERA.min}
                  max={AR_SLICE_CAMERA.max}
                  step={0.1}
                  onValueChange={(value) => setCameraDistance(value[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-300">
                    Posição da fatia
                  </Label>
                  <span className="font-mono text-[10px] text-slate-500">
                    {depthOffset.toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[depthOffset]}
                  min={-0.9}
                  max={0.9}
                  step={0.01}
                  onValueChange={(value) => setDepthOffset(value[0])}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-xs text-slate-300">
                    Seguir inclinação
                  </Label>
                  <p className="text-[10px] text-slate-500">
                    Move a fatia com a moldura
                  </p>
                </div>
                <Switch
                  checked={autoSliceFromGravity}
                  onCheckedChange={setAutoSliceFromGravity}
                />
              </div>
            </div>
          </details>

          {mriLoading ? (
            <p className="text-center text-[11px] text-cyan-200">
              Carregando ressonância…
            </p>
          ) : null}
          {mriError ? (
            <p className="text-center text-[11px] text-amber-300">
              Não foi possível carregar a ressonância.
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
