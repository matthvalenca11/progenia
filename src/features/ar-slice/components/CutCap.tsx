import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { isNativeMobile } from "@/lib/labPerformance";
import { useArSliceMriStore } from "@/features/ar-slice/mri/arSliceMriStore";
import {
  createMriSliceTexture,
  updateMriSliceTexture,
} from "@/features/ar-slice/mri/sliceTexture";
import { cutCapRadius } from "@/features/ar-slice/arSliceSceneConfig";
import { createBrainSliceTexture } from "@/features/ar-slice/components/medicalVolumeStyle";

type CutCapProps = {
  cutPlane: THREE.Plane;
  /** World position of the disc (slightly biased toward camera to avoid z-fight). */
  renderAnchor: THREE.Vector3;
  /** Exact intersection center — used for MRI resampling (matches clip plane). */
  sampleCenter: THREE.Vector3;
};

/**
 * Cap on the clipping plane — real T1 oblique slice when MRI volume is loaded,
 * procedural fallback otherwise.
 */
export function CutCap({ cutPlane, renderAnchor, sampleCenter }: CutCapProps) {
  const groupRef = useRef<THREE.Group>(null);
  const volume = useArSliceMriStore((s) => s.volume);
  const displayScale = useArSliceMriStore((s) => s.displayScale);
  const windowLevel = useArSliceMriStore((s) => s.window);
  const level = useArSliceMriStore((s) => s.level);
  const iso = useArSliceMriStore((s) => s.iso);

  const segs = isNativeMobile ? 32 : 72;
  const capRadius = cutCapRadius(displayScale, !!volume);
  const rimWidth = capRadius * 0.045;
  const texRes = isNativeMobile ? 160 : 224;

  const tmpNormal = useMemo(() => new THREE.Vector3(), []);
  const zAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const lastPlaneKey = useRef("");

  const fallbackTex = useMemo(() => createBrainSliceTexture(texRes), [texRes]);
  const mriTex = useMemo(() => createMriSliceTexture(texRes), [texRes]);

  const useRealMri = !!volume;

  const sliceMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: useRealMri ? mriTex : fallbackTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.98,
        depthWrite: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: 1,
      }),
    [useRealMri, mriTex, fallbackTex],
  );

  const rimMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#e2e8f0",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    sliceMat.map = useRealMri ? mriTex : fallbackTex;
    sliceMat.needsUpdate = true;
  }, [useRealMri, mriTex, fallbackTex, sliceMat]);

  useEffect(() => {
    return () => {
      fallbackTex.dispose();
      mriTex.dispose();
      sliceMat.dispose();
      rimMat.dispose();
    };
  }, [fallbackTex, mriTex, sliceMat, rimMat]);

  useEffect(() => {
    lastPlaneKey.current = "";
  }, [volume]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    tmpNormal.copy(cutPlane.normal).normalize();
    group.position.copy(renderAnchor);
    group.quaternion.setFromUnitVectors(zAxis, tmpNormal);

    if (!volume) return;

    const key = `${tmpNormal.x.toFixed(3)}:${tmpNormal.y.toFixed(3)}:${tmpNormal.z.toFixed(3)}:${cutPlane.constant.toFixed(4)}:${sampleCenter.x.toFixed(3)}:${sampleCenter.y.toFixed(3)}:${sampleCenter.z.toFixed(3)}`;
    if (key === lastPlaneKey.current) return;
    lastPlaneKey.current = key;

    updateMriSliceTexture(mriTex, volume, cutPlane, { displayScale }, {
      resolution: texRes,
      radius: capRadius,
      window: windowLevel,
      level,
      isoFloor: iso - 0.04,
      volMin: volume.min,
      volMax: volume.max,
      center: sampleCenter,
    });
  });

  return (
    <group ref={groupRef} renderOrder={2}>
      <mesh material={sliceMat}>
        <circleGeometry args={[capRadius, segs]} />
      </mesh>
      <mesh material={rimMat} position={[0, 0, 0.001]}>
        <ringGeometry args={[capRadius, capRadius + rimWidth, segs]} />
      </mesh>
    </group>
  );
}
