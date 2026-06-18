/**
 * CavitationEffect - Visualiza efeito de cavitação (lúdico e didático)
 * Densidade ∝ intensity; ritmo ∝ dutyCycle (modo pulsado)
 */

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, MeshStandardMaterial, Object3D, SphereGeometry } from "three";
import { useUltrasoundTherapyStore } from "@/stores/ultrasoundTherapyStore";
import { getMaxBubbleCount } from "@/lib/ultrasoundVisualQuality";

const SPHERE_SEGMENTS = 6;

function hash(n: number, salt: number): number {
  const x = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function buildBubbleSeeds(max: number) {
  return Array.from({ length: max }, (_, i) => ({
    initialX: (hash(i, 1) - 0.5) * 2,
    initialZ: (hash(i, 2) - 0.5) * 2,
    initialY: -0.5 - hash(i, 3) * 2,
    size: 0.05 + hash(i, 4) * 0.08,
    speed: 0.3 + hash(i, 5) * 0.4,
    phase: hash(i, 6) * Math.PI * 2,
  }));
}

function intensityToActiveCount(
  intensity: number,
  minIntensity: number,
  maxIntensity: number,
  maxBubbles: number,
): number {
  const span = Math.max(maxIntensity - minIntensity, 0.01);
  const normalized = Math.min(Math.max((intensity - minIntensity) / span, 0), 1);
  const eased = normalized * normalized;
  if (eased <= 0.02) return 0;
  return Math.max(1, Math.round(eased * maxBubbles));
}

function getPulseState(
  time: number,
  mode: "continuous" | "pulsed",
  dutyCycle: number,
): { active: number; animSpeed: number } {
  if (mode === "continuous") {
    return { active: 1, animSpeed: 1 };
  }

  const duty = Math.min(Math.max(dutyCycle, 5), 100);
  const onFraction = duty / 100;
  const pulsePeriod = 0.6 + (100 - duty) * 0.012;
  const cyclePos = (time % pulsePeriod) / pulsePeriod;
  const isOn = cyclePos < onFraction;
  const edgeBlend =
    onFraction > 0.01
      ? Math.min(cyclePos / onFraction, (1 - cyclePos) / (1 - onFraction), 1)
      : 0;

  return {
    active: isOn ? 0.25 + edgeBlend * 0.75 : 0.15,
    animSpeed: 0.4 + onFraction * 1.6,
  };
}

export function CavitationEffect() {
  const meshRef = useRef<InstancedMesh>(null);
  const tempObject = useMemo(() => new Object3D(), []);
  const maxBubbles = useMemo(() => getMaxBubbleCount(), []);
  const bubbleSeeds = useMemo(() => buildBubbleSeeds(maxBubbles), [maxBubbles]);
  const geometry = useMemo(
    () => new SphereGeometry(1, SPHERE_SEGMENTS, SPHERE_SEGMENTS),
    [],
  );
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#60a5fa",
        emissive: "#3b82f6",
        emissiveIntensity: 0.5,
        opacity: 0.7,
        transparent: true,
        roughness: 0.1,
        metalness: 0.3,
      }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || mesh.instanceMatrix.count < maxBubbles) return;

    for (let i = 0; i < maxBubbles; i++) {
      tempObject.position.set(0, -999, 0);
      tempObject.scale.setScalar(0);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = 0;
  }, [tempObject, maxBubbles]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh || mesh.instanceMatrix.count < maxBubbles) return;

    const { intensity, dutyCycle, mode, ranges } =
      useUltrasoundTherapyStore.getState().config;
    const simulationResult = useUltrasoundTherapyStore.getState().simulationResult;
    const cavitationIndex =
      simulationResult?.physiologyResponse?.cavitationRiskIndex ??
      simulationResult?.interactionMap?.summary.maxCavitationIndex ??
      0;

    const activeCount = intensityToActiveCount(
      intensity * (0.35 + cavitationIndex * 0.65),
      ranges.intensity.min,
      ranges.intensity.max,
      maxBubbles,
    );

    const time = clock.getElapsedTime();
    const { active: pulseActive, animSpeed } = getPulseState(time, mode, dutyCycle);
    const riseSpeed = (0.35 + intensity * 0.15) * animSpeed;

    mesh.count = activeCount;

    for (let i = 0; i < maxBubbles; i++) {
      const seed = bubbleSeeds[i];

      if (i >= activeCount) {
        tempObject.position.set(0, -999, 0);
        tempObject.scale.setScalar(0);
        tempObject.updateMatrix();
        mesh.setMatrixAt(i, tempObject.matrix);
        continue;
      }

      const localPhase = time * riseSpeed * seed.speed + seed.phase;
      const yPos = seed.initialY + Math.sin(localPhase) * 0.3;
      const xPos = seed.initialX + Math.cos(localPhase * 0.7) * 0.2;
      const zPos = seed.initialZ + Math.sin(localPhase * 0.5) * 0.2;
      const scale = seed.size * (0.35 + pulseActive * 0.65);

      tempObject.position.set(xPos, yPos, zPos);
      tempObject.scale.setScalar(scale);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;

    const material = mesh.material;
    if (material && !Array.isArray(material) && "opacity" in material) {
      material.opacity = 0.12 + pulseActive * 0.55;
      material.emissiveIntensity = 0.15 + pulseActive * 0.45;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, maxBubbles]}
      frustumCulled={false}
    />
  );
}
