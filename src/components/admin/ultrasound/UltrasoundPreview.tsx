import { useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUltrasoundLabStore } from "@/stores/ultrasoundLabStore";
import { UnifiedUltrasoundEngine } from "@/simulator/ultrasound/UnifiedUltrasoundEngine";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const UltrasoundPreview = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<UnifiedUltrasoundEngine | null>(null);
  
  const {
    presetId,
    layers,
    acousticLayers,
    inclusions,
    transducerType,
    frequency,
    depth,
    focus,
    gain,
    dynamicRange,
    mode,
    simulationFeatures,
    studentControls,
  } = useUltrasoundLabStore();
  
  // Initialize engine with fallback for empty layers
  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Use layers from store, or fallback
    const effectiveLayers = layers.length > 0 ? layers : [{
      name: 'Generic Tissue',
      depthRange: [0, 1] as [number, number],
      reflectivity: 0.5,
      echogenicity: 'isoechoic' as const,
      texture: 'homogeneous' as const,
      attenuationCoeff: 0.7,
      hasFlow: false,
    }];
    
    const engine = new UnifiedUltrasoundEngine(canvasRef.current, {
      layers: effectiveLayers,
      acousticLayers: acousticLayers || [],
      inclusions: inclusions || [],
      transducerType: transducerType || 'linear',
      frequency: frequency || 7.5,
      depth: depth || 5,
      focus: focus || 2.5,
      gain: gain || 50,
      dynamicRange: dynamicRange || 60,
      tgc: [],
      mode: mode || 'b-mode',
      enablePosteriorEnhancement: simulationFeatures?.enablePosteriorEnhancement || true,
      enableAcousticShadow: simulationFeatures?.enableAcousticShadow || true,
      enableReverberation: simulationFeatures?.enableReverberation || true,
      enableSpeckle: true,
      showBeamLines: simulationFeatures?.showBeamOverlay || false,
      showDepthScale: simulationFeatures?.showDepthScale || true,
      showFocusMarker: simulationFeatures?.showFocusMarker || true,
      showLabels: simulationFeatures?.showAnatomyLabels || false,
    });
    
    engineRef.current = engine;
    engine.start();
    
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);
  
  // Update config when state changes
  useEffect(() => {
    if (!engineRef.current) return;
    
    const effectiveLayers = layers.length > 0 ? layers : [{
      name: 'Generic Tissue',
      depthRange: [0, 1] as [number, number],
      reflectivity: 0.5,
      echogenicity: 'isoechoic' as const,
      texture: 'homogeneous' as const,
      attenuationCoeff: 0.7,
      hasFlow: false,
    }];
    
    engineRef.current.updateConfig({
      layers: effectiveLayers,
      acousticLayers: acousticLayers || [],
      inclusions: inclusions || [],
      transducerType: transducerType || 'linear',
      frequency: frequency || 7.5,
      depth: depth || 5,
      focus: focus || 2.5,
      gain: gain || 50,
      dynamicRange: dynamicRange || 60,
      mode: mode || 'b-mode',
      enablePosteriorEnhancement: simulationFeatures?.enablePosteriorEnhancement || true,
      enableAcousticShadow: simulationFeatures?.enableAcousticShadow || true,
      enableReverberation: simulationFeatures?.enableReverberation || true,
      showBeamLines: simulationFeatures?.showBeamOverlay || false,
      showDepthScale: simulationFeatures?.showDepthScale || true,
      showFocusMarker: simulationFeatures?.showFocusMarker || true,
      showLabels: simulationFeatures?.showAnatomyLabels || false,
    });
  }, [
    presetId,
    layers,
    acousticLayers,
    inclusions,
    transducerType,
    frequency,
    depth,
    focus,
    gain,
    dynamicRange,
    mode,
    simulationFeatures,
  ]);
  
  const getTransducerLabel = () => {
    if (transducerType === 'linear') return 'LINEAR';
    if (transducerType === 'convex') return 'CONVEXO';
    if (transducerType === 'microconvex') return 'MICROCONVEXO';
    return 'LINEAR';
  };
  
  const getModeLabel = () => {
    if (mode === 'b-mode') return 'MODO B';
    if (mode === 'color-doppler') return 'DOPPLER COLOR';
    return 'MODO B';
  };
  
  return (
    <Card className="lg:sticky lg:top-6 lg:self-start">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Pré-visualização Live
            </CardTitle>
            <CardDescription>
              Atualização em tempo real conforme você ajusta os parâmetros
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{getTransducerLabel()}</Badge>
            <Badge variant="outline">{getModeLabel()}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-black rounded-lg overflow-hidden border border-border">
          <canvas
            ref={canvasRef}
            width={600}
            height={400}
            className="w-full h-auto"
          />
        </div>
        
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="bg-muted/50 p-2 rounded">
            <span className="text-muted-foreground">Profundidade:</span>
            <span className="ml-2 font-mono font-medium">{depth.toFixed(1)} cm</span>
          </div>
          <div className="bg-muted/50 p-2 rounded">
            <span className="text-muted-foreground">Frequência:</span>
            <span className="ml-2 font-mono font-medium">{frequency.toFixed(1)} MHz</span>
          </div>
          <div className="bg-muted/50 p-2 rounded">
            <span className="text-muted-foreground">Ganho:</span>
            <span className="ml-2 font-mono font-medium">{gain.toFixed(0)} dB</span>
          </div>
          <div className="bg-muted/50 p-2 rounded">
            <span className="text-muted-foreground">Foco:</span>
            <span className="ml-2 font-mono font-medium">{focus.toFixed(1)} cm</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
