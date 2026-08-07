import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ClipPlaneController } from "@/features/ar-slice/components/ClipPlaneController";
import { poseBuffer, useArSliceStore } from "@/features/ar-slice/arSliceStore";
import { useArSliceMriVolume } from "@/features/ar-slice/mri/useArSliceMriVolume";
import { AR_SLICE_CAMERA } from "@/features/ar-slice/arSliceSceneConfig";
import { isAndroidNative, isNativeMobile } from "@/lib/labPerformance";

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

function CameraRig({ enabled }: { enabled: boolean }) {
  const cameraDistance = useArSliceStore((s) => s.cameraDistance);
  const setCameraDistance = useArSliceStore((s) => s.setCameraDistance);
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const syncing = useRef(false);
  const lastStoreDist = useRef(cameraDistance);
  const didInit = useRef(false);
  const target = useRef(new THREE.Vector3(0, 0, 0));
  const offset = useRef(new THREE.Vector3());

  useEffect(() => {
    if (didInit.current) return;
    camera.position.set(0, 0.06, cameraDistance);
    lastStoreDist.current = cameraDistance;
    didInit.current = true;
  }, [camera, cameraDistance]);

  /** Slider / store zoom — preserve orbit angle, only change distance. */
  useEffect(() => {
    if (!didInit.current || syncing.current) return;
    if (Math.abs(cameraDistance - lastStoreDist.current) < 0.01) return;

    syncing.current = true;
    const controls = controlsRef.current;
    offset.current.subVectors(camera.position, target.current);
    const len = offset.current.length();
    if (len > 1e-4) {
      camera.position.copy(target.current).add(
        offset.current.normalize().multiplyScalar(cameraDistance),
      );
    } else {
      camera.position.set(0, 0.06, cameraDistance);
    }
    controls?.update();
    lastStoreDist.current = cameraDistance;
    syncing.current = false;
  }, [camera, cameraDistance]);

  useFrame(() => {
    if (!enabled || syncing.current) return;
    const controls = controlsRef.current;
    if (!controls) return;
    const dist = camera.position.distanceTo(controls.target);
    const clamped = Math.min(AR_SLICE_CAMERA.max, Math.max(AR_SLICE_CAMERA.min, dist));
    if (Math.abs(clamped - lastStoreDist.current) > 0.06) {
      lastStoreDist.current = clamped;
      setCameraDistance(clamped);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={enabled}
      target={[0, 0, 0]}
      enablePan={false}
      enableRotate
      enableZoom
      minDistance={AR_SLICE_CAMERA.min}
      maxDistance={AR_SLICE_CAMERA.max}
      minPolarAngle={Math.PI * 0.15}
      maxPolarAngle={Math.PI * 0.58}
      enableDamping={!isAndroidNative}
      dampingFactor={0.06}
      rotateSpeed={isNativeMobile ? 0.95 : 1}
      zoomSpeed={isNativeMobile ? 0.85 : 1}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY,
      }}
    />
  );
}

export function ArSliceScene({ transparent = false }: { transparent?: boolean }) {
  useArSliceMriVolume();
  const frameLocked =
    useArSliceStore((s) => s.frameTrackingEnabled) &&
    useArSliceStore((s) => s.frameTrackState) === "locked";

  return (
    <>
      {!transparent && <color attach="background" args={["#000000"]} />}
      {!transparent && (
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
      <PerspectiveCamera makeDefault fov={36} near={0.1} far={100} />
      <ambientLight intensity={isNativeMobile ? 0.95 : 0.85} />
      <directionalLight position={[2, 3, 4]} intensity={isNativeMobile ? 0.35 : 0.45} />
      {!isNativeMobile && <directionalLight position={[-3, 1, -2]} intensity={0.2} />}
      <ClipPlaneController />
      <CameraRig enabled={!frameLocked} />
      <TelemetryTicker />
    </>
  );
}
