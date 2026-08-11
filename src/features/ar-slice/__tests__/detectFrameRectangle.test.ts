import { describe, expect, it } from "vitest";
import { detectFrameRectangle } from "@/features/ar-slice/vision/detectFrameRectangle";
import { estimateFramePose } from "@/features/ar-slice/vision/estimateFramePose";
import type { NormalizedQuad } from "@/features/ar-slice/vision/types";

function makeImage(w: number, h: number, fill: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  // Vitest node env may lack ImageData
  return { data, width: w, height: h } as ImageData;
}

describe("detectFrameRectangle", () => {
  it("finds a dark hollow rectangular frame", () => {
    const image = makeImage(320, 240, (x, y) => {
      const inOuter = x > 40 && x < 280 && y > 30 && y < 210;
      const inInner = x > 70 && x < 250 && y > 55 && y < 185;
      if (inOuter && !inInner) return [20, 20, 20];
      return [210, 210, 210];
    });
    const quad = detectFrameRectangle(image);
    expect(quad).not.toBeNull();
    expect(quad!.corners).toHaveLength(4);
    expect(quad!.confidence).toBeGreaterThan(0.15);
    const xs = quad!.corners.map((c) => c.x);
    const ys = quad!.corners.map((c) => c.y);
    expect(Math.min(...xs)).toBeLessThan(0.35);
    expect(Math.max(...xs)).toBeGreaterThan(0.65);
    expect(Math.min(...ys)).toBeLessThan(0.35);
    expect(Math.max(...ys)).toBeGreaterThan(0.65);
  });

  it("returns null on flat bright image", () => {
    const image = makeImage(160, 120, () => [220, 220, 220]);
    expect(detectFrameRectangle(image)).toBeNull();
  });
});

describe("estimateFramePose", () => {
  it("places content in front of the camera with positive scale", () => {
    const quad: NormalizedQuad = {
      corners: [
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.2 },
        { x: 0.8, y: 0.75 },
        { x: 0.2, y: 0.75 },
      ],
      confidence: 0.8,
      source: "js",
    };
    const pose = estimateFramePose(quad);
    expect(pose.position.z).toBeLessThan(0);
    expect(pose.scale).toBeGreaterThan(0.2);
    expect(pose.quaternion.w).toBeGreaterThan(0);
  });

  it("derives hand distance from apparent palm size", () => {
    const hand = (halfWidth: number): NormalizedQuad => ({
      corners: [
        { x: 0.5 - halfWidth, y: 0.4 },
        { x: 0.5 + halfWidth, y: 0.4 },
        { x: 0.5 + halfWidth, y: 0.6 },
        { x: 0.5 - halfWidth, y: 0.6 },
      ],
      confidence: 0.9,
      source: "hand",
    });
    const near = estimateFramePose(hand(0.2), { aspect: 0.5 });
    const far = estimateFramePose(hand(0.1), { aspect: 0.5 });
    expect(Math.abs(near.position.z)).toBeLessThan(Math.abs(far.position.z));
    expect(near.scale).toBeCloseTo(far.scale);
  });
});
