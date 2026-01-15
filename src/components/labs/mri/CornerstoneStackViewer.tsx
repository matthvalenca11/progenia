/**
 * Cornerstone3D Stack Viewer
 * Professional DICOM stack viewer with clinical tools
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useMRILabStore } from "@/stores/mriLabStore";
import { Button } from "@/components/ui/button";
import { RotateCcw, ZoomIn, ZoomOut, Move, Gauge } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface CornerstoneStackViewerProps {
  showDebug?: boolean;
}

export function CornerstoneStackViewer({ showDebug = false }: CornerstoneStackViewerProps) {
  const { dicomSeries, dicomReady } = useMRILabStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSlice, setCurrentSlice] = useState(0);
  const [window, setWindow] = useState(2000);
  const [level, setLevel] = useState(1000);
  const [toolState, setToolState] = useState<'scroll' | 'pan' | 'zoom' | 'wl'>('scroll');
  
  // Initialize Cornerstone3D
  useEffect(() => {
    if (!dicomReady || !dicomSeries || isInitialized) return;
    
    const initCornerstone = async () => {
      try {
        // Try to load Cornerstone - if it fails, show error and fallback will be used
        // Note: Cornerstone3D requires additional setup and may have build issues
        // For now, we'll show an error and let the parent component use fallback
        setError("Cornerstone3D requer configuração adicional. Usando modo compatibilidade.");
        setIsInitialized(false);
        
        // TODO: Implement proper Cornerstone3D initialization when build issues are resolved
        // This requires:
        // 1. Proper Vite config for WASM/workers
        // 2. Correct initialization sequence
        // 3. File manager setup for in-memory DICOM files
        
      } catch (err: any) {
        console.error("[Cornerstone] Initialization error:", err);
        setError(`Erro ao inicializar Cornerstone3D: ${err.message}`);
      }
    };
    
    initCornerstone();
  }, [dicomReady, dicomSeries, isInitialized]);
  
  // Render stack when ready
  useEffect(() => {
    if (!isInitialized || !containerRef.current || !dicomSeries) return;
    
    const renderStack = async () => {
      try {
        const cornerstoneCore = await import('@cornerstonejs/core');
        const cornerstoneTools = await import('@cornerstonejs/tools');
        
        const { RenderingEngine, Enums } = cornerstoneCore;
        const { StackScrollMouseWheelTool, WindowLevelTool, PanTool, ZoomTool, addTool, setToolActive, setToolPassive } = cornerstoneTools;
        
        const renderingEngineId = 'cornerstone-rendering-engine';
        const viewportId = 'cornerstone-viewport';
        
        // Create rendering engine
        const renderingEngine = new RenderingEngine(renderingEngineId);
        
        // Register tools
        addTool(StackScrollMouseWheelTool);
        addTool(WindowLevelTool);
        addTool(PanTool);
        addTool(ZoomTool);
        
        // Create viewport
        const viewportInput = {
          viewportId,
          element: containerRef.current!,
          type: Enums.ViewportType.STACK,
        };
        
        renderingEngine.createViewport(viewportInput);
        
        // Get viewport
        const viewport = renderingEngine.getViewport(viewportId);
        
        // Create imageIds from DICOM series
        const imageIds: string[] = [];
        for (const slice of dicomSeries.slices) {
          // Create object URL from file
          const url = URL.createObjectURL(slice.file);
          imageIds.push(`wadouri:${url}`);
        }
        
        // Set stack
        await viewport.setStack(imageIds, 0);
        
        // Enable tools
        setToolActive(StackScrollMouseWheelTool.toolName, { mouseButtonMask: 1 });
        
        // Render
        renderingEngine.renderViewports([viewportId]);
        
        // Update current slice on scroll
        viewport.element.addEventListener('cornerstoneimagerendered', () => {
          const currentImageIdIndex = viewport.getCurrentImageIdIndex();
          setCurrentSlice(currentImageIdIndex);
        });
        
        // Cleanup
        return () => {
          renderingEngine.destroy();
          imageIds.forEach(id => {
            const url = id.replace('wadouri:', '');
            URL.revokeObjectURL(url);
          });
        };
      } catch (err: any) {
        console.error("[Cornerstone] Render error:", err);
        setError(`Erro ao renderizar stack: ${err.message}`);
      }
    };
    
    renderStack();
  }, [isInitialized, dicomSeries]);
  
  // Handle tool selection
  const handleToolChange = useCallback(async (tool: 'scroll' | 'pan' | 'zoom' | 'wl') => {
    if (!isInitialized) return;
    
    try {
      const cornerstoneTools = await import('@cornerstonejs/tools');
      const { setToolActive, setToolPassive, StackScrollMouseWheelTool, WindowLevelTool, PanTool, ZoomTool } = cornerstoneTools;
      
      // Deactivate all tools
      setToolPassive(StackScrollMouseWheelTool.toolName);
      setToolPassive(WindowLevelTool.toolName);
      setToolPassive(PanTool.toolName);
      setToolPassive(ZoomTool.toolName);
      
      // Activate selected tool
      if (tool === 'scroll') {
        setToolActive(StackScrollMouseWheelTool.toolName, { mouseButtonMask: 1 });
      } else if (tool === 'pan') {
        setToolActive(PanTool.toolName, { mouseButtonMask: 1 });
      } else if (tool === 'zoom') {
        setToolActive(ZoomTool.toolName, { mouseButtonMask: 1 });
      } else if (tool === 'wl') {
        setToolActive(WindowLevelTool.toolName, { mouseButtonMask: 1 });
      }
      
      setToolState(tool);
    } catch (err) {
      console.error("[Cornerstone] Tool change error:", err);
    }
  }, [isInitialized]);
  
  // Reset view
  const handleReset = useCallback(async () => {
    if (!isInitialized || !containerRef.current) return;
    
    try {
      const cornerstoneCore = await import('@cornerstonejs/core');
      const { RenderingEngine } = cornerstoneCore;
      const renderingEngine = new RenderingEngine('cornerstone-rendering-engine');
      const viewport = renderingEngine.getViewport('cornerstone-viewport');
      
      if (viewport) {
        viewport.resetCamera();
        renderingEngine.renderViewports(['cornerstone-viewport']);
      }
    } catch (err) {
      console.error("[Cornerstone] Reset error:", err);
    }
  }, [isInitialized]);
  
  if (!dicomReady || !dicomSeries) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-4 text-muted-foreground">
          Nenhuma série DICOM carregada
        </div>
      </div>
    );
  }
  
  if (error) {
    // Show error but don't return null - let it render the error message
    // Parent component should handle fallback based on error state
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-4">
          <div className="text-amber-500 text-sm mb-2">{error}</div>
          <div className="text-xs text-muted-foreground">
            O modo Cornerstone3D requer configuração adicional.
            <br />
            Use o modo "Canvas" no editor para visualização compatível.
          </div>
        </div>
      </div>
    );
  }
  
  if (!isInitialized) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-4 text-muted-foreground">
          Inicializando Cornerstone3D...
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
        
        {/* Overlay Info */}
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded font-mono">
          <div>Slice: {currentSlice + 1} / {dicomSeries.totalSlices}</div>
          <div>W: {window.toFixed(0)} | L: {level.toFixed(0)}</div>
          {dicomSeries.pixelSpacing && (
            <div>
              Pixel: {dicomSeries.pixelSpacing[0].toFixed(2)} × {dicomSeries.pixelSpacing[1].toFixed(2)} mm
            </div>
          )}
        </div>
      </div>
      
      {/* Toolbar */}
      <div className="border-t border-border bg-card p-3">
        <div className="flex items-center gap-2 mb-3">
          <Label className="text-xs text-muted-foreground">Ferramentas:</Label>
          <Button
            variant={toolState === 'scroll' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleToolChange('scroll')}
            className="text-xs"
          >
            Scroll
          </Button>
          <Button
            variant={toolState === 'pan' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleToolChange('pan')}
            className="text-xs"
          >
            <Move className="h-3 w-3 mr-1" />
            Pan
          </Button>
          <Button
            variant={toolState === 'zoom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleToolChange('zoom')}
            className="text-xs"
          >
            <ZoomIn className="h-3 w-3 mr-1" />
            Zoom
          </Button>
          <Button
            variant={toolState === 'wl' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleToolChange('wl')}
            className="text-xs"
          >
            <Gauge className="h-3 w-3 mr-1" />
            W/L
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="text-xs ml-auto"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
        
        {/* Window/Level Sliders */}
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
              max={5000}
              step={10}
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
              min={-1000}
              max={3000}
              step={10}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
