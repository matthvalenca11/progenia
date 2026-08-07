import type { NormalizedVolume } from "@/lib/mri/volumeTypes";

/**
 * BraTS / encéfalo NIfTI → Three.js (Y-up, face +Z, câmera na frente).
 * Volume index: x=LR (240), y=AP (240), z=SI (155 axial stack).
 */
export function worldUnitToVolumeFraction(
  lx: number,
  ly: number,
  lz: number,
  volume: NormalizedVolume,
): { fx: number; fy: number; fz: number } {
  const { width, height, depth } = volume;
  return {
    fx: lx * (width - 1),
    // Face anterior para +Z (invert AP se o dataset vier posterior→anterior).
    fy: (1 - lz) * (height - 1),
    fz: ly * (depth - 1),
  };
}

export function mcFieldUnitToVolumeFraction(
  mx: number,
  my: number,
  mz: number,
  volume: NormalizedVolume,
): { fx: number; fy: number; fz: number } {
  return worldUnitToVolumeFraction(mx, my, mz, volume);
}
