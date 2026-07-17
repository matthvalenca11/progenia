import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { ClinicalSkinTone } from "@/lib/clinicalSkinTones";
import {
  clinicalTissueMaterialProps,
  createClinicalTissueTexture,
} from "@/lib/clinicalTissueTextures";
import {
  buildOrganicLayerGeometry,
  ORGANIC_LAYER_SEGMENTS,
  tissueBoundarySeed,
} from "@/lib/clinicalTissueGeometry";
import type { PhotobioWavelength } from "@/lib/photobioOptics";
import type { PhotobioViewerTab } from "@/stores/photobioStore";
import { getPhotobioVisualQualityTier, shouldCastTherapeuticShadows } from "@/lib/therapeuticLabsPerformance";
import {
  resetAndApplyContactIndent,
  resetLayerGeometry,
  ADIPOSE_MAX_INDENT_FRACTION,
  DERMIS_MAX_INDENT_FRACTION,
  DERMIS_MESH_SINK_GAIN,
  MUSCLE_MAX_INDENT_FRACTION,
  type ContactIndentParams,
  type PhotobioStackLayout,
} from "./photobioViewerLayout";

const CAST_SHADOW = shouldCastTherapeuticShadows();

const TRANSLUCENT_OPACITY: Record<"epidermis" | "dermis" | "adipose" | "muscle", number> = {
  epidermis: 0.58,
  dermis: 0.52,
  adipose: 0.5,
  muscle: 0.48,
};

/** Ordem de desenho traseira → frontal para alpha blending estável */
const TRANSLUCENT_LAYER_RENDER_ORDER: Record<"epidermis" | "dermis" | "adipose" | "muscle", number> = {
  muscle: 1,
  adipose: 2,
  dermis: 3,
  epidermis: 4,
};

interface PhotobioTissueStackProps {
  layerConfig: {
    epidermisMm: number;
    dermisMm: number;
    adiposeMm: number;
    muscleMm: number;
  };
  layout: PhotobioStackLayout;
  transducerX: number;
  contactPressure: number;
  translucentView: boolean;
  skinTone: ClinicalSkinTone;
  stackSeed: number;
  wavelength: PhotobioWavelength;
  viewerTab: PhotobioViewerTab;
  showLabels?: boolean;
}

function layerHighlight(
  layer: "epidermis" | "dermis" | "adipose" | "muscle",
  wavelength: PhotobioWavelength,
  viewerTab: PhotobioViewerTab,
): { emissive: string; intensity: number } | null {
  if (viewerTab === "anatomy" || viewerTab === "penetration") {
    const target = wavelength === 660 ? "dermis" : "muscle";
    if (layer !== target) return null;
    return {
      emissive: wavelength === 660 ? "#ffb080" : "#7efcc5",
      intensity: viewerTab === "penetration" ? 0.42 : 0.24,
    };
  }
  if (viewerTab === "beam") {
    if (layer === "epidermis") {
      return { emissive: wavelength === 660 ? "#ff8844" : "#d946ef", intensity: 0.12 };
    }
    return null;
  }
  if (viewerTab === "fluence" && layer === "muscle") {
    return { emissive: "#38bdf8", intensity: 0.18 };
  }
  return null;
}

function indentSignature(params: ContactIndentParams | null): string {
  if (!params || params.indent <= 0) return "flat";
  return [
    params.indent.toFixed(6),
    params.centerX.toFixed(5),
    params.height.toFixed(6),
    params.radiusX.toFixed(5),
    params.radiusZ.toFixed(5),
    params.topWeighted ? 1 : 0,
    params.wellSteepness ?? 1,
    params.radialLimit ?? 6.5,
    params.gravitationalField ? 1 : 0,
    params.legacyGaussian ? 1 : 0,
    (params.fieldSinkBoost ?? 1).toFixed(3),
    (params.tiltRad ?? 0).toFixed(4),
    (params.asymmetricBias ?? 0).toFixed(4),
    (params.skinConformRadius ?? 0).toFixed(4),
  ].join("|");
}

