/**
 * Cornerstone3D Stack Viewer
 * Professional DICOM stack viewer with clinical tools
 * NOTE: Currently in compatibility mode due to Cornerstone3D API requirements
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
  const [currentSlice, setCurrentSlice] = useState(0);
  const [window, setWindow] = useState(2000);
  const [level, setLevel] = useState(1000);
  const [toolState, setToolState] = useState<'scroll' | 'pan' | 'zoom' | 'wl'>('scroll');
  
  // Cornerstone3D requires additional setup that is not currently available
  // This component shows a compatibility message and suggests using Canvas mode
  
  if (!dicomReady || !dicomSeries) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center p-4 text-muted-foreground">
          Nenhuma série DICOM carregada
        </div>
      </div>
    );
  }
  
  // Show compatibility message - Cornerstone3D requires additional build configuration
  return (
    <div className="w-full h-full flex items-center justify-center bg-background">
      <div className="text-center p-4">
        <div className="text-amber-500 text-sm mb-2">
          Cornerstone3D requer configuração adicional. Usando modo compatibilidade.
        </div>
        <div className="text-xs text-muted-foreground">
          O modo Cornerstone3D requer configuração adicional de WASM/Workers.
          <br />
          Use o modo "Canvas" no editor para visualização compatível.
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          <div>Série: {dicomSeries.seriesDescription || "Sem descrição"}</div>
          <div>Slices: {dicomSeries.totalSlices}</div>
          <div>Dimensões: {dicomSeries.rows} × {dicomSeries.columns}</div>
        </div>
      </div>
    </div>
  );
}