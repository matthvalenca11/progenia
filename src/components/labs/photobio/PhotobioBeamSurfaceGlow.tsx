import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PhotobioWavelength } from "@/lib/photobioOptics";
import { getSpotRadiusCm } from "@/lib/photobioOptics";
import { PHOTOBIO_MM_TO_WORLD } from "./photobioViewerLayout";

const CM_TO_WORLD = PHOTOBIO_MM_TO_WORLD * 10;

interface PhotobioBeamSurfaceGlowProps {
  transducerX: number;
  contactSurfaceY: number;
  spotSizeCm2: number;
  wavelength: PhotobioWavelength;
  irradianceMwCm2: number;
  thermalRiskIndex: number;
}

/** Hotspot de entrada — visual lúdico e legível na superfície. */
export function PhotobioBeamSurfaceGlow({
  transducerX,
  contactSurfaceY,
  spotSizeCm2,
  wavelength,
  irradianceMwCm2,
  thermalRiskIndex,
}: PhotobioBeamSurfaceGlowProps) {
  const innerRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const starRef = useRef<THREE.Mesh>(null);
  const radius = Math.max(0.08, getSpotRadiusCm(spotSizeCm2) * CM_TO_WORLD * 1.08);
  const powerNorm = Math.min(1.5, Math.max(0.25, irradianceMwCm2 / 320));

  const innerColor = thermalRiskIndex > 0.55 ? "#fff0cc" : wavelength === 660 ? "#ffffff" : "#ffe0ff";
  const outerColor =
    thermalRiskIndex > 0.55
      ? "#ff3300"
      : wavelength === 660
        ? "#ff9900"
        : "#ff22dd";
  const starColor = wavelength === 660 ? "#ffcc00" : "#ff66ff";

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = 0.82 + 0.18 * Math.sin(t * 3.6);
    const inner = innerRef.current?.material as THREE.MeshBasicMaterial | undefined;
    const outer = outerRef.current?.material as THREE.MeshBasicMaterial | undefined;
    const star = starRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (inner) inner.opacity = (0.18 + powerNorm * 0.28) * pulse;
    if (outer) outer.opacity = (0.1 + powerNorm * 0.22) * pulse;
    if (star) {
      star.opacity = (0.08 + powerNorm * 0.14) * (0.85 + 0.15 * Math.sin(t * 5.1));
      if (starRef.current) starRef.current.rotation.z = t * 0.4;
    }
  });

  return (
    <group position={[transducerX, contactSurfaceY + 0.005, 0.04]}>
      <mesh ref={outerRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={18} frustumCulled={false}>
        <circleGeometry args={[radius * 2.2, 40]} />
        <meshBasicMaterial
          color={outerColor}
          transparent
          opacity={0.14 + powerNorm * 0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={innerRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={19} frustumCulled={false}>
        <circleGeometry args={[radius * 0.85, 32]} />
        <meshBasicMaterial
          color={innerColor}
          transparent
          opacity={0.22 + powerNorm * 0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={starRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={20} frustumCulled={false}>
        <ringGeometry args={[radius * 0.15, radius * 0.55, 6]} />
        <meshBasicMaterial
          color={starColor}
          transparent
          opacity={0.12 + powerNorm * 0.15}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
