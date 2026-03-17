/**
 * VTK Surface Viewer (Isosurface)
 * Renderiza uma superfície 3D real (marching cubes) a partir do volume.
 *
 * Motivo: volume ray-casting é sensível a TF/opacity e pode “sumir”.
 * A isosurface é mais previsível e entrega “superfície cerebral”.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMRILabStore } from "@/stores/mriLabStore";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

import vtkGenericRenderWindow from "vtk.js/Sources/Rendering/Misc/GenericRenderWindow";
import vtkInteractorStyleTrackballCamera from "vtk.js/Sources/Interaction/Style/InteractorStyleTrackballCamera";
import vtkImageData from "vtk.js/Sources/Common/DataModel/ImageData";
import vtkDataArray from "vtk.js/Sources/Common/Core/DataArray";
import vtkImageMarchingCubes from "vtk.js/Sources/Filters/General/ImageMarchingCubes";
import vtkMapper from "vtk.js/Sources/Rendering/Core/Mapper";
import vtkActor from "vtk.js/Sources/Rendering/Core/Actor";

import "vtk.js/Sources/Rendering/OpenGL/Profiles/Geometry";

type TypedVoxels = Float32Array | Int16Array | Uint16Array | Uint8Array;

interface VtkVolumeViewerProps {
  showDebug?: boolean;
}

export function VtkVolumeViewer({ showDebug = false }: VtkVolumeViewerProps) {
  const { dicomVolume, dicomReady, normalizedVolume } = useMRILabStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const vtkRefs = useRef<{
    generic: any;
    renderer: any;
    renderWindow: any;
    interactor: any;
    marching: any;
    mapper: any;
    actor: any;
    resizeObserver?: ResizeObserver;
  } | null>(null);

  const volume = normalizedVolume || dicomVolume;
  const isReady = normalizedVolume?.isValid || dicomReady;

  const [error, setError] = useState<string | null>(null);
  const [initStep, setInitStep] = useState("Inicializando Superfície 3D...");
  const [isInitialized, setIsInitialized] = useState(false);

  const range = useMemo(() => {
    if (!volume) return { min: 0, max: 1 };
    const min = Number.isFinite(volume.min) ? volume.min : 0;
    const max0 = Number.isFinite(volume.max) ? volume.max : min + 1;
    const max = max0 === min ? min + 1 : max0;
    return { min, max };
  }, [volume]);

  // Iso default: acima do fundo, mas não tão alto
  const [isoValue, setIsoValue] = useState(() => range.min + (range.max - range.min) * 0.35);
  const [opacity, setOpacity] = useState(1.0);
  const [shading, setShading] = useState(false);
  const [debugStats, setDebugStats] = useState<{ cells: number; bounds: number[] } | null>(null);

  useEffect(() => {
    if (!volume) return;
    const defaultIso = range.min + (range.max - range.min) * 0.35;
    setIsoValue(defaultIso);
    setOpacity(0.9);
  }, [volume, range.min, range.max]);

  const volumeKey = useMemo(() => {
    if (!isReady || !volume) return "none";
    return `${volume.width}x${volume.height}x${volume.depth}|${range.min}|${range.max}|${normalizedVolume?.isValid ? "norm" : "dicom"}`;
  }, [isReady, volume, range.min, range.max, normalizedVolume?.isValid]);

  const cleanup = useCallback(() => {
    if (!vtkRefs.current) return;
    const r = vtkRefs.current;
    try {
      r.resizeObserver?.disconnect();
      r.generic?.setContainer?.(null);
      r.generic?.delete?.();
      r.interactor?.delete?.();
      r.actor?.delete?.();
      r.mapper?.delete?.();
      r.marching?.delete?.();
      r.renderWindow?.delete?.();
      r.renderer?.delete?.();
    } catch {
      // ignore
    }
    vtkRefs.current = null;
    setIsInitialized(false);
  }, []);

  // Init VTK (somente quando o volume mudar)
  useEffect(() => {
    if (!isReady || !volume || !containerRef.current) return;

    cleanup();
    setError(null);

    try {
      setInitStep("Criando renderer...");
      const container = containerRef.current;

      const generic = vtkGenericRenderWindow.newInstance({ background: [0.02, 0.02, 0.03] });
      generic.setContainer(container);
      generic.resize();

      const renderer = generic.getRenderer();
      const renderWindow = generic.getRenderWindow();
      const interactor = generic.getInteractor();
      interactor.setInteractorStyle(vtkInteractorStyleTrackballCamera.newInstance());
      interactor.setCurrentRenderer(renderer);

      setInitStep("Montando vtkImageData...");
      let width: number, height: number, depth: number;
      let voxels: TypedVoxels;
      let spacing: [number, number, number];

      if (normalizedVolume && normalizedVolume.isValid) {
        width = normalizedVolume.width;
        height = normalizedVolume.height;
        depth = normalizedVolume.depth;
        voxels = normalizedVolume.data as any;
        spacing = normalizedVolume.spacing;
      } else if (dicomVolume) {
        width = dicomVolume.width;
        height = dicomVolume.height;
        depth = dicomVolume.depth;
        voxels = dicomVolume.voxels as any;
        const sx = dicomVolume.pixelSpacing?.[0] ?? 1.0;
        const sy = dicomVolume.pixelSpacing?.[1] ?? 1.0;
        const sz = dicomVolume.spacingBetweenSlices ?? dicomVolume.sliceThickness ?? 1.0;
        spacing = [sx, sy, sz];
      } else {
        throw new Error("No volume data available");
      }

      const imageData = vtkImageData.newInstance();
      imageData.setDimensions([width, height, depth]);
      imageData.setSpacing(spacing);
      imageData.setOrigin([0, 0, 0]);

      imageData.getPointData().setScalars(
        vtkDataArray.newInstance({
          numberOfComponents: 1,
          values: voxels as any,
        }),
      );

      setInitStep("Extraindo superfície (Marching Cubes)...");
      const marching = vtkImageMarchingCubes.newInstance({
        computeNormals: true,
        mergePoints: true,
      });
      marching.setInputData(imageData);
      // Garantir que o primeiro iso esteja no range
      const initialIso = Number.isFinite(isoValue) ? isoValue : (range.min + (range.max - range.min) * 0.35);
      marching.setContourValue(0, initialIso);
      // Forçar execução do filtro agora (senão pode ficar com output vazio até a primeira render)
      marching.update();

      const mapper = vtkMapper.newInstance();
      mapper.setInputConnection(marching.getOutputPort());
      // Garantir cor fixa (não mapear por escalares)
      mapper.setScalarVisibility(false);

      const actor = vtkActor.newInstance();
      actor.setMapper(mapper);
      actor.getProperty().setColor(0.95, 0.95, 0.98);
      actor.getProperty().setOpacity(opacity);
      actor.getProperty().setInterpolationToPhong();
      actor.getProperty().setLighting(!!shading);
      actor.getProperty().setAmbient(0.2);
      actor.getProperty().setDiffuse(0.8);
      actor.getProperty().setSpecular(0.25);
      actor.getProperty().setSpecularPower(12);

      renderer.addActor(actor);
      // Se o iso inicial gerar malha vazia, procurar automaticamente um iso melhor
      const getCellCount = () => {
        try {
          const out = marching.getOutputData();
          const polys = out?.getPolys?.();
          return polys?.getNumberOfCells?.() ?? 0;
        } catch {
          return 0;
        }
      };
      const getBounds = () => {
        try {
          return marching.getOutputData()?.getBounds?.() ?? [];
        } catch {
          return [];
        }
      };

      if (getCellCount() === 0) {
        const samples = 24;
        let bestIso = initialIso;
        let bestCells = 0;
        for (let i = 1; i < samples; i++) {
          const t = i / samples;
          const candidate = range.min + (range.max - range.min) * t;
          marching.setContourValue(0, candidate);
          marching.update();
          const cells = getCellCount();
          if (cells > bestCells) {
            bestCells = cells;
            bestIso = candidate;
          }
        }
        if (bestCells > 0) {
          marching.setContourValue(0, bestIso);
          marching.update();
          setIsoValue(bestIso);
        }
      }

      setDebugStats({ cells: getCellCount(), bounds: getBounds() });
      renderer.resetCamera();
      renderWindow.render();

      const ro = new ResizeObserver(() => {
        generic.resize();
        renderWindow.render();
      });
      ro.observe(container);

      vtkRefs.current = { generic, renderer, renderWindow, interactor, marching, mapper, actor, resizeObserver: ro };
      setIsInitialized(true);
      setInitStep("Pronto");
    } catch (err: any) {
      console.error("[VTK] Surface init error:", err);
      setError(`Erro ao inicializar Superfície 3D: ${err?.message ?? String(err)}`);
      setIsInitialized(false);
    }

    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volumeKey]);

  // Updates (iso / opacity / shading)
  useEffect(() => {
    if (!vtkRefs.current) return;
    const r = vtkRefs.current;
    try {
      r.marching.setContourValue(0, isoValue);
      r.marching.update();
      r.actor.getProperty().setOpacity(opacity);
      r.actor.getProperty().setLighting(!!shading);
      // Se o iso mudou muito, a câmera pode ficar ruim; manter clipping atualizado
      r.renderer.resetCameraClippingRange();
      r.renderWindow.render();
      try {
        const out = r.marching.getOutputData();
        const polys = out?.getPolys?.();
        const cells = polys?.getNumberOfCells?.() ?? 0;
        const bounds = out?.getBounds?.() ?? [];
        setDebugStats({ cells, bounds });
      } catch {
        // ignore
      }
    } catch (err) {
      console.error("[VTK] Surface update error:", err);
    }
  }, [isoValue, opacity, shading]);

  // Fallback de rotação por teclado (global), independente do mouse
  useEffect(() => {
    if (!isInitialized) return;
    const handler = (e: KeyboardEvent) => {
      const r = vtkRefs.current;
      if (!r) return;
      const cam = r.renderer.getActiveCamera();
      const step = e.shiftKey ? 10 : 3;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          cam.azimuth(-step);
          break;
        case "ArrowRight":
          e.preventDefault();
          cam.azimuth(step);
          break;
        case "ArrowUp":
          e.preventDefault();
          cam.elevation(step);
          break;
        case "ArrowDown":
          e.preventDefault();
          cam.elevation(-step);
          break;
        default:
          return;
      }
      cam.orthogonalizeViewUp();
      r.renderer.resetCameraClippingRange();
      r.renderWindow.render();
    };
    window.addEventListener("keydown", handler, { passive: false } as any);
    return () => window.removeEventListener("keydown", handler as any);
  }, [isInitialized]);

  const handleReset = useCallback(() => {
    const r = vtkRefs.current;
    if (!r) return;
    r.renderer.resetCamera();
    r.renderWindow.render();
  }, []);

  if (!isReady || !volume) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-4 text-muted-foreground">Nenhum volume carregado</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-4">
          <div className="text-red-500 text-sm mb-2">{error}</div>
          <div className="text-xs text-muted-foreground">Veja o console do navegador.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-background">
      <div className="flex-1 relative bg-black overflow-hidden">
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ minHeight: 400, touchAction: "none", pointerEvents: "auto" }}
          onContextMenu={(e) => e.preventDefault()}
        />
        {!isInitialized && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-4 text-muted-foreground text-sm">{initStep}</div>
          </div>
        )}
        {isInitialized && (
          <div className="pointer-events-none absolute bottom-2 left-2 bg-black/60 text-white text-[11px] px-2 py-1 rounded font-mono">
            Setas rotacionam · Shift + setas = rápido
          </div>
        )}
        {isInitialized && (
          <div className="pointer-events-none absolute bottom-2 right-2 bg-black/60 text-white text-[11px] px-2 py-1 rounded font-mono text-right max-w-[55%]">
            iso: {isoValue.toFixed(2)} · cells: {debugStats?.cells ?? "?"}
            {showDebug && debugStats?.bounds?.length === 6 && (
              <div className="text-[10px] text-white/80">
                b: [{debugStats.bounds.map((v) => v.toFixed(1)).join(", ")}]
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border bg-card p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Iso (limiar da superfície)</Label>
            <span className="text-sm text-muted-foreground">{isoValue.toFixed(2)}</span>
          </div>
          <Slider value={[isoValue]} onValueChange={(v) => setIsoValue(v[0])} min={range.min} max={range.max} step={(range.max - range.min) / 200} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Opacidade</Label>
            <span className="text-sm text-muted-foreground">{opacity.toFixed(2)}</span>
          </div>
          <Slider value={[opacity]} onValueChange={(v) => setOpacity(v[0])} min={0.05} max={1.0} step={0.05} />
        </div>

        <div className="flex items-center justify-between">
          <Label>Sombreamento</Label>
          <Switch checked={shading} onCheckedChange={setShading} />
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Camera
          </Button>
        </div>

        {showDebug && (
          <div className="text-[11px] text-muted-foreground font-mono">
            dims: {volume.width}×{volume.height}×{volume.depth} · range: {range.min.toFixed(3)}..{range.max.toFixed(3)}
          </div>
        )}
      </div>
    </div>
  );
}

