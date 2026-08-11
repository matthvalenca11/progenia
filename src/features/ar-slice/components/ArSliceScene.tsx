import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ClipPlaneController } from "@/features/ar-slice/components/ClipPlaneController";
import { TouchReferenceAdjust } from "@/features/ar-slice/components/TouchReferenceAdjust";
import { poseBuffer, useArSliceStore } from "@/features/ar-slice/arSliceStore";
import { useArSliceMriVolume } from "@/features/ar-slice/mri/useArSliceMriVolume";
import { AR_SLICE_CAMERA } from "@/features/ar-slice/arSliceSceneConfig";
import { frameTrackBuffer } from "@/features/ar-slice/vision/frameTrackBuffer";
import { isNativeMobile } from "@/lib/labPerformance";

const MEDICAL_ORBIT_FOV_DEG = 3;
const LEGACY_ORBIT_FOV_DEG = 42;
const ORBIT_DISTANCE_SCALE =
  Math.tan((LEGACY_ORBIT_FOV_DEG * Math.PI) / 360) /
  Math.tan((MEDICAL_ORBIT_FOV_DEG * Math.PI) / 360);

function ClearColorSync({ transparent }: { transparent: boolean }) {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    // onCreated only runs once; AR mode toggles after mount and must reopen
    // the alpha channel so ARKit's camera can show through WKWebView.
    gl.setClearColor(0x000000, transparent ? 0 : 1);
    gl.domElement.style.background = "transparent";
    // Conditional <color attach="background"> leaves scene.background set after
    // AR turns on — an opaque Scene background hides the live camera feed.
    scene.background = transparent ? null : new THREE.Color("#000000");
  }, [gl, scene, transparent]);
  return null;
}

/** Keep the Three.js camera coincident with the phone so ARKit view-space
 * hologram poses land in the center of the live camera image. */
function ArCameraLock({ active }: { active: boolean }) {
  const { camera } = useThree();
  useFrame(() => {
    if (!active) return;
    camera.position.set(0, 0, 0);
    camera.quaternion.identity();
    camera.up.set(0, 1, 0);
    if (camera instanceof THREE.PerspectiveCamera) {
      const fov = frameTrackBuffer.fovYDeg;
      if (Math.abs(camera.fov - fov) > 0.15) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }
    camera.updateMatrixWorld();
  });
  return null;
}

function TelemetryTicker() {
  const setTelemetry = useArSliceStore((s) => s.setTelemetry);
  const frames = useRef(0);
  const last = useRef(performance.now());

  useFrame(() => {
    frames.current += 1;
    const now = performance.now();
    if (now - last.current >= 1000) {
      const fps = (frames.current * 1000) / (now - last.current);
      setTelemetry(fps, poseBuffer.packetAgeMs, poseBuffer.sampleHz);
      frames.current = 0;
      last.current = now;
    }
  });

  return null;
}

