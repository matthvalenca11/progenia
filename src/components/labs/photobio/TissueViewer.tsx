import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { usePhotobioStore } from "@/stores/photobioStore";
import { LabCanvasSurface } from "@/components/labs/LabCanvasSurface";
import { isAndroidNative } from "@/lib/labPerformance";
import {
  getPhotobioBeamNodeCount,
  getPhotobioLedCount,
  getPhotobioRingCount,
  getPhotobioScatterCount,
  shouldCastTherapeuticShadows,
} from "@/lib/therapeuticLabsPerformance";

const CAST_SHADOW = shouldCastTherapeuticShadows();
import { Button } from "@/components/ui/button";
import type { ClinicalSkinTone } from "@/lib/clinicalSkinTones";
import { pickRandomClinicalSkinTone } from "@/lib/clinicalSkinTones";
import {
  clinicalTissueMaterialProps,
  createClinicalTissueTexture,
} from "@/lib/clinicalTissueTextures";
import {
  buildOrganicLayerGeometry,
  createTissueStackSeed,
  ORGANIC_LAYER_SEGMENTS,
  tissueBoundarySeed,
} from "@/lib/clinicalTissueGeometry";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const TRANSDUCER_BASE_OFFSET = 1.01;

function applyContactIndent(
  geometry: THREE.BufferGeometry,
  {
    height,
    centerX,
    indent,
    radiusX,
    radiusZ,
    topWeighted,
  }: {
    height: number;
    centerX: number;
    indent: number;
    radiusX: number;
    radiusZ: number;
    topWeighted?: boolean;
  },
) {
  if (indent <= 0) return;
  const pos = geometry.attributes.position;
  const halfH = height / 2;

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = (x - centerX) / Math.max(radiusX, 0.001);
    const nz = z / Math.max(radiusZ, 0.001);
    const radial = nx * nx + nz * nz;
    if (radial > 4) continue;
    const gaussian = Math.exp(-radial * 2.2);
    const yNorm = clamp((y + halfH) / Math.max(height, 0.001), 0, 1);
    const verticalWeight = topWeighted ? 0.3 + 0.7 * yNorm : 0.7 + 0.3 * yNorm;
    pos.setY(i, y - indent * gaussian * verticalWeight);
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

function TissueScene({
  wavelength,
  irradiance,
  mode,
  dutyCycle,
  bioActive,
  translucentView,
  layerConfig,
  muscleFluenceRatio,
  transducerAngle,
  transducerX,
  contactPressure,
  isDragging,
  effectiveFluence,
  doseMap,
  spotSize,
  onAccumulateDose,
  onTransducerLeftDragStart,
  onTransducerLeftDragMove,
  onTransducerRightDragStart,
  onTransducerRightDragMove,
  onTransducerRightDragEnd,
  skinTone,
}: {
  wavelength: 660 | 808;
  irradiance: number;
  mode: "CW" | "Pulsed";
  dutyCycle: number;
  bioActive: boolean;
  translucentView: boolean;
  layerConfig: {
    epidermisMm: number;
    dermisMm: number;
    adiposeMm: number;
    muscleMm: number;
  };
  muscleFluenceRatio: number;
  transducerAngle: number;
  transducerX: number;
  contactPressure: number;
  isDragging: boolean;
  effectiveFluence: number;
  doseMap: number[];
  spotSize: number;
  onAccumulateDose: (positionX: number, doseDelta: number) => void;
  onTransducerLeftDragStart: (clientX: number, clientY: number) => void;
  onTransducerLeftDragMove: (clientX: number, clientY: number) => void;
  onTransducerRightDragStart: (clientX: number, clientY: number) => void;
  onTransducerRightDragMove: (clientX: number, clientY: number) => void;
  onTransducerRightDragEnd: () => void;
  skinTone: ClinicalSkinTone;
}) {
  const beamCoreRefs = useRef<THREE.Mesh[]>([]);
  const beamHaloRefs = useRef<THREE.Mesh[]>([]);
  const ringRefs = useRef<THREE.Mesh[]>([]);
  const scatterRefs = useRef<THREE.Mesh[]>([]);
  const tissueChargeRef = useRef<THREE.Mesh>(null);
  const ledRefs = useRef<THREE.Mesh[]>([]);

  const textures = useMemo(
    () => ({
      epidermis: createClinicalTissueTexture("epidermis", { skinTone }),
      dermis: createClinicalTissueTexture("dermis", { skinTone }),
      adipose: createClinicalTissueTexture("adipose", { skinTone }),
      muscle: createClinicalTissueTexture("muscle", { skinTone }),
    }),
    [skinTone],
  );

  const baseY = -0.6;
  const mmToWorld = 0.09;
  const sizes = {
    width: 8.5,
    depth: 3.4,
    epidermis: clamp(layerConfig.epidermisMm * mmToWorld, 0.08, 0.35),
    dermis: clamp(layerConfig.dermisMm * mmToWorld, 0.2, 1.2),
    adipose: clamp(layerConfig.adiposeMm * mmToWorld, 0.25, 3.6),
    muscle: clamp(layerConfig.muscleMm * mmToWorld, 0.8, 4.2),
  };
  const totalHeight = sizes.epidermis + sizes.dermis + sizes.adipose + sizes.muscle;
  const topSurfaceY = baseY + (sizes.epidermis + sizes.dermis + sizes.adipose + sizes.muscle) / 2;
  const epidermisCenterY = topSurfaceY - sizes.epidermis / 2;
  const dermisCenterY = topSurfaceY - sizes.epidermis - sizes.dermis / 2;
  const adiposeCenterY =
    topSurfaceY - sizes.epidermis - sizes.dermis - sizes.adipose / 2;
  const muscleCenterY =
    topSurfaceY -
    sizes.epidermis -
    sizes.dermis -
    sizes.adipose -
    sizes.muscle / 2;
  const beamColor = wavelength === 660 ? "#FF4500" : "#FF00FF";
  const glowColor = wavelength === 660 ? "#ff5a2a" : "#ff47ff";
  const accentColor = wavelength === 660 ? "#78d7ff" : "#7efcc5";
  const glowStrength = clamp(0.3 + irradiance / 650, 0.3, 1.35);
  const beamDepth = Math.max(
    1.9,
    Math.min(
      sizes.epidermis + sizes.dermis + sizes.adipose + sizes.muscle - 0.12,
      wavelength === 660 ? 2.2 : 4.8
    )
  );
  const thermalRisk = irradiance > 500;
  const badAngle = transducerAngle < 70 || transducerAngle > 110;
  const badPressureLow = contactPressure < 20;
  const badPressureHigh = contactPressure > 80;
  const translucentBoost = translucentView ? 1.35 : 1;
  const tiltZ = ((transducerAngle - 90) * Math.PI) / 180;
  const pressureNorm = clamp(contactPressure / 100, 0, 1);
  const contactIndent = pressureNorm * 0.2;
  const pressureFocusing = 1 - clamp((contactPressure - 50) / 100, -0.2, 0.35);
  const spotNorm = clamp((spotSize - 0.1) / 0.9, 0, 1);
  const spotScale = 0.75 + spotNorm * 1.25;
  const contactRadiusX = 0.28 + spotScale * 0.62;
  const contactRadiusZ = 0.24 + spotScale * 0.5;
  const contactSurfaceY = topSurfaceY - contactIndent;
  const doseTickRef = useRef(0);
  const stackSeed = useMemo(() => createTissueStackSeed(), []);
  const beamNodeCount = getPhotobioBeamNodeCount(wavelength);
  const scatterCount = getPhotobioScatterCount(wavelength);
  const ledCount = getPhotobioLedCount();
  const ringCount = getPhotobioRingCount();

  const scatterOffsets = useMemo(
    () =>
      Array.from({ length: scatterCount }, (_, i) => ({
        xOffset: Math.sin(i * 2.17 + stackSeed * 0.01) * 0.8,
        zOffset: Math.cos(i * 1.83 + stackSeed * 0.013) * 0.6,
        size: wavelength === 660 ? 0.22 + (i % 5) * 0.02 : 0.2 + (i % 4) * 0.03,
      })),
    [scatterCount, stackSeed, wavelength],
  );

  const epidermisGeometry = useMemo(() => {
    const geo = buildOrganicLayerGeometry({
      width: sizes.width,
      height: sizes.epidermis,
      depth: sizes.depth,
      boundarySeedTop: tissueBoundarySeed(stackSeed, 0),
      boundarySeedBottom: tissueBoundarySeed(stackSeed, 1),
      kind: "epidermis",
      topAmplitudeScale: 0.022,
      segments: ORGANIC_LAYER_SEGMENTS,
    });
    applyContactIndent(geo, {
      height: sizes.epidermis,
      centerX: transducerX,
      indent: contactIndent,
      radiusX: contactRadiusX,
      radiusZ: contactRadiusZ,
    });
    return geo;
  }, [
    stackSeed,
    sizes.width,
    sizes.epidermis,
    sizes.depth,
    transducerX,
    contactIndent,
    contactRadiusX,
    contactRadiusZ,
  ]);

  const dermisGeometry = useMemo(() => {
    const geo = buildOrganicLayerGeometry({
      width: sizes.width,
      height: sizes.dermis,
      depth: sizes.depth,
      boundarySeedTop: tissueBoundarySeed(stackSeed, 1),
      boundarySeedBottom: tissueBoundarySeed(stackSeed, 2),
      kind: "dermis",
      segments: ORGANIC_LAYER_SEGMENTS,
    });
    applyContactIndent(geo, {
      height: sizes.dermis,
      centerX: transducerX,
      indent: contactIndent * 0.7,
      radiusX: contactRadiusX * 1.12,
      radiusZ: contactRadiusZ * 1.12,
      topWeighted: true,
    });
    return geo;
  }, [
    stackSeed,
    sizes.width,
    sizes.dermis,
    sizes.depth,
    transducerX,
    contactIndent,
    contactRadiusX,
    contactRadiusZ,
  ]);

  const adiposeGeometry = useMemo(
    () =>
      buildOrganicLayerGeometry({
        width: sizes.width,
        height: sizes.adipose,
        depth: sizes.depth,
        boundarySeedTop: tissueBoundarySeed(stackSeed, 2),
        boundarySeedBottom: tissueBoundarySeed(stackSeed, 3),
        kind: "adipose",
        segments: ORGANIC_LAYER_SEGMENTS,
      }),
    [stackSeed, sizes.width, sizes.adipose, sizes.depth],
  );

  const muscleGeometry = useMemo(
    () =>
      buildOrganicLayerGeometry({
        width: sizes.width,
        height: sizes.muscle,
        depth: sizes.depth,
        boundarySeedTop: tissueBoundarySeed(stackSeed, 3),
        boundarySeedBottom: tissueBoundarySeed(stackSeed, 4),
        kind: "muscle",
        segments: ORGANIC_LAYER_SEGMENTS,
      }),
    [stackSeed, sizes.width, sizes.muscle, sizes.depth],
  );

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const pulsePeriod = 0.85;
    const dutyNorm = clamp(dutyCycle / 100, 0.1, 0.9);
    const phase = (t % pulsePeriod) / pulsePeriod;
    const pulse =
      mode === "Pulsed"
        ? phase < dutyNorm
          ? 1
          : 0.12 + 0.08 * Math.sin(t * 22)
        : 1;
    beamCoreRefs.current.forEach((node, idx) => {
      const mat = node.material as THREE.MeshStandardMaterial;
      const progress = idx / Math.max(1, beamCoreRefs.current.length - 1);
      const attenuation = Math.exp(-(wavelength === 660 ? 2.8 : 1.45) * progress);
      const deepLoss = 0.35 + muscleFluenceRatio * 0.65;
      const twinkle = 0.88 + 0.12 * Math.sin(t * 9 + idx * 0.5);
      const nodePulse = pulse * twinkle;
      mat.opacity = clamp(
        0.28 * attenuation * deepLoss * nodePulse * translucentBoost,
        0.02,
        0.65
      );
      mat.emissiveIntensity = clamp(
        1.15 * attenuation * deepLoss * nodePulse * translucentBoost,
        0.08,
        2.6
      );
      const base = (wavelength === 660 ? 0.2 : 0.15) * spotScale;
      const spread = (wavelength === 660 ? 0.16 : 0.09) * spotScale;
      const radius = base + progress * spread;
      node.scale.set(radius, radius * 0.9, radius);
    });
    beamHaloRefs.current.forEach((node, idx) => {
      const mat = node.material as THREE.MeshStandardMaterial;
      const progress = idx / Math.max(1, beamHaloRefs.current.length - 1);
      const attenuation = Math.exp(-(wavelength === 660 ? 1.95 : 1.1) * progress);
      const deepLoss = 0.3 + muscleFluenceRatio * 0.7;
      const wobble = 0.75 + 0.25 * Math.sin(t * 3.5 + idx * 0.7);
      const nodePulse = pulse * wobble;
      mat.opacity = clamp(
        0.18 * attenuation * deepLoss * nodePulse * translucentBoost,
        0.015,
        0.4
      );
      mat.emissiveIntensity = clamp(
        0.95 * attenuation * deepLoss * nodePulse * translucentBoost,
        0.06,
        2.1
      );
      const base = (wavelength === 660 ? 0.34 : 0.25) * spotScale;
      const spread = (wavelength === 660 ? 0.3 : 0.2) * spotScale;
      const radius = base + progress * spread;
      node.scale.set(radius, radius * 1.05, radius);
    });
    ringRefs.current.forEach((ring, index) => {
      const mat = ring.material as THREE.MeshStandardMaterial;
      const phase = (t * 2.7 + index * 0.37) % 1;
      const y = topSurfaceY - 0.08 - phase * beamDepth;
      ring.position.y = y;
      const depthFade = clamp(
        (1 - phase * (wavelength === 660 ? 1.3 : 0.9)) * (0.35 + muscleFluenceRatio * 0.65),
        0.05,
        1
      );
      const ringPulse = (mode === "Pulsed" ? pulse : 1) * depthFade;
      mat.opacity = clamp(0.28 * ringPulse * translucentBoost, 0.05, 0.56);
      mat.emissiveIntensity = clamp(1.05 * ringPulse * translucentBoost, 0.15, 2);
      ring.scale.setScalar((0.8 + phase * (wavelength === 660 ? 1.6 : 1.1)) * spotScale);
    });
    scatterRefs.current.forEach((m, index) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      const wobble = 0.5 + 0.5 * Math.sin(t * 1.8 + index * 0.9);
      mat.opacity = clamp(0.05 + wobble * 0.12 * glowStrength * translucentBoost, 0.04, 0.34);
      mat.emissiveIntensity = clamp(0.25 + wobble * 0.8 * glowStrength * translucentBoost, 0.12, 1.65);
    });
    if (tissueChargeRef.current) {
      const mat = tissueChargeRef.current.material as THREE.MeshStandardMaterial;
      const chargePulse = 0.6 + 0.4 * Math.sin(t * (mode === "Pulsed" ? 8 : 3));
      const activeBoost = bioActive ? 1 : 0.4;
      mat.opacity = clamp(0.05 + chargePulse * 0.16 * activeBoost, 0.04, 0.24);
      mat.emissiveIntensity = clamp(0.22 + chargePulse * 1.1 * activeBoost, 0.2, 1.55);
    }
    ledRefs.current.forEach((led, index) => {
      const mat = led.material as THREE.MeshStandardMaterial;
      const blink = mode === "Pulsed" ? 0.5 + 0.5 * Math.sin(t * 18 + index * 0.45) : 0.95;
      mat.emissiveIntensity = clamp(0.7 + blink * 1.4, 0.6, 2.2);
      mat.opacity = clamp(0.65 + blink * 0.35, 0.65, 1);
    });

    if (isDragging) {
      doseTickRef.current += delta;
      if (doseTickRef.current >= 0.08) {
        const doseDelta = Math.max(0.04, effectiveFluence * 0.018 * doseTickRef.current);
        onAccumulateDose(transducerX, doseDelta);
        doseTickRef.current = 0;
      }
    } else {
      doseTickRef.current = 0;
    }
  });

  return (
    <>
      <ambientLight intensity={0.38} color="#f8f4ef" />
      <hemisphereLight args={["#fff8f0", "#6b5344", 0.28]} />
      <directionalLight
        castShadow={CAST_SHADOW}
        position={[5, 6, 4]}
        intensity={0.82}
        color="#fff8f0"
        shadow-mapSize={CAST_SHADOW ? [1024, 1024] : undefined}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-4, 3, -2]} intensity={0.22} color="#ffe8d8" />
      <pointLight position={[0, contactSurfaceY + 0.85, 0]} intensity={1.6} color={beamColor} distance={8} />

      {/* Tissue slab — camadas orgânicas irregulares */}
      <group>
        <mesh position={[0, epidermisCenterY, 0]} geometry={epidermisGeometry} castShadow={CAST_SHADOW} receiveShadow={CAST_SHADOW}>
          <meshStandardMaterial
            {...clinicalTissueMaterialProps("skin", textures.epidermis)}
            transparent={translucentView}
            opacity={translucentView ? 0.55 : 1}
            depthWrite={!translucentView}
            side={translucentView ? THREE.DoubleSide : THREE.FrontSide}
          />
        </mesh>
        <mesh position={[0, dermisCenterY, 0]} geometry={dermisGeometry} castShadow={CAST_SHADOW} receiveShadow={CAST_SHADOW}>
          <meshStandardMaterial
            {...clinicalTissueMaterialProps("skin", textures.dermis)}
            transparent={translucentView}
            opacity={translucentView ? 0.5 : 1}
            depthWrite={!translucentView}
            side={translucentView ? THREE.DoubleSide : THREE.FrontSide}
          />
        </mesh>
        <mesh position={[0, adiposeCenterY, 0]} geometry={adiposeGeometry} castShadow={CAST_SHADOW} receiveShadow={CAST_SHADOW}>
          <meshStandardMaterial
            {...clinicalTissueMaterialProps("fat", textures.adipose)}
            transparent={translucentView}
            opacity={translucentView ? 0.48 : 1}
            depthWrite={!translucentView}
            side={translucentView ? THREE.DoubleSide : THREE.FrontSide}
          />
        </mesh>
        <mesh position={[0, muscleCenterY, 0]} geometry={muscleGeometry} castShadow={CAST_SHADOW} receiveShadow={CAST_SHADOW}>
          <meshStandardMaterial
            {...clinicalTissueMaterialProps("muscle", textures.muscle)}
            transparent={translucentView}
            opacity={translucentView ? 0.46 : 1}
            depthWrite={!translucentView}
            side={translucentView ? THREE.DoubleSide : THREE.FrontSide}
          />
        </mesh>
      </group>

      {/* Premium transducer (industrial design) */}
      <group
        position={[transducerX, contactSurfaceY + 0.003, 0]}
        rotation={[0.08, 0, tiltZ]}
        onPointerDown={(e) => {
          if (e.button === 2) {
            e.stopPropagation();
            onTransducerRightDragStart(e.clientX, e.clientY);
            return;
          }
          if (e.button === 0) {
            e.stopPropagation();
            onTransducerLeftDragStart(e.clientX, e.clientY);
          }
        }}
        onPointerMove={(e) => {
          if (e.buttons === 2) {
            e.stopPropagation();
            onTransducerRightDragMove(e.clientX, e.clientY);
            return;
          }
          if (e.buttons === 1) {
            e.stopPropagation();
            onTransducerLeftDragMove(e.clientX, e.clientY);
          }
        }}
        onPointerUp={(e) => {
          if (e.button !== 2 && e.button !== 0) return;
          e.stopPropagation();
          onTransducerRightDragEnd();
        }}
        onPointerLeave={() => onTransducerRightDragEnd()}
      >
        <group position={[0, TRANSDUCER_BASE_OFFSET, 0]}>
        <mesh position={[0, 0.12, 0]}>
          <capsuleGeometry args={[0.24, 0.95, 16, 32]} />
          <meshPhysicalMaterial
            color="#f6f7f8"
            roughness={0.3}
            metalness={0.22}
            clearcoat={1}
            clearcoatRoughness={0.1}
            sheen={0.4}
            sheenColor="#ffffff"
          />
        </mesh>
        <mesh position={[0, 0.45, 0]}>
          <torusGeometry args={[0.19, 0.018, 14, 40]} />
          <meshStandardMaterial color="#cfd6de" roughness={0.12} metalness={0.95} />
        </mesh>
        <mesh position={[0, -0.38, 0]}>
          <torusGeometry args={[0.24, 0.03, 18, 48]} />
          <meshStandardMaterial color="#d7dde5" roughness={0.1} metalness={1} />
        </mesh>
        <mesh position={[0, -0.5, 0]}>
          <torusGeometry args={[0.2, 0.028, 18, 48]} />
          <meshStandardMaterial color={accentColor} roughness={0.48} metalness={0.18} />
        </mesh>
        <mesh position={[0, -0.72, 0]}>
          <cylinderGeometry args={[0.19, 0.2, 0.28, 32]} />
          <meshStandardMaterial color="#d5dce4" roughness={0.14} metalness={0.9} />
        </mesh>
        <mesh position={[0, -0.93, 0]}>
          <cylinderGeometry args={[0.17, 0.18, 0.16, 40]} />
          <meshPhysicalMaterial color="#d8f4fb" transmission={0.92} roughness={0.06} thickness={0.5} transparent opacity={0.84} />
        </mesh>

        {/* Side buttons (power/mode) */}
        <mesh position={[0.225, 0.12, 0.03]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.03, 0.14, 8, 16]} />
          <meshStandardMaterial color="#a7f0d0" roughness={0.62} metalness={0.08} />
        </mesh>
        <mesh position={[0.225, -0.07, -0.03]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.03, 0.14, 8, 16]} />
          <meshStandardMaterial color="#8fe0ff" roughness={0.6} metalness={0.1} />
        </mesh>

        {/* LED/Laser concentric matrix */}
        {Array.from({ length: ledCount }).map((_, i) => {
          const ring = i === 0 ? 0 : i < 7 ? 0.045 : i < 13 ? 0.085 : 0.125;
          const idxInRing = i === 0 ? 0 : i < 7 ? i - 1 : i < 13 ? i - 7 : i - 13;
          const countInRing = i === 0 ? 1 : i < 7 ? 6 : i < 13 ? 6 : 6;
          const angle = (idxInRing / Math.max(1, countInRing)) * Math.PI * 2;
          return (
            <mesh
              key={`led-${i}`}
              ref={(el) => {
                if (el) ledRefs.current[i] = el;
              }}
              position={[Math.cos(angle) * ring, -0.99, Math.sin(angle) * ring]}
            >
              <cylinderGeometry args={[0.012, 0.012, 0.016, 12]} />
              <meshStandardMaterial
                color={beamColor}
                emissive={beamColor}
                emissiveIntensity={1.5}
                roughness={0.18}
                metalness={0.3}
                transparent
                opacity={0.95}
              />
            </mesh>
          );
        })}
        </group>
      </group>

      {/* Bioactive tissue glow for pedagogical feedback */}
      <mesh
        ref={tissueChargeRef}
        position={[transducerX, contactSurfaceY - beamDepth * 0.5, 0]}
      >
        <cylinderGeometry
          args={[
            wavelength === 660 ? 1.35 : 1.05,
            wavelength === 660 ? 1.75 : 1.35,
            Math.min(totalHeight - 0.1, wavelength === 660 ? 2.5 : 4.1),
            48,
            1,
            true,
          ]}
        />
        <meshStandardMaterial
          color={beamColor}
          emissive={beamColor}
          emissiveIntensity={bioActive ? 1.1 : 0.45}
          transparent
          opacity={bioActive ? 0.18 : 0.08}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Biologically faithful beam: luminous nodes with depth attenuation */}
      {Array.from({ length: beamNodeCount }).map((_, i) => {
        const progress = i / Math.max(1, beamNodeCount - 1);
        const y = contactSurfaceY - 0.08 - progress * beamDepth;
        const xTilt = Math.sin(tiltZ) * progress * 1.25;
        return (
          <mesh
            key={`beam-core-${i}`}
            ref={(el) => {
              if (el) beamCoreRefs.current[i] = el;
            }}
            position={[transducerX + xTilt, y, 0]}
          >
            <sphereGeometry args={[0.16 * pressureFocusing, 24, 24]} />
            <meshStandardMaterial
              color={beamColor}
              emissive={beamColor}
              emissiveIntensity={1.2}
              transparent
              opacity={0.32}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
      {Array.from({ length: beamNodeCount }).map((_, i) => {
        const progress = i / Math.max(1, beamNodeCount - 1);
        const y = contactSurfaceY - 0.08 - progress * beamDepth;
        const lateral =
          (wavelength === 660 ? 0.15 : 0.08) * Math.sin(i * 0.75) +
          Math.sin(tiltZ) * progress * 1.1;
        return (
          <mesh
            key={`beam-halo-${i}`}
            ref={(el) => {
              if (el) beamHaloRefs.current[i] = el;
            }}
            position={[transducerX + lateral, y, 0]}
          >
            <sphereGeometry args={[0.28 * pressureFocusing, 20, 20]} />
            <meshStandardMaterial
              color={glowColor}
              emissive={glowColor}
              emissiveIntensity={1}
              transparent
              opacity={0.15}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}

      {/* Cascata pulsante de aneis concentricos */}
      {Array.from({ length: ringCount }).map((_, i) => (
        <mesh
          key={`ring-${i}`}
          ref={(el) => {
            if (el) ringRefs.current[i] = el;
          }}
          position={[transducerX, contactSurfaceY - 0.2 - i * 0.3, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[(0.34 + i * 0.025) * pressureFocusing, 0.028, 14, 72]} />
          <meshStandardMaterial
            color={beamColor}
            emissive={beamColor}
            emissiveIntensity={1.0}
            transparent
            opacity={0.2}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}

      {/* Contact compression + thermal warning */}
      <mesh position={[transducerX, contactSurfaceY + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.42, 42]} />
        <meshStandardMaterial
          color={thermalRisk ? "#ff4d4d" : "#ffffff"}
          emissive={thermalRisk ? "#ff2020" : "#707070"}
          emissiveIntensity={thermalRisk ? 1.1 : 0.2}
          transparent
          opacity={thermalRisk ? 0.8 : 0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[transducerX, contactSurfaceY + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.14 + spotScale * 0.18, 40]} />
        <meshStandardMaterial
          color="#130b09"
          emissive="#2f1d18"
          emissiveIntensity={0.12 + pressureNorm * 0.35}
          transparent
          opacity={0.12 + pressureNorm * 0.2}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Scattering organico no tecido */}
      {scatterOffsets.map((scatter, i) => {
        const zSpread = wavelength === 660 ? 1.7 : 2.7;
        const yBase = contactSurfaceY - 0.45 - (i / Math.max(1, scatterCount)) * zSpread;
        return (
          <mesh
            key={`scatter-${i}`}
            ref={(el) => {
              if (el) scatterRefs.current[i] = el;
            }}
            position={[transducerX + scatter.xOffset, yBase, scatter.zOffset]}
          >
            <sphereGeometry args={[scatter.size, 16, 16]} />
            <meshStandardMaterial
              color={beamColor}
              emissive={beamColor}
              emissiveIntensity={0.55}
              transparent
              opacity={0.1}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}

      {/* Dose accumulation heat strip */}
      <group>
        {doseMap.map((dose, i) => {
          const n = clamp(dose / 30, 0, 1);
          const x = -2.8 + (i / Math.max(1, doseMap.length - 1)) * 5.6;
          const c = n < 0.55 ? "#22c55e" : "#ef4444";
          return (
            <mesh key={`dose-${i}`} position={[x, topSurfaceY + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[5.8 / doseMap.length, 0.14]} />
              <meshStandardMaterial
                color={c}
                emissive={c}
                emissiveIntensity={0.2 + n * 1.6}
                transparent
                opacity={0.05 + n * 0.45}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                side={THREE.DoubleSide}
              />
            </mesh>
          );
        })}
      </group>

      {/* Floating depth labels */}
      <Html position={[4.65, topSurfaceY - sizes.epidermis * 0.5, 1.0]} center distanceFactor={10}>
        <div className="text-white text-[11px] font-medium drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">Epiderme</div>
      </Html>
      <Html position={[4.65, topSurfaceY - sizes.epidermis - sizes.dermis * 0.5, 1.0]} center distanceFactor={10}>
        <div className="text-white text-[11px] font-medium drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">Derme</div>
      </Html>
      <Html
        position={[4.65, topSurfaceY - sizes.epidermis - sizes.dermis - sizes.adipose * 0.5, 1.0]}
        center
        distanceFactor={10}
      >
        <div className="text-white text-[11px] font-medium drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">Tecido Adiposo</div>
      </Html>
      <Html
        position={[
          4.65,
          topSurfaceY - sizes.epidermis - sizes.dermis - sizes.adipose - sizes.muscle * 0.5,
          1.0,
        ]}
        center
        distanceFactor={10}
      >
        <div className="text-white text-[11px] font-medium drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">Músculo</div>
      </Html>

      {thermalRisk && (
        <Html position={[0, topSurfaceY + 0.42, 0.75]} center distanceFactor={9}>
          <div className="rounded-md border-2 border-red-400 bg-red-600/35 px-2.5 py-1 text-[11px] font-bold text-red-50 shadow-lg shadow-red-500/30 animate-pulse">
            ⚠ Risco Térmico — {irradiance.toFixed(0)} mW/cm²
          </div>
        </Html>
      )}

      {badAngle && (
        <Html position={[transducerX, contactSurfaceY + 1.05, 0.4]} center distanceFactor={9}>
          <div className="rounded-md border border-amber-400/80 bg-amber-500/25 px-2 py-1 text-[10px] font-semibold text-amber-100 whitespace-nowrap">
            Ângulo inadequado ({transducerAngle.toFixed(0)}°)
          </div>
        </Html>
      )}

      {badPressureLow && (
        <Html position={[transducerX - 0.55, contactSurfaceY + 0.55, 0.5]} center distanceFactor={9}>
          <div className="rounded-md border border-sky-400/70 bg-sky-500/20 px-2 py-1 text-[10px] font-semibold text-sky-100 whitespace-nowrap">
            Contato insuficiente
          </div>
        </Html>
      )}

      {badPressureHigh && (
        <Html position={[transducerX + 0.55, contactSurfaceY + 0.55, 0.5]} center distanceFactor={9}>
          <div className="rounded-md border border-orange-400/70 bg-orange-500/25 px-2 py-1 text-[10px] font-semibold text-orange-100 whitespace-nowrap">
            Pressão excessiva
          </div>
        </Html>
      )}
    </>
  );
}

export function TissueViewer() {
  const wavelength = usePhotobioStore((s) => s.wavelength);
  const irradiance = usePhotobioStore((s) => s.irradiance());
  const mode = usePhotobioStore((s) => s.mode);
  const dutyCycle = usePhotobioStore((s) => s.dutyCycle);
  const spotSize = usePhotobioStore((s) => s.spotSize);
  const zone = usePhotobioStore((s) => s.interaction.arndtSchulzZone);
  const muscleFluenceRatio = usePhotobioStore((s) => s.interaction.muscleFluenceRatio);
  const effectiveFluence = usePhotobioStore((s) => s.interaction.effectiveFluence);
  const layerConfig = usePhotobioStore((s) => s.layerConfig);
  const transducerAngle = usePhotobioStore((s) => s.transducerAngle);
  const transducerX = usePhotobioStore((s) => s.transducerX);
  const contactPressure = usePhotobioStore((s) => s.contactPressure);
  const isDragging = usePhotobioStore((s) => s.isDragging);
  const doseMap = usePhotobioStore((s) => s.doseMap);
  const setTransducerAngle = usePhotobioStore((s) => s.setTransducerAngle);
  const setTransducerX = usePhotobioStore((s) => s.setTransducerX);
  const setIsDragging = usePhotobioStore((s) => s.setIsDragging);
  const setDraggingSpeed = usePhotobioStore((s) => s.setDraggingSpeed);
  const accumulateDoseAt = usePhotobioStore((s) => s.accumulateDoseAt);
  const bioActive = zone === "Janela Terapêutica Ativa";
  const [translucentView, setTranslucentView] = useState(false);
  const skinTone = useMemo(() => pickRandomClinicalSkinTone(), []);
  const dragRef = useRef<{ x: number; y: number; t: number; button: number } | null>(null);

  const handleTransducerRightDragStart = (clientX: number, clientY: number) => {
    dragRef.current = { x: clientX, y: clientY, t: performance.now(), button: 2 };
    setIsDragging(true);
  };

  const handleTransducerRightDragMove = (clientX: number, clientY: number) => {
    const prev = dragRef.current;
    if (!prev || prev.button !== 2) return;
    const now = performance.now();
    const dx = clientX - prev.x;
    const dy = clientY - prev.y;
    const dt = Math.max(1, now - prev.t);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const pxPerMs = distance / dt;
    const speedFactor = clamp(pxPerMs * 6, 0.2, 5);
    setDraggingSpeed(speedFactor);
    setTransducerAngle(transducerAngle + dx * 0.25);
    dragRef.current = { x: clientX, y: clientY, t: now, button: 2 };
  };

  const handleTransducerLeftDragStart = (clientX: number, clientY: number) => {
    dragRef.current = { x: clientX, y: clientY, t: performance.now(), button: 0 };
    setIsDragging(true);
  };

  const handleTransducerLeftDragMove = (clientX: number, clientY: number) => {
    const prev = dragRef.current;
    if (!prev || prev.button !== 0) return;
    const now = performance.now();
    const dx = clientX - prev.x;
    const dy = clientY - prev.y;
    const dt = Math.max(1, now - prev.t);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const pxPerMs = distance / dt;
    const speedFactor = clamp(pxPerMs * 6, 0.2, 5);
    setDraggingSpeed(speedFactor);
    setTransducerX(transducerX + dx * 0.01);
    dragRef.current = { x: clientX, y: clientY, t: now, button: 0 };
  };

  const handleTransducerRightDragEnd = () => {
    dragRef.current = null;
    setIsDragging(false);
    setDraggingSpeed(1);
  };

  return (
    <div className="relative h-full w-full rounded-xl border bg-card p-3">
      <div className="absolute left-5 top-5 z-10">
        <Button
          type="button"
          variant={translucentView ? "default" : "secondary"}
          size="sm"
          onClick={() => setTranslucentView((prev) => !prev)}
          className="shadow-md min-h-[44px]"
          aria-label={translucentView ? "Desativar visão translúcida dos tecidos" : "Ativar visão translúcida dos tecidos"}
        >
          {translucentView ? "Visão normal" : "Visão translúcida"}
        </Button>
      </div>
      <div className="h-full w-full overflow-hidden rounded-lg bg-[#0f0f12]">
        <LabCanvasSurface onContextMenu={(e) => e.preventDefault()}>
          <PerspectiveCamera makeDefault position={[0, 1.25, 8.6]} fov={42} />
          <TissueScene
            wavelength={wavelength}
            irradiance={irradiance}
            mode={mode}
            dutyCycle={dutyCycle}
            bioActive={bioActive}
            translucentView={translucentView}
            layerConfig={layerConfig}
            muscleFluenceRatio={muscleFluenceRatio}
            transducerAngle={transducerAngle}
            transducerX={transducerX}
            contactPressure={contactPressure}
            isDragging={isDragging}
            effectiveFluence={effectiveFluence}
            doseMap={doseMap}
            spotSize={spotSize}
            onAccumulateDose={accumulateDoseAt}
            onTransducerRightDragStart={handleTransducerRightDragStart}
            onTransducerRightDragMove={handleTransducerRightDragMove}
            onTransducerLeftDragStart={handleTransducerLeftDragStart}
            onTransducerLeftDragMove={handleTransducerLeftDragMove}
            onTransducerRightDragEnd={handleTransducerRightDragEnd}
            skinTone={skinTone}
          />
          <OrbitControls
            makeDefault
            enablePan={false}
            minDistance={6.5}
            maxDistance={11.5}
            maxPolarAngle={Math.PI * 0.6}
            enableDamping={!isAndroidNative}
          />
        </LabCanvasSurface>
      </div>
    </div>
  );
}

