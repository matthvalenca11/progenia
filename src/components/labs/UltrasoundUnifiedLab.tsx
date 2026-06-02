/**
 * Unified Ultrasound Lab
 *
 * Web / iOS: JS engine animated continuously — same as always.
 *
 * Android: JS engine in Web Worker (same visual), rendered at 4 fps to keep CPU
 * from being pegged. Sliders update the DOM label directly during drag (zero
 * React re-renders = zero main-thread blocking). Config pushed to worker only
 * on commit → one render per user interaction.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { UnifiedEngineConfig } from '@/simulator/ultrasound/UnifiedUltrasoundEngine';
import { createUltrasoundRenderer, type UltrasoundRenderer } from '@/simulator/ultrasound/UltrasoundRendererAdapter';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { getUltrasoundLabCanvasSize, isAndroidNativeLabRuntime, isNativeLabRuntime } from '@/lib/labRuntime';
import { normalizeUltrasoundLabConfig } from '@/lib/ultrasoundLabConfig';
import { labCanvasHostClass, labMobileFlexClass, labMobilePanelClass } from '@/components/labs/labMobileLayout';
import { cn } from '@/lib/utils';

interface UltrasoundUnifiedLabProps {
  config?: unknown;
}

const MIN_GAIN_DB = 40;
const MAX_GAIN_DB = 62;
const clampGain = (value: number) => Math.max(MIN_GAIN_DB, Math.min(MAX_GAIN_DB, value));

export function UltrasoundUnifiedLab({ config }: UltrasoundUnifiedLabProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const engineRef   = useRef<UltrasoundRenderer | null>(null);
  const isMobile    = useIsMobile();
  const isNative    = isNativeLabRuntime;
  const isAndroid   = isAndroidNativeLabRuntime;
  const compactLayout = isMobile || isNative;
  const canvasSize  = useMemo(() => getUltrasoundLabCanvasSize(isNative), []);

  const labConfig = useMemo(() => normalizeUltrasoundLabConfig(config), [config]);
  const { studentControls, simulationFeatures } = labConfig;

  const [isRunning, setIsRunning] = useState(true);
  const [engineReady, setEngineReady] = useState(false);

  // Committed param state — drives the engine and the slider `value` prop.
  const [gain,              setGain]              = useState(clampGain(labConfig.gain));
  const [depth,             setDepth]             = useState(labConfig.depth);
  const [frequency,         setFrequency]         = useState(labConfig.frequency);
  const [focus,             setFocus]             = useState(labConfig.focus);
  const [transducerType,    setTransducerType]    = useState(labConfig.transducerType);
  const [transducerPosition, setTransducerPosition] = useState(0);

  // ── Android-only: DOM refs for label text, updated directly during drag ──
  // This avoids any React re-renders while the user is dragging, keeping the
  // main thread free to process touch events.
  const gainLabelRef      = useRef<HTMLSpanElement>(null);
  const depthLabelRef     = useRef<HTMLSpanElement>(null);
  const frequencyLabelRef = useRef<HTMLSpanElement>(null);
  const focusLabelRef     = useRef<HTMLSpanElement>(null);

  // Track whether the user is mid-drag.
  const isDraggingRef = useRef(false);

  // Android: debounce live config updates during drag so the worker isn't flooded.
  // The worker renders at 15fps — sending faster than that just grows the message queue.
  const dragUpdateTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDragConfigRef = useRef<Partial<UnifiedEngineConfig> | null>(null);

  // Android: sliders use `defaultValue` (uncontrolled) so the thumb follows the
  // finger freely without setState on every touch event.  We must force a re-mount
  // (via key change) when the value is reset externally (preset switch, Reset button).
  const [sliderKey, setSliderKey] = useState(0);

  // Reset param state when the lab config changes (e.g. switching presets).
  useEffect(() => {
    setGain(clampGain(labConfig.gain));
    setDepth(labConfig.depth);
    setFrequency(labConfig.frequency);
    setFocus(labConfig.focus);
    setTransducerType(labConfig.transducerType);
    setTransducerPosition(0);
    // Force slider re-mount on Android so defaultValue reflects the new preset values.
    if (isAndroid) setSliderKey((k) => k + 1);
  }, [
    labConfig.gain,
    labConfig.depth,
    labConfig.frequency,
    labConfig.focus,
    labConfig.transducerType,
    labConfig.presetId,
    labConfig.layers,
    labConfig.inclusions,
    isAndroid,
  ]);

  const sliderLocked = useCallback(
    (show: boolean, lock: boolean) => lock || show === false,
    [],
  );

  // ── Engine config derived from committed state ──────────────────────────
  const engineConfig = useMemo((): UnifiedEngineConfig => ({
    performanceProfile: isAndroid ? 'mobile' : 'full',
    renderMode: 'animated',
    renderQuality: 'full',
    layers: labConfig.layers,
    acousticLayers: labConfig.acousticLayers,
    inclusions: labConfig.inclusions.map((inc) => ({
      ...inc,
      centerLateralPos: (inc.centerLateralPos ?? 0) - transducerPosition,
    })),
    transducerType,
    frequency,
    depth,
    focus,
    gain,
    dynamicRange: labConfig.dynamicRange,
    tgc: [],
    mode: labConfig.mode,
    showStructuralBMode:        simulationFeatures.showStructuralBMode        ?? true,
    enablePosteriorEnhancement: simulationFeatures.enablePosteriorEnhancement ?? true,
    enableAcousticShadow:       simulationFeatures.enableAcousticShadow       ?? true,
    enableReverberation:        simulationFeatures.enableReverberation        ?? false,
    enableNearFieldClutter:     simulationFeatures.enableNearFieldClutter     ?? false,
    enableSpeckle: true,
    showBeamLines:       simulationFeatures.showBeamOverlay    ?? false,
    showDepthScale:      simulationFeatures.showDepthScale     ?? true,
    showFocusMarker:     simulationFeatures.showFocusMarker    ?? true,
    showFieldLines:      simulationFeatures.showFieldLines     ?? false,
    showAttenuationMap:  simulationFeatures.showAttenuationMap ?? false,
    showAnatomyLabels:   simulationFeatures.showAnatomyLabels  ?? false,
    showPhysicsPanel:    simulationFeatures.showPhysicsPanel   ?? false,
    enableColorDoppler:  simulationFeatures.enableColorDoppler ?? false,
    lateralOffset: transducerPosition,
    linearDebugView: 'final',
  }), [
    labConfig, depth, focus, frequency, gain,
    simulationFeatures, transducerPosition, transducerType,
    isNative, isAndroid,
  ]);

  const engineConfigRef = useRef(engineConfig);
  engineConfigRef.current = engineConfig;

  // ── Boot engine ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    setEngineReady(false);

    const canvas = canvasRef.current;
    const engine = createUltrasoundRenderer(canvas, engineConfigRef.current);
    engineRef.current = engine;
    engine.start();
    setIsRunning(true);
    setEngineReady(true);

    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
      setEngineReady(false);
    };
  }, [canvasSize.width, canvasSize.height]);

  // ── Push config changes to the engine ───────────────────────────────────
  // Web/iOS: every committed state change flows into the running loop.
  // Android: we skip this effect; the commit handlers push directly instead,
  //          so we never call updateConfig during a drag.
  useEffect(() => {
    if (!engineRef.current || !engineReady || isAndroid) return;
    engineRef.current.updateConfig(engineConfig);
  }, [engineConfig, engineReady, isAndroid]);

  // ── Slider handlers ──────────────────────────────────────────────────────
  /**
   * Returns Radix Slider event props.
   *
   * Android path:
   *  • onValueChange → update DOM label only. NO setState, NO re-render.
   *    Radix internally manages thumb position during active pointer capture,
   *    so the thumb moves smoothly even without a state update.
   *  • onValueCommit → one setState (re-render to lock thumb) +
   *    push specific param to worker + trigger one render.
   *
   * Web / iOS path:
   *  • onValueChange → setState as normal (engine loop picks it up).
   */
  const makeSliderHandlers = useCallback(
    (
      setter: (v: number) => void,
      labelRef: React.RefObject<HTMLSpanElement | null>,
      formatLabel: (v: number) => string,
      configKey: keyof UnifiedEngineConfig,
    ) => {
      if (isAndroid) {
        return {
          onValueChange: ([v]: number[]) => {
            const nextValue = configKey === 'gain' ? clampGain(v) : v;
            isDraggingRef.current = true;
            // Direct DOM mutation — zero React re-render.
            if (labelRef.current) labelRef.current.textContent = formatLabel(nextValue);

            // Debounced live config push: animation loop keeps running so the
            // user sees the image update during drag.  We coalesce rapid touch
            // events (60+ Hz) down to ~15 fps to avoid flooding the worker's
            // message queue (especially important for depth/frequency which
            // trigger an expensive generateCaches() call in the engine).
            pendingDragConfigRef.current = {
              ...pendingDragConfigRef.current,
              [configKey]: nextValue,
            };
            if (!dragUpdateTimerRef.current) {
              dragUpdateTimerRef.current = setTimeout(() => {
                if (pendingDragConfigRef.current) {
                  engineRef.current?.updateConfig(pendingDragConfigRef.current);
                  pendingDragConfigRef.current = null;
                }
                dragUpdateTimerRef.current = null;
              }, 66); // ~15 fps throttle
            }
          },
          onValueCommit: ([v]: number[]) => {
            const nextValue = configKey === 'gain' ? clampGain(v) : v;
            isDraggingRef.current = false;
            // Cancel any pending live update — the commit supersedes it.
            if (dragUpdateTimerRef.current) {
              clearTimeout(dragUpdateTimerRef.current);
              dragUpdateTimerRef.current = null;
            }
            pendingDragConfigRef.current = null;

            setter(nextValue); // one state update for thumb position + reset support
            engineRef.current?.updateConfig({ [configKey]: nextValue } as Partial<UnifiedEngineConfig>);
            // One full-quality render with the committed value.
            engineRef.current?.renderOnce();
          },
        };
      }
      return {
        onValueChange: ([v]: number[]) => setter(configKey === 'gain' ? clampGain(v) : v),
      };
    },
    [isAndroid],
  );

  // ── Play / Pause ─────────────────────────────────────────────────────────
  const handlePlayPause = () => {
    if (!engineRef.current) return;
    if (isRunning) {
      engineRef.current.stop();
    } else {
      engineRef.current.start();
    }
    setIsRunning(!isRunning);
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    const g = clampGain(labConfig.gain), d = labConfig.depth;
    const f = labConfig.frequency, fo = labConfig.focus;
    const tt = labConfig.transducerType;

    setGain(g); setDepth(d); setFrequency(f); setFocus(fo);
    setTransducerType(tt); setTransducerPosition(0);
    isDraggingRef.current = false;

    // Sync DOM labels back to reset values immediately
    if (gainLabelRef.current)      gainLabelRef.current.textContent      = `${g.toFixed(0)} dB`;
    if (depthLabelRef.current)     depthLabelRef.current.textContent     = `${d.toFixed(1)} cm`;
    if (frequencyLabelRef.current) frequencyLabelRef.current.textContent = `${f.toFixed(1)} MHz`;
    if (focusLabelRef.current)     focusLabelRef.current.textContent     = `${fo.toFixed(1)} cm`;

    if (isAndroid) {
      // Re-mount sliders so defaultValue resets to the initial values.
      setSliderKey((k) => k + 1);
      engineRef.current?.updateConfig({
        gain: g, depth: d, frequency: f, focus: fo, transducerType: tt,
        lateralOffset: 0,
        inclusions: labConfig.inclusions.map((inc) => ({
          ...inc,
          centerLateralPos: inc.centerLateralPos ?? 0,
        })),
      });
      engineRef.current?.renderOnce();
    }
  }, [labConfig, isAndroid]);

  // ── Transducer controls ───────────────────────────────────────────────────
  const handleTransducerType = (type: 'linear' | 'convex' | 'microconvex') => {
    if (studentControls.lockTransducer) return;
    setTransducerType(type);
    if (isAndroid) {
      engineRef.current?.updateConfig({ transducerType: type });
      engineRef.current?.renderOnce();
    }
  };

  const handleMoveTransducer = (direction: 'left' | 'right') => {
    const step = 0.1;
    const max  = 0.8;
    setTransducerPosition((prev) => {
      const next = direction === 'left'
        ? Math.max(-max, prev - step)
        : Math.min(max,  prev + step);
      if (isAndroid) {
        engineRef.current?.updateConfig({
          lateralOffset: next,
          inclusions: labConfig.inclusions.map((inc) => ({
            ...inc,
            centerLateralPos: (inc.centerLateralPos ?? 0) - next,
          })),
        });
        engineRef.current?.renderOnce();
      }
      return next;
    });
  };

  const showMovement = studentControls.enableTransducerMovement !== false;

  // ── Helpers to render slider labels ──────────────────────────────────────
  // On Android the value in the <span> is updated via DOM ref during drag.
  // On web/iOS it's driven by React state normally.
  const sliderLabel = (
    ref: React.RefObject<HTMLSpanElement | null>,
    value: number,
    format: (v: number) => string,
  ) =>
    isAndroid
      ? <span ref={ref} className="font-mono text-sm">{format(value)}</span>
      : <span className="font-mono text-sm">{format(value)}</span>;

  // ── Canvas panel ─────────────────────────────────────────────────────────
  const canvasPanel = (
    <>
      <div className={cn('bg-black overflow-hidden border-2 border-border', compactLayout ? 'h-full rounded-none border-0' : 'rounded-lg')}>
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className={cn('w-full touch-none', compactLayout ? 'h-full object-cover' : 'h-auto object-contain')}
        />
      </div>

      {showMovement && (
        <div className={cn('p-3 bg-muted/10 border border-muted/50', compactLayout ? 'mx-3 mt-2 rounded-md' : 'mt-4 rounded-md')}>
          <div className="flex items-center justify-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleMoveTransducer('left')} disabled={transducerPosition <= -0.8} className="h-8">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Esquerda
            </Button>
            <div className="px-3 py-1 bg-muted/30 rounded text-center min-w-[80px]">
              <div className="font-mono text-sm">{transducerPosition >= 0 ? '+' : ''}{transducerPosition.toFixed(1)} cm</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => handleMoveTransducer('right')} disabled={transducerPosition >= 0.8} className="h-8">
              Direita
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <div className={cn('flex items-center justify-between', compactLayout ? 'px-3 py-2' : 'mt-4')}>
        <div className="flex gap-2">
          <Button variant={isRunning ? 'default' : 'outline'} size="sm" onClick={handlePlayPause}>
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
    </>
  );

  // ── Controls panel ────────────────────────────────────────────────────────
  const controlsPanel = (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6 space-y-6">

          <div>
            <Label className="mb-3 flex justify-between">
              <span>Ganho</span>
              {sliderLabel(gainLabelRef, gain, (v) => `${v.toFixed(0)} dB`)}
            </Label>
            <Slider
              {...(isAndroid
                ? { key: `gain-${sliderKey}`, defaultValue: [gain] }
                : { value: [gain] })}
              min={MIN_GAIN_DB} max={MAX_GAIN_DB} step={1}
              disabled={sliderLocked(studentControls.showGain, studentControls.lockGain)}
              {...makeSliderHandlers(setGain, gainLabelRef, (v) => `${v.toFixed(0)} dB`, 'gain')}
            />
          </div>

          <div>
            <Label className="mb-3 flex justify-between">
              <span>Profundidade</span>
              {sliderLabel(depthLabelRef, depth, (v) => `${v.toFixed(1)} cm`)}
            </Label>
            <Slider
              {...(isAndroid
                ? { key: `depth-${sliderKey}`, defaultValue: [depth] }
                : { value: [depth] })}
              min={1} max={15} step={0.5}
              disabled={sliderLocked(studentControls.showDepth, studentControls.lockDepth)}
              {...makeSliderHandlers(setDepth, depthLabelRef, (v) => `${v.toFixed(1)} cm`, 'depth')}
            />
          </div>

          <div>
            <Label className="mb-3 flex justify-between">
              <span>Frequência</span>
              {sliderLabel(frequencyLabelRef, frequency, (v) => `${v.toFixed(1)} MHz`)}
            </Label>
            <Slider
              {...(isAndroid
                ? { key: `freq-${sliderKey}`, defaultValue: [frequency] }
                : { value: [frequency] })}
              min={2} max={11} step={0.5}
              disabled={sliderLocked(studentControls.showFrequency, studentControls.lockFrequency)}
              {...makeSliderHandlers(setFrequency, frequencyLabelRef, (v) => `${v.toFixed(1)} MHz`, 'frequency')}
            />
          </div>

          <div>
            <Label className="mb-3 flex justify-between">
              <span>Foco</span>
              {sliderLabel(focusLabelRef, focus, (v) => `${v.toFixed(1)} cm`)}
            </Label>
            <Slider
              {...(isAndroid
                ? { key: `focus-${sliderKey}`, defaultValue: [focus] }
                : { value: [focus] })}
              min={0.5} max={depth} step={0.1}
              disabled={sliderLocked(studentControls.showFocus, studentControls.lockFocus)}
              {...makeSliderHandlers(setFocus, focusLabelRef, (v) => `${v.toFixed(1)} cm`, 'focus')}
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
              onClick={() => handleTransducerType('linear')}
              disabled={studentControls.lockTransducer}
              className="w-full"
            >
              Linear (2-11 MHz)
            </Button>
            <Button
              variant={transducerType === 'convex' ? 'default' : 'outline'}
              onClick={() => handleTransducerType('convex')}
              disabled={studentControls.lockTransducer}
              className="w-full"
            >
              Convexo (2-6 MHz)
            </Button>
            <Button
              variant={transducerType === 'microconvex' ? 'default' : 'outline'}
              onClick={() => handleTransducerType('microconvex')}
              disabled={studentControls.lockTransducer}
              className="w-full"
            >
              Microconvexo (4-10 MHz)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ── Layout ────────────────────────────────────────────────────────────────
  if (compactLayout) {
    return (
      <div className={cn(labMobileFlexClass, 'h-full min-h-0 bg-background')}>
        <section className="relative h-[min(48dvh,55vh)] min-h-[40dvh] shrink-0 overflow-hidden border-b border-border bg-black">
          <div className={labCanvasHostClass}>{canvasPanel}</div>
        </section>
        <div className={cn(labMobilePanelClass(true), 'overflow-y-auto touch-pan-y')}>{controlsPanel}</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card>
          <CardContent className="p-6">{canvasPanel}</CardContent>
        </Card>
      </div>
      {controlsPanel}
    </div>
  );
}
