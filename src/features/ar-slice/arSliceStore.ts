import { create } from "zustand";
import { Preferences } from "@capacitor/preferences";
import { AR_SLICE_CAMERA, AR_SLICE_IMU } from "@/features/ar-slice/arSliceSceneConfig";
import type { OrientationSample, Quaternion } from "@/features/ar-slice/ble/protocol";
import {
  IDENTITY_QUAT,
  MOUNT_PRESETS,
  type MountPresetId,
  applyMountAndZero,
  quatNormalize,
  quatSlerp,
  resetSlicePitchZero,
  suggestMountPresetFromFlatGravity,
} from "@/features/ar-slice/poseMath";
import {
  gyroMagnitudeRadS,
  resolveGravityCalibrated,
  sliceScrollEngine,
} from "@/features/ar-slice/sliceScrollEngine";
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
  type AxisCalStep,
} from "@/features/ar-slice/axisCalibration";

const PREFS_LAST_DEVICE = "ar-slice:lastDeviceId";
const PREFS_MOUNT = "ar-slice:mountPreset";
const PREFS_DEPTH = "ar-slice:depthOffset";

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
  /** Gravity-scroll slice offset (m), smoothed per frame. */
  sliceScrollDepth: number;
  receivedAt: number;
  packetAgeMs: number;
  sampleHz: number;
};

export const poseBuffer: PoseBuffer = {
  raw: { ...IDENTITY_QUAT },
  imu: { ...IDENTITY_QUAT },
  display: { ...IDENTITY_QUAT },
  gravityCal: { x: 0, y: -1, z: 0 },
  hasSensorGravity: false,
  gravityImu: null,
  gyroImu: null,
  sliceScrollDepth: 0,
  receivedAt: 0,
  packetAgeMs: 0,
  sampleHz: 0,
};

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

