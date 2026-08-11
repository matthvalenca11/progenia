/** Must match ProgeniaLocalQuatServer.swift */
export const LOCAL_QUAT_WS_URL = "ws://127.0.0.1:19091";
export const LOCAL_QUAT_MAGIC_V1 = 0x5131;
export const LOCAL_QUAT_MAGIC_V2 = 0x5132;
export const LOCAL_QUAT_MAGIC_V3 = 0x5133;
export const LOCAL_QUAT_MAGIC_V4 = 0x5134;
export const LOCAL_QUAT_FRAME_V1_BYTES = 22;
export const LOCAL_QUAT_FRAME_V2_BYTES = 36;
export const LOCAL_QUAT_FRAME_V3_BYTES = 40;
export const LOCAL_QUAT_FRAME_V4_BYTES = 52;

export type LocalQuatFrame = {
  w: number;
  x: number;
  y: number;
  z: number;
  seq: number;
  gravity?: { x: number; y: number; z: number };
  calibration?: {
    accelAccuracy: 0 | 1 | 2 | 3;
    gyroAccuracy: 0 | 1 | 2 | 3;
    stationary: boolean;
    calibrationReady: boolean;
  };
  translationPosition?: number;
  translationWorld?: { x: number; y: number; z: number };
};

export function parseLocalQuatFrame(buf: ArrayBuffer): LocalQuatFrame | null {
  if (buf.byteLength < LOCAL_QUAT_FRAME_V1_BYTES) return null;
  const view = new DataView(buf);
  const magic = view.getUint16(0, true);
  const seq = view.getUint32(2, true);

  if (magic === LOCAL_QUAT_MAGIC_V1) {
    const w = view.getFloat32(6, true);
    const x = view.getFloat32(10, true);
    const y = view.getFloat32(14, true);
    const z = view.getFloat32(18, true);
    if (![w, x, y, z].every((n) => Number.isFinite(n))) return null;
    return { w, x, y, z, seq };
  }

  const isV2 = magic === LOCAL_QUAT_MAGIC_V2;
  const isV3 = magic === LOCAL_QUAT_MAGIC_V3;
  const isV4 = magic === LOCAL_QUAT_MAGIC_V4;
  if ((!isV2 && !isV3 && !isV4) || buf.byteLength < LOCAL_QUAT_FRAME_V2_BYTES) return null;
  if (isV3 && buf.byteLength < LOCAL_QUAT_FRAME_V3_BYTES) return null;
  if (isV4 && buf.byteLength < LOCAL_QUAT_FRAME_V4_BYTES) return null;

  const flags = view.getUint16(6, true);
  const w = view.getFloat32(8, true);
  const x = view.getFloat32(12, true);
  const y = view.getFloat32(16, true);
  const z = view.getFloat32(20, true);
  if (![w, x, y, z].every((n) => Number.isFinite(n))) return null;
  const calibration = {
    accelAccuracy: ((flags >> 1) & 0x03) as 0 | 1 | 2 | 3,
    gyroAccuracy: ((flags >> 3) & 0x03) as 0 | 1 | 2 | 3,
    stationary: (flags & 0x20) !== 0,
    calibrationReady: (flags & 0x40) !== 0,
  };

  let translationPosition: number | undefined;
  let translationWorld: { x: number; y: number; z: number } | undefined;
  if (isV4) {
    translationWorld = {
      x: view.getFloat32(36, true),
      y: view.getFloat32(40, true),
      z: view.getFloat32(44, true),
    };
    translationPosition = translationWorld.z;
  } else if (isV3) {
    translationPosition = view.getFloat32(36, true);
  }

  if ((flags & 0x01) === 0) {
    return {
      w,
      x,
      y,
      z,
      seq,
      calibration,
      ...(translationPosition != null ? { translationPosition } : {}),
      ...(translationWorld ? { translationWorld } : {}),
    };
  }

  const gx = view.getFloat32(24, true);
  const gy = view.getFloat32(28, true);
  const gz = view.getFloat32(32, true);
  if (![gx, gy, gz].every((n) => Number.isFinite(n))) return null;
  return {
    w,
    x,
    y,
    z,
    seq,
    gravity: { x: gx, y: gy, z: gz },
    calibration,
    ...(translationPosition != null ? { translationPosition } : {}),
    ...(translationWorld ? { translationWorld } : {}),
  };
}
