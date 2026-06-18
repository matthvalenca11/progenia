/**
 * Mistura térmica no material do tecido — só na face da seção e dentro do feixe.
 */

import { MeshStandardMaterial, type Texture } from "three";

const TISSUE_HALF_W = 10;

export interface TissueHeatBlendOptions {
  heatMap: Texture;
  stackDepth: number;
  heatStrength: number;
  intensityScale?: number;
  beamCenterX?: number;
  beamCenterZ?: number;
  beamHalfWidthCm?: number;
  /** Raio da ERA (cm) — queda radial na face da seção */
  faceRadiusCm?: number;
  /** thermal = calor suave; acoustic = feixe jet; interaction = camadas de propagação */
  blendMode?: "thermal" | "acoustic" | "interaction";
  /** Feixe plano: recorte lateral na ERA do transdutor */
  planarAcousticClip?: boolean;
  /** Camada horizontal (ex.: camada mista): amostra profundidade fixa em cm */
  sampleDepthCm?: number;
  clipXMin?: number;
  clipXMax?: number;
  /** Faixa vertical da camada (world Y) — recorte suave evita z-fighting nas interfaces */
  layerTopY?: number;
  layerBottomY?: number;
}

export function createTissueHeatBlendMaterial(
  base: MeshStandardMaterial,
  options: TissueHeatBlendOptions,
): MeshStandardMaterial {
  const {
    heatMap,
    stackDepth,
    heatStrength,
    intensityScale = 1,
    beamCenterX = 0,
    beamCenterZ = 0,
    beamHalfWidthCm = 4.6,
    faceRadiusCm = 1.2,
    blendMode = "thermal",
    planarAcousticClip = false,
    sampleDepthCm = 0,
    clipXMin = -100,
    clipXMax = 100,
    layerTopY = 100,
    layerBottomY = -100,
  } = options;

  const layerClipEnabled = layerTopY > layerBottomY + 0.001;

  const colorMix = blendMode === "acoustic" ? 0.92 : blendMode === "interaction" ? 0.9 : 0.88;
  const emissiveMix = blendMode === "acoustic" ? 0.78 : blendMode === "interaction" ? 0.72 : 0.26;
  const stableIntensityScale = Math.round(intensityScale * 40) / 40;

  const mat = base;
  const hadHeatShader = Boolean(mat.userData.heatShader);

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.heatMap = { value: heatMap };
    shader.uniforms.heatStackDepth = { value: stackDepth };
    shader.uniforms.heatStrength = { value: heatStrength };
    shader.uniforms.heatPulse = { value: 1 };
    shader.uniforms.heatIntensityScale = { value: stableIntensityScale };
    shader.uniforms.heatBeamCenterX = { value: beamCenterX };
    shader.uniforms.heatBeamCenterZ = { value: beamCenterZ };
    shader.uniforms.heatBeamHalfWidthCm = { value: beamHalfWidthCm };
    shader.uniforms.heatFaceRadiusCm = { value: faceRadiusCm };
    shader.uniforms.heatAcousticMode = { value: blendMode === "acoustic" ? 1.0 : 0.0 };
    shader.uniforms.heatInteractionMode = { value: blendMode === "interaction" ? 1.0 : 0.0 };
    shader.uniforms.heatPlanarAcousticClip = { value: planarAcousticClip ? 1.0 : 0.0 };
    shader.uniforms.heatSampleDepthCm = { value: sampleDepthCm };
    shader.uniforms.heatClipXMin = { value: clipXMin };
    shader.uniforms.heatClipXMax = { value: clipXMax };
    shader.uniforms.heatLayerTopY = { value: layerTopY };
    shader.uniforms.heatLayerBottomY = { value: layerBottomY };
    shader.uniforms.heatLayerClipEnabled = { value: layerClipEnabled ? 1.0 : 0.0 };

    shader.vertexShader =
      `
      varying vec3 vTissueHeatWorldPos;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>
        vTissueHeatWorldPos = worldPosition.xyz;
      `,
    );

    shader.fragmentShader =
      `
      uniform sampler2D heatMap;
      uniform float heatStackDepth;
      uniform float heatStrength;
      uniform float heatPulse;
      uniform float heatIntensityScale;
      uniform float heatBeamCenterX;
      uniform float heatBeamCenterZ;
      uniform float heatBeamHalfWidthCm;
      uniform float heatFaceRadiusCm;
      uniform float heatAcousticMode;
      uniform float heatInteractionMode;
      uniform float heatPlanarAcousticClip;
      uniform float heatSampleDepthCm;
      uniform float heatClipXMin;
      uniform float heatClipXMax;
      uniform float heatLayerTopY;
      uniform float heatLayerBottomY;
      uniform float heatLayerClipEnabled;
      varying vec3 vTissueHeatWorldPos;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
        vec3 nrm = normalize(normal);
        float frontSection = smoothstep(0.38, 0.78, nrm.z);
        float facingUp = smoothstep(0.28, 0.62, nrm.y);
        float facingSection = frontSection * (1.0 - facingUp);
        float acousticSection = smoothstep(0.42, 0.82, nrm.z) * (1.0 - smoothstep(0.12, 0.42, nrm.y));
        float interactionSection = smoothstep(0.38, 0.78, nrm.z) * (1.0 - smoothstep(0.12, 0.38, nrm.y));
        facingSection = mix(
          facingSection,
          mix(acousticSection, interactionSection, step(0.5, heatInteractionMode)),
          step(0.5, heatAcousticMode + heatInteractionMode)
        );
        float lateralDist = abs(vTissueHeatWorldPos.x - heatBeamCenterX);
        float stepRadial = 1.0 - smoothstep(
          heatBeamHalfWidthCm * 0.72,
          heatBeamHalfWidthCm * 1.45,
          lateralDist
        );
        float acousticRadial = 1.0 - smoothstep(
          heatFaceRadiusCm * 0.94,
          heatFaceRadiusCm * 1.08,
          lateralDist
        );
        float sectionRadial = heatAcousticMode > 0.5
          ? mix(1.0, acousticRadial, step(0.5, heatPlanarAcousticClip))
          : stepRadial;
        float depthNorm = heatSampleDepthCm > 0.001
          ? clamp(mix(heatSampleDepthCm, -vTissueHeatWorldPos.y, 0.65) / max(heatStackDepth, 0.01), 0.0, 1.0)
          : clamp(-vTissueHeatWorldPos.y / max(heatStackDepth, 0.01), 0.0, 1.0);
        float depthUvY = 1.0 - depthNorm;
        float worldBoneMode = step(0.5, heatAcousticMode + heatInteractionMode);
        // Perfil lateral sempre centrado no transdutor — evita clamp nas bordas do tecido
        float relXCm = vTissueHeatWorldPos.x - heatBeamCenterX;
        float beamTexU = clamp(
          relXCm / max(heatBeamHalfWidthCm * 2.2, 0.25) + 0.5,
          0.04,
          0.96
        );
        vec2 beamUv = vec2(beamTexU, depthUvY);
        vec4 beamTex = texture2D(heatMap, beamUv);
        vec4 heatTex = beamTex;
        if (worldBoneMode > 0.5) {
          vec4 depthAnatomy = texture2D(heatMap, vec2(0.5, depthUvY));
          heatTex.rgb = mix(beamTex.rgb, max(beamTex.rgb, depthAnatomy.rgb), 0.38);
        }
        float entryFade = heatAcousticMode > 0.5
          ? smoothstep(0.992, 0.93, beamUv.y)
          : 1.0;
        float inTissueColumn = step(heatClipXMin, vTissueHeatWorldPos.x) * step(vTissueHeatWorldPos.x, heatClipXMax);
        float inLayerBand = heatLayerClipEnabled > 0.5
          ? smoothstep(heatLayerBottomY - 0.012, heatLayerBottomY + 0.018, vTissueHeatWorldPos.y)
            * (1.0 - smoothstep(heatLayerTopY - 0.018, heatLayerTopY + 0.012, vTissueHeatWorldPos.y))
          : 1.0;
        float heatMix = heatTex.a * heatStrength * heatPulse * heatIntensityScale * facingSection * sectionRadial * entryFade * inTissueColumn * inLayerBand;
        diffuseColor.rgb = mix(diffuseColor.rgb, heatTex.rgb, heatMix * ${colorMix.toFixed(2)});
        totalEmissiveRadiance += heatTex.rgb * heatMix * ${emissiveMix.toFixed(2)};
      `,
    );

    mat.userData.heatShader = shader;
  };

  mat.customProgramCacheKey = () =>
    `tissue-heat-w8-${blendMode}-${planarAcousticClip}-${sampleDepthCm}-${clipXMin}-${clipXMax}-${heatStrength}-${stableIntensityScale}-${beamHalfWidthCm}-${faceRadiusCm}-${layerClipEnabled}-${layerTopY.toFixed(2)}-${layerBottomY.toFixed(2)}`;
  if (!hadHeatShader) {
    mat.needsUpdate = true;
  }
  return mat;
}

type HeatShader = {
  uniforms: {
    heatMap?: { value: Texture };
    heatPulse?: { value: number };
    heatBeamCenterX?: { value: number };
    heatBeamCenterZ?: { value: number };
  };
};

export function setTissueHeatMap(material: MeshStandardMaterial, heatMap: Texture): void {
  const shader = material.userData.heatShader as HeatShader | undefined;
  if (shader?.uniforms?.heatMap) {
    shader.uniforms.heatMap.value = heatMap;
  }
}

export function setTissueHeatPulse(material: MeshStandardMaterial, pulse: number): void {
  const shader = material.userData.heatShader as HeatShader | undefined;
  if (shader?.uniforms?.heatPulse) {
    shader.uniforms.heatPulse.value = pulse;
  }
}

export function setTissueHeatBeamCenter(
  material: MeshStandardMaterial,
  centerX: number,
  centerZ = 0,
): void {
  const shader = material.userData.heatShader as HeatShader | undefined;
  if (shader?.uniforms?.heatBeamCenterX) {
    shader.uniforms.heatBeamCenterX.value = centerX;
  }
  if (shader?.uniforms?.heatBeamCenterZ) {
    shader.uniforms.heatBeamCenterZ.value = centerZ;
  }
}
