import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { PhotobioWavelength } from "@/lib/photobioOptics";
import { TRANSDUCER_BASE_OFFSET } from "./photobioViewerLayout";
import {
  APPLICATOR_CONTACT_PAD_HEIGHT,
  APPLICATOR_HEAD_BASE_Y,
  APPLICATOR_MESH_BOTTOM_Y,
  applicatorContactLiftY,
  buildApplicatorLayout,
  clampPowerGlow,
  emitterIntensity,
  WAVELENGTH_COLORS,
  type EmitterSlot,
} from "./photobioApplicatorSpecs";
import type { PhotobioApplicatorType, PhotobioVisualQualityTier } from "./photobioApplicatorTypes";

export type { PhotobioApplicatorType, PhotobioVisualQualityTier } from "./photobioApplicatorTypes";

export interface PhotobioDeviceModelProps {
  applicatorType: PhotobioApplicatorType;
  wavelength: PhotobioWavelength;
  secondaryWavelength?: PhotobioWavelength;
  powerMw: number;
  spotSizeCm2: number;
  isActive: boolean;
  isPulsed: boolean;
  dutyCycle: number;
  contactPressure: number;
  angleDeg: number;
  positionX: number;
  visualQualityTier: PhotobioVisualQualityTier;
  contactAnchorY: number;
  contactPivotOffsetX?: number;
  contactSeatOffsetY?: number;
  contactCenterOffsetX?: number;
  contactBodyPitchX?: number;
  thermalRisk?: boolean;
  onTransducerLeftDragStart: (clientX: number, clientY: number) => void;
  onTransducerLeftDragMove: (clientX: number, clientY: number) => void;
  onTransducerRightDragStart: (clientX: number, clientY: number) => void;
  onTransducerRightDragMove: (clientX: number, clientY: number) => void;
  onTransducerRightDragEnd: () => void;
}

// ── Geometrias memoizadas (singleton) ─────────────────────────────────────────

const geo = {
  emitter: new THREE.CylinderGeometry(0.009, 0.009, 0.014, 8),
  lens: new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.42),
  contactDisc: new THREE.CircleGeometry(1, 32),
  statusLed: new THREE.SphereGeometry(0.012, 10, 10),
  cableSegment: new THREE.TorusGeometry(0.055, 0.014, 8, 24, Math.PI * 1.35),
};

const mat = {
  bodyWhite: new THREE.MeshPhysicalMaterial({
    color: "#f4f6f8",
    roughness: 0.34,
    metalness: 0.08,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    sheen: 0.35,
    sheenColor: "#ffffff",
  }),
  bodyWhiteMatte: new THREE.MeshStandardMaterial({
    color: "#eef1f4",
    roughness: 0.52,
    metalness: 0.04,
  }),
  metalRing: new THREE.MeshStandardMaterial({
    color: "#c8d0d8",
    roughness: 0.14,
    metalness: 0.92,
  }),
  metalDark: new THREE.MeshStandardMaterial({
    color: "#9aa3ad",
    roughness: 0.18,
    metalness: 0.95,
  }),
  accentTeal: new THREE.MeshStandardMaterial({
    color: "#5eead4",
    roughness: 0.55,
    metalness: 0.12,
  }),
  accentBlue: new THREE.MeshStandardMaterial({
    color: "#7dd3fc",
    roughness: 0.5,
    metalness: 0.1,
  }),
  cableBlack: new THREE.MeshStandardMaterial({
    color: "#1a1d22",
    roughness: 0.78,
    metalness: 0.05,
  }),
  lensGlass660: new THREE.MeshPhysicalMaterial({
    color: "#fff0ea",
    transmission: 0.88,
    roughness: 0.04,
    thickness: 0.35,
    transparent: true,
    opacity: 0.82,
  }),
  lensGlass808: new THREE.MeshPhysicalMaterial({
    color: "#2a0820",
    transmission: 0.72,
    roughness: 0.05,
    thickness: 0.4,
    transparent: true,
    opacity: 0.78,
    emissive: "#5a1045",
    emissiveIntensity: 0.25,
  }),
  panelHousing: new THREE.MeshStandardMaterial({
    color: "#e8ebef",
    roughness: 0.45,
    metalness: 0.15,
  }),
};

