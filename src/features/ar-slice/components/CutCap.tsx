import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { isNativeMobile } from "@/lib/labPerformance";
import {
  MEDICAL_VOLUME_PRESETS,
  useArSliceMriStore,
} from "@/features/ar-slice/mri/arSliceMriStore";
import {
  createMriSliceTexture,
  updateMriSliceTexture,
} from "@/features/ar-slice/mri/sliceTexture";
import { cutCapRadius } from "@/features/ar-slice/arSliceSceneConfig";
import { createBrainSliceTexture } from "@/features/ar-slice/components/medicalVolumeStyle";
import {
  getAppliedPose,
  poseBuffer,
  useArSliceStore,
} from "@/features/ar-slice/arSliceStore";
import { AR_SLICE_IMU } from "@/features/ar-slice/arSliceSceneConfig";
import { frameCutBasis } from "@/features/ar-slice/poseMath";
import { touchReference } from "@/features/ar-slice/touchReference";
import { computeDisplayHalfExtents } from "@/features/ar-slice/mri/volumeSampling";

type CutCapProps = {
  cutPlane: THREE.Plane;
  /** World position of the disc (slightly biased toward camera to avoid z-fight). */
  renderAnchor: THREE.Vector3;
  /** Exact intersection center — used for MRI resampling (matches clip plane). */
  sampleCenter: THREE.Vector3;
  /** World scale shared with the tracked medical volume. */
  renderScale: THREE.Vector3;
  /** Anatomy root — sample MRI in this local frame when finger retunes orientation. */
  volumeRootRef?: RefObject<THREE.Group | null>;
};

/**
 * Cap on the clipping plane — real oblique slice of the selected volume,
 * procedural fallback while no medical volume is loaded.
 */
