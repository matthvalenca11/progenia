/**
 * Marcadores 3D/HTML de resposta fisiológica educacional.
 */

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import { useIsMobile } from "@/hooks/use-mobile";
import type { UltrasoundPhysiologyResponse } from "@/lib/ultrasoundPhysiologyResponse";
import type { UltrasoundTherapyResult } from "@/simulation/ultrasoundTherapyEngine";

interface TissueDamageMarkersProps {
  physiology: UltrasoundPhysiologyResponse;
  result: UltrasoundTherapyResult;
  position?: { x: number; y: number };
}

interface MarkerDef {
  id: string;
  label: string;
  score: number;
  y: number;
  color: string;
}

export function TissueDamageMarkers({
  physiology,
  result,
  position = { x: 0, y: 0 },
}: TissueDamageMarkersProps) {
  const isMobile = useIsMobile();
  const xOffset = position.x * 8;
  const zOffset = position.y * 3;

  const markers = useMemo(() => {
    const all: MarkerDef[] = [
      {
        id: "ablation",
        label: "ablação educacional",
        score: physiology.ablationIndex,
        y: -result.maxTempDepth,
        color: "#fca5a5",
      },
      {
        id: "thermal",
        label: "dano térmico",
        score: Math.max(
          physiology.collagenDenaturationIndex,
          physiology.coagulationIndex,
          physiology.irreversibleDamageIndex * 0.85,
        ),
        y: -result.maxTempDepth,
        color: "#fdba74",
      },
      {
        id: "periosteal",
        label: "risco periosteal",
        score: physiology.periostealPainIndex,
        y: -Math.max(result.maxTempDepth, 2.5),
        color: "#f87171",
      },
      {
        id: "deep",
        label: "aquecimento profundo",
        score: physiology.muscleThermalStressIndex,
        y: -result.effectiveDepth,
        color: "#fb923c",
      },
      {
        id: "hyperemia",
        label: "hiperemia",
        score: physiology.hyperemiaIndex,
        y: -0.08,
        color: "#fda4af",
      },
    ];

    return all
      .filter((m) => m.score > 0.14)
      .sort((a, b) => b.score - a.score)
      .slice(0, isMobile ? 2 : 4);
  }, [physiology, result, isMobile]);

  if (markers.length === 0) return null;

  return (
    <group position={[xOffset, 0, zOffset]}>
      {markers.map((marker, i) => (
        <Html
          key={marker.id}
          position={[2.2 + i * 0.15, marker.y, 0.3 + zOffset * 0.01]}
          center
          distanceFactor={12}
          zIndexRange={[40, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            className="whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur-sm"
            style={{
              borderColor: `${marker.color}66`,
              backgroundColor: `${marker.color}22`,
              color: marker.color,
            }}
          >
            {marker.label}
          </div>
        </Html>
      ))}
    </group>
  );
}
