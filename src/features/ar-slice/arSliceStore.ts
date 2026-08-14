import { create } from "zustand";
import { Preferences } from "@capacitor/preferences";
import { AR_SLICE_CAMERA, AR_SLICE_IMU } from "@/features/ar-slice/arSliceSceneConfig";
import type { OrientationSample, Quaternion } from "@/features/ar-slice/ble/protocol";
import type { BleConnectionState, BleDeviceInfo } from "@/features/ar-slice/ble/types";
import {
  IDENTITY_QUAT,
  MOUNT_PRESETS,
  type MountPresetId,
  applyMountAndZero,
  frameCutBasis,
  frameFrontNormal,
  gravityInFrame,
  quatFromAxisAngle,
  quatConjugate,
  quatMultiply,
  quatNormalize,
  quatSlerp,
  quatSwingTwist,
  resetSlicePitchZero,
  suggestMountPresetFromFlatGravity,
} from "@/features/ar-slice/poseMath";
import {
  gyroMagnitudeRadS,
  resolveGravityCalibrated,
  sliceScrollEngine,
} from "@/features/ar-slice/sliceScrollEngine";
import { linearSliceDrive } from "@/features/ar-slice/linearSliceDrive";
import { touchReference } from "@/features/ar-slice/touchReference";
import { cameraTranslationDrive } from "@/features/ar-slice/vision/cameraTranslationDrive";
import { frameTrackBuffer } from "@/features/ar-slice/vision/frameTrackBuffer";
import type { FrameTrackState, Point2 } from "@/features/ar-slice/vision/types";
import type { Vec3 } from "@/features/ar-slice/poseMath";
import {
  flatZeroFromImu,
  formatFlatGravityHint,
  formatGravityTiltHint,
  formatRotationHint,
  isGravityFlatEnough,
  isGravityTiltNearDegrees,
  isRotationNearDegrees,
  resolveMountFromSamples,
  type CalibrationPose,
  type AxisCalStep,
} from "@/features/ar-slice/axisCalibration";

const PREFS_LAST_DEVICE = "ar-slice:lastDeviceId";
const PREFS_MOUNT = "ar-slice:mountPreset";
const PREFS_DEPTH = "ar-slice:depthOffset";
const PREFS_LINEAR_GAIN = "ar-slice:linearGestureGain";
const PREFS_INVERT_LINEAR = "ar-slice:invertLinearDepth";
/**
 * Portrait phone axes mapped to the cutting ring:
 * phone X (side tilt) → scene X, phone Y (front/back tilt) → scene Z,
 * phone Z (screen roll) → in-plane spin. This keeps both tilt directions
 * affecting the cut normal instead of turning front/back into left/right.
 */
const DEVICE_MOTION_DISPLAY_CORRECTION: Quaternion = {
  w: 0.5,
  x: -0.5,
  y: -0.5,
  z: -0.5,
};
/** Neutral cut: slightly elevated and angled toward the viewer. */
const DEVICE_MOTION_DEFAULT_VIEW_OFFSET: Quaternion = {
  w: 0.98480775,
  x: 0.17364818,
  y: 0,
  z: 0,
};
let deviceMotionOrientationZero: Quaternion | null = null;

function deviceMotionDisplay(qImu: Quaternion) {
  const deltaImu = deviceMotionOrientationZero
    ? quatMultiply(
        quatConjugate(deviceMotionOrientationZero),
        quatNormalize(qImu),
      )
    : IDENTITY_QUAT;
  // The correction remaps the phone's portrait axes into the cutting-ring axes.
  const baseDisplay = quatMultiply(DEVICE_MOTION_DISPLAY_CORRECTION, deltaImu);
  // A tablet's left/right lean is commonly a roll around its screen normal.
  // A circular cut otherwise hides that motion because it is an in-plane spin.
  // Make this gesture visibly tilt the ring around the scene's forward axis.
  const { twist } = quatSwingTwist(deltaImu, { x: 0, y: 0, z: 1 });
  const screenRoll = Math.atan2(
    2 * (twist.w * twist.z),
    1 - 2 * twist.z * twist.z,
  );
  const tabletDisplay = quatMultiply(
    quatFromAxisAngle({ x: 0, y: 0, z: 1 }, screenRoll),
    baseDisplay,
  );
  return quatMultiply(DEVICE_MOTION_DEFAULT_VIEW_OFFSET, tabletDisplay);
}

