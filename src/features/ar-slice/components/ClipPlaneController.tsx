import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { isNativeMobile } from "@/lib/labPerformance";
import { AR_SLICE_CUT_CAP } from "@/features/ar-slice/arSliceSceneConfig";
import {
  getAppliedPose,
  tickPoseBuffer,
  useArSliceStore,
} from "@/features/ar-slice/arSliceStore";
import { buildSlicePlanes } from "@/features/ar-slice/slicePlaneMath";
import { AnatomicalHead } from "@/features/ar-slice/components/AnatomicalHead";
import { MriVolumeHead } from "@/features/ar-slice/components/MriVolumeHead";
import { CutCap } from "@/features/ar-slice/components/CutCap";
import { DebugCube } from "@/features/ar-slice/components/DebugCube";
import { touchReference } from "@/features/ar-slice/touchReference";
import { useArSliceMriStore } from "@/features/ar-slice/mri/arSliceMriStore";
import { frameTrackBuffer } from "@/features/ar-slice/vision/frameTrackBuffer";
import { frameCutBasis } from "@/features/ar-slice/poseMath";

const HOLOGRAM_FALLBACK_Z = -0.7;
const HOLOGRAM_FALLBACK_SCALE = 0.28;

/**
 * Vision anchors the model in the physical moldura (pose/scale).
 * BLE drives the cut-plane orientation (high-rate IMU) without multiplying
 * vision rotation — that would double-count tilt.
 */
