/**
 * Fan/sector geometry for convex & microconvex scan conversion.
 * Screen wedge size is fixed; depth slider changes anatomy scale / field-of-view (cm).
 */

import { computeHandheldProbeMotionCm } from './HandheldProbeMotion';

export type ConvexBeamCoords = {
  theta: number;
  depthCm: number;
  inside: boolean;
};

/** Layout-only depth (cm) — sets on-screen cone size, not tied to the depth control. */
export const CONVEX_DISPLAY_REFERENCE_DEPTH_CM = 9;
/** Tiny inset so the fan edge is not clipped by the canvas border. */
export const CONVEX_SECTOR_BOX_MARGIN = 0.012;

export type ConvexSectorLayout = {
  halfFOVRad: number;
  arcRadiusPixels: number;
  /** Display pixels per layout cm (near-field arc sizing). */
  pixelsPerCm: number;
  centerX: number;
  virtualCenterY: number;
  /** Radial extent of the fan in pixels (fixed for a given canvas). */
  sectorDepthPixels: number;
  transducerRadiusCm: number;
  layoutDepthCm: number;
};

export type ConvexScanGeom = ConvexSectorLayout & {
  /** Active scan depth from lab controls — maps into the fixed fan. */
  maxDepthCm: number;
};

export function getConvexSectorLayout(
  width: number,
  height: number,
  transducerType: 'convex' | 'microconvex',
): ConvexSectorLayout {
  const transducerRadiusCm = transducerType === 'convex' ? 5.0 : 2.5;
  const fovDegrees = transducerType === 'convex' ? 60 : 50;
  const halfFOVRad = (fovDegrees / 2) * (Math.PI / 180);
  const layoutDepthCm = CONVEX_DISPLAY_REFERENCE_DEPTH_CM;
  const totalDistanceCm = transducerRadiusCm + layoutDepthCm;
  const sinHalfFov = Math.sin(halfFOVRad);
  const inset = CONVEX_SECTOR_BOX_MARGIN;

  // Fit fan to box: θ=0 outer edge → bottom; θ=±FOV outer edge → lateral bounds.
  const maxBottomY = height * (1 - inset);
  const maxHalfWidth = (width / 2) * (1 - inset);
  const pixelsPerCmFromHeight = maxBottomY / layoutDepthCm;
  const pixelsPerCmFromWidth =
    sinHalfFov > 0.01
      ? maxHalfWidth / (totalDistanceCm * sinHalfFov)
      : pixelsPerCmFromHeight;
  const pixelsPerCm = Math.min(pixelsPerCmFromHeight, pixelsPerCmFromWidth);

  const arcRadiusPixels = transducerRadiusCm * pixelsPerCm;
  const sectorDepthPixels = layoutDepthCm * pixelsPerCm;

  // If width-limited, nudge the fan down so the apex uses vertical space.
  let virtualCenterY = -arcRadiusPixels;
  const bottomYAtCenter = sectorDepthPixels;
  if (bottomYAtCenter < maxBottomY) {
    virtualCenterY += maxBottomY - bottomYAtCenter;
  }

  return {
    halfFOVRad,
    arcRadiusPixels,
    pixelsPerCm,
    centerX: width / 2,
    virtualCenterY,
    sectorDepthPixels,
    transducerRadiusCm,
    layoutDepthCm,
  };
}

export function getConvexScanGeom(
  width: number,
  height: number,
  transducerType: 'convex' | 'microconvex',
  maxDepthCm: number,
): ConvexScanGeom {
  return {
    ...getConvexSectorLayout(width, height, transducerType),
    maxDepthCm,
  };
}

function radialPixelsFromCenter(radiusFromCenter: number, geom: ConvexSectorLayout): number {
  return radiusFromCenter - geom.arcRadiusPixels;
}

export function convexPixelToBeam(
  x: number,
  y: number,
  geom: ConvexScanGeom,
): ConvexBeamCoords {
  const dx = x - geom.centerX;
  const dy = y - geom.virtualCenterY;
  const radiusFromCenter = Math.sqrt(dx * dx + dy * dy);
  const theta = Math.atan2(dx, dy);
  const radialPx = radialPixelsFromCenter(radiusFromCenter, geom);
  const depthCm =
    (radialPx / Math.max(1, geom.sectorDepthPixels)) * geom.maxDepthCm;

  const inside =
    Math.abs(theta) <= geom.halfFOVRad &&
    radialPx >= 0 &&
    radialPx <= geom.sectorDepthPixels;

  return { theta, depthCm, inside };
}

