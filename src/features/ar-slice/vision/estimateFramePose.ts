import type { Quaternion } from "@/features/ar-slice/ble/protocol";
import type { FramePose, NormalizedQuad, Point2 } from "@/features/ar-slice/vision/types";
import { IDENTITY_QUAT, quatNormalize } from "@/features/ar-slice/poseMath";

function toNdc(p: Point2): Point2 {
  return { x: p.x * 2 - 1, y: -(p.y * 2 - 1) };
}

function sub(a: Point2, b: Point2): Point2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function len(a: Point2) {
  return Math.hypot(a.x, a.y);
}

function cross2(a: Point2, b: Point2) {
  return a.x * b.y - a.y * b.x;
}

function quatFromAxes(right: { x: number; y: number; z: number }, up: { x: number; y: number; z: number }, forward: { x: number; y: number; z: number }): Quaternion {
  // Rotation matrix columns = right, up, forward (Three.js camera looks -Z; we use Z as plane normal toward camera ≈ +Z in model space after mapping)
  const m00 = right.x;
  const m01 = up.x;
  const m02 = forward.x;
  const m10 = right.y;
  const m11 = up.y;
  const m12 = forward.y;
  const m20 = right.z;
  const m21 = up.z;
  const m22 = forward.z;
  const trace = m00 + m11 + m22;
  let w: number;
  let x: number;
  let y: number;
  let z: number;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  return quatNormalize({ w, x, y, z });
}

/**
 * Estimate a 3D frame pose from a normalized image quad.
 * Uses pinhole approximation with vertical FOV (degrees).
 */
export function estimateFramePose(
  quad: NormalizedQuad,
  opts?: { fovYDeg?: number; frameWidthMeters?: number; aspect?: number },
): FramePose {
  const fovY = ((opts?.fovYDeg ?? 42) * Math.PI) / 180;
  const frameW = opts?.frameWidthMeters ?? (quad.source === "hand" ? 0.1 : 0.28);
  const viewportAspect =
    opts?.aspect ??
    (typeof window === "undefined"
      ? 1
      : window.innerWidth / Math.max(1, window.innerHeight));

  const [tl, tr, br, bl] = quad.corners.map(toNdc);
  const center = {
    x: (tl.x + tr.x + br.x + bl.x) / 4,
    y: (tl.y + tr.y + br.y + bl.y) / 4,
  };

  const top = len(sub(tr, tl));
  const bottom = len(sub(br, bl));
  const left = len(sub(bl, tl));
  const right = len(sub(br, tr));
  const ndcWidth = (top + bottom) / 2;
  const ndcHeight = (left + right) / 2;

  // Distance from apparent size: width_ndc ≈ (frameW / z) / tan(fovY/2) * aspect terms — approx with vertical FOV
  const tanHalf = Math.tan(fovY / 2);
  const z = Math.max(
    0.25,
    Math.min(4.5, frameW / Math.max(0.03, ndcWidth * tanHalf * viewportAspect)),
  );

  // Unproject center to view space (camera at origin looking -Z)
  const y = center.y * tanHalf * z;
  const x = center.x * tanHalf * z * viewportAspect;

  // Plane axes from quad edges in NDC → approximate view-space directions
  const right2 = sub(tr, tl);
  const up2 = sub(tl, bl);
  const rLen = len(right2) || 1;
  const uLen = len(up2) || 1;
  const rightV = { x: right2.x / rLen, y: right2.y / rLen, z: 0 };
  const upV = { x: up2.x / uLen, y: up2.y / uLen, z: 0 };
  // Normal toward camera (+Z in view if camera looks -Z... for Three.js Object3D in world with camera at +Z looking origin, we place content in front)
  let nx = cross2(right2, up2);
  // In NDC y-up after flip, positive cross means facing camera
  const forward = { x: 0, y: 0, z: nx >= 0 ? 1 : -1 };

  // Orthonormalize
  const r3 = { x: rightV.x, y: rightV.y, z: 0.05 * (tr.x - tl.x) };
  const rN = Math.hypot(r3.x, r3.y, r3.z) || 1;
  r3.x /= rN;
  r3.y /= rN;
  r3.z /= rN;
  const u3 = {
    x: upV.x,
    y: upV.y,
    z: 0.05 * (tl.y - bl.y),
  };
  const uN = Math.hypot(u3.x, u3.y, u3.z) || 1;
  u3.x /= uN;
  u3.y /= uN;
  u3.z /= uN;

  const quaternion = quatFromAxes(r3, u3, forward);

  // Scale head (~radius 1) to fit inside frame
  const scale = Math.max(0.25, Math.min(2.2, (frameW * 0.85) / Math.max(0.15, ndcWidth * z * 0.5)));

  return {
    position: { x, y, z: -z },
    quaternion: quaternion.w ? quaternion : { ...IDENTITY_QUAT },
    // Hand tracking represents a physical sensor/head overlay. Keep its world
    // size physical; perspective and z now produce the apparent screen size.
    scale:
      quad.source === "hand"
        ? 0.12
        : Math.max(0.35, Math.min(1.8, z * ndcHeight * 0.55)),
    ndcWidth,
    ndcHeight,
    confidence: quad.confidence,
    receivedAt: performance.now(),
    source: quad.source,
  };
}

export function smoothFramePose(prev: FramePose | null, next: FramePose, alpha = 0.35): FramePose {
  if (!prev) return next;
  const lerp = (a: number, b: number) => a + (b - a) * alpha;
  // Hemisphere-safe quat nlerp
  let bw = next.quaternion.w;
  let bx = next.quaternion.x;
  let by = next.quaternion.y;
  let bz = next.quaternion.z;
  const dot =
    prev.quaternion.w * bw +
    prev.quaternion.x * bx +
    prev.quaternion.y * by +
    prev.quaternion.z * bz;
  if (dot < 0) {
    bw = -bw;
    bx = -bx;
    by = -by;
    bz = -bz;
  }
  return {
    position: {
      x: lerp(prev.position.x, next.position.x),
      y: lerp(prev.position.y, next.position.y),
      z: lerp(prev.position.z, next.position.z),
    },
    quaternion: quatNormalize({
      w: lerp(prev.quaternion.w, bw),
      x: lerp(prev.quaternion.x, bx),
      y: lerp(prev.quaternion.y, by),
      z: lerp(prev.quaternion.z, bz),
    }),
    scale: lerp(prev.scale, next.scale),
    ndcWidth: lerp(prev.ndcWidth, next.ndcWidth),
    ndcHeight: lerp(prev.ndcHeight, next.ndcHeight),
    confidence: next.confidence,
    receivedAt: next.receivedAt,
    source: next.source,
  };
}
