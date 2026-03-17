/**
 * Cornerstone3D Stack Viewer
 * DICOM viewer com ferramentas clínicas (stack scroll, WL, medidas, overlay).
 *
 * IMPORTANTE: Este componente assume que a configuração base do Cornerstone3D
 * (WASM, cache, loaders) já foi inicializada em outro lugar do app.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useMRILabStore, DICOMVolume } from "@/stores/mriLabStore";
import { synthVoxel } from "@/lib/mri/sequenceSynth";
import { Button } from "@/components/ui/button";
import { RotateCcw, Ruler, Circle, SunMedium, Eye } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

type WLPresetId = "brain" | "bone" | "soft";
type SequenceId = "t1" | "t2" | "flair" | "t1ce" | "blend";

interface CornerstoneStackViewerProps {
  showDebug?: boolean;
}

interface DicomOverlayProps {
  patientName: string;
  patientId: string;
  tr: number | string;
  te: number | string;
  sliceIndex: number;
  totalSlices: number;
  sliceThickness: number | string;
  window: number;
  level: number;
  blendFactor: number;
}

function estimateWeightingLabel(te: number | string): string {
  if (typeof te === "number") {
    if (te < 30) return "Ponderação: T1-weighted";
    if (te > 80) return "Ponderação: T2-weighted (Edema)";
  }
  return "Ponderação: Intermediária / Densidade Protônica";
}

function DicomOverlay({
  patientName,
  patientId,
  tr,
  te,
  sliceIndex,
  totalSlices,
  sliceThickness,
  window,
  level,
  blendFactor,
}: DicomOverlayProps) {
  const weighting = estimateWeightingLabel(te);
  const baseStyle: React.CSSProperties = {
    color: "#00ffff",
    textShadow: "0 0 4px rgba(0, 255, 255, 0.8)",
  };

  let weightingColor = "#ffffff";
  if (typeof te === "number" && te < 30) {
    weightingColor = "#00ffff"; // T1 - ciano
  } else if (typeof te === "number" && te > 80) {
    weightingColor = "#ffbf47"; // T2 - dourado/laranja suave
  }

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col text-[11px] font-mono">
      {/* Top row */}
      <div className="flex justify-between px-2 pt-1">
        {/* Top-left: Patient */}
        <div className="bg-black/60 rounded px-2 py-1 max-w-[55%]" style={baseStyle}>
          <div className="truncate">{patientName}</div>
          <div className="truncate">ID: {patientId}</div>
        </div>
        {/* Top-right: TR/TE + weighting */}
        <div className="bg-black/60 rounded px-2 py-1 text-right space-y-0.5" style={baseStyle}>
          <div>
            TR:{" "}
            {typeof tr === "number" ? `${tr.toFixed(0)} ms` : tr}{" "}
            · TE:{" "}
            {typeof te === "number" ? `${te.toFixed(0)} ms` : te}
          </div>
          <div className="truncate" style={{ color: weightingColor }}>
            {weighting}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="mt-auto flex justify-between px-2 pb-1">
        {/* Bottom-left: slice + thickness */}
        <div className="bg-black/60 rounded px-2 py-1 space-y-0.5" style={baseStyle}>
          <div>
            Im: {sliceIndex + 1}/{totalSlices}
          </div>
          <div>
            Esp.: {typeof sliceThickness === "number" ? `${sliceThickness} mm` : sliceThickness}
          </div>
        </div>
        {/* Bottom-right: W/L */}
        <div className="bg-black/60 rounded px-2 py-1 text-right space-y-0.5" style={baseStyle}>
          <div>W: {window}</div>
          <div>L: {level}</div>
        </div>
      </div>
    </div>
  );
}