/** Mutable hot path — read from useFrame without React re-renders. */
export type PoseBuffer = {
  /** Quaternion after mount (+ optional local zero). */
  raw: Quaternion;
  /** Latest IMU sample before mount/zero (for axis calibration). */
  imu: Quaternion;
  display: Quaternion;
  /** Gravity in calibrated frame — drives slice height (accel, not game-rotation yaw). */
  gravityCal: Vec3;
  /** True when latest packet included BNO085 SH2_GRAVITY. */
  hasSensorGravity: boolean;
  /** BNO085 gravity in IMU frame (m/s²), when present in stream. */
  gravityImu: Vec3 | null;
  /** Latest gyro in IMU frame (rad/s). */
  gyroImu: Vec3 | null;
  calibration: OrientationSample["calibration"] | null;
  /** Gravity-scroll slice offset (m), smoothed per frame. */
  sliceScrollDepth: number;
  gravityScrollDepth: number;
  /** Accel probe-depth along cut normal (scene units after tick scale). */
  linearGestureDepth: number;
  /** Kept for freeze snapshots / older callers; always aligned to depth axis. */
  linearGestureOffset: Vec3;
  /** Cut-plane normal after deadband + slerp (stable; ignores micro float). */
  filteredNormal: Vec3;
  receivedAt: number;
  packetAgeMs: number;
  sampleHz: number;
  /**
   * When true, the cut plane uses frozen* fields. Live IMU still updates
   * display/raw/calibration in the background so zero/mount stay intact.
   */
  poseFrozen: boolean;
  frozenDisplay: Quaternion;
  frozenGravityScrollDepth: number;
  frozenLinearGestureDepth: number;
  frozenLinearGestureOffset: Vec3;
  frozenFilteredNormal: Vec3;
};

export const poseBuffer: PoseBuffer = {
  raw: { ...IDENTITY_QUAT },
  imu: { ...IDENTITY_QUAT },
  display: { ...IDENTITY_QUAT },
  gravityCal: { x: 0, y: -1, z: 0 },
  hasSensorGravity: false,
  gravityImu: null,
  gyroImu: null,
  calibration: null,
  sliceScrollDepth: 0,
  gravityScrollDepth: 0,
  linearGestureDepth: 0,
  linearGestureOffset: { x: 0, y: 0, z: 0 },
  filteredNormal: { x: 0, y: 0, z: 1 },
  receivedAt: 0,
  packetAgeMs: 0,
  sampleHz: 0,
  poseFrozen: false,
  frozenDisplay: { ...IDENTITY_QUAT },
  frozenGravityScrollDepth: 0,
  frozenLinearGestureDepth: 0,
  frozenLinearGestureOffset: { x: 0, y: 0, z: 0 },
  frozenFilteredNormal: { x: 0, y: 0, z: 1 },
};

/**
 * Pose applied to the cut plane (honors freeze).
 * Live: IMU owns the cut; finger only retunes the brain.
 * Frozen: finger rotates brain + aro together (touch ⊗ frozen base).
 */
export function getAppliedPose() {
  if (poseBuffer.poseFrozen) {
    const display = quatMultiply(touchReference.getQuat(), poseBuffer.frozenDisplay);
    return {
      display,
      gravityScrollDepth: poseBuffer.frozenGravityScrollDepth,
      linearGestureDepth: poseBuffer.frozenLinearGestureDepth,
      linearGestureOffset: poseBuffer.frozenLinearGestureOffset,
      filteredNormal: frameFrontNormal(display),
    };
  }
  return {
    display: poseBuffer.display,
    gravityScrollDepth: poseBuffer.gravityScrollDepth,
    linearGestureDepth: poseBuffer.linearGestureDepth,
    linearGestureOffset: poseBuffer.linearGestureOffset,
    filteredNormal: poseBuffer.filteredNormal,
  };
}

