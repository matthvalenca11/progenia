import { describe, expect, it, beforeEach } from "vitest";
import { touchReference } from "@/features/ar-slice/touchReference";
import { IDENTITY_QUAT } from "@/features/ar-slice/poseMath";

describe("touchReference", () => {
  beforeEach(() => {
    touchReference.reset();
  });

  it("starts at identity", () => {
    expect(touchReference.getQuat()).toEqual(IDENTITY_QUAT);
  });

  it("maps horizontal drag to yaw (Y component)", () => {
    touchReference.applyFingerDelta(120, 0, 400, 800);
    const q = touchReference.getQuat();
    expect(Math.abs(q.y)).toBeGreaterThan(0.05);
    expect(Math.abs(q.x)).toBeLessThan(0.02);
  });

  it("maps vertical drag to pitch (X component)", () => {
    touchReference.applyFingerDelta(0, 80, 400, 800);
    const q = touchReference.getQuat();
    expect(q.x).toBeGreaterThan(0.03);
  });

  it("allows continuous spin past former Euler clamps", () => {
    // Old yaw clamp was ±0.85π — one full-width swipe is already π.
    touchReference.applyFingerDelta(400, 0, 400, 800);
    const afterOne = touchReference.getQuat();
    expect(Math.abs(afterOne.y)).toBeGreaterThan(0.9);

    // Keep going: 2.5 turns should not clamp; quat stays normalized.
    for (let i = 0; i < 4; i++) {
      touchReference.applyFingerDelta(400, 0, 400, 800);
    }
    const q = touchReference.getQuat();
    expect(Math.hypot(q.w, q.x, q.y, q.z)).toBeCloseTo(1, 5);
    // 5π yaw → half-turn family (w near 0), not stuck at the old ±0.85π stop.
    expect(Math.abs(q.w)).toBeLessThan(0.2);
  });

  it("resets after Zerar-style clear", () => {
    touchReference.applyFingerDelta(200, -100, 400, 800);
    touchReference.reset();
    expect(touchReference.getQuat()).toEqual(IDENTITY_QUAT);
  });
});
