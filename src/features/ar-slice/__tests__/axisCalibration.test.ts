import { describe, expect, it } from "vitest";
import { IDENTITY_QUAT, quatMultiply } from "@/features/ar-slice/poseMath";
import {
  areRotationAxesDistinct,
  CalibrationSampleWindow,
  GravityFaceTracker,
  gravityAngleDeg,
  isCalibrationCoverageComplete,
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

  it("averages a stable pose and rejects transient outliers", () => {
    const window = new CalibrationSampleWindow();
    for (let i = 0; i < 24; i++) {
      const gravity = i === 5 ? { x: 9.8, y: 0, z: 0 } : { x: 0.002 * (i % 2), y: 0, z: -9.8 };
      window.push(IDENTITY_QUAT, gravity, i * 50);
    }
    const pose = window.pose(800);
    expect(pose).not.toBeNull();
    expect(pose?.gravity.z).toBeLessThan(-0.99);
    expect(pose?.gravitySpreadDeg).toBeLessThan(1);
  });

  it("does not accept a moving calibration window", () => {
    const window = new CalibrationSampleWindow();
    for (let i = 0; i < 24; i++) {
      window.push(
        { w: Math.cos(i * 0.02), x: Math.sin(i * 0.02), y: 0, z: 0 },
        { x: 0, y: Math.sin(i * 0.08), z: -Math.cos(i * 0.08) },
        i * 50,
      );
    }
    expect(window.pose(800)).toBeNull();
  });

  it("counts distinct gravity faces only once", () => {
    const tracker = new GravityFaceTracker();
    expect(tracker.add({ x: 0, y: 0, z: -9.8 })).toBe(1);
    expect(tracker.add({ x: 0.1, y: 0, z: -9.7 })).toBe(1);
    expect(tracker.add({ x: 9.8, y: 0, z: 0 })).toBe(2);
    expect(tracker.add({ x: -9.8, y: 0, z: 0 })).toBe(3);
    expect(tracker.add({ x: 0, y: 9.8, z: 0 })).toBe(4);
  });

  it("accepts three faces when both sensors report excellent accuracy", () => {
    expect(
      isCalibrationCoverageComplete(3, {
        accelAccuracy: 3,
        gyroAccuracy: 3,
        stationary: true,
        calibrationReady: false,
      }),
    ).toBe(true);
    expect(
      isCalibrationCoverageComplete(3, {
        accelAccuracy: 2,
        gyroAccuracy: 3,
        stationary: true,
        calibrationReady: false,
      }),
    ).toBe(false);
  });

  it("accepts four faces when accuracy metadata is unavailable", () => {
    expect(
      isCalibrationCoverageComplete(4, {
        accelAccuracy: 0,
        gyroAccuracy: 0,
        stationary: false,
        calibrationReady: false,
      }),
    ).toBe(true);
    expect(
      isCalibrationCoverageComplete(3, {
        accelAccuracy: 0,
        gyroAccuracy: 0,
        stationary: false,
        calibrationReady: false,
      }),
    ).toBe(false);
  });
});
