import {
  FRAME_NAME_PREFIX,
  type OrientationSample,
  type Quaternion,
} from "@/features/ar-slice/ble/protocol";
import { applyMountAndZero, IDENTITY_QUAT, quatNormalize } from "@/features/ar-slice/poseMath";
import type { BleCentral, BleConnectionState, BleDeviceInfo } from "@/features/ar-slice/ble/types";

function axisAngle(axis: { x: number; y: number; z: number }, angle: number): Quaternion {
  const half = angle * 0.5;
  const s = Math.sin(half);
  return quatNormalize({
    w: Math.cos(half),
    x: axis.x * s,
    y: axis.y * s,
    z: axis.z * s,
  });
}

/**
 * Web/dev mock that synthesizes smooth orientation at ~60 Hz.
 * Supports local ZERO (relative to captured pose).
 */
export class MockBleCentral implements BleCentral {
  readonly kind = "mock" as const;

  private state: BleConnectionState = "idle";
  private deviceId: string | null = null;
  private listeners = new Set<(sample: OrientationSample) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private t0 = 0;
  private zero: Quaternion | null = null;
  private captureZero = false;

  async initialize(): Promise<void> {
    this.state = "idle";
  }

  async scan(timeoutMs = 1500): Promise<BleDeviceInfo[]> {
    this.state = "scanning";
    await new Promise((r) => setTimeout(r, Math.min(timeoutMs, 400)));
    this.state = "idle";
    return [
      {
        deviceId: "mock-frame-0001",
        name: `${FRAME_NAME_PREFIX}MOCK`,
        rssi: -42,
      },
    ];
  }

  async pickDevice(): Promise<BleDeviceInfo | null> {
    const devices = await this.scan(500);
    return devices[0] ?? null;
  }

  async stopScan(): Promise<void> {
    if (this.state === "scanning") this.state = "idle";
  }

  async connect(deviceId: string): Promise<void> {
    this.state = "connecting";
    await new Promise((r) => setTimeout(r, 200));
    this.deviceId = deviceId;
    this.state = "connected";
    this.t0 = performance.now();
    this.startStream();
  }

  async connectForProvision(deviceId: string): Promise<void> {
    this.state = "connecting";
    await new Promise((r) => setTimeout(r, 200));
    this.deviceId = deviceId;
    this.state = "connected";
  }

  async provisionWifi(_ssid: string, _pass: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 300));
  }

  async disconnect(): Promise<void> {
    this.stopStream();
    this.deviceId = null;
    this.state = "idle";
  }

  subscribeOrientation(cb: (sample: OrientationSample) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async writeZero(): Promise<void> {
    this.captureZero = true;
  }

  getConnectionState(): BleConnectionState {
    return this.state;
  }

  getDeviceId(): string | null {
    return this.deviceId;
  }

  private startStream() {
    this.stopStream();
    this.state = "streaming";
    this.timer = setInterval(() => {
      const t = (performance.now() - this.t0) / 1000;
      // Slow yaw + gentle pitch — readable on the debug cube
      const qYaw = axisAngle({ x: 0, y: 1, z: 0 }, Math.sin(t * 0.6) * 0.8);
      const qPitch = axisAngle({ x: 1, y: 0, z: 0 }, Math.sin(t * 0.35) * 0.35);
      let q = quatNormalize({
        w: qYaw.w * qPitch.w - qYaw.x * qPitch.x - qYaw.y * qPitch.y - qYaw.z * qPitch.z,
        x: qYaw.w * qPitch.x + qYaw.x * qPitch.w + qYaw.y * qPitch.z - qYaw.z * qPitch.y,
        y: qYaw.w * qPitch.y - qYaw.x * qPitch.z + qYaw.y * qPitch.w + qYaw.z * qPitch.x,
        z: qYaw.w * qPitch.z + qYaw.x * qPitch.y - qYaw.y * qPitch.x + qYaw.z * qPitch.w,
      });

      if (this.captureZero) {
        this.zero = q;
        this.captureZero = false;
      }
      if (this.zero) {
        q = applyMountAndZero(q, IDENTITY_QUAT, this.zero);
      }

      const sample: OrientationSample = { ...q, receivedAt: performance.now() };
      this.listeners.forEach((cb) => cb(sample));
    }, 16);
  }

  private stopStream() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
