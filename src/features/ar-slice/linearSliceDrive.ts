import type { Quaternion } from "@/features/ar-slice/ble/protocol";
import { quatRotateVector } from "@/features/ar-slice/poseMath";
import { ANATOMICAL_UP } from "@/features/ar-slice/slicePlaneMath";

/** Integrates linear acceleration into slice scroll when orientation is stable. */
export class LinearSliceDrive {
  private velocity = 0;
  private lastQ: Quaternion | null = null;
  private smoothedDepth = 0;

  reset() {
    this.velocity = 0;
    this.lastQ = null;
    this.smoothedDepth = 0;
  }

  /** Returns extra slice offset (m) from linear motion this frame. */
  tick(
    q: Quaternion,
    linAccelImu: { x: number; y: number; z: number } | null,
    dtSec: number,
    gain: number,
    maxSpeed: number,
    orientThresholdRad: number,
  ): number {
    if (!linAccelImu || dtSec <= 0 || dtSec > 0.25) {
      this.lastQ = q;
      return this.smoothedDepth;
    }

    let orientDelta = 0;
    if (this.lastQ) {
      const dot = Math.abs(
        q.w * this.lastQ.w + q.x * this.lastQ.x + q.y * this.lastQ.y + q.z * this.lastQ.z,
      );
      orientDelta = 2 * Math.acos(Math.min(1, Math.max(-1, dot)));
    }
    this.lastQ = q;

    if (orientDelta > orientThresholdRad) {
      this.velocity *= 0.5;
    } else {
      const accWorld = quatRotateVector(q, linAccelImu);
      const scrollAcc =
        accWorld.x * ANATOMICAL_UP.x +
        accWorld.y * ANATOMICAL_UP.y +
        accWorld.z * ANATOMICAL_UP.z;
      if (Math.abs(scrollAcc) > 0.08) {
        this.velocity += scrollAcc * dtSec * gain;
      }
    }

    this.velocity = Math.max(-maxSpeed, Math.min(maxSpeed, this.velocity));
    this.velocity *= 0.88;

    this.smoothedDepth += this.velocity * dtSec;
    this.smoothedDepth *= 0.998;
    return this.smoothedDepth;
  }
}

export const linearSliceDrive = new LinearSliceDrive();
