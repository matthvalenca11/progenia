/** Shared AR Slice scene tuning (camera + cut disc). */
export const AR_SLICE_CAMERA = {
  min: 2.2,
  max: 14,
  default: 5.2,
} as const;

/** IMU slice-height tuning — BNO085 gravity vector scroll engine. */
export const AR_SLICE_IMU = {
  /** Meters of slice travel per radian of gravity tilt (twist-free). */
  sliceScrollGain: 1.35,
  /** Ignore tiny tilts near the zero pose (~0.7°). */
  sliceScrollDeadzoneRad: 0.012,
  /** Low-pass on slice height only (plane orientation stays fast). */
  sliceScrollSmoothing: 0.32,
  /** Slow gravity-ref blend when frame is held still (anti-drift). */
  sliceScrollStationaryBlend: 0.004,
  /** Gyro magnitude below this (rad/s) counts as stationary. */
  sliceScrollStationaryGyroRadS: 0.09,
} as const;

/** Gravity-scroll stationary gate + guided axis wizard. */
export const AR_SLICE_AXIS_CAL = {
  /** Hold still this long before auto-capture (ms). */
  stationaryHoldMs: 900,
  /** Gyro magnitude below this (rad/s) counts as stationary. */
  stationaryGyroRadS: 0.09,
  targetRotationDeg: 90,
  rotationToleranceDeg: 18,
} as const;

export const AR_SLICE_CUT_CAP = {
  /** Disc radius when MRI volume is loaded (fraction of displayScale). */
  mriRadiusRatio: 0.68,
  /** Procedural head fallback radius. */
  proceduralRadius: 0.95,
  /** Tiny offset along normal to avoid z-fighting (not a visual gap). */
  planeEpsilon: 0.004,
} as const;

export function cutCapRadius(displayScale: number, hasMriVolume: boolean): number {
  return hasMriVolume
    ? displayScale * AR_SLICE_CUT_CAP.mriRadiusRatio
    : AR_SLICE_CUT_CAP.proceduralRadius;
}
