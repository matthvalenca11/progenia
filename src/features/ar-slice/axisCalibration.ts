import type {
  ImuCalibrationMetadata,
  Quaternion,
} from "@/features/ar-slice/ble/protocol";
import type { Vec3 } from "@/features/ar-slice/poseMath";
import { AR_SLICE_AXIS_CAL } from "@/features/ar-slice/arSliceSceneConfig";
import {
  MOUNT_PRESET_LABELS,
  type MountPresetId,
  applyMountAndZero,
  quatConjugate,
  quatMultiply,
  quatNormalize,
  suggestMountPreset,
  suggestMountPresetFromFlatGravity,
  zeroReferenceFromImu,
} from "@/features/ar-slice/poseMath";

export type AxisCalStep = 0 | 1 | 2 | 3 | 4;

export type CalibrationPose = {
  quaternion: Quaternion;
  gravity: Vec3;
  angularSpeedRadS: number;
  gravitySpreadDeg: number;
};

export type AxisCalStatus = "idle" | "moving" | "waiting" | "ready" | "error";

/** O que cada passo calibra — mostrado no popup. */
export const AXIS_CAL_STEP_GOALS: Record<1 | 2, string> = {
  1: "Gravidade na posição plana → define a altura zero da fatia (acelerômetro).",
  2: "Gravidade inclinada 90° → alinha o sensor com a moldura física (acelerômetro).",
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function normalize(v: Vec3): Vec3 {
  const n = Math.hypot(v.x, v.y, v.z);
  if (n < 1e-8) return { x: 0, y: -1, z: 0 };
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}

/** Angle between two gravity/accel vectors (degrees). Primary metric for accel calibration. */
export function gravityAngleDeg(gA: Vec3, gB: Vec3): number {
  const a = normalize(gA);
  const b = normalize(gB);
  return (Math.acos(clamp(a.x * b.x + a.y * b.y + a.z * b.z, -1, 1)) * 180) / Math.PI;
}

export function isGravityTiltNearDegrees(
  gFlat: Vec3,
  gNow: Vec3,
  targetDeg = AR_SLICE_AXIS_CAL.targetRotationDeg,
  toleranceDeg = AR_SLICE_AXIS_CAL.rotationToleranceDeg,
): boolean {
  return Math.abs(gravityAngleDeg(gFlat, gNow) - targetDeg) <= toleranceDeg;
}

/** Frame is roughly flat when one gravity axis dominates (|component| ≥ 0.82). */
export function isGravityFlatEnough(g: Vec3, minAxis = 0.82): boolean {
  const n = normalize(g);
  return Math.max(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)) >= minAxis;
}

export function formatGravityTiltHint(
  gRef: Vec3,
  gNow: Vec3,
  targetDeg = AR_SLICE_AXIS_CAL.targetRotationDeg,
): string {
  const current = gravityAngleDeg(gRef, gNow);
  const delta = targetDeg - current;
  if (Math.abs(delta) <= AR_SLICE_AXIS_CAL.rotationToleranceDeg) {
    return `Gravidade OK (${current.toFixed(0)}° de inclinação). Pode confirmar.`;
  }
  if (delta > 0) {
    return `Inclinação ${current.toFixed(0)}° — falta ~${delta.toFixed(0)}° (meta ${targetDeg}°).`;
  }
  return `Inclinação ${current.toFixed(0)}° — passou ~${Math.abs(delta).toFixed(0)}° do ideal.`;
}

export function formatFlatGravityHint(g: Vec3): string | null {
  if (isGravityFlatEnough(g)) return null;
  return "A moldura não parece plana no acelerômetro — deite-a bem reta na mesa.";
}

export function rotationAngleRad(qFrom: Quaternion, qTo: Quaternion): number {
  const dq = quatMultiply(quatConjugate(quatNormalize(qFrom)), quatNormalize(qTo));
  const w = Math.min(1, Math.max(-1, Math.abs(dq.w)));
  return 2 * Math.acos(w);
}

