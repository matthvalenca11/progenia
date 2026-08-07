import type { Quaternion } from "@/features/ar-slice/ble/protocol";

export type Vec3 = { x: number; y: number; z: number };

export const IDENTITY_QUAT: Quaternion = { w: 1, x: 0, y: 0, z: 0 };

/** Mount presets: q_frame = q_imu ⊗ q_mount */
export const MOUNT_PRESETS = {
  identity: IDENTITY_QUAT,
  /** IMU rotated 90° about X relative to frame */
  imu_x90: { w: Math.SQRT1_2, x: Math.SQRT1_2, y: 0, z: 0 },
  /** IMU rotated −90° about X */
  imu_xneg90: { w: Math.SQRT1_2, x: -Math.SQRT1_2, y: 0, z: 0 },
  /** IMU rotated 90° about Y relative to frame */
  imu_y90: { w: Math.SQRT1_2, x: 0, y: Math.SQRT1_2, z: 0 },
  /** IMU rotated −90° about Y */
  imu_yneg90: { w: Math.SQRT1_2, x: 0, y: -Math.SQRT1_2, z: 0 },
  /** IMU rotated 90° about Z */
  imu_z90: { w: Math.SQRT1_2, x: 0, y: 0, z: Math.SQRT1_2 },
  /** IMU rotated 180° about Z */
  imu_z180: { w: 0, x: 0, y: 0, z: 1 },
} as const;

export type MountPresetId = keyof typeof MOUNT_PRESETS;

export const MOUNT_PRESET_LABELS: Record<MountPresetId, string> = {
  identity: "Identidade (PCB alinhada)",
  imu_x90: "IMU +90° em X",
  imu_xneg90: "IMU −90° em X",
  imu_y90: "IMU +90° em Y",
  imu_yneg90: "IMU −90° em Y",
  imu_z90: "IMU +90° em Z",
  imu_z180: "IMU 180° em Z",
};

function vecDot(a: Vec3, b: Vec3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function vecNormalize(v: Vec3): Vec3 {
  const n = Math.hypot(v.x, v.y, v.z);
  if (n < 1e-8) return { x: 0, y: 0, z: 1 };
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}

/**
 * After ZERO (flat / parallel to screen), user tilts the frame ~45–90° about its
 * physical horizontal (right edge down = pitch). We pick the mount preset that
 * maps that tilt closest to world +X rotation of the front normal.
 */
export function suggestMountPreset(
  qImuFlat: Quaternion,
  qImuTilted: Quaternion,
): { preset: MountPresetId; score: number } {
  const expected = { x: 1, y: 0, z: 0 }; // front normal should move toward +X when pitching
  let best: MountPresetId = "identity";
  let bestScore = -Infinity;

  for (const id of Object.keys(MOUNT_PRESETS) as MountPresetId[]) {
    const mount = MOUNT_PRESETS[id];
    const flat = applyMountAndZero(qImuFlat, mount, null);
    const tilted = applyMountAndZero(qImuTilted, mount, flat);
    const n = frameFrontNormal(tilted);
    // Prefer normals that left +Z and gained +X (pitch about physical X)
    const score = vecDot(vecNormalize(n), expected) * 2 + (1 - Math.abs(n.z)) + Math.max(0, -n.y) * 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }

  return { preset: best, score: bestScore };
}

export function quatNormalize(q: Quaternion): Quaternion {
  const n = Math.hypot(q.w, q.x, q.y, q.z);
  if (n < 1e-8) return { ...IDENTITY_QUAT };
  return { w: q.w / n, x: q.x / n, y: q.y / n, z: q.z / n };
}

export function quatConjugate(q: Quaternion): Quaternion {
  return { w: q.w, x: -q.x, y: -q.y, z: -q.z };
}

export function quatMultiply(a: Quaternion, b: Quaternion): Quaternion {
  return quatNormalize({
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  });
}

/** Shortest-path SLERP with hemisphere correction. */
export function quatSlerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
  let ax = a.x;
  let ay = a.y;
  let az = a.z;
  let aw = a.w;
  let bx = b.x;
  let by = b.y;
  let bz = b.z;
  let bw = b.w;

  let cos = aw * bw + ax * bx + ay * by + az * bz;
  if (cos < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
    cos = -cos;
  }

  if (cos > 0.9995) {
    return quatNormalize({
      w: aw + (bw - aw) * t,
      x: ax + (bx - ax) * t,
      y: ay + (by - ay) * t,
      z: az + (bz - az) * t,
    });
  }

  const theta = Math.acos(Math.min(1, Math.max(-1, cos)));
  const sin = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sin;
  const wb = Math.sin(t * theta) / sin;
  return {
    w: aw * wa + bw * wb,
    x: ax * wa + bx * wb,
    y: ay * wa + by * wb,
    z: az * wa + bz * wb,
  };
}

