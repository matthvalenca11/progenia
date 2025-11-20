import { useMemo, useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useUltrasoundImageEngine } from "@/hooks/useUltrasoundImageEngine";
import { UltrasoundLabConfig, DEFAULT_ULTRASOUND_CONFIG } from "@/types/ultrasound";

interface UltrasoundSimulatorProps {
  config?: UltrasoundLabConfig;
  title?: string;
  description?: string;
}

export const UltrasoundSimulator = ({
  config = DEFAULT_ULTRASOUND_CONFIG,
  title,
  description,
}: UltrasoundSimulatorProps) => {
  // Extract controls from config - support both flat and nested structure
  const controls = (config as any).controls || config;
  const { showGain = true, showDepth = true, showFrequency = true, showFocus = true } = controls;

  // Slider states (0-100 for UI)
  const [gainPercent, setGainPercent] = useState(50);
  const [depthPercent, setDepthPercent] = useState(50);
  const [freqPercent, setFreqPercent] = useState(40);
  const [focusPercent, setFocusPercent] = useState(40);

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 480 });

  // Map slider values to physical parameters
  const physicalParams = useMemo(() => {
    const intensity = 0.1 + (gainPercent / 100) * 2.4; // 0.1-2.5 W/cm²
    const depthCm = 2 + (depthPercent / 100) * 8; // 2-10 cm
    const frequencyMHz = 2 + (freqPercent / 100) * 13; // 2-15 MHz
    const focusCm = 1 + (focusPercent / 100) * (depthCm - 1); // 1 to depth

    const eraCm2 = 5;
    const timeSec = 300; // 5 min reference
    const powerW = intensity * eraCm2;
    const energyJ = powerW * timeSec;
    const doseJPerCm2 = intensity * timeSec;

    let doseLabel = "Dose baixa (< 5 J/cm²)";
    if (doseJPerCm2 >= 5 && doseJPerCm2 <= 20) doseLabel = "Dose moderada (5–20 J/cm²)";
    if (doseJPerCm2 > 20) doseLabel = "Dose alta (> 20 J/cm²)";

    return {
      intensity,
      depthCm,
      frequencyMHz,
      focusCm,
      powerW,
      energyJ,
      doseJPerCm2,
      doseLabel,
    };
  }, [gainPercent, depthPercent, freqPercent, focusPercent]);

  // Use defaults if control is hidden
  const effectiveGain = showGain ? gainPercent : 50;
  const effectiveDepth = showDepth ? physicalParams.depthCm : 6;
  const effectiveFreq = showFrequency ? physicalParams.frequencyMHz : 7.5;
  const effectiveFocus = showFocus ? physicalParams.focusCm : effectiveDepth / 2;

  // Render ultrasound image
  useUltrasoundImageEngine(
    canvasRef,
    {
      gain: effectiveGain,
      depth: effectiveDepth,
      frequency: effectiveFreq,
      focus: effectiveFocus,
      width: canvasSize.width,
      height: canvasSize.height,
      time: 0,
    },
    true
  );

  // Resize canvas to fit container
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

  // Beam animation params
  const beamWidth = 30 + (1 - freqPercent / 100) * 40;
  const waveDuration = 2.5 - (freqPercent / 100) * 1;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center">
        <h3 className="text-2xl font-bold mb-2">
          {title || "Simulador de Parâmetros de Ultrassom"}
        </h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>

      <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
        {/* LEFT: Ultrasound Console View */}
        <div className="space-y-4">
          {/* Main ultrasound screen with console-like bezel */}
          <Card className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-slate-700 p-6 shadow-2xl">
            <div className="relative bg-black/90 rounded-xl overflow-hidden border-4 border-slate-800 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
              {/* Probe head - more realistic */}
              <div
                className="absolute -top-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center"
                style={{ width: "100px" }}
              >
                {/* Cable/neck */}
                <div className="w-2 h-4 bg-gradient-to-b from-slate-400 to-slate-500 rounded-t-sm" />
                {/* Probe body */}
                <div className="w-20 h-7 bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 rounded-b-3xl shadow-2xl flex items-center justify-center border-2 border-slate-600 relative overflow-hidden">
                  {/* Gloss effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent rounded-b-3xl" />
                  <span className="text-[8px] font-bold text-slate-800 z-10 tracking-wider">LINEAR</span>
                </div>
              </div>

              {/* Scan field container with animated beams overlay */}
              <div className="relative w-full" style={{ aspectRatio: "4/3" }}>
                {/* Canvas for ultrasound image */}
                <canvas
                  ref={canvasRef}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  className="absolute inset-0 w-full h-full"
                  style={{ imageRendering: "pixelated" }}
                />

                {/* Animated beam overlays */}
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="absolute left-1/2 -translate-x-1/2 top-0 pointer-events-none rounded-b-full opacity-0"
                    style={{
                      width: `${beamWidth + i * 30}%`,
                      height: "140%",
                      border: "1.5px solid rgba(56, 189, 248, 0.25)",
                      boxShadow: `0 0 ${10 + i * 5}px rgba(56, 189, 248, 0.4)`,
                      animation: `ultraWave ${waveDuration}s ease-in-out infinite`,
                      animationDelay: `${i * (waveDuration / 3)}s`,
                    }}
                  />
                ))}

                {/* Depth scale with precise markers */}
                <div className="absolute right-2 top-0 bottom-0 flex flex-col justify-between py-3 z-10">
                  {/* Continuous depth line */}
                  <div className="absolute right-8 top-0 bottom-0 w-px bg-cyan-500/40" />
                  
                  {Array.from({ length: 11 }).map((_, i) => {
                    const d = (effectiveDepth / 10) * i;
                    const isMajor = i % 2 === 0;
                    return (
                      <div key={i} className="flex items-center gap-1 relative" style={{ marginTop: i === 0 ? 0 : -4 }}>
                        <div 
                          className={`${isMajor ? 'w-3 bg-cyan-400' : 'w-2 bg-cyan-500/60'} h-px`} 
                        />
                        {isMajor && (
                          <span className="text-[9px] text-cyan-300 font-mono font-semibold tabular-nums">
                            {d.toFixed(1)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Focus indicator marker (if focus control is shown) */}
                {showFocus && (
                  <div
                    className="absolute right-1 z-20 transition-all duration-300"
                    style={{
                      top: `${(effectiveFocus / effectiveDepth) * 100}%`,
                    }}
                  >
                    {/* Triangular marker */}
                    <div className="relative flex items-center">
                      <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[10px] border-r-cyan-400 shadow-lg shadow-cyan-400/60" />
                      <div className="ml-1 px-2 py-0.5 bg-cyan-400/90 rounded text-[8px] font-bold text-slate-900 shadow-lg">
                        FOCO
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Status bar - console-style */}
              <div className="mt-2 px-4 py-2 bg-slate-950/90 rounded-lg flex items-center justify-between text-[9px] font-mono text-slate-400 border border-slate-700/50 shadow-inner">
                <div className="flex items-center gap-4">
                  <span className="text-cyan-400 font-semibold">DEPTH: {effectiveDepth.toFixed(1)} cm</span>
                  <span className="text-cyan-400 font-semibold">FREQ: {effectiveFreq.toFixed(1)} MHz</span>
                  <span className="text-cyan-400 font-semibold">GAIN: {((effectiveGain - 50) * 0.6).toFixed(0)} dB</span>
                  {showFocus && <span className="text-cyan-400 font-semibold">FOCUS: {effectiveFocus.toFixed(1)} cm</span>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/40 rounded text-cyan-300 font-bold">
                    B
                  </div>
                  <div className="px-2 py-1 bg-slate-800/50 border border-slate-600/40 rounded text-slate-500 cursor-not-allowed">
                    M
                  </div>
                  <div className="px-2 py-1 bg-slate-800/50 border border-slate-600/40 rounded text-slate-500 cursor-not-allowed">
                    D
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Results panel */}
          <Card className="p-4 bg-slate-50 dark:bg-slate-900">
            <h4 className="text-sm font-semibold mb-3">Cálculos Estimados</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Potência:</span>
                <span className="ml-2 font-medium">{physicalParams.powerW.toFixed(2)} W</span>
              </div>
              <div>
                <span className="text-muted-foreground">Energia (5 min):</span>
                <span className="ml-2 font-medium">{physicalParams.energyJ.toFixed(0)} J</span>
              </div>
              <div>
                <span className="text-muted-foreground">Dose:</span>
                <span className="ml-2 font-medium">
                  {physicalParams.doseJPerCm2.toFixed(1)} J/cm²
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Classificação:</span>
                <span className="ml-2 font-medium">{physicalParams.doseLabel}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT: Controls Panel */}
        <div className="space-y-4">
          <Card className="p-5 bg-slate-50 dark:bg-slate-900">
            <h4 className="text-base font-semibold mb-4">Controles do Transdutor</h4>

            <div className="space-y-6">
              {/* Gain control */}
              {showGain && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <Label className="text-sm font-medium">Ganho / Brilho</Label>
                      <p className="text-xs text-muted-foreground">Amplificação do sinal</p>
                    </div>
                    <span className="text-xs font-mono bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">
                      {physicalParams.intensity.toFixed(2)} W/cm²
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[gainPercent]}
                    onValueChange={([v]) => setGainPercent(v)}
                    className="py-2"
                  />
                </div>
              )}

              {/* Depth control */}
              {showDepth && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <Label className="text-sm font-medium">Profundidade</Label>
                      <p className="text-xs text-muted-foreground">Alcance do escaneamento</p>
                    </div>
                    <span className="text-xs font-mono bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">
                      {physicalParams.depthCm.toFixed(1)} cm
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[depthPercent]}
                    onValueChange={([v]) => setDepthPercent(v)}
                    className="py-2"
                  />
                </div>
              )}

              {/* Frequency control */}
              {showFrequency && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <Label className="text-sm font-medium">Frequência</Label>
                      <p className="text-xs text-muted-foreground">Resolução vs penetração</p>
                    </div>
                    <span className="text-xs font-mono bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">
                      {physicalParams.frequencyMHz.toFixed(1)} MHz
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[freqPercent]}
                    onValueChange={([v]) => setFreqPercent(v)}
                    className="py-2"
                  />
                </div>
              )}

              {/* Focus control */}
              {showFocus && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <Label className="text-sm font-medium">Foco</Label>
                      <p className="text-xs text-muted-foreground">Zona de maior nitidez</p>
                    </div>
                    <span className="text-xs font-mono bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">
                      {physicalParams.focusCm.toFixed(1)} cm
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[focusPercent]}
                    onValueChange={([v]) => setFocusPercent(v)}
                    className="py-2"
                  />
                </div>
              )}
            </div>
          </Card>

          <p className="text-xs text-muted-foreground px-2">
            Este simulador é um modelo didático simplificado para fins educacionais. Não substitui
            protocolos clínicos reais.
          </p>
        </div>
      </div>
    </div>
  );
};
