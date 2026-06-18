/**
 * UltrasoundBeam — feixe acústico educacional (plano × focalizado)
 */

import { useMemo, useRef } from "react";
import { Line, Ring, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  DoubleSide,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Vector2,
} from "three";
import {
  beamRadiusAtDepth,
  beamLateralScale,
  faceRadiusFromEra,
  nearFieldLengthCm,
  sampleBeamSlices,
  sampleBeamSlicesFromAcousticProfile,
  type BeamGeometryParams,
  type TransducerBeamProfile,
} from "@/lib/ultrasoundTherapyBeam";
import type { UltrasoundTherapyResult } from "@/simulation/ultrasoundTherapyEngine";
import type { TherapeuticTransducerType } from "@/config/therapeuticTransducerDefinitions";
import { getTransducerDefinition } from "@/config/therapeuticTransducerDefinitions";
import { THERAPY_BEAM } from "./therapyVisualConstants";

interface UltrasoundBeamProps {
  frequency: number;
  intensity: number;
  era: number;
  effectiveDepth: number;
  penetrationDepth: number;
  coupling?: "good" | "poor";
  beamProfile?: TransducerBeamProfile;
  transducerType?: TherapeuticTransducerType;
  focusDepth?: number;
  position?: { x: number; y: number };
  acousticProfile?: UltrasoundTherapyResult["acousticProfile"];
}

const SKIN_Y = 0;

function buildEnvelopeProfile(params: BeamGeometryParams, steps = 40): Vector2[] {
  const points: Vector2[] = [new Vector2(0.002, SKIN_Y)];
  for (let i = 0; i <= steps; i++) {
    const depth = (i / steps) * params.maxDepth;
    const y = SKIN_Y - depth;
    const r = beamRadiusAtDepth(depth, params);
    points.push(new Vector2(r, y));
  }
  return points;
}

function intensityColor(
  intensity: number,
  coupling: "good" | "poor",
  beamKind: "planar" | "focused",
): string {
  const t = Math.max(0, Math.min(1, intensity));
  if (coupling === "poor") {
    return t > 0.5 ? "#f59e0b" : "#fcd34d";
  }
  const palette = beamKind === "focused" ? THERAPY_BEAM.focused.slice : THERAPY_BEAM.planar.slice;
  if (t > 0.65) return palette[3];
  if (t > 0.35) return palette[2];
  if (t > 0.15) return palette[1];
  return palette[0];
}

