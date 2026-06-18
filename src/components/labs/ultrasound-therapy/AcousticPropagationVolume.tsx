/**
 * Volume educacional de propagação acústica — InstancedMesh leve (sem volume rendering).
 */

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
} from "three";
import {
  getMaxPropagationInstances,
  shouldUseHighDensityEffects,
} from "@/lib/ultrasoundVisualQuality";
import { getPropagationColorUpdateInterval } from "@/lib/therapeuticLabsPerformance";
import type { UltrasoundInteractionMap } from "@/lib/ultrasoundTherapyInteractionMap";
import type { UltrasoundVisualizationOptions } from "@/types/ultrasoundTherapyConfig";

const SKIN_Y = 0;
const LATERAL_SPAN = 3.6;
const MAX_INSTANCES = getMaxPropagationInstances();
const MIN_SCORE = shouldUseHighDensityEffects() ? 0.07 : 0.1;

interface AcousticPropagationVolumeProps {
  interactionMap: UltrasoundInteractionMap;
  options: UltrasoundVisualizationOptions;
  position?: { x: number; y: number };
}

interface ScoredCell {
  index: number;
  score: number;
}

function computeCellScore(
  cell: UltrasoundInteractionMap["cells"][number],
  options: UltrasoundVisualizationOptions,
): number {
  let score = 0;
  if (options.showPropagation) score += cell.relativeIntensity * 1.2;
  if (options.showAttenuation) score += cell.attenuationLoss * 0.45;
  if (options.showReflection) score += cell.reflectionIndex * 1.1;
  if (options.showStandingWaves) score += cell.standingWaveIndex * 0.9;
  if (options.showTissueResponse) score += (cell.estimatedTemp - 37) / 15;
  if (options.showThermalDamage) score += cell.lesionIndex * 1.15;
  if (options.showAblation) score += cell.ablationIndex * 1.25;
  if (options.showCavitation) score += cell.cavitationIndex * 0.85;
  return score;
}

function computeCellColor(
  cell: UltrasoundInteractionMap["cells"][number],
  options: UltrasoundVisualizationOptions,
  pulse: number,
  standingPhase: number,
): { color: Color; opacity: number } {
  const color = new Color(0, 0, 0);
  let opacity = 0;

  if (options.showPropagation) {
    const t = cell.relativeIntensity;
    color.r += 0.15 * t;
    color.g += 0.55 * t + 0.12 * t;
    color.b += 0.95 * t + 0.2;
    opacity = Math.max(opacity, 0.12 + t * 0.42);
  }

  if (options.showAttenuation) {
    const fade = 1 - cell.attenuationLoss * 0.55;
    opacity *= Math.max(0.35, fade);
    color.multiplyScalar(0.85 + fade * 0.15);
  }

  if (options.showReflection && cell.reflectionIndex > 0.08) {
    const r = cell.reflectionIndex;
    color.r += r * 0.95;
    color.g += r * 0.55;
    color.b += r * 0.05;
    opacity = Math.max(opacity, 0.2 + r * 0.45);
  }

  if (options.showStandingWaves && cell.standingWaveIndex > 0.05) {
    const band = 0.5 + 0.5 * Math.sin(cell.depthCm * 14 + standingPhase);
    const w = cell.standingWaveIndex * band;
    color.r += w * 0.35;
    color.g += w * 0.25;
    color.b += w * 0.65;
    opacity = Math.max(opacity, w * 0.35);
  }

  if (options.showTissueResponse) {
    const heat = Math.max(0, (cell.estimatedTemp - 37) / 12);
    color.r += heat * 0.55;
    color.g += heat * 0.22;
    opacity = Math.max(opacity, heat * 0.35);
  }

  if (options.showThermalDamage && cell.lesionIndex > 0.06) {
    const l = cell.lesionIndex;
    color.r += l * 0.85;
    color.g += l * 0.28;
    opacity = Math.max(opacity, 0.18 + l * 0.5);
  }

  if (options.showAblation && cell.ablationIndex > 0.08) {
    const a = cell.ablationIndex;
    color.r += a * 0.75;
    color.g += a * 0.15;
    color.b += a * 0.12;
    opacity = Math.max(opacity, 0.22 + a * 0.55);
  }

  if (options.showCavitation && cell.cavitationIndex > 0.06) {
    const c = cell.cavitationIndex * (0.75 + pulse * 0.25);
    color.r += c * 0.25;
    color.g += c * 0.45;
    color.b += c * 0.75;
    opacity = Math.max(opacity, 0.15 + c * 0.4);
  }

  if (options.showSafetyZones && cell.estimatedTemp <= 41 && cell.lesionIndex < 0.12) {
    color.g += 0.12;
    opacity = Math.max(opacity, 0.06);
  }

  const maxChannel = Math.max(color.r, color.g, color.b, 0.001);
  if (maxChannel > 1) {
    color.multiplyScalar(1 / maxChannel);
  }

  return { color, opacity: Math.min(0.85, opacity) };
}