export function rotationAngleDeg(qFrom: Quaternion, qTo: Quaternion): number {
  return (rotationAngleRad(qFrom, qTo) * 180) / Math.PI;
}

export function isRotationNearDegrees(
  qFrom: Quaternion,
  qTo: Quaternion,
  targetDeg = AR_SLICE_AXIS_CAL.targetRotationDeg,
  toleranceDeg = AR_SLICE_AXIS_CAL.rotationToleranceDeg,
): boolean {
  const delta = Math.abs(rotationAngleDeg(qFrom, qTo) - targetDeg);
  return delta <= toleranceDeg;
}

/** Unit axis of rotation from qFrom → qTo (IMU frame). */
export function rotationAxis(qFrom: Quaternion, qTo: Quaternion): { x: number; y: number; z: number } {
  const dq = quatNormalize(quatMultiply(quatConjugate(quatNormalize(qFrom)), quatNormalize(qTo)));
  const sinHalf = Math.hypot(dq.x, dq.y, dq.z);
  if (sinHalf < 1e-6) return { x: 0, y: 0, z: 1 };
  return { x: dq.x / sinHalf, y: dq.y / sinHalf, z: dq.z / sinHalf };
}

function axisDot(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  return Math.abs(a.x * b.x + a.y * b.y + a.z * b.z);
}

/** True when the two rotations happened about roughly perpendicular axes. */
export function areRotationAxesDistinct(
  qA: Quaternion,
  qB: Quaternion,
  qC: Quaternion,
  maxAxisDot = 0.35,
): boolean {
  const axis1 = rotationAxis(qA, qB);
  const axis2 = rotationAxis(qB, qC);
  return axisDot(axis1, axis2) < maxAxisDot;
}

export class StationaryGate {
  private stableSince = -1;

  reset() {
    this.stableSince = -1;
  }

  tick(
    gyroRadS: number,
    now = performance.now(),
    holdMs = AR_SLICE_AXIS_CAL.stationaryHoldMs,
    threshold = AR_SLICE_AXIS_CAL.stationaryGyroRadS,
  ): { status: AxisCalStatus; progress: number } {
    if (gyroRadS > threshold) {
      this.stableSince = -1;
      return { status: "moving", progress: 0 };
    }
    if (this.stableSince < 0) this.stableSince = now;
    const elapsed = now - this.stableSince;
    const progress = Math.min(1, elapsed / holdMs);
    if (elapsed >= holdMs) return { status: "ready", progress: 1 };
    return { status: "waiting", progress };
  }
}

export class CalibrationSampleWindow {
  private samples: Array<{ q: Quaternion; g: Vec3; at: number }> = [];

  reset() {
    this.samples = [];
  }

  push(q: Quaternion, g: Vec3, at = performance.now()) {
    this.samples.push({ q: quatNormalize(q), g: normalize(g), at });
    const cutoff = at - 2800;
    while (this.samples.length > 100 || (this.samples[0]?.at ?? at) < cutoff) {
      this.samples.shift();
    }
  }

  pose(holdMs = 850): CalibrationPose | null {
    if (this.samples.length < 12) return null;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    if (last.at - first.at < holdMs) return null;

    const gravitySeed = normalize(
      this.samples.reduce(
        (sum, sample) => ({
          x: sum.x + sample.g.x,
          y: sum.y + sample.g.y,
          z: sum.z + sample.g.z,
        }),
        { x: 0, y: 0, z: 0 },
      ),
    );
    const inliers = this.samples.filter(
      (sample) => gravityAngleDeg(sample.g, gravitySeed) <= 3,
    );
    if (inliers.length < this.samples.length * 0.8) return null;

    const gravity = normalize(
      inliers.reduce(
        (sum, sample) => ({
          x: sum.x + sample.g.x,
          y: sum.y + sample.g.y,
          z: sum.z + sample.g.z,
        }),
        { x: 0, y: 0, z: 0 },
      ),
    );
    const qRef = inliers[0].q;
    const quaternion = quatNormalize(
      inliers.reduce(
        (sum, sample) => {
          const sign =
            qRef.w * sample.q.w +
              qRef.x * sample.q.x +
              qRef.y * sample.q.y +
              qRef.z * sample.q.z >=
            0
              ? 1
              : -1;
          return {
            w: sum.w + sample.q.w * sign,
            x: sum.x + sample.q.x * sign,
            y: sum.y + sample.q.y * sign,
            z: sum.z + sample.q.z * sign,
          };
        },
        { w: 0, x: 0, y: 0, z: 0 },
      ),
    );
    const gravitySpreadDeg = Math.max(
      ...inliers.map((sample) => gravityAngleDeg(sample.g, gravity)),
    );
    const angularSpeedRadS =
      rotationAngleRad(first.q, last.q) / Math.max(0.001, (last.at - first.at) / 1000);
    if (gravitySpreadDeg > 1.5 || angularSpeedRadS > 0.06) return null;
    return { quaternion, gravity, angularSpeedRadS, gravitySpreadDeg };
  }
}

