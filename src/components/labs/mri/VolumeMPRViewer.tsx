/**
 * Volume MPR Viewer - Multiplanar Reconstruction (Axial, Sagittal, Coronal)
 * Canvas 2D puro, simples e previsível
 */

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { useMRILabStore } from "@/stores/mriLabStore";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface VolumeMPRViewerProps {
  showDebug?: boolean;
}

export function VolumeMPRViewer({ showDebug = false }: VolumeMPRViewerProps) {
  const store = useMRILabStore();
  const { normalizedVolume, volumeLoadError, isLoadingVolume } = store;
  
  const axialCanvasRef = useRef<HTMLCanvasElement>(null);
  const sagittalCanvasRef = useRef<HTMLCanvasElement>(null);
  const coronalCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [axialIndex, setAxialIndex] = useState(0);
  const [sagittalIndex, setSagittalIndex] = useState(0);
  const [coronalIndex, setCoronalIndex] = useState(0);
  const [window, setWindow] = useState(2000);
  const [level, setLevel] = useState(1000);
  const [crosshair, setCrosshair] = useState({ x: 0, y: 0, z: 0 });

  // Inicializar valores do volume
  useEffect(() => {
    if (normalizedVolume && normalizedVolume.isValid) {
      const defaultWindow = normalizedVolume.max - normalizedVolume.min;
      const defaultLevel = (normalizedVolume.max + normalizedVolume.min) / 2;
      setWindow(defaultWindow);
      setLevel(defaultLevel);
      
      // Inicializar índices para o meio
      setAxialIndex(Math.floor(normalizedVolume.depth / 2));
      setSagittalIndex(Math.floor(normalizedVolume.width / 2));
      setCoronalIndex(Math.floor(normalizedVolume.height / 2));
      
      // Inicializar crosshair no centro
      setCrosshair({
        x: Math.floor(normalizedVolume.width / 2),
        y: Math.floor(normalizedVolume.height / 2),
        z: Math.floor(normalizedVolume.depth / 2),
      });
    }
  }, [normalizedVolume]);

  // Sincronizar crosshair com índices
  useEffect(() => {
    if (normalizedVolume) {
      setCrosshair(prev => ({
        ...prev,
        z: axialIndex,
        x: sagittalIndex,
        y: coronalIndex,
      }));
    }
  }, [axialIndex, sagittalIndex, coronalIndex, normalizedVolume]);

  // Gerar ImageData para fatia Axial (XY plane, Z = slice)
  const axialImageData = useMemo(() => {
    if (!normalizedVolume || !normalizedVolume.isValid) return null;
    
    const { width, height, data } = normalizedVolume;
    const sliceZ = Math.max(0, Math.min(normalizedVolume.depth - 1, axialIndex));
    
    const imageData = new ImageData(width, height);
    const imageDataArray = imageData.data;
    
    const windowMin = level - window / 2;
    const windowMax = level + window / 2;
    const effectiveRange = Math.max(1, windowMax - windowMin);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const volumeIndex = x + y * width + sliceZ * width * height;
        if (volumeIndex >= data.length) continue;
        
        const intensity = data[volumeIndex];
        if (isNaN(intensity) || !isFinite(intensity)) continue;
        
        let clampedIntensity = Math.max(windowMin, Math.min(windowMax, intensity));
        const normalized = (clampedIntensity - windowMin) / effectiveRange;
        const grayValue = Math.min(255, Math.max(0, Math.round(normalized * 255)));
        
        const pixelIndex = (y * width + x) * 4;
        imageDataArray[pixelIndex] = grayValue;
        imageDataArray[pixelIndex + 1] = grayValue;
        imageDataArray[pixelIndex + 2] = grayValue;
        imageDataArray[pixelIndex + 3] = 255;
      }
    }
    
    return imageData;
  }, [normalizedVolume, axialIndex, window, level]);

  // Gerar ImageData para fatia Sagittal (YZ plane, X = slice)
  const sagittalImageData = useMemo(() => {
    if (!normalizedVolume || !normalizedVolume.isValid) return null;
    
    const { width, height, depth, data } = normalizedVolume;
    const sliceX = Math.max(0, Math.min(width - 1, sagittalIndex));
    
    const imageData = new ImageData(depth, height);
    const imageDataArray = imageData.data;
    
    const windowMin = level - window / 2;
    const windowMax = level + window / 2;
    const effectiveRange = Math.max(1, windowMax - windowMin);
    
    for (let y = 0; y < height; y++) {
      for (let z = 0; z < depth; z++) {
        const volumeIndex = sliceX + y * width + z * width * height;
        if (volumeIndex >= data.length) continue;
        
        const intensity = data[volumeIndex];
        if (isNaN(intensity) || !isFinite(intensity)) continue;
        
        let clampedIntensity = Math.max(windowMin, Math.min(windowMax, intensity));
        const normalized = (clampedIntensity - windowMin) / effectiveRange;
        const grayValue = Math.min(255, Math.max(0, Math.round(normalized * 255)));
        
        const pixelIndex = (y * depth + z) * 4;
        imageDataArray[pixelIndex] = grayValue;
        imageDataArray[pixelIndex + 1] = grayValue;
        imageDataArray[pixelIndex + 2] = grayValue;
        imageDataArray[pixelIndex + 3] = 255;
      }
    }
    
    return imageData;
  }, [normalizedVolume, sagittalIndex, window, level]);

  // Gerar ImageData para fatia Coronal (XZ plane, Y = slice)
  const coronalImageData = useMemo(() => {
    if (!normalizedVolume || !normalizedVolume.isValid) return null;
    
    const { width, height, depth, data } = normalizedVolume;
    const sliceY = Math.max(0, Math.min(height - 1, coronalIndex));
    
    const imageData = new ImageData(width, depth);
    const imageDataArray = imageData.data;
    
    const windowMin = level - window / 2;
    const windowMax = level + window / 2;
    const effectiveRange = Math.max(1, windowMax - windowMin);
    
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        const volumeIndex = x + sliceY * width + z * width * height;
        if (volumeIndex >= data.length) continue;
        
        const intensity = data[volumeIndex];
        if (isNaN(intensity) || !isFinite(intensity)) continue;
        
        let clampedIntensity = Math.max(windowMin, Math.min(windowMax, intensity));
        const normalized = (clampedIntensity - windowMin) / effectiveRange;
        const grayValue = Math.min(255, Math.max(0, Math.round(normalized * 255)));
        
        const pixelIndex = (z * width + x) * 4;
        imageDataArray[pixelIndex] = grayValue;
        imageDataArray[pixelIndex + 1] = grayValue;
        imageDataArray[pixelIndex + 2] = grayValue;
        imageDataArray[pixelIndex + 3] = 255;
      }
    }
    
    return imageData;
  }, [normalizedVolume, coronalIndex, window, level]);

  // Renderizar Axial
  useEffect(() => {
    if (!axialCanvasRef.current || !axialImageData) return;
    
    const canvas = axialCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    canvas.width = axialImageData.width;
    canvas.height = axialImageData.height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(axialImageData, 0, 0);
    
    // Desenhar crosshair
    if (normalizedVolume) {
      ctx.strokeStyle = "red";
      ctx.lineWidth = 1;
      // Linha horizontal (Y do crosshair)
      ctx.beginPath();
      ctx.moveTo(0, crosshair.y);
      ctx.lineTo(canvas.width, crosshair.y);
      ctx.stroke();
      // Linha vertical (X do crosshair)
      ctx.beginPath();
      ctx.moveTo(crosshair.x, 0);
      ctx.lineTo(crosshair.x, canvas.height);
      ctx.stroke();
    }
  }, [axialImageData, crosshair, normalizedVolume]);

  // Renderizar Sagittal
  useEffect(() => {
    if (!sagittalCanvasRef.current || !sagittalImageData) return;
    
    const canvas = sagittalCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    canvas.width = sagittalImageData.width;
    canvas.height = sagittalImageData.height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(sagittalImageData, 0, 0);
    
    // Desenhar crosshair
    if (normalizedVolume) {
      ctx.strokeStyle = "red";
      ctx.lineWidth = 1;
      // Linha horizontal (Y do crosshair)
      ctx.beginPath();
      ctx.moveTo(0, crosshair.y);
      ctx.lineTo(canvas.width, crosshair.y);
      ctx.stroke();
      // Linha vertical (Z do crosshair)
      ctx.beginPath();
      ctx.moveTo(crosshair.z, 0);
      ctx.lineTo(crosshair.z, canvas.height);
      ctx.stroke();
    }
  }, [sagittalImageData, crosshair, normalizedVolume]);

  // Renderizar Coronal
  useEffect(() => {
    if (!coronalCanvasRef.current || !coronalImageData) return;
    
    const canvas = coronalCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    canvas.width = coronalImageData.width;
    canvas.height = coronalImageData.height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(coronalImageData, 0, 0);
    
    // Desenhar crosshair
    if (normalizedVolume) {
      ctx.strokeStyle = "red";
      ctx.lineWidth = 1;
      // Linha horizontal (Z do crosshair)
      ctx.beginPath();
      ctx.moveTo(0, crosshair.z);
      ctx.lineTo(canvas.width, crosshair.z);
      ctx.stroke();
      // Linha vertical (X do crosshair)
      ctx.beginPath();
      ctx.moveTo(crosshair.x, 0);
      ctx.lineTo(crosshair.x, canvas.height);
      ctx.stroke();
    }
  }, [coronalImageData, crosshair, normalizedVolume]);

  // Handlers para clicar e atualizar crosshair
  const handleAxialClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!normalizedVolume || !axialCanvasRef.current) return;
    const rect = axialCanvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (normalizedVolume.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (normalizedVolume.height / rect.height));
    setCrosshair({ ...crosshair, x, y });
    setSagittalIndex(x);
    setCoronalIndex(y);
  }, [normalizedVolume, crosshair]);

  const handleSagittalClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!normalizedVolume || !sagittalCanvasRef.current) return;
    const rect = sagittalCanvasRef.current.getBoundingClientRect();
    const z = Math.floor((e.clientX - rect.left) * (normalizedVolume.depth / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (normalizedVolume.height / rect.height));
    setCrosshair({ ...crosshair, z, y });
    setAxialIndex(z);
    setCoronalIndex(y);
  }, [normalizedVolume, crosshair]);

  const handleCoronalClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!normalizedVolume || !coronalCanvasRef.current) return;
    const rect = coronalCanvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (normalizedVolume.width / rect.width));
    const z = Math.floor((e.clientY - rect.top) * (normalizedVolume.depth / rect.height));
    setCrosshair({ ...crosshair, x, z });
    setSagittalIndex(x);
    setAxialIndex(z);
  }, [normalizedVolume, crosshair]);

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
          <div className="text-red-500 font-mono text-sm mb-2">⚠ Erro ao carregar volume</div>
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
          <div className="text-muted-foreground text-sm">Nenhum volume carregado</div>
        </div>
      </div>
    );
  }

  const maxAxial = Math.max(0, normalizedVolume.depth - 1);
  const maxSagittal = Math.max(0, normalizedVolume.width - 1);
  const maxCoronal = Math.max(0, normalizedVolume.height - 1);

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* MPR Panels */}
      <div className="flex-1 grid grid-cols-2 gap-2 p-2">
        {/* Axial */}
        <div className="relative bg-black rounded overflow-hidden">
          <div className="absolute top-2 left-2 text-white text-xs font-mono z-10 bg-black/70 px-2 py-1 rounded">
            Axial (Z = {axialIndex + 1}/{normalizedVolume.depth})
          </div>
          <canvas
            ref={axialCanvasRef}
            className="w-full h-full cursor-crosshair"
            onClick={handleAxialClick}
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        {/* Sagittal */}
        <div className="relative bg-black rounded overflow-hidden">
          <div className="absolute top-2 left-2 text-white text-xs font-mono z-10 bg-black/70 px-2 py-1 rounded">
            Sagital (X = {sagittalIndex + 1}/{normalizedVolume.width})
          </div>
          <canvas
            ref={sagittalCanvasRef}
            className="w-full h-full cursor-crosshair"
            onClick={handleSagittalClick}
            style={{ imageRendering: "pixelated" }}
          />
        </div>
      </div>

      {/* Coronal */}
      <div className="h-1/3 relative bg-black rounded overflow-hidden mx-2 mb-2">
        <div className="absolute top-2 left-2 text-white text-xs font-mono z-10 bg-black/70 px-2 py-1 rounded">
          Coronal (Y = {coronalIndex + 1}/{normalizedVolume.height})
        </div>
        <canvas
          ref={coronalCanvasRef}
          className="w-full h-full cursor-crosshair"
          onClick={handleCoronalClick}
          style={{ imageRendering: "pixelated" }}
        />
      </div>

      {/* Controls */}
      <div className="border-t border-border bg-card p-4 space-y-4">
        {/* Slice Sliders */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Axial (Z)</Label>
              <span className="text-xs text-muted-foreground">{axialIndex + 1} / {normalizedVolume.depth}</span>
            </div>
            <Slider
              value={[axialIndex]}
              onValueChange={(v) => setAxialIndex(v[0])}
              min={0}
              max={maxAxial}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Sagittal (X)</Label>
              <span className="text-xs text-muted-foreground">{sagittalIndex + 1} / {normalizedVolume.width}</span>
            </div>
            <Slider
              value={[sagittalIndex]}
              onValueChange={(v) => setSagittalIndex(v[0])}
              min={0}
              max={maxSagittal}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Coronal (Y)</Label>
              <span className="text-xs text-muted-foreground">{coronalIndex + 1} / {normalizedVolume.height}</span>
            </div>
            <Slider
              value={[coronalIndex]}
              onValueChange={(v) => setCoronalIndex(v[0])}
              min={0}
              max={maxCoronal}
              step={1}
            />
          </div>
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
              max={Math.max(1, normalizedVolume.max - normalizedVolume.min + 1)}
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
      </div>
    </div>
  );
}
