import { describe, expect, it } from "vitest";
import { CameraTranslationDrive } from "@/features/ar-slice/vision/cameraTranslationDrive";
import { IDENTITY_QUAT } from "@/features/ar-slice/poseMath";
import type { FramePose } from "@/features/ar-slice/vision/types";

function pose(x: number, y: number, z: number): FramePose {
  return {
    position: { x, y, z },
    quaternion: { ...IDENTITY_QUAT },
    scale: 1,
    ndcWidth: 0.5,
    ndcHeight: 0.4,
    confidence: 1,
    receivedAt: 0,
    source: "vision",
  };
}

describe("CameraTranslationDrive", () => {
  it("commits a stable vertical displacement", () => {
    const drive = new CameraTranslationDrive();
    drive.ingest(pose(0, 0, -1), IDENTITY_QUAT, 0);
    expect(drive.ingest(pose(0, 0.03, -1), IDENTITY_QUAT, 100)).toBe(true);
    expect(drive.getDepth()).toBeCloseTo(-0.03);
    drive.ingest(pose(0, 0.031, -1), IDENTITY_QUAT, 250);
    drive.ingest(pose(0, 0.031, -1), IDENTITY_QUAT, 450);
    expect(drive.getDepth()).toBeCloseTo(-0.031);
  });

  it("selects normal motion when it dominates", () => {
    const drive = new CameraTranslationDrive();
    drive.ingest(pose(0, 0, -1), IDENTITY_QUAT, 0);
    drive.ingest(pose(0, 0.002, -0.95), IDENTITY_QUAT, 100);
    drive.ingest(pose(0, 0.002, -0.95), IDENTITY_QUAT, 450);
    expect(drive.getDepth()).toBeCloseTo(-0.05);
  });

  it("rejects translation accompanied by rotation", () => {
    const drive = new CameraTranslationDrive();
    drive.ingest(pose(0, 0, -1), IDENTITY_QUAT, 0);
    const rotated = { w: Math.cos(0.2), x: Math.sin(0.2), y: 0, z: 0 };
    drive.ingest(pose(0, 0.05, -1), rotated, 100);
    drive.ingest(pose(0, 0.05, -1), rotated, 500);
    expect(drive.getDepth()).toBe(0);
  });

  it("rebases after tracking loss without jumping", () => {
    const drive = new CameraTranslationDrive();
    drive.ingest(pose(0, 0, -1), IDENTITY_QUAT, 0);
    drive.rebase();
    expect(drive.ingest(pose(0, 0.2, -0.7), IDENTITY_QUAT, 1000)).toBe(false);
    expect(drive.getDepth()).toBe(0);
  });
});
