import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { AR_SLICE_CUT_CAP } from "@/features/ar-slice/arSliceSceneConfig";
import { poseBuffer, tickPoseBuffer, useArSliceStore } from "@/features/ar-slice/arSliceStore";
import { frameFrontNormal } from "@/features/ar-slice/poseMath";
import { buildSlicePlanes, projectPointOntoPlane } from "@/features/ar-slice/slicePlaneMath";
import { AnatomicalHead } from "@/features/ar-slice/components/AnatomicalHead";
import { MriVolumeHead } from "@/features/ar-slice/components/MriVolumeHead";
import { CutCap } from "@/features/ar-slice/components/CutCap";
import { DebugCube } from "@/features/ar-slice/components/DebugCube";
import { useArSliceMriStore } from "@/features/ar-slice/mri/arSliceMriStore";
import { frameTrackBuffer } from "@/features/ar-slice/vision/frameTrackBuffer";

/**
 * Vision anchors the model in the physical moldura (pose/scale).
 * BLE drives the cut-plane orientation (high-rate IMU) without multiplying
 * vision rotation — that would double-count tilt.
 */
export function ClipPlaneController() {
  const { gl } = useThree();
  const depthOffset = useArSliceStore((s) => s.depthOffset);
  const autoSliceFromGravity = useArSliceStore((s) => s.autoSliceFromGravity);
  const mriVolume = useArSliceMriStore((s) => s.volume);
  const showDebugCube = useArSliceStore((s) => s.showDebugCube);
  const frameTrackingEnabled = useArSliceStore((s) => s.frameTrackingEnabled);

  const cutPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), []);
  const contentRef = useRef<THREE.Group>(null);
  const brainCenter = useMemo(() => new THREE.Vector3(), []);
  const worldNormal = useMemo(() => new THREE.Vector3(), []);
  const capCenter = useMemo(() => new THREE.Vector3(), []);
  const capRender = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    gl.localClippingEnabled = false;
    gl.clippingPlanes = [clipPlane];
    return () => {
      gl.clippingPlanes = [];
    };
  }, [gl, clipPlane]);

  useFrame(() => {
    tickPoseBuffer();

    const bleQ = poseBuffer.display;
    const tracked =
      frameTrackingEnabled && frameTrackBuffer.pose && frameTrackBuffer.state === "locked";

    const n = frameFrontNormal(bleQ);
    worldNormal.set(n.x, n.y, n.z).normalize();

    if (contentRef.current) {
      if (tracked && frameTrackBuffer.pose) {
        const p = frameTrackBuffer.pose;
        contentRef.current.position.set(p.position.x, p.position.y, p.position.z);
        contentRef.current.quaternion.set(
          p.quaternion.x,
          p.quaternion.y,
          p.quaternion.z,
          p.quaternion.w,
        );
        contentRef.current.scale.setScalar(p.scale);
      } else {
        contentRef.current.position.set(0, 0, 0);
        contentRef.current.quaternion.identity();
        contentRef.current.scale.setScalar(1);
      }
      contentRef.current.getWorldPosition(brainCenter);
    } else {
      brainCenter.set(0, 0, 0);
    }

    const autoDepth = autoSliceFromGravity ? poseBuffer.sliceScrollDepth : 0;
    const sliceLevel = depthOffset + autoDepth;

    const planes = buildSlicePlanes(worldNormal, brainCenter, sliceLevel);

    cutPlane.normal.set(planes.cut.normal.x, planes.cut.normal.y, planes.cut.normal.z);
    cutPlane.constant = planes.cut.constant;
    clipPlane.normal.set(planes.clip.normal.x, planes.clip.normal.y, planes.clip.normal.z);
    clipPlane.constant = planes.clip.constant;

    projectPointOntoPlane(
      brainCenter,
      { x: cutPlane.normal.x, y: cutPlane.normal.y, z: cutPlane.normal.z },
      cutPlane.constant,
      capCenter,
    );
    // Bias into the kept half-space (away from camera) so the cap is not clipped away.
    capRender.copy(capCenter).addScaledVector(cutPlane.normal, -AR_SLICE_CUT_CAP.planeEpsilon);
  });

  return (
    <>
      <group ref={contentRef}>
        {mriVolume ? <MriVolumeHead /> : <AnatomicalHead />}
        <DebugCube visible={showDebugCube} />
      </group>
      <CutCap cutPlane={cutPlane} renderAnchor={capRender} sampleCenter={capCenter} />
    </>
  );
}
