import * as THREE from "three";
import type { NormalizedVolume } from "@/lib/mri/volumeTypes";
import {
  applyWindowLevel,
  sampleVolumeTrilinear,
  type VolumePlacement,
  worldToVoxelFraction,
} from "@/features/ar-slice/mri/volumeSampling";

export type SliceTextureOptions = {
  resolution: number;
  /** Disc radius in world units (matches CutCap). */
  radius: number;
  window: number;
  level: number;
  /** Hide voxels below this normalized intensity (0–1). */
  isoFloor: number;
  volMin: number;
  volMax: number;
  /** World-space disc center (brain projected onto plane). */
  center?: THREE.Vector3;
};

const tmpPoint = new THREE.Vector3();
const planeCenter = new THREE.Vector3();
const tmpNormal = new THREE.Vector3();
const tmpTangent = new THREE.Vector3();
const tmpBitangent = new THREE.Vector3();
const tmpUp = new THREE.Vector3(0, 1, 0);

export function updateMriSliceTexture(
  texture: THREE.CanvasTexture,
  volume: NormalizedVolume,
  plane: THREE.Plane,
  placement: VolumePlacement,
  opts: SliceTextureOptions,
): void {
  const canvas = texture.image as HTMLCanvasElement;
  const res = opts.resolution;
  if (canvas.width !== res) {
    canvas.width = res;
    canvas.height = res;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const imageData = ctx.createImageData(res, res);
  const pixels = imageData.data;

  tmpNormal.copy(plane.normal).normalize();
  if (opts.center) {
    planeCenter.copy(opts.center);
  } else {
    planeCenter.copy(tmpNormal).multiplyScalar(-plane.constant);
  }

  tmpUp.set(0, 1, 0);
  if (Math.abs(tmpNormal.dot(tmpUp)) > 0.92) {
    tmpUp.set(1, 0, 0);
  }
  tmpTangent.crossVectors(tmpUp, tmpNormal).normalize();
  tmpBitangent.crossVectors(tmpNormal, tmpTangent).normalize();

  const range = Math.max(1e-6, opts.volMax - opts.volMin);
  const isoValue = opts.volMin + opts.isoFloor * range;

  for (let j = 0; j < res; j++) {
    const v = (j / (res - 1)) * 2 - 1;
    for (let i = 0; i < res; i++) {
      const u = (i / (res - 1)) * 2 - 1;
      if (u * u + v * v > 1) {
        const idx = (j * res + i) * 4;
        pixels[idx + 3] = 0;
        continue;
      }

      tmpPoint
        .copy(planeCenter)
        .addScaledVector(tmpTangent, u * opts.radius)
        .addScaledVector(tmpBitangent, v * opts.radius);

      const { fx, fy, fz } = worldToVoxelFraction(
        tmpPoint.x,
        tmpPoint.y,
        tmpPoint.z,
        volume,
        placement,
      );

      if (fx < 0 || fy < 0 || fz < 0 || fx > volume.width - 1 || fy > volume.height - 1 || fz > volume.depth - 1) {
        const idx = (j * res + i) * 4;
        pixels[idx + 3] = 0;
        continue;
      }

      const intensity = sampleVolumeTrilinear(volume, fx, fy, fz);
      const idx = (j * res + i) * 4;

      if (intensity < isoValue) {
        pixels[idx + 3] = 0;
        continue;
      }

      const gray = applyWindowLevel(intensity, opts.volMin, opts.volMax, opts.window, opts.level);
      pixels[idx] = gray;
      pixels[idx + 1] = gray;
      pixels[idx + 2] = gray;
      pixels[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  texture.needsUpdate = true;
}

export function createMriSliceTexture(resolution: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = resolution;
  canvas.height = resolution;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
