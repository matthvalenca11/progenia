import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PhotobioOpticsResult, PhotobioWavelength } from "@/lib/photobioOptics";
import { buildAbsorptionMarkers } from "./photobioBeamVisual";
import type { PhotobioStackLayout } from "./photobioViewerLayout";
import { clamp } from "./photobioViewerLayout";

const MARKER_GEO = new THREE.SphereGeometry(0.04, 8, 8);

interface PhotobioAbsorptionOverlayProps {
  opticsProfile: PhotobioOpticsResult;
  layout: PhotobioStackLayout;
  wavelength: PhotobioWavelength;
  transducerX: number;
  thermalRiskIndex: number;
  maxMarkers?: number;
  visible?: boolean;
}

export function PhotobioAbsorptionOverlay({
  opticsProfile,
  layout,
  wavelength,
  transducerX,
  thermalRiskIndex,
  maxMarkers = 24,
  visible = true,
}: PhotobioAbsorptionOverlayProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const markers = useMemo(
    () =>
      buildAbsorptionMarkers(
        opticsProfile,
        {
          contactSurfaceY: layout.contactSurfaceY,
          epidermisCenterY: layout.epidermisCenterY,
          dermisCenterY: layout.dermisCenterY,
          adiposeCenterY: layout.adiposeCenterY,
          muscleCenterY: layout.muscleCenterY,
        },
        wavelength,
        transducerX,
        maxMarkers,
      ),
    [opticsProfile, layout, wavelength, transducerX, maxMarkers],
  );

  const layerColor = (layer: string, intensity: number) => {
    if (thermalRiskIndex > 0.7) return new THREE.Color("#ffb347").multiplyScalar(intensity * 0.6);
    if (wavelength === 660) {
      if (layer === "epidermis" || layer === "dermis") return new THREE.Color("#ff8844").multiplyScalar(intensity);
      return new THREE.Color("#ff6622").multiplyScalar(intensity * 0.45);
    }
    if (layer === "adipose" || layer === "muscle") return new THREE.Color("#c4008f").multiplyScalar(intensity * 0.75);
    return new THREE.Color("#9d0070").multiplyScalar(intensity * 0.35);
  };

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    markers.forEach((m, i) => {
      dummy.position.set(m.x, m.y, m.z);
      dummy.scale.setScalar(0.5 + m.intensity * 0.9);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, layerColor(m.layerType, m.intensity));
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [markers, dummy, wavelength, thermalRiskIndex]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh || !visible) return;
    const t = clock.getElapsedTime();

    markers.forEach((m, i) => {
      const pulse = 0.7 + 0.3 * Math.sin(t * 4 + i * 0.8);
      dummy.position.set(m.x, m.y, m.z);
      dummy.scale.setScalar((0.45 + m.intensity * 0.85) * pulse);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!visible || markers.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[MARKER_GEO, undefined, markers.length]}
      frustumCulled={false}
      renderOrder={3}
    >
      <meshStandardMaterial
        vertexColors
        transparent
        opacity={clamp(thermalRiskIndex > 0.7 ? 0.35 : 0.22, 0.08, 0.4)}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        emissive="#ffffff"
        emissiveIntensity={0.85}
      />
    </instancedMesh>
  );
}