function snapshotFrozenPose() {
  // Bake current finger offset out so touch ⊗ frozenDisplay == live cut at freeze.
  const tq = touchReference.getQuat();
  poseBuffer.frozenDisplay = quatMultiply(quatConjugate(tq), poseBuffer.display);
  poseBuffer.frozenGravityScrollDepth = poseBuffer.gravityScrollDepth;
  poseBuffer.frozenLinearGestureDepth = poseBuffer.linearGestureDepth;
  poseBuffer.frozenLinearGestureOffset = { ...poseBuffer.linearGestureOffset };
  poseBuffer.frozenFilteredNormal = { ...poseBuffer.filteredNormal };
}

let lastSampleTs = 0;
let sessionFirstSampleMs = 0;
let hzWindowStart = 0;
let hzCount = 0;
let localZero: Quaternion | null = null;
let axisCalFlat: Quaternion | null = null;
let axisCalPitch: Quaternion | null = null;
let axisCalGravityFlat: Vec3 | null = null;

export function getAxisCalRefs() {
  return { flat: axisCalFlat, pitch: axisCalPitch, gravityFlat: axisCalGravityFlat };
}

export type ArSliceTransport = "ble" | "wifi" | "device-motion";

type ArSliceState = {
  connectionState: BleConnectionState;
  transport: ArSliceTransport;
  devices: BleDeviceInfo[];
  deviceId: string | null;
  deviceName: string | null;
  error: string | null;
  mountPreset: MountPresetId;
  qMount: Quaternion;
  /** Firmware-applied zero is preferred; localZero is fallback for mock/debug. */
  hasLocalZero: boolean;
  depthOffset: number;
  /** When true, frame pitch (gravity) scrolls slice height automatically. */
  autoSliceFromGravity: boolean;
  showDebugCube: boolean;
  visualStyle: "mri" | "hologram";
  cameraEnabled: boolean;
  /** Auto-detect physical frame in camera and align 3D cut */
  frameTrackingEnabled: boolean;
  frameTrackState: FrameTrackState;
  frameCorners: [Point2, Point2, Point2, Point2] | null;
  frameConfidence: number;
  guideStep: 0 | 1 | 2 | 3;
  /** 0=idle, 1=flat accel ref, 2=tilt 90° mount, 3=done */
  axisCalStep: AxisCalStep;
  axisCalError: string | null;
  axisCalResult: string | null;
  axisCalFaces: number;
  imuHealth: "excellent" | "good" | "needsCalibration";
  linearGestureGain: number;
  linearGestureAt: number;
  /** Flip push/pull sense along the probe axis (runtime, persisted). */
  invertLinearDepth: boolean;
  /** Hold cut-plane pose; BLE/calibration keep running underneath. */
  poseFrozen: boolean;
  fps: number;
  lastPacketAgeMs: number;
  sampleHz: number;
  /** Camera distance (m) — pinch zoom + slider on mobile. */
  cameraDistance: number;

  setConnectionState: (s: BleConnectionState) => void;
  setTransport: (t: ArSliceTransport) => void;
  setDevices: (d: BleDeviceInfo[]) => void;
  setConnectedDevice: (id: string | null, name: string | null) => void;
  setError: (e: string | null) => void;
  setMountPreset: (id: MountPresetId) => void;
  setDepthOffset: (v: number) => void;
  setAutoSliceFromGravity: (v: boolean) => void;
  setLinearGestureGain: (v: number) => void;
  setInvertLinearDepth: (v: boolean) => void;
  setShowDebugCube: (v: boolean) => void;
  setVisualStyle: (v: "mri" | "hologram") => void;
  setCameraEnabled: (v: boolean) => void;
  setFrameTrackingEnabled: (v: boolean) => void;
  setFrameTracking: (
    state: FrameTrackState,
    corners: [Point2, Point2, Point2, Point2] | null,
    confidence: number,
  ) => void;
  setGuideStep: (step: 0 | 1 | 2 | 3) => void;
  setTelemetry: (fps: number, age: number, hz: number) => void;
  setCameraDistance: (d: number) => void;
  setPoseFrozen: (frozen: boolean) => void;
  startAxisCalibration: () => void;
  captureAxisCalibrationPose: (pose?: CalibrationPose) => void;
  setAxisCalibrationFaces: (faces: number) => void;
  finishAxisCalibration: () => void;
  cancelAxisCalibration: () => void;
  dismissAxisCalibration: () => void;
  /** After Zerar — app localZero for orientation + reset depth/scroll refs. */
  captureLocalZero: () => void;
  /** Reset slice-height reference (identity after firmware ZERO). */
  captureSliceZeroReference: () => void;
  clearLocalZero: () => void;
  ingestSample: (sample: OrientationSample) => void;
  loadPreferences: () => Promise<void>;
  persistDevice: (deviceId: string | null) => Promise<void>;
};