function InstancedEmitters({
  emitters,
  activeWavelength,
  powerGlow,
  isActive,
  isPulsed,
  dutyCycle,
}: {
  emitters: EmitterSlot[];
  activeWavelength: PhotobioWavelength;
  powerGlow: number;
  isActive: boolean;
  isPulsed: boolean;
  dutyCycle: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    emitters.forEach((slot, i) => {
      dummy.position.set(slot.x, slot.y, slot.z);
      dummy.rotation.x = Math.PI / 2;
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const c = new THREE.Color(WAVELENGTH_COLORS[slot.wavelength].beam);
      mesh.setColorAt(i, c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [emitters, dummy]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.getElapsedTime();
    const pulsePeriod = 0.85;
    const dutyNorm = Math.max(0.1, Math.min(0.9, dutyCycle / 100));
    const phase = (t % pulsePeriod) / pulsePeriod;
    const pulse = isPulsed ? (phase < dutyNorm ? 1 : 0.14 + 0.06 * Math.sin(t * 20)) : 1;

    emitters.forEach((slot, i) => {
      const intensity = emitterIntensity(slot, activeWavelength, powerGlow, pulse, isActive);
      const flicker = 0.88 + 0.12 * Math.sin(t * 11 + i * 0.6);
      const c = new THREE.Color(WAVELENGTH_COLORS[slot.wavelength].glow);
      c.multiplyScalar(intensity * flicker);
      mesh.setColorAt(i, c);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo.emitter, undefined, emitters.length]}
      frustumCulled={false}
    >
      <meshStandardMaterial
        vertexColors
        emissive="#ffffff"
        emissiveIntensity={1.4}
        roughness={0.22}
        metalness={0.28}
        transparent
        opacity={0.94}
        toneMapped
      />
    </instancedMesh>
  );
}

function CoiledCable({ segments, tier }: { segments: number; tier: PhotobioVisualQualityTier }) {
  if (tier === "low") {
    return (
      <mesh position={[0, 0.55, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.032, 0.45, 10]} />
        <primitive object={mat.cableBlack} attach="material" />
      </mesh>
    );
  }
  return (
    <group position={[0, 0.38, -0.06]}>
      {Array.from({ length: segments }).map((_, i) => (
        <mesh
          key={`coil-${i}`}
          geometry={geo.cableSegment}
          position={[0, i * 0.07, -i * 0.018]}
          rotation={[Math.PI / 2 + i * 0.35, i * 0.5, 0]}
        >
          <primitive object={mat.cableBlack} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

function DeviceDisplay({
  powerMw,
  wavelength,
  position,
}: {
  powerMw: number;
  wavelength: PhotobioWavelength;
  position: [number, number, number];
}) {
  return (
    <Html position={position} transform distanceFactor={6} style={{ pointerEvents: "none" }}>
      <div className="rounded border border-slate-600/80 bg-slate-900/90 px-1.5 py-0.5 font-mono text-[8px] leading-tight text-emerald-300 shadow">
        <div>{powerMw.toFixed(0)} mW</div>
        <div className="text-[7px] text-slate-400">{wavelength} nm</div>
      </div>
    </Html>
  );
}

function ApplicatorFixedGrip({
  type,
  tier,
}: {
  type: PhotobioApplicatorType;
  tier: PhotobioVisualQualityTier;
}) {
  const segs = tier === "low" ? 12 : tier === "medium" ? 14 : 16;

  if (type === "pointLaser") {
    const laserSegs = tier === "low" ? 10 : 14;
    return (
      <group>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.065, 0.07, 0.55, laserSegs]} />
          <primitive object={mat.bodyWhiteMatte} attach="material" />
        </mesh>
        <mesh position={[0, 0.52, 0]}>
          <torusGeometry args={[0.055, 0.008, 10, 28]} />
          <primitive object={mat.metalRing} attach="material" />
        </mesh>
        <mesh position={[0.07, 0.18, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.018, 0.06, 6, 8]} />
          <primitive object={mat.accentBlue} attach="material" />
        </mesh>
      </group>
    );
  }

  if (type === "largeAreaPanel") {
    return (
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.08, 0.04, 0.04]} />
        <meshStandardMaterial color="#334155" roughness={0.6} />
      </mesh>
    );
  }

  const dualSegs = tier === "low" ? 14 : 20;
  const isDual = type === "dualWavelengthCluster";

  return (
    <group>
      <mesh
        position={[0, isDual ? 0.2 : 0.18, isDual ? -0.03 : -0.04]}
        rotation={isDual ? [0.12, 0, 0] : [0.15, 0, 0]}
      >
        <capsuleGeometry
          args={isDual ? [0.23, 0.82, dualSegs, 28] : [0.21, 0.72, segs, 24]}
        />
        <primitive object={mat.bodyWhite} attach="material" />
      </mesh>
      <mesh position={[0, isDual ? 0.58 : 0.52, 0]}>
        <torusGeometry
          args={isDual ? [0.2, 0.018, 14, 44] : [0.17, 0.016, 12, 36]}
        />
        <primitive object={mat.metalRing} attach="material" />
      </mesh>
      {isDual ? (
        <mesh position={[-0.22, 0.1, 0.05]}>
          <boxGeometry args={[0.04, 0.025, 0.012]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.9} />
        </mesh>
      ) : (
        <mesh position={[0.2, 0.08, 0.06]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.2} />
        </mesh>
      )}
    </group>
  );
}

function ApplicatorContactPad({
  headRadius,
  contactFaceY,
  isActive,
  wavelength,
}: {
  headRadius: number;
  contactFaceY: number;
  isActive: boolean;
  wavelength: PhotobioWavelength;
}) {
  const beamColor = WAVELENGTH_COLORS[wavelength].beam;
  return (
    <mesh
      geometry={geo.contactDisc}
      position={[0, contactFaceY, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[headRadius, headRadius, 1]}
      renderOrder={13}
    >
      <meshPhysicalMaterial
        color="#f8fafc"
        emissive={beamColor}
        emissiveIntensity={isActive ? 0.38 : 0.1}
        roughness={0.22}
        metalness={0.04}
        clearcoat={0.95}
        clearcoatRoughness={0.06}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function ApplicatorSlidingStem({
  type,
  tier,
  headRadius,
  contactFaceY,
  isActive,
  wavelength,
}: {
  type: PhotobioApplicatorType;
  tier: PhotobioVisualQualityTier;
  headRadius: number;
  contactFaceY: number;
  isActive: boolean;
  wavelength: PhotobioWavelength;
}) {
  const segs = tier === "low" ? 12 : tier === "medium" ? 14 : 16;

  if (type === "pointLaser") {
    const laserSegs = tier === "low" ? 10 : 14;
    const housingCenterY = contactFaceY + 0.004 + 0.08;
    return (
      <group>
        <mesh position={[0, -0.08, 0]}>
          <cylinderGeometry args={[0.05, 0.055, 0.28, laserSegs]} />
          <primitive object={mat.metalDark} attach="material" />
        </mesh>
        <mesh position={[0, housingCenterY, 0]}>
          <cylinderGeometry args={[headRadius * 0.92, headRadius * 0.85, 0.16, laserSegs]} />
          <meshStandardMaterial color="#d8dee4" roughness={0.22} metalness={0.85} />
        </mesh>
        <ApplicatorContactPad
          headRadius={headRadius}
          contactFaceY={contactFaceY}
          isActive={isActive}
          wavelength={wavelength}
        />
      </group>
    );
  }

  if (type === "largeAreaPanel") {
    return (
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[headRadius * 2.1, 0.14, headRadius * 1.4]} />
        <primitive object={mat.panelHousing} attach="material" />
      </mesh>
    );
  }

  const dualSegs = tier === "low" ? 14 : 20;
  const isDual = type === "dualWavelengthCluster";
  const housingH = isDual ? 0.11 : 0.095;
  const housingCenterY = contactFaceY + 0.004 + housingH / 2;

  return (
    <group>
      <mesh position={[0, isDual ? -0.28 : -0.22, 0]}>
        <cylinderGeometry
          args={
            isDual
              ? [0.19, 0.21, 0.38, dualSegs]
              : [0.17, 0.19, 0.32, segs]
          }
        />
        <primitive object={mat.metalDark} attach="material" />
      </mesh>
      <mesh position={[0, isDual ? -0.55 : -0.48, 0]}>
        <torusGeometry
          args={
            isDual
              ? [headRadius + 0.025, 0.026, 16, 48]
              : [headRadius + 0.02, 0.022, 14, 40]
          }
        />
        <meshStandardMaterial
          color={isDual ? "#b8c4d0" : "#dce4ec"}
          roughness={0.2}
          metalness={isDual ? 0.82 : 0.7}
          transparent
          opacity={isDual ? 0.62 : 0.55}
        />
      </mesh>
      <mesh position={[0, housingCenterY, 0]}>
        <cylinderGeometry
          args={
            isDual
              ? [headRadius, headRadius + 0.01, housingH, dualSegs]
              : [headRadius, headRadius + 0.008, housingH, segs]
          }
        />
        <primitive object={mat.bodyWhiteMatte} attach="material" />
      </mesh>
      <ApplicatorContactPad
        headRadius={headRadius}
        contactFaceY={contactFaceY}
        isActive={isActive}
        wavelength={wavelength}
      />
      {isDual ? (
        <>
          <mesh position={[0.22, 0.05, 0.04]} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.024, 0.11, 6, 10]} />
            <primitive object={mat.accentTeal} attach="material" />
          </mesh>
          <mesh position={[0.22, -0.12, 0.02]} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.024, 0.11, 6, 10]} />
            <meshStandardMaterial color="#fda4af" roughness={0.55} metalness={0.08} />
          </mesh>
        </>
      ) : (
        <mesh position={[0.22, -0.02, 0.04]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.022, 0.1, 6, 10]} />
          <primitive object={mat.accentTeal} attach="material" />
        </mesh>
      )}
    </group>
  );
}

function ApplicatorBody({
  type,
  tier,
  headRadius,
  contactFaceY,
  isActive,
  wavelength,
}: {
  type: PhotobioApplicatorType;
  tier: PhotobioVisualQualityTier;
  headRadius: number;
  contactFaceY: number;
  isActive: boolean;
  wavelength: PhotobioWavelength;
}) {
  return (
    <group>
      <ApplicatorFixedGrip type={type} tier={tier} />
      <ApplicatorSlidingStem
        type={type}
        tier={tier}
        headRadius={headRadius}
        contactFaceY={contactFaceY}
        isActive={isActive}
        wavelength={wavelength}
      />
    </group>
  );
}

function ApplicatorHead({
  type,
  wavelength,
  lensRadius,
  headRadius,
  tier,
  emitters,
  activeWavelength,
  powerGlow,
  isActive,
  isPulsed,
  dutyCycle,
  tipLightRef,
  thermalRisk,
}: {
  type: PhotobioApplicatorType;
  wavelength: PhotobioWavelength;
  lensRadius: number;
  headRadius: number;
  tier: PhotobioVisualQualityTier;
  emitters: EmitterSlot[];
  activeWavelength: PhotobioWavelength;
  powerGlow: number;
  isActive: boolean;
  isPulsed: boolean;
  dutyCycle: number;
  tipLightRef: RefObject<THREE.PointLight | null>;
  thermalRisk: boolean;
}) {
  const lensMat = wavelength === 808 ? mat.lensGlass808 : mat.lensGlass660;
  const isPanel = type === "largeAreaPanel";
  const headBaseY = APPLICATOR_HEAD_BASE_Y[type];
  const contactFaceY = APPLICATOR_MESH_BOTTOM_Y[type];
  const lensY = contactFaceY + APPLICATOR_CONTACT_PAD_HEIGHT + 0.028;

  return (
    <group position={[0, headBaseY, 0]}>
      <ApplicatorBody
        type={type}
        tier={tier}
        headRadius={headRadius}
        contactFaceY={contactFaceY}
        isActive={isActive}
        wavelength={wavelength}
      />

      {!isPanel && (
        <mesh
          geometry={geo.lens}
          position={[0, lensY, 0]}
          scale={[lensRadius, lensRadius * 0.32, lensRadius]}
          rotation={[Math.PI, 0, 0]}
        >
          <primitive object={lensMat} attach="material" />
        </mesh>
      )}

      <group position={[0, lensY - 0.01, 0]}>
        <InstancedEmitters
          emitters={emitters}
          activeWavelength={activeWavelength}
          powerGlow={powerGlow}
          isActive={isActive}
          isPulsed={isPulsed}
          dutyCycle={dutyCycle}
        />
      </group>

      {thermalRisk && (
        <mesh position={[0, contactFaceY + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[headRadius * 0.8, headRadius * 1.6, 36]} />
          <meshStandardMaterial
            color="#ff4d4d"
            emissive="#ff2020"
            emissiveIntensity={1.1}
            transparent
            opacity={0.75}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      <pointLight
        ref={tipLightRef}
        position={[0, lensY + 0.04, 0]}
        intensity={0.35}
        color={WAVELENGTH_COLORS[wavelength].beam}
        distance={type === "pointLaser" ? 2.5 : 4.5}
      />

    </group>
  );
}

export function PhotobioDeviceModel({
  applicatorType,
  wavelength,
  secondaryWavelength,
  powerMw,
  spotSizeCm2,
  isActive,
  isPulsed,
  dutyCycle,
  contactPressure,
  angleDeg,
  positionX,
  visualQualityTier,
  contactAnchorY,
  contactPivotOffsetX = 0,
  contactSeatOffsetY = 0,
  contactCenterOffsetX = 0,
  contactBodyPitchX = 0.08,
  thermalRisk = false,
  onTransducerLeftDragStart,
  onTransducerLeftDragMove,
  onTransducerRightDragStart,
  onTransducerRightDragMove,
  onTransducerRightDragEnd,
}: PhotobioDeviceModelProps) {
  const tipLightRef = useRef<THREE.PointLight>(null);
  const tiltZ = ((angleDeg - 90) * Math.PI) / 180;
  const powerGlow = clampPowerGlow(powerMw);
  const colors = WAVELENGTH_COLORS[wavelength];

  const layout = useMemo(
    () =>
      buildApplicatorLayout(
        applicatorType,
        spotSizeCm2,
        visualQualityTier,
        wavelength,
        secondaryWavelength,
      ),
    [applicatorType, spotSizeCm2, visualQualityTier, wavelength, secondaryWavelength],
  );

  const cableSegments = visualQualityTier === "low" ? 0 : visualQualityTier === "medium" ? 2 : 4;
  const displayPos: [number, number, number] =
    applicatorType === "pointLaser"
      ? [0.1, 0.35, 0.08]
      : applicatorType === "largeAreaPanel"
        ? [0, 0.28, 0.12]
        : [0.14, 0.42, 0.1];

  useFrame(({ clock }) => {
    const light = tipLightRef.current;
    if (!light) return;
    const t = clock.getElapsedTime();
    const pulsePeriod = 0.85;
    const dutyNorm = Math.max(0.1, Math.min(0.9, dutyCycle / 100));
    const phase = (t % pulsePeriod) / pulsePeriod;
    const pulse = isPulsed ? (phase < dutyNorm ? 1 : 0.18) : 1;
    light.intensity = isActive ? (0.28 + powerGlow * 0.45) * pulse : 0.06;
    light.color.set(colors.beam);
  });

  const bodyLift = applicatorType === "largeAreaPanel" ? 0.55 : TRANSDUCER_BASE_OFFSET;
  const contactLift = applicatorContactLiftY(applicatorType, bodyLift);

  return (
    <group
      position={[positionX + contactCenterOffsetX, contactAnchorY - contactSeatOffsetY, 0]}
      renderOrder={12}
    >
      <group position={[contactPivotOffsetX, 0, 0]}>
        <group
          rotation={[contactBodyPitchX, 0, tiltZ]}
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
          <group position={[-contactPivotOffsetX, 0, 0]}>
            <group position={[0, contactLift, 0]}>
              <group position={[0, bodyLift, 0]}>
                {applicatorType !== "largeAreaPanel" && (
                  <CoiledCable segments={cableSegments} tier={visualQualityTier} />
                )}

                <ApplicatorHead
                  type={applicatorType}
                  wavelength={wavelength}
                  lensRadius={layout.lensRadius}
                  headRadius={layout.headRadius}
                  tier={visualQualityTier}
                  emitters={layout.emitters}
                  activeWavelength={wavelength}
                  powerGlow={powerGlow}
                  isActive={isActive}
                  isPulsed={isPulsed}
                  dutyCycle={dutyCycle}
                  tipLightRef={tipLightRef}
                  thermalRisk={thermalRisk}
                />

                {applicatorType !== "largeAreaPanel" && (
                  <DeviceDisplay powerMw={powerMw} wavelength={wavelength} position={displayPos} />
                )}
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