function TissueLayerMaterial({
  materialProps,
  translucentView,
  opacity,
}: {
  materialProps: ReturnType<typeof clinicalTissueMaterialProps>;
  translucentView: boolean;
  opacity: number;
}) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const roughness = Math.min(1, (materialProps.roughness ?? 0.7) + (translucentView ? 0.06 : 0));

  useLayoutEffect(() => {
    const mat = materialRef.current;
    if (!mat) return;

    if (materialProps.map) mat.map = materialProps.map;
    if (materialProps.bumpMap) mat.bumpMap = materialProps.bumpMap;
    mat.bumpScale = materialProps.bumpScale ?? mat.bumpScale;
    mat.metalness = materialProps.metalness ?? mat.metalness;
    mat.envMapIntensity = materialProps.envMapIntensity ?? mat.envMapIntensity;
    if (materialProps.emissive) {
      mat.emissive.set(materialProps.emissive);
    }
    mat.emissiveIntensity = materialProps.emissiveIntensity ?? 0;

    mat.roughness = roughness;
    mat.transparent = translucentView;
    mat.opacity = translucentView ? opacity : 1;
    mat.depthWrite = !translucentView;
    mat.depthTest = true;
    mat.side = THREE.FrontSide;
    mat.needsUpdate = true;
  }, [materialProps, translucentView, opacity, roughness]);

  return (
    <meshStandardMaterial
      ref={materialRef}
      {...materialProps}
      roughness={roughness}
      transparent={translucentView}
      opacity={translucentView ? opacity : 1}
      depthWrite={!translucentView}
      side={THREE.FrontSide}
    />
  );
}

function DeformingTissueLayer({
  baseGeometry,
  indentParams,
  centerY,
  castShadow,
  materialProps,
  translucentView,
  opacity,
  layerRenderOrder,
}: {
  baseGeometry: THREE.BufferGeometry;
  indentParams: ContactIndentParams | null;
  centerY: number;
  castShadow: boolean;
  materialProps: ReturnType<typeof clinicalTissueMaterialProps>;
  translucentView: boolean;
  opacity: number;
  layerRenderOrder: number;
}) {
  const basePositions = useMemo(
    () =>
      Float32Array.from(baseGeometry.attributes.position.array as ArrayLike<number>),
    [baseGeometry],
  );
  const indentSig = indentSignature(indentParams);

  useLayoutEffect(() => {
    if (!indentParams || indentParams.indent <= 0.00005) {
      resetLayerGeometry(baseGeometry, basePositions);
      return;
    }
    resetAndApplyContactIndent(baseGeometry, basePositions, indentParams);
  }, [baseGeometry, basePositions, indentSig, indentParams]);

  return (
    <mesh
      position={[0, centerY, 0]}
      geometry={baseGeometry}
      castShadow={castShadow && !translucentView}
      receiveShadow={castShadow && !translucentView}
      frustumCulled={false}
      renderOrder={translucentView ? layerRenderOrder : 0}
    >
      <TissueLayerMaterial
        key={translucentView ? "translucent" : "opaque"}
        materialProps={materialProps}
        translucentView={translucentView}
        opacity={opacity}
      />
    </mesh>
  );
}

