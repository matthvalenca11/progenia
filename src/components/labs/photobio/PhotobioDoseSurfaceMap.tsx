import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { classifyPhotobioDose, PHOTOBIO_DOSE_THRESHOLDS } from "@/lib/photobioOptics";
import { clamp } from "./photobioViewerLayout";

function doseZoneColor(dose: number): { color: string; emissiveIntensity: number; opacity: number } {
  const classification = classifyPhotobioDose(dose);
  switch (classification.zone) {
    case "subdose":
      return { color: "#94a3b8", emissiveIntensity: 0.15, opacity: 0.12 };
    case "therapeutic":
      return { color: "#22c55e", emissiveIntensity: 0.45, opacity: 0.35 };
    case "inhibitory":
      return { color: "#38bdf8", emissiveIntensity: 0.35, opacity: 0.3 };
    case "saturation":
      return { color: "#ef4444", emissiveIntensity: 0.85, opacity: 0.5 };
    default:
      return { color: "#eab308", emissiveIntensity: 0.25, opacity: 0.22 };
  }
}

interface PhotobioDoseSurfaceMapProps {
  doseMap: number[];
  topSurfaceY: number;
  enhanced?: boolean;
}

export function PhotobioDoseSurfaceMap({ doseMap, topSurfaceY, enhanced = false }: PhotobioDoseSurfaceMapProps) {
  const { therapeuticMin, therapeuticMax, saturationMin } = PHOTOBIO_DOSE_THRESHOLDS;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(5.8 / Math.max(1, doseMap.length), enhanced ? 0.2 : 0.14),
    [doseMap.length, enhanced],
  );
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        emissive: "#ffffff",
        emissiveIntensity: enhanced ? 0.72 : 0.48,
        transparent: true,
        opacity: enhanced ? 0.72 : 0.52,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [enhanced],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    doseMap.forEach((dose, i) => {
      const style = doseZoneColor(dose);
      const n = clamp(dose / saturationMin, 0, 1);
      const x = -2.8 + (i / Math.max(1, doseMap.length - 1)) * 5.6;
      const inTherapeutic = dose >= therapeuticMin && dose <= therapeuticMax;
      const intensity = style.opacity + n * (enhanced ? 0.95 : 0.65);
      const color = new THREE.Color(style.color).multiplyScalar(inTherapeutic ? intensity * 1.2 : intensity);

      dummy.position.set(x, topSurfaceY + (enhanced ? 0.045 : 0.03), 0);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(dose <= 0.05 ? 0.2 : 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [doseMap, dummy, enhanced, saturationMin, therapeuticMax, therapeuticMin, topSurfaceY]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, doseMap.length]}
      frustumCulled={false}
      renderOrder={6}
    />
  );
}
