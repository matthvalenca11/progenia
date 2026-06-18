/**
 * Varredura do transdutor via useFrame — evita setState a 10 Hz e rebuild de texturas.
 */

import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { therapyBeamWorldRef } from "@/lib/therapyRuntimeRefs";

const WORLD_X = 8;
const WORLD_Z = 3;
const SCAN_AMPLITUDE = 0.22;

interface TherapyScanGroupProps {
  basePosition: { x: number; y: number };
  movement: "stationary" | "scanning";
  paused: boolean;
  children: ReactNode;
}

export function TherapyScanGroup({
  basePosition,
  movement,
  paused,
  children,
}: TherapyScanGroupProps) {
  const groupRef = useRef<Group>(null);
  const scanTimeRef = useRef(0);

  useFrame((_, delta) => {
    const scanning = movement === "scanning" && !paused;
    if (scanning) {
      scanTimeRef.current += delta;
    } else {
      scanTimeRef.current = 0;
    }

    const normX = scanning
      ? basePosition.x + Math.sin(scanTimeRef.current) * SCAN_AMPLITUDE
      : basePosition.x;
    const normY = basePosition.y;

    therapyBeamWorldRef.x = normX * WORLD_X;
    therapyBeamWorldRef.z = normY * WORLD_Z;

    groupRef.current?.position.set(therapyBeamWorldRef.x, 0, therapyBeamWorldRef.z);
  });

  return <group ref={groupRef}>{children}</group>;
}