export const useArSliceStore = create<ArSliceState>((set, get) => ({
  connectionState: "idle",
  transport: "ble",
  devices: [],
  deviceId: null,
  deviceName: null,
  error: null,
  mountPreset: AR_SLICE_IMU.defaultMountPreset as MountPresetId,
  qMount: { ...MOUNT_PRESETS[AR_SLICE_IMU.defaultMountPreset] },
  hasLocalZero: false,
  depthOffset: 0,
  autoSliceFromGravity: true,
  showDebugCube: false,
  visualStyle: "mri",
  cameraEnabled: false,
  /** Off by default — Vision captureSample contends with BLE on the Capacitor bridge. */
  frameTrackingEnabled: false,
  frameTrackState: "off",
  frameCorners: null,
  frameConfidence: 0,
  guideStep: 0,
  axisCalStep: 0,
  axisCalError: null,
  axisCalResult: null,
  axisCalFaces: 0,
  imuHealth: "needsCalibration",
  linearGestureGain: AR_SLICE_IMU.linearGestureGain,
  linearGestureAt: 0,
  invertLinearDepth: AR_SLICE_IMU.invertLinearDepth,
  poseFrozen: false,
  fps: 0,
  lastPacketAgeMs: 0,
  sampleHz: 0,
  cameraDistance: AR_SLICE_CAMERA.default,

  setConnectionState: (connectionState) => set({ connectionState }),
  setTransport: (transport) => {
    deviceMotionOrientationZero = null;
    set({ transport });
  },
  setDevices: (devices) => set({ devices }),
  setConnectedDevice: (deviceId, deviceName) => set({ deviceId, deviceName }),
  setError: (error) => set({ error }),

  setMountPreset: (mountPreset) => {
    const qMount = { ...MOUNT_PRESETS[mountPreset] };
    set({ mountPreset, qMount });
    void Preferences.set({ key: PREFS_MOUNT, value: mountPreset });
  },

  setDepthOffset: (depthOffset) => {
    set({ depthOffset });
    void Preferences.set({ key: PREFS_DEPTH, value: String(depthOffset) });
  },

  setAutoSliceFromGravity: (autoSliceFromGravity) => set({ autoSliceFromGravity }),
  setLinearGestureGain: (linearGestureGain) => {
    set({ linearGestureGain });
    void Preferences.set({ key: PREFS_LINEAR_GAIN, value: String(linearGestureGain) });
  },
  setInvertLinearDepth: (invertLinearDepth) => {
    set({ invertLinearDepth });
    void Preferences.set({
      key: PREFS_INVERT_LINEAR,
      value: invertLinearDepth ? "1" : "0",
    });
  },

  setShowDebugCube: (showDebugCube) => set({ showDebugCube }),
  setVisualStyle: (visualStyle) => set({ visualStyle }),
  setCameraEnabled: (cameraEnabled) => set({ cameraEnabled }),
  setFrameTrackingEnabled: (frameTrackingEnabled) => set({ frameTrackingEnabled }),
  setFrameTracking: (frameTrackState, frameCorners, frameConfidence) =>
    set({ frameTrackState, frameCorners, frameConfidence }),
  setGuideStep: (guideStep) => set({ guideStep }),
  setTelemetry: (fps, lastPacketAgeMs, sampleHz) => {
    const prev = get();
    if (
      Math.abs(prev.fps - fps) < 0.5 &&
      Math.abs(prev.lastPacketAgeMs - lastPacketAgeMs) < 40 &&
      prev.sampleHz === sampleHz
    ) {
      return;
    }
    set({ fps, lastPacketAgeMs, sampleHz });
  },
  setCameraDistance: (cameraDistance) => set({ cameraDistance }),

  setPoseFrozen: (poseFrozen) => {
    if (poseFrozen) {
      snapshotFrozenPose();
    } else {
      // Back to live IMU cut — clear free-orbit finger offset.
      touchReference.reset();
    }
    poseBuffer.poseFrozen = poseFrozen;
    set({ poseFrozen });
  },

  startAxisCalibration: () => {
    axisCalFlat = null;
    axisCalPitch = null;
    axisCalGravityFlat = null;
    cameraTranslationDrive.reset();
    frameTrackBuffer.translationDepth = 0;
    get().setMountPreset(AR_SLICE_IMU.defaultMountPreset as MountPresetId);
    set({ axisCalStep: 1, axisCalError: null, axisCalResult: null, axisCalFaces: 0 });
  },

  captureAxisCalibrationPose: (pose) => {
    const step = get().axisCalStep;
    const imu = quatNormalize(pose?.quaternion ?? poseBuffer.imu);
    const g = pose?.gravity ?? poseBuffer.gravityImu;

    if (step === 1) {
      if (g && !isGravityFlatEnough(g)) {
        set({ axisCalError: formatFlatGravityHint(g) ?? "Moldura não parece plana." });
        return;
      }
      finishAxisCalFlatStep(get, set, imu, g);
      return;
    }

    if (step === 2 && axisCalFlat) {
      if (axisCalGravityFlat && g) {
        if (!isGravityTiltNearDegrees(axisCalGravityFlat, g)) {
          set({ axisCalError: formatGravityTiltHint(axisCalGravityFlat, g) });
          return;
        }
      } else if (!isRotationNearDegrees(axisCalFlat, imu)) {
        set({
          axisCalError: `${formatRotationHint(axisCalFlat, imu)} Atualize o firmware para calibrar pelo acelerômetro.`,
        });
        return;
      }
      finishAxisCalPitchStep(get, set, imu);
    }
  },

  setAxisCalibrationFaces: (axisCalFaces) => set({ axisCalFaces }),

  finishAxisCalibration: () => {
    axisCalFlat = null;
    axisCalPitch = null;
    axisCalGravityFlat = null;
    set({
      axisCalStep: 4,
      axisCalError: null,
      hasLocalZero: true,
      axisCalResult:
        "Giroscópio, gravidade, aceleração linear e alinhamento calibrados e persistidos.",
    });
  },

  cancelAxisCalibration: () => {
    axisCalFlat = null;
    axisCalPitch = null;
    axisCalGravityFlat = null;
    set({ axisCalStep: 0, axisCalError: null, axisCalResult: null });
  },

  dismissAxisCalibration: () => {
    set({ axisCalStep: 0, axisCalError: null });
  },

  captureLocalZero: () => {
    const { qMount, transport } = get();
    // Orientation zero lives here. Firmware ZERO only clears depth + fw qZero.
    localZero = flatZeroFromImu(
      poseBuffer.imu,
      qMount,
      poseBuffer.gravityImu,
    );
    // Gravity-aware zero: Z-up → horizontal aro; facing → face-on.
    if (transport === "device-motion") {
      deviceMotionOrientationZero = quatNormalize(poseBuffer.imu);
    }
    const calibrated =
      transport === "device-motion"
        ? deviceMotionDisplay(poseBuffer.imu)
        : applyMountAndZero(poseBuffer.imu, qMount, localZero);
    poseBuffer.raw = calibrated;
    poseBuffer.display = { ...calibrated };
    poseBuffer.gravityCal =
      transport === "device-motion"
        ? gravityInFrame(calibrated)
        : resolveGravityCalibrated(
            poseBuffer.imu,
            qMount,
            localZero,
            poseBuffer.gravityImu ?? undefined,
          );
    resetSlicePitchZero();
    sliceScrollEngine.reset();
    sliceScrollEngine.captureZero(
      poseBuffer.gravityCal,
      poseBuffer.display,
      poseBuffer.hasSensorGravity,
    );
    linearSliceDrive.reset();
    cameraTranslationDrive.reset();
    touchReference.reset();
    frameTrackBuffer.translationDepth = 0;
    poseBuffer.linearGestureDepth = 0;
    poseBuffer.linearGestureOffset = { x: 0, y: 0, z: 0 };
    poseBuffer.filteredNormal = frameFrontNormal(poseBuffer.display);
    if (poseBuffer.poseFrozen) snapshotFrozenPose();
    set({ hasLocalZero: true });
  },

  captureSliceZeroReference: () => {
    resetSlicePitchZero();
    sliceScrollEngine.captureZero(poseBuffer.gravityCal, poseBuffer.display, poseBuffer.hasSensorGravity);
    linearSliceDrive.reset();
    cameraTranslationDrive.reset();
    touchReference.reset();
    frameTrackBuffer.translationDepth = 0;
    poseBuffer.linearGestureDepth = 0;
    poseBuffer.linearGestureOffset = { x: 0, y: 0, z: 0 };
    if (poseBuffer.poseFrozen) snapshotFrozenPose();
  },

  clearLocalZero: () => {
    localZero = null;
    deviceMotionOrientationZero = null;
    resetSlicePitchZero();
    sliceScrollEngine.reset();
    linearSliceDrive.reset();
    cameraTranslationDrive.reset();
    touchReference.reset();
    frameTrackBuffer.translationDepth = 0;
    poseBuffer.linearGestureDepth = 0;
    poseBuffer.linearGestureOffset = { x: 0, y: 0, z: 0 };
    if (poseBuffer.poseFrozen) snapshotFrozenPose();
    set({ hasLocalZero: false });
  },

  ingestSample: (sample) => {
    const { qMount, transport } = get();
    poseBuffer.imu = quatNormalize(sample);
    const calibrated =
      transport === "device-motion"
        ? deviceMotionDisplay(sample)
        : applyMountAndZero(sample, qMount, localZero);

    poseBuffer.raw = calibrated;
    poseBuffer.gravityCal =
      transport === "device-motion"
        ? gravityInFrame(calibrated)
        : resolveGravityCalibrated(
            sample,
            qMount,
            localZero,
            sample.gravity,
          );
    poseBuffer.hasSensorGravity = sample.gravity != null;
    poseBuffer.calibration = sample.calibration ?? null;
    poseBuffer.gravityImu = sample.gravity ?? null;
    poseBuffer.gyroImu = sample.gyro ?? null;
    // One-axis probe depth from moldura accel (gyro already owns orientation).
    const depthMeters =
      sample.translationPosition ??
      (sample.translationWorld
        ? sample.translationWorld.z ||
          sample.translationWorld.y ||
          sample.translationWorld.x
        : undefined);
    if (
      depthMeters != null &&
      linearSliceDrive.ingest(
        depthMeters,
        get().linearGestureGain,
        AR_SLICE_IMU.linearGestureMaxMeters,
        performance.now(),
        transport === "device-motion"
          ? AR_SLICE_IMU.deviceLinearGestureDeadbandMeters
          : AR_SLICE_IMU.linearGestureDeadbandMeters,
      )
    ) {
      set({ linearGestureAt: performance.now() });
    }
    const accelAccuracy = sample.calibration?.accelAccuracy ?? 0;
    const gyroAccuracy = sample.calibration?.gyroAccuracy ?? 0;
    const imuHealth =
      accelAccuracy >= 3 && gyroAccuracy >= 3
        ? "excellent"
        : accelAccuracy >= 2 && gyroAccuracy >= 2
          ? "good"
          : "needsCalibration";
    if (imuHealth !== get().imuHealth) set({ imuHealth });
    poseBuffer.receivedAt = sample.receivedAt;

    const now = performance.now();
    if (sessionFirstSampleMs === 0) sessionFirstSampleMs = now;
    // Mount presets only from the axis wizard — auto-mount remapped sensor +Z
    // off the aro normal (~90°, ring upright).
    // Direct gyro path — heavy deadband/twist filters made the cut feel dead.
    if (lastSampleTs > 0) {
      const still = sample.calibration?.stationary === true;
      poseBuffer.display = quatSlerp(
        poseBuffer.display,
        calibrated,
        still ? 0.55 : 0.88,
      );
    } else {
      poseBuffer.display = calibrated;
    }
    lastSampleTs = now;

    hzCount++;
    if (hzWindowStart === 0) hzWindowStart = now;
    if (now - hzWindowStart >= 1000) {
      poseBuffer.sampleHz = hzCount;
      hzCount = 0;
      hzWindowStart = now;
    }
  },

  loadPreferences: async () => {
    const [device, mount, depth, linearGain, invertLinear] = await Promise.all([
      Preferences.get({ key: PREFS_LAST_DEVICE }),
      Preferences.get({ key: PREFS_MOUNT }),
      Preferences.get({ key: PREFS_DEPTH }),
      Preferences.get({ key: PREFS_LINEAR_GAIN }),
      Preferences.get({ key: PREFS_INVERT_LINEAR }),
    ]);
    // Always identity: stored imu_x±90 remaps sensor +Z off the aro (~90° upright).
    const mountPreset = AR_SLICE_IMU.defaultMountPreset as MountPresetId;
    const qMount = { ...MOUNT_PRESETS[mountPreset] };
    if (mount.value && mount.value !== mountPreset) {
      void Preferences.set({ key: PREFS_MOUNT, value: mountPreset });
    }
    set({
      deviceId: device.value,
      mountPreset,
      qMount,
      depthOffset: depth.value != null ? Number(depth.value) || 0 : 0,
      invertLinearDepth:
        invertLinear.value == null
          ? AR_SLICE_IMU.invertLinearDepth
          : invertLinear.value === "1" || invertLinear.value === "true",
      linearGestureGain: (() => {
        if (linearGain.value == null) return AR_SLICE_IMU.linearGestureGain;
        const parsed = Number(linearGain.value);
        if (!Number.isFinite(parsed)) return AR_SLICE_IMU.linearGestureGain;
        // Migrate older overly-sensitive defaults.
        if (
          Math.abs(parsed - 1.2) < 1e-6 ||
          Math.abs(parsed - 0.7) < 1e-6 ||
          Math.abs(parsed - 1.15) < 1e-6 ||
          Math.abs(parsed - 1.25) < 1e-6 ||
          Math.abs(parsed - 1.5) < 1e-6 ||
          Math.abs(parsed - 2.2) < 1e-6
        ) {
          return AR_SLICE_IMU.linearGestureGain;
        }
        return parsed;
      })(),
    });
  },

  persistDevice: async (deviceId) => {
    if (deviceId) {
      await Preferences.set({ key: PREFS_LAST_DEVICE, value: deviceId });
    } else {
      await Preferences.remove({ key: PREFS_LAST_DEVICE });
    }
  },
}));

