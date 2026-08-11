import * as THREE from "three";
import type { NormalizedVolume } from "@/lib/mri/volumeTypes";
import {
  applyWindowLevel,
  sampleVolumeTrilinear,
  type VolumePlacement,
  worldToVoxelFraction,
} from "@/features/ar-slice/mri/volumeSampling";
import { medicalColor } from "@/features/ar-slice/mri/medicalColorMap";
import type { MedicalVolumeColorMap } from "@/features/ar-slice/mri/arSliceMriStore";

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
  colorMap: MedicalVolumeColorMap;
  overlay?: {
    volume: NormalizedVolume;
    window: number;
    level: number;
    isoFloor: number;
    colorMap: MedicalVolumeColorMap;
    opacity: number;
  };
  /** World-space disc center (brain projected onto plane). */
  center?: THREE.Vector3;
  /**
   * World → anatomy-local transform. When the brain is rotated by finger
   * reference, sample points must be mapped into the volume's rest frame.
   */
  worldToVolume?: THREE.Matrix4 | null;
  /**
   * Optional IMU moldura basis. When set, in-plane spin (twist) rotates the
   * resampled slice with the frame — not just the plane normal.
   */
  tangent?: THREE.Vector3;
  bitangent?: THREE.Vector3;
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

  if (opts.tangent && opts.bitangent) {
    tmpTangent.copy(opts.tangent).normalize();
    tmpBitangent.copy(opts.bitangent).normalize();
  } else {
    tmpUp.set(0, 1, 0);
    if (Math.abs(tmpNormal.dot(tmpUp)) > 0.92) {
      tmpUp.set(1, 0, 0);
    }
    tmpTangent.crossVectors(tmpUp, tmpNormal).normalize();
    tmpBitangent.crossVectors(tmpNormal, tmpTangent).normalize();
  }

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
      if (opts.worldToVolume) {
        tmpPoint.applyMatrix4(opts.worldToVolume);
      }

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

      const normalized =
        applyWindowLevel(
          intensity,
          opts.volMin,
          opts.volMax,
          opts.window,
          opts.level,
        ) / 255;
      const [r, g, b] = medicalColor(normalized, opts.colorMap);
      let outR = r;
      let outG = g;
      let outB = b;
      if (opts.overlay) {
        const overlay = opts.overlay;
        const overlayIntensity = sampleVolumeTrilinear(
          overlay.volume,
          fx,
          fy,
          fz,
        );
        const overlayRange = Math.max(
          1e-6,
          overlay.volume.max - overlay.volume.min,
        );
        const overlayIso =
          overlay.volume.min + overlay.isoFloor * overlayRange;
        if (overlayIntensity >= overlayIso) {
          const overlayNormalized =
            applyWindowLevel(
              overlayIntensity,
              overlay.volume.min,
              overlay.volume.max,
              overlay.window,
              overlay.level,
            ) / 255;
          const [heatR, heatG, heatB] = medicalColor(
            overlayNormalized,
            overlay.colorMap,
          );
          const alpha =
            Math.min(1, Math.max(0, (overlayNormalized - 0.04) / 0.3)) *
            overlay.opacity;
          outR = Math.round(outR * (1 - alpha) + heatR * alpha);
          outG = Math.round(outG * (1 - alpha) + heatG * alpha);
          outB = Math.round(outB * (1 - alpha) + heatB * alpha);
        }
      }
      pixels[idx] = outR;
      pixels[idx + 1] = outG;
      pixels[idx + 2] = outB;
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
  // Pixels are generated directly in the slice's tangent/bitangent basis.
  // Three.js' default CanvasTexture Y flip would mirror that anatomical axis
  // relative to the 3D voxel volume.
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
