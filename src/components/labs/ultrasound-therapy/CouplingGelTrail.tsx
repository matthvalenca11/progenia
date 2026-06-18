/**
 * CouplingGelTrail — gel pré-aplicado na pele.
 * Bom acoplamento: mais gel, já bem espalhado. Ruim: menos gel, mal espalhado.
 * O transdutor só nudge mínimo ao varrer (já está no estado final de espalhamento).
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, SphereGeometry } from "three";
import {
  resolveTransducerFace,
  type TherapeuticTransducerType,
} from "@/config/therapeuticTransducerDefinitions";
import { THERAPY_GEL_GOOD, THERAPY_GEL_POOR } from "./therapyVisualConstants";
import {
  createGelSurfaceGeometry,
  type GelStamp,
  normalizeStampVolume,
  patchGelMaterial,
  spreadStampInPlace,
  totalStampVolume,
  updateGelSurfaceGeometry,
} from "./gelSurface";
import {
  getGelStampCountRange,
  getGelVoidBubbleCount,
  shouldEnableRealTimeShadows,
} from "@/lib/ultrasoundVisualQuality";
import { therapyBeamWorldRef } from "@/lib/therapyRuntimeRefs";
import { setGelSurfaceRuntime } from "@/lib/therapyGelSurfaceRuntime";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";

const CAST_SHADOW = shouldEnableRealTimeShadows();

const SPREAD_SCALE = 1.68;
const SKIN_Y = 0.012;

interface CouplingGelTrailProps {
  era: number;
  transducerType?: TherapeuticTransducerType;
  coupling?: "good" | "poor";
  movement?: "stationary" | "scanning";
  position?: { x: number; y: number };
}

function toWorldXZ(position: { x: number; y: number }) {
  return { x: position.x * 8, z: position.y * 3 };
}

function createSeededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function seedAppliedGel(coupling: "good" | "poor"): GelStamp[] {
  const isGood = coupling === "good";
  const range = getGelStampCountRange(coupling);
  const rng = createSeededRng(isGood ? 0x7a3f0001 : 0x9c2b0001);
  const count = range.min + Math.floor(rng() * (range.max - range.min + 1));
  const stamps: GelStamp[] = [];

  /** Bom acoplamento: mancha central (onde o transdutor inicia) — fora dela perde acoplamento */
  const spreadX = isGood ? 3.4 : 10.5;
  const spreadZ = isGood ? 1.45 : 4;

  for (let i = 0; i < count; i++) {
    if (isGood) {
      stamps.push({
        x: (rng() - 0.5) * spreadX,
        z: (rng() - 0.5) * spreadZ,
        radiusMul: 0.74 + rng() * 0.26,
        heightMul: 0.46 + rng() * 0.16,
        stretch: 1.06 + rng() * 0.18,
        rot: rng() * Math.PI * 2,
      });
    } else {
      stamps.push({
        x: (rng() - 0.5) * spreadX,
        z: (rng() - 0.5) * spreadZ,
        radiusMul: 0.2 + rng() * 0.22,
        heightMul: 0.88 + rng() * 0.28,
        stretch: 0.86 + rng() * 0.14,
        rot: rng() * Math.PI * 2,
      });
    }
  }

  if (!isGood) {
    normalizeStampVolume(stamps, totalStampVolume(stamps) * 1.82);
  }

  return stamps;
}

function GelVoidBubbles({ count }: { count: number }) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const geometry = useMemo(() => new SphereGeometry(1, 6, 6), []);
  const material = useMemo(
    () => new MeshBasicMaterial({ color: "#e8f4ff", transparent: true, opacity: 0.35, depthWrite: false }),
    [],
  );
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (Math.sin(i * 4.17) * 0.5 + 0.5) * 10 - 5,
        z: (Math.cos(i * 3.91) * 0.5 + 0.5) * 4 - 2,
        r: 0.04 + (i % 5) * 0.018,
        y: 0.012 + (i % 3) * 0.008,
      })),
    [count],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0 || mesh.instanceMatrix.count < count) return;
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      dummy.position.set(s.x, s.y, s.z);
      dummy.scale.setScalar(s.r);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [count, dummy, seeds]);

  if (count === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, count]} frustumCulled={false} renderOrder={31} />
  );
}

/** Bom acoplamento: puxa gel existente levemente para o corredor da varredura (sem volume novo) */
function relaxGelTowardPath(
  stamps: GelStamp[],
  tx: number,
  tz: number,
  dx: number,
  dz: number,
  faceRadius: number,
  volumeBudget: number,
) {
  const contactR = faceRadius * SPREAD_SCALE * 0.94;
  const reachR = contactR * 1.48;
  let affected = false;

  for (const stamp of stamps) {
    const dist = Math.hypot(stamp.x - tx, stamp.z - tz);
    if (dist > reachR) continue;

    affected = true;
    const influence = 1 - dist / reachR;
    const pull = influence * 0.024;
    stamp.x += (tx - stamp.x) * pull;
    stamp.z += (tz - stamp.z) * pull;

    if (dist < contactR) {
      spreadStampInPlace(stamp, influence * 0.0048, 1.06);
    }

    if (Math.hypot(dx, dz) > 0.001) {
      stamp.rot = Math.atan2(dz, dx);
      const stretchDelta = influence * 0.012;
      const nextStretch = Math.min(1.1, stamp.stretch + stretchDelta);
      if (nextStretch > stamp.stretch) {
        stamp.heightMul = Math.max(0.38, (stamp.heightMul * stamp.stretch) / nextStretch);
        stamp.stretch = nextStretch;
      }
    }
  }

  if (affected) {
    normalizeStampVolume(stamps, volumeBudget);
  }
}

