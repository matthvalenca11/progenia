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
  source?: "vision" | "arkit";
};

export type FrameOrientationSample = { w: number; x: number; y: number; z: number };

export interface ProgeniaArFramePlugin {
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
