import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { touchReference } from "@/features/ar-slice/touchReference";

type Props = {
  /** Active while the moldura is streaming — finger retunes reference, not orbit. */
  enabled: boolean;
};

/**
 * One-finger drag → yaw/pitch offset that rotates the anatomy under the cut.
 * Two-finger gestures are ignored so OrbitControls pinch-zoom still works.
 */
export function TouchReferenceAdjust({ enabled }: Props) {
  const { gl } = useThree();
  const activeId = useRef<number | null>(null);
  const lastX = useRef(0);
  const lastY = useRef(0);

  useEffect(() => {
    const el = gl.domElement;
    if (!enabled) {
      activeId.current = null;
      return;
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // Second finger → pinch zoom; release reference drag.
      if (activeId.current != null && activeId.current !== e.pointerId) {
        activeId.current = null;
        return;
      }
      if (e.isPrimary === false) {
        activeId.current = null;
        return;
      }
      activeId.current = e.pointerId;
      lastX.current = e.clientX;
      lastY.current = e.clientY;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (activeId.current !== e.pointerId) return;
      const dx = e.clientX - lastX.current;
      const dy = e.clientY - lastY.current;
      lastX.current = e.clientX;
      lastY.current = e.clientY;
      if (dx === 0 && dy === 0) return;
      const rect = el.getBoundingClientRect();
      touchReference.applyFingerDelta(dx, dy, rect.width, rect.height);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (activeId.current !== e.pointerId) return;
      activeId.current = null;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      activeId.current = null;
    };
  }, [enabled, gl]);

  return null;
}