export function PhotobioTissueStack({
  layout,
  transducerX,
  contactPressure,
  translucentView,
  skinTone,
  stackSeed,
  wavelength,
  viewerTab,
  showLabels = true,
}: PhotobioTissueStackProps) {
  const {
    sizes,
    topSurfaceY,
    epidermisCenterY,
    dermisCenterY,
    adiposeCenterY,
    muscleCenterY,
    contactRadiusX,
    contactRadiusZ,
    contactTiltRad,
    contactAsymmetricBias,
    applicatorContactRadius,
    layerIndents,
  } = layout;
  const visualTier = useMemo(() => getPhotobioVisualQualityTier(), []);
  const organicSegments =
    visualTier === "low"
      ? Math.max(6, Math.floor(ORGANIC_LAYER_SEGMENTS * 0.55))
      : visualTier === "medium"
        ? Math.max(8, Math.floor(ORGANIC_LAYER_SEGMENTS * 0.75))
        : ORGANIC_LAYER_SEGMENTS;

  const textures = useMemo(
    () => ({
      epidermis: createClinicalTissueTexture("epidermis", { skinTone }),
      dermis: createClinicalTissueTexture("dermis", { skinTone }),
      adipose: createClinicalTissueTexture("adipose", { skinTone }),
      muscle: createClinicalTissueTexture("muscle", { skinTone }),
    }),
    [skinTone],
  );

  useEffect(() => {
    return () => {
      Object.values(textures).forEach(({ map, bumpMap }) => {
        map.dispose();
        bumpMap.dispose();
      });
    };
  }, [textures]);

  const epidermisSegments = useMemo((): [number, number, number] => {
    const [segX, segY, segZ] = organicSegments;
    return [Math.max(segX, 56), Math.max(segY, 14), Math.max(segZ, 28)];
  }, [organicSegments]);

  const epidermisBase = useMemo(
    () =>
      buildOrganicLayerGeometry({
        width: sizes.width,
        height: sizes.epidermis,
        depth: sizes.depth,
        boundarySeedTop: tissueBoundarySeed(stackSeed, 0),
        boundarySeedBottom: tissueBoundarySeed(stackSeed, 1),
        kind: "epidermis",
        topAmplitudeScale: 0.018,
        segments: epidermisSegments,
      }),
    [stackSeed, sizes.width, sizes.epidermis, sizes.depth, epidermisSegments],
  );

  const dermisBase = useMemo(
    () =>
      buildOrganicLayerGeometry({
        width: sizes.width,
        height: sizes.dermis,
        depth: sizes.depth,
        boundarySeedTop: tissueBoundarySeed(stackSeed, 1),
        boundarySeedBottom: tissueBoundarySeed(stackSeed, 2),
        kind: "dermis",
        segments: organicSegments,
      }),
    [stackSeed, sizes.width, sizes.dermis, sizes.depth, organicSegments],
  );

  const adiposeBase = useMemo(
    () =>
      buildOrganicLayerGeometry({
        width: sizes.width,
        height: sizes.adipose,
        depth: sizes.depth,
        boundarySeedTop: tissueBoundarySeed(stackSeed, 2),
        boundarySeedBottom: tissueBoundarySeed(stackSeed, 3),
        kind: "adipose",
        segments: organicSegments,
      }),
    [stackSeed, sizes.width, sizes.adipose, sizes.depth, organicSegments],
  );

  const muscleBase = useMemo(
    () =>
      buildOrganicLayerGeometry({
        width: sizes.width,
        height: sizes.muscle,
        depth: sizes.depth,
        boundarySeedTop: tissueBoundarySeed(stackSeed, 3),
        boundarySeedBottom: tissueBoundarySeed(stackSeed, 4),
        kind: "muscle",
        segments: organicSegments,
      }),
    [stackSeed, sizes.width, sizes.muscle, sizes.depth, organicSegments],
  );

  useEffect(() => {
    return () => {
      epidermisBase.dispose();
      dermisBase.dispose();
      adiposeBase.dispose();
      muscleBase.dispose();
    };
  }, [epidermisBase, dermisBase, adiposeBase, muscleBase]);

  const epidermisIndent = useMemo((): ContactIndentParams | null => {
    if (layerIndents.epidermis <= 0) return null;
    return {
      height: sizes.epidermis,
      centerX: transducerX,
      indent: layerIndents.epidermis,
      radiusX: contactRadiusX * 0.88,
      radiusZ: contactRadiusZ * 0.88,
      radialLimit: 2.5,
      gravitationalField: true,
      surfaceShellRatio: 1,
      depthFalloff: 0.55,
      radialConvergence: 0.12,
      rimBulgeScale: 0.08,
      tiltRad: contactTiltRad,
      asymmetricBias: contactAsymmetricBias,
      skinConformRadius: applicatorContactRadius,
    };
  }, [
    transducerX,
    layerIndents.epidermis,
    sizes.epidermis,
    contactRadiusX,
    contactRadiusZ,
    contactTiltRad,
    contactAsymmetricBias,
    applicatorContactRadius,
  ]);

  const dermisIndent = useMemo((): ContactIndentParams | null => {
    if (layerIndents.dermis <= 0) return null;
    return {
      height: sizes.dermis,
      centerX: transducerX,
      indent: layerIndents.dermis,
      radiusX: contactRadiusX * 0.92,
      radiusZ: contactRadiusZ * 0.92,
      topWeighted: true,
      surfaceShellRatio: 0.78,
      depthFalloff: 1.12,
      radialLimit: 2.45,
      radialConvergence: 0.05,
      rimBulgeScale: 0,
      fieldSinkBoost: 1.28,
      meshSinkGain: DERMIS_MESH_SINK_GAIN,
      maxIndentFraction: DERMIS_MAX_INDENT_FRACTION,
      tiltRad: contactTiltRad,
      asymmetricBias: contactAsymmetricBias * 0.72,
      skinConformRadius: applicatorContactRadius * 0.85,
    };
  }, [
    transducerX,
    layerIndents.dermis,
    sizes.dermis,
    contactRadiusX,
    contactRadiusZ,
    contactTiltRad,
    contactAsymmetricBias,
    applicatorContactRadius,
  ]);

  const adiposeIndent = useMemo((): ContactIndentParams | null => {
    if (layerIndents.adipose <= 0) return null;
    return {
      height: sizes.adipose,
      centerX: transducerX,
      indent: layerIndents.adipose,
      radiusX: contactRadiusX * 0.82,
      radiusZ: contactRadiusZ * 0.82,
      topWeighted: true,
      surfaceShellRatio: 0.36,
      depthFalloff: 2.5,
      radialLimit: 2.8,
      radialConvergence: 0.05,
      rimBulgeScale: 0,
      fieldSinkBoost: 1.05,
      maxIndentFraction: ADIPOSE_MAX_INDENT_FRACTION,
      meshSinkGain: 1,
      tiltRad: contactTiltRad,
      asymmetricBias: contactAsymmetricBias * 0.45,
      skinConformRadius: applicatorContactRadius * 0.6,
    };
  }, [
    transducerX,
    layerIndents.adipose,
    sizes.adipose,
    contactRadiusX,
    contactRadiusZ,
    contactTiltRad,
    contactAsymmetricBias,
    applicatorContactRadius,
  ]);

  const muscleIndent = useMemo((): ContactIndentParams | null => {
    if (layerIndents.muscle <= 0) return null;
    return {
      height: sizes.muscle,
      centerX: transducerX,
      indent: layerIndents.muscle,
      radiusX: contactRadiusX * 0.88,
      radiusZ: contactRadiusZ * 0.88,
      topWeighted: true,
      surfaceShellRatio: 0.14,
      depthFalloff: 4,
      radialLimit: 3,
      radialConvergence: 0,
      rimBulgeScale: 0,
      fieldSinkBoost: 0.65,
      maxIndentFraction: MUSCLE_MAX_INDENT_FRACTION,
      meshSinkGain: 1,
      tiltRad: contactTiltRad,
      asymmetricBias: contactAsymmetricBias * 0.25,
      skinConformRadius: applicatorContactRadius * 0.4,
    };
  }, [
    transducerX,
    layerIndents.muscle,
    sizes.muscle,
    contactRadiusX,
    contactRadiusZ,
    contactTiltRad,
    contactAsymmetricBias,
    applicatorContactRadius,
  ]);

  const layers: Array<{
    key: "epidermis" | "dermis" | "adipose" | "muscle";
    label: string;
    centerY: number;
    baseGeometry: THREE.BufferGeometry;
    indentParams: ContactIndentParams | null;
    materialKind: "skin" | "fat" | "muscle";
    textureKey: "epidermis" | "dermis" | "adipose" | "muscle";
  }> = [
    {
      key: "epidermis",
      label: "Epiderme",
      centerY: epidermisCenterY,
      baseGeometry: epidermisBase,
      indentParams: epidermisIndent,
      materialKind: "skin",
      textureKey: "epidermis",
    },
    {
      key: "dermis",
      label: "Derme",
      centerY: dermisCenterY,
      baseGeometry: dermisBase,
      indentParams: dermisIndent,
      materialKind: "skin",
      textureKey: "dermis",
    },
    {
      key: "adipose",
      label: "Tecido Adiposo",
      centerY: adiposeCenterY,
      baseGeometry: adiposeBase,
      indentParams: adiposeIndent,
      materialKind: "fat",
      textureKey: "adipose",
    },
    {
      key: "muscle",
      label: "Músculo",
      centerY: muscleCenterY,
      baseGeometry: muscleBase,
      indentParams: muscleIndent,
      materialKind: "muscle",
      textureKey: "muscle",
    },
  ];

  return (
    <group>
      {layers.map(({ key, label, centerY, baseGeometry, indentParams, materialKind, textureKey }) => {
        const highlight = layerHighlight(key, wavelength, viewerTab);
        const baseProps = clinicalTissueMaterialProps(materialKind, textures[textureKey]);
        return (
          <group key={key}>
            <DeformingTissueLayer
              baseGeometry={baseGeometry}
              indentParams={indentParams}
              centerY={centerY}
              castShadow={CAST_SHADOW}
              materialProps={{
                ...baseProps,
                emissive: highlight?.emissive,
                emissiveIntensity: highlight?.intensity ?? 0,
              }}
              translucentView={translucentView}
              opacity={TRANSLUCENT_OPACITY[key]}
              layerRenderOrder={TRANSLUCENT_LAYER_RENDER_ORDER[key]}
            />
            {showLabels && (
              <Html position={[4.65, centerY, 1.0]} center distanceFactor={10}>
                <div className="text-[11px] font-medium text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                  {label}
                </div>
              </Html>
            )}
          </group>
        );
      })}

    </group>
  );
}
