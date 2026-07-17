import { useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";
import { PROBE_CABLE, PROBE_RUBBER } from "./probeMaterials";

interface ProbeCableProps {
  localY: number;
  cableR: number;
  castShadow: boolean;
}

export function ProbeCable({ localY, cableR, castShadow }: ProbeCableProps) {
  const geo = useMemo(() => {
    const curve = new CatmullRomCurve3([
      new Vector3(0, 0, 0),
      new Vector3(0, -0.035, 0.025),
      new Vector3(0, -0.1, 0.065),
      new Vector3(0, -0.2, 0.09),
    ]);
    return new TubeGeometry(curve, 28, cableR * 0.75, 10, false);
  }, [cableR]);

  return (
    <group position={[0, localY, 0]}>
      <mesh position={[0, 0.008, 0]} castShadow={castShadow}>
        <cylinderGeometry args={[cableR * 1.18, cableR * 0.95, 0.032, 16]} />
        <meshStandardMaterial {...PROBE_RUBBER} />
      </mesh>
      <mesh geometry={geo} castShadow={castShadow}>
        <meshStandardMaterial {...PROBE_CABLE} />
      </mesh>
    </group>
  );
}
