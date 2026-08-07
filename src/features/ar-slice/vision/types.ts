export type Point2 = { x: number; y: number };

/** Normalized image coords: x,y in [0,1], origin top-left. */
export type NormalizedQuad = {
  /** TL, TR, BR, BL */
  corners: [Point2, Point2, Point2, Point2];
  confidence: number;
  source: "vision" | "js" | "arkit";
};

export type FramePose = {
  /** Position of frame center in Three.js camera/view space approximation */
  position: { x: number; y: number; z: number };
  /** Quaternion of frame plane (Z = outward normal toward camera when facing) */
  quaternion: { w: number; x: number; y: number; z: number };
  /** Uniform scale so the procedural head ~fills the frame */
  scale: number;
  /** Apparent width of frame in NDC */
  ndcWidth: number;
  ndcHeight: number;
  confidence: number;
  receivedAt: number;
  source: NormalizedQuad["source"];
};

export type FrameTrackState = "off" | "searching" | "locked" | "lost";
