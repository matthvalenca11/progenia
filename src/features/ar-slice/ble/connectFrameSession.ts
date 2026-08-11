/**
 * Unified moldura BLE connect protocol (web / iPad Capacitor).
 *
 * Lessons learned (do not regress):
 * 1. Never run two CBCentralManagers (Capacitor + ProgeniaArFrame) — iPad
 *    discover works but connect() hangs forever.
 * 2. iPhone high-rate path = ProgeniaArFrame CoreBluetooth → localhost WS.
 *    iPad/web = single Capacitor BleClient for discover+GATT+notify.
 * 3. iPad: Capacitor owns connect/CCCD; native code only relays packets to the
 *    localhost WS after connect. Do not gate connect on WKWebView packet events.
 * 4. Do not reconnect based on low JS Hz — bridge batching is not link silence.
 * 5. Firmware requests Apple-compliant 15–30 ms params once, after CCCD.
 * 6. Firmware must not notify before CCCD subscribe (onSubscribe in FW).
 */

import type { BleCentral, BleDeviceInfo } from "@/features/ar-slice/ble/types";
import { isIPadDevice, isNativeApp } from "@/lib/capacitor";
import { ProgeniaArFrame } from "@/features/ar-slice/vision/ProgeniaArFrame";

export type FrameBleConnectProgress = (message: string) => void;

export type FrameBleConnectResult = {
  device: BleDeviceInfo;
  warmPackets: number;
  usedReboot: boolean;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function waitForWarmPackets(
  getWarmPackets: () => number,
  maxMs: number,
  targetPackets: number,
  onProgress?: FrameBleConnectProgress,
): Promise<number> {
  const started = performance.now();
  let lastReport = -1;
  while (performance.now() - started < maxMs) {
    const n = getWarmPackets();
    if (n !== lastReport && n > 0) {
      lastReport = n;
      onProgress?.(`Stream IMU · ${n} amostra(s)…`);
    }
    if (n >= targetPackets) return n;
    await sleep(150);
  }
  return getWarmPackets();
}

async function pickFrameDevice(
  central: BleCentral,
  onProgress?: FrameBleConnectProgress,
): Promise<BleDeviceInfo> {
  // The iOS picker owns scan teardown and retains the exact CBPeripheral that
  // the user selected. This path previously connected on the iPad; selecting a
  // peripheral from a passive scan and connecting immediately regressed it.
  onProgress?.(
    isIPadDevice()
      ? "Escolha a moldura na lista…"
      : "Escolha a moldura na janela do navegador…",
  );
  const picked = await central.pickDevice?.();
  if (picked) return picked;

  onProgress?.("Procurando moldura (scan)…");
  const devices = await central.scan(12_000);
  if (devices.length === 0) {
    throw new Error(
      "Nenhuma moldura encontrada. Feche o ProGenia no outro aparelho e aproxime a moldura.",
    );
  }
  return devices[0];
}

/** Clear native IMU relay flag so Capacitor bridge delivers handshake packets. */
async function resetNativeImuRelay() {
  if (!isNativeApp) return;
  try {
    await ProgeniaArFrame.stopCapacitorImuRelay();
  } catch {
    // Relay may not be running.
  }
}

async function reconnectAfterReboot(
  central: BleCentral,
  deviceId: string,
  onProgress?: FrameBleConnectProgress,
): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      onProgress?.(
        attempt === 0
          ? "Reconectando após otimização…"
          : `Reconectando Bluetooth (${attempt + 1}/4)…`,
      );
      await central.connect(deviceId);
      return;
    } catch (error) {
      lastError = error;
      await sleep(1_500 * (attempt + 1));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Falha ao reconectar após otimização Bluetooth");
}

/**
 * Capacitor / Web Bluetooth session. Caller must already subscribeOrientation
 * and count packets via getWarmPackets().
 */
export async function connectCapacitorFrameSession(
  central: BleCentral,
  options: {
    onProgress?: FrameBleConnectProgress;
    getWarmPackets: () => number;
    resetWarmPackets: () => void;
  },
): Promise<FrameBleConnectResult> {
  const { onProgress, getWarmPackets, resetWarmPackets } = options;
  const onIPad = isIPadDevice();

  await resetNativeImuRelay();
  await central.initialize();
  const device = await pickFrameDevice(central, onProgress);

  onProgress?.(`Conectando ${device.name}…`);
  resetWarmPackets();
  await central.connect(device.deviceId);
  try {
    await central.writeConnFast?.();
  } catch {
    // Non-fatal during handshake.
  }

  // On iPad, BleClient.connect() already completes service discovery and
  // startNotifications/CCCD. Do not gate the connection on callbacks crossing
  // WKWebView; the native relay validates the actual packets next.
  if (onIPad) {
    onProgress?.("Bluetooth conectado · abrindo stream…");
    return { device, warmPackets: 0, usedReboot: false };
  }

  // Early-exit as soon as IMU shows up — user moving the frame is a good signal.
  onProgress?.("Validando stream IMU…");
  const warmMs = onIPad ? 8_000 : 2_500;
  // iPad cold ATT can be ~1 Hz — wait longer for the first notify.
  const acceptAt = onIPad ? 1 : 8;
  let warmPackets = await waitForWarmPackets(
    getWarmPackets,
    warmMs,
    acceptAt,
    onProgress,
  );

  let usedReboot = false;

  // iPad: if anything arrived, keep the link. REBOOT+reconnect was causing
  // "Connection timeout" after a partially working session.
  const shouldReboot =
    Boolean(central.writeReboot) &&
    (onIPad ? warmPackets < 1 : warmPackets < 8);

  if (shouldReboot) {
    usedReboot = true;
    onProgress?.("Otimizando conexão Bluetooth…");
    await central.writeReboot();
    await sleep(2_000);
    try {
      await central.disconnect();
    } catch {
      // ESP reboots itself.
    }
    await sleep(onIPad ? 5_000 : 3_000);
    resetWarmPackets();
    await reconnectAfterReboot(central, device.deviceId, onProgress);
    onProgress?.("Validando stream após otimização…");
    warmPackets = await waitForWarmPackets(
      getWarmPackets,
      onIPad ? 5_000 : 3_000,
      1,
      onProgress,
    );
  }

  warmPackets = getWarmPackets();
  if (warmPackets < 1) {
    throw new Error(
      "Bluetooth conectou, mas a moldura não enviou IMU. " +
        "Feche o app no outro aparelho, aproxime a moldura e tente de novo.",
    );
  }

  onProgress?.(`Conectado · ${warmPackets} amostra(s)`);
  return { device, warmPackets, usedReboot };
}