function CameraRig({
  enabled,
  allowRotate,
}: {
  enabled: boolean;
  /** When false, only pinch-zoom — BLE owns orientation of the cut. */
  allowRotate: boolean;
}) {
  const cameraDistance = useArSliceStore((s) => s.cameraDistance);
  const setCameraDistance = useArSliceStore((s) => s.setCameraDistance);
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const syncing = useRef(false);
  const lastStoreDist = useRef(cameraDistance);
  const didInit = useRef(false);
  const target = useRef(new THREE.Vector3(0, 0, 0));
  const offset = useRef(new THREE.Vector3());

  // useLayoutEffect so the first useFrame cannot see the camera at the origin
  // and clamp store zoom down to AR_SLICE_CAMERA.min.
  useLayoutEffect(() => {
    if (didInit.current) return;
    camera.position.set(0, 0.06, cameraDistance * ORBIT_DISTANCE_SCALE);
    camera.lookAt(target.current);
    lastStoreDist.current = cameraDistance;
    didInit.current = true;
    controlsRef.current?.update();
  }, [camera, cameraDistance]);

  /** Slider / store zoom — preserve orbit angle, only change distance. */
  useLayoutEffect(() => {
    if (!didInit.current || syncing.current) return;
    if (Math.abs(cameraDistance - lastStoreDist.current) < 0.01) return;

    syncing.current = true;
    const controls = controlsRef.current;
    offset.current.subVectors(camera.position, target.current);
    const len = offset.current.length();
    if (len > 1e-4) {
      camera.position.copy(target.current).add(
        offset.current
          .normalize()
          .multiplyScalar(cameraDistance * ORBIT_DISTANCE_SCALE),
      );
    } else {
      camera.position.set(0, 0.06, cameraDistance * ORBIT_DISTANCE_SCALE);
    }
    controls?.update();
    lastStoreDist.current = cameraDistance;
    syncing.current = false;
  }, [camera, cameraDistance]);

  // Reset view to a stable frontal look when BLE takes over orientation.
  useLayoutEffect(() => {
    if (allowRotate || !didInit.current) return;
    camera.position.set(
      0,
      0.06,
      lastStoreDist.current * ORBIT_DISTANCE_SCALE,
    );
    camera.lookAt(target.current);
    camera.up.set(0, 1, 0);
    controlsRef.current?.update();
  }, [allowRotate, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={enabled}
      target={[0, 0, 0]}
      enablePan={false}
      enableRotate={allowRotate}
      enableZoom
      minDistance={AR_SLICE_CAMERA.min * ORBIT_DISTANCE_SCALE}
      maxDistance={AR_SLICE_CAMERA.max * ORBIT_DISTANCE_SCALE}
      minPolarAngle={Math.PI * 0.15}
      maxPolarAngle={Math.PI * 0.58}
      // Damping on iOS keeps rewriting matrices every frame → subtle hitch.
      enableDamping={!isNativeMobile}
      dampingFactor={0.06}
      rotateSpeed={isNativeMobile ? 0.95 : 1}
      zoomSpeed={isNativeMobile ? 0.85 : 1}
      // ONE finger: orbit only when allowRotate; otherwise TouchReferenceAdjust
      // owns the drag. TWO fingers always pinch-zoom.
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY }}
      onEnd={() => {
        // Commit zoom once per gesture instead of every animation frame.
        const controls = controlsRef.current;
        if (!controls) return;
        const dist =
          camera.position.distanceTo(controls.target) / ORBIT_DISTANCE_SCALE;
        const clamped = Math.min(
          AR_SLICE_CAMERA.max,
          Math.max(AR_SLICE_CAMERA.min, dist),
        );
        if (Math.abs(clamped - lastStoreDist.current) < 0.05) return;
        lastStoreDist.current = clamped;
        setCameraDistance(clamped);
      }}
    />
  );
}

export function ArSliceScene({ transparent = false }: { transparent?: boolean }) {
  useArSliceMriVolume();
  const frameTrackingEnabled = useArSliceStore((s) => s.frameTrackingEnabled);
  const frameTrackState = useArSliceStore((s) => s.frameTrackState);
  const connectionState = useArSliceStore((s) => s.connectionState);
  const frameLocked = frameTrackingEnabled && frameTrackState === "locked";
  const mixedReality = transparent;
  // With the moldura live, finger-orbit fights the IMU reference frame.
  const bleLive =
    connectionState === "streaming" || connectionState === "connected";

  return (
    <>
      <ClearColorSync transparent={transparent} />
      <ArCameraLock active={mixedReality} />
      {!transparent && <color attach="background" args={["#000000"]} />}
      {/* Infinite grid is expensive on mobile GPUs; keep it for desktop only. */}
      {!transparent && !isNativeMobile && (
        <Grid
          infiniteGrid
          fadeDistance={14}
          fadeStrength={1.2}
          cellSize={0.2}
          sectionSize={1}
          cellColor="#334155"
          sectionColor="#94a3b8"
          position={[0, -1.35, 0]}
        />
      )}
      {/* Do not pass position here — it resets OrbitControls every React render. */}
      <PerspectiveCamera
        makeDefault
        fov={MEDICAL_ORBIT_FOV_DEG}
        near={0.05}
        far={500}
        position={[
          0,
          0.06,
          AR_SLICE_CAMERA.default * ORBIT_DISTANCE_SCALE,
        ]}
      />
      <ambientLight intensity={isNativeMobile ? 0.95 : 0.85} />
      <directionalLight position={[2, 3, 4]} intensity={isNativeMobile ? 0.35 : 0.45} />
      {!isNativeMobile && <directionalLight position={[-3, 1, -2]} intensity={0.2} />}
      <ClipPlaneController />
      <CameraRig
        enabled={!mixedReality && !frameLocked}
        allowRotate={!bleLive}
      />
      {/* Finger drag: live retunes brain; frozen orbits brain + aro together. */}
      <TouchReferenceAdjust enabled={bleLive && !mixedReality} />
      <TelemetryTicker />
    </>
  );
}
