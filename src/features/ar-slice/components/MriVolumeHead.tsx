import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VolumeRenderShader1 } from "three/examples/jsm/shaders/VolumeShader.js";
import { isNativeMobile } from "@/lib/labPerformance";
import {
  MEDICAL_VOLUME_PRESETS,
  useArSliceMriStore,
} from "@/features/ar-slice/mri/arSliceMriStore";
import { useArSliceStore } from "@/features/ar-slice/arSliceStore";
import {
  applyWindowLevel,
  computeDisplayHalfExtents,
  sampleVolumeTrilinear,
} from "@/features/ar-slice/mri/volumeSampling";
import { worldUnitToVolumeFraction } from "@/features/ar-slice/mri/niftiWorldAxes";
import type { NormalizedVolume } from "@/lib/mri/volumeTypes";
import { createMedicalColorMapData } from "@/features/ar-slice/mri/medicalColorMap";

/** Fill one Z-slice of the display volume (keeps the UI thread responsive). */
function fillVolumeSlice(
  data: Uint8Array,
  z: number,
  resolution: number,
  volume: NormalizedVolume,
  windowLevel: number,
  level: number,
) {
  const lz = z / (resolution - 1);
  let offset = z * resolution * resolution;
  for (let y = 0; y < resolution; y++) {
    const ly = y / (resolution - 1);
    for (let x = 0; x < resolution; x++) {
      const lx = x / (resolution - 1);
      const { fx, fy, fz } = worldUnitToVolumeFraction(lx, ly, lz, volume);
      const intensity = sampleVolumeTrilinear(volume, fx, fy, fz);
      data[offset++] = applyWindowLevel(
        intensity,
        volume.min,
        volume.max,
        windowLevel,
        level,
      );
    }
  }
}

