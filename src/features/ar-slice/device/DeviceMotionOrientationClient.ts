import type { OrientationSample } from "@/features/ar-slice/ble/protocol";
import {
  ProgeniaArFrame,
  type FrameOrientationSample,
} from "@/features/ar-slice/vision/ProgeniaArFrame";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import {
  LOCAL_QUAT_WS_URL,
  parseLocalQuatFrame,
} from "@/features/ar-slice/wifi/localQuatWs";

type Listener = (sample: OrientationSample) => void;

/**
 * CoreMotion accelerometer + gyroscope → localhost binary WS → shared IMU pipeline.
 * Samples are coalesced to one per animation frame, matching the native BLE path.
 */
export class DeviceMotionOrientationClient {
  private ws: WebSocket | null = null;
  private nativeOrientationListener: PluginListenerHandle | null = null;
  private listeners = new Set<Listener>();
  private pendingSample: OrientationSample | null = null;
  private rafId = 0;
  private lastSeq = -1;
  private sampleCount = 0;
  private rxHz = 0;
  private wsTxHz = 0;
  private diagnosticsTimer: ReturnType<typeof setInterval> | null = null;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async connect(onProgress?: (message: string) => void) {
    await this.disconnect();
    onProgress?.("Ativando acelerômetro e giroscópio…");

    try {
      const isAndroid = Capacitor.getPlatform() === "android";
      if (isAndroid) {
        onProgress?.("Conectando aos sensores do aparelho…");
        this.nativeOrientationListener = await ProgeniaArFrame.addListener(
          "orientation",
          this.handleNativeSample,
        );
      }

      const result = await ProgeniaArFrame.startDeviceMotionStream();
      if (!isAndroid) {
        onProgress?.("Abrindo canal dos sensores…");
        await this.openWebSocketWithRetry(2_500);
      }
      await this.waitForSamples(3, 4_000);
      this.startDiagnostics();
      return result;
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  async disconnect() {
    if (this.diagnosticsTimer) {
      clearInterval(this.diagnosticsTimer);
      this.diagnosticsTimer = null;
    }
    this.clearPending();
    this.ws?.close();
    this.ws = null;
    await this.nativeOrientationListener?.remove().catch(() => undefined);
    this.nativeOrientationListener = null;
    this.lastSeq = -1;
    this.sampleCount = 0;
    this.rxHz = 0;
    this.wsTxHz = 0;
    await ProgeniaArFrame.stopStream().catch(() => undefined);
  }

  getRxHz() {
    return this.rxHz;
  }

  getWsTxHz() {
    return this.wsTxHz;
  }

  async resetTranslation() {
    await ProgeniaArFrame.resetDeviceMotionTranslation();
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
      : new Error("Canal local dos sensores não abriu");
  }

  private openWebSocket() {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(LOCAL_QUAT_WS_URL);
      ws.binaryType = "arraybuffer";
      const timer = window.setTimeout(() => {
        ws.close();
        reject(new Error("Timeout no canal dos sensores"));
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
        reject(new Error("Falha no canal dos sensores"));
      };
      ws.onclose = () => {
        if (this.ws === ws) this.ws = null;
      };
      ws.onmessage = (event) => {
        if (!(event.data instanceof ArrayBuffer)) return;
        const frame = parseLocalQuatFrame(event.data);
        if (!frame || frame.seq === this.lastSeq) return;
        this.lastSeq = frame.seq;
        this.sampleCount += 1;
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
          reject(new Error("Os sensores do aparelho não enviaram dados."));
        }
      }, 50);
    });
  }

  private startDiagnostics() {
    let previousCount = this.sampleCount;
    this.diagnosticsTimer = setInterval(() => {
      this.rxHz = this.sampleCount - previousCount;
      previousCount = this.sampleCount;
      void ProgeniaArFrame.pollOrientation()
        .then((diagnostics) => {
          this.rxHz = diagnostics.rxHz || this.rxHz;
          this.wsTxHz = diagnostics.wsTxHz ?? 0;
        })
        .catch(() => undefined);
    }, 1_000);
  }

  private clearPending() {
    this.pendingSample = null;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private handleNativeSample = (sample: FrameOrientationSample) => {
    if (![sample.w, sample.x, sample.y, sample.z].every(Number.isFinite)) return;
    if (sample.seq != null && sample.seq === this.lastSeq) return;
    this.lastSeq = sample.seq ?? this.lastSeq + 1;
    this.sampleCount += 1;
    this.pendingSample = {
      w: sample.w,
      x: sample.x,
      y: sample.y,
      z: sample.z,
      receivedAt: performance.now(),
      ...(sample.gravity ? { gravity: sample.gravity } : {}),
      ...(sample.calibration ? { calibration: sample.calibration } : {}),
      ...(sample.translationPosition != null
        ? { translationPosition: sample.translationPosition }
        : {}),
    };
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(this.flushPending);
    }
  };

  private flushPending = () => {
    this.rafId = 0;
    const sample = this.pendingSample;
    this.pendingSample = null;
    if (!sample) return;
    this.listeners.forEach((listener) => listener(sample));
  };
}
