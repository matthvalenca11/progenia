import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PhotobioWavelength } from "@/lib/photobioOptics";
import type { PhotobioInteractionMap } from "@/lib/photobioInteractionMap";
import {
  buildScatterParticlesFromMap,
  getWavelengthBeamColors,
} from "./photobioBeamVisual";
import { clamp } from "./photobioViewerLayout";

const PARTICLE_GEO = new THREE.SphereGeometry(0.035, 8, 8);

interface PhotobioScatterFieldProps {
  interactionMap: PhotobioInteractionMap;
  contactSurfaceY: number;
  wavelength: PhotobioWavelength;
  maxCount: number;
  intensityScale: number;
  isPulsed: boolean;
  dutyCycle: number;
}

export function PhotobioScatterField({
  interactionMap,
  contactSurfaceY,
  wavelength,
  maxCount,
  intensityScale,
  isPulsed,
  dutyCycle,
}: PhotobioScatterFieldProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = getWavelengthBeamColors(wavelength);

  const particles = useMemo(
    () =>
      buildScatterParticlesFromMap(
        interactionMap,
        maxCount,
        contactSurfaceY,
        interactionMap.maxDepthMm,
      ),
    [interactionMap, maxCount, contactSurfaceY],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    particles.forEach((p, i) => {
      const scale = 0.5 + p.weight * (wavelength === 808 ? 1.4 : 0.9);
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, new THREE.Color(colors.scatter));
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [particles, dummy, colors.scatter, wavelength]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const t = clock.getElapsedTime();
    const pulsePeriod = 0.85;
    const dutyNorm = clamp(dutyCycle / 100, 0.1, 0.9);
    const phase = (t % pulsePeriod) / pulsePeriod;
    const pulse = isPulsed ? (phase < dutyNorm ? 1 : 0.15) : 1;

    particles.forEach((p, i) => {
      const drift = 0.04 * Math.sin(t * 2.2 + i * 0.7);
      dummy.position.set(p.x + drift * 0.3, p.y + drift * 0.15, p.z + drift * 0.5);
      dummy.scale.setScalar((0.45 + p.weight * (wavelength === 808 ? 1.2 : 0.75)) * intensityScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const flicker = 0.7 + 0.3 * Math.sin(t * 4.2 + i);
      const c = new THREE.Color(wavelength === 660 ? "#ffaa44" : "#ff66ee");
      c.lerp(new THREE.Color(colors.scatter), 0.45);
      c.multiplyScalar((0.85 + p.weight * 0.9) * flicker * pulse * intensityScale);
      mesh.setColorAt(i, c);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (particles.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[PARTICLE_GEO, undefined, particles.length]}
      frustumCulled={false}
      renderOrder={6}
    >
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
