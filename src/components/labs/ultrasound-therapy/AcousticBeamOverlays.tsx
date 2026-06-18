/**
 * Marcadores educacionais do feixe — contornos, foco, interfaces e reflexão.
 * O campo jet principal é renderizado no tecido (acousticFieldTexture).
 */

import { useMemo } from "react";
import { Line, Ring, Text } from "@react-three/drei";
import { DoubleSide } from "three";
import {
  beamRadiusAtDepth,
  faceRadiusFromEra,
  nearFieldLengthCm,
  type BeamGeometryParams,
  type TransducerBeamProfile,
} from "@/lib/ultrasoundTherapyBeam";
import type { UltrasoundTherapyResult } from "@/simulation/ultrasoundTherapyEngine";
import type { TherapeuticTransducerType } from "@/config/therapeuticTransducerDefinitions";
import { getTransducerDefinition } from "@/config/therapeuticTransducerDefinitions";
import { getBoneStartDepth } from "@/lib/ultrasoundTherapyStack";
import type { AnatomicalScenario } from "@/types/ultrasoundTherapyConfig";
import { THERAPY_BEAM } from "./therapyVisualConstants";

interface AcousticBeamOverlaysProps {
  frequency: number;
  intensity: number;
  era: number;
  effectiveDepth: number;
  penetrationDepth: number;
  coupling?: "good" | "poor";
  beamProfile?: TransducerBeamProfile;
  transducerType?: TherapeuticTransducerType;
  focusDepth?: number;
  scenario: AnatomicalScenario;
  customThicknesses?: { skin: number; fat: number; muscle: number; boneDepth?: number };
  position?: { x: number; y: number };
  acousticProfile?: UltrasoundTherapyResult["acousticProfile"];
  boneReflection?: number;
}

const SKIN_Y = 0;

