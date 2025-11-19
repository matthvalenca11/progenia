import { useState, useRef, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUltrasoundEngineAdvanced } from "@/hooks/useUltrasoundEngineAdvanced";
import { useAnatomyGenerator } from "@/hooks/useAnatomyGenerator";
import { useTransducerSpecs } from "@/hooks/useTransducerSpecs";
import { 
  UltrasoundLabConfigAdvanced, 
  DEFAULT_ULTRASOUND_CONFIG_ADVANCED,
  TransducerType,
  ImagingMode,
} from "@/types/ultrasoundAdvanced";
import { Activity, Zap, Focus, Waves, SlidersHorizontal, Radio } from "lucide-react";

interface UltrasoundSimulatorAdvancedProps {
  config?: UltrasoundLabConfigAdvanced;
  title?: string;
  description?: string;
}

export const UltrasoundSimulatorAdvanced = ({
  config = DEFAULT_ULTRASOUND_CONFIG_ADVANCED,
  title,
  description,
}: UltrasoundSimulatorAdvancedProps) => {
  const {
    showGain,
    showDepth,
    showFrequency,
    showFocus,
    showTGC,
    showDynamicRange,
    showTransducerSelector,
    showModeSelector,
    presetAnatomy,
    lockGain,
    lockDepth,
    lockFrequency,
    lockTransducer,
    initialGain = 50,
    initialDepth = 6,
    initialFrequency = 7.5,
    initialTransducer = 'linear',
    initialMode = 'b-mode',
    simulationFeatures,
  } = config;

  // Simulation features with defaults
  const features = simulationFeatures || DEFAULT_ULTRASOUND_CONFIG_ADVANCED.simulationFeatures!;

  // State management
  const [gainPercent, setGainPercent] = useState(initialGain);
  const [depthPercent, setDepthPercent] = useState((initialDepth - 1) / 9 * 100);
  const [freqPercent, setFreqPercent] = useState((initialFrequency - 1) / 14 * 100);
  const [focusPercent, setFocusPercent] = useState(40);
  const [dynamicRange, setDynamicRange] = useState(60);
  const [tgcCurve, setTgcCurve] = useState<number[]>([50, 50, 50, 50, 50, 50, 50, 50]);
  const [selectedTransducer, setSelectedTransducer] = useState<TransducerType>(initialTransducer);
  const [selectedMode, setSelectedMode] = useState<ImagingMode>(initialMode);
  const [isFrozen, setIsFrozen] = useState(false);

  // Refs and hooks
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 480 });
  
  const transducerSpecs = useTransducerSpecs();
  const currentTransducer = transducerSpecs[selectedTransducer];
  const anatomyLayers = useAnatomyGenerator(presetAnatomy);

  // Map slider values to physical parameters
  const physicalParams = useMemo(() => {
    const depthCm = 1 + (depthPercent / 100) * 9; // 1-10 cm
    const frequencyMHz = currentTransducer.frequencyRange[0] + 
      (freqPercent / 100) * (currentTransducer.frequencyRange[1] - currentTransducer.frequencyRange[0]);
    const focusCm = 0.5 + (focusPercent / 100) * (depthCm - 0.5);

    return {
      depthCm,
      frequencyMHz,
      focusCm,
    };
  }, [depthPercent, freqPercent, focusPercent, currentTransducer]);

  // Effective parameters (use config or state)
  const effectiveGain = showGain ? gainPercent : initialGain;
  const effectiveDepth = showDepth ? physicalParams.depthCm : initialDepth;
  const effectiveFreq = showFrequency ? physicalParams.frequencyMHz : initialFrequency;
  const effectiveFocus = showFocus ? physicalParams.focusCm : effectiveDepth / 2;
  const effectiveTransducer = showTransducerSelector ? selectedTransducer : initialTransducer;
  
  // Get transducer display name
  const effectiveTransducerSpec = transducerSpecs[effectiveTransducer];
  const transducerDisplayName = effectiveTransducer.toUpperCase();

  // Use advanced engine
  useUltrasoundEngineAdvanced(
    canvasRef,
    {
      gain: effectiveGain,
      depth: effectiveDepth,
      frequency: effectiveFreq,
      focus: effectiveFocus,
      dynamicRange: showDynamicRange ? dynamicRange : 60,
      tgcCurve: showTGC ? tgcCurve : [50, 50, 50, 50, 50, 50, 50, 50],
      transducer: transducerSpecs[effectiveTransducer],
      mode: showModeSelector ? selectedMode : initialMode,
      width: canvasSize.width,
      height: canvasSize.height,
      time: 0,
    },
    anatomyLayers,
    !isFrozen
  );

  // Resize canvas
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current?.parentElement) {
        const rect = canvasRef.current.parentElement.getBoundingClientRect();
        setCanvasSize({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Mode badge colors
  const getModeColor = (mode: ImagingMode) => {
    switch (mode) {
      case 'b-mode': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'color-doppler': return 'bg-red-500/20 text-red-300 border-red-500/40';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center">
        <h3 className="text-2xl font-bold mb-2">
          {title || "Simulador Avançado de Ultrassom"}
        </h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        <div className="flex items-center justify-center gap-2 mt-2">
          <Badge className={getModeColor(selectedMode)}>
            {selectedMode.toUpperCase()}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {currentTransducer.name}
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-[2.5fr,1fr] gap-6">
        {/* LEFT: Ultrasound Console */}
        <div className="space-y-4">
          {/* Main Display */}
          <Card className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-slate-700 p-6 shadow-2xl">
            <div className="relative bg-black rounded-xl overflow-hidden border-4 border-slate-800 shadow-[inset_0_4px_12px_rgba(0,0,0,0.9)]">
              {/* Probe Head */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                <div className="w-2 h-5 bg-gradient-to-b from-slate-400 to-slate-500 rounded-t-sm shadow-lg" />
                <div className="w-24 h-8 bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 rounded-b-3xl shadow-2xl flex items-center justify-center border-2 border-slate-600 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/20 rounded-b-3xl" />
                  <span className="text-[9px] font-bold text-slate-800 z-10 tracking-wider uppercase">
                    {transducerDisplayName}
                  </span>
                </div>
              </div>

              {/* Scan Field */}
              <div className="relative w-full" style={{ aspectRatio: "4/3" }}>
                <canvas
                  ref={canvasRef}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  className="absolute inset-0 w-full h-full"
                  style={{ imageRendering: "auto" }}
                />

                {/* Depth Scale */}
                {features.showDepthScale && (
                  <div className="absolute right-2 top-0 bottom-0 flex flex-col justify-between py-3 z-10 pointer-events-none">
                    <div className="absolute right-8 top-0 bottom-0 w-px bg-cyan-500/30" />
                    {Array.from({ length: 11 }).map((_, i) => {
                      const d = (effectiveDepth / 10) * i;
                      const isMajor = i % 2 === 0;
                      return (
                        <div key={i} className="flex items-center gap-1 relative">
                          <div className={`${isMajor ? 'w-3 bg-cyan-400' : 'w-2 bg-cyan-500/50'} h-px`} />
                          {isMajor && (
                            <span className="text-[9px] text-cyan-300 font-mono font-semibold tabular-nums">
                              {d.toFixed(1)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Focus Indicator */}
                {showFocus && features.showFocusMarker && (
                  <div
                    className="absolute right-1 z-20 transition-all duration-300 pointer-events-none"
                    style={{ top: `${(effectiveFocus / effectiveDepth) * 100}%` }}
                  >
                    <div className="relative flex items-center">
                      <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[10px] border-r-yellow-400 shadow-lg shadow-yellow-400/60 animate-pulse" />
                      <div className="ml-1 px-2 py-0.5 bg-yellow-400/90 rounded text-[7px] font-bold text-slate-900">
                        FOCO
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Bar */}
              <div className="mt-2 px-4 py-2 bg-slate-950/95 rounded-lg flex items-center justify-between text-[9px] font-mono border border-slate-700/50 shadow-inner">
                <div className="flex items-center gap-4">
                  <span className="text-cyan-400 font-semibold">D: {effectiveDepth.toFixed(1)}cm</span>
                  <span className="text-cyan-400 font-semibold">F: {effectiveFreq.toFixed(1)}MHz</span>
                  <span className="text-cyan-400 font-semibold">G: {effectiveGain.toFixed(0)}dB</span>
                  {showFocus && <span className="text-yellow-400 font-semibold">FOC: {effectiveFocus.toFixed(1)}cm</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={isFrozen ? "default" : "outline"}
                    className="h-5 px-2 text-[8px]"
                    onClick={() => setIsFrozen(!isFrozen)}
                  >
                    {isFrozen ? "FROZEN" : "LIVE"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Mode Selector */}
          {showModeSelector && (
            <Card className="p-4 bg-slate-50 dark:bg-slate-900">
              <div className="grid grid-cols-2 gap-2">
                {(['b-mode', 'color-doppler'] as ImagingMode[]).map((mode) => (
                  <Button
                    key={mode}
                    variant={selectedMode === mode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedMode(mode)}
                    className="text-xs"
                  >
                    <Radio className="w-3 h-3 mr-1" />
                    {mode === 'b-mode' && 'B-Mode'}
                    {mode === 'color-doppler' && 'Doppler Color'}
                  </Button>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT: Controls */}
        <div className="space-y-4 overflow-y-auto max-h-[800px]">
          {/* Transducer Selector */}
          {showTransducerSelector && !lockTransducer && (
            <Card className="p-4 bg-slate-50 dark:bg-slate-900">
              <Label className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Transdutor
              </Label>
              <Select value={selectedTransducer} onValueChange={(v) => setSelectedTransducer(v as TransducerType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">Linear (7-18 MHz)</SelectItem>
                  <SelectItem value="convex">Convexo (2-6 MHz)</SelectItem>
                  <SelectItem value="microconvex">Microconvexo (5-10 MHz)</SelectItem>
                </SelectContent>
              </Select>
            </Card>
          )}

          {/* Main Controls */}
          <Card className="p-4 bg-slate-50 dark:bg-slate-900">
            <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Controles Principais
            </h4>

            <div className="space-y-5">
              {/* Gain */}
              {showGain && !lockGain && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      Ganho
                    </Label>
                    <span className="text-xs font-mono bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {gainPercent.toFixed(0)} dB
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[gainPercent]}
                    onValueChange={([v]) => setGainPercent(v)}
                  />
                </div>
              )}

              {/* Depth */}
              {showDepth && !lockDepth && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-medium">Profundidade</Label>
                    <span className="text-xs font-mono bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {physicalParams.depthCm.toFixed(1)} cm
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[depthPercent]}
                    onValueChange={([v]) => setDepthPercent(v)}
                  />
                </div>
              )}

              {/* Frequency */}
              {showFrequency && !lockFrequency && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <Waves className="w-3 h-3" />
                      Frequência
                    </Label>
                    <span className="text-xs font-mono bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {physicalParams.frequencyMHz.toFixed(1)} MHz
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[freqPercent]}
                    onValueChange={([v]) => setFreqPercent(v)}
                  />
                </div>
              )}

              {/* Focus */}
              {showFocus && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <Focus className="w-3 h-3" />
                      Foco
                    </Label>
                    <span className="text-xs font-mono bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {physicalParams.focusCm.toFixed(1)} cm
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[focusPercent]}
                    onValueChange={([v]) => setFocusPercent(v)}
                  />
                </div>
              )}

              {/* Dynamic Range */}
              {showDynamicRange && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-medium">Faixa Dinâmica</Label>
                    <span className="text-xs font-mono bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {dynamicRange} dB
                    </span>
                  </div>
                  <Slider
                    min={30}
                    max={90}
                    step={5}
                    value={[dynamicRange]}
                    onValueChange={([v]) => setDynamicRange(v)}
                  />
                </div>
              )}
            </div>
          </Card>

          {/* TGC Controls */}
          {showTGC && (
            <Card className="p-4 bg-slate-50 dark:bg-slate-900">
              <h4 className="text-xs font-semibold mb-3">TGC (Compensação de Ganho)</h4>
              <div className="flex gap-2 items-center justify-between">
                {tgcCurve.map((value, index) => (
                  <div key={index} className="flex flex-col items-center gap-1">
                    <Slider
                      orientation="vertical"
                      min={0}
                      max={100}
                      step={5}
                      value={[value]}
                      onValueChange={([v]) => {
                        const newCurve = [...tgcCurve];
                        newCurve[index] = v;
                        setTgcCurve(newCurve);
                      }}
                      className="h-24"
                    />
                    <span className="text-[8px] text-muted-foreground">{index + 1}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <p className="text-[10px] text-muted-foreground px-2 leading-tight">
            Simulador avançado multimodal para fins educacionais. Não substitui equipamentos reais ou protocolos clínicos.
          </p>
        </div>
      </div>
    </div>
  );
};
