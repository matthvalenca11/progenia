import { describe, expect, it } from "vitest";
import {
  LOCAL_QUAT_MAGIC_V1,
  LOCAL_QUAT_MAGIC_V2,
  parseLocalQuatFrame,
} from "@/features/ar-slice/wifi/localQuatWs";

describe("local IMU websocket protocol", () => {
  it("keeps compatibility with quaternion-only v1", () => {
    const buffer = new ArrayBuffer(22);
    const view = new DataView(buffer);
    view.setUint16(0, LOCAL_QUAT_MAGIC_V1, true);
    view.setUint32(2, 7, true);
    view.setFloat32(6, 1, true);
    const frame = parseLocalQuatFrame(buffer);
    expect(frame).toMatchObject({ seq: 7, w: 1, x: 0, y: 0, z: 0 });
    expect(frame?.gravity).toBeUndefined();
  });

  it("parses v2 quaternion and BNO085 gravity", () => {
    const buffer = new ArrayBuffer(36);
    const view = new DataView(buffer);
    view.setUint16(0, LOCAL_QUAT_MAGIC_V2, true);
    view.setUint32(2, 42, true);
    view.setUint16(6, 1, true);
    view.setFloat32(8, 1, true);
    view.setFloat32(24, 0.1, true);
    view.setFloat32(28, -9.8, true);
    view.setFloat32(32, 0.2, true);

    const frame = parseLocalQuatFrame(buffer);
    expect(frame?.seq).toBe(42);
    expect(frame?.gravity?.x).toBeCloseTo(0.1);
    expect(frame?.gravity?.y).toBeCloseTo(-9.8);
    expect(frame?.gravity?.z).toBeCloseTo(0.2);
  });

  it("rejects malformed frames", () => {
    expect(parseLocalQuatFrame(new ArrayBuffer(10))).toBeNull();
    const invalid = new ArrayBuffer(22);
    new DataView(invalid).setUint16(0, 0xffff, true);
    expect(parseLocalQuatFrame(invalid)).toBeNull();
  });
});
