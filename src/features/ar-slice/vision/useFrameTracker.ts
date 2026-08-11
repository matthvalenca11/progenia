import { useEffect, useRef, type RefObject } from "react";
import {
  detectFrameRectangle,
  imageDataFromVideo,
} from "@/features/ar-slice/vision/detectFrameRectangle";
import { estimateFramePose, smoothFramePose } from "@/features/ar-slice/vision/estimateFramePose";
import { frameTrackBuffer, resetFrameTrackBuffer } from "@/features/ar-slice/vision/frameTrackBuffer";
import { cameraTranslationDrive } from "@/features/ar-slice/vision/cameraTranslationDrive";
import { ProgeniaArFrame } from "@/features/ar-slice/vision/ProgeniaArFrame";
import { poseBuffer, useArSliceStore } from "@/features/ar-slice/arSliceStore";
import type { FramePose, FrameTrackState, Point2 } from "@/features/ar-slice/vision/types";

/** Capacitor pollMixedReality contends with BLE — keep this sparse. */
const NATIVE_SEARCH_INTERVAL_MS = 160;
const NATIVE_LOCKED_INTERVAL_MS = 120;
const WEB_SEARCH_INTERVAL_MS = 140;
const WEB_LOCKED_INTERVAL_MS = 80;
const UI_PUSH_MS = 250;
const LOCK_CONFIDENCE = 0.22;
const LOST_AFTER = 4;
/** Parent scale so the MRI head reads ~28 cm across in the room. */
const HOLOGRAM_SCALE = 0.28;
const HOLOGRAM_DISTANCE_M = 0.7;

function defaultHologramPose(): FramePose {
  return {
    position: { x: 0, y: -0.02, z: -HOLOGRAM_DISTANCE_M },
    quaternion: { w: 1, x: 0, y: 0, z: 0 },
    scale: HOLOGRAM_SCALE,
    ndcWidth: 0.35,
    ndcHeight: 0.42,
    confidence: 1,
    receivedAt: performance.now(),
    source: "arkit",
  };
}

type Options = {
  enabled: boolean;
  cameraMode: "off" | "native" | "web" | "error";
  videoRef: RefObject<HTMLVideoElement | null>;
};

function cornersMoved(
  a: [Point2, Point2, Point2, Point2] | null,
  b: [Point2, Point2, Point2, Point2],
  eps = 0.02,
) {
  if (!a) return true;
  for (let i = 0; i < 4; i++) {
    if (Math.abs(a[i].x - b[i].x) > eps || Math.abs(a[i].y - b[i].y) > eps) return true;
  }
  return false;
}

/**
 * Tracks the hand holding the sensor (native), with the frame detector as web fallback.
 * Intentionally low-rate: JPEG capture on the Capacitor bridge starves BLE if run hot.
 */
