import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { usePhotobioStore } from "@/stores/photobioStore";

const SCAN_AMPLITUDE = 2.3;
const SCAN_FREQUENCY = 1.05;

interface PhotobioScanAnimatorProps {
  enabled: boolean;
  speed: number;
}

/** Anima transducerX em varredura sinusoidal quando o modo scanning está ativo. */
export function PhotobioScanAnimator({ enabled, speed }: PhotobioScanAnimatorProps) {
  const setTransducerX = usePhotobioStore((s) => s.setTransducerX);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    if (!enabled) {
      timeRef.current = 0;
      return;
    }
    timeRef.current += delta * Math.max(0.2, speed);
    const x = Math.sin(timeRef.current * SCAN_FREQUENCY) * SCAN_AMPLITUDE;
    setTransducerX(x);
  });

  return null;
}