export function CutCap({
  cutPlane,
  renderAnchor,
  sampleCenter,
  renderScale,
  volumeRootRef,
}: CutCapProps) {
  const groupRef = useRef<THREE.Group>(null);
  const volume = useArSliceMriStore((s) => s.volume);
  const volumeLoading = useArSliceMriStore((s) => s.loading);
  const overlayVolume = useArSliceMriStore((s) => s.overlayVolume);
  const displayScale = useArSliceMriStore((s) => s.displayScale);
  const windowLevel = useArSliceMriStore((s) => s.window);
  const level = useArSliceMriStore((s) => s.level);
  const overlayWindow = useArSliceMriStore((s) => s.overlayWindow);
  const overlayLevel = useArSliceMriStore((s) => s.overlayLevel);
  const activeModality = useArSliceMriStore((s) => s.activeModality);
  const volumePreset = MEDICAL_VOLUME_PRESETS[activeModality];
  const visualStyle = useArSliceStore((s) => s.visualStyle);
  const hologram = visualStyle === "hologram";

  const segs = isNativeMobile ? 28 : 72;
  const capRadius = cutCapRadius(displayScale, !!volume);
  const rimWidth = capRadius * 0.045;
  // Preserve diagnostic detail on the cut itself. Rebuilds remain throttled
  // below, so the larger texture does not run on every BLE packet.
  const texRes = isNativeMobile
    ? activeModality === "mri"
      ? 160
      : 224
    : 512;

  const tmpNormal = useMemo(() => new THREE.Vector3(), []);
  const tmpTangent = useMemo(() => new THREE.Vector3(), []);
  const tmpBitangent = useMemo(() => new THREE.Vector3(), []);
  const basisMatrix = useMemo(() => new THREE.Matrix4(), []);
  const volumeWorldInverse = useMemo(() => new THREE.Matrix4(), []);
  const lastPlaneKey = useRef("");
  const pendingKey = useRef<string | null>(null);
  const lastTextureUpdateAt = useRef(0);
  const rebuildTimer = useRef(0);
  const cutPlaneRef = useRef(cutPlane);
  const sampleCenterRef = useRef(sampleCenter);
  const renderScaleRef = useRef(renderScale);
  const volumeWorldInverseRef = useRef<THREE.Matrix4 | null>(null);
  const sliceTangentRef = useRef(new THREE.Vector3(1, 0, 0));
  const sliceBitangentRef = useRef(new THREE.Vector3(0, 1, 0));
  cutPlaneRef.current = cutPlane;
  sampleCenterRef.current = sampleCenter;
  renderScaleRef.current = renderScale;

  const fallbackTex = useMemo(() => createBrainSliceTexture(texRes), [texRes]);
  const mriTex = useMemo(() => createMriSliceTexture(texRes), [texRes]);

  const useRealMri = !!volume;

  const sliceMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: useRealMri ? mriTex : fallbackTex,
        color: hologram ? "#35d9ff" : "#ffffff",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: hologram ? 0.88 : 0.98,
        depthWrite: !hologram,
        blending: THREE.NormalBlending,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: 1,
      }),
    [useRealMri, mriTex, fallbackTex, hologram],
  );

  const rimMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: hologram ? "#40e6ff" : "#e2e8f0",
        side: THREE.DoubleSide,
        transparent: hologram,
        opacity: hologram ? 0.82 : 1,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [hologram],
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
      if (rebuildTimer.current) window.clearTimeout(rebuildTimer.current);
    };
  }, [fallbackTex, mriTex, sliceMat, rimMat]);

  useEffect(() => {
    lastPlaneKey.current = "";
    pendingKey.current = null;
  }, [volume]);

  const scheduleTextureRebuild = (key: string, worldRadius: number) => {
    pendingKey.current = key;
    if (rebuildTimer.current) return;
    // Yield past the current rAF so coalesced BLE samples flush first.
    rebuildTimer.current = window.setTimeout(() => {
      rebuildTimer.current = 0;
      const nextKey = pendingKey.current;
      pendingKey.current = null;
      // Allow rebuild while frozen so finger-orbit keeps the MRI slice in sync.
      if (!nextKey || !volume) return;
      if (nextKey === lastPlaneKey.current) return;
      const now = performance.now();
      // If BLE is already starving, wait — never rebuild on a cold stream.
      const bleStarving = isNativeMobile && poseBuffer.packetAgeMs > 220;
      const tooSoon = isNativeMobile && now - lastTextureUpdateAt.current < 90;
      if (bleStarving || tooSoon) {
        pendingKey.current = nextKey;
        const wait = bleStarving
          ? 100
          : Math.max(8, 90 - (now - lastTextureUpdateAt.current));
        rebuildTimer.current = window.setTimeout(() => {
          rebuildTimer.current = 0;
          if (pendingKey.current) {
            scheduleTextureRebuild(pendingKey.current, worldRadius);
          }
        }, wait);
        return;
      }
      lastPlaneKey.current = nextKey;
      lastTextureUpdateAt.current = now;
      updateMriSliceTexture(mriTex, volume, cutPlaneRef.current, {
        displayScale,
        halfExtents: computeDisplayHalfExtents(volume, displayScale),
      }, {
        resolution: texRes,
        radius: worldRadius,
        window: windowLevel,
        level,
        isoFloor: volumePreset.isoFloor,
        volMin: volume.min,
        volMax: volume.max,
        colorMap: volumePreset.colorMap,
        overlay: overlayVolume
          ? {
              volume: overlayVolume,
              window: overlayWindow,
              level: overlayLevel,
              isoFloor: MEDICAL_VOLUME_PRESETS.pet.isoFloor,
              colorMap: "pet",
              opacity: 0.78,
            }
          : undefined,
        center: sampleCenterRef.current,
        worldToVolume: volumeWorldInverseRef.current,
        tangent: sliceTangentRef.current,
        bitangent: sliceBitangentRef.current,
      });
    }, 0);
  };

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    // Full IMU basis — sensor +Z is the aro normal (disc stays flat under Z spin).
    const q = getAppliedPose().display;
    const basis = frameCutBasis(q, AR_SLICE_IMU.invertInPlaneSpin);
    tmpNormal.set(basis.normal.x, basis.normal.y, basis.normal.z).normalize();
    tmpTangent.set(basis.tangent.x, basis.tangent.y, basis.tangent.z).normalize();
    tmpBitangent
      .set(basis.bitangent.x, basis.bitangent.y, basis.bitangent.z)
      .normalize();
    // The narrow medical camera lens intentionally has little perspective.
    // Add a subtle scale cue so a slice tipped toward the viewer reads as
    // closer without distorting the anatomy while finger-orbiting.
    const depthCueScale = 1 + tmpNormal.z * 0.08;
    // Optional in-plane roll about Z (does not tip the disc).
    const rollDeg = AR_SLICE_IMU.cutInPlaneRollDeg;
    if (rollDeg !== 0) {
      const rad = (rollDeg * Math.PI) / 180;
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      const tx = tmpTangent.x;
      const ty = tmpTangent.y;
      const tz = tmpTangent.z;
      const bx = tmpBitangent.x;
      const by = tmpBitangent.y;
      const bz = tmpBitangent.z;
      tmpTangent.set(tx * c - bx * s, ty * c - by * s, tz * c - bz * s).normalize();
      tmpBitangent.set(tx * s + bx * c, ty * s + by * c, tz * s + bz * c).normalize();
    }
    // IMU basis is authority (sensor +Z = aro normal). Do not rematch cutPlane
    // with world-up — that flips tip sense and drops in-plane Z spin.
    sliceTangentRef.current.copy(tmpTangent);
    sliceBitangentRef.current.copy(tmpBitangent);
    basisMatrix.makeBasis(tmpTangent, tmpBitangent, tmpNormal);
    group.position.copy(renderAnchor);
    group.quaternion.setFromRotationMatrix(basisMatrix);
    group.scale.copy(renderScale).multiplyScalar(depthCueScale);

    const root = volumeRootRef?.current;
    if (root) {
      root.updateWorldMatrix(true, false);
      volumeWorldInverse.copy(root.matrixWorld).invert();
      volumeWorldInverseRef.current = volumeWorldInverse;
    } else {
      volumeWorldInverseRef.current = null;
    }

    if (!volume) return;

    const worldRadius = capRadius * renderScale.x * depthCueScale;
    const tq = touchReference.getQuat();
    const dq = getAppliedPose().display;
    const key = `${tmpNormal.x.toFixed(2)}:${tmpNormal.y.toFixed(2)}:${tmpNormal.z.toFixed(2)}:${tmpTangent.x.toFixed(2)}:${tmpTangent.y.toFixed(2)}:${tmpBitangent.x.toFixed(2)}:${cutPlane.constant.toFixed(3)}:${sampleCenter.x.toFixed(2)}:${sampleCenter.y.toFixed(2)}:${sampleCenter.z.toFixed(2)}:${worldRadius.toFixed(3)}:${depthCueScale.toFixed(2)}:${tq.x.toFixed(3)}:${tq.y.toFixed(3)}:${tq.z.toFixed(3)}:${tq.w.toFixed(3)}:${dq.w.toFixed(3)}:${dq.z.toFixed(3)}:${renderAnchor.x.toFixed(2)}:${renderAnchor.y.toFixed(2)}:${renderAnchor.z.toFixed(2)}`;
    if (key === lastPlaneKey.current || key === pendingKey.current) return;
    scheduleTextureRebuild(key, worldRadius);
  });

  if (volumeLoading && !volume) return null;

  return (
    <group ref={groupRef} renderOrder={2}>
      <mesh material={sliceMat} renderOrder={3}>
        <circleGeometry args={[capRadius, segs]} />
      </mesh>
      <mesh material={rimMat} position={[0, 0, -0.003]} renderOrder={10}>
        <ringGeometry args={[capRadius, capRadius + rimWidth, segs]} />
      </mesh>
    </group>
  );
}
