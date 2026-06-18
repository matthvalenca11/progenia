/**
 * TransducerModel — aplicador clínico (perfil lathe + materiais físicos)
 */

import { useMemo, useRef } from "react";
import { Ring, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  BufferGeometry,
  CubicBezierCurve3,
  Curve,
  CurvePath,
  LatheGeometry,
  LineCurve3,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import {
  resolveTransducerFace,
  getTransducerDefinition,
  type TherapeuticTransducerType,
} from "@/config/therapeuticTransducerDefinitions";
import {
  THERAPY_GEL_GOOD,
  THERAPY_GEL_POOR,
  THERAPY_TRANSDUCER,
  THERAPY_TRANSDUCER_FACE,
} from "./therapyVisualConstants";
import { shouldEnableRealTimeShadows } from "@/lib/ultrasoundVisualQuality";
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

/** Segmentos do tubo da haste */
const TUBE_TUBULAR_SEGMENTS = 72;
const FIXED_BINORMAL = new Vector3(1, 0, 0);

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Frame estável — seção no plano YZ, centrada em x = 0 */
function computeStableFrames(curve: Curve<Vector3>, tubularSegments: number) {
  const tangents: Vector3[] = [];
  const normals: Vector3[] = [];
  const binormals: Vector3[] = [];

  for (let i = 0; i <= tubularSegments; i++) {
    const tangent = curve.getTangent(i / tubularSegments).normalize();
    tangents.push(tangent);
    const binormal = FIXED_BINORMAL.clone();
    const normal = new Vector3().crossVectors(binormal, tangent).normalize();
    normals.push(normal);
    binormals.push(binormal);
  }

  return { tangents, normals, binormals };
}

function frameAtT(curve: Curve<Vector3>, t: number, tubularSegments: number) {
  const frames = computeStableFrames(curve, tubularSegments);
  const i = Math.min(tubularSegments, Math.max(0, Math.round(t * tubularSegments)));
  const tangent = frames.tangents[i];
  const normal = frames.normals[i];
  const binormal = frames.binormals[i];
  return {
    point: curve.getPoint(t),
    quat: quatFromFrame(normal, tangent, binormal),
    normal,
    binormal,
  };
}

function quatFromTangent(tangent: Vector3): Quaternion {
  const t = tangent.clone().normalize();
  const fallback = Math.abs(t.y) > 0.92 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0);
  const helper = new Vector3().crossVectors(fallback, t);
  if (helper.lengthSq() < 1e-8) {
    return new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), t);
  }
  helper.normalize();
  const normal = new Vector3().crossVectors(t, helper).normalize();
  return quatFromFrame(normal, t, helper);
}

function cableExitFromPath(path: Curve<Vector3>) {
  const tangent = path.getTangent(1).clone().normalize();
  const base = path.getPoint(1).clone().addScaledVector(tangent, 0.004);
  return { base, quat: quatFromTangent(tangent), tangent };
}

function quatFromFrame(normal: Vector3, tangent: Vector3, binormal: Vector3): Quaternion {
  return new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(normal, tangent, binormal),
  );
}

/** Raio do tubo — curva + pega (pescoço vertical fica no lathe) */
function buildStemRadiusAt(
  t: number,
  neckR: number,
  handleR: number,
  cableR: number,
): number {
  const rGrip = handleR * 1.018;

  if (t <= 0.1) return neckR * (t < 0.04 ? 1.03 : 1.0);
  if (t <= 0.32) {
    return neckR + (handleR - neckR) * smoothstep((t - 0.1) / 0.22);
  }
  if (t <= 0.58) {
    return handleR + (rGrip - handleR) * smoothstep((t - 0.32) / 0.26);
  }
  if (t <= 0.8) {
    return rGrip + (handleR * 0.92 - rGrip) * smoothstep((t - 0.58) / 0.22);
  }
  return handleR * 0.92 + (cableR * 1.06 - handleR * 0.92) * smoothstep((t - 0.8) / 0.2);
}