export function convexBeamToPixel(
  theta: number,
  depthCm: number,
  geom: ConvexScanGeom,
): { x: number; y: number; inside: boolean } {
  const depthFrac = depthCm / Math.max(0.05, geom.maxDepthCm);
  const radialPx = depthFrac * geom.sectorDepthPixels;
  const inside =
    Math.abs(theta) <= geom.halfFOVRad &&
    depthCm >= 0 &&
    depthCm <= geom.maxDepthCm;

  const radiusFromCenter = geom.arcRadiusPixels + radialPx;
  const x = geom.centerX + radiusFromCenter * Math.sin(theta);
  const y = geom.virtualCenterY + radiusFromCenter * Math.cos(theta);

  return { x, y, inside };
}

/**
 * Attenuates live speckle / resampling near wedge borders (stops white edge flash).
 * Combines distance to eroded mask edge with beam-space margin.
 */
export function convexSectorEdgeFactor(
  x: number,
  y: number,
  mask: Uint8Array,
  width: number,
  height: number,
  geom: ConvexScanGeom | null,
  featherPx = 6,
): number {
  const xi = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const yi = Math.max(0, Math.min(height - 1, Math.floor(y)));
  if (!mask[yi * width + xi]) return 0;

  let distToOutside = featherPx;
  for (let dy = -featherPx; dy <= featherPx; dy++) {
    for (let dx = -featherPx; dx <= featherPx; dx++) {
      const nx = xi + dx;
      const ny = yi + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || !mask[ny * width + nx]) {
        distToOutside = Math.min(distToOutside, Math.hypot(dx, dy));
      }
    }
  }
  let guard = Math.min(1, distToOutside / Math.max(1, featherPx));

  if (geom) {
    const beam = convexPixelToBeam(x, y, geom);
    if (beam.inside) {
      const angleMargin = geom.halfFOVRad * 0.1;
      const depthMargin = Math.max(0.2, geom.maxDepthCm * 0.08);
      guard = Math.min(
        guard,
        Math.min(1, (geom.halfFOVRad - Math.abs(beam.theta)) / angleMargin),
        Math.min(1, (geom.maxDepthCm - beam.depthCm) / depthMargin),
      );
    }
  }

  return guard;
}

/** Keep beam samples away from FOV edges so resampling never pulls black in. */
export function clampBeamInsideSector(
  theta: number,
  depthCm: number,
  geom: ConvexScanGeom,
  marginRatio = 0.05,
): { theta: number; depthCm: number } {
  const marginAngle = geom.halfFOVRad * marginRatio;
  const marginDepth = geom.maxDepthCm * marginRatio;
  return {
    theta: Math.max(-geom.halfFOVRad + marginAngle, Math.min(geom.halfFOVRad - marginAngle, theta)),
    depthCm: Math.max(marginDepth, Math.min(geom.maxDepthCm - marginDepth, depthCm)),
  };
}

/**
 * Screen pixel (x,y) is fixed on the cone; returns cache sample coords for hand-held motion.
 * Probe motion is applied in beam space, then clamped so the sector mask stays fixed.
 */
export function convexInternalHandSamplePixel(
  x: number,
  y: number,
  time: number,
  geom: ConvexScanGeom,
  motionStrength = 1.4,
): { sx: number; sy: number } | null {
  const beam = convexPixelToBeam(x, y, geom);
  if (!beam.inside) return null;

  const depthNorm = beam.depthCm / Math.max(0.1, geom.maxDepthCm);
  const motion = computeHandheldProbeMotionCm(time, depthNorm);
  const radiusCm = geom.transducerRadiusCm + beam.depthCm;
  const deltaTheta = (motion.lateralCm / Math.max(radiusCm, 0.5)) * motionStrength;

  const sampleBeam = clampBeamInsideSector(
    beam.theta + deltaTheta,
    beam.depthCm - motion.depthCm * motionStrength,
    geom,
    0.04,
  );
  const pixel = convexBeamToPixel(sampleBeam.theta, sampleBeam.depthCm, geom);
  return { sx: pixel.x, sy: pixel.y };
}

