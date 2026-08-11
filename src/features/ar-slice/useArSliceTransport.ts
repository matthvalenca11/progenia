import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { isIPadDevice, isNativeApp } from "@/lib/capacitor";
import { createBleCentral } from "@/features/ar-slice/ble/createBleCentral";
import { connectCapacitorFrameSession } from "@/features/ar-slice/ble/connectFrameSession";
import type { BleCentral } from "@/features/ar-slice/ble/types";
import type { OrientationSample } from "@/features/ar-slice/ble/protocol";
import { NativeBleOrientationClient } from "@/features/ar-slice/ble/NativeBleOrientationClient";
import { DeviceMotionOrientationClient } from "@/features/ar-slice/device/DeviceMotionOrientationClient";
import { WifiOrientationClient } from "@/features/ar-slice/wifi/WifiOrientationClient";
import { FRAME_WIFI_DEFAULT_HOST, FRAME_WIFI_PASSWORD } from "@/features/ar-slice/wifi/protocol";
import { resetPoseScrollSession, useArSliceStore } from "@/features/ar-slice/arSliceStore";
import { ProgeniaArFrame } from "@/features/ar-slice/vision/ProgeniaArFrame";
import { BleHandTrackingClient } from "@/features/ar-slice/vision/BleHandTrackingClient";
import { bleHandFusion } from "@/features/ar-slice/vision/bleHandFusion";

/**
 * Native BLE is primary. Wi‑Fi STA remains an explicit fallback.
 */
