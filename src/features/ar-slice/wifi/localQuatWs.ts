/** Must match ProgeniaLocalQuatServer.swift */
export const LOCAL_QUAT_WS_URL = "ws://127.0.0.1:19091";
export const LOCAL_QUAT_MAGIC_V1 = 0x5131;
export const LOCAL_QUAT_MAGIC_V2 = 0x5132;
export const LOCAL_QUAT_FRAME_V1_BYTES = 22;
export const LOCAL_QUAT_FRAME_V2_BYTES = 36;

export type LocalQuatFrame = {
  w: number;
  x: number;
  y: number;
  z: number;
  seq: number;
  gravity?: { x: number; y: number; z: number };
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

  if (magic !== LOCAL_QUAT_MAGIC_V2 || buf.byteLength < LOCAL_QUAT_FRAME_V2_BYTES) return null;
  const flags = view.getUint16(6, true);
  const w = view.getFloat32(8, true);
  const x = view.getFloat32(12, true);
  const y = view.getFloat32(16, true);
  const z = view.getFloat32(20, true);
  if (![w, x, y, z].every((n) => Number.isFinite(n))) return null;
  if ((flags & 0x01) === 0) return { w, x, y, z, seq };

  const gx = view.getFloat32(24, true);
  const gy = view.getFloat32(28, true);
  const gz = view.getFloat32(32, true);
  if (![gx, gy, gz].every((n) => Number.isFinite(n))) return null;
  return { w, x, y, z, seq, gravity: { x: gx, y: gy, z: gz } };
}
