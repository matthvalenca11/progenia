import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { isNativeApp } from "@/lib/capacitor";
import { createBleCentral } from "@/features/ar-slice/ble/createBleCentral";
import type { BleCentral } from "@/features/ar-slice/ble/types";
import { NativeBleOrientationClient } from "@/features/ar-slice/ble/NativeBleOrientationClient";
import { WifiOrientationClient } from "@/features/ar-slice/wifi/WifiOrientationClient";
import { FRAME_WIFI_DEFAULT_HOST, FRAME_WIFI_PASSWORD } from "@/features/ar-slice/wifi/protocol";
import { resetPoseScrollSession, useArSliceStore } from "@/features/ar-slice/arSliceStore";

/**
 * Native BLE is primary. Wi‑Fi STA remains an explicit fallback.
 */
export function useArSliceTransport() {
  const bleRef = useRef<BleCentral | null>(null);
  const nativeBleRef = useRef<NativeBleOrientationClient | null>(null);
  const wifiRef = useRef<WifiOrientationClient | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantWifi = useRef(false);
  const wantBle = useRef(false);
  const [isMock, setIsMock] = useState(true);
  const [wifiMode, setWifiMode] = useState<string | null>(null);
  const [nativeRxHz, setNativeRxHz] = useState(0);
  const [wsTxHz, setWsTxHz] = useState(0);
  const [espMode, setEspMode] = useState<string | null>(null);
  const [resolvedWifiHost, setResolvedWifiHost] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState<string | null>(null);

  const {
    setConnectionState,
    setDevices,
    setConnectedDevice,
    setError,
    ingestSample,
    loadPreferences,
    setTransport,
    transport,
  } = useArSliceStore();

  useEffect(() => {
    const ble = createBleCentral();
    const nativeBle = new NativeBleOrientationClient();
    const wifi = new WifiOrientationClient();
    bleRef.current = ble;
    nativeBleRef.current = nativeBle;
    wifiRef.current = wifi;
    setIsMock(ble.kind === "mock");
    void loadPreferences();

    void (async () => {
      try {
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
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      unsubRef.current?.();
      void ble.disconnect();
      void nativeBle.disconnect();
      void wifi.disconnectAsync();
      bleRef.current = null;
      nativeBleRef.current = null;
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

  const connectBleStream = useCallback(async () => {
    if (!isNativeApp) {
      const central = bleRef.current;
      if (!central) return;

      wantBle.current = true;
      wantWifi.current = false;
      clearOrientationSub();
      setTransport("ble");
      setError(null);
      setConnectStatus("Escolha a moldura na janela do navegador…");
      setConnectionState("connecting");

      let received = 0;
      unsubRef.current = central.subscribeOrientation((sample) => {
        received += 1;
        ingestSample(sample);
      });

      try {
        await central.initialize();
        const picked = await central.pickDevice?.();
        if (!picked) throw new Error("Seleção Bluetooth cancelada");

        setConnectStatus(`Conectando ${picked.name}…`);
        await central.connect(picked.deviceId);

        // The ESP32-C3 can expose the same slow cold session in Web Bluetooth.
        // Reproduce the proven controller-reboot recovery without involving Wi-Fi.
        await new Promise((resolve) => window.setTimeout(resolve, 2_000));
        if (received < 15 && central.writeReboot) {
          setConnectStatus("Otimizando conexão Bluetooth…");
          await central.writeReboot();
          await new Promise((resolve) => window.setTimeout(resolve, 1_200));
          try {
            await central.disconnect();
          } catch {
            // The frame normally disconnects itself while rebooting.
          }
          received = 0;
          await central.connect(picked.deviceId);
          await new Promise((resolve) => window.setTimeout(resolve, 2_000));
        }

        if (received < 15) {
          throw new Error("Bluetooth conectado, mas a transmissão permaneceu lenta.");
        }

        setConnectedDevice(picked.deviceId, picked.name);
        setWifiMode("web-bluetooth");
        setEspMode("ble-v2");
        setConnectStatus(null);
        setConnectionState("streaming");
      } catch (error) {
        clearOrientationSub();
        await central.disconnect().catch(() => {});
        setConnectedDevice(null, null);
        setConnectStatus(null);
        setConnectionState("error");
        setError(
          error instanceof Error
            ? error.message
            : "Falha no Web Bluetooth",
        );
      }
      return;
    }

    const client = nativeBleRef.current;
    if (!client) return;

    wantBle.current = true;
    wantWifi.current = false;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    clearOrientationSub();
    await wifiRef.current?.disconnectAsync();
    try {
      await bleRef.current?.disconnect();
    } catch {
      // Provisioning central may already be idle.
    }

    setTransport("ble");
    setError(null);
    setConnectStatus("Iniciando Bluetooth nativo…");
    setConnectionState("connecting");

    unsubRef.current = client.subscribe((sample) => ingestSample(sample));
    try {
      const result = await client.connect(undefined, setConnectStatus);
      setConnectedDevice(result.deviceId, result.name);
      setWifiMode("native-ble");
      setEspMode("ble-v2");
      setConnectStatus(null);
      setConnectionState("streaming");

      const refresh = () => {
        setNativeRxHz(client.getRxHz());
        setWsTxHz(client.getWsTxHz());
      };
      window.setTimeout(refresh, 500);
      const interval = window.setInterval(refresh, 1000);
      window.setTimeout(() => window.clearInterval(interval), 30_000);
    } catch (error) {
      clearOrientationSub();
      await client.disconnect();
      setConnectedDevice(null, null);
      setConnectStatus(null);
      setConnectionState("error");
      setError(
        error instanceof Error
          ? error.message
          : "Falha no stream BLE nativo",
      );
    }
  }, [
    ingestSample,
    setConnectedDevice,
    setConnectionState,
    setError,
    setTransport,
  ]);

  const connectWifi = useCallback(
    async (host?: string) => {
      const wifi = wifiRef.current;
      if (!wifi) return;

      wantWifi.current = true;
      wantBle.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      clearOrientationSub();
      try {
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
    [attachWifiOrientation, setConnectedDevice, setConnectionState, setError, setTransport],
  );

  const scanForProvision = useCallback(async () => {
    const central = bleRef.current;
    if (!central) return;
    wantBle.current = false;
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
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    clearOrientationSub();
    await wifiRef.current?.disconnectAsync();
    await nativeBleRef.current?.disconnect();
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
  }, [setConnectedDevice, setConnectionState, setTransport]);

  const writeZero = useCallback(async () => {
    const store = useArSliceStore.getState();
    try {
      if (store.transport === "wifi" && wifiRef.current?.getState() === "streaming") {
        await wifiRef.current.writeZero();
      } else if (
        store.transport === "ble" &&
        !isNativeApp &&
        bleRef.current?.getConnectionState() === "streaming"
      ) {
        await bleRef.current.writeZero();
      }
      store.captureSliceZeroReference();
    } catch (err) {
      store.captureLocalZero();
      setError(err instanceof Error ? err.message : "ZERO local aplicado");
    }
  }, [setError]);

  useEffect(() => {
    if (!isNativeApp) return;
    const sub = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (
        isActive &&
        (wantWifi.current || wantBle.current)
      ) {
        const state = useArSliceStore.getState().connectionState;
        if (state !== "streaming" && state !== "connecting" && state !== "reconnecting") {
          if (wantBle.current) void connectBleStream();
          else void connectWifi();
        }
      }
    });
    return () => {
      void sub.then((s) => s.remove());
    };
  }, [connectBleStream, connectWifi]);

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
    connectWifi,
    clearSavedWifiHost,
    provisionHotspot,
    disconnect,
    writeZero,
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
