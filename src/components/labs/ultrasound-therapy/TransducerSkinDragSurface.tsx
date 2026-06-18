/**
 * Arraste direto na pele 3D — plano invisível em y ≈ 0
 */

import { useCallback, useEffect, useRef } from "react";
import { ThreeEvent, useThree } from "@react-three/fiber";
import { Mesh, Raycaster, Vector2 } from "three";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { therapyBeamWorldRef } from "@/lib/therapyRuntimeRefs";

const WORLD_X = 8;
const WORLD_Z = 3;

interface TransducerSkinDragSurfaceProps {
  onDraggingChange?: (dragging: boolean) => void;
}

export function TransducerSkinDragSurface({ onDraggingChange }: TransducerSkinDragSurfaceProps) {
  const { camera, gl } = useThree();
  const { updateTransducerPosition, flushSimulation } = useUltrasoundTherapyStore();
  const planeRef = useRef<Mesh>(null);
  const draggingRef = useRef(false);
  const raycasterRef = useRef(new Raycaster());
  const pointerRef = useRef(new Vector2());

  const applyPoint = useCallback(
    (x: number, z: number, commit = false) => {
      therapyBeamWorldRef.x = x;
      therapyBeamWorldRef.z = z;
      updateTransducerPosition(
        {
          x: Math.max(-1, Math.min(1, x / WORLD_X)),
          y: Math.max(-1, Math.min(1, z / WORLD_Z)),
        },
        { commit },
      );
    },
    [updateTransducerPosition],
  );

  const raycastFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const plane = planeRef.current;
      if (!plane) return;
      const rect = gl.domElement.getBoundingClientRect();
      pointerRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      const hits = raycasterRef.current.intersectObject(plane);
      if (hits[0]) {
        applyPoint(hits[0].point.x, hits[0].point.z);
      }
    },
    [applyPoint, camera, gl.domElement],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      raycastFromClient(e.clientX, e.clientY);
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      onDraggingChange?.(false);
      flushSimulation();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onDraggingChange, raycastFromClient, flushSimulation]);

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      draggingRef.current = true;
      onDraggingChange?.(true);
      applyPoint(e.point.x, e.point.z);
    },
    [applyPoint, onDraggingChange],
  );

  return (
    <mesh
      ref={planeRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.008, 0]}
      onPointerDown={handlePointerDown}
    >
      <planeGeometry args={[17.5, 7.5]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
