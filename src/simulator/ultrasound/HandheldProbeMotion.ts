/**
 * Natural hand-held transducer motion (breathing, tremor, arm sway, slow drift).
 * Used for pulse-echo ray sampling and live cache resampling — not canvas translation.
 */

export type HandheldProbeMotionCm = {
  lateralCm: number;
  depthCm: number;
};

/**
 * @param time Seconds since start
 * @param depthNorm 0 (near field) – 1 (deepest sample), scales breathing coupling
 */
export function computeHandheldProbeMotionCm(
  time: number,
  depthNorm = 0.5,
): HandheldProbeMotionCm {
  const dn = Math.max(0, Math.min(1, depthNorm));

  const breathing = Math.sin(time * 0.28) * 0.038;
  const tremorLateral =
    Math.sin(time * 6.2 + Math.cos(time * 8.7)) * 0.024 +
    Math.sin(time * 10.8 + 1.1) * 0.01;
  const tremorDepth =
    Math.cos(time * 5.4 + Math.sin(time * 7.1)) * 0.016 +
    Math.sin(time * 9.1 + 0.7) * 0.007;
  const armSway = Math.sin(time * 0.92 + 0.35) * Math.cos(time * 0.64) * 0.032;
  const slowDrift =
    Math.sin(time * 0.38) * 0.028 + Math.cos(time * 0.22) * 0.014;
  const rollCoupling = Math.sin(time * 1.12) * dn * 0.01;

  return {
    lateralCm: tremorLateral + armSway + slowDrift + rollCoupling,
    depthCm: breathing * (0.3 + dn * 0.7) + tremorDepth,
  };
}

export function handheldMotionToPixelShift(
  motion: HandheldProbeMotionCm,
  width: number,
  height: number,
  fieldWidthCm: number,
  depthCm: number,
): { dxPx: number; dyPx: number } {
  return {
    dxPx: (motion.lateralCm / Math.max(0.1, fieldWidthCm)) * width,
    dyPx: (motion.depthCm / Math.max(0.1, depthCm)) * height,
  };
}
