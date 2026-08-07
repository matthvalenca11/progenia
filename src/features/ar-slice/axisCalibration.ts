import type { Quaternion } from "@/features/ar-slice/ble/protocol";
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
} from "@/features/ar-slice/poseMath";

export type AxisCalStep = 0 | 1 | 2 | 3;

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

export function flatZeroFromImu(qImuFlat: Quaternion, qMount: Quaternion): Quaternion {
  return quatNormalize(applyMountAndZero(qImuFlat, qMount, null));
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
