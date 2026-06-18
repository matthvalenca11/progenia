/**
 * Silhueta acústica educacional — visível em todas as abas do simulador 3D.
 * Plano: linhas azuis divergentes. Focalizado: linhas âmbar convergentes + marcador no foco.
 */

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { DoubleSide, LatheGeometry, Vector2 } from "three";
import {
  beamRadiusAtDepth,
  faceRadiusFromEra,
  type BeamGeometryParams,
  type TransducerBeamProfile,
} from "@/lib/ultrasoundTherapyBeam";
import type { TherapeuticTransducerType } from "@/config/therapeuticTransducerDefinitions";
import { THERAPY_BEAM } from "./therapyVisualConstants";

interface TransducerAcousticSilhouetteProps {
  era: number;
  frequency?: number;
  intensity?: number;
  beamProfile?: TransducerBeamProfile;
  transducerType?: TherapeuticTransducerType;
  focusDepth?: number;
  maxDepth?: number;
  position?: { x: number; y: number };
}

const SKIN_Y = 0;
const MERIDIANS = 14;

function buildEnvelopeProfile(params: BeamGeometryParams, steps = 32): Vector2[] {
  const points: Vector2[] = [new Vector2(0.002, SKIN_Y)];
  for (let i = 0; i <= steps; i++) {
    const depth = (i / steps) * params.maxDepth;
    points.push(new Vector2(beamRadiusAtDepth(depth, params), SKIN_Y - depth));
  }
  return points;
}

export function TransducerAcousticSilhouette({
  era,
  frequency = 1,
  intensity = 1,
  beamProfile = "planar",
  transducerType = "planar_circular",
  focusDepth,
  maxDepth = 2,
  position = { x: 0, y: 0 },
}: TransducerAcousticSilhouetteProps) {
  const isFocused = beamProfile === "focused";
  const tokens = isFocused ? THERAPY_BEAM.focused : THERAPY_BEAM.planar;
  const strokeColor = isFocused ? tokens.core.color : tokens.envelope.color;
  const fillColor = isFocused ? tokens.envelope.color : tokens.core.color;

  const depth = Math.max(0.9, maxDepth);
  const geomParams: BeamGeometryParams = useMemo(
    () => ({
      era,
      frequency,
      beamProfile,
      transducerType,
      focusDepth,
      maxDepth: depth,
    }),
    [era, frequency, beamProfile, transducerType, focusDepth, depth],
  );

  const resolvedFocus = focusDepth ?? depth * 0.45;
  const faceR = faceRadiusFromEra(era);
  const intensityNorm = Math.min(1, intensity / 2);
  const lineOpacity = 0.42 + intensityNorm * 0.48;
  const fillOpacity = 0.1 + intensityNorm * 0.18;

  const envelopeGeo = useMemo(() => {
    const geo = new LatheGeometry(buildEnvelopeProfile(geomParams, 36), 48);
    geo.computeVertexNormals();
    return geo;
  }, [geomParams]);

  const meridians = useMemo(() => {
    const steps = 24;
    return Array.from({ length: MERIDIANS }, (_, i) => {
      const angle = (i / MERIDIANS) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const pts: [number, number, number][] = [];
      for (let s = 0; s <= steps; s++) {
        const d = (s / steps) * depth;
        const r = beamRadiusAtDepth(d, geomParams);
        pts.push([cos * r, SKIN_Y - d, sin * r]);
      }
      return pts;
    });
  }, [geomParams, depth]);

  const waistRings = useMemo(() => {
    if (isFocused) {
      return [resolvedFocus * 0.35, resolvedFocus, resolvedFocus * 1.25].map((d) =>
        Math.min(depth, Math.max(0.04, d)),
      );
    }
    const near = Math.min(depth * 0.35, faceR * 2.5);
    return [near, depth * 0.55, depth * 0.85].map((d) => Math.max(0.06, d));
  }, [isFocused, resolvedFocus, depth, faceR]);

  const xOffset = position.x * 8;
  const zOffset = position.y * 3;

  if (intensity <= 0.05) return null;

  return (
    <group position={[xOffset, 0, zOffset]} renderOrder={5}>
      <mesh geometry={envelopeGeo} renderOrder={5}>
        <meshBasicMaterial
          color={fillColor}
          transparent
          opacity={fillOpacity}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>

      {meridians.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color={strokeColor}
          lineWidth={isFocused ? 2.4 : 2}
          transparent
          opacity={lineOpacity}
          depthWrite={false}
        />
      ))}

      {waistRings.map((d) => {
        const r = beamRadiusAtDepth(d, geomParams);
        const segments = 48;
        const pts: [number, number, number][] = [];
        for (let i = 0; i <= segments; i++) {
          const a = (i / segments) * Math.PI * 2;
          pts.push([Math.cos(a) * r, SKIN_Y - d, Math.sin(a) * r]);
        }
        return (
          <Line
            key={`ring-${d.toFixed(2)}`}
            points={pts}
            color={strokeColor}
            lineWidth={1.6}
            transparent
            opacity={lineOpacity * 0.85}
            depthWrite={false}
          />
        );
      })}

      {isFocused && (
        <mesh position={[0, SKIN_Y - resolvedFocus, 0]} renderOrder={6}>
          <sphereGeometry args={[Math.max(0.04, faceR * 0.18), 14, 14]} />
          <meshBasicMaterial
            color={THERAPY_BEAM.focused.focus.color}
            transparent
            opacity={0.55 + intensityNorm * 0.35}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
