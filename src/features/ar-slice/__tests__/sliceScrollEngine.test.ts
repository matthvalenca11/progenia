import { describe, expect, it } from "vitest";
import { gravityInFrame, IDENTITY_QUAT, slicePitchFromGravityVector } from "@/features/ar-slice/poseMath";
import { SliceScrollEngine } from "@/features/ar-slice/sliceScrollEngine";

describe("slicePitchFromGravityVector", () => {
  it("increases when gravity tilts forward in YZ", () => {
    const flat = slicePitchFromGravityVector({ x: 0, y: -1, z: 0 });
    const tilt = slicePitchFromGravityVector({ x: 0, y: -0.707, z: 0.707 });
    expect(Math.abs(tilt - flat)).toBeGreaterThan(0.6);
  });
});

describe("SliceScrollEngine", () => {
  it("captures zero and reports depth after tilt", () => {
    const engine = new SliceScrollEngine();
    engine.setTuning({ gain: 1, deadzoneRad: 0, smoothing: 1, stationaryBlend: 0 });

    const gFlat = gravityInFrame(IDENTITY_QUAT);
    engine.captureZero(gFlat, IDENTITY_QUAT, false);
    expect(engine.tick(gFlat, IDENTITY_QUAT, 999, false)).toBeCloseTo(0, 4);

    const pitchedQ = { w: Math.SQRT1_2, x: Math.SQRT1_2, y: 0, z: 0 };
    const depth = engine.tick(gravityInFrame(pitchedQ), pitchedQ, 999, false);
    expect(Math.abs(depth)).toBeGreaterThan(0.2);
  });

  it("is stable under in-plane spin after zero (quat path)", () => {
    const engine = new SliceScrollEngine();
    engine.setTuning({ gain: 1, deadzoneRad: 0, smoothing: 1, stationaryBlend: 0 });

    const gFlat = gravityInFrame(IDENTITY_QUAT);
    engine.captureZero(gFlat, IDENTITY_QUAT, false);

    const spinQ = { w: Math.SQRT1_2, x: 0, y: 0, z: Math.SQRT1_2 };
    const gSpin = gravityInFrame(spinQ);
    const depth = engine.tick(gSpin, spinQ, 999, false);
    expect(Math.abs(depth)).toBeLessThan(0.05);
  });
});