export function ClipPlaneController() {
  const { gl, camera } = useThree();
  const depthOffset = useArSliceStore((s) => s.depthOffset);
  const autoSliceFromGravity = useArSliceStore((s) => s.autoSliceFromGravity);
  const visualStyle = useArSliceStore((s) => s.visualStyle);
  const mriVolume = useArSliceMriStore((s) => s.volume);
  const medicalVolumeLoading = useArSliceMriStore((s) => s.loading);
  const showDebugCube = useArSliceStore((s) => s.showDebugCube);
  const frameTrackingEnabled = useArSliceStore((s) => s.frameTrackingEnabled);
  const hologram = visualStyle === "hologram";

  const cutPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), []);
  const contentRef = useRef<THREE.Group>(null);
  const poseSnapNeeded = useRef(true);
  const brainCenter = useMemo(() => new THREE.Vector3(), []);
  const worldNormal = useMemo(() => new THREE.Vector3(), []);
  const capCenter = useMemo(() => new THREE.Vector3(), []);
  const capRender = useMemo(() => new THREE.Vector3(), []);
  const visualTarget = useMemo(() => new THREE.Vector3(), []);
  const visualTargetQ = useMemo(() => new THREE.Quaternion(), []);
  const visualPoseQ = useMemo(() => new THREE.Quaternion(), []);
  const touchOffsetQ = useMemo(() => new THREE.Quaternion(), []);
  const visualTargetScale = useMemo(() => new THREE.Vector3(), []);
  const contentWorldScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  useEffect(() => {
    poseSnapNeeded.current = true;
    const group = contentRef.current;
    if (!group || !frameTrackingEnabled) return;
    // Seed in front of the phone immediately — lerping from (0,0,0)/scale 1
    // puts the camera inside the volume cube and the raymarch draws nothing.
    group.position.set(0, -0.02, HOLOGRAM_FALLBACK_Z);
    group.quaternion.identity();
    group.scale.setScalar(HOLOGRAM_FALLBACK_SCALE);
  }, [frameTrackingEnabled]);

  useEffect(() => {
    // Solid hologram / procedural head use material clippingPlanes. MRI volume
    // clips inside its raymarch shader — avoid a second global plane on it.
    const useSolidClip = !mriVolume || (hologram && frameTrackingEnabled);
    gl.localClippingEnabled = useSolidClip;
    gl.clippingPlanes = [];
    return () => {
      gl.localClippingEnabled = false;
      gl.clippingPlanes = [];
    };
  }, [gl, mriVolume, hologram, frameTrackingEnabled]);

  useFrame(() => {
    tickPoseBuffer();

    const applied = getAppliedPose();
    const tracked =
      frameTrackingEnabled && frameTrackBuffer.pose && frameTrackBuffer.state === "locked";

    // Gyro → cut normal: sensor +Z is the aro axis (same basis as CutCap).
    const cutBasis = frameCutBasis(applied.display);
    worldNormal
      .set(cutBasis.normal.x, cutBasis.normal.y, cutBasis.normal.z)
      .normalize();

    if (contentRef.current) {
      // Finger drag: live → brain only; frozen → brain + aro (via getAppliedPose).
      const tq = touchReference.getQuat();
      touchOffsetQ.set(tq.x, tq.y, tq.z, tq.w);

      const hasVisualAnchor =
        frameTrackingEnabled &&
        frameTrackBuffer.pose &&
        (frameTrackBuffer.state === "locked" || frameTrackBuffer.state === "lost");
      if (hasVisualAnchor && frameTrackBuffer.pose) {
        const p = frameTrackBuffer.pose;
        // View-space pose → world via the (AR-locked) Three.js camera.
        visualTarget
          .set(p.position.x, p.position.y, p.position.z)
          .applyMatrix4(camera.matrixWorld);
        if (p.source === "hand" || p.source === "arkit") {
          // Keep the anatomy facing the user. BLE alone drives the cut plane.
          visualTargetQ.copy(camera.quaternion);
        } else {
          visualPoseQ.set(
            p.quaternion.x,
            p.quaternion.y,
            p.quaternion.z,
            p.quaternion.w,
          );
          visualTargetQ.copy(camera.quaternion).multiply(visualPoseQ);
        }
        visualTargetQ.multiply(touchOffsetQ);
        visualTargetScale.setScalar(p.scale);
        const dist = contentRef.current.position.distanceTo(visualTarget);
        const scaleDelta = Math.abs(
          contentRef.current.scale.x - visualTargetScale.x,
        );
        // Snap when AR starts or when still near the origin — lerp from scale 1
        // at (0,0,0) leaves the camera inside the MRI cube (invisible).
        if (
          poseSnapNeeded.current ||
          dist > 0.45 ||
          scaleDelta > 0.35 ||
          contentRef.current.position.lengthSq() < 1e-4
        ) {
          contentRef.current.position.copy(visualTarget);
          contentRef.current.quaternion.copy(visualTargetQ);
          contentRef.current.scale.copy(visualTargetScale);
          poseSnapNeeded.current = false;
        } else {
          const alpha = p.source === "arkit" ? 0.65 : 0.12;
          contentRef.current.position.lerp(visualTarget, alpha);
          // Touch reference must feel immediate — don't lag the finger offset.
          contentRef.current.quaternion.copy(visualTargetQ);
          contentRef.current.scale.lerp(visualTargetScale, alpha);
        }
      } else if (frameTrackingEnabled) {
        visualTarget
          .set(0, -0.02, HOLOGRAM_FALLBACK_Z)
          .applyMatrix4(camera.matrixWorld);
        visualTargetQ.copy(camera.quaternion).multiply(touchOffsetQ);
        visualTargetScale.setScalar(HOLOGRAM_FALLBACK_SCALE);
        contentRef.current.position.copy(visualTarget);
        contentRef.current.quaternion.copy(visualTargetQ);
        contentRef.current.scale.copy(visualTargetScale);
        poseSnapNeeded.current = false;
      } else {
        visualTarget.set(0, 0, 0);
        visualTargetQ.copy(touchOffsetQ);
        visualTargetScale.setScalar(1);
        contentRef.current.position.lerp(visualTarget, 0.12);
        contentRef.current.quaternion.copy(visualTargetQ);
        contentRef.current.scale.lerp(visualTargetScale, 0.12);
        poseSnapNeeded.current = true;
      }
      contentRef.current.getWorldScale(contentWorldScale);
      contentRef.current.getWorldPosition(brainCenter);
    } else {
      brainCenter.set(0, 0, 0);
      contentWorldScale.set(1, 1, 1);
    }

    // Gyro → cut orientation. Accel (one axis) + gravity/manual → depth along normal.
    const trackedScale = tracked ? contentWorldScale.x : 1;
    const sliceDepth =
      (depthOffset +
        (autoSliceFromGravity ? applied.gravityScrollDepth : 0) +
        applied.linearGestureDepth) *
      trackedScale;
    const planes = buildSlicePlanes(worldNormal, brainCenter, sliceDepth);

    cutPlane.normal.set(planes.cut.normal.x, planes.cut.normal.y, planes.cut.normal.z);
    cutPlane.constant = planes.cut.constant;
    clipPlane.normal.set(planes.clip.normal.x, planes.clip.normal.y, planes.clip.normal.z);
    clipPlane.constant = planes.clip.constant;

    // Aro sits on the cut — moves with depth along the moldura normal.
    capCenter.set(planes.anchor.x, planes.anchor.y, planes.anchor.z);
    // Bias into the kept half-space (away from camera) so the cap is not clipped away.
    capRender.copy(capCenter).addScaledVector(cutPlane.normal, -AR_SLICE_CUT_CAP.planeEpsilon);
  });

  // On iOS AR the hologram is drawn natively in ARSCNView (WebGL volumes do not
  // composite through WKWebView). Keep this canvas empty so the SceneKit head shows.
  const nativeArHologram = isNativeMobile && frameTrackingEnabled && hologram;
  const forceSolidHologram = hologram && frameTrackingEnabled && !nativeArHologram;
  const showSolidHead =
    !nativeArHologram &&
    !medicalVolumeLoading &&
    (!mriVolume || forceSolidHologram);
  const showMriVolume = !!mriVolume && !forceSolidHologram && !nativeArHologram;
  const solidClipPlanes = showSolidHead ? [clipPlane] : [];

  return (
    <>
      <group ref={contentRef} visible={!nativeArHologram}>
        {showSolidHead && (
          <AnatomicalHead clippingPlanes={solidClipPlanes} hologram={hologram} />
        )}
        {showMriVolume && (
          <MriVolumeHead clipPlane={clipPlane} />
        )}
        <DebugCube visible={showDebugCube} />
      </group>
      {!nativeArHologram && (
        <CutCap
          cutPlane={cutPlane}
          renderAnchor={capRender}
          sampleCenter={capCenter}
          renderScale={contentWorldScale}
          volumeRootRef={contentRef}
        />
      )}
    </>
  );
}
