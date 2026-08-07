import { describe, expect, it } from "vitest";
import {
  buildSlicePlanes,
  projectPointOntoPlane,
} from "@/features/ar-slice/slicePlaneMath";

describe("slicePlaneMath", () => {
  it("builds cut and negated clip on the same geometric plane", () => {
    const n = { x: 0.2, y: 0.3, z: 0.9 };
    const len = Math.hypot(n.x, n.y, n.z);
    n.x /= len;
    n.y /= len;
    n.z /= len;
    const { cut, clip } = buildSlicePlanes(n, { x: 0, y: 0, z: 0 }, 0);
    expect(clip.normal.x).toBeCloseTo(-cut.normal.x);
    expect(clip.normal.y).toBeCloseTo(-cut.normal.y);
    expect(clip.normal.z).toBeCloseTo(-cut.normal.z);
    expect(clip.constant).toBeCloseTo(-cut.constant);
  });

  it("moves the cut anchor along world Y (SI) when slice level changes", () => {
    const n = { x: 0.3, y: 0.4, z: 0.86 };
    const len = Math.hypot(n.x, n.y, n.z);
    n.x /= len;
    n.y /= len;
    n.z /= len;
    const p0 = buildSlicePlanes(n, { x: 0, y: 0, z: 0 }, 0);
    const p1 = buildSlicePlanes(n, { x: 0, y: 0, z: 0 }, 0.25);
    expect(p1.anchor.y).toBeCloseTo(0.25);
    expect(p1.cut.constant).not.toBeCloseTo(p0.cut.constant);
  });

  it("projects brain center onto oblique cut plane for cap alignment", () => {
    const n = { x: 0.6, y: 0, z: 0.8 };
    const len = Math.hypot(n.x, n.z);
    n.x /= len;
    n.z /= len;
    const { cut } = buildSlicePlanes(n, { x: 0, y: 0, z: 0 }, 0);
    const out = projectPointOntoPlane({ x: 0, y: 0, z: 0 }, cut.normal, cut.constant, {
      x: 0,
      y: 0,
      z: 0,
    });
    expect(out.x).toBeCloseTo(0, 4);
    expect(out.y).toBeCloseTo(0, 4);
    expect(out.z).toBeCloseTo(0, 4);
  });
});
