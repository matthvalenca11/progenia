/**
 * Volume 2D Viewer - Viewer robusto e confiável para fatias 2D
 * Usa Canvas 2D puro, sempre funciona quando volume existe
 */

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { useMRILabStore } from "@/stores/mriLabStore";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

interface Volume2DViewerProps {
  showDebug?: boolean;
}

export function Volume2DViewer({ showDebug = false }: Volume2DViewerProps) {
  const store = useMRILabStore();
  const { normalizedVolume, volumeLoadError, isLoadingVolume } = store;
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sliceIndex, setSliceIndex] = useState(0);
  const [window, setWindow] = useState(2000);
  const [level, setLevel] = useState(1000);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Inicializar window/level do volume
  useEffect(() => {
    if (normalizedVolume && normalizedVolume.isValid) {
      const min = normalizedVolume.min;
      const max = normalizedVolume.max;
      
      // Garantir que min < max e valores são válidos
      if (isFinite(min) && isFinite(max) && min < max) {
        const defaultWindow = max - min;
        const defaultLevel = (max + min) / 2;
        
        // Garantir valores razoáveis (não pode ser 0 ou muito pequeno)
        if (defaultWindow > 0 && isFinite(defaultWindow) && isFinite(defaultLevel)) {
          setWindow(defaultWindow);
          setLevel(defaultLevel);
        } else {
          // Fallback: usar valores padrão se cálculo falhar
          console.warn('[Volume2DViewer] Window/Level calculation failed, using defaults', { min, max, defaultWindow, defaultLevel });
          setWindow(2000);
          setLevel(1000);
        }
      } else {
        console.warn('[Volume2DViewer] Invalid min/max values', { min, max });
        setWindow(2000);
        setLevel(1000);
      }
      
      // Inicializar slice para o meio
      setSliceIndex(Math.floor(normalizedVolume.depth / 2));
    }
  }, [normalizedVolume]);

  // Clamp slice index
  const maxSlice = normalizedVolume ? Math.max(0, normalizedVolume.depth - 1) : 0;
  const currentSlice = Math.max(0, Math.min(maxSlice, sliceIndex));

  // Gerar ImageData para a fatia atual
  const sliceImageData = useMemo(() => {
    if (!normalizedVolume || !normalizedVolume.isValid) {
      console.log('[Volume2DViewer] No valid volume');
      return null;
    }

    const { width, height, data } = normalizedVolume;
    const sliceZ = currentSlice;

    console.log('[Volume2DViewer] Generating ImageData:', {
      width,
      height,
      depth: normalizedVolume.depth,
      sliceZ,
      dataLength: data.length,
      expectedTotal: width * height * normalizedVolume.depth,
      min: normalizedVolume.min,
      max: normalizedVolume.max,
      window,
      level,
      windowMin: level - window / 2,
      windowMax: level + window / 2,
    });

    // Validar slice index
    if (sliceZ < 0 || sliceZ >= normalizedVolume.depth) {
      console.error('[Volume2DViewer] Invalid slice index:', sliceZ, 'depth:', normalizedVolume.depth);
      return null;
    }

    // Criar ImageData
    const imageData = new ImageData(width, height);
    const imageDataArray = imageData.data;

    // Window/Level
    const windowMin = level - window / 2;
    const windowMax = level + window / 2;
    const windowRange = windowMax - windowMin;
    const effectiveRange = windowRange < 1e-6 ? 1 : windowRange;

    // Extrair fatia e aplicar window/level
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Volume index: x + y*width + z*width*height
        const volumeIndex = x + y * width + sliceZ * width * height;

        if (volumeIndex >= data.length) {
          console.warn(`[Volume2DViewer] Volume index ${volumeIndex} out of bounds`);
          continue;
        }

        const intensity = data[volumeIndex];

        if (isNaN(intensity) || !isFinite(intensity)) {
          // Preencher com preto se valor inválido
          const pixelIndex = (y * width + x) * 4;
          imageDataArray[pixelIndex] = 0;
          imageDataArray[pixelIndex + 1] = 0;
          imageDataArray[pixelIndex + 2] = 0;
          imageDataArray[pixelIndex + 3] = 255;
          continue;
        }

        // Aplicar window/level
        let clampedIntensity = Math.max(windowMin, Math.min(windowMax, intensity));
        const normalized = (clampedIntensity - windowMin) / effectiveRange;
        const grayValue = Math.min(255, Math.max(0, Math.round(normalized * 255)));

        // Set RGBA
        const pixelIndex = (y * width + x) * 4;
        imageDataArray[pixelIndex] = grayValue;     // R
        imageDataArray[pixelIndex + 1] = grayValue; // G
        imageDataArray[pixelIndex + 2] = grayValue; // B
        imageDataArray[pixelIndex + 3] = 255;       // A
      }
    }

    // Calcular estatísticas da fatia para debug
    let validPixels = 0;
    let minSlice = Infinity;
    let maxSlice = -Infinity;
    let sumIntensity = 0;
    const samplePixels: number[] = [];
    
    for (let i = 0; i < imageDataArray.length; i += 4) {
      const gray = imageDataArray[i];
      if (gray > 0 || gray === 0) { // Contar todos os pixels, mesmo zero
        validPixels++;
        minSlice = Math.min(minSlice, gray);
        maxSlice = Math.max(maxSlice, gray);
        sumIntensity += gray;
        if (samplePixels.length < 20) {
          samplePixels.push(gray);
        }
      }
    }
    
    const avgIntensity = validPixels > 0 ? sumIntensity / validPixels : 0;
    
    // Verificar se todos os pixels têm o mesmo valor (problema!)
    const uniqueValues = new Set(samplePixels);
    
    console.log('[Volume2DViewer] ✅ ImageData generated:', {
      sliceZ,
      validPixels,
      totalPixels: width * height,
      minGray: minSlice === Infinity ? 'N/A' : minSlice,
      maxGray: maxSlice === -Infinity ? 'N/A' : maxSlice,
      avgGray: avgIntensity.toFixed(2),
      uniqueValues: uniqueValues.size,
      samplePixels: samplePixels.slice(0, 10),
      window,
      level,
      windowMin: level - window / 2,
      windowMax: level + window / 2,
      volumeMin: normalizedVolume.min,
      volumeMax: normalizedVolume.max,
      dataSample: Array.from(data.slice(sliceZ * width * height, sliceZ * width * height + 10)),
    });
    
    if (uniqueValues.size === 1 && samplePixels[0] === 0) {
      console.warn('[Volume2DViewer] ⚠️ TODOS OS PIXELS SÃO ZERO! Verificar dados do volume.');
    }
    
    return imageData;
  }, [normalizedVolume, currentSlice, window, level]);

  // Renderizar no canvas
  useEffect(() => {
    if (!canvasRef.current || !sliceImageData) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error('[Volume2DViewer] Failed to get 2D context');
      return;
    }

    // Set canvas size
    canvas.width = sliceImageData.width;
    canvas.height = sliceImageData.height;

    // Clear and draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply zoom and pan
    ctx.save();
    ctx.translate(pan.x + canvas.width / 2, pan.y + canvas.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    ctx.putImageData(sliceImageData, 0, 0);
    ctx.restore();

    console.log('[Volume2DViewer] ✅ Canvas rendered');
  }, [sliceImageData, zoom, pan]);

  // Handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!normalizedVolume) return;
    
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((prev) => Math.max(0.1, Math.min(5.0, prev + delta)));
    } else {
      // Slice navigation
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      setSliceIndex((prev) => Math.max(0, Math.min(maxSlice, prev + delta)));
    }
  }, [normalizedVolume, maxSlice]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
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

  const resetView = useCallback(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    if (normalizedVolume) {
      const defaultWindow = normalizedVolume.max - normalizedVolume.min;
      const defaultLevel = (normalizedVolume.max + normalizedVolume.min) / 2;
      setWindow(defaultWindow);
      setLevel(defaultLevel);
    }
  }, [normalizedVolume]);

  // Estados de erro/carregamento
  if (isLoadingVolume) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-4">
          <div className="text-muted-foreground text-sm">Carregando volume...</div>
        </div>
      </div>
    );
  }

  if (volumeLoadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-4 max-w-md">
          <div className="text-red-500 font-mono text-sm mb-2">
            ⚠ Erro ao carregar volume
          </div>
          <div className="text-xs text-muted-foreground font-mono bg-red-500/10 p-2 rounded">
            {volumeLoadError}
          </div>
        </div>
      </div>
    );
  }

  if (!normalizedVolume || !normalizedVolume.isValid) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-4">
          <div className="text-muted-foreground text-sm">
            Nenhum volume carregado
          </div>
          {showDebug && normalizedVolume && (
            <div className="text-xs text-muted-foreground font-mono bg-amber-500/10 p-2 rounded mt-2">
              Volume inválido: {normalizedVolume.validationErrors?.join(', ')}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Canvas Container */}
      <div
        className="flex-1 relative overflow-hidden bg-black"
        onWheel={handleWheel}
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
          <div>Slice: {currentSlice + 1} / {normalizedVolume.depth}</div>
          <div>W: {window.toFixed(0)} | L: {level.toFixed(0)}</div>
          <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
          <div className="mt-1 pt-1 border-t border-white/20">
            {normalizedVolume.source} - {normalizedVolume.width}×{normalizedVolume.height}×{normalizedVolume.depth}
          </div>
          {normalizedVolume.spacing && (
            <div>
              Spacing: {normalizedVolume.spacing[0].toFixed(2)} × {normalizedVolume.spacing[1].toFixed(2)} × {normalizedVolume.spacing[2].toFixed(2)} mm
            </div>
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
              {currentSlice + 1} / {normalizedVolume.depth}
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
              <Label className="text-xs">Window</Label>
              <span className="text-xs text-muted-foreground">{window.toFixed(0)}</span>
            </div>
            <Slider
              value={[window]}
              onValueChange={(v) => setWindow(v[0])}
              min={1}
              max={normalizedVolume.max - normalizedVolume.min + 1}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Level</Label>
              <span className="text-xs text-muted-foreground">{level.toFixed(0)}</span>
            </div>
            <Slider
              value={[level]}
              onValueChange={(v) => setLevel(v[0])}
              min={normalizedVolume.min}
              max={normalizedVolume.max}
              step={1}
            />
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.max(0.1, z / 1.2))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.min(5.0, z * 1.2))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={resetView}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
