import type { OrientationSample } from "@/features/ar-slice/ble/protocol";

export type BleConnectionState =
  | "idle"
  | "initializing"
  | "scanning"
  | "connecting"
  | "connected"
  | "streaming"
  | "reconnecting"
  | "error"
  | "unsupported";

export type BleDeviceInfo = {
  deviceId: string;
  name: string;
  rssi?: number;
};

export type BleCentral = {
  readonly kind: "capacitor" | "mock";
  initialize(): Promise<void>;
  scan(timeoutMs?: number): Promise<BleDeviceInfo[]>;
  stopScan(): Promise<void>;
  connect(deviceId: string): Promise<void>;
  /** Connect without orientation notify — for one-time hotspot provision. */
  connectForProvision?(deviceId: string): Promise<void>;
  provisionWifi?(ssid: string, pass: string): Promise<void>;
  /** iOS/Android system picker — more reliable than passive scan on iPhone. */
  pickDevice?(): Promise<BleDeviceInfo | null>;
  disconnect(): Promise<void>;
  subscribeOrientation(cb: (sample: OrientationSample) => void): () => void;
  writeZero(): Promise<void>;
  /** Restart the frame's BLE controller after a slow first session. */
  writeReboot?(): Promise<void>;
  getConnectionState(): BleConnectionState;
  getDeviceId(): string | null;
};
