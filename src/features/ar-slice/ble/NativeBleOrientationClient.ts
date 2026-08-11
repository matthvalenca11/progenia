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
  private wsRecoveryInProgress = false;
  private stalledJsTicks = 0;
  /** Keep only the newest IMU sample and flush once per animation frame. */
  private pendingSample: OrientationSample | null = null;
  private rafId = 0;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async connect(deviceId?: string, onProgress?: (message: string) => void) {
    await this.disconnect();
    onProgress?.("Procurando moldura por Bluetooth…");

    const statusHandle = await ProgeniaArFrame.addListener(
      "streamStatus",
      (status) => {
        if (typeof status.message === "string" && status.message.length > 0) {
          onProgress?.(status.message);
        }
      },
    );

    try {
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
    } finally {
      await statusHandle.remove().catch(() => {});
    }
  }

  /** Tear down relay/WS without touching Capacitor GATT (iPad hybrid fallback). */
  async abortRelayOnly() {
    if (this.diagTimer) {
      clearInterval(this.diagTimer);
      this.diagTimer = null;
    }
    this.clearPending();
    this.ws?.close();
    this.ws = null;
    this.sampleCount = 0;
    this.lastSeq = -1;
    this.rxHz = 0;
    this.wsTxHz = 0;
    await this.detachCapacitorRelay();
  }

  /**
   * iPad hybrid: Capacitor already connected + subscribed. Start native WS relay
   * that receives GATT notifies without crossing the Capacitor bridge per sample.
   */
  async attachCapacitorRelay(onProgress?: (message: string) => void) {
    onProgress?.("Abrindo canal IMU de alta velocidade…");
    await ProgeniaArFrame.startCapacitorImuRelay();
    this.relayActive = true;
    try {
      await this.openWebSocketWithRetry(2500);
      await this.waitForSamples(1, 5000);
      this.startDiagnostics();
    } catch (error) {
      await this.abortRelayOnly();
      throw error;
    }
  }

  private relayActive = false;

  private async detachCapacitorRelay() {
    if (!this.relayActive) return;
    this.relayActive = false;
    await ProgeniaArFrame.stopCapacitorImuRelay().catch(() => undefined);
  }

  async disconnect() {
    if (this.diagTimer) {
      clearInterval(this.diagTimer);
      this.diagTimer = null;
    }
    this.clearPending();
    this.ws?.close();
    this.ws = null;
    this.sampleCount = 0;
    this.lastSeq = -1;
    this.rxHz = 0;
    this.wsTxHz = 0;
    this.wsRecoveryInProgress = false;
    this.stalledJsTicks = 0;
    await this.detachCapacitorRelay();
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

  async writeZero() {
    await ProgeniaArFrame.sendBleCommand({ command: "ZERO" });
  }

  async writeCalibrationCommand(command: "CAL_START" | "CAL_CANCEL" | "CAL_SAVE") {
    await ProgeniaArFrame.sendBleCommand({ command });
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
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.close();
        reject(new Error("Falha no canal local BLE"));
      };
      ws.onclose = () => {
        if (this.ws === ws) this.ws = null;
      };
      ws.onmessage = (event) => {
        if (!(event.data instanceof ArrayBuffer)) return;
        const frame = parseLocalQuatFrame(event.data);
        if (!frame || frame.seq === this.lastSeq) return;
        this.lastSeq = frame.seq;
        this.sampleCount++;
        // Coalesce: a busy MRI frame must not process 40+ samples in a backlog.
        this.pendingSample = {
          w: frame.w,
          x: frame.x,
          y: frame.y,
          z: frame.z,
          receivedAt: performance.now(),
          ...(frame.gravity ? { gravity: frame.gravity } : {}),
          ...(frame.calibration ? { calibration: frame.calibration } : {}),
          ...(frame.translationPosition != null
            ? { translationPosition: frame.translationPosition }
            : {}),
          ...(frame.translationWorld
            ? { translationWorld: frame.translationWorld }
            : {}),
        };
        if (!this.rafId) {
          this.rafId = requestAnimationFrame(this.flushPending);
        }
      };
    });
  }

  private clearPending() {
    this.pendingSample = null;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private flushPending = () => {
    this.rafId = 0;
    const sample = this.pendingSample;
    this.pendingSample = null;
    if (!sample) return;
    this.listeners.forEach((listener) => listener(sample));
  };

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
      const jsDelta = this.sampleCount - previousCount;
      this.rxHz = jsDelta;
      previousCount = this.sampleCount;
      void ProgeniaArFrame.pollOrientation()
        .then((diag) => {
          this.rxHz = diag.rxHz || this.rxHz;
          this.wsTxHz = diag.wsTxHz ?? 0;
          this.stalledJsTicks = jsDelta === 0 ? this.stalledJsTicks + 1 : 0;

          const localSocketMissing =
            this.ws?.readyState !== WebSocket.OPEN ||
            (diag.wsClients ?? 0) === 0;
          // Rebuild only when the socket or native server actually lost its
          // endpoint. A temporarily busy JS thread must not spawn C1/C2/C3...
          // replacement sockets while the original connection is healthy.
          // Require a longer stall before tearing down the WS — brief MRI/UI
          // hitch used to trip recovery and freeze the lab for a few seconds.
          if (
            this.stalledJsTicks >= 8 &&
            diag.rxHz > 0 &&
            localSocketMissing &&
            !this.wsRecoveryInProgress
          ) {
            this.wsRecoveryInProgress = true;
            this.ws?.close();
            this.ws = null;
            void this.openWebSocketWithRetry(3_000)
              .then(() => {
                this.stalledJsTicks = 0;
              })
              .finally(() => {
                this.wsRecoveryInProgress = false;
              });
          }
        })
        .catch(() => {});
    }, 2000);
  }
}
