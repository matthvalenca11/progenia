import { useEffect, useState } from "react";
import {
  Bluetooth,
  ChevronDown,
  CircleGauge,
  Power,
  RotateCcw,
  Settings2,
  Snowflake,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { AR_SLICE_CAMERA } from "@/features/ar-slice/arSliceSceneConfig";
import { useArSliceStore } from "@/features/ar-slice/arSliceStore";
import { AxisCalibrationDialog } from "@/features/ar-slice/components/AxisCalibrationDialog";
import { ArSliceOnboardingTrigger } from "@/features/ar-slice/components/ArSliceOnboardingDialog";
import {
  MEDICAL_VOLUME_PRESETS,
  type MedicalImagingModality,
  useArSliceMriStore,
} from "@/features/ar-slice/mri/arSliceMriStore";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Capacitor } from "@capacitor/core";

type Props = {
  onConnectBle: () => void;
  onConnectDeviceMotion: () => void;
  onDisconnect: () => void;
  onZero: () => void;
  handTrackingEnabled?: boolean;
  handTrackingActive?: boolean;
  onHandTrackingEnabledChange?: (enabled: boolean) => void;
  onCalibrationCommand: (command: "CAL_START" | "CAL_CANCEL" | "CAL_SAVE") => void;
  connectStatus?: string | null;
  linkMode?: string | null;
  rawRxHz?: number;
  wsTxHz?: number;
};

