/** GATT IDs — must match docs/ar-slice/BLE_PROTOCOL.md and firmware FrameConfig.h */

export const FRAME_SERVICE_UUID = "6fbe1d30-9a2c-4f1e-9c3a-7b2e1a0d4f01";
export const FRAME_ORIENTATION_UUID = "6fbe1d31-9a2c-4f1e-9c3a-7b2e1a0d4f01";
export const FRAME_COMMAND_UUID = "6fbe1d32-9a2c-4f1e-9c3a-7b2e1a0d4f01";
export const FRAME_PROVISION_UUID = "6fbe1d34-9a2c-4f1e-9c3a-7b2e1a0d4f01";
export const FRAME_NAME_PREFIX = "ProGenia-Frame-";
export const FRAME_CONNECT_TIMEOUT_MS = 10_000;
export const FRAME_ZERO_COMMAND = "ZERO";

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
};

export function parseOrientationPayload(
  data: DataView | ArrayBuffer | number[],
): (Quaternion & { gravity?: GravityVector }) | null {
  const view =
    data instanceof DataView
      ? data
      : data instanceof ArrayBuffer
        ? new DataView(data)
        : new DataView(Uint8Array.from(data).buffer);

  if (
    view.byteLength >= 20 &&
    view.getUint8(0) === 0xb2 &&
    view.getUint8(1) === 0x02
  ) {
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
export function parseOrientationHex(hex: string): Quaternion | null {
  const clean = hex.replace(/\s+/g, "").toLowerCase();
  if (clean.length < 32) return null;
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return parseOrientationPayload(bytes);
}

export function encodeAsciiCommand(command: string): string {
  return Array.from(new TextEncoder().encode(command))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