/**
 * Calibration chain:
 *   R_frame = R_imu · R_mount
 *   R_relative = R_zero⁻¹ · R_frame
 */
export function applyMountAndZero(
  qImu: Quaternion,
  qMount: Quaternion,
  qZero: Quaternion | null,
): Quaternion {
  const qFrame = quatMultiply(qImu, qMount);
  if (!qZero) return qFrame;
  return quatMultiply(quatConjugate(qZero), qFrame);
}

/**
 * Rotate a local axis by quaternion (vector part of q * v * q*).
 * Frame convention: +Z is the frame "front" (normal of the cutting plane).
 */
export function quatRotateVector(q: Quaternion, v: Vec3): Vec3 {
  const qv: Quaternion = { w: 0, x: v.x, y: v.y, z: v.z };
  const r = quatMultiply(quatMultiply(q, qv), quatConjugate(q));
  return { x: r.x, y: r.y, z: r.z };
}

const FRONT_LOCAL: Vec3 = { x: 0, y: 0, z: 1 };

/** Front axis of the physical frame after calibration, in Three.js Y-up space. */
export function frameFrontNormal(qRelative: Quaternion, out?: Vec3): Vec3 {
  // Sensor +Z → Three.js +Z (facing camera by default after zero)
  const v = quatRotateVector(qRelative, FRONT_LOCAL);
  if (out) {
    out.x = v.x;
    out.y = v.y;
    out.z = v.z;
    return out;
  }
  return v;
}

/**
 * Map relative quaternion into Three.js object quaternion.
 * Identity leaves the model facing the camera (+Z toward viewer → -Z in three default camera looking at origin from +Z).
 */
export function toThreeQuaternion(q: Quaternion): Quaternion {
  return quatNormalize(q);
}

export function planeConstantFromOffset(normal: Vec3, offset: number): number {
  // THREE.Plane: normal·x + constant = 0  →  constant = -offset along normal
  return -offset;
}

const WORLD_DOWN: Vec3 = { x: 0, y: -1, z: 0 };

/** Gravity direction expressed in the calibrated frame (Three.js Y-up world). */
export function gravityInFrame(qRelative: Quaternion): Vec3 {
  return quatRotateVector(quatConjugate(qRelative), WORLD_DOWN);
}

/** Extract twist about `axis` (unit); swing is the remaining tilt. */
export function quatSwingTwist(
  q: Quaternion,
  axis: Vec3,
): { swing: Quaternion; twist: Quaternion } {
  const n = vecNormalize(axis);
  const proj = n.x * q.x + n.y * q.y + n.z * q.z;
  const twist = quatNormalize({ w: q.w, x: n.x * proj, y: n.y * proj, z: n.z * proj });
  const swing = quatMultiply(q, quatConjugate(twist));
  return { swing, twist };
}

const FRAME_VIEW_AXIS: Vec3 = { x: 0, y: 0, z: 1 };

/**
 * Pitch from gravity in the calibrated frame (YZ plane after removing in-plane spin).
 * Invariant to spinning the frame around its view axis (local +Z).
 */
export function slicePitchFromGravityVector(g: Vec3): number {
  const len = Math.hypot(g.y, g.z);
  if (len < 1e-5) return 0;
  return Math.atan2(-g.z, -g.y);
}

/** Gravity-based pitch with twist removed — stable for slice height. */
export function slicePitchFromGravityInFrame(qRelative: Quaternion): number {
  const { swing } = quatSwingTwist(qRelative, FRAME_VIEW_AXIS);
  return slicePitchFromGravityVector(gravityInFrame(swing));
}

/**
 * Forward/back tilt of the frame top edge (world space).
 * Prefer slicePitchFromGravityInFrame for slice height — more stable under in-plane spin.
 */
export function slicePitchFromFrameUp(qRelative: Quaternion): number {
  const up = quatRotateVector(qRelative, { x: 0, y: 1, z: 0 });
  return Math.atan2(up.z, up.y);
}