/** Colar + pescoço — lathe sólido até yNeckTop */
function buildCollarNeckFromFaceTop(
  headR: number,
  faceTopY: number,
  collarH: number,
  neckR: number,
  neckH: number,
): Vector2[] {
  const yCollarTop = faceTopY + collarH;
  const yNeckTop = yCollarTop + neckH;
  const vertTopY = yNeckTop + neckR * 0.32 * 0.4;

  const raw: Array<[number, number]> = [
    [headR * 0.98, faceTopY],
    [headR * 0.91, faceTopY + 0.004],
    [headR * 0.8, faceTopY + collarH * 0.24],
    [headR * 0.68, faceTopY + collarH * 0.52],
    [headR * 0.56, faceTopY + collarH * 0.78],
    [neckR, yCollarTop - 0.002],
    [neckR, yCollarTop],
    [neckR, yNeckTop],
    [neckR, vertTopY],
  ];

  let prevR = raw[0][0];
  return raw.map(([radius, y]) => {
    const r = Math.max(neckR, Math.min(prevR, radius));
    prevR = r;
    return new Vector2(r, y);
  });
}

/** Pega maciça — cadeia de esferas sobrepostas (volume sólido, sem casca oca) */
function buildSolidSphereChainGeometry(
  path: Curve<Vector3>,
  steps: number,
  radiusAt: (t: number) => number,
  extraSpheres: Array<{ point: Vector3; radius: number }> = [],
): BufferGeometry {
  const parts: BufferGeometry[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = radiusAt(t);
    const p = path.getPoint(t);
    const g = new SphereGeometry(r, 20, 16);
    g.translate(p.x, p.y, p.z);
    parts.push(g);
  }

  for (const { point, radius } of extraSpheres) {
    const g = new SphereGeometry(radius, 20, 16);
    g.translate(point.x, point.y, point.z);
    parts.push(g);
  }

  const merged = mergeGeometries(parts, false);
  if (!merged) return parts[0];
  merged.computeVertexNormals();
  return merged;
}

/** Swan-neck + pega — vertical + curva + bastão (coberto por esferas sólidas) */
function createStemPath(
  yNeckTop: number,
  neckR: number,
  handleR: number,
  handleLen: number,
  cableBootH: number,
) {
  const rise = neckR * 0.32;
  const forward = neckR * 0.36;
  const vertTop = yNeckTop + rise * 0.4;
  const bendEnd = new Vector3(0, yNeckTop + rise, forward);

  const vertical = new LineCurve3(
    new Vector3(0, yNeckTop, 0),
    new Vector3(0, vertTop, 0),
  );

  const swan = new CubicBezierCurve3(
    new Vector3(0, vertTop, 0),
    new Vector3(0, vertTop + rise * 0.1, forward * 0.035),
    new Vector3(0, yNeckTop + rise * 0.7, forward * 0.24),
    bendEnd,
  );

  const axisDir = swan.getTangent(1).normalize();
  const straightLen = handleLen + handleR * 1.35 + cableBootH;
  const pathEnd = bendEnd.clone().addScaledVector(axisDir, straightLen);
  const straight = new LineCurve3(bendEnd, pathEnd);

  const path = new CurvePath<Vector3>();
  path.add(vertical);
  path.add(swan);
  path.add(straight);

  const cable = cableExitFromPath(path);
  return { path, cableBase: cable.base, cableQuat: cable.quat, vertTop, bendEnd, rise, forward };
}

