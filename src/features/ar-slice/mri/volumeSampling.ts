import type { NormalizedVolume } from "@/lib/mri/volumeTypes";
import { mcFieldUnitToVolumeFraction, worldUnitToVolumeFraction } from "@/features/ar-slice/mri/niftiWorldAxes";

export type VolumePlacement = {
  /** MarchingCubes world half-extent; local coordinates span [-1, +1]. */
  displayScale: number;
  halfExtents?: { x: number; y: number; z: number };
};

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function sampleVolumeTrilinear(
  volume: NormalizedVolume,
  fx: number,
  fy: number,
  fz: number,
): number {
  const { width, height, depth, data } = volume;
  const sliceStride = width * height;

  const x0 = clamp(Math.floor(fx), 0, width - 1);
  const y0 = clamp(Math.floor(fy), 0, height - 1);
  const z0 = clamp(Math.floor(fz), 0, depth - 1);
  const x1 = clamp(x0 + 1, 0, width - 1);
  const y1 = clamp(y0 + 1, 0, height - 1);
  const z1 = clamp(z0 + 1, 0, depth - 1);

  const tx = fx - x0;
  const ty = fy - y0;
  const tz = fz - z0;
  const idx = (x: number, y: number, z: number) => x + y * width + z * sliceStride;

  const c000 = data[idx(x0, y0, z0)] ?? 0;
  const c100 = data[idx(x1, y0, z0)] ?? 0;
  const c010 = data[idx(x0, y1, z0)] ?? 0;
  const c110 = data[idx(x1, y1, z0)] ?? 0;
  const c001 = data[idx(x0, y0, z1)] ?? 0;
  const c101 = data[idx(x1, y0, z1)] ?? 0;
  const c011 = data[idx(x0, y1, z1)] ?? 0;
  const c111 = data[idx(x1, y1, z1)] ?? 0;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c00 = lerp(c000, c100, tx);
  const c10 = lerp(c010, c110, tx);
  const c01 = lerp(c001, c101, tx);
  const c11 = lerp(c011, c111, tx);
  const c0 = lerp(c00, c10, ty);
  const c1 = lerp(c01, c11, ty);
  return lerp(c0, c1, tz);
}

/** World point → fractional voxel indices for a centered MarchingCubes volume. */
export function worldToVoxelFraction(
  wx: number,
  wy: number,
  wz: number,
  volume: NormalizedVolume,
  placement: VolumePlacement,
): { fx: number; fy: number; fz: number } {
  const extents = placement.halfExtents ?? {
    x: placement.displayScale,
    y: placement.displayScale,
    z: placement.displayScale,
  };
  const lx = wx / (2 * extents.x) + 0.5;
  const ly = wy / (2 * extents.y) + 0.5;
  const lz = wz / (2 * extents.z) + 0.5;
  return worldUnitToVolumeFraction(lx, ly, lz, volume);
}

export function buildDownsampledField(opts: {
  volume: NormalizedVolume;
  outRes: number;
}): Float32Array {
  const { volume, outRes } = opts;
  const { width, height, depth, data, min, max } = volume;
  const field = new Float32Array(outRes * outRes * outRes);
  const sliceStride = width * height;

  const idx3 = (x: number, y: number, z: number) => x + y * width + z * sliceStride;

  const sampleTrilinear = (fx: number, fy: number, fz: number) => {
    const x0 = clamp(Math.floor(fx), 0, width - 1);
    const y0 = clamp(Math.floor(fy), 0, height - 1);
    const z0 = clamp(Math.floor(fz), 0, depth - 1);
    const x1 = clamp(x0 + 1, 0, width - 1);
    const y1 = clamp(y0 + 1, 0, height - 1);
    const z1 = clamp(z0 + 1, 0, depth - 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const tz = fz - z0;
    const c000 = data[idx3(x0, y0, z0)] ?? 0;
    const c100 = data[idx3(x1, y0, z0)] ?? 0;
    const c010 = data[idx3(x0, y1, z0)] ?? 0;
    const c110 = data[idx3(x1, y1, z0)] ?? 0;
    const c001 = data[idx3(x0, y0, z1)] ?? 0;
    const c101 = data[idx3(x1, y0, z1)] ?? 0;
    const c011 = data[idx3(x0, y1, z1)] ?? 0;
    const c111 = data[idx3(x1, y1, z1)] ?? 0;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const c00 = lerp(c000, c100, tx);
    const c10 = lerp(c010, c110, tx);
    const c01 = lerp(c001, c101, tx);
    const c11 = lerp(c011, c111, tx);
    const c0 = lerp(c00, c10, ty);
    const c1 = lerp(c01, c11, ty);
    return lerp(c0, c1, tz);
  };

  for (let z = 0; z < outRes; z++) {
    const mz = z / (outRes - 1);
    for (let y = 0; y < outRes; y++) {
      const my = y / (outRes - 1);
      for (let x = 0; x < outRes; x++) {
        const mx = x / (outRes - 1);
        const { fx, fy, fz } = mcFieldUnitToVolumeFraction(mx, my, mz, volume);
        const v = sampleTrilinear(fx, fy, fz);
        const t = (v - min) / (max - min || 1);
        field[x + y * outRes + z * outRes * outRes] = clamp(t, 0, 1);
      }
    }
  }

  return field;
}

export function computeDisplayScale(volume: NormalizedVolume, targetSize = 1.9): number {
  return targetSize;
}

/** Physical NIfTI proportions mapped into Three.js axes (X=LR, Y=SI, Z=AP). */
export function computeDisplayHalfExtents(
  volume: NormalizedVolume,
  displayScale: number,
) {
  const sceneX = volume.width * volume.spacing[0];
  const sceneY = volume.depth * volume.spacing[2];
  const sceneZ = volume.height * volume.spacing[1];
  const maxExtent = Math.max(sceneX, sceneY, sceneZ, 1e-6);
  return {
    x: displayScale * (sceneX / maxExtent),
    y: displayScale * (sceneY / maxExtent),
    z: displayScale * (sceneZ / maxExtent),
  };
}

export function applyWindowLevel(
  intensity: number,
  volMin: number,
  volMax: number,
  window: number,
  level: number,
): number {
  const windowMin = level - window / 2;
  const windowMax = level + window / 2;
  const range = Math.max(1, windowMax - windowMin);
  const clamped = clamp(intensity, windowMin, windowMax);
  return Math.round(((clamped - windowMin) / range) * 255);
}
