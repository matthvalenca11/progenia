import type { OrientationSample } from "@/features/ar-slice/ble/protocol";
import { ProgeniaArFrame } from "@/features/ar-slice/vision/ProgeniaArFrame";
import {
  LOCAL_QUAT_WS_URL,
  parseLocalQuatFrame,
} from "@/features/ar-slice/wifi/localQuatWs";

type Listener = (sample: OrientationSample) => void;

/**
 * High-rate BLE data plane:
 * ESP GATT notify → CoreBluetooth Swift → localhost binary WS → JS.
 * No per-sample Capacitor bridge event is used.
 */
export class NativeBleOrientationClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private sampleCount = 0;
  private lastSeq = -1;
  private rxHz = 0;
  private wsTxHz = 0;
  private deviceId: string | null = null;
  private deviceName: string | null = null;
  private diagTimer: ReturnType<typeof setInterval> | null = null;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async connect(deviceId?: string, onProgress?: (message: string) => void) {
    await this.disconnect();
    onProgress?.("Procurando moldura por Bluetooth…");

    const result = await ProgeniaArFrame.startBleStream(
      deviceId ? { deviceId } : undefined,
    );
    this.deviceId = result.deviceId;
    this.deviceName = result.name;

    onProgress?.("BLE conectado · abrindo canal de alta velocidade…");
    await this.openWebSocketWithRetry(2500);
    // A cold ESP32-C3 boot can briefly finish radio handoff after GATT has
    // already subscribed. Keep the UI in "connecting" instead of reporting a
    // false firmware-version error during that one-time startup window.
    await this.waitForSamples(4, 8000);
    this.startDiagnostics();

    return {
      deviceId: this.deviceId,
      name: this.deviceName ?? "ProGenia Frame",
      mode: result.mode,
    };
  }

  async disconnect() {
    if (this.diagTimer) {
      clearInterval(this.diagTimer);
      this.diagTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.sampleCount = 0;
    this.lastSeq = -1;
    this.rxHz = 0;
    this.wsTxHz = 0;
    try {
      await ProgeniaArFrame.stopStream();
    } catch {
      // Stream may not have started yet.
    }
  }

  getRxHz() {
    return this.rxHz;
  }

  getWsTxHz() {
    return this.wsTxHz;
  }

  getDeviceId() {
    return this.deviceId;
  }

  getDeviceName() {
    return this.deviceName;
  }

  private async openWebSocketWithRetry(timeoutMs: number) {
    const deadline = performance.now() + timeoutMs;
    let lastError: unknown = null;
    while (performance.now() < deadline) {
      try {
        await this.openWebSocket();
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Canal local BLE não abriu");
  }

  private openWebSocket() {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(LOCAL_QUAT_WS_URL);
      ws.binaryType = "arraybuffer";
      const timer = window.setTimeout(() => {
        ws.close();
        reject(new Error("Timeout no canal local BLE"));
      }, 800);

      ws.onopen = () => {
        window.clearTimeout(timer);
        this.ws = ws;
        resolve();
      };
      ws.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("Falha no canal local BLE"));
      };
      ws.onmessage = (event) => {
        if (!(event.data instanceof ArrayBuffer)) return;
        const frame = parseLocalQuatFrame(event.data);
        if (!frame || frame.seq === this.lastSeq) return;
        this.lastSeq = frame.seq;
        this.sampleCount++;
        const sample: OrientationSample = {
          w: frame.w,
          x: frame.x,
          y: frame.y,
          z: frame.z,
          receivedAt: performance.now(),
          ...(frame.gravity ? { gravity: frame.gravity } : {}),
        };
        this.listeners.forEach((listener) => listener(sample));
      };
    });
  }

  private waitForSamples(minSamples: number, timeoutMs: number) {
    const initial = this.sampleCount;
    return new Promise<void>((resolve, reject) => {
      const deadline = performance.now() + timeoutMs;
      const timer = window.setInterval(() => {
        if (this.sampleCount - initial >= minSamples) {
          window.clearInterval(timer);
          resolve();
        } else if (performance.now() >= deadline) {
          window.clearInterval(timer);
          reject(
            new Error(
              "BLE conectou, mas não recebeu IMU. Reinicie a moldura e tente novamente.",
            ),
          );
        }
      }, 50);
    });
  }

  private startDiagnostics() {
    let previousCount = this.sampleCount;
    this.diagTimer = setInterval(() => {
      this.rxHz = this.sampleCount - previousCount;
      previousCount = this.sampleCount;
      void ProgeniaArFrame.pollOrientation()
        .then((diag) => {
          this.rxHz = diag.rxHz || this.rxHz;
          this.wsTxHz = diag.wsTxHz ?? 0;
        })
        .catch(() => {});
    }, 1000);
  }
}
