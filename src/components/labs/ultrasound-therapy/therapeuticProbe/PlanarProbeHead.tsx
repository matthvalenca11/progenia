import type { RefObject } from "react";
import { Mesh } from "three";
import { PROBE_ACTIVE_METAL, PROBE_RUBBER } from "./probeMaterials";

interface PlanarProbeHeadProps {
  activeR: number;
  faceBottomY: number;
  ceramicRef: RefObject<Mesh>;
  castShadow: boolean;
}

export function PlanarProbeHead({
  activeR,
  faceBottomY,
  ceramicRef,
  castShadow,
}: PlanarProbeHeadProps) {
  return (
    <group position={[0, faceBottomY, 0]}>
      {/* Anel de borracha — visível ao redor da face */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.0012, 0]} receiveShadow={castShadow}>
        <torusGeometry args={[activeR * 1.06, 0.0055, 12, 72]} />
        <meshStandardMaterial {...PROBE_RUBBER} />
      </mesh>

      {/* Face metálica plana */}
      <mesh ref={ceramicRef} position={[0, 0.0022, 0]} receiveShadow={castShadow}>
        <cylinderGeometry args={[activeR * 0.98, activeR * 0.98, 0.003, 72]} />
        <meshPhysicalMaterial
          {...PROBE_ACTIVE_METAL}
          emissive="#9aa5ad"
          emissiveIntensity={0.06}
        />
      </mesh>

      {/* Chanfro metálico na borda */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.0032, 0]}>
        <ringGeometry args={[activeR * 0.96, activeR * 1.01, 72]} />
        <meshPhysicalMaterial color="#B8BFC4" metalness={0.75} roughness={0.42} />
      </mesh>
    </group>
  );
}
