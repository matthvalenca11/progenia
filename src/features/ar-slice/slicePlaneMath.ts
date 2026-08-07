import type { Vec3 } from "@/features/ar-slice/poseMath";

/** Anatomical superior–inferior in Three.js world (matches niftiWorldAxes). */
export const ANATOMICAL_UP: Vec3 = { x: 0, y: 1, z: 0 };

export type SlicePlanePair = {
  /** Geometric cut plane (aro + textura da fatia). */
  cut: { normal: Vec3; constant: number };
  /** Clipping plane — remove o half-space voltado para a câmera / “acima” da moldura. */
  clip: { normal: Vec3; constant: number };
  /** Ponto de ancoragem ao longo do eixo SI (world +Y). */
  anchor: Vec3;
};

/**
 * Build cut + clip planes. Anchor moves along SI (Y) with sliceLevel so the cut
 * scrolls through the volume as the frame descends.
 */
export function buildSlicePlanes(
  normal: Vec3,
  brainCenter: Vec3,
  sliceLevel: number,
): SlicePlanePair {
  const anchor: Vec3 = {
    x: brainCenter.x,
    y: brainCenter.y + sliceLevel,
    z: brainCenter.z,
  };
  const constant = -(normal.x * anchor.x + normal.y * anchor.y + normal.z * anchor.z);
  return {
    cut: { normal: { ...normal }, constant },
    clip: {
      normal: { x: -normal.x, y: -normal.y, z: -normal.z },
      constant: -constant,
    },
    anchor,
  };
}

/** Closest point on the plane to a reference point — center of the aro on the corte. */
export function projectPointOntoPlane(
  point: Vec3,
  normal: Vec3,
  constant: number,
  out: Vec3,
): Vec3 {
  const dist = normal.x * point.x + normal.y * point.y + normal.z * point.z + constant;
  out.x = point.x - normal.x * dist;
  out.y = point.y - normal.y * dist;
  out.z = point.z - normal.z * dist;
  return out;
}

/** @deprecated use buildSlicePlanes */
export function slicePlaneConstant(
  normal: Vec3,
  brainCenter: Vec3,
  sliceLevel: number,
): number {
  return buildSlicePlanes(normal, brainCenter, sliceLevel).cut.constant;
}

/** @deprecated */
export function sliceScrollAxisDot(normal: Vec3): number {
  return Math.abs(normal.y) >= Math.abs(normal.z) ? normal.y : normal.z;
}
