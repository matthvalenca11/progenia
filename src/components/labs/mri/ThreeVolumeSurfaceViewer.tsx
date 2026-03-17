import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stats } from "@react-three/drei";
import { useMRILabStore } from "@/stores/mriLabStore";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";

interface ThreeVolumeSurfaceViewerProps {
  showDebug?: boolean;
}

function buildDownsampledField(opts: {
  width: number;
  height: number;
  depth: number;
  data: any;
  outRes: number;
  min: number;
  max: number;
}) {
  const { width, height, depth, data, outRes, min, max } = opts;
  const field = new Float32Array(outRes * outRes * outRes);
  const sliceStride = width * height;

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const idx3 = (x: number, y: number, z: number) => x + y * width + z * sliceStride;

  const sampleTrilinear = (fx: number, fy: number, fz: number) => {
    const x0 = clamp(Math.floor(fx), 0, width - 1);
    const y0 = clamp(Math.floor(fy), 0, height - 1);
    const z0 = clamp(Math.floor(fz), 0, depth - 1);
    const x1 = clamp(x0 + 1, 0, width - 1);
    const y1 = clamp(y0 + 1, 0, height - 1);
    const z1 = clamp(z0 + 1, 0, depth - 1);

    const tx = fx - x0;
    const ty = fy - y0;
    const tz = fz - z0;

    const c000 = data[idx3(x0, y0, z0)] ?? 0;
    const c100 = data[idx3(x1, y0, z0)] ?? 0;
    const c010 = data[idx3(x0, y1, z0)] ?? 0;
    const c110 = data[idx3(x1, y1, z0)] ?? 0;
    const c001 = data[idx3(x0, y0, z1)] ?? 0;
    const c101 = data[idx3(x1, y0, z1)] ?? 0;
    const c011 = data[idx3(x0, y1, z1)] ?? 0;
    const c111 = data[idx3(x1, y1, z1)] ?? 0;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const c00 = lerp(c000, c100, tx);
    const c10 = lerp(c010, c110, tx);
    const c01 = lerp(c001, c101, tx);
    const c11 = lerp(c011, c111, tx);
    const c0 = lerp(c00, c10, ty);
    const c1 = lerp(c01, c11, ty);
    return lerp(c0, c1, tz);
  };

  for (let z = 0; z < outRes; z++) {
    const srcZ = (z / (outRes - 1)) * (depth - 1);
    for (let y = 0; y < outRes; y++) {
      const srcY = (y / (outRes - 1)) * (height - 1);
      for (let x = 0; x < outRes; x++) {
        const srcX = (x / (outRes - 1)) * (width - 1);
        const v = sampleTrilinear(srcX, srcY, srcZ);
        // Normaliza em [0,1] para o marching cubes do three
        const t = (v - min) / (max - min || 1);
        field[x + y * outRes + z * outRes * outRes] = Math.min(1, Math.max(0, t));
      }
    }
  }

  return field;
}

function BrainIsoSurface({ iso, res }: { iso: number; res: number }) {
  const { dicomVolume, normalizedVolume } = useMRILabStore();
  const volume = normalizedVolume && normalizedVolume.isValid ? normalizedVolume : dicomVolume;
  const mcRef = useRef<MarchingCubes | null>(null);

  const { field, size } = useMemo(() => {
    if (!volume) return { field: new Float32Array(0), size: 1 };
    const data = (volume as any).data ?? (volume as any).voxels;
    const outRes = Math.max(24, Math.min(96, res));
    const f = buildDownsampledField({
      width: volume.width,
      height: volume.height,
      depth: volume.depth,
      data,
      outRes,
      min: volume.min,
      max: volume.max,
    });
    // Tamanho visual arbitrário (mantém o cérebro grande na tela)
    return { field: f, size: 120 };
  }, [volume, normalizedVolume, dicomVolume, res]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#e6e9f5"),
        roughness: 0.85,
        metalness: 0.05,
      }),
    [],
  );

  // Instância estável do MarchingCubes (recria só quando muda a resolução)
  const marching = useMemo(() => {
    const outRes = Math.max(24, Math.min(160, res));
    const mc = new MarchingCubes(outRes, material, false, false, 900000);
    mc.frustumCulled = false;
    return mc;
  }, [res, material]);

  // Aplica campo + iso quando mudar (sem resetar o field)
  useEffect(() => {
    const mc = marching;
    if (!mc || field.length === 0) return;
    // Copiar dados para o buffer interno do marching cubes
    mc.field.set(field);
    mc.isolation = iso;
    mc.update();
  }, [marching, field, iso]);

  if (!volume || field.length === 0) return null;

  return (
    <primitive
      ref={mcRef}
      object={marching}
      // Centraliza e escala para o “cérebro” ocupar a tela
      scale={[size / 2, size / 2, size / 2]}
    />
  );
}

export function ThreeVolumeSurfaceViewer({ showDebug = false }: ThreeVolumeSurfaceViewerProps) {
  const { dicomVolume, dicomReady, normalizedVolume } = useMRILabStore();
  const volume = normalizedVolume && normalizedVolume.isValid ? normalizedVolume : dicomVolume;

  // iso em [0,1] - faixa estreita para superfície cortical
  const [iso, setIso] = useState(0.56);
  const res = 96;

  if (!volume || !(normalizedVolume?.isValid || dicomReady)) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-4 text-muted-foreground text-sm">Nenhum volume clínico carregado.</div>
      </div>
    );
  }

  const min = volume.min;
  const max = volume.max;

  return (
    <div className="w-full h-full flex flex-col bg-background">
      <div className="flex-1 relative bg-black">
        <Canvas camera={{ position: [0, 0, 220], fov: 35 }}>
          <color attach="background" args={["#050509"]} />
          <ambientLight intensity={0.35} />
          <directionalLight intensity={0.9} position={[150, 200, 200]} />
          <directionalLight intensity={0.35} position={[-150, -100, 50]} />
          <BrainIsoSurface iso={iso} res={res} />
          <OrbitControls enablePan enableRotate enableZoom />
          {showDebug && <Stats />}
        </Canvas>
        <div className="pointer-events-none absolute bottom-2 left-2 bg-black/60 text-white text-[11px] px-2 py-1 rounded font-mono">
          Arraste para rotacionar · Scroll para zoom
        </div>
      </div>

      <div className="border-t border-border bg-card p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Iso (0–1)</Label>
            <span className="text-xs text-muted-foreground">{iso.toFixed(2)}</span>
          </div>
          <Slider
            value={[iso]}
            onValueChange={(v) => setIso(v[0])}
            min={0.51}
            max={0.57}
            step={0.01}
          />
        </div>

        <div className="text-[11px] text-muted-foreground font-mono">
          range: {min.toFixed(1)}..{max.toFixed(1)} (iso usa dados normalizados)
        </div>
      </div>
    </div>
  );
}

