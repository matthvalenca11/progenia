import { useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUltrasoundLabStore } from "@/stores/ultrasoundLabStore";
import { PhysicsUltrasoundEngine } from "@/simulator/ultrasound/PhysicsUltrasoundEngine";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const UltrasoundPreview = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PhysicsUltrasoundEngine | null>(null);
  
  const {
    layers,
    inclusions,
    transducerType,
    frequency,
    depth,
    focus,
    gain,
    dynamicRange,
    mode,
    simulationFeatures,
  } = useUltrasoundLabStore();
  
  // Initialize engine
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const config = {
      layers,
      inclusions,
      transducerType,
      frequency,
      depth,
      focus,
      gain,
      dynamicRange,
      mode,
      features: simulationFeatures,
      time: 0,
    };
    
    engineRef.current = new PhysicsUltrasoundEngine(canvasRef.current, config);
    engineRef.current.start();
    
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []); // Only initialize once
  
  // Update config when state changes
  useEffect(() => {
    if (!engineRef.current) return;
    
    engineRef.current.updateConfig({
      layers,
      inclusions,
      transducerType,
      frequency,
      depth,
      focus,
      gain,
      dynamicRange,
      mode,
      features: simulationFeatures,
    });
  }, [
    layers,
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