export function AcousticBeamOverlays({
  frequency,
  intensity,
  era,
  effectiveDepth,
  penetrationDepth,
  coupling = "good",
  beamProfile = "planar",
  transducerType = "planar_circular",
  focusDepth,
  scenario,
  customThicknesses,
  position = { x: 0, y: 0 },
  acousticProfile,
  boneReflection = 0,
}: AcousticBeamOverlaysProps) {
  const faceR = useMemo(() => faceRadiusFromEra(era), [era]);
  const transducerDef = getTransducerDefinition(transducerType);
  const isFocused = beamProfile === "focused";
  const beamTokens = isFocused ? THERAPY_BEAM.focused : THERAPY_BEAM.planar;

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
    if (acousticProfile?.nearFieldCm != null) return acousticProfile.nearFieldCm;
    return nearFieldLengthCm(era, frequency, transducerType);
  }, [acousticProfile?.nearFieldCm, era, frequency, transducerType]);

  const resolvedFocusDepth = acousticProfile?.focusDepthCm ?? focusDepth ?? maxDepth * 0.45;

  const boneDepth = useMemo(
    () => getBoneStartDepth(scenario, customThicknesses),
    [scenario, customThicknesses],
  );

  const couplingFactor = coupling === "good" ? 1 : 0.65;
  const intensityNorm = Math.min(1, intensity / 2.5) * couplingFactor;
  const xOffset = position.x * 8;
  const zOffset = position.y * 3;
  const labelOffsetX = faceR * 1.35 + 0.4;

  return (
    <group position={[xOffset, 0, zOffset]} renderOrder={12}>
      {/* Raios em V — bordas da abertura → zona focal (referência Field II) */}
      {isFocused && (
        <>
          <Line
            points={[
              [-faceR, SKIN_Y, 0],
              [0, SKIN_Y - resolvedFocusDepth, 0],
            ]}
            color="#67e8f9"
            lineWidth={1}
            transparent
            opacity={0.35}
            depthWrite={false}
          />
          <Line
            points={[
              [faceR, SKIN_Y, 0],
              [0, SKIN_Y - resolvedFocusDepth, 0],
            ]}
            color="#67e8f9"
            lineWidth={1}
            transparent
            opacity={0.35}
            depthWrite={false}
          />
        </>
      )}

      {/* Contorno -6 dB */}
      {Array.from({ length: isFocused ? 0 : 14 }, (_, i) => {
        const depth = (i / 13) * maxDepth;
        if (depth < 0.05) return null;
        const r = beamRadiusAtDepth(depth, geomParams);
        if (r < 0.04) return null;
        const relDepth = depth / maxDepth;
        const fade = 1 - relDepth * 0.55;
        return (
          <Ring
            key={`contour-${i}`}
            args={[r * 0.96, r * 1.01, 40]}
            position={[0, SKIN_Y - depth, 0.02]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={12}
          >
            <meshStandardMaterial
              color={isFocused ? "#38bdf8" : "#60a5fa"}
              transparent
              opacity={0.08 + fade * 0.12 * intensityNorm}
              depthWrite={false}
              side={DoubleSide}
            />
          </Ring>
        );
      })}

      {/* Reflexão no osso — feixe refletido para cima (sem faixa branca) */}
      {boneDepth != null && boneReflection > 0.08 && (
        <group position={[0, SKIN_Y - boneDepth, 0.05]} renderOrder={14}>
          {Array.from({ length: 5 }, (_, i) => {
            const angle = -0.35 + (i / 4) * 0.7;
            const r0 = beamRadiusAtDepth(boneDepth, geomParams) * 0.35;
            const r1 = beamRadiusAtDepth(boneDepth, geomParams) * (0.85 + i * 0.08);
            const lift = 0.25 + i * 0.18;
            return (
              <Line
                key={`bone-reflect-${i}`}
                points={[
                  [Math.sin(angle) * r0, 0.02, Math.cos(angle) * r0 * 0.3],
                  [Math.sin(angle) * r1, lift, Math.cos(angle) * r1 * 0.3],
                ]}
                color="#fbbf24"
                lineWidth={1}
                transparent
                opacity={0.18 + boneReflection * 0.22}
                depthWrite={false}
              />
            );
          })}
          <Ring
            args={[
              beamRadiusAtDepth(boneDepth, geomParams) * 0.88,
              beamRadiusAtDepth(boneDepth, geomParams) * 0.96,
              48,
            ]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial
              color="#f59e0b"
              emissive="#d97706"
              emissiveIntensity={0.25 + boneReflection * 0.35}
              transparent
              opacity={0.28 + boneReflection * 0.2}
              depthWrite={false}
            />
          </Ring>
        </group>
      )}

      {/* Campo próximo (plano) */}
      {beamProfile === "planar" && nearField < maxDepth && (
        <>
          <Ring
            args={[faceR * 0.98, faceR * 1.04, 48]}
            position={[0, SKIN_Y - nearField, 0.05]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={13}
          >
            <meshStandardMaterial
              color={THERAPY_BEAM.planar.nearField}
              transparent
              opacity={0.65}
              depthWrite={false}
            />
          </Ring>
          <Line
            points={[
              [labelOffsetX, SKIN_Y - nearField, 0],
              [faceR * 1.05, SKIN_Y - nearField, 0],
            ]}
            color={THERAPY_BEAM.planar.nearField}
            lineWidth={1}
            transparent
            opacity={0.65}
            depthWrite={false}
          />
          <Text
            position={[labelOffsetX + 0.55, SKIN_Y - nearField, 0]}
            fontSize={0.1}
            color={THERAPY_BEAM.planar.nearFieldLabel}
            anchorX="left"
            anchorY="middle"
          >
            Fim campo próximo
          </Text>
        </>
      )}

      {/* Zona focal — cintura do charuto */}
      {beamProfile === "focused" && (
        <>
          <Ring
            args={[
              beamRadiusAtDepth(resolvedFocusDepth, geomParams) * 0.78,
              beamRadiusAtDepth(resolvedFocusDepth, geomParams) * 1.14,
              48,
            ]}
            position={[0, SKIN_Y - resolvedFocusDepth, 0.07]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={16}
          >
            <meshStandardMaterial
              color={THERAPY_BEAM.focused.focus.color}
              emissive={THERAPY_BEAM.focused.focus.emissive}
              emissiveIntensity={0.9}
              transparent
              opacity={0.85}
              depthWrite={false}
            />
          </Ring>
          <Text
            position={[labelOffsetX + 0.55, SKIN_Y - resolvedFocusDepth, 0]}
            fontSize={0.1}
            color={THERAPY_BEAM.focused.focusLabel}
            anchorX="left"
            anchorY="middle"
          >
            {`Zona focal (${resolvedFocusDepth.toFixed(1)} cm)`}
          </Text>
        </>
      )}

      {/* Profundidade efetiva */}
      {effectiveDepth > 0.05 && effectiveDepth <= maxDepth && (
        <>
          <Ring
            args={[
              beamRadiusAtDepth(effectiveDepth, geomParams) * 0.9,
              beamRadiusAtDepth(effectiveDepth, geomParams) * 1.02,
              48,
            ]}
            position={[0, SKIN_Y - effectiveDepth, 0.05]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={13}
          >
            <meshStandardMaterial
              color={beamTokens.effectiveDepth.color}
              emissive={beamTokens.effectiveDepth.emissive}
              emissiveIntensity={0.45}
              transparent
              opacity={0.6}
              depthWrite={false}
            />
          </Ring>
          <Text
            position={[labelOffsetX + 0.55, SKIN_Y - effectiveDepth, 0]}
            fontSize={0.1}
            color={beamTokens.effectiveDepth.color}
            anchorX="left"
            anchorY="middle"
          >
            {`Prof. efetiva (${effectiveDepth.toFixed(1)} cm)`}
          </Text>
        </>
      )}

      <Text
        position={[labelOffsetX + 0.55, SKIN_Y + 0.12, 0]}
        fontSize={0.11}
        color="#e2e8f0"
        anchorX="left"
        anchorY="bottom"
        maxWidth={3}
      >
        {beamProfile === "focused"
          ? `${transducerDef.shortLabel} · convergente · f=${frequency.toFixed(1)} MHz`
          : `${transducerDef.shortLabel} · plano · N≈${nearField.toFixed(1)} cm · f=${frequency.toFixed(1)} MHz`}
      </Text>

      {coupling === "poor" && (
        <Ring
          args={[faceR * 1.05, faceR * 1.45, 48]}
          position={[0, SKIN_Y - 0.02, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={11}
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
  );
}