export function useFrameTracker({ enabled, cameraMode, videoRef }: Options) {
  const setFrameTracking = useArSliceStore((s) => s.setFrameTracking);
  const busy = useRef(false);
  const lastUiPush = useRef(0);
  const lastUiState = useRef<FrameTrackState>("off");

  useEffect(() => {
    if (!enabled || cameraMode === "off" || cameraMode === "error") {
      resetFrameTrackBuffer();
      cameraTranslationDrive.reset();
      setFrameTracking("off", null, 0);
      lastUiState.current = "off";
      return;
    }

    // Project the brain immediately when the camera opens — do not wait for
    // ARKit's first tracked frame or the hologram never appears.
    if (cameraMode === "native") {
      frameTrackBuffer.pose = defaultHologramPose();
      frameTrackBuffer.state = "locked";
      setFrameTracking("locked", null, 1);
      lastUiState.current = "locked";
    } else {
      frameTrackBuffer.state = "searching";
      setFrameTracking("searching", null, 0);
      lastUiState.current = "searching";
    }
    let cancelled = false;

    const pushUi = (
      state: FrameTrackState,
      corners: [Point2, Point2, Point2, Point2] | null,
      confidence: number,
      force = false,
    ) => {
      const now = performance.now();
      const stateChanged = state !== lastUiState.current;
      const moved = corners != null && cornersMoved(useArSliceStore.getState().frameCorners, corners);
      if (!force && !stateChanged && !moved && now - lastUiPush.current < UI_PUSH_MS) return;
      lastUiPush.current = now;
      lastUiState.current = state;
      setFrameTracking(state, corners, confidence);
    };

    const tick = async () => {
      if (cancelled || busy.current) return;
      busy.current = true;
      try {
        let quad = null as ReturnType<typeof detectFrameRectangle>;
        let arPose: FramePose | null = null;

        if (cameraMode === "native") {
          try {
            const ar = await ProgeniaArFrame.pollMixedReality();
            if (typeof ar.fovY === "number" && Number.isFinite(ar.fovY) && ar.fovY > 10) {
              frameTrackBuffer.fovYDeg = ar.fovY;
            }
            if (
              ar.x != null &&
              ar.y != null &&
              ar.z != null &&
              ar.qw != null &&
              ar.qx != null &&
              ar.qy != null &&
              ar.qz != null
            ) {
              arPose = {
                position: { x: ar.x, y: ar.y, z: ar.z },
                quaternion: { w: ar.qw, x: ar.qx, y: ar.qy, z: ar.qz },
                scale: HOLOGRAM_SCALE,
                ndcWidth: 0.35,
                ndcHeight: 0.42,
                confidence: ar.tracking ? 1 : 0.7,
                receivedAt: performance.now(),
                source: "arkit",
              };
            } else {
              // Keep projecting even while ARKit is still warming up.
              arPose = frameTrackBuffer.pose?.source === "arkit"
                ? frameTrackBuffer.pose
                : defaultHologramPose();
            }
          } catch {
            arPose =
              frameTrackBuffer.pose?.source === "arkit"
                ? frameTrackBuffer.pose
                : defaultHologramPose();
          }
        } else if (cameraMode === "web" && videoRef.current) {
          const image = imageDataFromVideo(videoRef.current, 240);
          if (image) quad = detectFrameRectangle(image);
        }

        if (arPose || (quad && quad.confidence >= LOCK_CONFIDENCE)) {
          const rawPose =
            arPose ??
            estimateFramePose(quad!, {
              aspect: window.innerWidth / Math.max(1, window.innerHeight),
            });
          const pose = smoothFramePose(frameTrackBuffer.pose, rawPose, arPose ? 0.7 : 0.35);
          frameTrackBuffer.quad = quad;
          frameTrackBuffer.pose = pose;
          frameTrackBuffer.lostFrames = 0;
          frameTrackBuffer.state = "locked";
          if (!arPose && cameraTranslationDrive.ingest(pose, poseBuffer.display)) {
            frameTrackBuffer.translationDepth = cameraTranslationDrive.getDepth();
            frameTrackBuffer.translationGestureAt =
              cameraTranslationDrive.getLastGestureAt();
            useArSliceStore.setState({
              linearGestureAt: frameTrackBuffer.translationGestureAt,
            });
          }
          pushUi("locked", quad?.corners ?? null, pose.confidence);
        } else {
          frameTrackBuffer.lostFrames += 1;
          if (frameTrackBuffer.lostFrames >= LOST_AFTER) {
            cameraTranslationDrive.rebase();
            frameTrackBuffer.state = frameTrackBuffer.pose ? "lost" : "searching";
            if (frameTrackBuffer.lostFrames > LOST_AFTER * 3) {
              frameTrackBuffer.quad = null;
              frameTrackBuffer.pose = null;
            }
            pushUi(
              frameTrackBuffer.state,
              frameTrackBuffer.quad?.corners ?? null,
              0,
              true,
            );
          }
        }
      } catch {
        // keep last pose; bridge may be busy
      } finally {
        busy.current = false;
      }
    };

    let timer = 0;
    const loop = () => {
      if (cancelled) return;
      void tick().finally(() => {
        if (cancelled) return;
        const delay =
          cameraMode === "web"
            ? frameTrackBuffer.state === "locked"
              ? WEB_LOCKED_INTERVAL_MS
              : WEB_SEARCH_INTERVAL_MS
            : frameTrackBuffer.state === "locked"
              ? NATIVE_LOCKED_INTERVAL_MS
              : NATIVE_SEARCH_INTERVAL_MS;
        timer = window.setTimeout(loop, delay);
      });
    };
    timer = window.setTimeout(loop, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      resetFrameTrackBuffer();
      cameraTranslationDrive.reset();
      setFrameTracking("off", null, 0);
      lastUiState.current = "off";
    };
  }, [enabled, cameraMode, videoRef, setFrameTracking]);
}
