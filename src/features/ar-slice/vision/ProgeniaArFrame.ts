import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { NormalizedQuad, Point2 } from "@/features/ar-slice/vision/types";

export type DetectRectangleOptions = {
  /** JPEG/PNG base64 without data: prefix */
  base64: string;
};

export type DetectRectangleResult = {
  found: boolean;
  corners?: [Point2, Point2, Point2, Point2];
  confidence?: number;
  source?: "vision" | "arkit" | "hand";
};

export type FrameOrientationSample = {
  w: number;
  x: number;
  y: number;
  z: number;
  seq?: number;
  gravity?: { x: number; y: number; z: number };
  calibration?: {
    accelAccuracy: 0 | 1 | 2 | 3;
    gyroAccuracy: 0 | 1 | 2 | 3;
    stationary: boolean;
    calibrationReady: boolean;
  };
  translationPosition?: number;
};

export interface ProgeniaArFramePlugin {
  startMixedReality(): Promise<{ ok: boolean; mode: string }>;
  stopMixedReality(): Promise<void>;
  pollMixedReality(): Promise<{
    tracking: boolean;
    x?: number;
    y?: number;
    z?: number;
    qw?: number;
    qx?: number;
    qy?: number;
    qz?: number;
    fovY?: number;
  }>;
  recenterMixedReality(): Promise<{ ok: boolean }>;
  detectHand(options: DetectRectangleOptions): Promise<DetectRectangleResult>;
  detectRectangle(options: DetectRectangleOptions): Promise<DetectRectangleResult>;
  isAvailable(): Promise<{ available: boolean; engine: string; stream?: boolean }>;
  startUdpStream(options: { port: number }): Promise<{ ok: boolean; mode: string }>;
  startTcpStream(options: { host: string; port: number }): Promise<{ ok: boolean; mode: string }>;
  startBleStream(options?: { deviceId?: string }): Promise<{
    ok: boolean;
    mode: string;
    deviceId: string;
    name: string;
  }>;
  startDeviceMotionStream(): Promise<{ ok: boolean; mode: string }>;
  resetDeviceMotionTranslation(): Promise<{ ok: boolean }>;
  startHandTracking(): Promise<{ ok: boolean; mode: string }>;
  stopHandTracking(): Promise<{ ok: boolean }>;
  pollHandTracking(): Promise<{
    visible: boolean;
    centerX: number;
    centerY: number;
    palmSpan: number;
    confidence: number;
    timestamp: number;
  }>;
  /** iPad: Capacitor owns GATT; relay IMU via localhost WS (no bridge/sample). */
  startCapacitorImuRelay(): Promise<{ ok: boolean; mode: string }>;
  stopCapacitorImuRelay(): Promise<void>;
  sendBleCommand(options: { command: string }): Promise<{ ok: boolean }>;
  stopStream(): Promise<void>;
  pollOrientation(): Promise<{
    ok: boolean;
    w: number;
    x: number;
    y: number;
    z: number;
    seq: number;
    rxHz: number;
    wsTxHz?: number;
    wsClients?: number;
  }>;
  pingHost(options: { host: string; port?: number; timeoutMs?: number }): Promise<{ ok: boolean }>;
  scanFrameHosts(options?: {
    port?: number;
    timeoutMs?: number;
    subnet?: string;
    hostFirst?: number;
    hostLast?: number;
  }): Promise<{ hosts: string[] }>;
  addListener(
    eventName: "orientation",
    listenerFunc: (sample: FrameOrientationSample) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "streamStatus",
    listenerFunc: (status: { state: string; message?: string }) => void,
  ): Promise<PluginListenerHandle>;
}

const ProgeniaArFrame = registerPlugin<ProgeniaArFramePlugin>("ProgeniaArFrame", {
  web: () => ({
    async startMixedReality() {
      throw new Error("Realidade mista ARKit disponível somente no iOS");
    },
    async stopMixedReality() {},
    async pollMixedReality() {
      return { tracking: false };
    },
    async recenterMixedReality() {
      return { ok: false };
    },
    async detectHand() {
      return { found: false };
    },
    async detectRectangle() {
      return { found: false };
    },
    async isAvailable() {
      return { available: false, engine: "none", stream: false };
    },
    async startUdpStream() {
      throw new Error("UDP stream só no iOS nativo");
    },
    async startTcpStream() {
      throw new Error("TCP stream só no iOS nativo");
    },
    async startBleStream() {
      throw new Error("BLE stream nativo disponível somente no app iOS");
    },
    async startDeviceMotionStream() {
      throw new Error("Sensores nativos disponíveis somente no app iOS");
    },
    async resetDeviceMotionTranslation() {
      return { ok: false };
    },
    async startHandTracking() {
      throw new Error("Rastreamento da mão disponível somente no app iOS");
    },
    async stopHandTracking() {
      return { ok: false };
    },
    async pollHandTracking() {
      return {
        visible: false,
        centerX: 0.5,
        centerY: 0.5,
        palmSpan: 0,
        confidence: 0,
        timestamp: 0,
      };
    },
    async startCapacitorImuRelay() {
      throw new Error("Relay IMU nativo disponível somente no app iOS");
    },
    async stopCapacitorImuRelay() {},
    async sendBleCommand() {
      throw new Error("Comando BLE nativo disponível somente no app iOS");
    },
    async stopStream() {},
    async pollOrientation() {
      return { ok: false, w: 1, x: 0, y: 0, z: 0, seq: 0, rxHz: 0 };
    },
    async pingHost() {
      throw new Error("pingHost só no iOS nativo");
    },
    async scanFrameHosts() {
      return { hosts: [] as string[] };
    },
    async addListener() {
      return { remove: async () => {} };
    },
  }),
});

export function mapNativeDetection(result: DetectRectangleResult): NormalizedQuad | null {
  if (!result.found || !result.corners || result.corners.length !== 4) return null;
  return {
    corners: result.corners,
    confidence: result.confidence ?? 0.7,
    source: result.source ?? "vision",
  };
}

export { ProgeniaArFrame };
