import { describe, expect, it } from "vitest";
import { LinearSliceDrive } from "@/features/ar-slice/linearSliceDrive";

describe("LinearSliceDrive", () => {
  it("baselines the first packet without moving the cut", () => {
    const drive = new LinearSliceDrive();
    expect(drive.ingest(0.02, 1, 0.15, 0, 0.0004)).toBe(false);
    expect(drive.getTargetDepth()).toBeCloseTo(0.02);
    expect(drive.getUnwrappedMeters()).toBeCloseTo(0.02);
  });

  it("maps absolute unwrapped meters through gain", () => {
    const drive = new LinearSliceDrive();
    drive.ingest(0, 1.5, 0.15, 0, 0.0004);
    expect(drive.ingest(0.04, 1.5, 0.15, 10, 0.0004)).toBe(true);
    expect(drive.getUnwrappedMeters()).toBeCloseTo(0.04);
    expect(drive.getTargetDepth()).toBeCloseTo(0.06);
  });

  it("ignores sub-deadband jitter", () => {
    const drive = new LinearSliceDrive();
    drive.ingest(0, 1, 0.15, 0, 0.0004);
    expect(drive.ingest(0.0002, 1, 0.15, 10, 0.0004)).toBe(false);
    expect(drive.getTargetDepth()).toBeCloseTo(0);
    expect(drive.ingest(0.001, 1, 0.15, 20, 0.0004)).toBe(true);
    expect(drive.getTargetDepth()).toBeCloseTo(0.001);
  });

  it("unwraps the signed int16 position boundary", () => {
    const drive = new LinearSliceDrive();
    drive.ingest(3.2767, 1, 0.15, 0, 0.0004);
    expect(drive.ingest(-3.2759, 1, 0.15, 10, 0.0004)).toBe(true);
    expect(drive.getUnwrappedMeters()).toBeCloseTo(3.2775, 3);
  });

  it("resyncs without jumping when a glitch exceeds max jump", () => {
    const drive = new LinearSliceDrive();
    drive.ingest(0, 1, 0.15, 0, 0.0004);
    drive.ingest(0.02, 1, 0.15, 10, 0.0004);
    expect(drive.ingest(0.5, 1, 0.15, 20, 0.0004)).toBe(false);
    expect(drive.getTargetDepth()).toBeCloseTo(0.5);
  });

  it("eases visual depth toward the absolute target", () => {
    const drive = new LinearSliceDrive();
    drive.ingest(0, 1, 0.15, 0, 0.0004);
    drive.ingest(0.1, 1, 0.15, 10, 0.0004);
    // Large error snaps fully so live probe depth stays precise.
    expect(drive.tick(0.25)).toBeCloseTo(0.1);
    expect(drive.tick(0.25)).toBeCloseTo(0.1);
  });

  it("snaps immediately when smoothing is 1", () => {
    const drive = new LinearSliceDrive();
    drive.ingest(0, 1, 0.15, 0, 0.0004);
    drive.ingest(0.08, 1, 0.15, 10, 0.0004);
    expect(drive.tick(1)).toBeCloseTo(0.08);
  });
});