/** @deprecated alias — use slicePitchFromGravityInFrame */
export function slicePitchFromGravity(qRelative: Quaternion): number {
  return slicePitchFromGravityInFrame(qRelative);
}

/**
 * Map BNO085 gravity (IMU frame) into the calibrated frame using the same mount/zero chain.
 */
export function gravityInCalibratedFrame(
  qImu: Quaternion,
  qMount: Quaternion,
  qZero: Quaternion | null,
  gImu?: Vec3,
): Vec3 {
  const qRel = applyMountAndZero(qImu, qMount, qZero);
  if (!gImu) return gravityInFrame(qRel);

  const gWorld = quatRotateVector(qImu, vecNormalize(gImu));
  return vecNormalize(quatRotateVector(quatConjugate(qRel), gWorld));
}

/** Pick mount preset where flat gravity aligns with frame −Y (accelerometer calibration). */
export function suggestMountPresetFromFlatGravity(qImuFlat: Quaternion): {
  preset: MountPresetId;
  score: number;
} {
  let best: MountPresetId = "identity";
  let bestErr = Infinity;

  for (const id of Object.keys(MOUNT_PRESETS) as MountPresetId[]) {
    const g = gravityInFrame(applyMountAndZero(qImuFlat, MOUNT_PRESETS[id], null));
    const err = Math.hypot(g.x, g.y + 1, g.z);
    if (err < bestErr) {
      bestErr = err;
      best = id;
    }
  }

  return { preset: best, score: 1 / (1 + bestErr) };
}

let zeroSlicePitch = 0;
let smoothedSliceDepth = 0;

function wrapAngle(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/** Call when the user zeros the frame — pitch reference for slice height. */
export function captureSlicePitchZero(gOrQ: Vec3 | Quaternion) {
  zeroSlicePitch =
    "w" in gOrQ ? slicePitchFromGravityInFrame(gOrQ) : slicePitchFromGravityVector(gOrQ);
  smoothedSliceDepth = 0;
}

export function resetSlicePitchZero() {
  zeroSlicePitch = 0;
  smoothedSliceDepth = 0;
}

export function resetSmoothedSliceDepth() {
  smoothedSliceDepth = 0;
}

/**
 * Map frame pitch to anatomical slice height (world Y anchor).
 * Uses gravity in the calibrated frame — stable under in-plane spin.
 */
export function autoSliceDepthFromGravityVector(
  g: Vec3,
  gain: number,
  deadzoneRad: number,
): number {
  const delta = wrapAngle(slicePitchFromGravityVector(g) - zeroSlicePitch);
  if (Math.abs(delta) < deadzoneRad) return 0;
  return gain * delta;
}

/**
 * Slice depth from pose — optional BNO085 gravity (IMU frame) overrides quat fusion for pitch.
 */
export function autoSliceDepthFromPose(
  q: Quaternion,
  gCalibrated: Vec3 | null,
  gain = 0.75,
  deadzoneRad = 0,
): number {
  const { swing, twist } = quatSwingTwist(q, FRAME_VIEW_AXIS);
  const g =
    gCalibrated != null
      ? quatRotateVector(quatConjugate(twist), gCalibrated)
      : gravityInFrame(swing);
  return autoSliceDepthFromGravityVector(g, gain, deadzoneRad);
}

export function autoSliceDepthFromGravity(
  gOrQ: Vec3 | Quaternion,
  gain = 0.75,
  deadzoneRad = 0,
): number {
  if ("w" in gOrQ) {
    return autoSliceDepthFromGravityVector(
      gravityInFrame(quatSwingTwist(gOrQ, FRAME_VIEW_AXIS).swing),
      gain,
      deadzoneRad,
    );
  }
  return autoSliceDepthFromGravityVector(gOrQ, gain, deadzoneRad);
}

/** Low-pass slice depth — call once per frame from R3F (plane orientation stays on fast quat). */
export function smoothedAutoSliceDepth(
  q: Quaternion,
  gCalibrated: Vec3 | null,
  gain: number,
  deadzoneRad: number,
  smoothing: number,
): number {
  const target = autoSliceDepthFromPose(q, gCalibrated, gain, deadzoneRad);
  smoothedSliceDepth += (target - smoothedSliceDepth) * smoothing;
  return smoothedSliceDepth;
}