function createVoxelTexture(data: Uint8Array, resolution: number) {
  const texture = new THREE.Data3DTexture(
    data,
    resolution,
    resolution,
    resolution,
  );
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

function makeDirectVolumeFragmentShader(
  hologram: boolean,
  overlay = false,
): string {
  let shader = VolumeRenderShader1.fragmentShader;
  const definitionStart = shader.lastIndexOf("void cast_mip(");
  const nextDefinition = shader.indexOf("void cast_iso(", definitionStart);
  if (definitionStart < 0 || nextDefinition < 0) return shader;

  const directVolumeFunction = `
    void cast_mip(vec3 start_loc, vec3 step, int nsteps, vec3 view_ray) {
      vec4 accumulated = vec4(0.0);
      vec3 loc = start_loc;

      for (int iter = 0; iter < MAX_STEPS; iter++) {
        if (iter >= nsteps || accumulated.a > 0.97) break;

        float val = sample1(loc);
        float normalized = clamp(
          (val - u_clim[0]) / max(0.0001, u_clim[1] - u_clim[0]),
          0.0,
          1.0
        );
        // Strong absorption makes the first anatomical layers dominate,
        // avoiding the washed/translucent look of deep voxel blending.
        float density = smoothstep(0.02, 0.16, normalized) * ${hologram ? "0.18" : "0.11"};
        vec4 color = apply_colormap(val);

        accumulated.rgb +=
          (1.0 - accumulated.a) * color.rgb * density;
        accumulated.a += (1.0 - accumulated.a) * density;
        loc += step;
      }

      if (accumulated.a > 0.05) {
        // Convert premultiplied ray accumulation back to the original MRI
        // grayscale and make actual tissue fully opaque.
        vec3 diagnostic = accumulated.rgb / max(accumulated.a, 0.0001);
        ${
          hologram
            ? `
        float luminance = dot(diagnostic, vec3(0.299, 0.587, 0.114));
        float scanline = 0.88 + 0.12 * sin(gl_FragCoord.y * 1.2 + u_holotime * 3.5);
        float pulse = 0.95 + 0.05 * sin(u_holotime * 2.0);
        vec3 holo = vec3(0.2, 0.97, 1.0) * (0.7 + luminance * 1.8) * scanline * pulse;
        float alpha = clamp(0.7 + accumulated.a * 0.3, 0.7, 1.0);
        gl_FragColor = vec4(holo * alpha, alpha);
        `
            : overlay
              ? `
        float fusionAlpha = clamp(accumulated.a * 0.76, 0.0, 0.76);
        gl_FragColor = vec4(diagnostic * fusionAlpha, fusionAlpha);
        `
              : "gl_FragColor = vec4(diagnostic, 1.0);"
        }
      } else {
        discard;
      }
    }

    `;

  const withDirectVolume = (
    shader.slice(0, definitionStart) +
    directVolumeFunction +
    shader.slice(nextDefinition)
  );
  return withDirectVolume.replace(
    "final_color = color * (ambient_color + diffuse_color) + specular_color;",
    `float diagnosticLight = 0.58 + 0.62 * abs(dot(N, V));
      final_color = vec4(color.rgb * diagnosticLight, color.a);`,
  );
}

/**
 * True voxel rendering of the selected medical volume. Unlike isosurfaces,
 * every displayed value comes from the modality-specific window/level and
 * color map also used by the cut slice.
 */
type MriVolumeHeadProps = {
  clipPlane: THREE.Plane;
  onReady?: () => void;
};

export function MriVolumeHead({ clipPlane, onReady }: MriVolumeHeadProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const overlayMeshRef = useRef<THREE.Mesh>(null);
  const volume = useArSliceMriStore((state) => state.volume);
  const overlayVolume = useArSliceMriStore((state) => state.overlayVolume);
  const displayScale = useArSliceMriStore((state) => state.displayScale);
  const windowLevel = useArSliceMriStore((state) => state.window);
  const level = useArSliceMriStore((state) => state.level);
  const overlayWindow = useArSliceMriStore((state) => state.overlayWindow);
  const overlayLevel = useArSliceMriStore((state) => state.overlayLevel);
  const activeModality = useArSliceMriStore((state) => state.activeModality);
  const volumePreset = MEDICAL_VOLUME_PRESETS[activeModality];
  const visualStyle = useArSliceStore((state) => state.visualStyle);
  const hologram = visualStyle === "hologram";
  // CT/PET need more samples than the old 64³ mobile proxy. Keep MRI slightly
  // lighter, and chunk high-resolution modalities one Z plane per frame so
  // BLE/WebSocket delivery remains responsive during texture construction.
  const resolution = isNativeMobile
    ? activeModality === "mri"
      ? 112
      : 160
    : 192;
  const [voxelTexture, setVoxelTexture] = useState<THREE.Data3DTexture | null>(null);
  const [overlayVoxelTexture, setOverlayVoxelTexture] =
    useState<THREE.Data3DTexture | null>(null);

  useEffect(() => {
    if (!volume) {
      setVoxelTexture(null);
      setOverlayVoxelTexture(null);
      return;
    }

    let cancelled = false;
    let raf = 0;
    const data = new Uint8Array(resolution ** 3);
    const overlayData = overlayVolume
      ? new Uint8Array(resolution ** 3)
      : null;
    // Resample into scene axes: X=left/right, Y=superior/inferior,
    // Z=posterior/anterior. Chunk Z-slices across frames so BLE/UI stay alive.
    const slicesPerFrame = isNativeMobile
      ? resolution > 112
        ? 1
        : 2
      : resolution;
    let z = 0;

    const pump = () => {
      if (cancelled) return;
      const end = Math.min(resolution, z + slicesPerFrame);
      for (; z < end; z++) {
        fillVolumeSlice(data, z, resolution, volume, windowLevel, level);
        if (overlayData && overlayVolume) {
          fillVolumeSlice(
            overlayData,
            z,
            resolution,
            overlayVolume,
            overlayWindow,
            overlayLevel,
          );
        }
      }
      if (z < resolution) {
        raf = requestAnimationFrame(pump);
        return;
      }

      const texture = createVoxelTexture(data, resolution);
      setVoxelTexture((prev) => {
        prev?.dispose();
        return texture;
      });
      setOverlayVoxelTexture((prev) => {
        prev?.dispose();
        return overlayData
          ? createVoxelTexture(overlayData, resolution)
          : null;
      });
    };

    raf = requestAnimationFrame(pump);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [
    level,
    overlayLevel,
    overlayVolume,
    overlayWindow,
    resolution,
    volume,
    windowLevel,
  ]);

  const colorMapTexture = useMemo(() => {
    const data = createMedicalColorMapData(volumePreset.colorMap);
    const texture = new THREE.DataTexture(
      data,
      256,
      1,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, [volumePreset.colorMap]);

  const overlayColorMapTexture = useMemo(() => {
    const texture = new THREE.DataTexture(
      createMedicalColorMapData("pet"),
      256,
      1,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, []);

  const material = useMemo(() => {
    if (!voxelTexture) return null;
    const uniforms = THREE.UniformsUtils.clone(VolumeRenderShader1.uniforms);
    uniforms.u_data.value = voxelTexture;
    uniforms.u_size.value.set(resolution, resolution, resolution);
    uniforms.u_clim.value.set(0, 1);
    // First-hit isosurface keeps anatomy rigid while orbiting. Alpha ray
    // accumulation is view-dependent and made sulci appear to warp.
    uniforms.u_renderstyle.value = hologram ? 0 : 1;
    uniforms.u_renderthreshold.value = volumePreset.surfaceThreshold;
    uniforms.u_cmdata.value = colorMapTexture;
    uniforms.u_clipplane = { value: new THREE.Vector4(0, 0, 1, 0) };
    uniforms.u_holotime = { value: 0 };

    const fragmentShader = makeDirectVolumeFragmentShader(hologram)
      .replace(
        "uniform sampler2D u_cmdata;",
        `uniform sampler2D u_cmdata;
        uniform vec4 u_clipplane;
        uniform float u_holotime;`,
      )
      .replace(
        "return texture(u_data, texcoords.xyz).r;",
        hologram
          ? `return texture(u_data, texcoords.xyz).r;`
          : `vec3 local_position = texcoords.xyz * u_size;
        if (dot(u_clipplane.xyz, local_position) + u_clipplane.w > 0.0) {
          return 0.0;
        }
        return texture(u_data, texcoords.xyz).r;`,
      );

    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VolumeRenderShader1.vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      transparent: hologram,
      depthWrite: !hologram,
      blending: THREE.NormalBlending,
      premultipliedAlpha: hologram,
    });
  }, [
    colorMapTexture,
    hologram,
    resolution,
    volumePreset.surfaceThreshold,
    voxelTexture,
  ]);

  const overlayMaterial = useMemo(() => {
    if (!overlayVoxelTexture) return null;
    const uniforms = THREE.UniformsUtils.clone(VolumeRenderShader1.uniforms);
    uniforms.u_data.value = overlayVoxelTexture;
    uniforms.u_size.value.set(resolution, resolution, resolution);
    uniforms.u_clim.value.set(0, 1);
    uniforms.u_renderstyle.value = 0;
    uniforms.u_renderthreshold.value = 0.12;
    uniforms.u_cmdata.value = overlayColorMapTexture;
    uniforms.u_clipplane = { value: new THREE.Vector4(0, 0, 1, 0) };
    uniforms.u_holotime = { value: 0 };

    const fragmentShader = makeDirectVolumeFragmentShader(false, true)
      .replace(
        "uniform sampler2D u_cmdata;",
        `uniform sampler2D u_cmdata;
        uniform vec4 u_clipplane;
        uniform float u_holotime;`,
      )
      .replace(
        "return texture(u_data, texcoords.xyz).r;",
        `vec3 local_position = texcoords.xyz * u_size;
        if (dot(u_clipplane.xyz, local_position) + u_clipplane.w > 0.0) {
          return 0.0;
        }
        return texture(u_data, texcoords.xyz).r;`,
      );

    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VolumeRenderShader1.vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      premultipliedAlpha: true,
    });
  }, [overlayColorMapTexture, overlayVoxelTexture, resolution]);

  const geometry = useMemo(() => {
    const box = new THREE.BoxGeometry(resolution, resolution, resolution);
    box.translate(resolution / 2, resolution / 2, resolution / 2);
    return box;
  }, [resolution]);

  useEffect(() => {
    if (material) onReady?.();
  }, [material, onReady]);

  useEffect(
    () => () => {
      colorMapTexture.dispose();
      overlayColorMapTexture.dispose();
      material?.dispose();
      overlayMaterial?.dispose();
      geometry.dispose();
    },
    [
      colorMapTexture,
      geometry,
      material,
      overlayColorMapTexture,
      overlayMaterial,
    ],
  );

  useEffect(
    () => () => {
      voxelTexture?.dispose();
      overlayVoxelTexture?.dispose();
    },
    [overlayVoxelTexture, voxelTexture],
  );

  const inverseWorld = useMemo(() => new THREE.Matrix4(), []);
  const localClipPlane = useMemo(() => new THREE.Plane(), []);
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || !material) return;
    inverseWorld.copy(mesh.matrixWorld).invert();
    localClipPlane.copy(clipPlane).applyMatrix4(inverseWorld);
    material.uniforms.u_clipplane.value.set(
      localClipPlane.normal.x,
      localClipPlane.normal.y,
      localClipPlane.normal.z,
      localClipPlane.constant,
    );
    material.uniforms.u_holotime.value = performance.now() / 1000;
    const overlayMesh = overlayMeshRef.current;
    if (overlayMesh && overlayMaterial) {
      inverseWorld.copy(overlayMesh.matrixWorld).invert();
      localClipPlane.copy(clipPlane).applyMatrix4(inverseWorld);
      overlayMaterial.uniforms.u_clipplane.value.set(
        localClipPlane.normal.x,
        localClipPlane.normal.y,
        localClipPlane.normal.z,
        localClipPlane.constant,
      );
    }
  });

  if (!volume || !material) return null;

  const halfExtents = computeDisplayHalfExtents(volume, displayScale);
  const position: [number, number, number] = [
    -halfExtents.x,
    -halfExtents.y,
    -halfExtents.z,
  ];
  const scale: [number, number, number] = [
    (halfExtents.x * 2) / resolution,
    (halfExtents.y * 2) / resolution,
    (halfExtents.z * 2) / resolution,
  ];
  return (
    <>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        position={position}
        scale={scale}
        renderOrder={0}
      />
      {overlayMaterial ? (
        <mesh
          ref={overlayMeshRef}
          geometry={geometry}
          material={overlayMaterial}
          position={position}
          scale={scale}
          renderOrder={1}
        />
      ) : null}
    </>
  );
}
