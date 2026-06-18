/**
 * Contato transdutor–pele: AO fake (Android) + leve compressão visual da pele.
 */

import { useMemo } from "react";
import {
  resolveTransducerFace,
  type TherapeuticTransducerType,
} from "@/config/therapeuticTransducerDefinitions";
import {
  shouldUseContactShadowFallback,
  shouldEnableRealTimeShadows,
} from "@/lib/ultrasoundVisualQuality";

interface TransducerContactEffectsProps {
  era: number;
  transducerType?: TherapeuticTransducerType;
  position?: { x: number; y: number };
}

const SKIN_Y = 0.008;

function toWorldXZ(position: { x: number; y: number }) {
  return { x: position.x * 8, z: position.y * 3 };
}

export function TransducerContactEffects({
  era,
  transducerType = "planar_circular",
  position = { x: 0, y: 0 },
}: TransducerContactEffectsProps) {
  const { x: xOffset, z: zOffset } = toWorldXZ(position);

  const face = useMemo(
    () => resolveTransducerFace(transducerType, era),
    [transducerType, era],
  );

  const isRect = face.kind === "rounded_rect";
  const contactR = isRect
    ? Math.max(face.activeHalfW ?? 1, face.activeHalfD ?? 1) * 1.02
    : (face.activeR ?? face.eqR) * 1.04;

  const useFallback = shouldUseContactShadowFallback();
  const useRealShadows = shouldEnableRealTimeShadows();

  if (!useFallback && useRealShadows) {
    return (
      <group position={[xOffset, SKIN_Y, zOffset]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} renderOrder={2}>
          <ringGeometry args={[contactR * 0.72, contactR * 1.08, 48]} />
          <meshBasicMaterial
            color="#1a0f0a"
            transparent
            opacity={0.14}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  }

  if (!useFallback) return null;

  return (
    <group position={[xOffset, SKIN_Y, zOffset]}>
      {/* Contact darkening — substitui sombra no Android */}
      {isRect && face.activeHalfW && face.activeHalfD ? (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} renderOrder={2}>
            <planeGeometry args={[face.activeHalfW * 2.15, face.activeHalfD * 2.15]} />
            <meshBasicMaterial
              color="#0a0604"
              transparent
              opacity={0.32}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} renderOrder={3}>
            <ringGeometry
              args={[
                Math.min(face.activeHalfW, face.activeHalfD) * 1.5,
                Math.max(face.activeHalfW, face.activeHalfD) * 1.12,
                32,
              ]}
            />
            <meshBasicMaterial
              color="#1c1210"
              transparent
              opacity={0.22}
              depthWrite={false}
            />
          </mesh>
        </>
      ) : (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} renderOrder={2}>
            <circleGeometry args={[contactR * 0.96, 40]} />
            <meshBasicMaterial
              color="#0a0604"
              transparent
              opacity={0.34}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} renderOrder={3}>
            <ringGeometry args={[contactR * 0.88, contactR * 1.14, 40]} />
            <meshBasicMaterial
              color="#1c1210"
              transparent
              opacity={0.2}
              depthWrite={false}
            />
          </mesh>
        </>
      )}

      {/* Deformação visual — anel de compressão */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} renderOrder={1}>
        {isRect && face.activeHalfW && face.activeHalfD ? (
          <ringGeometry
            args={[
              Math.min(face.activeHalfW, face.activeHalfD) * 0.82,
              Math.max(face.activeHalfW, face.activeHalfD) * 1.06,
              32,
            ]}
          />
        ) : (
          <ringGeometry args={[contactR * 0.78, contactR * 1.02, 40]} />
        )}
        <meshBasicMaterial
          color="#6b3a2e"
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