export function UltrasoundBeam({
  frequency,
  intensity,
  era,
  effectiveDepth,
  penetrationDepth,
  coupling = "good",
  beamProfile = "planar",
  transducerType = "planar_circular",
  focusDepth,
  position = { x: 0, y: 0 },
  acousticProfile,
}: UltrasoundBeamProps) {
  const faceR = useMemo(() => faceRadiusFromEra(era), [era]);
  const transducerDef = getTransducerDefinition(transducerType);
  const isFocused = beamProfile === "focused";
  const beamTokens = isFocused ? THERAPY_BEAM.focused : THERAPY_BEAM.planar;
  const lateral = useMemo(
    () => beamLateralScale({ era, frequency, beamProfile, transducerType, maxDepth: 1 }),
    [era, frequency, beamProfile, transducerType],
  );
  const maxDepth = useMemo(
    () => Math.max(0.6, penetrationDepth || effectiveDepth || 2),
    [penetrationDepth, effectiveDepth],
  );

  const geomParams: BeamGeometryParams = useMemo(
    () => ({
      era,
      frequency,
      beamProfile,
      transducerType,
      focusDepth,
      maxDepth,
    }),
    [era, frequency, beamProfile, transducerType, focusDepth, maxDepth],
  );

  const nearField = useMemo(() => {
    if (acousticProfile?.nearFieldCm != null) {
      return acousticProfile.nearFieldCm;
    }
    return nearFieldLengthCm(era, frequency, transducerType);
  }, [acousticProfile?.nearFieldCm, era, frequency, transducerType]);

  const resolvedFocusDepth = acousticProfile?.focusDepthCm ?? focusDepth ?? maxDepth * 0.45;

  const envelopeGeo = useMemo(() => {
    const profile = buildEnvelopeProfile(geomParams, 48);
    const geo = new LatheGeometry(profile, 64);
    geo.computeVertexNormals();
    return geo;
  }, [geomParams]);

  const coreGeo = useMemo(() => {
    const coreParams = { ...geomParams };
    const profile: Vector2[] = [new Vector2(0.002, SKIN_Y)];
    const steps = 36;
    for (let i = 0; i <= steps; i++) {
      const depth = (i / steps) * maxDepth;
      const r = beamRadiusAtDepth(depth, coreParams) * 0.55;
      profile.push(new Vector2(r, SKIN_Y - depth));
    }
    profile.push(new Vector2(0.002, SKIN_Y - maxDepth));
    const geo = new LatheGeometry(profile, 48);
    geo.computeVertexNormals();
    return geo;
  }, [geomParams, maxDepth]);

  const slices = useMemo(() => {
    if (acousticProfile?.depthSamples?.length) {
      return sampleBeamSlicesFromAcousticProfile(
        geomParams,
        acousticProfile.depthSamples,
        7,
      );
    }
    return sampleBeamSlices(geomParams, 7);
  }, [geomParams, acousticProfile?.depthSamples]);

  const couplingFactor = coupling === "good" ? 1 : 0.65;
  const intensityNorm = Math.min(1, intensity / 2.5) * couplingFactor;
  const baseOpacity = 0.18 + intensityNorm * 0.28;

  const xOffset = position.x * 8;
  const zOffset = position.y * 3;

  const pulseRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!pulseRef.current?.material || Array.isArray(pulseRef.current.material)) return;
    const mat = pulseRef.current.material as MeshStandardMaterial;
    const pulse = 0.85 + Math.sin(clock.getElapsedTime() * 2.5) * 0.15;
    mat.opacity = baseOpacity * 1.35 * pulse;
  });

  const labelOffsetX = faceR * 1.35 + 0.4;

  return (
    <group position={[xOffset, 0, zOffset]} renderOrder={8}>
      <group scale={[lateral.x, 1, lateral.z]}>
      {/* Invólucro -6 dB (campo próximo + divergência / foco) */}
      <mesh geometry={envelopeGeo} renderOrder={8}>
        <meshStandardMaterial
          color={coupling === "poor" ? "#fbbf24" : beamTokens.envelope.color}
          emissive={coupling === "poor" ? "#d97706" : beamTokens.envelope.emissive}
          emissiveIntensity={0.28 + intensityNorm * 0.45}
          transparent
          opacity={baseOpacity}
          depthWrite={false}
          side={DoubleSide}
          roughness={0.15}
          metalness={0}
        />
      </mesh>

      {/* Núcleo de maior intensidade */}
      <mesh ref={pulseRef} geometry={coreGeo} renderOrder={9}>
        <meshStandardMaterial
          color={coupling === "poor" ? "#f59e0b" : beamTokens.core.color}
          emissive={coupling === "poor" ? "#ea580c" : beamTokens.core.emissive}
          emissiveIntensity={0.4 + intensityNorm * 0.55}
          transparent
          opacity={baseOpacity * 1.4}
          depthWrite={false}
          side={DoubleSide}
          roughness={0.1}
          metalness={0}
        />
      </mesh>

      {/* Cortes transversais — intensidade por profundidade */}
      {slices.map(({ depth, radius, intensity: relI }) => {
        const ringOpacity = 0.38 + relI * 0.52 * intensityNorm;
        return (
          <Ring
            key={depth.toFixed(3)}
            args={[Math.max(0.02, radius * 0.88), radius, 48]}
            position={[0, SKIN_Y - depth, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={10}
          >
            <meshStandardMaterial
              color={intensityColor(relI * intensityNorm, coupling, isFocused ? "focused" : "planar")}
              emissive={intensityColor(relI * intensityNorm, coupling, isFocused ? "focused" : "planar")}
              emissiveIntensity={0.15 + relI * 0.4}
              transparent
              opacity={ringOpacity}
              depthWrite={false}
              side={DoubleSide}
            />
          </Ring>
        );
      })}

      {/* Contorno do campo próximo (só transdutor plano) */}
      {beamProfile === "planar" && nearField < maxDepth && (
        <Ring
          args={[faceR * 0.98, faceR * 1.04, 48]}
          position={[0, SKIN_Y - nearField, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={11}
        >
          <meshStandardMaterial
            color={THERAPY_BEAM.planar.nearField}
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </Ring>
      )}

      {/* Marcador profundidade efetiva — anel */}
      {effectiveDepth > 0.05 && effectiveDepth <= maxDepth && (
        <Ring
          args={[
            beamRadiusAtDepth(effectiveDepth, geomParams) * 0.92,
            beamRadiusAtDepth(effectiveDepth, geomParams) * 1.02,
            48,
          ]}
          position={[0, SKIN_Y - effectiveDepth, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={11}
        >
          <meshStandardMaterial
            color={beamTokens.effectiveDepth.color}
            emissive={beamTokens.effectiveDepth.emissive}
            emissiveIntensity={0.5}
            transparent
            opacity={0.75}
            depthWrite={false}
          />
        </Ring>
      )}

      {/* Perfil focalizado — cintura + esfera no foco */}
      {beamProfile === "focused" && (
        <>
          <Ring
            args={[
              beamRadiusAtDepth(resolvedFocusDepth, geomParams) * 0.85,
              beamRadiusAtDepth(resolvedFocusDepth, geomParams) * 1.08,
              48,
            ]}
            position={[0, SKIN_Y - resolvedFocusDepth, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={12}
          >
            <meshStandardMaterial
              color={THERAPY_BEAM.focused.focus.color}
              emissive={THERAPY_BEAM.focused.focus.emissive}
              emissiveIntensity={0.65}
              transparent
              opacity={0.82}
              depthWrite={false}
            />
          </Ring>
          <mesh
            position={[0, SKIN_Y - resolvedFocusDepth, 0]}
            renderOrder={13}
          >
            <sphereGeometry args={[beamRadiusAtDepth(resolvedFocusDepth, geomParams) * 0.32, 16, 16]} />
            <meshStandardMaterial
              color={THERAPY_BEAM.focused.focus.color}
              emissive={THERAPY_BEAM.focused.focus.emissive}
              emissiveIntensity={1.1}
              transparent
              opacity={0.78}
              depthWrite={false}
            />
          </mesh>
        </>
      )}

      {coupling === "poor" && (
        <Ring
          args={[faceR * 1.05, faceR * 1.45, 48]}
          position={[0, SKIN_Y - 0.02, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={7}
        >
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#f59e0b"
            emissiveIntensity={0.35}
            transparent
            opacity={0.35}
            depthWrite={false}
          />
        </Ring>
      )}
      </group>

      {/* Rótulos — fora da escala elíptica */}
      {beamProfile === "planar" && nearField < maxDepth && (
        <>
          <Line
            points={[
              [labelOffsetX, SKIN_Y - nearField, 0],
              [faceR * lateral.x * 1.05, SKIN_Y - nearField, 0],
            ]}
            color={THERAPY_BEAM.planar.nearField}
            lineWidth={1}
            transparent
            opacity={0.6}
            depthWrite={false}
          />
          <Text
            position={[labelOffsetX + 0.55, SKIN_Y - nearField, 0]}
            fontSize={0.11}
            color={THERAPY_BEAM.planar.nearFieldLabel}
            anchorX="left"
            anchorY="middle"
            maxWidth={2.5}
          >
            Fim campo próximo
          </Text>
        </>
      )}

      {effectiveDepth > 0.05 && effectiveDepth <= maxDepth && (
        <Text
          position={[labelOffsetX + 0.55, SKIN_Y - effectiveDepth, 0]}
          fontSize={0.11}
          color={beamTokens.effectiveDepth.color}
          anchorX="left"
          anchorY="middle"
        >
          {`Prof. efetiva (${effectiveDepth.toFixed(1)} cm)`}
        </Text>
      )}

      {beamProfile === "focused" && (
        <Text
          position={[labelOffsetX + 0.55, SKIN_Y - resolvedFocusDepth, 0]}
          fontSize={0.11}
          color={THERAPY_BEAM.focused.focusLabel}
          anchorX="left"
          anchorY="middle"
        >
          Zona focal
        </Text>
      )}

      <Text
        position={[labelOffsetX + 0.55, SKIN_Y + 0.12, 0]}
        fontSize={0.12}
        color="#e2e8f0"
        anchorX="left"
        anchorY="bottom"
        maxWidth={3}
      >
        {beamProfile === "focused"
          ? `${transducerDef.shortLabel} · feixe convergente · f=${frequency.toFixed(1)} MHz`
          : `${transducerDef.shortLabel} · feixe plano · N≈${nearField.toFixed(1)} cm · f=${frequency.toFixed(1)} MHz`}
      </Text>
    </group>
  );
}
