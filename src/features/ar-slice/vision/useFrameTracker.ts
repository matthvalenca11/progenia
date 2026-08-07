import { useEffect, useRef, type RefObject } from "react";
import { CameraPreview } from "@capacitor-community/camera-preview";
import { Capacitor } from "@capacitor/core";
import {
  detectFrameRectangle,
  imageDataFromBase64,
  imageDataFromVideo,
} from "@/features/ar-slice/vision/detectFrameRectangle";
import { estimateFramePose, smoothFramePose } from "@/features/ar-slice/vision/estimateFramePose";
import { frameTrackBuffer, resetFrameTrackBuffer } from "@/features/ar-slice/vision/frameTrackBuffer";
import { mapNativeDetection, ProgeniaArFrame } from "@/features/ar-slice/vision/ProgeniaArFrame";
import { useArSliceStore } from "@/features/ar-slice/arSliceStore";
import type { FrameTrackState, Point2 } from "@/features/ar-slice/vision/types";

/** CaptureSample blocks the Capacitor bridge (and BLE). Keep this sparse. */
const SEARCH_INTERVAL_MS = 450;
const LOCKED_INTERVAL_MS = 1000;
const UI_PUSH_MS = 250;
const CAPTURE_QUALITY = 28;
const LOCK_CONFIDENCE = 0.22;
const LOST_AFTER = 4;

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
 * Tracks the physical black frame in the camera feed.
 * Intentionally low-rate: JPEG capture on the Capacitor bridge starves BLE if run hot.
 */
export function useFrameTracker({ enabled, cameraMode, videoRef }: Options) {
  const setFrameTracking = useArSliceStore((s) => s.setFrameTracking);
  const nativeVision = useRef(false);
  const busy = useRef(false);
  const lastUiPush = useRef(0);
  const lastUiState = useRef<FrameTrackState>("off");
  const nativeMisses = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!enabled || !Capacitor.isNativePlatform()) {
        nativeVision.current = false;
        return;
      }
      try {
        const avail = await ProgeniaArFrame.isAvailable();
        if (!cancelled) nativeVision.current = !!avail.available;
      } catch {
        if (!cancelled) nativeVision.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || cameraMode === "off" || cameraMode === "error") {
      resetFrameTrackBuffer();
      setFrameTracking("off", null, 0);
      lastUiState.current = "off";
      return;
    }

    frameTrackBuffer.state = "searching";
    setFrameTracking("searching", null, 0);
    lastUiState.current = "searching";
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

        if (cameraMode === "native") {
          const sample = await CameraPreview.captureSample({ quality: CAPTURE_QUALITY });
          if (cancelled) return;

          if (nativeVision.current) {
            try {
              const native = await ProgeniaArFrame.detectRectangle({ base64: sample.value });
              quad = mapNativeDetection(native);
            } catch {
              quad = null;
            }
          }

          // JS decode of full JPEG is very expensive — only as rare fallback
          if (!quad) {
            nativeMisses.current += 1;
            if (!nativeVision.current || nativeMisses.current % 3 === 0) {
              const image = await imageDataFromBase64(sample.value);
              if (image) quad = detectFrameRectangle(image);
            }
          } else {
            nativeMisses.current = 0;
          }
        } else if (cameraMode === "web" && videoRef.current) {
          const image = imageDataFromVideo(videoRef.current, 240);
          if (image) quad = detectFrameRectangle(image);
        }

        if (quad && quad.confidence >= LOCK_CONFIDENCE) {
          const rawPose = estimateFramePose(quad);
          const pose = smoothFramePose(frameTrackBuffer.pose, rawPose, 0.35);
          frameTrackBuffer.quad = quad;
          frameTrackBuffer.pose = pose;
          frameTrackBuffer.lostFrames = 0;
          frameTrackBuffer.state = "locked";
          pushUi("locked", quad.corners, pose.confidence);
        } else {
          frameTrackBuffer.lostFrames += 1;
          if (frameTrackBuffer.lostFrames >= LOST_AFTER) {
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
          frameTrackBuffer.state === "locked" ? LOCKED_INTERVAL_MS : SEARCH_INTERVAL_MS;
        timer = window.setTimeout(loop, delay);
      });
    };
    timer = window.setTimeout(loop, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      resetFrameTrackBuffer();
      setFrameTracking("off", null, 0);
      lastUiState.current = "off";
    };
  }, [enabled, cameraMode, videoRef, setFrameTracking]);
}