/** Keep resampling inside the frozen wedge (fallback = no warp). */
export function convexClampSampleToMask(
  sx: number,
  sy: number,
  fallbackX: number,
  fallbackY: number,
  mask: Uint8Array,
  width: number,
  height: number,
): { sx: number; sy: number } {
  const sxi = Math.max(0, Math.min(width - 1, Math.floor(sx)));
  const syi = Math.max(0, Math.min(height - 1, Math.floor(sy)));
  if (mask[syi * width + sxi]) return { sx, sy };
  return { sx: fallbackX, sy: fallbackY };
}

/**
 * Anatomical cm matching PulseEchoAcousticModel / ConvexPolarEngine.beamToAnatomical:
 * lateral = x, depth = z (centerDepthCm).
 */
export function convexPixelToAnatomical(
  x: number,
  y: number,
  geom: ConvexScanGeom,
  lateralOffsetCm = 0,
): { lateral: number; depth: number } | null {
  const beam = convexPixelToBeam(x, y, geom);
  if (!beam.inside) return null;
  const r = beam.depthCm;
  return {
    lateral: r * Math.sin(beam.theta) + lateralOffsetCm,
    depth: r * Math.cos(beam.theta),
  };
}

/** Screen pixels per cm at (x,y) for vessel pulsation warp. */
export function convexPixelsPerCmAt(
  x: number,
  y: number,
  geom: ConvexScanGeom,
): { lateralPxPerCm: number; depthPxPerCm: number } {
  const beam = convexPixelToBeam(x, y, geom);
  const depthPxPerCm = geom.sectorDepthPixels / Math.max(0.05, geom.maxDepthCm);
  if (!beam.inside) {
    return { lateralPxPerCm: 0, depthPxPerCm };
  }
  const radiusCm = Math.max(0.5, geom.transducerRadiusCm + beam.depthCm);
  const eps = 0.02;
  const pLat = convexBeamToPixel(beam.theta + eps / radiusCm, beam.depthCm, geom);
  const pDep = convexBeamToPixel(beam.theta, beam.depthCm + eps, geom);
  return {
    lateralPxPerCm: Math.abs(pLat.x - x) / eps,
    depthPxPerCm: Math.abs(pDep.y - y) / eps,
  };
}

/**
 * Binary mask of the scan cone (1 = inside). Optionally erode inward so motion
 * never brightens/darkens pixels at the wedge boundary (fixes "breathing" cone).
 */
export function buildConvexSectorMask(
  width: number,
  height: number,
  transducerType: 'convex' | 'microconvex',
  erodePixels = 3,
): Uint8Array {
  const layout = getConvexSectorLayout(width, height, transducerType);
  const geom: ConvexScanGeom = { ...layout, maxDepthCm: layout.layoutDepthCm };
  const mask = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (convexPixelToBeam(x, y, geom).inside) {
        mask[y * width + x] = 1;
      }
    }
  }

  if (erodePixels <= 0) return mask;

  const eroded = new Uint8Array(mask);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!mask[idx]) continue;
      let keep = true;
      for (let dy = -erodePixels; dy <= erodePixels && keep; dy++) {
        for (let dx = -erodePixels; dx <= erodePixels && keep; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !mask[ny * width + nx]) {
            keep = false;
          }
        }
      }
      if (!keep) eroded[idx] = 0;
    }
  }

  return eroded;
}

/** Apply a precomputed mask (fixed cone size on screen). */
export function applyConvexSectorMaskBuffer(
  data: Uint8ClampedArray,
  mask: Uint8Array,
  width: number,
  height: number,
): void {
  for (let idx = 0; idx < width * height; idx++) {
    if (mask[idx]) continue;
    const pi = idx * 4;
    data[pi] = 0;
    data[pi + 1] = 0;
    data[pi + 2] = 0;
  }
}

/** Force pixels outside the fan to black (fixed cone on screen). */
export function applyConvexSectorMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  transducerType: 'convex' | 'microconvex',
): void {
  const mask = buildConvexSectorMask(width, height, transducerType, 0);
  applyConvexSectorMaskBuffer(data, mask, width, height);
}
