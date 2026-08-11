import type { FramePose, FrameTrackState, NormalizedQuad } from "@/features/ar-slice/vision/types";

export type FrameTrackBuffer = {
  quad: NormalizedQuad | null;
  pose: FramePose | null;
  state: FrameTrackState;
  lostFrames: number;
  translationDepth: number;
  translationGestureAt: number;
  /** ARKit vertical FOV in degrees — keeps WebGL scale matched to the camera. */
  fovYDeg: number;
};

export const frameTrackBuffer: FrameTrackBuffer = {
  quad: null,
  pose: null,
  state: "off",
  lostFrames: 0,
  translationDepth: 0,
  translationGestureAt: 0,
  fovYDeg: 42,
};

export function resetFrameTrackBuffer() {
  frameTrackBuffer.quad = null;
  frameTrackBuffer.pose = null;
  frameTrackBuffer.state = "off";
  frameTrackBuffer.lostFrames = 0;
  frameTrackBuffer.translationDepth = 0;
  frameTrackBuffer.translationGestureAt = 0;
  frameTrackBuffer.fovYDeg = 42;
}
