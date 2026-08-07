import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { poseBuffer } from "@/features/ar-slice/arSliceStore";

/** Cube that follows the calibrated frame orientation (hot path via poseBuffer). */
export function DebugCube({ visible = true }: { visible?: boolean }) {
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || !visible) return;
    const q = poseBuffer.display;
    mesh.quaternion.set(q.x, q.y, q.z, q.w);
  });

  if (!visible) return null;

  return (
    <group position={[1.4, 0.9, 0]}>
      <mesh ref={meshRef} scale={0.28}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#38bdf8" metalness={0.2} roughness={0.45} />
      </mesh>
      {/* Front face marker (+Z) */}
      <mesh position={[0, 0, 0.15]} scale={0.28}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}
