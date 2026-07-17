import type { BufferGeometry } from "three";
import { PROBE_GEL_GOOD, PROBE_GEL_POOR } from "./probeMaterials";

interface CouplingGelLayerProps {
  coupling: "good" | "poor";
  goodGeometry: BufferGeometry;
  poorGeometry: BufferGeometry;
  poorMaterial: import("three").MeshStandardMaterial;
  scale: [number, number, number];
  skinSurfaceY: number;
  castShadow: boolean;
}

/** Camada fina de gel acústico entre face ativa e pele */
export function CouplingGelLayer({
  coupling,
  goodGeometry,
  poorGeometry,
  poorMaterial,
  scale,
  skinSurfaceY,
  castShadow,
}: CouplingGelLayerProps) {
  if (coupling === "good") {
    return (
      <mesh
        geometry={goodGeometry}
        scale={scale}
        position={[0, skinSurfaceY, 0]}
        castShadow={castShadow}
      >
        <meshStandardMaterial
          color={PROBE_GEL_GOOD.color}
          transparent
          opacity={PROBE_GEL_GOOD.opacity}
          roughness={PROBE_GEL_GOOD.roughness}
          metalness={0}
          emissive={PROBE_GEL_GOOD.emissive}
          emissiveIntensity={PROBE_GEL_GOOD.emissiveIntensity}
          depthWrite={false}
        />
      </mesh>
    );
  }

  if (coupling === "poor") {
    return (
      <group scale={scale}>
        <mesh
          geometry={poorGeometry}
          material={poorMaterial}
          position={[0, skinSurfaceY, 0]}
          castShadow={castShadow}
        />
      </group>
    );
  }

  return null;
}
