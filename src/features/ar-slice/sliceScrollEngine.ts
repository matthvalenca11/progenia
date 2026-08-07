import type { Quaternion } from "@/features/ar-slice/ble/protocol";
import type { Vec3 } from "@/features/ar-slice/poseMath";
import {
  applyMountAndZero,
  gravityInFrame,
  quatConjugate,
  quatRotateVector,
  quatSwingTwist,
  slicePitchFromGravityVector,
  suggestMountPresetFromFlatGravity,
  type MountPresetId,
} from "@/features/ar-slice/poseMath";

function norm(v: Vec3) {
  return Math.hypot(v.x, v.y, v.z);
}

function normalize(v: Vec3): Vec3 {
  const n = norm(v);
  if (n < 1e-8) return { x: 0, y: -1, z: 0 };
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}

function wrapAngle(a: number) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

const FRAME_VIEW: Vec3 = { x: 0, y: 0, z: 1 };

export function frameViewAxis(qDisplay: Quaternion): Vec3 {
  return normalize(quatRotateVector(qDisplay, FRAME_VIEW));
}

export type SliceScrollTuning = {
  gain: number;
  deadzoneRad: number;
  smoothing: number;
  /** Slow bias correction when frame is held still (rad/s equivalent). */
  stationaryBlend: number;
  stationaryGyroRadS: number;
};

const DEFAULT_TUNING: SliceScrollTuning = {
  gain: 1.35,
  deadzoneRad: 0.012,
  smoothing: 0.32,
  stationaryBlend: 0.004,
  stationaryGyroRadS: 0.09,
};

/**
 * BNO085 gravity-driven slice scroll with auto-calibration at ZERO.
 * Uses twist-free YZ pitch — stable under in-plane spin, driven by SH2_GRAVITY.
 */
export class SliceScrollEngine {
  /** Pitch reference (rad) in twist-free frame, captured at ZERO. */
  private pitchRef = 0;
  private smoothedDepth = 0;
  private signGain = 1;
  private stableSince = -1;
  private autoMountDone = false;
  private tuning = DEFAULT_TUNING;

  reset() {
    this.pitchRef = 0;
    this.smoothedDepth = 0;
    this.signGain = 1;
    this.stableSince = -1;
    this.autoMountDone = false;
  }

  setTuning(t: Partial<SliceScrollTuning>) {
    this.tuning = { ...this.tuning, ...t };
  }

  /** Call on ZERO — stores twist-free pitch at neutral pose (spin-invariant). */
  captureZero(gravityCal: Vec3, qDisplay: Quaternion, useSensorGravity: boolean) {
    const g = gravityForSliceScroll(gravityCal, qDisplay, useSensorGravity);
    this.pitchRef = slicePitchFromGravityVector(g);
    this.smoothedDepth = 0;
    this.stableSince = performance.now();
  }

  setSignGain(sign: number) {
    this.signGain = sign >= 0 ? 1 : -1;
  }

  tryAutoMountPreset(
    qImu: Quaternion,
    gyroRadS: number,
    stableMs: number,
  ): MountPresetId | null {
    if (this.autoMountDone || stableMs < 800 || gyroRadS > this.tuning.stationaryGyroRadS) {
      return null;
    }
    const { preset, score } = suggestMountPresetFromFlatGravity(qImu);
    if (score < 0.45) return null;
    this.autoMountDone = true;
    return preset;
  }

  markAutoMountDone() {
    this.autoMountDone = true;
  }

  depthFromGravity(
    gravityCal: Vec3,
    qDisplay: Quaternion,
    gyroRadS: number,
    useSensorGravity: boolean,
    now = performance.now(),
  ): number {
    const g = gravityForSliceScroll(gravityCal, qDisplay, useSensorGravity);
    let tilt = wrapAngle(slicePitchFromGravityVector(g) - this.pitchRef);

    if (Math.abs(tilt) < this.tuning.deadzoneRad) tilt = 0;

    if (gyroRadS < this.tuning.stationaryGyroRadS) {
      if (this.stableSince < 0) this.stableSince = now;
      if (now - this.stableSince > 400 && Math.abs(tilt) < 0.04) {
        const blend = this.tuning.stationaryBlend;
        this.pitchRef += blend * tilt;
        tilt *= 1 - blend;
      }
    } else {
      this.stableSince = -1;
    }

    return this.signGain * this.tuning.gain * tilt;
  }

  tick(
    gravityCal: Vec3,
    qDisplay: Quaternion,
    gyroRadS: number,
    useSensorGravity: boolean,
    now = performance.now(),
  ): number {
    const target = this.depthFromGravity(
      gravityCal,
      qDisplay,
      gyroRadS,
      useSensorGravity,
      now,
    );
    this.smoothedDepth += (target - this.smoothedDepth) * this.tuning.smoothing;
    return this.smoothedDepth;
  }

  getSmoothedDepth() {
    return this.smoothedDepth;
  }
}

export const sliceScrollEngine = new SliceScrollEngine();

export function gyroMagnitudeRadS(gyro?: Vec3 | null): number {
  if (!gyro) return 999;
  return norm(gyro);
}

/** Prefer BNO085 SH2_GRAVITY over quat-derived gravity for slice scroll. */
export function resolveGravityCalibrated(
  qImu: Quaternion,
  qMount: Quaternion,
  qZero: Quaternion | null,
  gravityImu?: Vec3,
): Vec3 {
  const qRel = applyMountAndZero(qImu, qMount, qZero);
  if (!gravityImu) return gravityInFrame(qRel);

  const gWorld = quatRotateVector(qImu, normalize(gravityImu));
  return normalize(quatRotateVector(quatConjugate(qRel), gWorld));
}

/** Gravity vector for slice pitch — BNO085 path removes twist; quat path uses swing only. */
export function gravityForSliceScroll(
  gravityCal: Vec3,
  qDisplay: Quaternion,
  useSensorGravity: boolean,
): Vec3 {
  const view = frameViewAxis(qDisplay);
  const { swing, twist } = quatSwingTwist(qDisplay, view);
  if (useSensorGravity) {
    return normalize(quatRotateVector(quatConjugate(twist), gravityCal));
  }
  return gravityInFrame(swing);
}

/** @deprecated use gravityForSliceScroll */
export function twistFreeGravity(gCal: Vec3, qDisplay: Quaternion): Vec3 {
  return gravityForSliceScroll(gCal, qDisplay, true);
}
