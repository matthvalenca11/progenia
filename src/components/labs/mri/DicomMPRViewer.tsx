/**
 * DICOM MPR Viewer (Multi-Planar Reconstruction)
 * Shows 3 orthogonal views: Axial, Sagittal, Coronal with synchronized crosshair
 */

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { useMRILabStore, DICOMVolume } from "@/stores/mriLabStore";
import { synthVoxel } from "@/lib/mri/sequenceSynth";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface DicomMPRViewerProps {
  showDebug?: boolean;
}

type ViewType = "axial" | "sagittal" | "coronal";
type MprSequenceId = "t1" | "t2" | "flair" | "t1ce";

export function DicomMPRViewer({ showDebug = false }: DicomMPRViewerProps) {
  const {
    dicomVolume,
    dicomVolumeA,
    dicomVolumeB,
    dicomVolumeFlair,
    dicomVolumeT1ce,
    dicomSeries,
    dicomReady,
    activeSequence = "t1",
    setActiveSequence,
    mprAxialRotation = 0,
    mprSagittalRotation = 0,
    mprCoronalRotation = 0,
    setMprRotations,
    config,
    updateConfig,
  } = useMRILabStore();
  
  const [axialIndex, setAxialIndex] = useState(0);
  const [sagittalIndex, setSagittalIndex] = useState(0);
  const [coronalIndex, setCoronalIndex] = useState(0);
  const [window, setWindow] = useState(2000);
  const [level, setLevel] = useState(1000);
  // Estados locais inicializados a partir do store, mas persistidos via setMprRotations
  const [axialRotation, setAxialRotation] = useState(mprAxialRotation);
  const [sagittalRotation, setSagittalRotation] = useState(mprSagittalRotation);
  const [coronalRotation, setCoronalRotation] = useState(mprCoronalRotation);
  
  const axialCanvasRef = useRef<HTMLCanvasElement>(null);
  const sagittalCanvasRef = useRef<HTMLCanvasElement>(null);
  const coronalCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Escolher volume atual de acordo com a sequência
  const currentVolume: DICOMVolume | null = useMemo(() => {
    switch (activeSequence) {
      case "t2":
        return dicomVolumeB || dicomVolumeA || dicomVolume;
      case "flair":
        return dicomVolumeFlair || dicomVolumeB || dicomVolumeA || dicomVolume;
      case "t1ce":
        return dicomVolumeT1ce || dicomVolumeA || dicomVolume;
      case "t1":
      default:
        return dicomVolumeA || dicomVolume || dicomVolumeB || dicomVolumeFlair || dicomVolumeT1ce || null;
    }
  }, [activeSequence, dicomVolume, dicomVolumeA, dicomVolumeB, dicomVolumeFlair, dicomVolumeT1ce]);

  // Initialize window/level from current volume
  useEffect(() => {
    if (currentVolume) {
      const defaultWindow = currentVolume.max - currentVolume.min;
      const defaultLevel = (currentVolume.max + currentVolume.min) / 2;
      setWindow(defaultWindow);
      setLevel(defaultLevel);
      
      // Initialize indices to center
      setAxialIndex(Math.floor(currentVolume.depth / 2));
      setSagittalIndex(Math.floor(currentVolume.width / 2));
      setCoronalIndex(Math.floor(currentVolume.height / 2));
    }
  }, [currentVolume]);

  // Sincronizar rotações locais com o store (para restaurar após trocar de aba)
  useEffect(() => {
    setAxialRotation(mprAxialRotation);
  }, [mprAxialRotation]);

  useEffect(() => {
    setSagittalRotation(mprSagittalRotation);
  }, [mprSagittalRotation]);

  useEffect(() => {
    setCoronalRotation(mprCoronalRotation);
  }, [mprCoronalRotation]);
  
  // Generate ImageData for a slice in a given orientation
  const generateSliceImageData = useCallback((
    volume: DICOMVolume,
    viewType: ViewType,
    index: number,
    window: number,
    level: number
  ): ImageData | null => {
    const { width, height, depth } = volume;
    let sliceWidth: number;
    let sliceHeight: number;
    let imageData: ImageData;

    const vols = {
      t1: dicomVolumeA || dicomVolume || null,
      t2: dicomVolumeB || null,
      flair: dicomVolumeFlair || null,
      t1ce: dicomVolumeT1ce || null,
    };
    const params = {
      tr: config.tr,
      te: config.te,
      ti: config.ti ?? 0,
      flipAngle: config.flipAngle,
      activeSequence,
    };
    
    if (viewType === "axial") {
      // Axial: XY plane at Z = index
      sliceWidth = width;
      sliceHeight = height;
      imageData = new ImageData(sliceWidth, sliceHeight);
      const z = Math.max(0, Math.min(depth - 1, index));
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const volumeIndex = x + y * width + z * width * height;
          const intensity = synthVoxel(volumeIndex, vols as any, params as any);
          const pixelIndex = (y * width + x) * 4;
          const grayValue = applyWindowLevel(intensity, window, level);
          imageData.data[pixelIndex] = grayValue;
          imageData.data[pixelIndex + 1] = grayValue;
          imageData.data[pixelIndex + 2] = grayValue;
          imageData.data[pixelIndex + 3] = 255;
        }
      }
    } else if (viewType === "sagittal") {
      // Sagittal: YZ plane at X = index
      sliceWidth = depth;
      sliceHeight = height;
      imageData = new ImageData(sliceWidth, sliceHeight);
      const x = Math.max(0, Math.min(width - 1, index));
      
      for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
          const volumeIndex = x + y * width + z * width * height;
          const intensity = synthVoxel(volumeIndex, vols as any, params as any);
          const pixelIndex = (y * sliceWidth + z) * 4;
          const grayValue = applyWindowLevel(intensity, window, level);
          imageData.data[pixelIndex] = grayValue;
          imageData.data[pixelIndex + 1] = grayValue;
          imageData.data[pixelIndex + 2] = grayValue;
          imageData.data[pixelIndex + 3] = 255;
        }
      }
    } else {
      // Coronal: XZ plane at Y = index
      sliceWidth = width;
      sliceHeight = depth;
      imageData = new ImageData(sliceWidth, sliceHeight);
      const y = Math.max(0, Math.min(height - 1, index));
      
      for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
          const volumeIndex = x + y * width + z * width * height;
          const intensity = synthVoxel(volumeIndex, vols as any, params as any);
          const pixelIndex = (z * sliceWidth + x) * 4;
          const grayValue = applyWindowLevel(intensity, window, level);
          imageData.data[pixelIndex] = grayValue;
          imageData.data[pixelIndex + 1] = grayValue;
          imageData.data[pixelIndex + 2] = grayValue;
          imageData.data[pixelIndex + 3] = 255;
        }
      }
    }
    
    return imageData;
  }, [
    dicomVolume,
    dicomVolumeA,
    dicomVolumeB,
    dicomVolumeFlair,
    dicomVolumeT1ce,
    config.tr,
    config.te,
    config.ti,
    config.flipAngle,
    activeSequence,
  ]);
  
  // Apply window/level to intensity
  const applyWindowLevel = (intensity: number, window: number, level: number): number => {
    const windowMin = level - window / 2;
    const windowMax = level + window / 2;
    const windowRange = windowMax - windowMin;
    const epsilon = 1e-6;
    const effectiveRange = windowRange < epsilon ? epsilon : windowRange;
    
    const clamped = Math.max(windowMin, Math.min(windowMax, intensity));
    const normalized = (clamped - windowMin) / effectiveRange;
    return Math.min(255, Math.max(0, Math.round(normalized * 255)));
  };
  
  // Generate ImageData for each view
  const axialImageData = useMemo(() => {
    if (!currentVolume || !dicomReady) return null;
    return generateSliceImageData(currentVolume, "axial", axialIndex, window, level);
  }, [currentVolume, axialIndex, window, level, dicomReady, generateSliceImageData]);
  
  const sagittalImageData = useMemo(() => {
    if (!currentVolume || !dicomReady) return null;
    return generateSliceImageData(currentVolume, "sagittal", sagittalIndex, window, level);
  }, [currentVolume, sagittalIndex, window, level, dicomReady, generateSliceImageData]);
  
  const coronalImageData = useMemo(() => {
    if (!currentVolume || !dicomReady) return null;
    return generateSliceImageData(currentVolume, "coronal", coronalIndex, window, level);
  }, [currentVolume, coronalIndex, window, level, dicomReady, generateSliceImageData]);
  
  // Render to canvas
  const renderCanvas = useCallback((
    canvas: HTMLCanvasElement | null,
    imageData: ImageData | null,
    viewType: ViewType,
    crosshairX: number,
    crosshairY: number,
    rotationDegrees: number
  ) => {
    if (!canvas || !imageData) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const imgW = imageData.width;
    const imgH = imageData.height;
    const angleRad = ((rotationDegrees % 360) * Math.PI) / 180;
    const rotated90 = Math.abs(rotationDegrees % 180) === 90;

    // Ajustar tamanho do canvas para rotações de 90/270°
    canvas.width = rotated90 ? imgH : imgW;
    canvas.height = rotated90 ? imgW : imgH;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Desenhar a imagem rotacionada usando um canvas offscreen
    const offscreen = document.createElement("canvas");
    offscreen.width = imgW;
    offscreen.height = imgH;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;
    offCtx.putImageData(imageData, 0, 0);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(angleRad);
    ctx.drawImage(offscreen, -imgW / 2, -imgH / 2);

    // Desenhar o crosshair no mesmo sistema de coordenadas da imagem
    const xRel = crosshairX - imgW / 2;
    const yRel = crosshairY - imgH / 2;

    ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
    ctx.lineWidth = 1;

    // Linha vertical
    ctx.beginPath();
    ctx.moveTo(xRel, -imgH / 2);
    ctx.lineTo(xRel, imgH / 2);
    ctx.stroke();

    // Linha horizontal
    ctx.beginPath();
    ctx.moveTo(-imgW / 2, yRel);
    ctx.lineTo(imgW / 2, yRel);
    ctx.stroke();

    ctx.restore();
  }, []);
  
  // Render axial view
  useEffect(() => {
    if (!currentVolume) return;
    renderCanvas(
      axialCanvasRef.current,
      axialImageData,
      "axial",
      sagittalIndex,
      coronalIndex,
      axialRotation
    );
  }, [axialImageData, sagittalIndex, coronalIndex, axialRotation, currentVolume, renderCanvas]);
  
  // Render sagittal view
  useEffect(() => {
    if (!currentVolume) return;
    renderCanvas(
      sagittalCanvasRef.current,
      sagittalImageData,
      "sagittal",
      axialIndex,
      coronalIndex,
      sagittalRotation
    );
  }, [sagittalImageData, axialIndex, coronalIndex, sagittalRotation, currentVolume, renderCanvas]);
  
  // Render coronal view
  useEffect(() => {
    if (!currentVolume) return;
    renderCanvas(
      coronalCanvasRef.current,
      coronalImageData,
      "coronal",
      sagittalIndex,
      axialIndex,
      coronalRotation
    );
  }, [coronalImageData, sagittalIndex, axialIndex, coronalRotation, currentVolume, renderCanvas]);
  
  // Handle canvas click to update crosshair
  const handleCanvasClick = useCallback((
    e: React.MouseEvent<HTMLCanvasElement>,
    viewType: ViewType
  ) => {
    if (!currentVolume || !dicomVolume) return;
    
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));
    
    if (viewType === "axial") {
      setSagittalIndex(Math.max(0, Math.min(dicomVolume.width - 1, x)));
      setCoronalIndex(Math.max(0, Math.min(dicomVolume.height - 1, y)));
    } else if (viewType === "sagittal") {
      setAxialIndex(Math.max(0, Math.min(dicomVolume.depth - 1, x)));
      setCoronalIndex(Math.max(0, Math.min(dicomVolume.height - 1, y)));
    } else {
      setSagittalIndex(Math.max(0, Math.min(dicomVolume.width - 1, x)));
      setAxialIndex(Math.max(0, Math.min(dicomVolume.depth - 1, y)));
    }
  }, [dicomVolume]);
  
  // Reset to center
  const resetToCenter = useCallback(() => {
    if (!currentVolume) return;
    setAxialIndex(Math.floor(currentVolume.depth / 2));
    setSagittalIndex(Math.floor(currentVolume.width / 2));
    setCoronalIndex(Math.floor(currentVolume.height / 2));
  }, [currentVolume]);
  
  if (!dicomReady || !currentVolume) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background min-h-[200px]">
        <div className="text-center p-4">
          <div className="text-muted-foreground text-sm">
            {dicomVolume ? "Preparando vistas MPR..." : "Nenhum volume carregado. Selecione um caso clínico no painel à esquerda."}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Toolbar de sequência (T1, T2, FLAIR, T1ce) + WW/WL */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground uppercase tracking-wide">Sequência</span>
          <Button
            size="xs"
            variant={activeSequence === "t1" ? "default" : "outline"}
            className="h-6 px-2"
            onClick={() => {
              setActiveSequence("t1");
              updateConfig({
                tr: 500,
                te: 15,
                ti: 0,
                flipAngle: 90,
                sequenceType: "spin_echo",
              } as any);
            }}
          >
            T1
          </Button>
          <Button
            size="xs"
            variant={activeSequence === "t2" ? "default" : "outline"}
            className="h-6 px-2"
            onClick={() => {
              setActiveSequence("t2");
              updateConfig({
                tr: 3000,
                te: 90,
                ti: 0,
                flipAngle: 90,
                sequenceType: "spin_echo",
              } as any);
            }}
          >
            T2
          </Button>
          <Button
            size="xs"
            variant={activeSequence === "flair" ? "default" : "outline"}
            className="h-6 px-2"
            onClick={() => {
              setActiveSequence("flair");
              updateConfig({
                tr: 9000,
                te: 120,
                ti: 2500,
                flipAngle: 90,
                sequenceType: "inversion_recovery",
              } as any);
            }}
            disabled={!dicomVolumeFlair}
          >
            FLAIR
          </Button>
          <Button
            size="xs"
            variant={activeSequence === "t1ce" ? "default" : "outline"}
            className="h-6 px-2"
            onClick={() => {
              setActiveSequence("t1ce");
              updateConfig({
                tr: 600,
                te: 15,
                ti: 0,
                flipAngle: 20,
                sequenceType: "gradient_echo",
              } as any);
            }}
            disabled={!dicomVolumeT1ce}
          >
            T1ce
          </Button>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
          <span>WW: {window.toFixed(0)}</span>
          <span>WL: {level.toFixed(0)}</span>
        </div>
      </div>
      {/* 3 Views Grid: Axial grande à esquerda; Sagital e Coronal empilhados à direita com altura garantida */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 p-2 min-h-0">
        {/* Axial (ocupa as 2 linhas da coluna esquerda) */}
        <div className="row-span-2 relative bg-black rounded overflow-hidden min-h-[200px]">
          <canvas
            ref={axialCanvasRef}
            className="w-full h-full cursor-crosshair"
            onClick={(e) => handleCanvasClick(e, "axial")}
            style={{ objectFit: "contain" }}
          />
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            Axial (Z = {axialIndex + 1}/{currentVolume.depth})
          </div>
          <div className="absolute top-2 right-2">
            <Button
              size="xs"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              onClick={() =>
                setAxialRotation((prev) => {
                  const next = (prev + 90) % 360;
                  setMprRotations({ axial: next });
                  return next;
                })
              }
            >
              ↻ 90°
            </Button>
          </div>
        </div>
        {/* Sagital (canto superior direito) */}
        <div className="relative bg-black rounded overflow-hidden min-h-[120px]">
          <canvas
            ref={sagittalCanvasRef}
            className="w-full h-full cursor-crosshair"
            onClick={(e) => handleCanvasClick(e, "sagittal")}
            style={{ objectFit: "contain" }}
          />
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            Sagital (X = {sagittalIndex + 1}/{currentVolume.width})
          </div>
          <div className="absolute top-2 right-2">
            <Button
              size="xs"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              onClick={() =>
                setSagittalRotation((prev) => {
                  const next = (prev + 90) % 360;
                  setMprRotations({ sagittal: next });
                  return next;
                })
              }
            >
              ↻ 90°
            </Button>
          </div>
        </div>
        {/* Coronal (canto inferior direito) */}
        <div className="relative bg-black rounded overflow-hidden min-h-[120px]">
          <canvas
            ref={coronalCanvasRef}
            className="w-full h-full cursor-crosshair"
            onClick={(e) => handleCanvasClick(e, "coronal")}
            style={{ objectFit: "contain" }}
          />
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            Coronal (Y = {coronalIndex + 1}/{currentVolume.height})
          </div>
          <div className="absolute top-2 right-2">
            <Button
              size="xs"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              onClick={() =>
                setCoronalRotation((prev) => {
                  const next = (prev + 90) % 360;
                  setMprRotations({ coronal: next });
                  return next;
                })
              }
            >
              ↻ 90°
            </Button>
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="border-t border-border bg-card p-4 space-y-4">
        {/* Slice Sliders */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Axial (Z)</Label>
              <span className="text-sm text-muted-foreground">
                {axialIndex + 1} / {currentVolume.depth}
              </span>
            </div>
            <Slider
              value={[axialIndex]}
              onValueChange={(v) => setAxialIndex(v[0])}
              min={0}
              max={currentVolume.depth - 1}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Sagital (X)</Label>
              <span className="text-sm text-muted-foreground">
                {sagittalIndex + 1} / {currentVolume.width}
              </span>
            </div>
            <Slider
              value={[sagittalIndex]}
              onValueChange={(v) => setSagittalIndex(v[0])}
              min={0}
              max={currentVolume.width - 1}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Coronal (Y)</Label>
              <span className="text-sm text-muted-foreground">
                {coronalIndex + 1} / {currentVolume.height}
              </span>
            </div>
            <Slider
              value={[coronalIndex]}
              onValueChange={(v) => setCoronalIndex(v[0])}
              min={0}
              max={currentVolume.height - 1}
              step={1}
            />
          </div>
        </div>
        
        {/* Window/Level */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Window</Label>
              <span className="text-sm text-muted-foreground">{window.toFixed(0)}</span>
            </div>
            <Slider
              value={[window]}
              onValueChange={(v) => setWindow(v[0])}
              min={1}
              max={currentVolume.max - currentVolume.min}
              step={10}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Level</Label>
              <span className="text-sm text-muted-foreground">{level.toFixed(0)}</span>
            </div>
            <Slider
              value={[level]}
              onValueChange={(v) => setLevel(v[0])}
              min={currentVolume.min}
              max={currentVolume.max}
              step={10}
            />
          </div>
        </div>
        
        {/* Reset Button */}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={resetToCenter}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Centralizar
          </Button>
        </div>
      </div>
    </div>
  );
}