export function CornerstoneStackViewer({ showDebug = false }: CornerstoneStackViewerProps) {
  const {
    dicomSeries,
    dicomReady,
    dicomVolumeA,
    dicomVolumeB,
    dicomVolumeFlair,
    dicomVolumeT1ce,
    segmentationVolume,
    config,
    updateConfig,
    getBlendFactor,
    syncSlices,
    caseMetadataA,
    caseMetadataB,
    loadingCase,
    activeSequence = "t1",
    setActiveSequence,
  } = useMRILabStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportElementRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastFusedRef = useRef<Float32Array | null>(null);

  const [currentSlice, setCurrentSlice] = useState(0);
  const [window, setWindow] = useState(config.window ?? 2000);
  const [level, setLevel] = useState(config.level ?? 1000);
  const [activeTool, setActiveTool] = useState<"scroll" | "wl" | "length" | "roi">("scroll");
  const [wlPreset, setWLPreset] = useState<WLPresetId | null>(null);
  const [blendFactor, setBlendFactor] = useState<number>(() => getBlendFactor());
  const [displayTr, setDisplayTr] = useState<number | null>(null);
  const [displayTe, setDisplayTe] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);
  const [lastDistanceMm, setLastDistanceMm] = useState<number | null>(null);
  const [lastRoiStats, setLastRoiStats] = useState<{ mean: number; count: number } | null>(null);
  // Segmentação (lesão) começa oculta por padrão; o usuário ativa pelo botão de olho.
  const [showSegmentation, setShowSegmentation] = useState(false);

  // TODO: Substituir estes placeholders por chamadas reais à API do Cornerstone3D
  // e criação de 2 camadas (layers) no mesmo viewport (volumeA e volumeB).
  const applyWindowLevelToViewport = useCallback(
    (ww: number, wl: number) => {
      setWindow(ww);
      setLevel(wl);
      updateConfig({ window: ww, level: wl });
      // Ex: cornerstone.setViewport(viewport, { voi: { windowWidth: ww, windowCenter: wl } })
    },
    [updateConfig],
  );

  // Presets W/L: apenas contraste/brilho + escolha da sequência clínica (T1, T2, FLAIR, T1ce)
  const applyWLPreset = useCallback(
    (preset: WLPresetId | "flair_like") => {
      // Valores típicos aproximados para 1.5T
      const setSequenceParams = (kind: "t1" | "t2" | "flair" | "t1ce") => {
        switch (kind) {
          case "t1":
            updateConfig({
              tr: 500,
              te: 15,
              ti: 0,
              flipAngle: 90,
              sequenceType: "spin_echo",
            } as any);
            break;
          case "t2":
            updateConfig({
              tr: 3000,
              te: 90,
              ti: 0,
              flipAngle: 90,
              sequenceType: "spin_echo",
            } as any);
            break;
          case "flair":
            updateConfig({
              tr: 9000,
              te: 120,
              ti: 2500,
              flipAngle: 90,
              sequenceType: "inversion_recovery",
            } as any);
            break;
          case "t1ce":
            updateConfig({
              tr: 600,
              te: 15,
              ti: 0,
              flipAngle: 20,
              sequenceType: "gradient_echo",
            } as any);
            break;
        }
      };

      switch (preset) {
        case "brain":
          setWLPreset("brain");
          applyWindowLevelToViewport(400, 200);
          setActiveSequence("t1");
          setSequenceParams("t1");
          break;
        case "bone":
          setWLPreset("bone");
          applyWindowLevelToViewport(2800, 600);
          setActiveSequence("t1ce");
          setSequenceParams("t1ce");
          break;
        case "flair_like":
          setWLPreset(null);
          applyWindowLevelToViewport(2500, 800);
          setActiveSequence("flair");
          setSequenceParams("flair");
          break;
        case "soft":
        default:
          setWLPreset("soft");
          applyWindowLevelToViewport(400, 40);
          setActiveSequence("t2");
          setSequenceParams("t2");
          break;
      }
    },
    [applyWindowLevelToViewport, updateConfig, setActiveSequence],
  );

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      const depth = dicomVolumeA?.depth ?? dicomSeries?.totalSlices ?? 1;
      if (depth <= 0) return;
      event.preventDefault();
      const direction = event.deltaY > 0 ? 1 : -1;
      setCurrentSlice((prev) => {
        const max = depth - 1;
        const next = Math.min(max, Math.max(0, prev + direction));
        syncSlices(next);
        return next;
      });
    },
    [dicomVolumeA, dicomSeries, syncSlices],
  );

  useEffect(() => {
    const container = containerRef.current;
    const hasVolume = dicomSeries || dicomVolumeA;
    if (!container || !hasVolume) return;

    // Criar canvas 2D para renderizar fatias fundidas (preenche o container, imagem com object-fit contain)
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.objectFit = "contain";
    canvas.style.pointerEvents = "auto";
    canvasRef.current = canvas;
    viewportElementRef.current = canvas;
    container.appendChild(canvas);

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel as any);
      if (canvas && container.contains(canvas)) {
        container.removeChild(canvas);
      }
      canvasRef.current = null;
      viewportElementRef.current = null;
    };
  }, [dicomSeries, dicomVolumeA, handleWheel]);

  // Atualizar blendFactor dinamicamente a partir do store (TR/TE)
  useEffect(() => {
    const bf = getBlendFactor();
    setBlendFactor(bf);
  }, [getBlendFactor, config.tr, config.te]);

  // Manter currentSlice sincronizado com config.sliceIndex (e garantir fatia válida ao carregar volume)
  useEffect(() => {
    const idx = config.sliceIndex ?? 0;
    setCurrentSlice(idx);
  }, [config.sliceIndex]);

  // Ao carregar volume: fatia no meio na primeira vez; W/L inicial para contraste visível
  const hasInitializedSlice = useRef(false);
  useEffect(() => {
    if (!dicomVolumeA || !dicomReady) return;
    const depth = dicomVolumeA.depth;
    const maxSlice = Math.max(0, depth - 1);
    const middle = Math.floor(depth / 2);
    if (!hasInitializedSlice.current) {
      hasInitializedSlice.current = true;
      setCurrentSlice(middle);
      syncSlices(middle);
    } else {
      setCurrentSlice((prev) => (prev > maxSlice ? maxSlice : prev));
    }
    const w = dicomVolumeA.max - dicomVolumeA.min;
    const l = (dicomVolumeA.max + dicomVolumeA.min) / 2;
    if (w > 0) {
      setWindow((prev) => (prev > 1e5 || prev < 10 ? Math.min(5000, w) : prev));
      setLevel((prev) => (prev > 1e5 ? l : prev));
    }
  }, [dicomVolumeA, dicomReady, syncSlices]);

  // Síntese clínica: mistura T1/T2/FLAIR/T1ce + curva simples guiada por TR/TE/Flip
  const computeSyntheticPixelData = useCallback(
    (
      volumeT1: DICOMVolume,
      volumeT2: DICOMVolume | null,
      volumeFlair: DICOMVolume | null,
      volumeT1ce: DICOMVolume | null,
      sliceIndex: number,
      sequence: SequenceId,
    ) => {
      const width = volumeT1.width;
      const height = volumeT1.height;
      const depth = volumeT1.depth;
      const z = Math.max(0, Math.min(depth - 1, sliceIndex));
      const sliceSize = width * height;
      const offset = z * sliceSize;

      const out = new Float32Array(sliceSize);
      const params = {
        tr: config.tr,
        te: config.te,
        ti: config.ti ?? 0,
        flipAngle: config.flipAngle,
        activeSequence: (sequence === "blend" ? activeSequence : sequence) as any,
      };

      for (let i = 0; i < sliceSize; i++) {
        out[i] = synthVoxel(offset + i, { t1: volumeT1, t2: volumeT2, flair: volumeFlair, t1ce: volumeT1ce }, params);
      }
      return out;
    },
    [config.tr, config.te, config.ti, config.flipAngle, activeSequence],
  );

  // Renderizar a fatia fundida atual no canvas 2D com Window/Level + overlay de segmentação (se disponível)
  useEffect(() => {
    if (!canvasRef.current || !dicomVolumeA || !dicomReady) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = dicomVolumeA.width;
    const height = dicomVolumeA.height;
    canvas.width = width;
    canvas.height = height;

    const fused = computeSyntheticPixelData(
      dicomVolumeA,
      dicomVolumeB,
      dicomVolumeFlair ?? null,
      dicomVolumeT1ce ?? null,
      currentSlice,
      activeSequence,
    );
    lastFusedRef.current = fused;

    const ww = window || 2000;
    const wl = level || 1000;
    const low = wl - ww / 2;
    const high = wl + ww / 2;
    const range = high - low || 1;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Se tivermos volume de segmentação compatível, usar para overlay
    let segSlice: Float32Array | Int16Array | null = null;
    if (
      showSegmentation &&
      segmentationVolume &&
      segmentationVolume.width === width &&
      segmentationVolume.height === height &&
      segmentationVolume.depth === dicomVolumeA.depth
    ) {
      const sliceSize = width * height;
      const offset = Math.max(0, Math.min(segmentationVolume.depth - 1, currentSlice)) * sliceSize;
      const segVoxels = segmentationVolume.voxels;
      // Criar uma view da fatia atual sem copiar todos os dados
      if (segVoxels instanceof Float32Array) {
        segSlice = segVoxels.subarray(offset, offset + sliceSize);
      } else {
        segSlice = segVoxels.subarray(offset, offset + sliceSize) as Int16Array;
      }
    }

    for (let i = 0; i < fused.length; i++) {
      let v = (fused[i] - low) / range;
      v = Math.max(0, Math.min(1, v));
      let r = Math.round(v * 255);
      let g = r;
      let b = r;

      // Overlay da segmentação (gabarito BraTS): contorno suave, não mancha sólida
      if (segSlice && segSlice[i] > 0) {
        const alpha = 0.28; // overlay discreto para não tapar a anatomia
        const overlayR = 255;
        const overlayG = 100;
        const overlayB = 120; // vermelho-magenta suave, padrão em PACS
        r = Math.round(r * (1 - alpha) + overlayR * alpha);
        g = Math.round(g * (1 - alpha) + overlayG * alpha);
        b = Math.round(b * (1 - alpha) + overlayB * alpha);
      }

      const idx = i * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
  }, [
    dicomVolumeA,
    dicomVolumeB,
    dicomReady,
    currentSlice,
    blendFactor,
    window,
    level,
    computeSyntheticPixelData,
    segmentationVolume,
    showSegmentation,
  ]);

  // Helpers para converter coordenadas de tela -> pixel de imagem
  const getImageCoords = useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (!canvasRef.current || !dicomVolumeA) return null;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const imgW = dicomVolumeA.width;
      const imgH = dicomVolumeA.height;
      const scaleX = rect.width / imgW;
      const scaleY = rect.height / imgH;
      if (scaleX === 0 || scaleY === 0) return null;
      const ix = (x / scaleX);
      const iy = (y / scaleY);
      if (ix < 0 || iy < 0 || ix >= imgW || iy >= imgH) return null;
      return { x: ix, y: iy };
    },
    [dicomVolumeA],
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (activeTool !== "length" && activeTool !== "roi") return;
      const imgPt = getImageCoords(event);
      if (!imgPt) return;
      setIsDrawing(true);
      setStartPoint(imgPt);
      setCurrentPoint(imgPt);
      // limpar resultado anterior ao iniciar novo desenho
      if (activeTool === "length") {
        setLastDistanceMm(null);
      } else if (activeTool === "roi") {
        setLastRoiStats(null);
      }
    },
    [activeTool, getImageCoords],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (!isDrawing || !startPoint) return;
      const imgPt = getImageCoords(event);
      if (!imgPt) return;
      setCurrentPoint(imgPt);
    },
    [isDrawing, startPoint, getImageCoords],
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (!isDrawing || !startPoint || !dicomVolumeA) return;
      const imgPt = getImageCoords(event);
      const endPoint = imgPt || currentPoint || startPoint;
      setIsDrawing(false);
      setCurrentPoint(endPoint);

      const spacingX = dicomVolumeA.pixelSpacing?.[0] ?? 1;
      const spacingY = dicomVolumeA.pixelSpacing?.[1] ?? 1;

      if (activeTool === "length") {
        const dx = (endPoint.x - startPoint.x) * spacingX;
        const dy = (endPoint.y - startPoint.y) * spacingY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        setLastDistanceMm(dist);
      } else if (activeTool === "roi" && lastFusedRef.current) {
        const fused = lastFusedRef.current;
        const width = dicomVolumeA.width;
        const height = dicomVolumeA.height;

        const cx = (startPoint.x + endPoint.x) / 2;
        const cy = (startPoint.y + endPoint.y) / 2;
        const rx = Math.abs(endPoint.x - startPoint.x) / 2;
        const ry = Math.abs(endPoint.y - startPoint.y) / 2;

        if (rx < 1 || ry < 1) {
          setLastRoiStats(null);
        } else {
          let sum = 0;
          let count = 0;
          const minX = Math.max(0, Math.floor(cx - rx));
          const maxX = Math.min(width - 1, Math.ceil(cx + rx));
          const minY = Math.max(0, Math.floor(cy - ry));
          const maxY = Math.min(height - 1, Math.ceil(cy + ry));

          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              const normX = (x - cx) / (rx || 1);
              const normY = (y - cy) / (ry || 1);
              if (normX * normX + normY * normY <= 1) {
                const idx = y * width + x;
                sum += fused[idx];
                count++;
              }
            }
          }

          if (count > 0) {
            setLastRoiStats({ mean: sum / count, count });
          } else {
            setLastRoiStats(null);
          }
        }
      }
    },
    [isDrawing, startPoint, currentPoint, activeTool, dicomVolumeA, getImageCoords],
  );

  // Sincronizar slider de fatias com store, se desejado
  const maxSlice = dicomVolumeA
    ? Math.max(0, dicomVolumeA.depth - 1)
    : dicomSeries?.totalSlices
    ? Math.max(0, dicomSeries.totalSlices - 1)
    : 0;

  if (!dicomReady || (!dicomSeries && !dicomVolumeA)) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background min-h-[280px]">
        <div className="text-center p-4 text-muted-foreground text-sm">
          {loadingCase
            ? "Carregando caso clínico (T1/T2)..."
            : "Nenhum volume carregado. Selecione um caso clínico no painel à esquerda."}
        </div>
      </div>
    );
  }

  // Selecionar TR/TE e nome de sequência com base no caso clínico (A/B) e blendFactor
  let tr: number | string = "N/A";
  let te: number | string = "N/A";
  let sequenceName = "Encéfalo - Estudo de Ponderação";

  if (caseMetadataA || caseMetadataB) {
    const useB = blendFactor > 0.5 && caseMetadataB;
    const meta = (useB ? caseMetadataB : caseMetadataA) || caseMetadataA || caseMetadataB;
    tr = meta?.tr ?? config.tr ?? "N/A";
    te = meta?.te ?? config.te ?? "N/A";
    if (typeof meta?.seriesDescription === "string" && meta.seriesDescription.trim().length > 0) {
      sequenceName = meta.seriesDescription;
    }
  } else if (dicomSeries) {
    tr = dicomSeries?.slices?.[0]?.tr ?? config.tr ?? "N/A";
    te = dicomSeries?.slices?.[0]?.te ?? config.te ?? "N/A";
    if (dicomSeries.seriesDescription) {
      sequenceName = dicomSeries.seriesDescription;
    }
  } else if (dicomVolumeA) {
    // Volume NIfTI sem metadados: usar TR/TE dos sliders para exibir no HUD
    tr = config.tr ?? "N/A";
    te = config.te ?? "N/A";
  }

  const sliceThickness =
    dicomSeries?.sliceThickness ?? dicomVolumeA?.sliceThickness ?? "N/A";
  const patientName = sequenceName;
  const patientId = "PG-0001";

  // Transição suave (lerp) para TR/TE exibidos no HUD
  useEffect(() => {
    const targetTr = typeof tr === "number" ? tr : null;
    const targetTe = typeof te === "number" ? te : null;

    let frameId: number | null = null;
    const duration = 300; // ms
    const start = performance.now();
    const startTr = displayTr ?? targetTr ?? 0;
    const startTe = displayTe ?? targetTe ?? 0;

    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

      if (targetTr != null) {
        setDisplayTr(lerp(startTr, targetTr, t));
      }
      if (targetTe != null) {
        setDisplayTe(lerp(startTe, targetTe, t));
      }

      if (t < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    if (targetTr != null || targetTe != null) {
      frameId = requestAnimationFrame(animate);
    } else {
      setDisplayTr(null);
      setDisplayTe(null);
    }

    return () => {
      if (frameId != null) cancelAnimationFrame(frameId);
    };
  }, [tr, te]);

  return (
    <div className="w-full h-full flex flex-col bg-black/95 rounded-lg overflow-hidden">
      {/* Toolbar superior: seleção de sequência (igual ao MPR) + info WW/WL */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-black/60">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
            Sequência
          </span>
          <Button
            size="xs"
            variant={activeSequence === "t1" ? "default" : "outline"}
            className="h-6 text-[11px] px-2"
            onClick={() => applyWLPreset("brain")}
          >
            T1
          </Button>
          <Button
            size="xs"
            variant={activeSequence === "t2" ? "default" : "outline"}
            className="h-6 text-[11px] px-2"
            onClick={() => applyWLPreset("soft")}
          >
            T2
          </Button>
          <Button
            size="xs"
            variant={activeSequence === "flair" ? "default" : "outline"}
            className="h-6 text-[11px] px-2"
            onClick={() => applyWLPreset("flair_like")}
            disabled={!dicomVolumeFlair}
          >
            FLAIR
          </Button>
          <Button
            size="xs"
            variant={activeSequence === "t1ce" ? "default" : "outline"}
            className="h-6 text-[11px] px-2"
            onClick={() => applyWLPreset("bone")}
            disabled={!dicomVolumeT1ce}
          >
            T1ce
          </Button>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
          <span className="text-emerald-400/80">
            Física Híbrida Ativa (1.5T Simulated)
          </span>
          <span>WW: {window}</span>
          <span>WL: {level}</span>
        </div>
      </div>

      {/* Área principal: canvas + overlay + slider lateral */}
      <div className="flex-1 flex min-h-0" style={{ minHeight: 280 }}>
        <div
          ref={containerRef}
          className="relative flex-1 bg-black min-h-[240px]"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Canvas 2D montado por efeito; placeholder para layout */}
          <div ref={viewportElementRef} className="absolute inset-0 w-full h-full" aria-hidden />

          {/* Overlay de metadados (cantos) */}
          <DicomOverlay
            patientName={sequenceName || patientName}
            patientId={patientId}
            tr={tr}
            te={te}
            sliceIndex={currentSlice}
            totalSlices={dicomVolumeA?.depth ?? dicomSeries?.totalSlices ?? 1}
            sliceThickness={sliceThickness}
            window={window}
            level={level}
            blendFactor={blendFactor}
          />

          {/* Camada de anotações (SVG) */}
          {(activeTool === "length" || activeTool === "roi") && (startPoint || lastDistanceMm || lastRoiStats) && (
            <svg className="pointer-events-none absolute inset-0 w-full h-full">
              {startPoint && currentPoint && (
                <>
                  {/* converter coords de imagem para coords em SVG (0-1) e deixar browser escalar junto com canvas */}
                  {(() => {
                    if (!dicomVolumeA) return null;
                    const w = dicomVolumeA.width;
                    const h = dicomVolumeA.height;
                    const sx = (startPoint.x / w) * 100;
                    const sy = (startPoint.y / h) * 100;
                    const ex = (currentPoint.x / w) * 100;
                    const ey = (currentPoint.y / h) * 100;

                    if (activeTool === "length") {
                      return (
                        <>
                          <line
                            x1={`${sx}%`}
                            y1={`${sy}%`}
                            x2={`${ex}%`}
                            y2={`${ey}%`}
                            stroke="#00ffff"
                            strokeWidth={2}
                          />
                          {lastDistanceMm != null && (
                            <text
                              x={`${(sx + ex) / 2}%`}
                              y={`${(sy + ey) / 2}%`}
                              fill="#00ffff"
                              fontSize="10"
                              textAnchor="middle"
                              dy={-4}
                            >
                              {lastDistanceMm.toFixed(1)} mm
                            </text>
                          )}
                        </>
                      );
                    }

                    if (activeTool === "roi") {
                      const cx = (sx + ex) / 2;
                      const cy = (sy + ey) / 2;
                      const rx = Math.abs(ex - sx) / 2;
                      const ry = Math.abs(ey - sy) / 2;
                      return (
                        <>
                          <ellipse
                            cx={`${cx}%`}
                            cy={`${cy}%`}
                            rx={`${rx}%`}
                            ry={`${ry}%`}
                            stroke="#ffbf47"
                            strokeWidth={2}
                            fill="none"
                          />
                          {lastRoiStats && (
                            <text
                              x={`${cx}%`}
                              y={`${cy}%`}
                              fill="#ffbf47"
                              fontSize="10"
                              textAnchor="middle"
                              dy={-4}
                            >
                              μ={lastRoiStats.mean.toFixed(1)} (n={lastRoiStats.count})
                            </text>
                          )}
                        </>
                      );
                    }

                    return null;
                  })()}
                </>
              )}
            </svg>
          )}

          {/* Toolbar flutuante de ferramentas (medidas + overlay) */}
          <div className="absolute top-2 right-2 z-20 bg-black/60 border border-border/60 rounded-md p-1 flex flex-col gap-1">
            <Button
              size="icon"
              variant={activeTool === "scroll" ? "default" : "ghost"}
              className="h-7 w-7"
              onClick={() => setActiveTool("scroll")}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant={activeTool === "length" ? "default" : "ghost"}
              className="h-7 w-7"
              onClick={() => setActiveTool("length")}
            >
              <Ruler className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant={activeTool === "roi" ? "default" : "ghost"}
              className="h-7 w-7"
              onClick={() => setActiveTool("roi")}
            >
              <Circle className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant={activeTool === "wl" ? "default" : "ghost"}
              className="h-7 w-7"
              onClick={() => setActiveTool("wl")}
            >
              <SunMedium className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant={showSegmentation ? "default" : "ghost"}
              className="h-7 w-7"
              onClick={() => setShowSegmentation((v) => !v)}
              title="Mostrar/ocultar segmentação do tumor (gabarito)"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Slider lateral de fatias */}
        <div className="w-14 border-l border-border/60 flex flex-col items-center justify-center px-1 bg-black/80">
          <Label className="text-[11px] text-muted-foreground mb-1">Slice</Label>
          <Slider
            orientation="vertical"
            min={0}
            max={maxSlice}
            step={1}
            value={[currentSlice]}
            onValueChange={(vals) => {
              const v = vals[0];
              setCurrentSlice(v);
              syncSlices(v);
            }}
            className="h-40"
          />
          <div className="mt-1 text-[11px] text-muted-foreground font-mono">
            {currentSlice + 1}/{dicomVolumeA?.depth ?? dicomSeries?.totalSlices ?? 1}
          </div>
        </div>
      </div>
    </div>
  );
}