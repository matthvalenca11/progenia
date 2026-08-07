import { describe, expect, it } from "vitest";
import { IDENTITY_QUAT, quatMultiply } from "@/features/ar-slice/poseMath";
import {
  areRotationAxesDistinct,
  gravityAngleDeg,
  isGravityTiltNearDegrees,
  isRotationNearDegrees,
  rotationAngleDeg,
  StationaryGate,
} from "@/features/ar-slice/axisCalibration";

describe("axisCalibration", () => {
  it("detects ~90° gravity tilt", () => {
    const flat = { x: 0, y: 0, z: -9.8 };
    const tilt = { x: -9.8, y: 0, z: 0 };
    expect(gravityAngleDeg(flat, tilt)).toBeCloseTo(90, 0);
    expect(isGravityTiltNearDegrees(flat, tilt)).toBe(true);
  });

  it("rejects shallow tilt", () => {
    const flat = IDENTITY_QUAT;
    const shallow = { w: 0.9914, x: 0.131, y: 0, z: 0 };
    expect(isRotationNearDegrees(flat, shallow)).toBe(false);
  });

  it("detects distinct rotation axes for pitch then roll", () => {
    const flat = IDENTITY_QUAT;
    const pitch90 = { w: Math.SQRT1_2, x: Math.SQRT1_2, y: 0, z: 0 };
    const rollFromPitch = quatMultiply(pitch90, {
      w: Math.SQRT1_2,
      x: 0,
      y: Math.SQRT1_2,
      z: 0,
    });
    expect(areRotationAxesDistinct(flat, pitch90, rollFromPitch)).toBe(true);
  });

  it("StationaryGate becomes ready after hold time", () => {
    const gate = new StationaryGate();
    expect(gate.tick(0.01, 0, 500).status).toBe("waiting");
    expect(gate.tick(0.01, 400, 500).status).toBe("waiting");
    expect(gate.tick(0.01, 500, 500).status).toBe("ready");
  });

  it("StationaryGate resets on motion", () => {
    const gate = new StationaryGate();
    gate.tick(0.01, 1000);
    expect(gate.tick(2, 1100).status).toBe("moving");
    expect(gate.tick(0.01, 1200).status).toBe("waiting");
  });
});