function buildCollarAndHandleGeometries(
  headR: number,
  faceTopY: number,
  collarH: number,
  neckR: number,
  neckH: number,
  stemPath: Curve<Vector3>,
  handleR: number,
  cableR: number,
  junction: { vertTop: number; bendEnd: Vector3; rise: number; forward: number; yNeckTop: number },
) {
  const collarProfile = buildCollarNeckFromFaceTop(
    headR,
    faceTopY,
    collarH,
    neckR,
    neckH,
  );
  const collarGeo = new LatheGeometry(collarProfile, 72);
  collarGeo.computeVertexNormals();

  const { vertTop, bendEnd, rise, forward, yNeckTop } = junction;
  const handleGeo = buildSolidSphereChainGeometry(
    stemPath,
    52,
    (t) => buildStemRadiusAt(t, neckR, handleR, cableR),
    [
      { point: new Vector3(0, vertTop, 0), radius: neckR * 1.08 },
      { point: new Vector3(0, yNeckTop + rise * 0.45, forward * 0.12), radius: neckR * 1.1 },
      { point: bendEnd.clone(), radius: handleR * 1.02 },
    ],
  );

  return { collarGeo, handleGeo };
}

/** Escala base do corpo; cabo usa só BODY_BASE (sem MODEL_SCALE) */
const BODY_BASE = 1.35;
/** Aumento global do transdutor 3D — exceção: fio/cabo */
const MODEL_SCALE = 1.95;
const BODY_SCALE = BODY_BASE * MODEL_SCALE;

/** Cabo — tamanho fixo (independente de MODEL_SCALE) */
const CABLE = {
  cableR: 0.072 * BODY_BASE,
  cableLen: 0.85 * BODY_BASE,
} as const;

const BODY = {
  faceH: 0.085 * BODY_SCALE,
  ceramicH: 0.045 * MODEL_SCALE,
  collarH: 0.14 * BODY_SCALE,
  collarTopR: 0.68 * BODY_SCALE,
  neckR: 0.42 * BODY_SCALE,
  neckH: 0.09 * BODY_SCALE,
  handleR: 0.3 * BODY_SCALE,
  handleLen: 0.5 * BODY_SCALE,
  cableR: CABLE.cableR,
  cableLen: CABLE.cableLen,
} as const;
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
const CABLE_BLACK = "#141414";
const CABLE_CUT = "#1f1f1f";

/** Colar + pescoço (após adaptador retangular) */
function buildIfuChromeLensProfile(lensR: number): Vector2[] {
  const recess = 0.004;
  const domeH = lensR * 0.48;
  const yBase = recess;
  return [
    new Vector2(0.002, yBase),
    new Vector2(lensR * 0.35, yBase + domeH * 0.22),
    new Vector2(lensR * 0.68, yBase + domeH * 0.58),
    new Vector2(lensR * 0.92, yBase + domeH * 0.88),
    new Vector2(lensR * 0.99, yBase + domeH * 0.98),
    new Vector2(lensR * 0.985, yBase + domeH),
    new Vector2(0.002, yBase + domeH),
  ];
}

function buildGelDomeProfile(radius: number, peakHeight: number, edgeHeight: number): Vector2[] {
  const segments = 24;
  const points: Vector2[] = [
    new Vector2(0.002, edgeHeight),
    new Vector2(radius, edgeHeight),
  ];
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const r = radius * (1 - t);
    const nr = radius > 0 ? r / radius : 0;
    const h = edgeHeight + (peakHeight - edgeHeight) * (1 - nr * nr);
    points.push(new Vector2(r, h));
  }
  return points;
}