type ArSliceStoreApi = ReturnType<typeof useArSliceStore.getState>;

function finishAxisCalFlatStep(
  get: () => ArSliceStoreApi,
  set: (partial: Partial<ArSliceStoreApi>) => void,
  imu: Quaternion,
  gravityImu: Vec3 | null,
) {
  axisCalFlat = imu;
  axisCalGravityFlat = gravityImu ? { ...gravityImu } : null;
  const { preset } = suggestMountPresetFromFlatGravity(imu);
  get().setMountPreset(preset);
  const qMount = MOUNT_PRESETS[preset];
  localZero = flatZeroFromImu(imu, qMount, gravityImu);
  resetSlicePitchZero();
  sliceScrollEngine.reset();
  sliceScrollEngine.captureZero(
    resolveGravityCalibrated(imu, qMount, localZero),
    applyMountAndZero(imu, qMount, localZero),
    poseBuffer.hasSensorGravity,
  );
  set({
    axisCalStep: 2,
    axisCalError: null,
    hasLocalZero: true,
  });
}

function finishAxisCalPitchStep(
  get: () => ArSliceStoreApi,
  set: (partial: Partial<ArSliceStoreApi>) => void,
  imu: Quaternion,
) {
  if (!axisCalFlat) return;
  axisCalPitch = imu;
  finishAxisCalDone(get, set, axisCalFlat, imu);
}

