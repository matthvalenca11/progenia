import type { Quaternion } from "@/features/ar-slice/ble/protocol";
import { rotationAngleRad } from "@/features/ar-slice/axisCalibration";
import type { FramePose } from "@/features/ar-slice/vision/types";

type Axis = "vertical" | "normal";

export class CameraTranslationDrive {
  private baseline: FramePose["position"] | null = null;
  private startQ: Quaternion | null = null;
  private axis: Axis | null = null;
  private committedDepth = 0;
  private depth = 0;
  private lastAxisValue = 0;
  private stableSince = -1;
  private lastGestureAt = 0;

  reset() {
    this.baseline = null;
    this.startQ = null;
    this.axis = null;
    this.committedDepth = 0;
    this.depth = 0;
    this.lastAxisValue = 0;
    this.stableSince = -1;
    this.lastGestureAt = 0;
  }

  rebase() {
    this.committedDepth = this.depth;
    this.baseline = null;
    this.startQ = null;
    this.axis = null;
    this.lastAxisValue = 0;
    this.stableSince = -1;
  }

  ingest(pose: FramePose, q: Quaternion, now = performance.now()) {
    if (!this.baseline) {
      this.baseline = { ...pose.position };
      this.startQ = { ...q };
      return false;
    }

    if (this.startQ && rotationAngleRad(this.startQ, q) > 0.16) {
      this.committedDepth = this.depth;
      this.baseline = { ...pose.position };
      this.startQ = { ...q };
      this.axis = null;
      this.stableSince = -1;
      return false;
    }

    const vertical = pose.position.y - this.baseline.y;
    const normal = pose.position.z - this.baseline.z;
    if (!this.axis) {
      if (Math.max(Math.abs(vertical), Math.abs(normal)) < 0.008) return false;
      this.axis = Math.abs(normal) > Math.abs(vertical) ? "normal" : "vertical";
      this.lastAxisValue = this.axis === "normal" ? normal : vertical;
      this.stableSince = now;
      this.startQ = { ...q };
      this.depth = this.committedDepth + this.lastAxisValue;
      this.lastGestureAt = now;
      return true;
    }

    const value = this.axis === "normal" ? normal : vertical;
    if (Math.abs(value) < 0.004) {
      const changed = Math.abs(this.depth - this.committedDepth) > 0.0005;
      this.depth = this.committedDepth;
      this.baseline = { ...pose.position };
      this.axis = null;
      this.stableSince = -1;
      return changed;
    }
    if (Math.abs(value) > 0.35) {
      this.baseline = { ...pose.position };
      this.committedDepth = this.depth;
      this.axis = null;
      this.stableSince = -1;
      return false;
    }

    if (Math.abs(value - this.lastAxisValue) <= 0.0025) {
      if (this.stableSince < 0) this.stableSince = now;
    } else {
      this.stableSince = now;
    }
    this.lastAxisValue = value;
    const nextDepth = this.committedDepth + value;
    const changed = Math.abs(nextDepth - this.depth) > 0.0005;
    this.depth = nextDepth;
    if (changed) this.lastGestureAt = now;

    if (now - this.stableSince >= 300) {
      this.committedDepth = this.depth;
      this.baseline = { ...pose.position };
      this.startQ = { ...q };
      this.axis = null;
      this.stableSince = -1;
    }
    return changed;
  }

  getDepth() {
    return this.depth;
  }

  getLastGestureAt() {
    return this.lastGestureAt;
  }
}

export const cameraTranslationDrive = new CameraTranslationDrive();
