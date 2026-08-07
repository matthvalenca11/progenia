import { describe, expect, it } from "vitest";
import {
  IDENTITY_QUAT,
  MOUNT_PRESETS,
  applyMountAndZero,
  autoSliceDepthFromGravity,
  captureSlicePitchZero,
  frameFrontNormal,
  gravityInFrame,
  quatMultiply,
  quatNormalize,
  quatSlerp,
  resetSlicePitchZero,
  slicePitchFromFrameUp,
  slicePitchFromGravityInFrame,
  slicePitchFromGravityVector,
  suggestMountPreset,
  suggestMountPresetFromFlatGravity,
} from "@/features/ar-slice/poseMath";
import { parseOrientationHex, parseOrientationPayload } from "@/features/ar-slice/ble/protocol";

describe("poseMath", () => {
  it("normalizes identity", () => {
    const q = quatNormalize({ w: 2, x: 0, y: 0, z: 0 });
    expect(q.w).toBeCloseTo(1);
  });

  it("applies zero so current pose becomes identity", () => {
    const qImu = quatNormalize({ w: 0.9, x: 0.1, y: 0.2, z: 0.3 });
    const relative = applyMountAndZero(qImu, IDENTITY_QUAT, qImu);
    expect(relative.w).toBeCloseTo(1, 5);
    expect(relative.x).toBeCloseTo(0, 5);
    expect(relative.y).toBeCloseTo(0, 5);
    expect(relative.z).toBeCloseTo(0, 5);
  });

  it("applies mount then zero", () => {
    const qMount = { w: Math.SQRT1_2, x: Math.SQRT1_2, y: 0, z: 0 };
    const qImu = IDENTITY_QUAT;
    const framed = applyMountAndZero(qImu, qMount, null);
    expect(framed.x).toBeCloseTo(Math.SQRT1_2, 5);
    const zeroed = applyMountAndZero(qImu, qMount, framed);
    expect(zeroed.w).toBeCloseTo(1, 5);
  });

  it("slerps with hemisphere correction", () => {
    const a = IDENTITY_QUAT;
    const b = { w: -0.999, x: 0, y: 0, z: 0.0447 };
    const mid = quatSlerp(a, b, 0.5);
    expect(mid.w).toBeGreaterThan(0.9);
  });

  it("rotates front normal with identity", () => {
    const n = frameFrontNormal(IDENTITY_QUAT);
    expect(n.z).toBeCloseTo(1);
    expect(n.x).toBeCloseTo(0);
  });

  it("multiplies unit quaternions to unit length", () => {
    const q = quatMultiply(
      { w: Math.SQRT1_2, x: 0, y: Math.SQRT1_2, z: 0 },
      { w: Math.SQRT1_2, x: Math.SQRT1_2, y: 0, z: 0 },
    );
    const n = Math.hypot(q.w, q.x, q.y, q.z);
    expect(n).toBeCloseTo(1, 5);
  });

  it("suggests a mount preset from flat + pitched samples", () => {
    const flat = IDENTITY_QUAT;
    // ~90° about X after identity mount
    const tilted = { w: Math.SQRT1_2, x: Math.SQRT1_2, y: 0, z: 0 };
    const { preset } = suggestMountPreset(flat, tilted);
    expect(preset in MOUNT_PRESETS).toBe(true);
    expect(preset).toBe("identity");
  });

  it("maps gravity in frame at identity to world down", () => {
    const g = gravityInFrame(IDENTITY_QUAT);
    expect(g.x).toBeCloseTo(0, 5);
    expect(g.y).toBeCloseTo(-1, 5);
    expect(g.z).toBeCloseTo(0, 5);
  });

  it("derives non-zero slice depth when frame is pitched about X", () => {
    resetSlicePitchZero();
    const flat = autoSliceDepthFromGravity(IDENTITY_QUAT);
    const pitched = autoSliceDepthFromGravity({
      w: Math.SQRT1_2,
      x: Math.SQRT1_2,
      y: 0,
      z: 0,
    });
    expect(flat).toBeCloseTo(0, 5);
    expect(Math.abs(pitched)).toBeGreaterThan(0.25);
  });

  it("keeps slice depth stable when spinning about Z (in-plane rotation)", () => {
    resetSlicePitchZero();
    const flat = autoSliceDepthFromGravity(IDENTITY_QUAT);
    const spun = autoSliceDepthFromGravity({
      w: Math.SQRT1_2,
      x: 0,
      y: 0,
      z: Math.SQRT1_2,
    });
    expect(flat).toBeCloseTo(spun, 5);
  });

  it("keeps slice depth stable when yawing about Y", () => {
    resetSlicePitchZero();
    const flat = autoSliceDepthFromGravity(IDENTITY_QUAT);
    const yawed = autoSliceDepthFromGravity({
      w: Math.cos(Math.PI / 6),
      x: 0,
      y: Math.sin(Math.PI / 6),
      z: 0,
    });
    expect(flat).toBeCloseTo(yawed, 5);
  });

  it("uses gravity YZ pitch — stable under in-plane spin", () => {
    expect(slicePitchFromGravityInFrame(IDENTITY_QUAT)).toBeCloseTo(0, 5);
    const spun = slicePitchFromGravityInFrame({
      w: Math.SQRT1_2,
      x: 0,
      y: 0,
      z: Math.SQRT1_2,
    });
    expect(spun).toBeCloseTo(0, 5);
  });

  it("captures slice zero from gravity vector at arbitrary pose", () => {
    const g = { x: 0.1, y: -0.9, z: 0.2 };
    captureSlicePitchZero(g);
    expect(autoSliceDepthFromGravity(g)).toBeCloseTo(0, 5);
    resetSlicePitchZero();
  });

  it("suggests gravity mount when flat IMU is identity", () => {
    const { preset } = suggestMountPresetFromFlatGravity(IDENTITY_QUAT);
    expect(preset).toBe("identity");
  });
});

describe("BLE protocol parser", () => {
  it("parses little-endian float32 quaternion", () => {
    const buf = new ArrayBuffer(16);
    const view = new DataView(buf);
    view.setFloat32(0, 1, true);
    view.setFloat32(4, 0, true);
    view.setFloat32(8, 0, true);
    view.setFloat32(12, 0, true);
    const q = parseOrientationPayload(view);
    expect(q).toEqual({ w: 1, x: 0, y: 0, z: 0 });
  });

  it("parses hex payload", () => {
    // 1.0f LE = 00 00 80 3f
    const hex = "0000803f000000000000000000000000";
    const q = parseOrientationHex(hex);
    expect(q?.w).toBeCloseTo(1);
  });

  it("rejects short buffers", () => {
    expect(parseOrientationPayload(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
