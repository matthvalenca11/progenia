import type { GelStamp } from "@/components/labs/ultrasound-therapy/gelSurface";

export interface GelSurfaceRuntime {
  stamps: GelStamp[];
  baseRadius: number;
  baseHeight: number;
  faceRadius: number;
  preparationCoupling: "good" | "poor";
}

let runtime: GelSurfaceRuntime | null = null;

export function setGelSurfaceRuntime(state: GelSurfaceRuntime): void {
  runtime = state;
}

export function getGelSurfaceRuntime(): GelSurfaceRuntime | null {
  return runtime;
}

export function clearGelSurfaceRuntime(): void {
  runtime = null;
}