export function AcousticPropagationVolume({
  interactionMap,
  options,
  position = { x: 0, y: 0 },
}: AcousticPropagationVolumeProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const tempObject = useMemo(() => new Object3D(), []);
  const maxInstances = MAX_INSTANCES;
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        vertexColors: false,
      }),
    [],
  );

  const pickedIndices = useMemo(() => {
    if (!options.showPropagation && !options.showAttenuation && !options.showReflection &&
        !options.showStandingWaves && !options.showTissueResponse && !options.showThermalDamage &&
        !options.showAblation && !options.showCavitation) {
      return [] as ScoredCell[];
    }

    const scored: ScoredCell[] = [];
    interactionMap.cells.forEach((cell, index) => {
      const score = computeCellScore(cell, options);
      if (score >= MIN_SCORE) {
        scored.push({ index, score });
      }
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxInstances);
  }, [interactionMap.cells, options, maxInstances]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || mesh.instanceMatrix.count < maxInstances) return;

    if (!mesh.instanceColor || mesh.instanceColor.count < maxInstances) {
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(maxInstances * 3), 3);
    }

    const xOffset = position.x * 8;
    const zOffset = position.y * 3;
    const { width } = interactionMap;

    for (let i = 0; i < maxInstances; i++) {
      if (i >= pickedIndices.length) {
        tempObject.position.set(0, -999, 0);
        tempObject.scale.setScalar(0);
        tempObject.updateMatrix();
        mesh.setMatrixAt(i, tempObject.matrix);
        mesh.setColorAt(i, new Color(0, 0, 0));
        continue;
      }

      const cell = interactionMap.cells[pickedIndices[i].index];
      const col = Math.round(((cell.xNorm + 1) / 2) * (width - 1));

      const baseSize = 0.07 + cell.relativeIntensity * 0.09;
      const sliceZ = ((col / Math.max(1, width - 1)) - 0.5) * 0.22;

      tempObject.position.set(
        cell.xNorm * LATERAL_SPAN + xOffset,
        SKIN_Y - cell.depthCm,
        sliceZ + zOffset,
      );
      tempObject.scale.set(baseSize * 1.1, baseSize * 0.85, baseSize * 0.55);
      tempObject.rotation.set(0, 0, 0);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);

      const { color, opacity } = computeCellColor(cell, options, 0, 0);
      color.multiplyScalar(Math.max(0.15, opacity));
      mesh.setColorAt(i, color);
    }

    mesh.count = Math.min(pickedIndices.length, maxInstances);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [interactionMap, options, pickedIndices, position.x, position.y, maxInstances, tempObject]);

  const frameCounter = useRef(0);
  const colorUpdateInterval = getPropagationColorUpdateInterval();

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh || pickedIndices.length === 0 || mesh.instanceMatrix.count < maxInstances) return;
    if (!mesh.instanceColor || mesh.instanceColor.count < pickedIndices.length) return;

    frameCounter.current += 1;
    if (frameCounter.current % colorUpdateInterval !== 0) return;

    const pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 3.2);
    const standingPhase = clock.getElapsedTime() * 2;

    for (let i = 0; i < pickedIndices.length; i++) {
      const cell = interactionMap.cells[pickedIndices[i].index];
      const { color, opacity } = computeCellColor(cell, options, pulse, standingPhase);
      color.multiplyScalar(Math.max(0.15, opacity));
      mesh.setColorAt(i, color);
    }

    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (pickedIndices.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, maxInstances]}
      frustumCulled={false}
      renderOrder={6}
    />
  );
}

/** Anel de zona segura (contorno verde translúcido) */
export function AcousticSafetyZoneRing({
  effectiveDepth,
  beamRadius,
  position = { x: 0, y: 0 },
}: {
  effectiveDepth: number;
  beamRadius: number;
  position?: { x: number; y: number };
}) {
  if (effectiveDepth <= 0.05) return null;

  const xOffset = position.x * 8;
  const zOffset = position.y * 3;
  const r = Math.max(0.15, beamRadius);

  return (
    <mesh position={[xOffset, SKIN_Y - effectiveDepth, zOffset]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
      <ringGeometry args={[r * 0.88, r * 1.05, 48]} />
      <meshBasicMaterial
        color="#4ade80"
        transparent
        opacity={0.28}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}
