import type { Quaternion } from "@/features/ar-slice/ble/protocol";
import {
  IDENTITY_QUAT,
  quatConjugate,
  quatMultiply,
  quatNormalize,
} from "@/features/ar-slice/poseMath";

function axisAngleQuat(ax: number, ay: number, az: number, angle: number): Quaternion {
  const half = angle * 0.5;
  const s = Math.sin(half);
  return quatNormalize({
    w: Math.cos(half),
    x: ax * s,
    y: ay * s,
    z: az * s,
  });
}

/**
 * Finger drag → free trackball yaw/pitch (no Euler clamps).
 *
 * Live (unfrozen): retunes anatomy under the IMU cut.
 * Frozen: same offset is applied to the cut (aro + brain orbit together);
 * clearing on unfreeze restores the live IMU cut.
 */
class TouchReferenceOffset {
  private quat: Quaternion = { ...IDENTITY_QUAT };
  private frozenBaseQuat: Quaternion = { ...IDENTITY_QUAT };

  reset() {
    this.quat = { ...IDENTITY_QUAT };
  }

  getQuat(): Quaternion {
    return this.quat;
  }

  setQuat(quat: Quaternion) {
    this.quat = quatNormalize(quat);
  }

  beginFreeze() {
    this.frozenBaseQuat = { ...this.quat };
  }

  endFreeze() {
    this.frozenBaseQuat = { ...IDENTITY_QUAT };
  }

  getFrozenBaseQuat(): Quaternion {
    return this.frozenBaseQuat;
  }

  /** World/view-space finger rotation accumulated since Freeze was tapped. */
  getFrozenDeltaQuat(): Quaternion {
    return quatNormalize(quatMultiply(this.quat, quatConjugate(this.frozenBaseQuat)));
  }

  /** Pixel deltas from a one-finger drag on the lab canvas. */
  applyFingerDelta(dxPx: number, dyPx: number, viewW: number, viewH: number) {
    const w = Math.max(1, viewW);
    const h = Math.max(1, viewH);
    // Full-width swipe ≈ 180° — continuous; keep dragging to spin further.
    const yaw = (dxPx / w) * Math.PI;
    // Match natural drag: finger down → brain pitches the same way on screen.
    const pitch = (dyPx / h) * Math.PI;

    if (Math.abs(yaw) > 1e-8) {
      // World-up yaw applied in view space (pre-multiply).
      this.quat = quatNormalize(quatMultiply(axisAngleQuat(0, 1, 0, yaw), this.quat));
    }
    if (Math.abs(pitch) > 1e-8) {
      this.quat = quatNormalize(quatMultiply(axisAngleQuat(1, 0, 0, pitch), this.quat));
    }
  }
}

export const touchReference = new TouchReferenceOffset();
