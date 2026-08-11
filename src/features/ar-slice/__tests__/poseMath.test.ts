import { describe, expect, it } from "vitest";
import {
  IDENTITY_QUAT,
  MOUNT_PRESETS,
  applyMountAndZero,
  autoSliceDepthFromGravity,
  captureSlicePitchZero,
  filterDisplayOrientation,
  filterFrontNormal,
  absoluteDisplayFromImu,
  frameCutBasis,
  frameFrontNormal,
  invertLocalZTwist,
  quatFromAxisAngle,
  WORLD_TOWARD_USER,
  WORLD_UP,
  gravityInFrame,
  quatAngularDistance,
  quatMultiply,
  quatNormalize,
  quatSlerp,
  zeroReferenceFromImu,
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

  it("aligns ZERO so the current pose matches the gravity target", () => {
    const qImu = quatNormalize({ w: 0.9, x: 0.1, y: 0.2, z: 0.3 });
    const align = zeroReferenceFromImu(qImu, IDENTITY_QUAT, null);
    const display = applyMountAndZero(qImu, IDENTITY_QUAT, align);
    const n = frameFrontNormal(display);
    // No gravity → face-camera target (+Z).
    expect(n.z).toBeCloseTo(1, 5);
    expect(Math.abs(n.x) + Math.abs(n.y)).toBeLessThan(1e-4);
  });

  it("keeps Z-up horizontal when zeroing with Z already up (screenshot bug)", () => {
    // Absolute display with sensor Z up (Earth→device tip).
    const qBwZUp = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 2);
    const gZUp = { x: 0, y: 0, z: -9.8 };
    const align = zeroReferenceFromImu(qBwZUp, IDENTITY_QUAT, gZUp);
    const display = applyMountAndZero(qBwZUp, IDENTITY_QUAT, align);
    const n = frameFrontNormal(display);
    // Must stay horizontal — old relative zero forced face-on identity here.
    expect(Math.abs(n.y)).toBeCloseTo(1, 5);
    expect(Math.abs(n.x) + Math.abs(n.z)).toBeLessThan(1e-4);
  });

  it("maps absolute sensor Z-up to a horizontal aro without ZERO", () => {
    const qBwZUp = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 2);
    const display = absoluteDisplayFromImu(qBwZUp, IDENTITY_QUAT);
    const n = frameFrontNormal(display);
    expect(Math.abs(n.y)).toBeCloseTo(1, 5);
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

  it("keeps in-plane spin in the cut basis (third gyro axis = sensor Z)", () => {
    const flat = frameCutBasis(IDENTITY_QUAT);
    expect(flat.tangent.x).toBeCloseTo(1, 5);
    expect(flat.bitangent.y).toBeCloseTo(1, 5);
    expect(flat.normal.z).toBeCloseTo(1, 5);
    // 90° about Z — normal stays +Z (disc stays flat); X/Y spin in-plane.
    const spun = frameCutBasis({ w: Math.SQRT1_2, x: 0, y: 0, z: Math.SQRT1_2 });
    expect(spun.normal.z).toBeCloseTo(1, 5);
    expect(Math.abs(spun.normal.x) + Math.abs(spun.normal.y)).toBeLessThan(1e-6);
    expect(spun.tangent.y).toBeCloseTo(1, 5);
    expect(Math.abs(spun.tangent.x)).toBeLessThan(1e-6);
  });

  it("inverts only local-Z twist (CW/CCW), not tip", () => {
    const tip = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -Math.PI / 2);
    const tipped = invertLocalZTwist(tip);
    expect(frameFrontNormal(tipped).y).toBeCloseTo(1, 5);

    const spin = { w: Math.SQRT1_2, x: 0, y: 0, z: Math.SQRT1_2 }; // +90° about Z
    const flipped = invertLocalZTwist(spin);
    // +90° → −90° about Z
    expect(flipped.z).toBeCloseTo(-Math.SQRT1_2, 5);
    expect(frameFrontNormal(flipped).z).toBeCloseTo(1, 5);
    const t = frameCutBasis(spin, true).tangent;
    expect(t.y).toBeCloseTo(-1, 5);
    expect(frameCutBasis(spin, true).normal.z).toBeCloseTo(1, 5);
  });

  it("maps sensor Z to the aro exactly as specified", () => {
    // After ZERO facing the user: Z toward camera → aro faces user.
    const facing = frameCutBasis(IDENTITY_QUAT);
    expect(facing.normal.z).toBeCloseTo(WORLD_TOWARD_USER.z, 5);

    // Display quat is device→world: Z tipped to world up → aro horizontal.
    const zUp = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, -Math.PI / 2);
    const horizontal = frameCutBasis(zUp);
    expect(horizontal.normal.y).toBeCloseTo(WORLD_UP.y, 5);
    expect(Math.abs(horizontal.normal.x) + Math.abs(horizontal.normal.z)).toBeLessThan(1e-6);

    const faceUser = frameCutBasis(IDENTITY_QUAT);
    expect(faceUser.normal.z).toBeCloseTo(1, 5);

    const zAway = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 2);
    const away = frameCutBasis(zAway);
    expect(away.normal.y).toBeCloseTo(-1, 5);
  });

  it("holds display orientation inside the deadband", () => {
    const held = filterDisplayOrientation(
      IDENTITY_QUAT,
      { w: 0.99998, x: 0.006, y: 0, z: 0 },
      {
        deadbandRad: 0.02,
        twistDeadbandRad: 0.03,
        twistGain: 0.28,
        slerpSlow: 0.7,
        slerpFast: 0.95,
        slowRad: 0.08,
      },
    );
    expect(held.w).toBeCloseTo(1, 5);
    expect(held.x).toBeCloseTo(0, 5);
  });

  it("tracks a clear tilt past the deadband", () => {
    const pitched = { w: Math.SQRT1_2, x: Math.SQRT1_2, y: 0, z: 0 };
    const out = filterDisplayOrientation(IDENTITY_QUAT, pitched, {
      deadbandRad: 0.014,
      twistDeadbandRad: 0.03,
      twistGain: 0.28,
      slerpSlow: 0.7,
      slerpFast: 0.95,
      slowRad: 0.08,
    });
    expect(quatAngularDistance(IDENTITY_QUAT, out)).toBeGreaterThan(0.3);
  });

  it("holds the cut normal inside the deadband", () => {
    const held = filterFrontNormal(
      { x: 0, y: 0, z: 1 },
      { x: 0.01, y: 0, z: 0.99995 },
      0.028,
      0.35,
    );
    expect(held.z).toBeCloseTo(1, 3);
    expect(Math.abs(held.x)).toBeLessThan(0.005);
  });

  it("tracks a clear normal change past the deadband", () => {
    const out = filterFrontNormal(
      { x: 0, y: 0, z: 1 },
      { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 },
      0.028,
      0.5,
    );
    expect(out.x).toBeGreaterThan(0.2);
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

  it("preserves complete BLE v2 packets received as Capacitor hex", () => {
    const bytes = new Uint8Array(20);
    const view = new DataView(bytes.buffer);
    view.setUint8(0, 0xb2);
    view.setUint8(1, 0x02 | (3 << 2) | (2 << 4));
    view.setInt16(4, -1234, true);
    view.setInt16(6, 32767, true);
    view.setInt16(14, 2048, true);
    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");

    const sample = parseOrientationHex(hex);

    expect(sample?.w).toBeCloseTo(1);
    expect(sample?.translationPosition).toBeCloseTo(-0.1234);
    expect(sample?.gravity?.x).toBeCloseTo(1);
    expect(sample?.calibration?.accelAccuracy).toBe(3);
  });

  it("rejects short buffers", () => {
    expect(parseOrientationPayload(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("decodes calibration accuracy from BLE v2 metadata bits", () => {
    const view = new DataView(new ArrayBuffer(20));
    view.setUint8(0, 0xb2);
    view.setUint8(1, 0x02 | (3 << 2) | (2 << 4) | 0x40 | 0x80);
    view.setInt16(6, 32767, true);
    view.setInt16(18, -20070, true);
    const sample = parseOrientationPayload(view);
    expect(sample?.calibration).toEqual({
      accelAccuracy: 3,
      gyroAccuracy: 2,
      stationary: true,
      calibrationReady: true,
    });
  });

  it("decodes signed cumulative linear gesture position", () => {
    const view = new DataView(new ArrayBuffer(20));
    view.setUint8(0, 0xb2);
    view.setUint8(1, 0x02);
    view.setInt16(4, -1234, true);
    view.setInt16(6, 32767, true);
    expect(parseOrientationPayload(view)?.translationPosition).toBeCloseTo(-0.1234);
  });

  it("decodes BLE v3 world translation XYZ", () => {
    const view = new DataView(new ArrayBuffer(26));
    view.setUint8(0, 0xb2);
    view.setUint8(1, 0x03);
    view.setInt16(4, 100, true);
    view.setInt16(6, -200, true);
    view.setInt16(8, 500, true);
    view.setInt16(10, 32767, true);
    const sample = parseOrientationPayload(view);
    expect(sample?.translationWorld?.x).toBeCloseTo(0.01);
    expect(sample?.translationWorld?.y).toBeCloseTo(-0.02);
    expect(sample?.translationWorld?.z).toBeCloseTo(0.05);
  });
});
