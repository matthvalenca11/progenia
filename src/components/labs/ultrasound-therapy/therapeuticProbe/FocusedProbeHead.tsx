import { useMemo, type RefObject } from "react";
import { LatheGeometry, Mesh } from "three";
import { buildConcaveActiveFaceProfile } from "./probeGeometry";
import { PROBE_ACTIVE_METAL, PROBE_RUBBER } from "./probeMaterials";

interface FocusedProbeHeadProps {
  activeR: number;
  faceBottomY: number;
  ceramicRef: RefObject<Mesh>;
  castShadow: boolean;
}

export function FocusedProbeHead({
  activeR,
  faceBottomY,
  ceramicRef,
  castShadow,
}: FocusedProbeHeadProps) {
  const bowlGeo = useMemo(() => {
    const depth = activeR * 0.16;
    const geo = new LatheGeometry(buildConcaveActiveFaceProfile(activeR * 0.94, depth), 72);
    geo.computeVertexNormals();
    return geo;
  }, [activeR]);

  return (
    <group position={[0, faceBottomY, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.0012, 0]} receiveShadow={castShadow}>
        <torusGeometry args={[activeR * 1.08, 0.006, 12, 72]} />
        <meshStandardMaterial {...PROBE_RUBBER} />
      </mesh>

      <mesh
        ref={ceramicRef}
        geometry={bowlGeo}
        rotation={[Math.PI, 0, 0]}
        position={[0, 0.0035, 0]}
        receiveShadow={castShadow}
      >
        <meshPhysicalMaterial
          {...PROBE_ACTIVE_METAL}
          emissive="#9aa5ad"
          emissiveIntensity={0.07}
        />
      </mesh>
    </group>
  );
}
