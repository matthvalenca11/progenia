import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { isNativeApp } from "@/lib/capacitor";
import { createBleCentral } from "@/features/ar-slice/ble/createBleCentral";
import type { BleCentral } from "@/features/ar-slice/ble/types";
import { resetPoseScrollSession, useArSliceStore } from "@/features/ar-slice/arSliceStore";

const RECONNECT_DELAYS = [500, 1000, 2000, 5000];

export function useArSliceBle() {
  const centralRef = useRef<BleCentral | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantConnected = useRef(false);
  const [isMock, setIsMock] = useState(true);

  const {
    setConnectionState,
    setDevices,
    setConnectedDevice,
    setError,
    ingestSample,
    loadPreferences,
    persistDevice,
    deviceId,
  } = useArSliceStore();

  useEffect(() => {
    const central = createBleCentral();
    centralRef.current = central;
    setIsMock(central.kind === "mock");
    void loadPreferences();

    void (async () => {
      try {
        await central.initialize();
        setConnectionState(central.getConnectionState());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao iniciar Bluetooth");
        setConnectionState("unsupported");
      }
    })();

    return () => {
      wantConnected.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      unsubRef.current?.();
      void central.disconnect();
      centralRef.current = null;
    };
  }, [loadPreferences, setConnectionState, setError]);

  const attachOrientation = useCallback(
    (central: BleCentral) => {
      unsubRef.current?.();
      unsubRef.current = central.subscribeOrientation((sample) => {
        ingestSample(sample);
      });
    },
    [ingestSample],
  );

  const connect = useCallback(
    async (targetId?: string) => {
      const central = centralRef.current;
      if (!central) return;
      const id = targetId || useArSliceStore.getState().deviceId;
      if (!id) {
        setError("Nenhum dispositivo selecionado");
        return;
      }

      wantConnected.current = true;
      setError(null);
      setConnectionState("connecting");

      try {
        await central.connect(id);
        const name =
          useArSliceStore.getState().devices.find((d) => d.deviceId === id)?.name ?? id;
        setConnectedDevice(id, name);
        await persistDevice(id);
        attachOrientation(central);
        setConnectionState(central.getConnectionState());
        reconnectAttempt.current = 0;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha na conexão BLE");
        setConnectionState("error");
        scheduleReconnect(id);
      }
    },
    [attachOrientation, persistDevice, setConnectedDevice, setConnectionState, setError],
  );

  const scheduleReconnect = useCallback(
    (id: string) => {
      if (!wantConnected.current) return;
      const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)];
      reconnectAttempt.current += 1;
      setConnectionState("reconnecting");
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(() => {
        void connect(id);
      }, delay);
    },
    [connect, setConnectionState],
  );

  const scan = useCallback(async () => {
    const central = centralRef.current;
    if (!central) return;
    setError(null);
    setConnectionState("scanning");
    try {
      const devices = await central.scan(5000);
      setDevices(devices);
      setConnectionState("idle");
      if (devices.length === 1) {
        await connect(devices[0].deviceId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no scan BLE");
      setConnectionState("error");
    }
  }, [connect, setConnectionState, setDevices, setError]);

  const disconnect = useCallback(async () => {
    wantConnected.current = false;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    unsubRef.current?.();
    await centralRef.current?.disconnect();
    setConnectedDevice(null, null);
    resetPoseScrollSession();
    setConnectionState("idle");
  }, [setConnectedDevice, setConnectionState]);

  const writeZero = useCallback(async () => {
    const central = centralRef.current;
    const store = useArSliceStore.getState();
    try {
      if (central && (central.getConnectionState() === "streaming" || central.getConnectionState() === "connected")) {
        await central.writeZero();
        await new Promise((r) => setTimeout(r, 60));
      }
      store.captureLocalZero();
    } catch (err) {
      store.captureLocalZero();
      setError(err instanceof Error ? err.message : "ZERO local aplicado");
    }
  }, [setError]);

  useEffect(() => {
    if (!isNativeApp) return;
    const sub = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive && wantConnected.current && deviceId) {
        const state = centralRef.current?.getConnectionState();
        if (state !== "streaming" && state !== "connected" && state !== "connecting") {
          void connect(deviceId);
        }
      }
    });
    return () => {
      void sub.then((s) => s.remove());
    };
  }, [connect, deviceId]);

  return {
    scan,
    connect,
    disconnect,
    writeZero,
    isMock,
  };
}
