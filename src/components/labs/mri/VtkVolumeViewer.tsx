/**
 * vtk.js Volume Rendering Viewer
 * Real 3D volume rendering with transfer functions and presets
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useMRILabStore, DICOMVolume } from "@/stores/mriLabStore";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface VtkVolumeViewerProps {
  showDebug?: boolean;
}

type VolumePreset = "soft_tissue" | "bone" | "angio" | "custom";

export function VtkVolumeViewer({ showDebug = false }: VtkVolumeViewerProps) {
  const store = useMRILabStore();
  const { dicomVolume, dicomSeries, dicomReady, normalizedVolume } = store;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<VolumePreset>("soft_tissue");
  const [thresholdLow, setThresholdLow] = useState(0);
  const [thresholdHigh, setThresholdHigh] = useState(1000);
  const [globalOpacity, setGlobalOpacity] = useState(1.0);
  const [shading, setShading] = useState(true);
  
  // Initialize thresholds from volume
  useEffect(() => {
    const volume = normalizedVolume || dicomVolume;
    if (volume) {
      setThresholdLow(volume.min);
      setThresholdHigh(volume.max);
    }
  }, [normalizedVolume, dicomVolume]);
  
  // Initialize vtk.js and render volume
  useEffect(() => {
    const volume = normalizedVolume || dicomVolume;
    const isReady = normalizedVolume?.isValid || dicomReady;
    
    if (!isReady || !volume || !containerRef.current || isInitialized) return;
    
    const initVtk = async () => {
      try {
        // Dynamic import
        const vtk = await import('vtk.js');
        
        // Get container
        const container = containerRef.current!;
        
        // Create render window
        const renderWindow = vtk.Rendering.Core.vtkRenderWindow.newInstance();
        const renderer = vtk.Rendering.Core.vtkRenderer.newInstance({ background: [0.1, 0.1, 0.1] });
        renderWindow.addRenderer(renderer);
        
        // Create OpenGL render window
        const openGLRenderWindow = vtk.Rendering.OpenGL.vtkRenderWindow.newInstance();
        renderWindow.addView(openGLRenderWindow);
        
        // Set container
        openGLRenderWindow.setContainer(container);
        
        // Create interactor
        const interactor = vtk.Rendering.Core.vtkRenderWindowInteractor.newInstance();
        interactor.setView(openGLRenderWindow);
        interactor.initialize();
        interactor.bindEvents(container);
        
        // Build vtkImageData from volume (normalizedVolume ou dicomVolume)
        let width: number, height: number, depth: number;
        let voxels: Float32Array | Int16Array | Uint16Array | Uint8Array;
        let spacing: [number, number, number];
        
        if (normalizedVolume && normalizedVolume.isValid) {
          // Usar normalizedVolume (novo sistema)
          width = normalizedVolume.width;
          height = normalizedVolume.height;
          depth = normalizedVolume.depth;
          voxels = normalizedVolume.data;
          spacing = normalizedVolume.spacing;
        } else if (dicomVolume) {
          // Usar dicomVolume (sistema legado)
          width = dicomVolume.width;
          height = dicomVolume.height;
          depth = dicomVolume.depth;
          voxels = dicomVolume.voxels;
          const spacingX = dicomVolume.pixelSpacing?.[0] ?? 1.0;
          const spacingY = dicomVolume.pixelSpacing?.[1] ?? 1.0;
          const spacingZ = dicomVolume.spacingBetweenSlices ?? dicomVolume.sliceThickness ?? 1.0;
          spacing = [spacingX, spacingY, spacingZ];
        } else {
          throw new Error('No volume data available');
        }
        
        console.log('[VtkVolumeViewer] Building vtkImageData:', {
          dimensions: `${width}×${height}×${depth}`,
          spacing,
          voxelsLength: voxels.length,
          voxelsType: voxels.constructor.name,
          min: Math.min(...Array.from(voxels.slice(0, Math.min(1000, voxels.length)))),
          max: Math.max(...Array.from(voxels.slice(0, Math.min(1000, voxels.length)))),
        });
        
        const imageData = vtk.Common.DataModel.vtkImageData.newInstance();
        imageData.setDimensions([width, height, depth]);
        imageData.setSpacing(spacing);
        imageData.setOrigin([0, 0, 0]);
        
        // Create scalar array - vtk.js espera um array numérico
        const scalars = vtk.Common.Core.vtkDataArray.newInstance({
          numberOfComponents: 1,
          values: Array.from(voxels), // Converter TypedArray para Array normal
        });
        imageData.getPointData().setScalars(scalars);
        
        // Create volume mapper
        const mapper = vtk.Rendering.Core.vtkVolumeMapper.newInstance();
        mapper.setInputData(imageData);
        
        // Create volume property
        const volumeProperty = vtk.Rendering.Core.vtkVolumeProperty.newInstance();
        volumeProperty.setIndependentComponents(true);
        volumeProperty.setShade(shading);
        volumeProperty.setInterpolationTypeToLinear();
        
        // Create transfer functions
        const colorTransferFunction = vtk.Rendering.Core.vtkColorTransferFunction.newInstance();
        const opacityTransferFunction = vtk.Rendering.Core.vtkPiecewiseFunction.newInstance();
        
        // Apply preset - usar volume atual
        const volumeForPreset = normalizedVolume || dicomVolume;
        applyPreset(preset, colorTransferFunction, opacityTransferFunction, volumeForPreset);
        
        volumeProperty.setRGBTransferFunction(0, colorTransferFunction);
        volumeProperty.setScalarOpacity(0, opacityTransferFunction);
        volumeProperty.setScalarOpacityUnitDistance(0, 1.0);
        
        // Create volume
        const volume = vtk.Rendering.Core.vtkVolume.newInstance();
        volume.setMapper(mapper);
        volume.setProperty(volumeProperty);
        
        // Add to renderer
        renderer.addVolume(volume);
        
        // Reset camera
        renderer.resetCamera();
        renderWindow.render();
        
        // Store references for updates
        const vtkRefs = {
          renderWindow,
          renderer,
          volume,
          volumeProperty,
          colorTransferFunction,
          opacityTransferFunction,
          mapper,
        };
        
        (container as any).__vtkRefs = vtkRefs;
        
        setIsInitialized(true);
        setError(null);
        
        // Cleanup
        return () => {
          if (vtkRefs) {
            renderWindow.delete();
            renderer.delete();
            volume.delete();
            mapper.delete();
          }
        };
      } catch (err: any) {
        console.error("[VTK] Initialization error:", err);
        setError(`Erro ao inicializar vtk.js: ${err.message}`);
      }
    };
    
    initVtk();
  }, [normalizedVolume, dicomReady, dicomVolume, isInitialized, preset, shading]);
  
  // Apply preset to transfer functions
  const applyPreset = (
    presetType: VolumePreset,
    colorTF: any,
    opacityTF: any,
    volume: DICOMVolume
  ) => {
    const { min, max } = volume;
    const range = max - min;
    
    // Clear existing points
    colorTF.removeAllPoints();
    opacityTF.removeAllPoints();
    
    if (presetType === "soft_tissue") {
      // Soft tissue: low opacity, medium range
      const center = (min + max) / 2;
      colorTF.addRGBPoint(min, 0.0, 0.0, 0.0);
      colorTF.addRGBPoint(center - range * 0.2, 0.3, 0.3, 0.5);
      colorTF.addRGBPoint(center, 0.5, 0.5, 0.7);
      colorTF.addRGBPoint(center + range * 0.2, 0.7, 0.7, 0.9);
      colorTF.addRGBPoint(max, 1.0, 1.0, 1.0);
      
      opacityTF.addPoint(min, 0.0);
      opacityTF.addPoint(center - range * 0.3, 0.1);
      opacityTF.addPoint(center, 0.3);
      opacityTF.addPoint(center + range * 0.3, 0.2);
      opacityTF.addPoint(max, 0.1);
    } else if (presetType === "bone") {
      // Bone: high threshold, higher opacity
      const boneMin = min + range * 0.6;
      colorTF.addRGBPoint(min, 0.0, 0.0, 0.0);
      colorTF.addRGBPoint(boneMin, 0.8, 0.8, 0.8);
      colorTF.addRGBPoint(max, 1.0, 1.0, 1.0);
      
      opacityTF.addPoint(min, 0.0);
      opacityTF.addPoint(boneMin, 0.0);
      opacityTF.addPoint(boneMin + range * 0.1, 0.3);
      opacityTF.addPoint(max, 0.8);
    } else if (presetType === "angio") {
      // Angio: emphasize high signals
      const angioMin = min + range * 0.7;
      colorTF.addRGBPoint(min, 0.0, 0.0, 0.0);
      colorTF.addRGBPoint(angioMin, 0.0, 0.0, 0.0);
      colorTF.addRGBPoint(angioMin + range * 0.1, 1.0, 0.0, 0.0);
      colorTF.addRGBPoint(max, 1.0, 1.0, 0.0);
      
      opacityTF.addPoint(min, 0.0);
      opacityTF.addPoint(angioMin, 0.0);
      opacityTF.addPoint(angioMin + range * 0.05, 0.5);
      opacityTF.addPoint(max, 1.0);
    } else {
      // Custom: use threshold range
      colorTF.addRGBPoint(thresholdLow, 0.0, 0.0, 0.0);
      colorTF.addRGBPoint((thresholdLow + thresholdHigh) / 2, 0.5, 0.5, 0.5);
      colorTF.addRGBPoint(thresholdHigh, 1.0, 1.0, 1.0);
      
      opacityTF.addPoint(thresholdLow, 0.0);
      opacityTF.addPoint((thresholdLow + thresholdHigh) / 2, 0.5);
      opacityTF.addPoint(thresholdHigh, 1.0);
    }
  };
  
  // Update transfer functions when parameters change
  useEffect(() => {
    const volume = normalizedVolume || dicomVolume;
    if (!isInitialized || !containerRef.current || !volume) return;
    
    const vtkRefs = (containerRef.current as any).__vtkRefs;
    if (!vtkRefs) return;
    
    try {
      const { colorTransferFunction, opacityTransferFunction, volumeProperty, renderWindow } = vtkRefs;
      
      // Reapply preset or custom
      applyPreset(preset, colorTransferFunction, opacityTransferFunction, volume);
      
      // Apply global opacity
      if (preset === "custom") {
        opacityTransferFunction.removeAllPoints();
        opacityTransferFunction.addPoint(thresholdLow, 0.0);
        opacityTransferFunction.addPoint((thresholdLow + thresholdHigh) / 2, 0.5 * globalOpacity);
        opacityTransferFunction.addPoint(thresholdHigh, 1.0 * globalOpacity);
      } else {
        // Scale existing opacity by globalOpacity
        const points = opacityTransferFunction.getDataPointer();
        for (let i = 0; i < points.length; i += 2) {
          opacityTransferFunction.setNodeValue(i / 2, [points[i], points[i + 1] * globalOpacity]);
        }
      }
      
      // Update shading
      volumeProperty.setShade(shading);
      
      renderWindow.render();
    } catch (err) {
      console.error("[VTK] Update error:", err);
    }
  }, [isInitialized, preset, thresholdLow, thresholdHigh, globalOpacity, shading, normalizedVolume, dicomVolume]);
  
  // Reset camera
  const handleReset = useCallback(() => {
    if (!containerRef.current) return;
    const vtkRefs = (containerRef.current as any).__vtkRefs;
    if (vtkRefs?.renderer) {
      vtkRefs.renderer.resetCamera();
      vtkRefs.renderWindow.render();
    }
  }, []);
  
  const volume = normalizedVolume || dicomVolume;
  const isReady = normalizedVolume?.isValid || dicomReady;
  
  if (!isReady || !volume) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-4 text-muted-foreground">
          Nenhum volume carregado
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-4">
          <div className="text-red-500 text-sm mb-2">{error}</div>
          <div className="text-xs text-muted-foreground">
            Usando modo MPR (canvas) como fallback
          </div>
        </div>
      </div>
    );
  }
  
  if (!isInitialized) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-4 text-muted-foreground">
          Inicializando Volume Rendering...
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Viewer Container */}
      <div className="flex-1 relative bg-black overflow-hidden">
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ minHeight: '400px' }}
        />
      </div>
      
      {/* Controls */}
      <div className="border-t border-border bg-card p-4 space-y-4">
        {/* Preset */}
        <div className="space-y-2">
          <Label>Preset</Label>
          <Select value={preset} onValueChange={(v) => setPreset(v as VolumePreset)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="soft_tissue">Tecido Mole</SelectItem>
              <SelectItem value="bone">Osso</SelectItem>
              <SelectItem value="angio">Alto Contraste</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Threshold (only for custom) */}
        {preset === "custom" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Threshold Low</Label>
                <span className="text-xs text-muted-foreground">{thresholdLow.toFixed(0)}</span>
              </div>
              <Slider
                value={[thresholdLow]}
                onValueChange={(v) => setThresholdLow(v[0])}
                min={volume.min}
                max={volume.max}
                step={10}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Threshold High</Label>
                <span className="text-xs text-muted-foreground">{thresholdHigh.toFixed(0)}</span>
              </div>
              <Slider
                value={[thresholdHigh]}
                onValueChange={(v) => setThresholdHigh(v[0])}
                min={volume.min}
                max={volume.max}
                step={10}
              />
            </div>
          </div>
        )}
        
        {/* Global Opacity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Opacidade Global</Label>
            <span className="text-xs text-muted-foreground">{(globalOpacity * 100).toFixed(0)}%</span>
          </div>
          <Slider
            value={[globalOpacity]}
            onValueChange={(v) => setGlobalOpacity(v[0])}
            min={0}
            max={1}
            step={0.05}
          />
        </div>
        
        {/* Shading */}
        <div className="flex items-center justify-between">
          <Label className="text-xs">Shading (Iluminação)</Label>
          <Switch checked={shading} onCheckedChange={setShading} />
        </div>
        
        {/* Reset */}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Resetar Câmera
          </Button>
        </div>
      </div>
    </div>
  );
}