export function ArSliceControls({
  onConnectBle,
  onConnectDeviceMotion,
  onDisconnect,
  onZero,
  handTrackingEnabled = true,
  handTrackingActive = false,
  onHandTrackingEnabledChange,
  onCalibrationCommand,
  connectStatus = null,
  linkMode = null,
  rawRxHz = 0,
  wsTxHz = 0,
}: Props) {
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const isAndroid = Capacitor.getPlatform() === "android";
  // Selector-only: a bare useArSliceStore() re-renders on every telemetry tick.
  const connectionState = useArSliceStore((s) => s.connectionState);
  const transport = useArSliceStore((s) => s.transport);
  const error = useArSliceStore((s) => s.error);
  const depthOffset = useArSliceStore((s) => s.depthOffset);
  const autoSliceFromGravity = useArSliceStore((s) => s.autoSliceFromGravity);
  const linearGestureGain = useArSliceStore((s) => s.linearGestureGain);
  const invertLinearDepth = useArSliceStore((s) => s.invertLinearDepth);
  const cameraDistance = useArSliceStore((s) => s.cameraDistance);
  const axisCalStep = useArSliceStore((s) => s.axisCalStep);
  const imuHealth = useArSliceStore((s) => s.imuHealth);
  const hasLocalZero = useArSliceStore((s) => s.hasLocalZero);
  const poseFrozen = useArSliceStore((s) => s.poseFrozen);
  const lastPacketAgeMs = useArSliceStore((s) => s.lastPacketAgeMs);
  const sampleHz = useArSliceStore((s) => s.sampleHz);
  const setCameraDistance = useArSliceStore((s) => s.setCameraDistance);
  const setDepthOffset = useArSliceStore((s) => s.setDepthOffset);
  const setAutoSliceFromGravity = useArSliceStore((s) => s.setAutoSliceFromGravity);
  const setLinearGestureGain = useArSliceStore((s) => s.setLinearGestureGain);
  const setInvertLinearDepth = useArSliceStore((s) => s.setInvertLinearDepth);
  const setPoseFrozen = useArSliceStore((s) => s.setPoseFrozen);
  const startAxisCalibration = useArSliceStore((s) => s.startAxisCalibration);

  const mriLoading = useArSliceMriStore((s) => s.loading);
  const mriError = useArSliceMriStore((s) => s.error);
  const mriReady = useArSliceMriStore((s) => !!s.volume);
  const activeModality = useArSliceMriStore((s) => s.activeModality);
  const setActiveModality = useArSliceMriStore((s) => s.setActiveModality);
  const modalityLabel = (modality: MedicalImagingModality) => {
    if (!isEnglish) return MEDICAL_VOLUME_PRESETS[modality].label;
    if (modality === "mri") return "MRI";
    if (modality === "ct") return "CT";
    if (modality === "petct") return "PET/CT";
    return "PET";
  };
  const modalityDescription = (modality: MedicalImagingModality) => {
    if (!isEnglish) return MEDICAL_VOLUME_PRESETS[modality].longLabel;
    if (modality === "mri") return "T1 magnetic resonance imaging";
    if (modality === "ct") return "Computed tomography";
    if (modality === "petct") return "PET/CT fusion in MNI space";
    return "Brain 18F-FDG PET";
  };
  const [panelOpen, setPanelOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const connected =
    connectionState === "streaming" || connectionState === "connected";
  const connecting =
    connectionState === "connecting" ||
    connectionState === "scanning" ||
    connectionState === "reconnecting";
  // Prefer Hz: brief main-thread spikes inflate packetAge without a real disconnect.
  const streamHealthy =
    connected && (sampleHz >= 12 || lastPacketAgeMs < 1_800);
  const usingDeviceMotion = transport === "device-motion";

  useEffect(() => {
    if (connectionState === "streaming") setPanelOpen(false);
  }, [connectionState]);

  if (!panelOpen) {
    return (
      <>
        <AxisCalibrationDialog onCalibrationCommand={onCalibrationCommand} />
        {/* Left cluster: status + zero only */}
        <div className="pointer-events-none flex w-full items-end justify-between gap-3 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:px-4">
          <div className="pointer-events-auto flex min-w-0 flex-1 flex-wrap items-center gap-2 pr-2">
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="flex h-11 max-w-full items-center gap-2.5 rounded-full border border-white/10 bg-slate-950/88 px-3.5 text-xs text-slate-100 shadow-xl backdrop-blur-xl"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  streamHealthy ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              {usingDeviceMotion ? (
                <Smartphone className="h-4 w-4 shrink-0 text-cyan-300" />
              ) : (
                <Bluetooth className="h-4 w-4 shrink-0 text-cyan-300" />
              )}
              <span className="font-semibold">
                {usingDeviceMotion ? "Aparelho" : "BLE"}
              </span>
              <span className="font-mono text-cyan-200">{sampleHz} Hz</span>
              <span className="font-mono text-[10px] text-slate-400">
                RX {rawRxHz} · WS {wsTxHz}
              </span>
              {mriReady ? (
                <span className="text-slate-400">
                  {modalityLabel(activeModality)}
                </span>
              ) : null}
            </button>
            <Button
              size="sm"
              className="h-11 shrink-0 rounded-full px-4 shadow-xl"
              onClick={onZero}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Zerar
            </Button>
          </div>

          <div className="pointer-events-auto mb-0.5 flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(true);
                setPanelOpen(true);
              }}
              aria-label={isEnglish ? "Open settings" : "Abrir ajustes"}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-slate-950/70 text-slate-100 shadow-lg backdrop-blur-md transition hover:bg-white/10 active:scale-95"
            >
              <Settings2 className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              disabled={!connected}
              onClick={() => setPoseFrozen(!poseFrozen)}
              aria-label={poseFrozen ? "Desfreezar posição" : "Freezar posição"}
              aria-pressed={poseFrozen}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition active:scale-95 disabled:opacity-40",
                poseFrozen
                  ? "border-cyan-300/55 bg-cyan-400 text-slate-950"
                  : "border-white/20 bg-slate-950/70 text-slate-100",
              )}
            >
              <Snowflake className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AxisCalibrationDialog onCalibrationCommand={onCalibrationCommand} />
      <div className="px-3 pb-3 md:px-4 md:pb-4">
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
                {usingDeviceMotion ? (
                  <Smartphone className="h-4.5 w-4.5" />
                ) : (
                  <Bluetooth className="h-4.5 w-4.5" />
                )}
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">AR Slice</h2>
                <p className="truncate text-[11px] text-slate-400">
                  {connecting
                    ? connectStatus || "Conectando…"
                    : connected
                      ? `${usingDeviceMotion ? "Sensores do aparelho" : "Bluetooth conectado"} · ${sampleHz} Hz`
                      : "Escolha uma fonte de movimento"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ArSliceOnboardingTrigger className="text-slate-400 hover:text-white hover:bg-white/10" />
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Minimizar controles"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="max-h-[min(55vh,30rem)] space-y-3 overflow-y-auto p-4">
            {!connected ? (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="h-16 rounded-xl"
                  disabled={connecting}
                  onClick={onConnectBle}
                >
                  <span className="flex flex-col items-center gap-1">
                    <Bluetooth className="h-4 w-4" />
                    <span>Moldura BLE</span>
                  </span>
                </Button>
                <Button
                  variant="secondary"
                  className="h-16 rounded-xl"
                  disabled={connecting}
                  onClick={onConnectDeviceMotion}
                >
                  <span className="flex flex-col items-center gap-1">
                    <Smartphone className="h-4 w-4" />
                    <span>Sensores do aparelho</span>
                  </span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-2.5">
                <div>
                  <p className="text-xs font-medium text-emerald-200">
                    {usingDeviceMotion ? "Sensores do aparelho ativos" : "Moldura pronta"}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {sampleHz} Hz · atraso {lastPacketAgeMs.toFixed(0)} ms
                  </p>
                  <p className="font-mono text-[9px] text-slate-500">
                    {linkMode ?? "sem modo"} · RX {rawRxHz} · WS {wsTxHz}
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

            {connected && !usingDeviceMotion && onHandTrackingEnabledChange ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
                <div>
                  <Label className="text-xs text-slate-200">
                    Correção visual da mão
                  </Label>
                  <p className="text-[10px] text-slate-500">
                    {handTrackingEnabled
                      ? handTrackingActive
                        ? "Mão detectada · corrigindo deriva"
                        : "Mostre à câmera a mão que segura o sensor"
                      : "Desativada · usando somente o ESP32"}
                  </p>
                </div>
                <Switch
                  checked={handTrackingEnabled}
                  onCheckedChange={onHandTrackingEnabledChange}
                />
              </div>
            ) : null}

            <Button
              variant="secondary"
              className="h-10 w-full rounded-xl"
              disabled={!connected}
              onClick={onZero}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              {hasLocalZero ? "Rezerar" : "Zerar"}
            </Button>

            {usingDeviceMotion ? (
              <p className="rounded-lg border border-cyan-500/15 bg-cyan-500/5 px-3 py-2 text-[11px] leading-relaxed text-cyan-100">
                {isEnglish
                  ? isAndroid
                    ? "Tilt the phone to aim the slice and push or pull to change depth. Tap Zero to set the reference position."
                    : "Tilt the phone to aim the slice. Push or pull to change depth. Tap Zero to set the reference position."
                  : isAndroid
                    ? "Incline o celular para apontar o corte e empurre ou puxe para mudar a profundidade. Toque em Zerar para marcar a posição de referência."
                    : "Incline o celular para apontar o corte. Empurre ou puxe para mudar a profundidade. Toque em Zerar para marcar a posição de referência."}
              </p>
            ) : (
              <Button
                variant="outline"
                className="h-10 w-full rounded-xl border-white/10 bg-white/5"
                disabled={!connected || axisCalStep > 0}
                onClick={startAxisCalibration}
              >
                <CircleGauge className="mr-2 h-4 w-4 text-cyan-300" />
                {imuHealth === "needsCalibration"
                  ? "Calibração recomendada"
                  : "Recalibrar sensores"}
              </Button>
            )}

            <details
              className="group rounded-xl border border-white/8 bg-white/[0.03]"
              open={settingsOpen}
              onToggle={(event) => setSettingsOpen(event.currentTarget.open)}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-medium text-slate-300">
                Ajustes da visualização
                <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
              </summary>
              <div className="space-y-4 border-t border-white/8 px-3 pb-3 pt-3">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-300">
                    {isEnglish ? "Motion source" : "Fonte de movimento"}
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={usingDeviceMotion ? "default" : "outline"}
                      className="h-9 text-xs"
                      disabled={connecting || usingDeviceMotion}
                      onClick={onConnectDeviceMotion}
                    >
                      <Smartphone className="mr-1.5 h-3.5 w-3.5" />
                      {isEnglish ? "Device sensors" : "Sensores do aparelho"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={!usingDeviceMotion ? "default" : "outline"}
                      className="h-9 text-xs"
                      disabled={connecting}
                      onClick={onConnectBle}
                    >
                      <Bluetooth className="mr-1.5 h-3.5 w-3.5" />
                      {isEnglish ? "BLE frame" : "Moldura BLE"}
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {isEnglish
                      ? "Device sensors are active by default. Connect the BLE frame only when you need it."
                      : "Os sensores do aparelho são o padrão. Conecte a moldura BLE somente quando precisar."}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-slate-300">Tipo de imagem</Label>
                  <div className="grid grid-cols-4 gap-1 rounded-lg bg-black/20 p-1">
                    {(
                      Object.keys(MEDICAL_VOLUME_PRESETS) as MedicalImagingModality[]
                    ).map((modality) => {
                      const selected = modality === activeModality;
                      return (
                        <button
                          key={modality}
                          type="button"
                          onClick={() => setActiveModality(modality)}
                          className={cn(
                            "h-8 rounded-md text-[11px] font-semibold transition",
                            selected
                              ? "bg-cyan-500/20 text-cyan-100 shadow-sm"
                              : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                          )}
                          aria-pressed={selected}
                          title={modalityDescription(modality)}
                        >
                          {modalityLabel(modality)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {modalityDescription(activeModality)} ·{" "}
                    {isEnglish
                      ? "public reference atlas"
                      : "atlas público de referência"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-slate-300">Zoom</Label>
                  <Slider
                    value={[cameraDistance]}
                    min={AR_SLICE_CAMERA.min}
                    max={AR_SLICE_CAMERA.max}
                    step={0.1}
                    onValueChange={(value) => setCameraDistance(value[0])}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-slate-300">
                    Posição da fatia
                  </Label>
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
                      Inclina com o sensor na sua mão
                    </p>
                  </div>
                  <Switch
                    checked={autoSliceFromGravity}
                    onCheckedChange={setAutoSliceFromGravity}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-slate-300">
                    Sensibilidade do deslocamento
                  </Label>
                  <p className="text-[10px] text-slate-500">
                    {usingDeviceMotion
                      ? "Suba ou desça o celular em retrato; movimentos laterais e de profundidade são ignorados."
                      : "Empurre/puxe ao longo do eixo da moldura (+Z) — resposta contínua; o giroscópio orienta o aro."}
                  </p>
                  <Slider
                    value={[linearGestureGain]}
                    min={0.25}
                    max={1.8}
                    step={0.05}
                    disabled={!connected}
                    onValueChange={(value) => setLinearGestureGain(value[0])}
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-xs text-slate-300">
                      {usingDeviceMotion ? "Inverter subir/descer" : "Inverter push/pull"}
                    </Label>
                    <p className="text-[10px] text-slate-500">
                      Só o sentido do deslocamento linear
                    </p>
                  </div>
                  <Switch
                    checked={invertLinearDepth}
                    onCheckedChange={setInvertLinearDepth}
                    disabled={!connected}
                  />
                </div>

                {connected ? (
                  <p className="text-[10px] leading-relaxed text-slate-500">
                    {usingDeviceMotion
                      ? "Aparelho em retrato: subir/descer move o corte; inclinar ou girar o celular rotaciona o aro livremente."
                      : "Moldura: giroscópio orienta a fatia; acelerômetro no +Z desloca o corte com o push/pull; o dedo gira o cérebro. Pinça faz zoom."}
                    {" "}Zerar limpa a referência e o deslocamento.
                  </p>
                ) : (
                  <p className="text-[10px] leading-relaxed text-slate-500">
                    Escolha a moldura Bluetooth ou os sensores deste aparelho.
                    Quando conectado, o sensor assume a orientação e o dedo
                    vira ajuste de referência.
                  </p>
                )}
              </div>
            </details>

            {mriLoading ? (
              <p className="text-center text-[11px] text-cyan-200">
                {isEnglish ? "Loading" : "Carregando"}{" "}
                {modalityLabel(activeModality)}…
              </p>
            ) : null}
            {mriError ? (
              <p className="text-center text-[11px] text-amber-300">
                {isEnglish
                  ? `Could not load ${modalityLabel(activeModality)}.`
                  : `Não foi possível carregar ${modalityLabel(activeModality)}.`}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
