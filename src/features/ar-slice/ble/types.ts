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
  /** Ask firmware to hammer fast connection params (iPad cold ATT). */
  writeConnFast?(): Promise<void>;
  /** Raw GATT notify rate (pre-RAF), when implemented. */
  getRxHz?(): number;
  /** Native relay owns high-rate monitoring; pause JS-side packet watchdog. */
  setNativeRelayActive?(active: boolean): void;
  /** Restart the frame's BLE controller after a slow first session. */
  writeReboot?(): Promise<void>;
  writeCalibrationCommand?(command: "CAL_START" | "CAL_CANCEL" | "CAL_SAVE"): Promise<void>;
  getConnectionState(): BleConnectionState;
  getDeviceId(): string | null;
};
