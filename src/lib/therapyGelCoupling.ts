import {
  sampleMergedGelHeight,
  type GelStamp,
} from "@/components/labs/ultrasound-therapy/gelSurface";
import type { CouplingQuality } from "@/types/ultrasoundTherapyConfig";
import type { GelSurfaceRuntime } from "./therapyGelSurfaceRuntime";

const SPREAD_SCALE = 1.68;
/** Fração da altura base do gel necessária na área de contato para acoplamento bom */
const GOOD_HEIGHT_RATIO = 0.22;
/** Fração mínima de pontos amostrados com gel sob a face */
const MIN_COVERAGE_RATIO = 0.5;

function createSeededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function transducerPositionToWorldXZ(position: { x: number; y: number }) {
  return { x: position.x * 8, z: position.y * 3 };
}

export function contactRadiusFromFace(faceRadius: number): number {
  return faceRadius * SPREAD_SCALE * 0.94;
}

function sampleContactGelCoverage(
  worldX: number,
  worldZ: number,
  contactRadius: number,
  stamps: GelStamp[],
  baseRadius: number,
  baseHeight: number,
): { avgHeight: number; coverage: number } {
  const offsets = [
    [0, 0],
    [0.55, 0],
    [-0.55, 0],
    [0, 0.55],
    [0, -0.55],
    [0.4, 0.4],
    [-0.4, 0.4],
    [0.4, -0.4],
    [-0.4, -0.4],
  ];

  let sum = 0;
  let covered = 0;
  for (const [ox, oz] of offsets) {
    const h = sampleMergedGelHeight(
      worldX + ox * contactRadius,
      worldZ + oz * contactRadius,
      stamps,
      baseRadius,
      baseHeight,
    );
    sum += h;
    if (h >= baseHeight * GOOD_HEIGHT_RATIO * 0.45) {
      covered += 1;
    }
  }
  return { avgHeight: sum / offsets.length, coverage: covered / offsets.length };
}

export function evaluateEffectiveCoupling(
  position: { x: number; y: number } | undefined,
  runtime: GelSurfaceRuntime | null,
  preparationCoupling: CouplingQuality,
): CouplingQuality {
  if (preparationCoupling === "poor") {
    return "poor";
  }

  if (!runtime || !position || runtime.stamps.length === 0) {
    return preparationCoupling;
  }

  const { x, z } = transducerPositionToWorldXZ(position);
  const contactRadius = contactRadiusFromFace(runtime.faceRadius);
  const { avgHeight, coverage } = sampleContactGelCoverage(
    x,
    z,
    contactRadius,
    runtime.stamps,
    runtime.baseRadius,
    runtime.baseHeight,
  );

  const threshold = runtime.baseHeight * GOOD_HEIGHT_RATIO;
  return avgHeight >= threshold && coverage >= MIN_COVERAGE_RATIO ? "good" : "poor";
}