function finishAxisCalDone(
  get: () => ArSliceStoreApi,
  set: (partial: Partial<ArSliceStoreApi>) => void,
  qFlat: Quaternion,
  qPitch: Quaternion,
) {
  const { preset, label } = resolveMountFromSamples(qFlat, qPitch);
  get().setMountPreset(preset);
  localZero = flatZeroFromImu(qFlat, MOUNT_PRESETS[preset], axisCalGravityFlat);
  sliceScrollEngine.captureZero(
    poseBuffer.gravityCal,
    poseBuffer.display,
    poseBuffer.hasSensorGravity,
  );
  set({
    axisCalStep: 3,
    axisCalError: null,
    hasLocalZero: true,
    axisCalResult: `Alinhamento definido (${label}). Complete as posições do acelerômetro.`,
  });
}

sliceScrollEngine.setTuning({
  gain: AR_SLICE_IMU.sliceScrollGain,
  deadzoneRad: AR_SLICE_IMU.sliceScrollDeadzoneRad,
  smoothing: AR_SLICE_IMU.sliceScrollSmoothing,
  stationaryBlend: AR_SLICE_IMU.sliceScrollStationaryBlend,
  stationaryGyroRadS: AR_SLICE_IMU.sliceScrollStationaryGyroRadS,
});

