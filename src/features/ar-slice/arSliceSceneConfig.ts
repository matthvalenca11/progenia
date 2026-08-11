/** Shared AR Slice scene tuning (camera + cut disc). */
export const AR_SLICE_CAMERA = {
  min: 2.2,
  max: 14,
  /** Start at half of the maximum zoom distance. */
  default: 7,
} as const;

/** IMU slice-height tuning — BNO085 gravity vector scroll engine. */
export const AR_SLICE_IMU = {
  /** Meters of slice travel per radian of gravity tilt (twist-free). */
  sliceScrollGain: 1.1,
  /** Ignore tiny tilts near the zero pose (~1.5°) — cuts gravity float. */
  sliceScrollDeadzoneRad: 0.026,
  /** Low-pass on slice height only. */
  sliceScrollSmoothing: 0.18,
  /** Slow gravity-ref blend when frame is held still (anti-drift). */
  sliceScrollStationaryBlend: 0.01,
  /** Gyro magnitude below this (rad/s) counts as stationary. */
  sliceScrollStationaryGyroRadS: 0.07,
  /** User multiplier on firmware probe-depth meters (absolute). */
  linearGestureGain: 1.0,
  /**
   * Continuous Z probe → scene units. Firmware already applies FRAME_MOTION_GAIN.
   */
  linearGestureMetersToScene: 14,
  /** BLE gesture-rate control is bounded in firmware, allowing a more responsive visual gain. */
  bleLinearGestureMetersToScene: 9,
  /** Reject a single packet jump above this (unwrap glitch guard). */
  linearGestureMaxMeters: 0.28,
  /** 1 = follow probe depth immediately (no visual lag). */
  linearGestureSmoothing: 1,
  /** Ignore tiny wire noise before moving the cut. */
  linearGestureDeadbandMeters: 0.00005,
  /** Do not remap cut-normal axes here — breaks direction vs sense. */
  mirrorHorizontalNormal: false,
  invertVerticalNormal: false,
  /** Push/pull along the probe axis was opposite to physical motion. */
  invertLinearDepth: false,
  /**
   * Deprecated no-op: BNO Earth→device→Three.js is handled in applyMountAndZero
   * (right-multiply zero). Kept so old prefs/reads do not break.
   */
  invertOrientation: false,
  /**
   * Flip only in-plane twist about sensor +Z (CW/CCW). Does not mirror tips.
   * Never use mesh scale.x = -1 — that swaps left/right when tipping.
   */
  invertInPlaneSpin: true,
  /**
   * In-plane roll (deg) of the aro about sensor +Z (keeps disc flat).
   * Use 90 if only the painted “horizontal” of the ring is rotated.
   */
  cutInPlaneRollDeg: 0,
  /**
   * PCB ↔ moldura mount. Keep identity so sensor +Z is the aro normal.
   * Use the axis wizard (or imu_x±90) only if the chip is edge-mounted.
   */
  defaultMountPreset: "identity" as const,
  /**
   * Orientation filter (restored to the “melhorou muito” balance):
   * enough deadband to kill float, still tracks intentional tilt.
   */
  orientDeadbandRad: 0.022,
  orientDeadbandStillRad: 0.032,
  orientTwistDeadbandRad: 0.04,
  orientTwistGain: 0.18,
  orientSlerpSlow: 0.62,
  orientSlerpFast: 0.92,
  orientSlowRad: 0.1,
  /** Cut-plane normal filter — lighter so the gyro feels immediate again. */
  normalDeadbandRad: 0.018,
  normalSlerp: 0.5,
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
  mriRadiusRatio: 0.75,
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
