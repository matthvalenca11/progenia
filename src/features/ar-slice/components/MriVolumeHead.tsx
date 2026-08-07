import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import { isNativeMobile } from "@/lib/labPerformance";
import { useArSliceMriStore } from "@/features/ar-slice/mri/arSliceMriStore";
import { buildDownsampledField } from "@/features/ar-slice/mri/volumeSampling";

type MriVolumeHeadProps = {
  clippingPlanes?: THREE.Plane[];
};

function clampSurfaceResolution(res: number): number {
  return Math.max(24, Math.min(isNativeMobile ? 44 : 64, res));
}

export function MriVolumeHead({ clippingPlanes = [] }: MriVolumeHeadProps) {
  const volume = useArSliceMriStore((s) => s.volume);
  const iso = useArSliceMriStore((s) => s.iso);
  const displayScale = useArSliceMriStore((s) => s.displayScale);
  const surfaceRes = isNativeMobile ? 40 : 52;

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#d8dce8"),
        roughness: 0.82,
        metalness: 0.04,
        side: THREE.FrontSide,
      }),
    [],
  );

  const { field } = useMemo(() => {
    if (!volume) return { field: new Float32Array(0) };
    const r = clampSurfaceResolution(surfaceRes);
    return {
      field: buildDownsampledField({ volume, outRes: r }),
    };
  }, [volume, surfaceRes]);

  const marching = useMemo(() => {
    const r = clampSurfaceResolution(surfaceRes);
    const mc = new MarchingCubes(r, material, false, false, isNativeMobile ? 220000 : 450000);
    mc.frustumCulled = false;
    // MarchingCubes already emits vertices centered in [-1, +1].
    // The previous -0.5 * scale translation treated them as [0, 1] and
    // displaced the anatomy away from the cut ring.
    mc.position.set(0, 0, 0);
    mc.scale.setScalar(displayScale);
    return mc;
  }, [material, surfaceRes, displayScale]);

  useEffect(() => {
    if (!volume || field.length === 0) return;
    if (field.length !== marching.field.length) return;
    marching.field.set(field);
    marching.isolation = iso;
    marching.update();
  }, [marching, field, iso, volume]);

  useEffect(() => {
    return () => {
      material.dispose();
      marching.geometry.dispose();
    };
  }, [material, marching]);

  if (!volume || field.length === 0) return null;

  return <primitive object={marching} />;
}
