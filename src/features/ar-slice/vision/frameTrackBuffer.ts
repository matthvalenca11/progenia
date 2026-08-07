import type { FramePose, FrameTrackState, NormalizedQuad } from "@/features/ar-slice/vision/types";

export type FrameTrackBuffer = {
  quad: NormalizedQuad | null;
  pose: FramePose | null;
  state: FrameTrackState;
  lostFrames: number;
};

export const frameTrackBuffer: FrameTrackBuffer = {
  quad: null,
  pose: null,
  state: "off",
  lostFrames: 0,
};

export function resetFrameTrackBuffer() {
  frameTrackBuffer.quad = null;
  frameTrackBuffer.pose = null;
  frameTrackBuffer.state = "off";
  frameTrackBuffer.lostFrames = 0;
}