function setCeramicPulse(
  mat: MeshStandardMaterial | MeshPhysicalMaterial | null,
  mode: "continuous" | "pulsed",
  intensity: number,
  dutyCycle: number,
  time: number,
  baseEmissive = 0.55,
) {
  if (!mat) return;

  if (mode === "continuous") {
    const pulse = 0.12 + Math.sin(time * 2.2) * 0.08;
    mat.emissiveIntensity = baseEmissive + pulse * intensity * 0.35;
  } else {
    const period = 1.0;
    const onTime = period * (dutyCycle / 100);
    const cyclePos = (time % period) / period;
    const isOn = cyclePos < onTime / period;
    mat.emissiveIntensity = isOn ? baseEmissive * 1.4 * intensity : baseEmissive * 0.15;
  }
}

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
      color: def.visual.headTint ?? THERAPY_TRANSDUCER.body,
      emissive: def.visual.headTint ?? THERAPY_TRANSDUCER.bodyEmissive,
      emissiveIntensity: THERAPY_TRANSDUCER.bodyEmissiveIntensity,
    }),
    [def.visual.headTint],
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
    const faceH = BODY.faceH * (def.visual.faceHScale ?? 1);
    const collarH = BODY.collarH * (def.visual.collarHScale ?? 1);
    const adapterH = isRect ? collarH * 0.55 : 0;
    const s = MODEL_SCALE;
    return {
      activeR: (isRect ? activeR : (face.activeR ?? activeR)) * s,
      headR: headR * s,
      ceramicR: (isRect ? activeR : (face.activeR ?? activeR)) * s * (isIfu ? 0.82 : 0.86),
      activeHalfW: face.activeHalfW != null ? face.activeHalfW * s : undefined,
      activeHalfD: face.activeHalfD != null ? face.activeHalfD * s : undefined,
      headHalfW: face.headHalfW != null ? face.headHalfW * s : undefined,
      headHalfD: face.headHalfD != null ? face.headHalfD * s : undefined,
      faceH,
      ceramicH: isIfu ? BODY.ceramicH * 1.15 : BODY.ceramicH,
      collarBottomR: BODY.collarTopR,
      collarTopR: BODY.collarTopR,
      collarH,
      adapterH,
      neckR: BODY.neckR,
      neckH: BODY.neckH,
      handleR: BODY.handleR,
      handleLen: BODY.handleLen,
      cableR: BODY.cableR,
      cableLen: BODY.cableLen,
    };
  }, [face, isRect, isIfu, activeR, headR, def]);

  const faceCenterY = dims.faceH / 2 + CONTACT_CLEARANCE;
  const faceTopY = dims.faceH + CONTACT_CLEARANCE;
  const faceBottomY = CONTACT_CLEARANCE;
  const rectBodyH = dims.faceH * RECT_BODY_HEIGHT_SCALE;
  const rectBodyCenterY = rectBodyH / 2 + CONTACT_CLEARANCE;
  const rectBodyTopY = rectBodyH + CONTACT_CLEARANCE;
  const rectAttachR =
    Math.min(dims.headHalfW ?? dims.headR, dims.headHalfD ?? dims.headR) * 0.78;
  const yNeckTop = isRect
    ? rectBodyTopY + dims.collarH + dims.neckH
    : faceTopY + dims.collarH + dims.neckH;

  const cableBootH = 0.09;
  const ledT = 0.58;

  const bodyAssembly = useMemo(() => {
    const { path, cableBase, cableQuat, vertTop, bendEnd, rise, forward } = createStemPath(
      yNeckTop,
      dims.neckR,
      dims.handleR,
      dims.handleLen,
      cableBootH,
    );

    const ledFrame = frameAtT(path, ledT, TUBE_TUBULAR_SEGMENTS);
    const ledPos = ledFrame.point
      .clone()
      .add(ledFrame.binormal.clone().multiplyScalar(dims.handleR * 1.04));

    if (isRect) {
      const { collarGeo, handleGeo } = buildCollarAndHandleGeometries(
        rectAttachR,
        rectBodyTopY,
        dims.collarH,
        dims.neckR,
        dims.neckH,
        path,
        dims.handleR,
        dims.cableR,
        { vertTop, bendEnd, rise, forward, yNeckTop },
      );
      return { collarGeo, handleGeo, cableBase, cableQuat, ledPos };
    }

    const { collarGeo, handleGeo } = buildCollarAndHandleGeometries(
      dims.headR,
      faceTopY,
      dims.collarH,
      dims.neckR,
      dims.neckH,
      path,
      dims.handleR,
      dims.cableR,
      { vertTop, bendEnd, rise, forward, yNeckTop },
    );

    return { collarGeo, handleGeo, cableBase, cableQuat, ledPos };
  }, [isRect, dims, faceTopY, rectBodyTopY, rectAttachR, yNeckTop, cableBootH, ledT]);

  const ifuLensProfile = useMemo(() => {
    if (!isIfu) return null;
    return buildIfuChromeLensProfile(dims.activeR * 0.94);
  }, [isIfu, dims.activeR]);

  const mergedBodyGeometry = bodyAssembly?.collarGeo ?? null;
  const stemGeometry = bodyAssembly?.handleGeo ?? null;

  const ifuLensGeometry = useMemo(() => {
    if (!ifuLensProfile) return null;
    const geo = new LatheGeometry(ifuLensProfile, 64);
    geo.computeVertexNormals();
    return geo;
  }, [ifuLensProfile]);
  const rectCornerR =
    dims.headHalfW && dims.headHalfD
      ? Math.min(dims.headHalfW, dims.headHalfD) * 0.14
      : 0.06;

  const gelDomeGeometry = useMemo(() => {
    const profile = buildGelDomeProfile(dims.activeR * 0.99, 0.028, 0.002);
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
      setCeramicPulse(
        ceramicRef.current.material as MeshStandardMaterial | MeshPhysicalMaterial,
        mode,
        intensity,
        dutyCycle,
        time,
        isIfu
          ? THERAPY_TRANSDUCER_FACE.focused.lens.emissiveIntensity
          : THERAPY_TRANSDUCER_FACE.planar.ceramic.emissiveIntensity,
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
        mat.opacity = 0.22 + Math.sin(time * 2.5) * 0.1;
      } else {
        const period = 1.0;
        const onTime = period * (dutyCycle / 100);
        const cyclePos = (time % period) / period;
        const isOn = cyclePos < onTime / period;
        if (isRect) {
          haloRef.current.scale.set(isOn ? 1.15 : 1.0, 1, isOn ? 1.15 : 1.0);
        } else {
          haloRef.current.scale.set(isOn ? 1.15 : 1.0, isOn ? 1.15 : 1.0, 1);
        }
        mat.opacity = isOn ? 0.55 : 0.14;
      }
    }

    if (pulseRef.current?.material && !Array.isArray(pulseRef.current.material) && mode === "pulsed") {
      const mat = pulseRef.current.material as MeshStandardMaterial;
      const period = 1.0;
      const onTime = period * (dutyCycle / 100);
      const cyclePos = (time % period) / period;
      const isOn = cyclePos < onTime / period;
      mat.opacity = isOn ? 0.42 : 0.06;
    }
  });

  return (
    <group position={[xOffset, 0, zOffset]}>
      {/* ── Cabeçote de contato: sempre vertical, face plana no tecido (y = 0) ── */}
      <group name="transducer-head">
      {/* Corpo plástico — disco do cabeçote + colar/pega */}
      {!isRect && (
        <mesh position={[0, faceCenterY, 0]} castShadow={CAST_SHADOW} receiveShadow={CAST_SHADOW} renderOrder={6}>
          <cylinderGeometry args={[dims.headR, dims.headR, dims.faceH, 72]} />
          <meshLambertMaterial {...bodyMaterial} />
        </mesh>
      )}

      {!isRect && mergedBodyGeometry && (
        <mesh geometry={mergedBodyGeometry} castShadow={CAST_SHADOW} receiveShadow={CAST_SHADOW} renderOrder={6}>
          <meshLambertMaterial {...bodyMaterial} />
        </mesh>
      )}

      {!isRect && stemGeometry && (
        <mesh geometry={stemGeometry} castShadow={CAST_SHADOW} receiveShadow={CAST_SHADOW} renderOrder={6}>
          <meshLambertMaterial {...bodyMaterial} />
        </mesh>
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
          <meshLambertMaterial {...bodyMaterial} />
        </RoundedBox>
      )}

      {isRect && mergedBodyGeometry && (
        <mesh geometry={mergedBodyGeometry} castShadow={CAST_SHADOW} receiveShadow={CAST_SHADOW} renderOrder={6}>
          <meshLambertMaterial {...bodyMaterial} />
        </mesh>
      )}

      {isRect && stemGeometry && (
        <mesh geometry={stemGeometry} castShadow={CAST_SHADOW} receiveShadow={CAST_SHADOW} renderOrder={6}>
          <meshLambertMaterial {...bodyMaterial} />
        </mesh>
      )}

      {isRect && dims.headHalfW && dims.headHalfD && (
        <>
          <mesh position={[0, rectBodyTopY + 0.002, 0]} renderOrder={7}>
            <boxGeometry args={[dims.headHalfW * 1.96, 0.004, dims.headHalfD * 1.96]} />
            <meshLambertMaterial {...bodyMaterial} />
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
            position={[dims.headHalfW * 0.52, rectBodyTopY + dims.collarH * 0.38, dims.headHalfD * 0.44]}
            rotation={[0.06, -0.55, 0.04]}
            renderOrder={7}
          >
            <boxGeometry args={[dims.headHalfW * 0.38, dims.collarH * 0.1, 0.0025]} />
            <meshLambertMaterial color={THERAPY_TRANSDUCER.labelPlate} />
          </mesh>
        </>
      )}
      {/* Detalhes clínicos — parafusos, placa, junção (circular) */}
      {!isRect && (
        <>
          <mesh position={[0, faceTopY + 0.002, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={7}>
            <torusGeometry args={[dims.headR * 0.992, 0.004, 8, 72]} />
            <meshLambertMaterial color={THERAPY_TRANSDUCER.faceChamfer} />
          </mesh>
          {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((ang) => (
            <mesh
              key={ang}
              position={[
                Math.cos(ang) * dims.headR * 0.74,
                faceTopY + 0.003,
                Math.sin(ang) * dims.headR * 0.74,
              ]}
              renderOrder={7}
            >
              <cylinderGeometry args={[0.009, 0.009, 0.005, 10]} />
              <meshLambertMaterial color={THERAPY_TRANSDUCER.screwHead} />
            </mesh>
          ))}
          <mesh
            position={[dims.headR * 0.52, faceTopY + dims.collarH * 0.38, dims.headR * 0.38]}
            rotation={[0.06, -0.55, 0.04]}
            renderOrder={7}
          >
            <boxGeometry args={[dims.headR * 0.22, dims.collarH * 0.11, 0.0025]} />
            <meshLambertMaterial color={THERAPY_TRANSDUCER.labelPlate} />
          </mesh>
        </>
      )}

      {/* Logo em relevo discreto no dorso */}
      {!isRect && (
        <mesh
          position={[dims.headR * 0.68, faceTopY + dims.collarH * 0.32, dims.headR * 0.48]}
          rotation={[0.08, -0.45, 0.06]}
          castShadow={CAST_SHADOW}
          renderOrder={7}
        >
          <boxGeometry args={[dims.headR * 0.18, dims.collarH * 0.16, 0.003]} />
          <meshLambertMaterial color={THERAPY_TRANSDUCER.logo} />
        </mesh>
      )}

      {/* Faixa dorsal — identificação rápida do tipo */}
      {!isRect && (
        <mesh
          position={[0, faceTopY + dims.collarH * 0.55, dims.headR * 0.72]}
          rotation={[0.12, 0, 0]}
          renderOrder={8}
        >
          <boxGeometry args={[dims.headR * 0.55, dims.collarH * 0.09, 0.004]} />
          <meshStandardMaterial
            color={isIfu ? THERAPY_TRANSDUCER_FACE.focused.dorsalBand : THERAPY_TRANSDUCER_FACE.planar.dorsalBand}
            emissive={isIfu ? THERAPY_TRANSDUCER_FACE.focused.dorsalBand : THERAPY_TRANSDUCER_FACE.planar.dorsalBand}
            emissiveIntensity={0.85}
            roughness={0.35}
            metalness={0.1}
          />
        </mesh>
      )}

      {/* Base de contato — disco plano azul (pistão) */}
      {!isIfu && !isRect && (
        <group position={[0, faceBottomY, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow={CAST_SHADOW}>
            <torusGeometry args={[dims.headR * 1.008, 0.016, 12, 72]} />
            <meshStandardMaterial color={THERAPY_TRANSDUCER.rubber} roughness={0.94} metalness={0} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} receiveShadow={CAST_SHADOW}>
            <torusGeometry args={[dims.headR * 0.955, 0.009, 10, 72]} />
            <meshStandardMaterial
              color={THERAPY_TRANSDUCER.faceChamfer}
              roughness={0.58}
              metalness={0.02}
              envMapIntensity={0}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow={CAST_SHADOW}>
            <torusGeometry args={[dims.activeR * 1.02, 0.012, 12, 72]} />
            <meshStandardMaterial
              color={THERAPY_TRANSDUCER_FACE.planar.chromeRing.color}
              emissive={THERAPY_TRANSDUCER_FACE.planar.chromeRing.emissive}
              emissiveIntensity={THERAPY_TRANSDUCER_FACE.planar.chromeRing.emissiveIntensity}
              roughness={0.25}
              metalness={0.35}
            />
          </mesh>
          <mesh
            ref={ceramicRef}
            position={[0, 0.004, 0]}
            receiveShadow={CAST_SHADOW}
          >
            <cylinderGeometry args={[dims.activeR * 0.94, dims.activeR * 0.94, 0.003, 64]} />
            <meshStandardMaterial
              color={THERAPY_TRANSDUCER_FACE.planar.ceramic.color}
              emissive={THERAPY_TRANSDUCER_FACE.planar.ceramic.emissive}
              emissiveIntensity={THERAPY_TRANSDUCER_FACE.planar.ceramic.emissiveIntensity}
              roughness={0.28}
              metalness={0.08}
            />
          </mesh>
        </group>
      )}

      {/* IFU — cavidade escura + lente convexa laranja saliente */}
      {isIfu && ifuLensGeometry && (
        <group position={[0, faceBottomY, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow={CAST_SHADOW}>
            <torusGeometry args={[dims.headR * 1.008, 0.016, 12, 72]} />
            <meshStandardMaterial color={THERAPY_TRANSDUCER.rubber} roughness={0.94} metalness={0} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} receiveShadow={CAST_SHADOW}>
            <cylinderGeometry args={[dims.activeR * 1.02, dims.activeR * 0.88, 0.008, 64]} />
            <meshStandardMaterial
              color={THERAPY_TRANSDUCER_FACE.focused.recess.color}
              emissive={THERAPY_TRANSDUCER_FACE.focused.recess.emissive}
              emissiveIntensity={THERAPY_TRANSDUCER_FACE.focused.recess.emissiveIntensity}
              roughness={0.85}
              metalness={0.05}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} receiveShadow={CAST_SHADOW}>
            <torusGeometry args={[dims.activeR * 0.92, 0.008, 10, 64]} />
            <meshStandardMaterial
              color="#334155"
              emissive="#1e293b"
              emissiveIntensity={0.2}
              roughness={0.7}
              metalness={0.15}
            />
          </mesh>
          <mesh ref={ceramicRef} geometry={ifuLensGeometry} castShadow={CAST_SHADOW} receiveShadow={CAST_SHADOW}>
            <meshPhysicalMaterial
              color={THERAPY_TRANSDUCER_FACE.focused.lens.color}
              emissive={THERAPY_TRANSDUCER_FACE.focused.lens.emissive}
              emissiveIntensity={THERAPY_TRANSDUCER_FACE.focused.lens.emissiveIntensity}
              roughness={THERAPY_TRANSDUCER_FACE.focused.lens.roughness}
              transmission={THERAPY_TRANSDUCER_FACE.focused.lens.transmission}
              metalness={0.05}
              clearcoat={0.95}
              clearcoatRoughness={0.04}
            />
          </mesh>
        </group>
      )}

      {/* Retangular — base de contato + janela acústica (bordas brancas como o corpo) */}
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
            <meshLambertMaterial {...bodyMaterial} />
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

      {/* Cabo + LED — a partir da pega inclinada */}
      {bodyAssembly && (
        <group
          position={[
            bodyAssembly.cableBase.x,
            bodyAssembly.cableBase.y,
            bodyAssembly.cableBase.z,
          ]}
          quaternion={bodyAssembly.cableQuat}
        >
          <mesh position={[0, dims.cableLen / 2, 0]} castShadow={CAST_SHADOW}>
            <cylinderGeometry args={[dims.cableR, dims.cableR * 0.97, dims.cableLen, 20]} />
            <meshLambertMaterial color={CABLE_BLACK} />
          </mesh>
          <mesh position={[0, dims.cableLen + 0.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[dims.cableR * 0.97, 20]} />
            <meshLambertMaterial color={CABLE_CUT} />
          </mesh>
          <mesh position={[0, dims.cableLen + 0.0015, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[dims.cableR * 0.28, 12]} />
            <meshStandardMaterial color="#525252" roughness={0.9} />
          </mesh>
        </group>
      )}
      {bodyAssembly && (
        <mesh ref={ledRef} position={[bodyAssembly.ledPos.x, bodyAssembly.ledPos.y, bodyAssembly.ledPos.z]}>
          <sphereGeometry args={[0.012, 10, 10]} />
          <meshStandardMaterial
            color="#22c55e"
            emissive="#22c55e"
            emissiveIntensity={0.35}
            roughness={0.3}
            metalness={0}
          />
        </mesh>
      )}

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
              opacity={0.28}
              roughness={0.3}
              metalness={0.2}
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
                emissiveIntensity={0.35}
                transparent
                opacity={0.35}
                depthWrite={false}
              />
            </RoundedBox>
          )}
        </>
      ) : (
      <group scale={isRect ? [gelScale[0], 1, gelScale[2]] : [1, 1, 1]}>
        <Ring
          ref={haloRef}
          args={[dims.activeR * 1.002, dims.activeR * 1.025, 72]}
          position={[0, SKIN_SURFACE_Y + 0.003, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={3}
        >
          <meshStandardMaterial
            color={faceTokens.halo.color}
            emissive={faceTokens.halo.emissive}
            emissiveIntensity={faceTokens.halo.emissiveIntensity}
            transparent
            opacity={0.28}
            roughness={0.3}
            metalness={0.2}
            depthWrite={false}
          />
        </Ring>

        {mode === "pulsed" && (
          <Ring
            ref={pulseRef}
            args={[dims.activeR * 0.88, dims.activeR * 0.97, 72]}
            position={[0, SKIN_SURFACE_Y + 0.002, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial
              color={faceTokens.halo.color}
              emissive={faceTokens.halo.emissive}
              emissiveIntensity={0.35}
              transparent
              opacity={0.35}
              depthWrite={false}
            />
          </Ring>
        )}
      </group>
      )}

      {/* Gel já presente, comprimido/espalhado sob a face de contato */}
      {coupling === "good" && (
        <mesh
          geometry={gelDomeGeometry}
          scale={gelScale}
          position={[0, SKIN_SURFACE_Y, 0]}
          castShadow={CAST_SHADOW}
        >
          <meshStandardMaterial
            color={THERAPY_GEL_GOOD.color}
            transparent
            opacity={THERAPY_GEL_GOOD.opacity}
            roughness={THERAPY_GEL_GOOD.roughness}
            metalness={0}
            emissive={THERAPY_GEL_GOOD.emissive}
            emissiveIntensity={THERAPY_GEL_GOOD.emissiveIntensity}
            depthWrite={false}
          />
        </mesh>
      )}

      {coupling === "poor" && (
        <group scale={isRect ? [gelScale[0], 1, gelScale[2]] : [1, 1, 1]}>
          <mesh
            geometry={poorGelSurfaceGeometry}
            material={poorGelMaterial}
            position={[0, SKIN_SURFACE_Y, 0]}
            castShadow={CAST_SHADOW}
          />
        </group>
      )}
    </group>
  );
}
