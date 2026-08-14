import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { isNativeMobile } from "@/lib/labPerformance";
import {
  brainHeat,
  buildColoredHeadGeometry,
  createClippedVolumeMaterial,
  headShellHeat,
} from "@/features/ar-slice/components/medicalVolumeStyle";

type AnatomicalHeadProps = {
  clippingPlanes?: THREE.Plane[];
  showCap?: boolean;
  /** Bright cyan mesh for mixed-reality projection over the live camera. */
  hologram?: boolean;
};

function createHologramMaterial(
  clippingPlanes: THREE.Plane[],
  opts?: { opacity?: number; side?: THREE.Side; color?: string },
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: opts?.color ?? "#3cefff",
    transparent: true,
    opacity: opts?.opacity ?? 0.82,
    side: opts?.side ?? THREE.FrontSide,
    depthWrite: false,
    toneMapped: false,
    clippingPlanes,
    clipShadows: false,
  });
}

/**
 * Layered head volume with MRI-style false-color (reference: cyan/green/yellow/purple).
 * Procedural geometry — swap for `head.glb` via HEAD_MODEL_CONTRACT when available.
 */
export function AnatomicalHead({
  clippingPlanes = [],
  showCap = true,
  hologram = false,
}: AnatomicalHeadProps) {
  const segs = isNativeMobile ? ([32, 24] as const) : ([56, 44] as const);

  const outerGeo = useMemo(
    () => buildColoredHeadGeometry(1, segs, headShellHeat),
    [segs],
  );
  const skullGeo = useMemo(
    () =>
      buildColoredHeadGeometry(0.86, [segs[0] - 4, segs[1] - 4], (x, y, z, nx, ny, nz) =>
        headShellHeat(x, y, z, nx, ny, nz) * 0.85 + 0.08,
      ),
    [segs],
  );
  const brainGeo = useMemo(
    () => buildColoredHeadGeometry(0.68, [segs[0] - 6, segs[1] - 6], (x, y, z) => brainHeat(x, y, z)),
    [segs],
  );
  const neckGeo = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.26, 0.32, 0.55, isNativeMobile ? 18 : 28);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color("#2d0066");
    const c2 = new THREE.Color("#0066aa");
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = (y + 0.275) / 0.55;
      c.lerp(c2, t);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  const earGeo = useMemo(
    () => new THREE.SphereGeometry(0.11, isNativeMobile ? 10 : 14, isNativeMobile ? 8 : 12),
    [],
  );

  const outerMat = useMemo(
    () =>
      hologram
        ? createHologramMaterial(clippingPlanes, { opacity: 0.55, color: "#2ad8ff" })
        : createClippedVolumeMaterial(clippingPlanes),
    [clippingPlanes, hologram],
  );
  const skullMat = useMemo(
    () =>
      hologram
        ? createHologramMaterial(clippingPlanes, { opacity: 0.7, color: "#45e9ff" })
        : createClippedVolumeMaterial(clippingPlanes),
    [clippingPlanes, hologram],
  );
  const brainMat = useMemo(
    () =>
      hologram
        ? createHologramMaterial(clippingPlanes, { opacity: 0.92, color: "#7af6ff" })
        : createClippedVolumeMaterial(clippingPlanes),
    [clippingPlanes, hologram],
  );
  const innerMat = useMemo(
    () =>
      hologram
        ? createHologramMaterial(clippingPlanes, {
            opacity: 0.45,
            side: THREE.BackSide,
            color: "#1bb8e6",
          })
        : createClippedVolumeMaterial(clippingPlanes, { side: THREE.BackSide }),
    [clippingPlanes, hologram],
  );
  const featureMat = useMemo(
    () =>
      hologram
        ? createHologramMaterial(clippingPlanes, { opacity: 0.9, color: "#9ffcff" })
        : new THREE.MeshLambertMaterial({
            color: "#0088aa",
            clippingPlanes,
          }),
    [clippingPlanes, hologram],
  );

  useEffect(() => {
    return () => {
      outerGeo.dispose();
      skullGeo.dispose();
      brainGeo.dispose();
      neckGeo.dispose();
      earGeo.dispose();
      outerMat.dispose();
      skullMat.dispose();
      brainMat.dispose();
      innerMat.dispose();
      featureMat.dispose();
    };
  }, [outerGeo, skullGeo, brainGeo, neckGeo, earGeo, outerMat, skullMat, brainMat, innerMat, featureMat]);

  return (
    <group scale={[0.9, 0.98, 0.92]} rotation={[0.04, 0, 0]}>
      <mesh geometry={outerGeo} material={outerMat} />
      <mesh geometry={skullGeo} material={skullMat} position={[0, 0.02, -0.03]} />
      <mesh geometry={brainGeo} material={brainMat} position={[0, 0.05, 0.01]} />
      {showCap && (
        <mesh geometry={brainGeo} material={innerMat} position={[0, 0.05, 0.01]} scale={0.998} />
      )}
      <mesh geometry={neckGeo} material={outerMat} position={[0, -1.08, -0.06]} />
      <mesh geometry={earGeo} material={outerMat} position={[-0.92, 0.04, -0.08]} scale={[0.55, 1.1, 0.45]} />
      <mesh geometry={earGeo} material={outerMat} position={[0.92, 0.04, -0.08]} scale={[0.55, 1.1, 0.45]} />
      <mesh position={[0, 0.0, 0.96]} scale={[0.14, 0.12, 0.18]} material={featureMat}>
        <sphereGeometry args={[1, isNativeMobile ? 8 : 12, isNativeMobile ? 6 : 10]} />
      </mesh>
    </group>
  );
}

export const HEAD_MODEL_CONTRACT = {
  preferredPath: "/models/ar-slice/head.glb",
  layers: ["skin", "skull", "brain"] as const,
  upAxis: "Y" as const,
};