export function gravityFace(g: Vec3, dominance = 0.82): number | null {
  const n = normalize(g);
  const components = [n.x, n.y, n.z];
  let axis = 0;
  if (Math.abs(components[1]) > Math.abs(components[axis])) axis = 1;
  if (Math.abs(components[2]) > Math.abs(components[axis])) axis = 2;
  if (Math.abs(components[axis]) < dominance) return null;
  return axis * 2 + (components[axis] >= 0 ? 1 : 0);
}

export class GravityFaceTracker {
  private faces = new Set<number>();

  add(g: Vec3) {
    const face = gravityFace(g);
    if (face != null) this.faces.add(face);
    return this.faces.size;
  }

  get count() {
    return this.faces.size;
  }

  reset() {
    this.faces.clear();
  }
}

export function isCalibrationCoverageComplete(
  faces: number,
  calibration?: ImuCalibrationMetadata | null,
): boolean {
  if (!calibration) return faces >= 4;
  if (calibration.calibrationReady) return true;
  // Firmware without accuracy metadata reports 0/0 — finish by face coverage.
  if (calibration.accelAccuracy === 0 && calibration.gyroAccuracy === 0) {
    return faces >= 4;
  }
  return (
    faces >= 3 &&
    calibration.accelAccuracy === 3 &&
    calibration.gyroAccuracy === 3
  );
}

export function resolveMountFromSamples(
  qFlat: Quaternion,
  qPitch: Quaternion,
): { preset: MountPresetId; label: string } {
  const grav = suggestMountPresetFromFlatGravity(qFlat);
  const orient = suggestMountPreset(qFlat, qPitch);
  const preset: MountPresetId =
    orient.preset === grav.preset
      ? grav.preset
      : grav.score >= orient.score * 0.85
        ? grav.preset
        : orient.preset;
  return { preset, label: MOUNT_PRESET_LABELS[preset] };
}

/**
 * Zero reference for orientation. Pass gravity so Z-up at Zerar maps to a
 * horizontal aro (not face-on identity).
 */
export function flatZeroFromImu(
  qImuFlat: Quaternion,
  qMount: Quaternion,
  gImu?: Vec3 | null,
): Quaternion {
  return zeroReferenceFromImu(qImuFlat, qMount, gImu);
}

export function formatRotationHint(
  qFrom: Quaternion,
  qTo: Quaternion,
  targetDeg = AR_SLICE_AXIS_CAL.targetRotationDeg,
): string {
  const current = rotationAngleDeg(qFrom, qTo);
  const delta = targetDeg - current;
  if (Math.abs(delta) <= AR_SLICE_AXIS_CAL.rotationToleranceDeg) {
    return `Rotação OK (${current.toFixed(0)}°). Mantenha parado…`;
  }
  if (delta > 0) {
    return `Rotação ${current.toFixed(0)}° — falta ~${delta.toFixed(0)}° para ${targetDeg}°.`;
  }
  return `Rotação ${current.toFixed(0)}° — passe de ${targetDeg}° em ~${Math.abs(delta).toFixed(0)}°.`;
}
