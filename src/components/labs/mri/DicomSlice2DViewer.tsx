/**
 * DICOM Slice 2D Viewer
 * Renders a single DICOM slice with window/level, zoom, and pan controls
 */

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { useMRILabStore, DICOMVolume } from "@/stores/mriLabStore";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from "lucide-react";

interface DicomSlice2DViewerProps {
  showDebug?: boolean;
}

export function DicomSlice2DViewer({ showDebug = false }: DicomSlice2DViewerProps) {
  const store = useMRILabStore();
  const { dicomVolume, dicomSeries, dicomReady, dicomError } = store;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [sliceIndex, setSliceIndex] = useState(0);
  const [window, setWindow] = useState(2000);
  const [level, setLevel] = useState(1000);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Initialize window/level from volume
  useEffect(() => {
    if (dicomVolume) {
      const defaultWindow = dicomVolume.max - dicomVolume.min;
      const defaultLevel = (dicomVolume.max + dicomVolume.min) / 2;
      setWindow(defaultWindow);
      setLevel(defaultLevel);
    }
  }, [dicomVolume]);
  
  // Clamp slice index
  const maxSlice = dicomVolume ? Math.max(0, dicomVolume.depth - 1) : 0;
  const currentSlice = Math.max(0, Math.min(maxSlice, sliceIndex));
  
  // Generate ImageData for current slice
  const sliceImageData = useMemo(() => {
    if (!dicomVolume || !dicomReady) {
      console.log("[DicomSlice2DViewer] No volume or not ready:", {
        hasVolume: !!dicomVolume,
        dicomReady,
      });
      return null;
    }
    
    const { width, height, depth, voxels, min, max } = dicomVolume;
    const sliceZ = currentSlice;
    
    console.log("[DicomSlice2DViewer] Generating ImageData:", {
      width,
      height,
      depth,
      sliceZ,
      voxelsLength: voxels.length,
      expectedVoxels: width * height * depth,
      min,
      max,
      window,
      level,
    });
    
    // Validate slice index
    if (sliceZ < 0 || sliceZ >= depth) {
      console.error("[DicomSlice2DViewer] Invalid slice index:", sliceZ, "depth:", depth);
      return null;
    }
    
    // Validate voxels array
    if (!voxels || voxels.length === 0) {
      console.error("[DicomSlice2DViewer] Voxels array is empty or null");
      return null;
    }
    
    const expectedTotalVoxels = width * height * depth;
    if (voxels.length !== expectedTotalVoxels) {
      console.warn("[DicomSlice2DViewer] Voxel count mismatch:", {
        actual: voxels.length,
        expected: expectedTotalVoxels,
      });
    }
    
    // Create ImageData
    const imageData = new ImageData(width, height);
    const data = imageData.data;
    
    // Window/Level calculation
    const windowMin = level - window / 2;
    const windowMax = level + window / 2;
    const windowRange = windowMax - windowMin;
    const epsilon = 1e-6;
    const effectiveRange = windowRange < epsilon ? epsilon : windowRange;
    
    let pixelsProcessed = 0;
    let pixelsWithData = 0;
    let minIntensity = Infinity;
    let maxIntensity = -Infinity;
    
    // Extract slice and apply window/level
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Volume index: x + y*width + z*width*height
        const volumeIndex = x + y * width + sliceZ * width * height;
        
        // Validate index
        if (volumeIndex >= voxels.length) {
          console.warn(`[DicomSlice2DViewer] Volume index ${volumeIndex} out of bounds (max: ${voxels.length - 1})`);
          continue;
        }
        
        const intensity = voxels[volumeIndex];
        
        // Check for valid number
        if (isNaN(intensity) || !isFinite(intensity)) {
          console.warn(`[DicomSlice2DViewer] Invalid intensity at index ${volumeIndex}:`, intensity);
          continue;
        }
        
        pixelsProcessed++;
        minIntensity = Math.min(minIntensity, intensity);
        maxIntensity = Math.max(maxIntensity, intensity);
        
        // Apply window/level
        let clampedIntensity = Math.max(windowMin, Math.min(windowMax, intensity));
        const normalized = (clampedIntensity - windowMin) / effectiveRange;
        const grayValue = Math.min(255, Math.max(0, Math.round(normalized * 255)));
        
        pixelsWithData++;
        
        // Set RGBA
        const pixelIndex = (y * width + x) * 4;
        data[pixelIndex] = grayValue;     // R
        data[pixelIndex + 1] = grayValue; // G
        data[pixelIndex + 2] = grayValue; // B
        data[pixelIndex + 3] = 255;       // A
      }
    }
    
    console.log("[DicomSlice2DViewer] ✅ ImageData generated:", {
      pixelsProcessed,
      pixelsWithData,
      minIntensity,
      maxIntensity,
      imageDataWidth: imageData.width,
      imageDataHeight: imageData.height,
    });
    
    return imageData;
  }, [dicomVolume, currentSlice, window, level, dicomReady]);
  
  // Render to canvas
  useEffect(() => {
    if (!canvasRef.current) {
      console.log("[DicomSlice2DViewer] No canvas ref");
      return;
    }
    
    if (!sliceImageData) {
      console.log("[DicomSlice2DViewer] No sliceImageData to render");
      return;
    }
    
    console.log("[DicomSlice2DViewer] Rendering to canvas:", {
      imageDataWidth: sliceImageData.width,
      imageDataHeight: sliceImageData.height,
      zoom,
      pan,
    });
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("[DicomSlice2DViewer] Failed to get 2D context");
      return;
    }
    
    // Set canvas size
    canvas.width = sliceImageData.width;
    canvas.height = sliceImageData.height;
    
    // Clear and draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply zoom and pan
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    
    ctx.putImageData(sliceImageData, 0, 0);
    ctx.restore();
    
    console.log("[DicomSlice2DViewer] ✅ Canvas rendered successfully");
  }, [sliceImageData, zoom, pan]);
  
  // Handle wheel scroll for slice change
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!dicomVolume) return;
    
    // Only change slice if not holding Ctrl (Ctrl+wheel = zoom)
    if (!e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      setSliceIndex((prev) => Math.max(0, Math.min(maxSlice, prev + delta)));
    }
  }, [dicomVolume, maxSlice]);
  
  // Handle zoom with Ctrl+wheel
  const handleZoomWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((prev) => Math.max(0.1, Math.min(5.0, prev + delta)));
    }
  }, []);
  
  // Handle pan drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left button
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Reset view
  const resetView = useCallback(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  }, []);
  
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
      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-black"
        onWheel={(e) => {
          handleWheel(e);
          handleZoomWheel(e);
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <canvas
          ref={canvasRef}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            display: sliceImageData ? "block" : "none",
          }}
        />
        
        {/* Overlay Info */}
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded font-mono">
          <div>Slice: {currentSlice + 1} / {dicomVolume.depth}</div>
          <div>W: {window.toFixed(0)} | L: {level.toFixed(0)}</div>
          <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
          {dicomSeries && (
            <>
              <div className="mt-1 pt-1 border-t border-white/20">
                {dicomSeries.modality} - {dicomSeries.seriesDescription}
              </div>
              {dicomVolume.pixelSpacing && (
                <div>
                  Pixel: {dicomVolume.pixelSpacing[0].toFixed(2)} × {dicomVolume.pixelSpacing[1].toFixed(2)} mm
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Controls */}
      <div className="border-t border-border bg-card p-4 space-y-4">
        {/* Slice Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Fatia</Label>
            <span className="text-sm text-muted-foreground">
              {currentSlice + 1} / {dicomVolume.depth}
            </span>
          </div>
          <Slider
            value={[currentSlice]}
            onValueChange={(v) => setSliceIndex(v[0])}
            min={0}
            max={maxSlice}
            step={1}
          />
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
        
        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <Slider
              value={[zoom]}
              onValueChange={(v) => setZoom(v[0])}
              min={0.1}
              max={5.0}
              step={0.1}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom((z) => Math.min(5.0, z + 0.1))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetView}
            title="Resetar zoom e pan"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
