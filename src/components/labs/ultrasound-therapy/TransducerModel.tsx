/**
 * TransducerModel — lógica de simulação + montagem visual clínica (TherapeuticProbe).
 */

import { useMemo, useRef } from "react";
import { Ring, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  LatheGeometry,
  Mesh,
  MeshLambertMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from "three";
import {
  resolveTransducerFace,
  getTransducerDefinition,
  type TherapeuticTransducerType,
} from "@/config/therapeuticTransducerDefinitions";
import {
  THERAPY_GEL_POOR,
  THERAPY_TRANSDUCER,
  THERAPY_TRANSDUCER_FACE,
} from "./therapyVisualConstants";
import { shouldEnableRealTimeShadows } from "@/lib/ultrasoundVisualQuality";
import {
  TherapeuticProbe,
  CouplingGelLayer,
  ProbeCable,
  setCeramicPulseClinical,
  buildGelDomeProfile,
  computeProbeLayout,
  HANDLE_TILT,
  PROBE_PLASTIC,
} from "./therapeuticProbe";
import {
  createLocalGelSurfaceGeometry,
  type GelStamp,
  patchGelMaterial,
  updateLocalGelSurfaceGeometry,
} from "./gelSurface";

const CAST_SHADOW = shouldEnableRealTimeShadows();

interface TransducerModelProps {
  transducerType?: TherapeuticTransducerType;
  era: number;
  coupling?: "good" | "poor";
  mode?: "continuous" | "pulsed";
  intensity?: number;
  dutyCycle?: number;
  position?: { x: number; y: number };
}

/** Escala da face ativa (cm → mundo 3D) */
const MODEL_SCALE = 1.15;

/** Cabo — tamanho fixo */
const CABLE_R = 0.055;
/** Superfície da pele (topo da camada cutânea) */
const SKIN_SURFACE_Y = 0;
/** Folga mínima — face do transdutor apoiada sobre a pele, sem penetrar */
const CONTACT_CLEARANCE = 0.012;
/** Invólucro retangular um pouco mais alto que a face de contato (base inalterada) */
const RECT_BODY_HEIGHT_SCALE = 1.34;

const chromeFaceProps = {
  color: THERAPY_TRANSDUCER.chrome,
  metalness: THERAPY_TRANSDUCER.chromeMetalness,
  roughness: THERAPY_TRANSDUCER.chromeRoughness,
  clearcoat: THERAPY_TRANSDUCER.chromeClearcoat,
  clearcoatRoughness: THERAPY_TRANSDUCER.chromeClearcoatRoughness,
  envMapIntensity: THERAPY_TRANSDUCER.chromeEnvIntensity,
  transparent: false,
  opacity: 1,
  depthWrite: true,
} as const;

export function TransducerModel({
  transducerType = "planar_circular",
  era,
  coupling = "good",
  mode = "continuous",
  intensity = 1.0,
  dutyCycle = 50,
  position = { x: 0, y: 0 },
}: TransducerModelProps) {
  const face = useMemo(
    () => resolveTransducerFace(transducerType, era),
    [transducerType, era],
  );
  const def = useMemo(() => getTransducerDefinition(transducerType), [transducerType]);
  const headStyle = def.visual.headBodyStyle;
  const isIfu = headStyle === "ifu_lens";
  const faceTokens = isIfu ? THERAPY_TRANSDUCER_FACE.focused : THERAPY_TRANSDUCER_FACE.planar;
  const bodyMaterial = useMemo(
    () => ({
      color: THERAPY_TRANSDUCER.body,
      roughness: 0.62,
      metalness: 0.04,
      clearcoat: 0.08,
      clearcoatRoughness: 0.45,
    }),
    [],
  );
  const isRect = headStyle === "rectangular_block" || face.kind === "rounded_rect";
  const activeR =
    face.kind === "rounded_rect"
      ? Math.sqrt(
          ((face.activeHalfW ?? 0) * 2 * (face.activeHalfD ?? 0) * 2) / Math.PI,
        )
      : (face.activeR ?? face.eqR);
  const headR = isRect
    ? Math.max(face.headHalfW ?? activeR, face.headHalfD ?? activeR)
    : (face.headR ?? activeR);

  const xOffset = position.x * 8;
  const zOffset = position.y * 3;

  const ceramicRef = useRef<Mesh>(null);
  const haloRef = useRef<Mesh>(null);
  const pulseRef = useRef<Mesh>(null);
  const ledRef = useRef<Mesh>(null);

  const dims = useMemo(() => {
    const s = MODEL_SCALE;
    const scaledActiveR = (isRect ? activeR : (face.activeR ?? activeR)) * s;
    const scaledHeadR = scaledActiveR * 1.14;
    const faceHScale = def.visual.faceHScale ?? 1;

    return {
      activeR: scaledActiveR,
      headR: scaledHeadR,
      ceramicR: scaledActiveR * (isIfu ? 0.82 : 0.86),
      activeHalfW: face.activeHalfW != null ? face.activeHalfW * s : undefined,
      activeHalfD: face.activeHalfD != null ? face.activeHalfD * s : undefined,
      headHalfW: face.headHalfW != null ? face.headHalfW * s : undefined,
      headHalfD: face.headHalfD != null ? face.headHalfD * s : undefined,
      faceH: scaledActiveR * 0.28 * faceHScale,
      neckR: scaledActiveR * 0.2,
      neckH: scaledActiveR * 0.07,
      handleR: scaledActiveR * 0.17,
      handleLen: scaledActiveR * 0.55,
      cableR: CABLE_R,
    };
  }, [face, isRect, isIfu, activeR, def]);

  const faceTopY = dims.faceH + CONTACT_CLEARANCE;
  const faceBottomY = CONTACT_CLEARANCE;
  const rectBodyH = dims.faceH * RECT_BODY_HEIGHT_SCALE;
  const rectBodyCenterY = rectBodyH / 2 + CONTACT_CLEARANCE;
  const rectBodyTopY = rectBodyH + CONTACT_CLEARANCE;

  const rectLayout = useMemo(() => {
    if (!isRect) return null;
    return computeProbeLayout(
      rectBodyTopY,
      0.002,
      dims.neckH,
      dims.handleR,
      dims.handleLen,
    );
  }, [isRect, rectBodyTopY, dims]);

  const rectCornerR =
    dims.headHalfW && dims.headHalfD
      ? Math.min(dims.headHalfW, dims.headHalfD) * 0.14
      : 0.06;

  const gelDomeGeometry = useMemo(() => {
    const profile = buildGelDomeProfile(dims.activeR * 0.99, 0.016, 0.0015);
    const geo = new LatheGeometry(profile, 64);
    geo.computeVertexNormals();
    return geo;
  }, [dims.activeR]);

  const poorGelStamps = useMemo((): GelStamp[] => {
    const r = dims.activeR;
    const layout = [
      { nx: -0.34, nz: 0.2, size: 0.22 },
      { nx: 0.3, nz: -0.28, size: 0.19 },
      { nx: 0.12, nz: 0.36, size: 0.17 },
      { nx: -0.12, nz: -0.18, size: 0.15 },
      { nx: 0.38, nz: 0.1, size: 0.14 },
      { nx: -0.22, nz: -0.32, size: 0.13 },
    ];
    return layout.map(({ nx, nz, size }) => ({
      x: nx * r * 1.05,
      z: nz * r * 1.05,
      radiusMul: size,
      heightMul: (1.02 + size * 0.18) * 1.82,
      stretch: 0.92,
      rot: 0,
    }));
  }, [dims.activeR]);

  const poorGelSurfaceGeometry = useMemo(() => {
    const halfW = (isRect ? (dims.activeHalfW ?? dims.activeR) : dims.activeR) * 1.08;
    const halfD = (isRect ? (dims.activeHalfD ?? dims.activeR) : dims.activeR) * 1.08;
    const geo = createLocalGelSurfaceGeometry(halfW, halfD);
    updateLocalGelSurfaceGeometry(geo, poorGelStamps, dims.activeR, dims.activeR * 0.1);
    return geo;
  }, [poorGelStamps, dims.activeR, dims.activeHalfW, dims.activeHalfD, isRect]);

  const poorGelMaterial = useMemo(() => {
    const mat = new MeshStandardMaterial({
      color: THERAPY_GEL_POOR.color,
      transparent: true,
      opacity: THERAPY_GEL_POOR.opacity,
      roughness: THERAPY_GEL_POOR.roughness,
      metalness: 0,
      emissive: THERAPY_GEL_POOR.emissive,
      emissiveIntensity: THERAPY_GEL_POOR.emissiveIntensity,
      depthWrite: false,
    });
    patchGelMaterial(mat);
    return mat;
  }, []);

  const gelScale: [number, number, number] = isRect
    ? [
        (dims.activeHalfW ?? activeR) / dims.activeR,
        1,
        (dims.activeHalfD ?? activeR) / dims.activeR,
      ]
    : [1, 1, 1];

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    if (ceramicRef.current?.material && !Array.isArray(ceramicRef.current.material)) {
      setCeramicPulseClinical(
        ceramicRef.current.material as MeshStandardMaterial | MeshPhysicalMaterial,
        mode,
        intensity,
        dutyCycle,
        time,
        isIfu,
      );
    }

    if (ledRef.current?.material && !Array.isArray(ledRef.current.material)) {
      const ledMat = ledRef.current.material as MeshStandardMaterial;
      if (mode === "pulsed") {
        const period = 1.0;
        const onTime = period * (dutyCycle / 100);
        const isOn = (time % period) / period < onTime / period;
        ledMat.emissiveIntensity = isOn ? 0.9 : 0.15;
      } else {
        ledMat.emissiveIntensity = 0.35 + Math.sin(time * 1.5) * 0.08;
      }
    }

    if (haloRef.current?.material && !Array.isArray(haloRef.current.material)) {
      const mat = haloRef.current.material as MeshStandardMaterial;
      if (mode === "continuous") {
        const scale = 1.0 + Math.sin(time * 3) * 0.1;
        if (isRect) {
          haloRef.current.scale.set(scale, 1, scale);
        } else {
          haloRef.current.scale.set(scale, scale, 1);
        }
        mat.opacity = 0.1 + Math.sin(time * 2.5) * 0.04;
      } else {
        const period = 1.0;
        const onTime = period * (dutyCycle / 100);
        const cyclePos = (time % period) / period;
        const isOn = cyclePos < onTime / period;
        if (isRect) {
          haloRef.current.scale.set(isOn ? 1.08 : 1.0, 1, isOn ? 1.08 : 1.0);
        } else {
          haloRef.current.scale.set(isOn ? 1.08 : 1.0, isOn ? 1.08 : 1.0, 1);
        }
        mat.opacity = isOn ? 0.16 : 0.08;
      }
    }

    if (pulseRef.current?.material && !Array.isArray(pulseRef.current.material) && mode === "pulsed") {
      const mat = pulseRef.current.material as MeshStandardMaterial;
      const period = 1.0;
      const onTime = period * (dutyCycle / 100);
      const cyclePos = (time % period) / period;
      const isOn = cyclePos < onTime / period;
      mat.opacity = isOn ? 0.14 : 0.04;
    }
  });

  return (
    <group position={[xOffset, 0, zOffset]}>
      {/* ── Cabeçote de contato: sempre vertical, face plana no tecido (y = 0) ── */}
      <group name="transducer-head">
      {!isRect && (
        <TherapeuticProbe
          transducerType={transducerType}
          isFocused={isIfu}
          dims={dims}
          faceBottomY={faceBottomY}
          ceramicRef={ceramicRef}
          ledRef={ledRef}
          castShadow={CAST_SHADOW}
        />
      )}

      {isRect && dims.headHalfW && dims.headHalfD && (
        <RoundedBox
          args={[dims.headHalfW * 2, rectBodyH, dims.headHalfD * 2]}
          position={[0, rectBodyCenterY, 0]}
          radius={rectCornerR}
          smoothness={4}
          castShadow={CAST_SHADOW}
          receiveShadow={CAST_SHADOW}
          renderOrder={6}
        >
          <meshPhysicalMaterial {...bodyMaterial} />
        </RoundedBox>
      )}

      {isRect && rectLayout && (
        <>
          <mesh position={[0, rectBodyTopY + dims.neckH * 0.5, 0]} castShadow={CAST_SHADOW}>
            <cylinderGeometry args={[dims.neckR, dims.neckR, dims.neckH, 28]} />
            <meshPhysicalMaterial {...PROBE_PLASTIC} />
          </mesh>
          <group position={[0, rectLayout.neckTopY, 0]} rotation={[-HANDLE_TILT, 0, 0]}>
            <mesh position={[0, rectLayout.capR + rectLayout.capLen * 0.5, 0]} castShadow={CAST_SHADOW}>
              <capsuleGeometry args={[rectLayout.capR, rectLayout.capLen, 6, 20]} />
              <meshPhysicalMaterial {...PROBE_PLASTIC} />
            </mesh>
            <ProbeCable
              localY={rectLayout.capR * 2 + rectLayout.capLen}
              cableR={dims.cableR}
              castShadow={CAST_SHADOW}
            />
            <mesh ref={ledRef} position={[rectLayout.ledPos.x, rectLayout.ledPos.y, rectLayout.ledPos.z]}>
              <sphereGeometry args={[0.008, 8, 8]} />
              <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.28} />
            </mesh>
          </group>
        </>
      )}

      {isRect && dims.headHalfW && dims.headHalfD && (
        <>
          <mesh position={[0, rectBodyTopY + 0.002, 0]} renderOrder={7}>
            <boxGeometry args={[dims.headHalfW * 1.96, 0.004, dims.headHalfD * 1.96]} />
            <meshPhysicalMaterial {...bodyMaterial} />
          </mesh>
          {[
            [dims.headHalfW * 0.78, dims.headHalfD * 0.78],
            [dims.headHalfW * 0.78, -dims.headHalfD * 0.78],
            [-dims.headHalfW * 0.78, dims.headHalfD * 0.78],
            [-dims.headHalfW * 0.78, -dims.headHalfD * 0.78],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, rectBodyTopY + 0.003, z]} renderOrder={7}>
              <cylinderGeometry args={[0.008, 0.008, 0.005, 10]} />
              <meshLambertMaterial color={THERAPY_TRANSDUCER.screwHead} />
            </mesh>
          ))}
          <mesh
            position={[dims.headHalfW * 0.52, rectBodyTopY + dims.neckH * 0.38, dims.headHalfD * 0.44]}
            rotation={[0.06, -0.55, 0.04]}
            renderOrder={7}
          >
            <boxGeometry args={[dims.headHalfW * 0.38, dims.neckH * 0.1, 0.0025]} />
            <meshLambertMaterial color={THERAPY_TRANSDUCER.labelPlate} />
          </mesh>
        </>
      )}

      {/* Retangular — base de contato + janela acústica */}
      {isRect && dims.activeHalfW && dims.activeHalfD && dims.headHalfW && dims.headHalfD && (
        <group position={[0, faceBottomY, 0]}>
          <RoundedBox
            args={[dims.headHalfW * 2.04, 0.012, dims.headHalfD * 2.04]}
            radius={rectCornerR * 0.9}
            smoothness={3}
            position={[0, 0.004, 0]}
            receiveShadow={CAST_SHADOW}
            renderOrder={7}
          >
            <meshPhysicalMaterial {...bodyMaterial} />
          </RoundedBox>
          <RoundedBox
            args={[dims.headHalfW * 1.92, 0.005, dims.headHalfD * 1.92]}
            radius={rectCornerR * 0.85}
            smoothness={3}
            position={[0, 0.006, 0]}
            receiveShadow={CAST_SHADOW}
            renderOrder={7}
          >
            <meshLambertMaterial
              color={THERAPY_TRANSDUCER.faceChamfer}
              emissive={THERAPY_TRANSDUCER.bodyEmissive}
              emissiveIntensity={THERAPY_TRANSDUCER.bodyEmissiveIntensity * 0.85}
            />
          </RoundedBox>
          <RoundedBox
            ref={ceramicRef}
            args={[
              dims.activeHalfW * 2 * 0.96,
              0.008,
              dims.activeHalfD * 2 * 0.96,
            ]}
            radius={Math.min(dims.activeHalfW, dims.activeHalfD) * 0.1}
            smoothness={3}
            position={[0, 0.005, 0]}
            receiveShadow={CAST_SHADOW}
            renderOrder={7}
          >
            <meshPhysicalMaterial
              {...chromeFaceProps}
              emissive="#94a3b8"
              emissiveIntensity={0.06}
            />
          </RoundedBox>
        </group>
      )}

      </group>

      {/* ── Efeitos na face de contato ── */}
      {isRect && dims.activeHalfW && dims.activeHalfD ? (
        <>
          <RoundedBox
            ref={haloRef}
            args={[
              dims.activeHalfW * 2 * 1.05,
              0.002,
              dims.activeHalfD * 2 * 1.05,
            ]}
            radius={Math.min(dims.activeHalfW, dims.activeHalfD) * 0.1}
            smoothness={2}
            position={[0, SKIN_SURFACE_Y + 0.003, 0]}
            renderOrder={3}
          >
            <meshStandardMaterial
              color={faceTokens.halo.color}
              emissive={faceTokens.halo.emissive}
              emissiveIntensity={faceTokens.halo.emissiveIntensity}
              transparent
              opacity={0.1}
              roughness={0.45}
              metalness={0.1}
              depthWrite={false}
            />
          </RoundedBox>
          {mode === "pulsed" && (
            <RoundedBox
              ref={pulseRef}
              args={[
                dims.activeHalfW * 2 * 0.94,
                0.002,
                dims.activeHalfD * 2 * 0.94,
              ]}
              radius={Math.min(dims.activeHalfW, dims.activeHalfD) * 0.09}
              smoothness={2}
              position={[0, SKIN_SURFACE_Y + 0.002, 0]}
              renderOrder={3}
            >
              <meshStandardMaterial
                color={faceTokens.halo.color}
                emissive={faceTokens.halo.emissive}
                emissiveIntensity={0.1}
                transparent
                opacity={0.12}
                depthWrite={false}
              />
            </RoundedBox>
          )}
        </>
      ) : (
      <group scale={isRect ? [gelScale[0], 1, gelScale[2]] : [1, 1, 1]}>
        <Ring
          ref={haloRef}
          args={[dims.activeR * 1.004, dims.activeR * 1.018, 80]}
          position={[0, SKIN_SURFACE_Y + 0.0025, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={3}
        >
          <meshStandardMaterial
            color={faceTokens.halo.color}
            emissive={faceTokens.halo.emissive}
            emissiveIntensity={faceTokens.halo.emissiveIntensity}
            transparent
            opacity={0.1}
            roughness={0.45}
            metalness={0.1}
            depthWrite={false}
          />
        </Ring>

        {mode === "pulsed" && (
          <Ring
            ref={pulseRef}
            args={[dims.activeR * 0.92, dims.activeR * 0.98, 80]}
            position={[0, SKIN_SURFACE_Y + 0.002, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial
              color={faceTokens.halo.color}
              emissive={faceTokens.halo.emissive}
              emissiveIntensity={0.1}
              transparent
              opacity={0.12}
              depthWrite={false}
            />
          </Ring>
        )}
      </group>
      )}

      <CouplingGelLayer
        coupling={coupling}
        goodGeometry={gelDomeGeometry}
        poorGeometry={poorGelSurfaceGeometry}
        poorMaterial={poorGelMaterial}
        scale={gelScale}
        skinSurfaceY={SKIN_SURFACE_Y}
        castShadow={CAST_SHADOW}
      />
    </group>
  );
}
