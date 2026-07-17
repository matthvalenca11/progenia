/**
 * Overlay GPU do campo óptico PBM — espelha o padrão do TissueFieldOverlay (ultrassom).
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ShaderMaterial, type Texture } from "three";
import {
  PHOTOBIO_TISSUE_HALF_WIDTH_WORLD,
  PHOTOBIO_TISSUE_WIDTH_WORLD,
} from "@/lib/photobioInteractionMap";
import type { PhotobioFieldMode } from "@/lib/photobioFieldTexture";
import { getSpotRadiusCm, type PhotobioWavelength } from "@/lib/photobioOptics";
import {
  SHARED_INTERFACE_AMP_CM,
  TISSUE_WAVE_INTENSITY,
} from "@/lib/clinicalTissueGeometry";

const SECTION_Z_OFFSET = 0.04;

interface PhotobioFieldOverlayProps {
  fieldMap: Texture;
  mode: PhotobioFieldMode;
  stackHeight: number;
  stackCenterY: number;
  stackTopY: number;
  tissueDepthZ: number;
  beamCenterX?: number;
  spotSizeCm2?: number;
  irradianceMwCm2?: number;
  thermalRiskIndex?: number;
  penetrationDepthNorm?: number;
  wavelength?: PhotobioWavelength;
  opacity?: number;
  stackSeed?: number;
  simplified?: boolean;
}

export function PhotobioFieldOverlay({
  fieldMap,
  mode,
  stackHeight,
  stackCenterY,
  stackTopY,
  tissueDepthZ,
  beamCenterX = 0,
  spotSizeCm2 = 1,
  irradianceMwCm2 = 100,
  thermalRiskIndex = 0,
  penetrationDepthNorm = 1,
  wavelength = 660,
  opacity = 0.88,
  stackSeed = 0,
  simplified = false,
}: PhotobioFieldOverlayProps) {
  const materialRef = useRef<ShaderMaterial>(null);
  const beamXRef = useRef(beamCenterX);

  const beamRadiusCm = useMemo(
    () => Math.max(0.12, getSpotRadiusCm(spotSizeCm2) * 1.12),
    [spotSizeCm2],
  );

  const intensityScale = useMemo(() => {
    const irr = Math.max(0, irradianceMwCm2);
    if (mode === "beam") {
      return Math.round((0.72 + Math.min(2.8, irr / 200)) * 40) / 40;
    }
    if (mode === "fluence") return 1.45;
    if (mode === "absorption") return 1.5;
    if (mode === "bioresponse") return 1.25;
    return 0.85;
  }, [mode, irradianceMwCm2]);

  const thermalMix = useMemo(
    () => (mode === "beam" ? Math.min(1, Math.max(0, thermalRiskIndex)) : 0),
    [mode, thermalRiskIndex],
  );

  const waveAmp = SHARED_INTERFACE_AMP_CM * TISSUE_WAVE_INTENSITY * 0.35;
  const waveSeed = stackSeed * 0.131;

  const material = useMemo(() => {
    if (simplified) return null;

    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      uniforms: {
        fieldMap: { value: fieldMap },
        fieldStackHeight: { value: stackHeight },
        fieldStackTopY: { value: stackTopY },
        fieldIntensityScale: { value: intensityScale },
        fieldBeamCenterX: { value: beamCenterX },
        fieldBeamRadiusCm: { value: beamRadiusCm },
        fieldOpacity: { value: opacity },
        fieldThermalMix: { value: thermalMix },
        fieldPenetrationNorm: { value: penetrationDepthNorm },
        fieldWavelength: { value: wavelength === 808 ? 808 : 660 },
        fieldPulse: { value: 1 },
        fieldTime: { value: 0 },
        fieldWaveAmp: { value: waveAmp },
        fieldWaveSeed: { value: waveSeed },
        fieldHalfWidth: { value: PHOTOBIO_TISSUE_HALF_WIDTH_WORLD },
        fieldBeamMode: { value: mode === "beam" ? 1 : 0 },
      },
      vertexShader: `
        uniform float fieldWaveAmp;
        uniform float fieldWaveSeed;
        varying vec2 vWorldXZ;
        varying float vWorldY;

        float tissueWave(float x, float y) {
          float s = fieldWaveSeed;
          return sin(x * 0.24 + s) * cos(y * 0.21 + s * 0.7) * fieldWaveAmp;
        }

        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          worldPos.z += tissueWave(worldPos.x, worldPos.y);
          vWorldXZ = worldPos.xz;
          vWorldY = worldPos.y;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D fieldMap;
        uniform float fieldStackHeight;
        uniform float fieldStackTopY;
        uniform float fieldIntensityScale;
        uniform float fieldBeamCenterX;
        uniform float fieldBeamRadiusCm;
        uniform float fieldOpacity;
        uniform float fieldThermalMix;
        uniform float fieldPenetrationNorm;
        uniform float fieldWavelength;
        uniform float fieldPulse;
        uniform float fieldTime;
        uniform float fieldHalfWidth;
        uniform float fieldBeamMode;

        varying vec2 vWorldXZ;
        varying float vWorldY;

        void main() {
          float worldX = vWorldXZ.x;
          if (worldX < -fieldHalfWidth || worldX > fieldHalfWidth) discard;
          if (vWorldY > fieldStackTopY + 0.04 || vWorldY < fieldStackTopY - fieldStackHeight - 0.04) discard;

          float depthNorm = clamp((fieldStackTopY - vWorldY) / max(fieldStackHeight, 0.01), 0.0, 1.0);
          float depthUvY = 1.0 - depthNorm;

          float relXCm = (worldX - fieldBeamCenterX) * (fieldHalfWidth / 4.25);
          float lateralDist = abs(relXCm);
          float radial = lateralDist / max(fieldBeamRadiusCm, 0.08);

          float radialMask = 1.0 - smoothstep(0.55, 1.35, radial);
          float coreGlow = exp(-3.2 * radial * radial);
          float halo = exp(-1.35 * radial * radial) * 0.32;

          float beamTexU = clamp(relXCm / max(fieldBeamRadiusCm * 2.35, 0.2) + 0.5, 0.0, 1.0);
          vec4 field = texture2D(fieldMap, vec2(beamTexU, depthUvY));
          vec4 depthColumn = texture2D(fieldMap, vec2(0.5, depthUvY));

          vec3 rgb = field.rgb;
          if (fieldBeamMode > 0.5) {
            rgb = mix(field.rgb, max(field.rgb, depthColumn.rgb * 0.92), 0.22);
            rgb += field.rgb * coreGlow * 0.55;

            float flowBand = 0.88 + 0.12 * sin(depthNorm * 32.0 - fieldTime * 5.0 + radial * 8.0);
            rgb *= flowBand;

            if (fieldWavelength < 700.0) {
              rgb += vec3(0.22, 0.1, 0.02) * coreGlow;
              rgb += vec3(0.08, 0.03, 0.0) * halo * field.a;
            } else {
              rgb += vec3(0.18, 0.04, 0.22) * coreGlow;
              rgb += vec3(0.06, 0.0, 0.1) * halo * field.a;
            }
          }

          if (fieldBeamMode > 0.5 && fieldThermalMix > 0.02) {
            vec3 thermal = vec3(1.0, 0.32, 0.06);
            float superficial = smoothstep(0.28, 0.0, depthNorm);
            rgb = mix(rgb, max(rgb, thermal), fieldThermalMix * superficial * field.a);
          }

          float entryBloom = fieldBeamMode > 0.5 ? smoothstep(0.16, 0.0, depthNorm) : 0.0;
          rgb += vec3(0.35, 0.18, 0.05) * entryBloom * fieldIntensityScale;

          float penTail = fieldBeamMode > 0.5
            ? smoothstep(fieldPenetrationNorm + 0.08, fieldPenetrationNorm - 0.02, depthNorm)
            : 1.0;

          float entryFade = fieldBeamMode > 0.5 ? smoothstep(0.998, 0.82, depthUvY) : 1.0;
          float alpha =
            field.a * fieldIntensityScale * fieldOpacity * radialMask * entryFade * penTail * fieldPulse;
          alpha += field.a * halo * fieldIntensityScale * fieldOpacity * 0.55 * penTail * fieldPulse;

          if (alpha < 0.003) discard;
          gl_FragColor = vec4(rgb, alpha);
        }
      `,
    });
    materialRef.current = mat;
    return mat;
  }, [
    stackHeight,
    stackTopY,
    intensityScale,
    beamRadiusCm,
    opacity,
    thermalMix,
    penetrationDepthNorm,
    waveAmp,
    waveSeed,
    mode,
    simplified,
  ]);

  useFrame(({ clock }) => {
    beamXRef.current = beamCenterX;
    const mat = materialRef.current;
    if (!mat) return;
    mat.uniforms.fieldMap.value = fieldMap;
    mat.uniforms.fieldBeamCenterX.value = beamXRef.current;
    mat.uniforms.fieldBeamRadiusCm.value = beamRadiusCm;
    mat.uniforms.fieldOpacity.value = opacity;
    mat.uniforms.fieldIntensityScale.value = intensityScale;
    mat.uniforms.fieldThermalMix.value = thermalMix;
    mat.uniforms.fieldStackTopY.value = stackTopY;
    mat.uniforms.fieldPenetrationNorm.value = penetrationDepthNorm;
    mat.uniforms.fieldWavelength.value = wavelength === 808 ? 808 : 660;
    if (mode === "beam") {
      mat.uniforms.fieldPulse.value = 0.88 + 0.12 * Math.sin(clock.getElapsedTime() * 2.8);
      mat.uniforms.fieldTime.value = clock.getElapsedTime();
    } else {
      mat.uniforms.fieldPulse.value = 1;
      mat.uniforms.fieldTime.value = 0;
    }
  });

  if (simplified) {
    return (
      <mesh
        position={[0, stackCenterY, tissueDepthZ + SECTION_Z_OFFSET]}
        renderOrder={20}
        frustumCulled={false}
      >
        <planeGeometry args={[PHOTOBIO_TISSUE_WIDTH_WORLD, stackHeight, 1, 1]} />
        <meshBasicMaterial
          map={fieldMap}
          transparent
          opacity={opacity * intensityScale * 0.85}
          depthWrite={false}
          toneMapped
        />
      </mesh>
    );
  }

  return (
    <mesh
      position={[0, stackCenterY, tissueDepthZ + SECTION_Z_OFFSET]}
      renderOrder={20}
      frustumCulled={false}
    >
      <planeGeometry args={[PHOTOBIO_TISSUE_WIDTH_WORLD, stackHeight, 56, 80]} />
      {material && <primitive object={material} attach="material" />}
    </mesh>
  );
}
