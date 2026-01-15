/**
 * DICOM MPR Viewer (Multi-Planar Reconstruction)
 * Shows 3 orthogonal views: Axial, Sagittal, Coronal with synchronized crosshair
 */

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { useMRILabStore, DICOMVolume } from "@/stores/mriLabStore";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface DicomMPRViewerProps {
  showDebug?: boolean;
}

type ViewType = "axial" | "sagittal" | "coronal";

export function DicomMPRViewer({ showDebug = false }: DicomMPRViewerProps) {
  const { dicomVolume, dicomSeries, dicomReady } = useMRILabStore();
  
  const [axialIndex, setAxialIndex] = useState(0);
  const [sagittalIndex, setSagittalIndex] = useState(0);
  const [coronalIndex, setCoronalIndex] = useState(0);
  const [window, setWindow] = useState(2000);
  const [level, setLevel] = useState(1000);
  
  const axialCanvasRef = useRef<HTMLCanvasElement>(null);
  const sagittalCanvasRef = useRef<HTMLCanvasElement>(null);
  const coronalCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Initialize window/level from volume
  useEffect(() => {
    if (dicomVolume) {
      const defaultWindow = dicomVolume.max - dicomVolume.min;
      const defaultLevel = (dicomVolume.max + dicomVolume.min) / 2;
      setWindow(defaultWindow);
      setLevel(defaultLevel);
      
      // Initialize indices to center
      setAxialIndex(Math.floor(dicomVolume.depth / 2));
      setSagittalIndex(Math.floor(dicomVolume.width / 2));
      setCoronalIndex(Math.floor(dicomVolume.height / 2));
    }
  }, [dicomVolume]);
  
  // Generate ImageData for a slice in a given orientation
  const generateSliceImageData = useCallback((
    volume: DICOMVolume,
    viewType: ViewType,
    index: number,
    window: number,
    level: number
  ): ImageData | null => {
    const { width, height, depth, voxels } = volume;
    let sliceWidth: number;
    let sliceHeight: number;
    let imageData: ImageData;
    
    if (viewType === "axial") {
      // Axial: XY plane at Z = index
      sliceWidth = width;
      sliceHeight = height;
      imageData = new ImageData(sliceWidth, sliceHeight);
      const z = Math.max(0, Math.min(depth - 1, index));
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const volumeIndex = x + y * width + z * width * height;
          const intensity = voxels[volumeIndex];
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
          const intensity = voxels[volumeIndex];
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
          const intensity = voxels[volumeIndex];
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
  }, []);
  
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
    if (!dicomVolume || !dicomReady) return null;
    return generateSliceImageData(dicomVolume, "axial", axialIndex, window, level);
  }, [dicomVolume, axialIndex, window, level, dicomReady, generateSliceImageData]);
  
  const sagittalImageData = useMemo(() => {
    if (!dicomVolume || !dicomReady) return null;
    return generateSliceImageData(dicomVolume, "sagittal", sagittalIndex, window, level);
  }, [dicomVolume, sagittalIndex, window, level, dicomReady, generateSliceImageData]);
  
  const coronalImageData = useMemo(() => {
    if (!dicomVolume || !dicomReady) return null;
    return generateSliceImageData(dicomVolume, "coronal", coronalIndex, window, level);
  }, [dicomVolume, coronalIndex, window, level, dicomReady, generateSliceImageData]);
  
  // Render to canvas
  const renderCanvas = useCallback((
    canvas: HTMLCanvasElement | null,
    imageData: ImageData | null,
    viewType: ViewType,
    crosshairX: number,
    crosshairY: number
  ) => {
    if (!canvas || !imageData) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(imageData, 0, 0);
    
    // Draw crosshair
    ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
    ctx.lineWidth = 1;
    
    // Vertical line
    ctx.beginPath();
    ctx.moveTo(crosshairX, 0);
    ctx.lineTo(crosshairX, canvas.height);
    ctx.stroke();
    
    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(0, crosshairY);
    ctx.lineTo(canvas.width, crosshairY);
    ctx.stroke();
  }, []);
  
  // Render axial view
  useEffect(() => {
    if (!dicomVolume) return;
    renderCanvas(
      axialCanvasRef.current,
      axialImageData,
      "axial",
      sagittalIndex,
      coronalIndex
    );
  }, [axialImageData, sagittalIndex, coronalIndex, dicomVolume, renderCanvas]);
  
  // Render sagittal view
  useEffect(() => {
    if (!dicomVolume) return;
    renderCanvas(
      sagittalCanvasRef.current,
      sagittalImageData,
      "sagittal",
      axialIndex,
      coronalIndex
    );
  }, [sagittalImageData, axialIndex, coronalIndex, dicomVolume, renderCanvas]);
  
  // Render coronal view
  useEffect(() => {
    if (!dicomVolume) return;
    renderCanvas(
      coronalCanvasRef.current,
      coronalImageData,
      "coronal",
      sagittalIndex,
      axialIndex
    );
  }, [coronalImageData, sagittalIndex, axialIndex, dicomVolume, renderCanvas]);
  
  // Handle canvas click to update crosshair
  const handleCanvasClick = useCallback((
    e: React.MouseEvent<HTMLCanvasElement>,
    viewType: ViewType
  ) => {
    if (!dicomVolume) return;
    
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
    if (!dicomVolume) return;
    setAxialIndex(Math.floor(dicomVolume.depth / 2));
    setSagittalIndex(Math.floor(dicomVolume.width / 2));
    setCoronalIndex(Math.floor(dicomVolume.height / 2));
  }, [dicomVolume]);
  
  if (!dicomReady || !dicomVolume) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-4">
          <div className="text-muted-foreground text-sm">
            {dicomVolume ? "Carregando..." : "Nenhuma série DICOM carregada"}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* 3 Views Grid */}
      <div className="flex-1 grid grid-cols-2 gap-2 p-2">
        {/* Axial (top-left, larger) */}
        <div className="row-span-2 relative bg-black rounded overflow-hidden">
          <canvas
            ref={axialCanvasRef}
            className="w-full h-full cursor-crosshair"
            onClick={(e) => handleCanvasClick(e, "axial")}
            style={{ objectFit: "contain" }}
          />
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            Axial (Z = {axialIndex + 1}/{dicomVolume.depth})
          </div>
        </div>
        
        {/* Sagittal (top-right) */}
        <div className="relative bg-black rounded overflow-hidden">
          <canvas
            ref={sagittalCanvasRef}
            className="w-full h-full cursor-crosshair"
            onClick={(e) => handleCanvasClick(e, "sagittal")}
            style={{ objectFit: "contain" }}
          />
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            Sagital (X = {sagittalIndex + 1}/{dicomVolume.width})
          </div>
        </div>
        
        {/* Coronal (bottom-right) */}
        <div className="relative bg-black rounded overflow-hidden">
          <canvas
            ref={coronalCanvasRef}
            className="w-full h-full cursor-crosshair"
            onClick={(e) => handleCanvasClick(e, "coronal")}
            style={{ objectFit: "contain" }}
          />
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            Coronal (Y = {coronalIndex + 1}/{dicomVolume.height})
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
                {axialIndex + 1} / {dicomVolume.depth}
              </span>
            </div>
            <Slider
              value={[axialIndex]}
              onValueChange={(v) => setAxialIndex(v[0])}
              min={0}
              max={dicomVolume.depth - 1}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Sagital (X)</Label>
              <span className="text-sm text-muted-foreground">
                {sagittalIndex + 1} / {dicomVolume.width}
              </span>
            </div>
            <Slider
              value={[sagittalIndex]}
              onValueChange={(v) => setSagittalIndex(v[0])}
              min={0}
              max={dicomVolume.width - 1}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Coronal (Y)</Label>
              <span className="text-sm text-muted-foreground">
                {coronalIndex + 1} / {dicomVolume.height}
              </span>
            </div>
            <Slider
              value={[coronalIndex]}
              onValueChange={(v) => setCoronalIndex(v[0])}
              min={0}
              max={dicomVolume.height - 1}
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
              max={dicomVolume.max - dicomVolume.min}
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
              min={dicomVolume.min}
              max={dicomVolume.max}
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