/** Reset scroll session state when transport disconnects. */
export function resetPoseScrollSession() {
  sessionFirstSampleMs = 0;
  sliceScrollEngine.reset();
  linearSliceDrive.reset();
  cameraTranslationDrive.reset();
  frameTrackBuffer.translationDepth = 0;
  poseBuffer.sliceScrollDepth = 0;
  poseBuffer.gravityScrollDepth = 0;
  poseBuffer.linearGestureDepth = 0;
  poseBuffer.linearGestureOffset = { x: 0, y: 0, z: 0 };
  poseBuffer.filteredNormal = { x: 0, y: 0, z: 1 };
  // Keep freeze flag/user intent; refresh snapshot so UI doesn't show stale depths.
  if (poseBuffer.poseFrozen) snapshotFrozenPose();
}

/** Call once per animation frame from R3F. */
export function tickPoseBuffer(now = performance.now()) {
  poseBuffer.packetAgeMs = poseBuffer.receivedAt > 0 ? now - poseBuffer.receivedAt : 0;

  const gravityDepth = sliceScrollEngine.tick(
    poseBuffer.gravityCal,
    poseBuffer.display,
    poseBuffer.gyroImu
      ? gyroMagnitudeRadS(poseBuffer.gyroImu)
      : poseBuffer.calibration?.stationary
        ? 0
        : 999,
    poseBuffer.hasSensorGravity,
    now,
  );
  const linearMeters = linearSliceDrive.tick(AR_SLICE_IMU.linearGestureSmoothing);
  const s =
    useArSliceStore.getState().transport === "device-motion"
      ? AR_SLICE_IMU.linearGestureMetersToScene
      : AR_SLICE_IMU.bleLinearGestureMetersToScene;
  const depthSign = useArSliceStore.getState().invertLinearDepth ? -1 : 1;
  poseBuffer.linearGestureDepth = linearMeters * s * depthSign;
  // Offset lives purely along depth; ClipPlane steps the cut along its normal.
  poseBuffer.linearGestureOffset = {
    x: 0,
    y: 0,
    z: poseBuffer.linearGestureDepth,
  };
  poseBuffer.gravityScrollDepth = gravityDepth;
  poseBuffer.sliceScrollDepth = gravityDepth + poseBuffer.linearGestureDepth;

  // Cut normal = sensor +Z after display orientation (same as CutCap / clip).
  const appliedDisplay = poseBuffer.poseFrozen
    ? poseBuffer.frozenDisplay
    : poseBuffer.display;
  const basis = frameCutBasis(appliedDisplay);
  poseBuffer.filteredNormal = {
    x: AR_SLICE_IMU.mirrorHorizontalNormal ? -basis.normal.x : basis.normal.x,
    y: AR_SLICE_IMU.invertVerticalNormal ? -basis.normal.y : basis.normal.y,
    z: basis.normal.z,
  };

  return poseBuffer;
}
