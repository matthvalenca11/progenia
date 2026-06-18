import { BufferAttribute, BufferGeometry, MeshStandardMaterial, PlaneGeometry } from "three";
import { getGelGridResolution } from "@/lib/ultrasoundVisualQuality";

export interface GelStamp {
  x: number;
  z: number;
  radiusMul: number;
  heightMul: number;
  stretch: number;
  rot: number;
}

/** Volume aproximado de cada mancha (hemisfério: ∝ r²·h) */
export function stampVolume(stamp: GelStamp): number {
  const r = stamp.radiusMul;
  return r * r * stamp.heightMul * stamp.stretch;
}

export function totalStampVolume(stamps: GelStamp[]): number {
  return stamps.reduce((sum, s) => sum + stampVolume(s), 0);
}

/** Reajusta alturas para manter o volume total constante */
export function normalizeStampVolume(stamps: GelStamp[], targetVolume: number): void {
  const current = totalStampVolume(stamps);
  if (current <= 0 || targetVolume <= 0) return;
  const scale = targetVolume / current;
  for (const stamp of stamps) {
    stamp.heightMul *= scale;
  }
}

/** Espalha levemente preservando r²·h (e stretch) da mancha */
export function spreadStampInPlace(stamp: GelStamp, spread: number, maxRadiusMul = 1.1): void {
  if (spread <= 0) return;

  const oldR = stamp.radiusMul;
  const newR = Math.min(maxRadiusMul, oldR + spread);
  if (newR <= oldR) return;

  const rRatio = oldR / newR;
  stamp.radiusMul = newR;
  stamp.heightMul = Math.max(0.62, stamp.heightMul * rRatio * rRatio);
}

const SMOOTH_K = 18;

/** União suave — manchas que se tocam viram um único domo sem costura interna */
export function smoothMax(a: number, b: number, k = SMOOTH_K): number {
  if (a <= 0) return b;
  if (b <= 0) return a;
  const ea = Math.exp(k * a);
  const eb = Math.exp(k * b);
  return Math.log(ea + eb) / k;
}

export function stampHeightAt(
  stamp: GelStamp,
  x: number,
  z: number,
  baseRadius: number,
  baseHeight: number,
): number {
  const dx = x - stamp.x;
  const dz = z - stamp.z;
  const cos = Math.cos(stamp.rot);
  const sin = Math.sin(stamp.rot);
  const lx = dx * cos + dz * sin;
  const lz = (-dx * sin + dz * cos) / stamp.stretch;
  const r = baseRadius * stamp.radiusMul;
  if (r <= 0) return 0;
  const dist = Math.hypot(lx, lz) / r;
  if (dist >= 1) return 0;
  return baseHeight * stamp.heightMul * Math.sqrt(1 - dist * dist);
}

export function sampleMergedGelHeight(
  x: number,
  z: number,
  stamps: GelStamp[],
  baseRadius: number,
  baseHeight: number,
): number {
  let h = 0;
  for (const stamp of stamps) {
    h = smoothMax(h, stampHeightAt(stamp, x, z, baseRadius, baseHeight));
  }
  return h;
}

export function getGelSurfaceBounds() {
  const grid = getGelGridResolution();
  return {
    xMin: -6.1,
    xMax: 6.1,
    zMin: -2.6,
    zMax: 2.6,
    segX: grid,
    segZ: Math.round(grid * 0.42),
  } as const;
}

export const GEL_SURFACE_BOUNDS = getGelSurfaceBounds();

export function createGelSurfaceGeometry(): BufferGeometry {
  const { xMin, xMax, zMin, zMax, segX, segZ } = getGelSurfaceBounds();
  const geo = new PlaneGeometry(xMax - xMin, zMax - zMin, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate((xMin + xMax) / 2, 0, (zMin + zMax) / 2);
  geo.setAttribute("gelHeight", new BufferAttribute(new Float32Array(geo.attributes.position.count), 1));
  return geo;
}

export function updateGelSurfaceGeometry(
  geometry: BufferGeometry,
  stamps: GelStamp[],
  baseRadius: number,
  baseHeight: number,
): void {
  const pos = geometry.attributes.position;
  const gelHeight = geometry.attributes.gelHeight as BufferAttribute | undefined;
  if (!pos || !gelHeight || gelHeight.count !== pos.count) return;
  const count = pos.count;

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = sampleMergedGelHeight(x, z, stamps, baseRadius, baseHeight);
    pos.setY(i, h);
    gelHeight.setX(i, h);
  }

  pos.needsUpdate = true;
  gelHeight.needsUpdate = true;
  geometry.computeVertexNormals();
}

/** Malha local (ex.: sob o transdutor) */
export function createLocalGelSurfaceGeometry(
  halfW: number,
  halfD: number,
  segX = 32,
  segZ = 32,
): BufferGeometry {
  const geo = new PlaneGeometry(halfW * 2, halfD * 2, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.setAttribute("gelHeight", new BufferAttribute(new Float32Array(geo.attributes.position.count), 1));
  return geo;
}

export function updateLocalGelSurfaceGeometry(
  geometry: BufferGeometry,
  stamps: GelStamp[],
  baseRadius: number,
  baseHeight: number,
): void {
  const pos = geometry.attributes.position;
  const gelHeight = geometry.attributes.gelHeight as BufferAttribute | undefined;
  if (!pos || !gelHeight || gelHeight.count !== pos.count) return;
  const count = pos.count;

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = sampleMergedGelHeight(x, z, stamps, baseRadius, baseHeight);
    pos.setY(i, h);
    gelHeight.setX(i, h);
  }

  pos.needsUpdate = true;
  gelHeight.needsUpdate = true;
  geometry.computeVertexNormals();
}

export function patchGelMaterial(material: MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute float gelHeight;
varying float vGelHeight;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vGelHeight = gelHeight;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying float vGelHeight;`,
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
if (vGelHeight < 0.0015) discard;`,
      );
  };
  material.customProgramCacheKey = () => "therapy-gel-surface";
}
