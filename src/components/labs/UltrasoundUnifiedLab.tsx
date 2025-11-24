/**
 * Unified Ultrasound Lab - Uses new UnifiedUltrasoundEngine
 * Professional physics-based B-mode simulation
 */

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UnifiedUltrasoundEngine } from '@/simulator/ultrasound/UnifiedUltrasoundEngine';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

interface UltrasoundUnifiedLabProps {
  config?: any;
}

export function UltrasoundUnifiedLab({ config }: UltrasoundUnifiedLabProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<UnifiedUltrasoundEngine | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  
  // Control states - use config values directly
  const [gain, setGain] = useState(config?.gain || 50);
  const [depth, setDepth] = useState(config?.depth || 6);
  const [frequency, setFrequency] = useState(config?.frequency || 7.5);
  const [focus, setFocus] = useState(config?.focus || (config?.depth ? config.depth / 2 : 3));
  const [transducerType, setTransducerType] = useState<'linear' | 'convex' | 'microconvex'>(
    config?.transducerType || 'linear'
  );
  
  // Transducer movement state
  const [transducerPosition, setTransducerPosition] = useState(0); // -0.5 to +0.5
  
  // Initialize engine ONCE
  useEffect(() => {
    if (!canvasRef.current) return;
    
    console.log('🔧 Initializing Test Engine with config:', {
      hasLayers: !!config?.layers,
      layersCount: config?.layers?.length || 0,
      hasAcousticLayers: !!config?.acousticLayers,
      acousticLayersCount: config?.acousticLayers?.length || 0,
      hasInclusions: !!config?.inclusions,
      inclusionsCount: config?.inclusions?.length || 0,
      inclusions: config?.inclusions,
      layers: config?.layers,
      acousticLayers: config?.acousticLayers
    });
    
    const engine = new UnifiedUltrasoundEngine(canvasRef.current, {
      layers: config?.layers || [{
        name: 'Tissue',
        depthRange: [0, 1],
        reflectivity: 0.5,
        echogenicity: 'isoechoic',
        texture: 'homogeneous',
        attenuationCoeff: 0.7,
        hasFlow: false,
      }],
      acousticLayers: config?.acousticLayers || [],
      inclusions: config?.inclusions || [],
      transducerType,
      frequency,
      depth,
      focus,
      gain,
      dynamicRange: config?.dynamicRange || 60,
      tgc: [],
      mode: config?.mode || 'b-mode',
      enablePosteriorEnhancement: config?.simulationFeatures?.enablePosteriorEnhancement ?? true,
      enableAcousticShadow: config?.simulationFeatures?.enableAcousticShadow ?? true,
      enableReverberation: config?.simulationFeatures?.enableReverberation ?? true,
      enableSpeckle: true,
      showBeamLines: config?.simulationFeatures?.showBeamOverlay ?? false,
      showDepthScale: config?.simulationFeatures?.showDepthScale ?? true,
      showFocusMarker: config?.simulationFeatures?.showFocusMarker ?? true,
      showLabels: config?.simulationFeatures?.showAnatomyLabels ?? false,
    });
    
    engineRef.current = engine;
    engine.start();
    
    console.log('✅ Test Engine started and animating');
    
    return () => {
      console.log('🛑 Test Engine destroyed');
      engine.destroy();
    };
  }, []);
  
  // Update engine on control changes OR config changes
  useEffect(() => {
    if (!engineRef.current) return;
    
    console.log('🔄 Updating Test Engine config:', {
      gain,
      depth,
      frequency,
      focus,
      transducerType,
      transducerPosition,
      hasLayers: !!config?.layers,
      layersCount: config?.layers?.length || 0,
      hasAcousticLayers: !!config?.acousticLayers,
      acousticLayersCount: config?.acousticLayers?.length || 0,
      hasInclusions: !!config?.inclusions,
      inclusionsCount: config?.inclusions?.length || 0
    });
    
    // Adjust inclusion positions based on transducer movement
    const adjustedInclusions = (config?.inclusions || []).map(inclusion => ({
      ...inclusion,
      centerLateralPos: inclusion.centerLateralPos - transducerPosition
    }));
    
    engineRef.current.updateConfig({
      layers: config?.layers || [{
        name: 'Tissue',
        depthRange: [0, 1],
        reflectivity: 0.5,
        echogenicity: 'isoechoic',
        texture: 'homogeneous',
        attenuationCoeff: 0.7,
        hasFlow: false,
      }],
      acousticLayers: config?.acousticLayers || [],
      inclusions: adjustedInclusions,
      gain,
      depth,
      frequency,
      focus,
      transducerType,
      dynamicRange: config?.dynamicRange || 60,
      mode: config?.mode || 'b-mode',
      enablePosteriorEnhancement: config?.simulationFeatures?.enablePosteriorEnhancement ?? true,
      enableAcousticShadow: config?.simulationFeatures?.enableAcousticShadow ?? true,
      enableReverberation: config?.simulationFeatures?.enableReverberation ?? true,
      showBeamLines: config?.simulationFeatures?.showBeamOverlay ?? false,
      showDepthScale: config?.simulationFeatures?.showDepthScale ?? true,
      showFocusMarker: config?.simulationFeatures?.showFocusMarker ?? true,
      showLabels: config?.simulationFeatures?.showAnatomyLabels ?? false,
    });
  }, [gain, depth, frequency, focus, transducerType, transducerPosition, config]);
  
  const handlePlayPause = () => {
    if (!engineRef.current) return;
    
    if (isRunning) {
      engineRef.current.stop();
    } else {
      engineRef.current.start();
    }
    setIsRunning(!isRunning);
  };
  
  const handleReset = () => {
    setGain(config?.gain || 50);
    setDepth(config?.depth || 6);
    setFrequency(config?.frequency || 7.5);
    setFocus(config?.focus || (config?.depth ? config.depth / 2 : 3));
    setTransducerType(config?.transducerType || 'linear');
    setTransducerPosition(0);
  };
  
  const handleMoveTransducer = (direction: 'left' | 'right') => {
    const step = 0.1;
    const maxMovement = 0.5;
    
    setTransducerPosition(prev => {
      if (direction === 'left') {
        return Math.max(-maxMovement, prev - step);
      } else {
        return Math.min(maxMovement, prev + step);
      }
    });
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Canvas */}
      <div className="lg:col-span-2">
        <Card>
          <CardContent className="p-6">
            <div className="bg-black rounded-lg overflow-hidden border-2 border-border">
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
                className="w-full h-auto"
              />
            </div>
            
            {/* Movement controls - only show if enabled */}
            {config?.studentControls?.enableTransducerMovement && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleMoveTransducer('left')}
                  disabled={transducerPosition <= -0.5}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Mover Esquerda
                </Button>
                <div className="px-4 py-2 bg-muted rounded-md min-w-[100px] text-center">
                  <span className="text-xs text-muted-foreground">Posição</span>
                  <div className="font-mono text-sm font-medium">
                    {transducerPosition.toFixed(1)}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleMoveTransducer('right')}
                  disabled={transducerPosition >= 0.5}
                >
                  Mover Direita
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
            
            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-2">
                <Button
                  variant={isRunning ? "default" : "outline"}
                  size="sm"
                  onClick={handlePlayPause}
                >
                  {isRunning ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  {isRunning ? 'Pausar' : 'Iniciar'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Resetar
                </Button>
              </div>
              
              <Badge variant="outline">{transducerType.toUpperCase()}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Controls */}
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 space-y-6">
            <div>
              <Label className="mb-3 flex justify-between">
                <span>Ganho</span>
                <span className="font-mono text-sm">{gain.toFixed(0)} dB</span>
              </Label>
                <Slider
                value={[gain]}
                onValueChange={([v]) => setGain(v)}
                min={0}
                max={100}
                step={1}
                disabled={config?.studentControls?.lockGain || !config?.studentControls?.showGain}
              />
            </div>
            
            <div>
              <Label className="mb-3 flex justify-between">
                <span>Profundidade</span>
                <span className="font-mono text-sm">{depth.toFixed(1)} cm</span>
              </Label>
                <Slider
                value={[depth]}
                onValueChange={([v]) => setDepth(v)}
                min={1}
                max={15}
                step={0.5}
                disabled={config?.studentControls?.lockDepth || !config?.studentControls?.showDepth}
              />
            </div>
            
            <div>
              <Label className="mb-3 flex justify-between">
                <span>Frequência</span>
                <span className="font-mono text-sm">{frequency.toFixed(1)} MHz</span>
              </Label>
                <Slider
                value={[frequency]}
                onValueChange={([v]) => setFrequency(v)}
                min={2}
                max={15}
                step={0.5}
                disabled={config?.studentControls?.lockFrequency || !config?.studentControls?.showFrequency}
              />
            </div>
            
            <div>
              <Label className="mb-3 flex justify-between">
                <span>Foco</span>
                <span className="font-mono text-sm">{focus.toFixed(1)} cm</span>
              </Label>
                <Slider
                value={[focus]}
                onValueChange={([v]) => setFocus(v)}
                min={0.5}
                max={depth}
                step={0.1}
                disabled={config?.studentControls?.lockFocus || !config?.studentControls?.showFocus}
              />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <Label className="mb-3">Tipo de Transdutor</Label>
            <div className="grid grid-cols-1 gap-2">
              <Button
                variant={transducerType === 'linear' ? 'default' : 'outline'}
                onClick={() => setTransducerType('linear')}
                className="w-full"
              >
                Linear (5-15 MHz)
              </Button>
              <Button
                variant={transducerType === 'convex' ? 'default' : 'outline'}
                onClick={() => setTransducerType('convex')}
                className="w-full"
              >
                Convexo (2-6 MHz)
              </Button>
              <Button
                variant={transducerType === 'microconvex' ? 'default' : 'outline'}
                onClick={() => setTransducerType('microconvex')}
                className="w-full"
              >
                Microconvexo (4-10 MHz)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
