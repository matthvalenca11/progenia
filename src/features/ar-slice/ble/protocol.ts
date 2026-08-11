/** GATT IDs — must match docs/ar-slice/BLE_PROTOCOL.md and firmware FrameConfig.h */

export const FRAME_SERVICE_UUID = "6fbe1d30-9a2c-4f1e-9c3a-7b2e1a0d4f01";
export const FRAME_ORIENTATION_UUID = "6fbe1d31-9a2c-4f1e-9c3a-7b2e1a0d4f01";
export const FRAME_COMMAND_UUID = "6fbe1d32-9a2c-4f1e-9c3a-7b2e1a0d4f01";
export const FRAME_PROVISION_UUID = "6fbe1d34-9a2c-4f1e-9c3a-7b2e1a0d4f01";
export const FRAME_NAME_PREFIX = "ProGenia-Frame-";
/** GATT connect — iPad ATT / post-reboot advertising can be slow. */
export const FRAME_CONNECT_TIMEOUT_MS = 30_000;
export const FRAME_ZERO_COMMAND = "ZERO";
/** Ask firmware to renegotiate a fast BLE connection interval (iPad cold ~1 Hz ATT). */
export const FRAME_CONN_FAST_COMMAND = "CONN_FAST";
export const FRAME_CAL_START_COMMAND = "CAL_START";
export const FRAME_CAL_CANCEL_COMMAND = "CAL_CANCEL";
export const FRAME_CAL_SAVE_COMMAND = "CAL_SAVE";

export type ImuCalibrationMetadata = {
  accelAccuracy: 0 | 1 | 2 | 3;
  gyroAccuracy: 0 | 1 | 2 | 3;
  stationary: boolean;
  calibrationReady: boolean;
};

export type Quaternion = {
  w: number;
  x: number;
  y: number;
  z: number;
};

export type GravityVector = {
  x: number;
  y: number;
  z: number;
};

export type OrientationSample = Quaternion & {
  receivedAt: number;
  /** BNO085 gravity in IMU frame (m/s²), when firmware sends gx/gy/gz. */
  gravity?: GravityVector;
  /** BNO085 linear acceleration in IMU frame (m/s²), when firmware sends ax/ay/az. */
  linearAccel?: GravityVector;
  /** BNO085 calibrated gyro (rad/s), when firmware sends wx/wy/wz. */
  gyro?: GravityVector;
  calibration?: ImuCalibrationMetadata;
  /** Legacy scalar cumulative position (m). */
  translationPosition?: number;
  /** World-frame cumulative translation (m) — BLE v3 / WS v4. */
  translationWorld?: GravityVector;
};

export function parseOrientationPayload(
  data: DataView | ArrayBuffer | number[] | string | Uint8Array,
): (Quaternion & {
  gravity?: GravityVector;
  calibration?: ImuCalibrationMetadata;
  translationPosition?: number;
  translationWorld?: GravityVector;
}) | null {
  // Capacitor native sometimes surfaces the wire value as hex before conversion.
  if (typeof data === "string") return parseOrientationHex(data);

  const view =
    data instanceof DataView
      ? data
      : data instanceof ArrayBuffer
        ? new DataView(data)
        : data instanceof Uint8Array
          ? new DataView(data.buffer, data.byteOffset, data.byteLength)
          : new DataView(Uint8Array.from(data).buffer);

  if (view.byteLength >= 26 && view.getUint8(0) === 0xb2 && (view.getUint8(1) & 0x03) === 0x03) {
    const metadata = view.getUint8(1);
    const w = view.getInt16(10, true) / 32767;
    const x = view.getInt16(12, true) / 32767;
    const y = view.getInt16(14, true) / 32767;
    const z = view.getInt16(16, true) / 32767;
    const norm = Math.hypot(w, x, y, z);
    if (!Number.isFinite(norm) || norm < 0.5 || norm > 1.5) return null;
    const translationWorld = {
      x: view.getInt16(4, true) / 10000,
      y: view.getInt16(6, true) / 10000,
      z: view.getInt16(8, true) / 10000,
    };
    return {
      w: w / norm,
      x: x / norm,
      y: y / norm,
      z: z / norm,
      gravity: {
        x: view.getInt16(18, true) / 2048,
        y: view.getInt16(20, true) / 2048,
        z: view.getInt16(22, true) / 2048,
      },
      calibration: {
        accelAccuracy: ((metadata >> 2) & 0x03) as 0 | 1 | 2 | 3,
        gyroAccuracy: ((metadata >> 4) & 0x03) as 0 | 1 | 2 | 3,
        stationary: (metadata & 0x40) !== 0,
        calibrationReady: (metadata & 0x80) !== 0,
      },
      translationWorld,
      // Dominant-axis scalar for any legacy consumer.
      translationPosition: translationWorld.z,
    };
  }

  if (
    view.byteLength >= 20 &&
    view.getUint8(0) === 0xb2 &&
    (view.getUint8(1) & 0x03) === 0x02
  ) {
    const metadata = view.getUint8(1);
    const w = view.getInt16(6, true) / 32767;
    const x = view.getInt16(8, true) / 32767;
    const y = view.getInt16(10, true) / 32767;
    const z = view.getInt16(12, true) / 32767;
    const norm = Math.hypot(w, x, y, z);
    if (!Number.isFinite(norm) || norm < 0.5 || norm > 1.5) return null;
    return {
      w: w / norm,
      x: x / norm,
      y: y / norm,
      z: z / norm,
      gravity: {
        x: view.getInt16(14, true) / 2048,
        y: view.getInt16(16, true) / 2048,
        z: view.getInt16(18, true) / 2048,
      },
      calibration: {
        accelAccuracy: ((metadata >> 2) & 0x03) as 0 | 1 | 2 | 3,
        gyroAccuracy: ((metadata >> 4) & 0x03) as 0 | 1 | 2 | 3,
        stationary: (metadata & 0x40) !== 0,
        calibrationReady: (metadata & 0x80) !== 0,
      },
      translationPosition: view.getInt16(4, true) / 10000,
    };
  }

  if (view.byteLength < 16) return null;
  const w = view.getFloat32(0, true);
  const x = view.getFloat32(4, true);
  const y = view.getFloat32(8, true);
  const z = view.getFloat32(12, true);

  if (![w, x, y, z].every(Number.isFinite)) return null;

  return { w, x, y, z };
}

/** Capacitor bluetooth-le returns hex strings for characteristic values. */
export function parseOrientationHex(
  hex: string,
): ReturnType<typeof parseOrientationPayload> {
  const clean = hex.replace(/\s+/g, "").toLowerCase();
  if (clean.length < 32) return null;
  // Preserve the complete 20/26-byte packet. The old fixed 16-byte buffer
  // truncated BLE v2/v3 and then misread its prefix as legacy float32 data.
  const byteLength = Math.floor(clean.length / 2);
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return parseOrientationPayload(bytes);
}

export function encodeAsciiCommand(command: string): string {
  return Array.from(new TextEncoder().encode(command))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
