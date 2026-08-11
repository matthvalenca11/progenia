import { describe, expect, it } from "vitest";
import { BleHandFusion } from "@/features/ar-slice/vision/bleHandFusion";

describe("BleHandFusion", () => {
  it("returns untouched firmware position while disabled", () => {
    const fusion = new BleHandFusion();
    fusion.ingestHand({ visible: true, centerY: 0.2, confidence: 1 }, 0);
    expect(fusion.ingestSensor(0.12)).toBeCloseTo(0.12);
  });

  it("corrects BLE drift toward vertical palm motion without jumping", () => {
    const fusion = new BleHandFusion();
    fusion.setEnabled(true);
    fusion.ingestSensor(0, 0);
    fusion.ingestHand({ visible: true, centerY: 0.5, confidence: 1 }, 0);
    fusion.ingestSensor(0.01, 50);
    const corrected = fusion.ingestHand(
      { visible: true, centerY: 0.3, confidence: 1 },
      100,
    );
    expect(corrected).toBeGreaterThan(0);
    expect(corrected).toBeLessThanOrEqual(0.018);
  });

  it("rebases after tracking loss instead of snapping", () => {
    const fusion = new BleHandFusion();
    fusion.setEnabled(true);
    fusion.ingestSensor(0.04, 0);
    fusion.ingestHand({ visible: true, centerY: 0.5, confidence: 1 }, 0);
    fusion.ingestHand({ visible: false, centerY: 0, confidence: 0 }, 600);
    fusion.ingestSensor(0.06, 650);
    expect(
      fusion.ingestHand({ visible: true, centerY: 0.1, confidence: 1 }, 700),
    ).toBeCloseTo(0.06);
  });
});