export function useArSliceTransport() {
  const bleRef = useRef<BleCentral | null>(null);
  const nativeBleRef = useRef<NativeBleOrientationClient | null>(null);
  const deviceMotionRef = useRef<DeviceMotionOrientationClient | null>(null);
  const handTrackingRef = useRef<BleHandTrackingClient | null>(null);
  const wifiRef = useRef<WifiOrientationClient | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantWifi = useRef(false);
  const wantBle = useRef(false);
  const wantDeviceMotion = useRef(false);
  const bleHandTrackingEnabledRef = useRef(true);
  const handVisibleRef = useRef(false);
  const [isMock, setIsMock] = useState(true);
  const [wifiMode, setWifiMode] = useState<string | null>(null);
  const [nativeRxHz, setNativeRxHz] = useState(0);
  const [wsTxHz, setWsTxHz] = useState(0);
  const [espMode, setEspMode] = useState<string | null>(null);
  const [resolvedWifiHost, setResolvedWifiHost] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState<string | null>(null);
  const [bleHandTrackingEnabled, setBleHandTrackingEnabledState] = useState(true);
  const [bleHandTrackingActive, setBleHandTrackingActive] = useState(false);

  // Never subscribe to the whole store from the lab page — telemetry would
  // re-render ArSliceLab (and the WebGL tree props) every second.
  const setConnectionState = useArSliceStore((s) => s.setConnectionState);
  const setDevices = useArSliceStore((s) => s.setDevices);
  const setConnectedDevice = useArSliceStore((s) => s.setConnectedDevice);
  const setError = useArSliceStore((s) => s.setError);
  const ingestSample = useArSliceStore((s) => s.ingestSample);
  const loadPreferences = useArSliceStore((s) => s.loadPreferences);
  const setTransport = useArSliceStore((s) => s.setTransport);
  const transport = useArSliceStore((s) => s.transport);
  const connectionState = useArSliceStore((s) => s.connectionState);

  useEffect(() => {
    const ble = createBleCentral();
    const nativeBle = new NativeBleOrientationClient();
    const deviceMotion = new DeviceMotionOrientationClient();
    const handTracking = new BleHandTrackingClient();
    const wifi = new WifiOrientationClient();
    bleRef.current = ble;
    nativeBleRef.current = nativeBle;
    deviceMotionRef.current = deviceMotion;
    handTrackingRef.current = handTracking;
    wifiRef.current = wifi;
    setIsMock(ble.kind === "mock");
    void loadPreferences();

    void (async () => {
      try {
        if (isNativeApp) {
          // IMU stream uses ProgeniaArFrame CoreBluetooth. Eagerly initializing
          // @capacitor-community/bluetooth-le creates a second CBCentralManager
          // that can starve scans — seen as BLE timeout on iPad while iPhone works.
          setConnectionState("idle");
          return;
        }
        await ble.initialize();
        setConnectionState(ble.getConnectionState());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao iniciar Bluetooth");
        setConnectionState("unsupported");
      }
    })();

    return () => {
      wantWifi.current = false;
      wantBle.current = false;
      wantDeviceMotion.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      unsubRef.current?.();
      void ble.disconnect();
      void nativeBle.disconnect();
      void deviceMotion.disconnect();
      void handTracking.stop();
      void wifi.disconnectAsync();
      bleRef.current = null;
      nativeBleRef.current = null;
      deviceMotionRef.current = null;
      handTrackingRef.current = null;
      wifiRef.current = null;
    };
  }, [loadPreferences, setConnectionState, setError]);

  const clearOrientationSub = () => {
    unsubRef.current?.();
    unsubRef.current = null;
  };

  const attachWifiOrientation = useCallback(
    (client: WifiOrientationClient) => {
      clearOrientationSub();
      unsubRef.current = client.subscribe((sample) => ingestSample(sample));
    },
    [ingestSample],
  );

  const ingestBleSample = useCallback(
    (sample: OrientationSample) => {
      const position =
        sample.translationPosition ??
        sample.translationWorld?.z;
      if (
        !bleHandTrackingEnabledRef.current ||
        position == null ||
        !Number.isFinite(position)
      ) {
        ingestSample(sample);
        return;
      }
      ingestSample({
        ...sample,
        translationPosition: bleHandFusion.ingestSensor(position),
      });
    },
    [ingestSample],
  );

  const stopBleHandTracking = useCallback(async () => {
    await handTrackingRef.current?.stop();
    bleHandFusion.reset();
    handVisibleRef.current = false;
    setBleHandTrackingActive(false);
  }, []);

  const startBleHandTracking = useCallback(async () => {
    if (!isNativeApp || !bleHandTrackingEnabledRef.current) return;
    const client = handTrackingRef.current;
    if (!client) return;
    bleHandFusion.setEnabled(true);
    try {
      await client.start((observation) => {
        bleHandFusion.ingestHand(observation);
        const visible = observation.visible && observation.confidence >= 0.35;
        if (visible !== handVisibleRef.current) {
          handVisibleRef.current = visible;
          setBleHandTrackingActive(visible);
        }
      });
    } catch {
      bleHandFusion.setEnabled(false);
      setBleHandTrackingActive(false);
    }
  }, []);

  const setBleHandTrackingEnabled = useCallback(
    (enabled: boolean) => {
      bleHandTrackingEnabledRef.current = enabled;
      setBleHandTrackingEnabledState(enabled);
      bleHandFusion.setEnabled(enabled);
      if (!enabled) {
        void stopBleHandTracking();
        return;
      }
      const state = useArSliceStore.getState();
      if (state.transport === "ble" && state.connectionState === "streaming") {
        void startBleHandTracking();
      }
    },
    [startBleHandTracking, stopBleHandTracking],
  );

  const connectBleStream = useCallback(async () => {
    const refreshNativeDiag = (client: NativeBleOrientationClient) => {
      const refresh = () => {
        setNativeRxHz(client.getRxHz());
        setWsTxHz(client.getWsTxHz());
      };
      window.setTimeout(refresh, 500);
      const interval = window.setInterval(refresh, 1000);
      window.setTimeout(() => window.clearInterval(interval), 30_000);
    };

    const connectCapacitorPath = async (statusPrefix?: string) => {
      const central = bleRef.current;
      if (!central) return;

      setTransport("ble");
      setError(null);
      setConnectStatus(statusPrefix ?? "Preparando Bluetooth…");
      setConnectionState("connecting");

      let warmPackets = 0;
      unsubRef.current = central.subscribeOrientation((sample) => {
        warmPackets += 1;
        ingestBleSample(sample);
      });

      const result = await connectCapacitorFrameSession(central, {
        onProgress: setConnectStatus,
        getWarmPackets: () => warmPackets,
        resetWarmPackets: () => {
          warmPackets = 0;
        },
      });
      setConnectedDevice(result.device.deviceId, result.device.name);
      setWifiMode(isNativeApp ? "capacitor-ble" : "web-bluetooth");
      setEspMode("ble-v2");
      setConnectStatus(null);
      setConnectionState("streaming");
    };

    /** iPad: Capacitor connect (reliable) + native WS relay (full rate). */
    const connectIPadHybridPath = async () => {
      const central = bleRef.current;
      const client = nativeBleRef.current;
      if (!central || !client) return;

      setTransport("ble");
      setError(null);
      setConnectStatus("Preparando Bluetooth…");
      setConnectionState("connecting");

      let warmPackets = 0;
      unsubRef.current = central.subscribeOrientation(() => {
        warmPackets += 1;
      });

      const result = await connectCapacitorFrameSession(central, {
        onProgress: setConnectStatus,
        getWarmPackets: () => warmPackets,
        resetWarmPackets: () => {
          warmPackets = 0;
        },
      });

      clearOrientationSub();
      setConnectStatus("Abrindo canal IMU nativo…");

      let mode: "capacitor-ble-relay" | "capacitor-ble" = "capacitor-ble-relay";
      try {
        unsubRef.current = client.subscribe((sample) => ingestBleSample(sample));
        await client.attachCapacitorRelay(setConnectStatus);
        central.setNativeRelayActive?.(true);
      } catch {
        await client.abortRelayOnly().catch(() => undefined);
        central.setNativeRelayActive?.(false);
        unsubRef.current = central.subscribeOrientation((sample) => ingestBleSample(sample));
        mode = "capacitor-ble";
        setConnectStatus("Conectado · modo compatível");
      }

      setConnectedDevice(result.device.deviceId, result.device.name);
      setWifiMode(mode);
      setEspMode("ble-v2");
      setConnectStatus(null);
      setConnectionState("streaming");
      if (mode === "capacitor-ble-relay") {
        refreshNativeDiag(client);
      }
    };

    const connectNativePath = async () => {
      const client = nativeBleRef.current;
      if (!client) return;

      setTransport("ble");
      setError(null);
      setConnectionState("connecting");
      setConnectStatus("Procurando moldura por Bluetooth…");

      unsubRef.current = client.subscribe((sample) => ingestBleSample(sample));
      const result = await client.connect(undefined, setConnectStatus);
      setConnectedDevice(result.deviceId, result.name);
      setWifiMode("native-ble");
      setEspMode("ble-v2");
      setConnectStatus(null);
      setConnectionState("streaming");
      refreshNativeDiag(client);
    };

    wantBle.current = true;
    wantWifi.current = false;
    wantDeviceMotion.current = false;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    clearOrientationSub();
    await stopBleHandTracking();
    await wifiRef.current?.disconnectAsync();
    await deviceMotionRef.current?.disconnect();
    try {
      await nativeBleRef.current?.disconnect();
    } catch {
      // Native stream may not be running.
    }
    try {
      await bleRef.current?.disconnect();
    } catch {
      // Capacitor central may already be idle.
    }

    try {
      if (!isNativeApp) {
        await connectCapacitorPath();
      } else if (isIPadDevice()) {
        await connectIPadHybridPath();
      } else {
        await connectNativePath();
      }
      await startBleHandTracking();
    } catch (error) {
      clearOrientationSub();
      await nativeBleRef.current?.disconnect().catch(() => {});
      await bleRef.current?.disconnect().catch(() => {});
      setConnectedDevice(null, null);
      setConnectStatus(null);
      setConnectionState("error");
      setError(
        error instanceof Error ? error.message : "Falha no Bluetooth",
      );
    }
  }, [
    ingestBleSample,
    setConnectedDevice,
    setConnectionState,
    setError,
    setTransport,
    startBleHandTracking,
    stopBleHandTracking,
  ]);

  const connectDeviceMotion = useCallback(async () => {
    const client = deviceMotionRef.current;
    if (!client) return;

    wantDeviceMotion.current = true;
    wantBle.current = false;
    wantWifi.current = false;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    clearOrientationSub();

    setTransport("device-motion");
    setError(null);
    setConnectStatus("Ativando sensores do aparelho…");
    setConnectionState("connecting");

    try {
      await stopBleHandTracking();
      await wifiRef.current?.disconnectAsync();
      await nativeBleRef.current?.disconnect();
      await bleRef.current?.disconnect();

      unsubRef.current = client.subscribe((sample) => ingestSample(sample));
      const result = await client.connect(setConnectStatus);
      setConnectedDevice("device-motion", "Sensores do aparelho");
      setWifiMode(result.mode);
      setEspMode(null);
      setResolvedWifiHost(null);
      setConnectStatus(null);
      setConnectionState("streaming");

      const refresh = () => {
        setNativeRxHz(client.getRxHz());
        setWsTxHz(client.getWsTxHz());
      };
      window.setTimeout(refresh, 500);
      const interval = window.setInterval(refresh, 1_000);
      window.setTimeout(() => window.clearInterval(interval), 30_000);
    } catch (error) {
      clearOrientationSub();
      await client.disconnect().catch(() => undefined);
      setConnectedDevice(null, null);
      setWifiMode(null);
      setConnectStatus(null);
      setConnectionState("error");
      setError(
        error instanceof Error
          ? error.message
          : "Falha ao iniciar os sensores do aparelho",
      );
    }
  }, [
    ingestSample,
    setConnectedDevice,
    setConnectionState,
    setError,
    setTransport,
    stopBleHandTracking,
  ]);

  const connectWifi = useCallback(
    async (host?: string) => {
      const wifi = wifiRef.current;
      if (!wifi) return;

      wantWifi.current = true;
      wantBle.current = false;
      wantDeviceMotion.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      clearOrientationSub();
      try {
        await stopBleHandTracking();
        await deviceMotionRef.current?.disconnect();
        await nativeBleRef.current?.disconnect();
        await bleRef.current?.disconnect();
      } catch {
        // ignore
      }

      setTransport("wifi");
      setError(null);
      setConnectStatus("Iniciando…");
      setConnectionState("connecting");

      try {
        await Promise.race([
          (async () => {
            await wifi.connect(host, (msg) => setConnectStatus(msg));
            attachWifiOrientation(wifi);
          })(),
          new Promise<never>((_, reject) => {
            window.setTimeout(
              () =>
                reject(
                  new Error(
                    "Timeout (45 s). Confirme: hotspot ligado, ESP conectado (1 dispositivo), Rede Local permitida.",
                  ),
                ),
              45_000,
            );
          }),
        ]);
        const resolved = wifi.getHost();
        setConnectStatus(null);
        setResolvedWifiHost(resolved);
        setEspMode(wifi.getEspMode());
        setWifiMode(wifi.getMode());
        setConnectedDevice(`wifi:${resolved}`, `Wi‑Fi ${resolved}`);
        setConnectionState("streaming");
        const refreshDiag = () => {
          setWifiMode(wifiRef.current?.getMode() ?? null);
          setNativeRxHz(wifiRef.current?.getNativeRxHz() ?? 0);
          setWsTxHz(wifiRef.current?.getWsTxHz() ?? 0);
          setEspMode(wifiRef.current?.getEspMode() ?? null);
          setResolvedWifiHost(wifiRef.current?.getHost() ?? null);
        };
        window.setTimeout(refreshDiag, 500);
        window.setTimeout(refreshDiag, 2000);
        const diagIv = window.setInterval(refreshDiag, 1000);
        window.setTimeout(() => window.clearInterval(diagIv), 15000);
      } catch (err) {
        setConnectedDevice(null, null);
        setWifiMode(wifi.getMode());
        setConnectStatus(null);
        setError(
          err instanceof Error
            ? err.message
            : "Falha Wi‑Fi. Ligue o Personal Hotspot e toque Conectar Wi‑Fi.",
        );
        setConnectionState("error");
        setTransport("wifi");
      }
    },
    [
      attachWifiOrientation,
      setConnectedDevice,
      setConnectionState,
      setError,
      setTransport,
      stopBleHandTracking,
    ],
  );

  const scanForProvision = useCallback(async () => {
    const central = bleRef.current;
    if (!central) return;
    wantBle.current = false;
    wantDeviceMotion.current = false;
    await nativeBleRef.current?.disconnect();
    await wifiRef.current?.disconnectAsync();
    setTransport("ble");
    setError(null);
    setConnectStatus("Scan BLE…");
    setConnectionState("scanning");
    try {
      await central.initialize();
      const devices = await central.scan(12_000);
      setDevices(devices);
      setConnectStatus(null);
      setConnectionState("idle");
      if (devices.length === 0) {
        setConnectedDevice(null, null);
        setError(
          "Scan vazio. Use «Escolher moldura (BLE)» (picker do iOS) ou re-flashe o firmware.",
        );
      } else {
        setError(`${devices.length} moldura(s): toque na lista → Enviar via BLE`);
      }
    } catch (err) {
      setConnectStatus(null);
      setError(err instanceof Error ? err.message : "Falha no scan BLE");
      setConnectionState("error");
    }
  }, [setConnectedDevice, setConnectionState, setDevices, setError, setTransport]);

  /** Native iOS picker + connect + PROVISION write — most reliable path. */
  const configureHotspotBle = useCallback(
    async (ssid: string, pass = FRAME_WIFI_PASSWORD, deviceId?: string) => {
      const central = bleRef.current;
      if (!central?.connectForProvision || !central.provisionWifi) {
        setError("BLE nativo só no app iOS/Android");
        return;
      }
      if (!ssid.trim()) {
        setError("Informe o nome do Personal Hotspot");
        return;
      }

      await wifiRef.current?.disconnectAsync();
      wantBle.current = false;
      wantDeviceMotion.current = false;
      await nativeBleRef.current?.disconnect();
      setTransport("ble");
      setError(null);
      setConnectionState("connecting");
      setConnectStatus("Abrindo Bluetooth…");

      try {
        await central.initialize();
        let targetId = deviceId;
        let targetName = deviceId ?? "";

        if (!targetId) {
          if (central.pickDevice) {
            setConnectStatus("Escolha a moldura na lista do iOS…");
            const picked = await central.pickDevice();
            if (!picked) {
              setConnectionState("idle");
              setConnectStatus(null);
              setError("Seleção BLE cancelada");
              return;
            }
            targetId = picked.deviceId;
            targetName = picked.name;
            setDevices([picked]);
          } else {
            setConnectStatus("Scan BLE…");
            const devices = await central.scan(12_000);
            setDevices(devices);
            if (devices.length === 0) throw new Error("Nenhuma moldura no scan");
            targetId = devices[0].deviceId;
            targetName = devices[0].name;
          }
        }

        setConnectStatus(`Conectando ${targetName}…`);
        await central.connectForProvision(targetId);
        setConnectedDevice(targetId, targetName);
        setConnectionState("connected");

        setConnectStatus("Gravando hotspot…");
        await central.provisionWifi(ssid.trim(), pass);
        await new Promise((r) => setTimeout(r, 500));
        await central.disconnect();
        setConnectedDevice(null, null);
        setConnectionState("idle");
        setConnectStatus(null);
        setError(
          "Hotspot gravado — moldura reiniciando. Ligue o Personal Hotspot, aguarde ~15 s e Conectar Wi‑Fi.",
        );
      } catch (err) {
        setConnectStatus(null);
        setConnectionState("error");
        setError(err instanceof Error ? err.message : "Falha ao configurar via BLE");
        try {
          await central.disconnect();
        } catch {
          // ignore
        }
      }
    },
    [setConnectedDevice, setConnectionState, setError, setDevices, setTransport],
  );

  const provisionOverBle = useCallback(
    async (deviceId: string, ssid: string, pass = FRAME_WIFI_PASSWORD) => {
      await configureHotspotBle(ssid, pass, deviceId);
    },
    [configureHotspotBle],
  );

  const reprovisionHotspot = useCallback(
    async (ssid: string, pass = FRAME_WIFI_PASSWORD) => {
      const wifi = wifiRef.current;
      if (!wifi) return;
      if (!ssid.trim()) {
        setError("Informe o nome do Personal Hotspot");
        return;
      }
      setError(null);
      setConnectionState("connecting");
      setConnectStatus("Procurando moldura para gravar hotspot…");
      try {
        const hosts = await WifiOrientationClient.discoverHosts(undefined, setConnectStatus);
        let lastErr: Error | null = null;
        for (const host of hosts) {
          try {
            await wifi.provisionSta(ssid, pass, host);
            await wifi.disconnectAsync();
            setWifiMode(null);
            setConnectedDevice(null, null);
            setConnectionState("idle");
            setConnectStatus(null);
            setError(
              `Hotspot gravado em ${host} — moldura reiniciando. Ligue o Personal Hotspot, aguarde ~15 s e Conectar Wi‑Fi.`,
            );
            return;
          } catch (err) {
            lastErr = err instanceof Error ? err : new Error(String(err));
          }
        }
        throw lastErr ?? new Error("POST /sta falhou em todos os hosts");
      } catch (err) {
        setConnectStatus(null);
        setConnectionState("error");
        setError(
          err instanceof Error
            ? err.message
            : "Falha ao gravar hotspot. Tente BLE ou confirme que o ESP está no hotspot.",
        );
      }
    },
    [setConnectedDevice, setConnectionState, setError],
  );

  /** @deprecated use reprovisionHotspot */
  const provisionHotspot = reprovisionHotspot;

  const disconnect = useCallback(async () => {
    wantWifi.current = false;
    wantBle.current = false;
    wantDeviceMotion.current = false;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    clearOrientationSub();
    await stopBleHandTracking();
    await wifiRef.current?.disconnectAsync();
    await nativeBleRef.current?.disconnect();
    await deviceMotionRef.current?.disconnect();
    await bleRef.current?.disconnect();
    setConnectedDevice(null, null);
    setWifiMode(null);
    setNativeRxHz(0);
    setWsTxHz(0);
    setEspMode(null);
    setResolvedWifiHost(null);
    setConnectStatus(null);
    resetPoseScrollSession();
    setConnectionState("idle");
    setTransport("ble");
  }, [setConnectedDevice, setConnectionState, setTransport, stopBleHandTracking]);

  const writeZero = useCallback(async () => {
    const store = useArSliceStore.getState();
    const bleMode = wifiMode;
    try {
      if (store.transport === "device-motion") {
        await deviceMotionRef.current?.resetTranslation();
      } else if (store.transport === "wifi" && wifiRef.current?.getState() === "streaming") {
        await wifiRef.current.writeZero();
      } else if (store.transport === "ble" && bleMode === "native-ble") {
        await nativeBleRef.current?.writeZero();
      } else if (
        store.transport === "ble" &&
        (bleMode === "capacitor-ble" ||
          bleMode === "capacitor-ble-relay" ||
          bleMode === "web-bluetooth" ||
          bleRef.current?.getConnectionState() === "streaming")
      ) {
        await bleRef.current?.writeZero();
      }
      if (store.transport === "ble") {
        bleHandFusion.reset();
      }
      if (isNativeApp && store.cameraEnabled) {
        await ProgeniaArFrame.recenterMixedReality().catch(() => undefined);
      }
      // Let one absolute IMU sample land after firmware clears qZero.
      await new Promise((r) => setTimeout(r, 60));
      store.captureLocalZero();
    } catch (err) {
      store.captureLocalZero();
      setError(err instanceof Error ? err.message : "ZERO local aplicado");
    }
  }, [setError, wifiMode]);

  // Auto-Zerar as soon as the moldura stream is up (first samples + gravity).
  useEffect(() => {
    if (connectionState !== "streaming") return;
    const timer = window.setTimeout(() => {
      if (useArSliceStore.getState().connectionState !== "streaming") return;
      void writeZero();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [connectionState, writeZero]);

  // Portrait ↔ landscape changes the phone sensor reference frame. Re-zero
  // after UIKit/WebView finish rotating so the aro does not inherit a 90° jump.
  useEffect(() => {
    if (transport !== "device-motion" || connectionState !== "streaming") return;
    let timer = 0;
    const handleOrientationChange = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const state = useArSliceStore.getState();
        if (
          state.transport === "device-motion" &&
          state.connectionState === "streaming"
        ) {
          void writeZero();
        }
      }, 280);
    };
    window.addEventListener("orientationchange", handleOrientationChange);
    return () => {
      window.removeEventListener("orientationchange", handleOrientationChange);
      window.clearTimeout(timer);
    };
  }, [connectionState, transport, writeZero]);

  const writeCalibrationCommand = useCallback(
    async (command: "CAL_START" | "CAL_CANCEL" | "CAL_SAVE") => {
      if (useArSliceStore.getState().transport === "device-motion") {
        return;
      }
      if (wifiMode === "native-ble") {
        await nativeBleRef.current?.writeCalibrationCommand(command);
        return;
      }
      await bleRef.current?.writeCalibrationCommand?.(command);
    },
    [wifiMode],
  );

  useEffect(() => {
    if (!isNativeApp) return;
    const sub = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        // Release the GATT link so another phone/tablet can connect to the frame.
        void disconnect();
        return;
      }
      if (wantWifi.current || wantBle.current || wantDeviceMotion.current) {
        const state = useArSliceStore.getState().connectionState;
        if (state !== "streaming" && state !== "connecting" && state !== "reconnecting") {
          if (wantBle.current) void connectBleStream();
          else if (wantDeviceMotion.current) void connectDeviceMotion();
          else void connectWifi();
        }
      }
    });
    const pauseSub = CapApp.addListener("pause", () => {
      void disconnect();
    });
    return () => {
      void sub.then((s) => s.remove());
      void pauseSub.then((s) => s.remove());
    };
  }, [connectBleStream, connectDeviceMotion, connectWifi, disconnect]);

  const clearSavedWifiHost = useCallback(async () => {
    await WifiOrientationClient.clearSavedHost();
    setResolvedWifiHost(null);
    setError("Host salvo apagado — toque Conectar Wi‑Fi de novo.");
  }, [setError]);

  return {
    scanForProvision,
    configureHotspotBle,
    provisionOverBle,
    connectBleStream,
    connectDeviceMotion,
    connectWifi,
    clearSavedWifiHost,
    provisionHotspot,
    disconnect,
    writeZero,
    writeCalibrationCommand,
    bleHandTrackingEnabled,
    bleHandTrackingActive,
    setBleHandTrackingEnabled,
    isMock,
    transport,
    wifiMode,
    nativeRxHz,
    wsTxHz,
    espMode,
    connectStatus,
    wifiHost: resolvedWifiHost ?? FRAME_WIFI_DEFAULT_HOST,
    wifiPassword: FRAME_WIFI_PASSWORD,
    // Legacy aliases
    scan: scanForProvision,
    connect: connectBleStream,
  };
}
