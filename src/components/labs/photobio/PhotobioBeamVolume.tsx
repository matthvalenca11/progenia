import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PhotobioOpticsResult, PhotobioWavelength } from "@/lib/photobioOptics";
import {
  getBeamRadiusAtDepthMm,
  getPhotobioWavelengthVisualPreset,
  getRelativeFluenceAtBeamProgress,
  getSpotRadiusCm,
  photobioDepthMmToWorldUnits,
} from "@/lib/photobioOptics";
import {
  buildBeamSlices,
  getWavelengthBeamColors,
  type BeamSlice,
} from "./photobioBeamVisual";
import { PHOTOBIO_MM_TO_WORLD, clamp } from "./photobioViewerLayout";

const CM_TO_WORLD = PHOTOBIO_MM_TO_WORLD * 10;

function cmRadiusToWorld(radiusCm: number): number {
  return radiusCm * CM_TO_WORLD;
}

interface PhotobioBeamVolumeProps {
  opticsProfile: PhotobioOpticsResult;
  spotSizeCm2: number;
  contactSurfaceY: number;
  transducerX: number;
  transducerAngle: number;
  wavelength: PhotobioWavelength;
  coupling: number;
  intensityScale: number;
  isPulsed: boolean;
  dutyCycle: number;
  maxSlices?: number;
}