/** Nudge mínimo — gel já está espalhado antes da varredura */
function nudgeGelOnPass(
  stamps: GelStamp[],
  tx: number,
  tz: number,
  dx: number,
  dz: number,
  faceRadius: number,
  coupling: "good" | "poor",
  volumeBudget: number,
) {
  const isGood = coupling === "good";
  if (!isGood && Math.random() > 0.35) return;

  if (isGood) {
    relaxGelTowardPath(stamps, tx, tz, dx, dz, faceRadius, volumeBudget);
    return;
  }

  const contactR = faceRadius * SPREAD_SCALE * 0.94;
  let touched = 0;

  for (const stamp of stamps) {
    const dist = Math.hypot(stamp.x - tx, stamp.z - tz);
    if (dist > contactR) continue;

    touched++;
    const influence = 1 - dist / contactR;
    const spread = influence * (isGood ? 0.0035 : 0.001);
    spreadStampInPlace(stamp, spread, isGood ? 1.04 : 1.02);

    if (Math.hypot(dx, dz) > 0.001) {
      stamp.rot = Math.atan2(dz, dx);
    }
  }

  if (touched > 0) {
    normalizeStampVolume(stamps, volumeBudget);
  }
}

export function CouplingGelTrail({
  era,
  transducerType = "planar_circular",
  coupling = "good",
  movement = "stationary",
  position = { x: 0, y: 0 },
}: CouplingGelTrailProps) {
  const faceRadius = useMemo(() => {
    const face = resolveTransducerFace(transducerType, era);
    if (face.kind === "rounded_rect") {
      return Math.sqrt(
        ((face.activeHalfW ?? 0) * 2 * (face.activeHalfD ?? 0) * 2) / Math.PI,
      );
    }
    return face.activeR ?? face.eqR;
  }, [transducerType, era]);

  const isGood = coupling === "good";
  const baseRadius = faceRadius * 0.88 * SPREAD_SCALE;
  const baseHeight = faceRadius * 0.11;

  const geometry = useMemo(() => createGelSurfaceGeometry(), []);
  const material = useMemo(() => {
    const gel = coupling === "good" ? THERAPY_GEL_GOOD : THERAPY_GEL_POOR;
    const mat = new MeshStandardMaterial({
      color: gel.color,
      transparent: true,
      opacity: gel.opacity,
      roughness: gel.roughness,
      metalness: 0,
      emissive: gel.emissive,
      emissiveIntensity: gel.emissiveIntensity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    patchGelMaterial(mat);
    return mat;
  }, [coupling]);

  const voidBubbleCount = coupling === "poor" ? getGelVoidBubbleCount("poor") : 0;

  const meshRef = useRef<Mesh>(null);
  const stampsRef = useRef<GelStamp[]>([]);
  const volumeBudgetRef = useRef(0);
  const lastPosRef = useRef<{ x: number; z: number } | null>(null);
  const nextSpacingRef = useRef(faceRadius * 0.22);
  const positionRef = useRef(position);

  positionRef.current = position;

  useEffect(() => {
    stampsRef.current = seedAppliedGel(coupling);
    volumeBudgetRef.current = totalStampVolume(stampsRef.current);
    lastPosRef.current = null;
    nextSpacingRef.current = faceRadius * 0.22;
    updateGelSurfaceGeometry(geometry, stampsRef.current, baseRadius, baseHeight);
    setGelSurfaceRuntime({
      stamps: stampsRef.current,
      baseRadius,
      baseHeight,
      faceRadius,
      preparationCoupling: coupling,
    });
    useUltrasoundTherapyStore.getState().runSimulation();
  }, [coupling, faceRadius, transducerType, geometry, baseRadius, baseHeight]);

  const lastGelSimRef = useRef(0);

  useFrame(() => {
    const x = therapyBeamWorldRef.x;
    const z = therapyBeamWorldRef.z;
    let gelChanged = false;

    if (movement === "scanning") {
      const last = lastPosRef.current;
      const dx = last ? x - last.x : 0;
      const dz = last ? z - last.z : 0;

      if (!last) {
        if (isGood) {
          relaxGelTowardPath(
            stampsRef.current,
            x,
            z,
            dx,
            dz,
            faceRadius,
            volumeBudgetRef.current,
          );
        }
        lastPosRef.current = { x, z };
      } else if (Math.hypot(x - last.x, z - last.z) >= nextSpacingRef.current) {
        nudgeGelOnPass(
          stampsRef.current,
          x,
          z,
          dx,
          dz,
          faceRadius,
          coupling,
          volumeBudgetRef.current,
        );
        lastPosRef.current = { x, z };
        nextSpacingRef.current = faceRadius * (isGood ? 0.1 + Math.random() * 0.06 : 0.2 + Math.random() * 0.12);
        gelChanged = true;
      }
    } else {
      lastPosRef.current = null;
    }

    updateGelSurfaceGeometry(geometry, stampsRef.current, baseRadius, baseHeight);
    setGelSurfaceRuntime({
      stamps: stampsRef.current,
      baseRadius,
      baseHeight,
      faceRadius,
      preparationCoupling: coupling,
    });

    if (gelChanged) {
      const now = performance.now();
      if (now - lastGelSimRef.current >= 180) {
        lastGelSimRef.current = now;
        useUltrasoundTherapyStore.getState().flushSimulation();
      }
    }
  });

  return (
    <>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        position={[0, SKIN_Y, 0]}
        renderOrder={30}
        frustumCulled={false}
        castShadow={CAST_SHADOW}
      />
      <GelVoidBubbles count={voidBubbleCount} />
    </>
  );
}
