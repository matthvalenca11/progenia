/**
 * Overlay único do mapa (acústico/térmico) — segue a ondulação da seção e evita z-fighting.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ShaderMaterial, type Texture } from "three";
import { therapyBeamWorldRef } from "@/lib/therapyRuntimeRefs";
import { THERMAL_BEAM_HALF_WIDTH_CM } from "@/lib/thermalFieldTexture";
import { TOTAL_BLOCK_DEPTH } from "@/lib/ultrasoundTherapyStack";
import {
  SHARED_INTERFACE_AMP_CM,
  TISSUE_WAVE_INTENSITY,
} from "@/lib/clinicalTissueGeometry";

const TISSUE_WIDTH = 20;
const TISSUE_HALF_W = TISSUE_WIDTH / 2;
const SECTION_Z = 4.12;

interface TissueFieldOverlayProps {
  heatMap: Texture;
  mode: "acoustic" | "thermal";
  stackDepth?: number;
  intensity?: number;
  faceRadiusCm?: number;
  planarAcousticClip?: boolean;
  stackSeed?: number;
}

export function TissueFieldOverlay({
  heatMap,
  mode,
  stackDepth = TOTAL_BLOCK_DEPTH,
  intensity = 1,
  faceRadiusCm = 1.2,
  planarAcousticClip = true,
  stackSeed = 0,
}: TissueFieldOverlayProps) {
  const materialRef = useRef<ShaderMaterial>(null);

  const intensityScale = useMemo(() => {
    if (mode === "thermal") {
      return Math.round((0.45 + Math.min(1.35, intensity / 2.2)) * 40) / 40;
    }
    return Math.round((0.82 + Math.min(2.2, intensity / 1.1)) * 40) / 40;
  }, [mode, intensity]);

  const waveAmp = SHARED_INTERFACE_AMP_CM * TISSUE_WAVE_INTENSITY;
  const waveSeed = stackSeed * 0.173;

  const material = useMemo(() => {
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: true,
      uniforms: {
        heatMap: { value: heatMap },
        heatStackDepth: { value: stackDepth },
        heatIntensityScale: { value: intensityScale },
        heatBeamCenterX: { value: 0 },
        heatBeamHalfWidthCm: { value: THERMAL_BEAM_HALF_WIDTH_CM },
        heatFaceRadiusCm: { value: faceRadiusCm },
        heatPlanarAcousticClip: { value: planarAcousticClip ? 1 : 0 },
        heatAcousticMode: { value: mode === "acoustic" ? 1 : 0 },
        heatWaveAmp: { value: waveAmp },
        heatWaveSeed: { value: waveSeed },
      },
      vertexShader: `
        uniform float heatWaveAmp;
        uniform float heatWaveSeed;
        varying vec2 vWorldXZ;
        varying float vWorldY;

        float tissueSectionWave(float x, float y) {
          float s = heatWaveSeed;
          float low =
            sin(x * 0.22 + s * 1.1) * cos(y * 0.19 + s * 0.85) * 0.62 +
            sin(x * 0.09 + y * 0.11 + s * 1.6) * 0.24;
          float mid =
            sin(x * 0.38 + y * 0.31 + s * 2.2) * cos(y * 0.34 + s * 1.4) * 0.14;
          return (low + mid) * heatWaveAmp;
        }

        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          worldPos.z += tissueSectionWave(worldPos.x, worldPos.y);
          vWorldXZ = worldPos.xz;
          vWorldY = worldPos.y;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D heatMap;
        uniform float heatStackDepth;
        uniform float heatIntensityScale;
        uniform float heatBeamCenterX;
        uniform float heatBeamHalfWidthCm;
        uniform float heatFaceRadiusCm;
        uniform float heatPlanarAcousticClip;
        uniform float heatAcousticMode;
        varying vec2 vWorldXZ;
        varying float vWorldY;

        void main() {
          float worldX = vWorldXZ.x;
          if (worldX < -${TISSUE_HALF_W.toFixed(1)} || worldX > ${TISSUE_HALF_W.toFixed(1)}) discard;
          if (vWorldY > 0.04 || vWorldY < -heatStackDepth - 0.04) discard;

          float depthNorm = clamp(-vWorldY / max(heatStackDepth, 0.01), 0.0, 1.0);
          float depthUvY = 1.0 - depthNorm;

          float relXCm = worldX - heatBeamCenterX;
          float lateralDist = abs(relXCm);
          float stepRadial = 1.0 - smoothstep(
            heatBeamHalfWidthCm * 0.72,
            heatBeamHalfWidthCm * 1.45,
            lateralDist
          );

          float beamTexU = clamp(
            relXCm / max(heatBeamHalfWidthCm * 2.2, 0.25) + 0.5,
            0.0,
            1.0
          );
          vec4 beamTex = texture2D(heatMap, vec2(beamTexU, depthUvY));
          vec3 heatRgb = beamTex.rgb;
          if (heatAcousticMode > 0.5) {
            vec4 depthAnatomy = texture2D(heatMap, vec2(0.5, depthUvY));
            heatRgb = mix(beamTex.rgb, max(beamTex.rgb, depthAnatomy.rgb), 0.38);
          }

          float entryFade = heatAcousticMode > 0.5
            ? smoothstep(0.992, 0.93, depthUvY)
            : 1.0;
          float radialMask = heatAcousticMode > 0.5 ? 1.0 : stepRadial;
          float heatMix = beamTex.a * heatIntensityScale * radialMask * entryFade;
          if (heatMix < 0.004) discard;
          gl_FragColor = vec4(heatRgb, heatMix * 0.96);
        }
      `,
    });
    materialRef.current = mat;
    return mat;
  }, [
    stackDepth,
    intensityScale,
    faceRadiusCm,
    planarAcousticClip,
    mode,
    waveAmp,
    waveSeed,
  ]);

  useFrame(() => {
    const mat = materialRef.current;
    if (!mat) return;
    mat.uniforms.heatMap.value = heatMap;
    mat.uniforms.heatBeamCenterX.value = therapyBeamWorldRef.x;
  });

  return (
    <mesh position={[0, -stackDepth / 2, SECTION_Z]} renderOrder={16} frustumCulled={false}>
      <planeGeometry args={[TISSUE_WIDTH, stackDepth, 48, 72]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