/** Envelope contínuo do feixe — cone atenuado por Beer–Lambert, sem discos horizontais. */
export function PhotobioBeamVolume({
  opticsProfile,
  spotSizeCm2,
  contactSurfaceY,
  transducerX,
  transducerAngle,
  wavelength,
  coupling,
  intensityScale,
  isPulsed,
  dutyCycle,
}: PhotobioBeamVolumeProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const colors = getWavelengthBeamColors(wavelength);
  const preset = getPhotobioWavelengthVisualPreset(wavelength);

  const beamDepthMm = Math.max(1.5, opticsProfile.beamVisualDepthMm);
  const penetrationMm = Math.max(1, opticsProfile.penetrationDepthMm);
  const depthWorld = photobioDepthMmToWorldUnits(beamDepthMm);
  const topRadius = cmRadiusToWorld(getSpotRadiusCm(spotSizeCm2));
  const bottomRadius = cmRadiusToWorld(
    getBeamRadiusAtDepthMm(beamDepthMm, spotSizeCm2, wavelength),
  );

  const tiltRad = ((transducerAngle - 90) * Math.PI) / 180;
  const centerY = contactSurfaceY - depthWorld / 2;
  const centerX = transducerX + Math.sin(tiltRad) * depthWorld * 0.12;

  const attenTexture = useMemo(() => {
    const size = 64;
    const data = new Float32Array(size * 4);
    for (let i = 0; i < size; i += 1) {
      const t = i / Math.max(1, size - 1);
      const fluence = getRelativeFluenceAtBeamProgress(t, opticsProfile);
      const idx = i * 4;
      data[idx] = fluence;
      data[idx + 1] = fluence * 0.85;
      data[idx + 2] = fluence * 0.55;
      data[idx + 3] = 1;
    }
    const tex = new THREE.DataTexture(data, size, 1, THREE.RGBAFormat, THREE.FloatType);
    tex.needsUpdate = true;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, [opticsProfile]);

  const material = useMemo(() => {
    const core = new THREE.Color(colors.core);
    const deep = new THREE.Color(wavelength === 808 ? colors.deep : colors.halo);
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: true,
      uniforms: {
        uAttenMap: { value: attenTexture },
        uCoreColor: { value: core },
        uDeepColor: { value: deep },
        uIntensity: { value: coupling * intensityScale },
        uPenetrationNorm: { value: clamp(penetrationMm / beamDepthMm, 0.35, 1) },
        uScatterFactor: { value: preset.scatterDepthFactor },
        uTopRadius: { value: topRadius },
        uBottomRadius: { value: bottomRadius },
        uPulse: { value: 1 },
      },
      vertexShader: `
        varying float vDepthNorm;
        varying float vRadialNorm;
        uniform float uTopRadius;
        uniform float uBottomRadius;

        void main() {
          float yNorm = clamp(uv.y, 0.0, 1.0);
          vDepthNorm = 1.0 - yNorm;
          float expectedRadius = mix(uBottomRadius, uTopRadius, yNorm);
          vRadialNorm = length(position.xz) / max(expectedRadius, 0.001);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uAttenMap;
        uniform vec3 uCoreColor;
        uniform vec3 uDeepColor;
        uniform float uIntensity;
        uniform float uPenetrationNorm;
        uniform float uScatterFactor;
        uniform float uPulse;

        varying float vDepthNorm;
        varying float vRadialNorm;

        void main() {
          float depth = clamp(vDepthNorm, 0.0, 1.0);
          float radial = clamp(vRadialNorm, 0.0, 1.0);

          vec4 attenSample = texture2D(uAttenMap, vec2(depth, 0.5));
          float fluence = attenSample.r;

          float radialFalloff = exp(-2.8 * radial * radial);
          float edgeSoft = smoothstep(1.0, 0.72, radial);
          float penetrationCut = 1.0 - smoothstep(uPenetrationNorm, uPenetrationNorm + 0.1, depth);
          float tailFade = 1.0 - smoothstep(0.88, 1.0, depth);

          float alpha = fluence * radialFalloff * edgeSoft * penetrationCut * tailFade;
          alpha *= uIntensity * uPulse * 0.55;

          if (alpha < 0.008) discard;

          vec3 color = mix(uCoreColor, uDeepColor, pow(depth, 0.65 * uScatterFactor));
          color *= 0.75 + fluence * 0.65;

          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
  }, [
    attenTexture,
    colors.core,
    colors.deep,
    colors.halo,
    coupling,
    intensityScale,
    penetrationMm,
    beamDepthMm,
    preset.scatterDepthFactor,
    topRadius,
    bottomRadius,
    wavelength,
  ]);

  materialRef.current = material;

  useEffect(() => () => attenTexture.dispose(), [attenTexture]);

  useFrame(({ clock }) => {
    const mat = materialRef.current;
    if (!mat) return;
    const t = clock.getElapsedTime();
    const pulsePeriod = 0.85;
    const dutyNorm = clamp(dutyCycle / 100, 0.1, 0.9);
    const phase = (t % pulsePeriod) / pulsePeriod;
    const pulse = isPulsed ? (phase < dutyNorm ? 1 : 0.12 + 0.06 * Math.sin(t * 18)) : 1;
    mat.uniforms.uPulse.value = pulse;
  });

  if (depthWorld < 0.04 || topRadius < 0.01) return null;

  return (
    <mesh
      position={[centerX, centerY, 0.02]}
      rotation={[0, 0, tiltRad * 0.35]}
      renderOrder={21}
      frustumCulled={false}
    >
      <cylinderGeometry
        args={[topRadius * 0.95, bottomRadius * 1.04, depthWorld, 48, 1, true]}
      />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/** @deprecated Cone separado — envelope contínuo em PhotobioBeamVolume */
export function PhotobioBeamCone(_props: {
  slices: BeamSlice[];
  wavelength: PhotobioWavelength;
  coupling: number;
  intensityScale: number;
}) {
  return null;
}

export function useBeamSlices(
  opticsProfile: PhotobioOpticsResult,
  spotSizeCm2: number,
  contactSurfaceY: number,
  transducerX: number,
  transducerAngle: number,
  maxSlices = 22,
) {
  return useMemo(
    () =>
      buildBeamSlices(
        opticsProfile,
        spotSizeCm2,
        contactSurfaceY,
        transducerX,
        transducerAngle,
        maxSlices,
      ),
    [opticsProfile, spotSizeCm2, contactSurfaceY, transducerX, transducerAngle, maxSlices],
  );
}