export type ArSliceTransport = "ble" | "wifi";

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
  setShowDebugCube: (v: boolean) => void;
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
  startAxisCalibration: () => void;
  captureAxisCalibrationPose: () => void;
  cancelAxisCalibration: () => void;
  dismissAxisCalibration: () => void;
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
  mountPreset: "identity",
  qMount: { ...MOUNT_PRESETS.identity },
  hasLocalZero: false,
  depthOffset: 0,
  autoSliceFromGravity: true,
  showDebugCube: false,
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
  fps: 0,
  lastPacketAgeMs: 0,
  sampleHz: 0,
  cameraDistance: AR_SLICE_CAMERA.default,

  setConnectionState: (connectionState) => set({ connectionState }),
  setTransport: (transport) => set({ transport }),
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

  setShowDebugCube: (showDebugCube) => set({ showDebugCube }),
  setCameraEnabled: (cameraEnabled) => set({ cameraEnabled }),
  setFrameTrackingEnabled: (frameTrackingEnabled) => set({ frameTrackingEnabled }),
  setFrameTracking: (frameTrackState, frameCorners, frameConfidence) =>
    set({ frameTrackState, frameCorners, frameConfidence }),
  setGuideStep: (guideStep) => set({ guideStep }),
  setTelemetry: (fps, lastPacketAgeMs, sampleHz) => set({ fps, lastPacketAgeMs, sampleHz }),
  setCameraDistance: (cameraDistance) => set({ cameraDistance }),

  startAxisCalibration: () => {
    axisCalFlat = null;
    axisCalPitch = null;
    axisCalGravityFlat = null;
    set({ axisCalStep: 1, axisCalError: null, axisCalResult: null });
  },

  captureAxisCalibrationPose: () => {
    const step = get().axisCalStep;
    const imu = quatNormalize(poseBuffer.imu);
    const g = poseBuffer.gravityImu;

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
    localZero = quatNormalize(poseBuffer.raw);
    resetSlicePitchZero();
    sliceScrollEngine.reset();
    sliceScrollEngine.captureZero(poseBuffer.gravityCal, poseBuffer.display, poseBuffer.hasSensorGravity);
    set({ hasLocalZero: true });
  },

  captureSliceZeroReference: () => {
    resetSlicePitchZero();
    sliceScrollEngine.captureZero(poseBuffer.gravityCal, poseBuffer.display, poseBuffer.hasSensorGravity);
  },

  clearLocalZero: () => {
    localZero = null;
    resetSlicePitchZero();
    sliceScrollEngine.reset();
    set({ hasLocalZero: false });
  },

  ingestSample: (sample) => {
    const { qMount } = get();
    poseBuffer.imu = quatNormalize(sample);
    const calibrated = applyMountAndZero(sample, qMount, localZero);

    poseBuffer.raw = calibrated;
    poseBuffer.gravityCal = resolveGravityCalibrated(
      sample,
      qMount,
      localZero,
      sample.gravity,
    );
    poseBuffer.hasSensorGravity = sample.gravity != null;
    poseBuffer.gravityImu = sample.gravity ?? null;
    poseBuffer.gyroImu = sample.gyro ?? null;
    poseBuffer.receivedAt = sample.receivedAt;

    const now = performance.now();
    if (sessionFirstSampleMs === 0) sessionFirstSampleMs = now;
    const gyroMag = gyroMagnitudeRadS(sample.gyro);
    const mountPreset = get().mountPreset;
    if (mountPreset === "identity") {
      const suggested = sliceScrollEngine.tryAutoMountPreset(
        sample,
        gyroMag,
        now - sessionFirstSampleMs,
      );
      if (suggested) {
        get().setMountPreset(suggested);
        poseBuffer.gravityCal = resolveGravityCalibrated(
          sample,
          MOUNT_PRESETS[suggested],
          localZero,
          sample.gravity,
        );
      }
    }
    // High alpha keeps cut responsive at 30–50 Hz Wi‑Fi stream
    if (lastSampleTs > 0) {
      poseBuffer.display = quatSlerp(poseBuffer.display, calibrated, 0.85);
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
    const [device, mount, depth] = await Promise.all([
      Preferences.get({ key: PREFS_LAST_DEVICE }),
      Preferences.get({ key: PREFS_MOUNT }),
      Preferences.get({ key: PREFS_DEPTH }),
    ]);
    const mountPreset = (mount.value as MountPresetId) || "identity";
    const qMount = { ...(MOUNT_PRESETS[mountPreset] ?? MOUNT_PRESETS.identity) };
    set({
      deviceId: device.value,
      mountPreset: MOUNT_PRESETS[mountPreset] ? mountPreset : "identity",
      qMount,
      depthOffset: depth.value != null ? Number(depth.value) || 0 : 0,
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
  localZero = flatZeroFromImu(imu, qMount);
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
  localZero = flatZeroFromImu(qFlat, MOUNT_PRESETS[preset]);
  sliceScrollEngine.captureZero(
    poseBuffer.gravityCal,
    poseBuffer.display,
    poseBuffer.hasSensorGravity,
  );
  axisCalFlat = null;
  axisCalPitch = null;
  axisCalGravityFlat = null;
  set({
    axisCalStep: 3,
    axisCalError: null,
    hasLocalZero: true,
    axisCalResult: poseBuffer.hasSensorGravity
      ? `Acelerômetro calibrado (${label}). Incline a moldura para mover a fatia.`
      : `Orientação calibrada (${label}). Atualize o firmware para usar o acelerômetro (gx/gy/gz).`,
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
  poseBuffer.sliceScrollDepth = 0;
}

/** Call once per animation frame from R3F. */
export function tickPoseBuffer(now = performance.now()) {
  poseBuffer.packetAgeMs = poseBuffer.receivedAt > 0 ? now - poseBuffer.receivedAt : 0;

  poseBuffer.sliceScrollDepth = sliceScrollEngine.tick(
    poseBuffer.gravityCal,
    poseBuffer.display,
    gyroMagnitudeRadS(poseBuffer.gyroImu),
    poseBuffer.hasSensorGravity,
    now,
  );

  return poseBuffer;
}
