import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUltrasoundLabStore } from "@/stores/ultrasoundLabStore";
import { UnifiedUltrasoundEngine } from "@/simulator/ultrasound/UnifiedUltrasoundEngine";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    setTransducerType,
    setGain,
    setDepth,
    setFrequency,
    setFocus,
  } = useUltrasoundLabStore();
  
  // Local state for sliders
  const [localGain, setLocalGain] = useState(gain);
  const [localDepth, setLocalDepth] = useState(depth);
  const [localFrequency, setLocalFrequency] = useState(frequency);
  const [localFocus, setLocalFocus] = useState(focus);
  
  // Sync local state with store
  useEffect(() => {
    setLocalGain(gain);
    setLocalDepth(depth);
    setLocalFrequency(frequency);
    setLocalFocus(focus);
  }, [gain, depth, frequency, focus]);
  
  // Initialize engine once
  useEffect(() => {
    if (!canvasRef.current) return;
    
    console.log('🎬 Initializing Preview Engine');
    
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
      enablePosteriorEnhancement: simulationFeatures?.enablePosteriorEnhancement ?? true,
      enableAcousticShadow: simulationFeatures?.enableAcousticShadow ?? true,
      enableReverberation: simulationFeatures?.enableReverberation ?? true,
      enableSpeckle: true,
      showBeamLines: simulationFeatures?.showBeamOverlay ?? false,
      showDepthScale: simulationFeatures?.showDepthScale ?? true,
      showFocusMarker: simulationFeatures?.showFocusMarker ?? true,
      showLabels: simulationFeatures?.showAnatomyLabels ?? false,
    });
    
    engineRef.current = engine;
    engine.start();
    
    console.log('✅ Preview Engine started and animating');
    
    return () => {
      console.log('🛑 Preview Engine destroyed');
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
          <div className="flex gap-2 items-center">
            <Select value={transducerType} onValueChange={(value: any) => setTransducerType(value)}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="convex">Convexo</SelectItem>
                <SelectItem value="microconvex">Microconvexo</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="whitespace-nowrap">{getModeLabel()}</Badge>
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
        
        <div className="mt-4 space-y-4">
          <div>
            <Label className="mb-3 flex justify-between">
              <span>Ganho</span>
              <span className="font-mono text-sm">{localGain.toFixed(0)} dB</span>
            </Label>
            <Slider
              value={[localGain]}
              onValueChange={([v]) => {
                setLocalGain(v);
                setGain(v);
              }}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
          
          <div>
            <Label className="mb-3 flex justify-between">
              <span>Profundidade</span>
              <span className="font-mono text-sm">{localDepth.toFixed(1)} cm</span>
            </Label>
            <Slider
              value={[localDepth]}
              onValueChange={([v]) => {
                setLocalDepth(v);
                setDepth(v);
              }}
              min={1}
              max={15}
              step={0.5}
              className="w-full"
            />
          </div>
          
          <div>
            <Label className="mb-3 flex justify-between">
              <span>Frequência</span>
              <span className="font-mono text-sm">{localFrequency.toFixed(1)} MHz</span>
            </Label>
            <Slider
              value={[localFrequency]}
              onValueChange={([v]) => {
                setLocalFrequency(v);
                setFrequency(v);
              }}
              min={2}
              max={15}
              step={0.5}
              className="w-full"
            />
          </div>
          
          <div>
            <Label className="mb-3 flex justify-between">
              <span>Foco</span>
              <span className="font-mono text-sm">{localFocus.toFixed(1)} cm</span>
            </Label>
            <Slider
              value={[localFocus]}
              onValueChange={([v]) => {
                setLocalFocus(v);
                setFocus(v);
              }}
              min={0.5}
              max={localDepth}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
