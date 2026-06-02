/**
 * ultrasoundWasmRender.worker.ts
 *
 * Web Worker that drives the WebAssembly ultrasound physics engine.
 * Replaces the JS-based ultrasoundRender.worker.ts for Android:
 *   JS engine  → ~200 ms/frame → max ~4 fps
 *   WASM engine → ~50 ms/frame → max ~20 fps
 *
 * Same message protocol as ultrasoundRender.worker.ts so the adapter
 * can use the same WorkerUltrasoundRenderer class.
 */

import type { UnifiedEngineConfig } from "./UnifiedUltrasoundEngine";
import { ACOUSTIC_MEDIA, type Echogenicity, type UltrasoundLayerConfig, type UltrasoundInclusionConfig } from "@/types/acousticMedia";

// @ts-ignore — Vite ?url asset import works in module workers
import wasmUrl from "../../wasm/ultrasound.wasm?url";

// ─── Message protocol (identical to ultrasoundRender.worker.ts) ──────────────

type WorkerInboundMessage =
  | { type: "init"; canvas: OffscreenCanvas; config: UnifiedEngineConfig }
  | { type: "init"; width: number; height: number; config: UnifiedEngineConfig; mirrorFrames: true }
  | { type: "start" }
  | { type: "stop" }
  | { type: "renderOnce" }
  | { type: "updateConfig"; config: Partial<UnifiedEngineConfig> }
  | { type: "destroy" };

type WorkerOutboundMessage =
  | { type: "frame"; bitmap: ImageBitmap }
  | { type: "stats"; fps: number; avgRenderMs: number; droppedFrames: number }
  | { type: "error"; message: string };

// ─── Echogenicity → linear reflectance (matches UnifiedUltrasoundEngine) ─────

const ECHO_VALUES: Record<Echogenicity, number> = {
  hyperechoic: 0.72,
  isoechoic:   0.42,
  hypoechoic:  0.18,
  anechoic:    0.025,
};

// ─── WASM exports interface ──────────────────────────────────────────────────

interface WasmExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  getLayersBufPtr(): number;
  getInclBufPtr(): number;
  getOutBufPtr(): number;
  render(
    width: number, height: number, timeSeconds: number,
    gain: number, depth: number, frequency: number, focus: number, dynamicRange: number,
    transducer: number, lateralOffset: number,
    numLayers: number, numIncl: number,
    enableShadow: number, enableEnhancement: number,
    showDepthScale: number, showFocusMarker: number,
  ): void;
}

// ─── State ───────────────────────────────────────────────────────────────────

let wasmExports: WasmExports | null = null;
let layerView:   Float32Array | null = null;
let inclView:    Float32Array | null = null;
let outView:     Uint8ClampedArray | null = null;

let renderCanvas: OffscreenCanvas | null = null;
let renderCtx:    OffscreenCanvasRenderingContext2D | null = null;
let config:       UnifiedEngineConfig | null = null;

let mirrorFrames    = false;
let running         = false;
let destroyed       = false;
let rendering       = false;
let pendingOnce     = false;
let bitmapInFlight  = false;

let effectiveFps = 15;    // Start at 15 fps (realistic for WASM on Android)
let avgRenderMs  = 0;
let droppedFrames = 0;
let lastStatsAt   = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let startTime     = performance.now();

// ─── WASM loader ─────────────────────────────────────────────────────────────

async function loadWasm(): Promise<void> {
  const response = await fetch(wasmUrl);
  const buffer   = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(buffer, {
    env: {
      abort(msg: number, file: number, line: number, col: number): void {
        self.postMessage({ type: "error", message: `[wasm] abort at ${line}:${col}` });
      },
    },
  });

  const exports = instance.exports as unknown as WasmExports;
  const mem     = exports.memory.buffer;

  layerView = new Float32Array(mem, exports.getLayersBufPtr(), 8 * 3);
  inclView  = new Float32Array(mem, exports.getInclBufPtr(),   6 * 5);
  outView   = new Uint8ClampedArray(mem, exports.getOutBufPtr(), 512 * 384 * 4);

  wasmExports = exports;
}

// ─── Config → WASM memory writers ────────────────────────────────────────────

function writeLayerData(layers: UltrasoundLayerConfig[]): number {
  let cumDepth = 0;
  let n = 0;
  for (let i = 0; i < Math.min(layers.length, 8); i++) {
    const l  = layers[i];
    const m  = ACOUSTIC_MEDIA[l.mediumId];
    const e  = Math.max(0.01, ECHO_VALUES[m.baseEchogenicity] + (l.reflectivityBias ?? 0) * 0.2);
    layerView![n * 3 + 0] = cumDepth;
    layerView![n * 3 + 1] = e;
    layerView![n * 3 + 2] = m.attenuation_dB_per_cm_MHz;
    cumDepth += l.thicknessCm;
    n++;
  }
  return n;
}

function writeInclusionData(inclusions: UltrasoundInclusionConfig[]): number {
  let n = 0;
  for (let i = 0; i < Math.min(inclusions.length, 6); i++) {
    const inc = inclusions[i];
    const m   = ACOUSTIC_MEDIA[inc.mediumInsideId];
    inclView![n * 5 + 0] = inc.centerLateralPos * 2.5;  // -1..1 → cm
    inclView![n * 5 + 1] = inc.centerDepthCm;
    inclView![n * 5 + 2] = (inc.sizeCm?.width  ?? 1.0) / 2;
    inclView![n * 5 + 3] = (inc.sizeCm?.height ?? 1.0) / 2;
    inclView![n * 5 + 4] = Math.max(0.01, ECHO_VALUES[m.baseEchogenicity]);
    n++;
  }
  return n;
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function doRender(): void {
  if (!wasmExports || !config || !renderCanvas || !renderCtx) return;

  const { width, height } = renderCanvas;
  if (width === 0 || height === 0) return;

  const numLayers = writeLayerData(config.acousticLayers ?? []);
  const numIncl   = writeInclusionData(config.inclusions ?? []);

  const transducer =
    config.transducerType === "linear" ? 0 :
    config.transducerType === "convex" ? 1 : 2;

  const t = (performance.now() - startTime) / 1000;

  wasmExports.render(
    width, height, t,
    config.gain, config.depth, config.frequency, config.focus, config.dynamicRange,
    transducer, config.lateralOffset ?? 0,
    numLayers, numIncl,
    config.enableAcousticShadow       ? 1 : 0,
    config.enablePosteriorEnhancement ? 1 : 0,
    config.showDepthScale  ? 1 : 0,
    config.showFocusMarker ? 1 : 0,
  );

  const pixelCount = Math.min(width * height, 512 * 384);
  const pixels = new Uint8ClampedArray(
    wasmExports.memory.buffer,
    wasmExports.getOutBufPtr(),
    pixelCount * 4,
  );
  const imageData = new ImageData(pixels, width, height);
  renderCtx.putImageData(imageData, 0, 0);
}

function adaptFrameRate(renderMs: number): void {
  avgRenderMs = avgRenderMs === 0 ? renderMs : avgRenderMs * 0.85 + renderMs * 0.15;
  const budget = 1000 / effectiveFps;
  if (avgRenderMs > budget * 0.75 && effectiveFps > 8) {
    effectiveFps = Math.max(8, effectiveFps - 2);
  } else if (avgRenderMs < budget * 0.40 && effectiveFps < 24) {
    effectiveFps = Math.min(24, effectiveFps + 2);
  }
}

function postMirroredFrame(): void {
  if (!mirrorFrames || !renderCanvas || bitmapInFlight) {
    if (mirrorFrames) droppedFrames++;
    return;
  }
  bitmapInFlight = true;
  createImageBitmap(renderCanvas)
    .then((bitmap) => {
      self.postMessage({ type: "frame", bitmap } as WorkerOutboundMessage, [bitmap]);
      bitmapInFlight = false;
    })
    .catch(() => {
      bitmapInFlight = false;
      droppedFrames++;
    });
}

function postStats(now: number): void {
  if (now - lastStatsAt < 2000) return;
  lastStatsAt = now;
  self.postMessage({ type: "stats", fps: effectiveFps, avgRenderMs, droppedFrames } as WorkerOutboundMessage);
  droppedFrames = 0;
}

function renderOnce(): void {
  if (!wasmExports || !config || destroyed || rendering) {
    pendingOnce = true;
    droppedFrames++;
    return;
  }
  rendering = true;
  const t0 = performance.now();
  doRender();
  const elapsed = performance.now() - t0;
  adaptFrameRate(elapsed);
  postMirroredFrame();
  postStats(t0);
  rendering = false;

  if (pendingOnce) {
    pendingOnce = false;
    setTimeout(renderOnce, 0);
  }
}

function scheduleNextFrame(): void {
  if (!running || destroyed || config?.renderMode === "static") return;
  if (timer != null) clearTimeout(timer);
  timer = setTimeout(renderAnimatedFrame, Math.max(1000 / effectiveFps, 0));
}

function renderAnimatedFrame(): void {
  if (!running || destroyed) return;
  if (config?.renderMode === "static") return;
  renderOnce();
  scheduleNextFrame();
}

function clearLoop(): void {
  if (timer != null) { clearTimeout(timer); timer = null; }
}

// ─── Message handler ──────────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent<WorkerInboundMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case "init": {
      config = msg.config;
      if ("canvas" in msg) {
        renderCanvas = msg.canvas;
        mirrorFrames = false;
      } else {
        renderCanvas = new OffscreenCanvas(msg.width, msg.height);
        mirrorFrames = (msg as { mirrorFrames?: boolean }).mirrorFrames === true;
      }
      renderCtx = renderCanvas.getContext("2d", { alpha: false }) as OffscreenCanvasRenderingContext2D;

      // Load WASM then immediately render
      loadWasm()
        .then(() => {
          if (destroyed) return;
          renderOnce();
          scheduleNextFrame();
        })
        .catch((err) => {
          self.postMessage({ type: "error", message: String(err) } as WorkerOutboundMessage);
        });
      break;
    }

    case "start":
      running = true;
      if (wasmExports) scheduleNextFrame();
      break;

    case "stop":
      running = false;
      clearLoop();
      break;

    case "renderOnce":
      if (wasmExports) renderOnce();
      else pendingOnce = true;
      break;

    case "updateConfig":
      if (!config) return;
      config = { ...config, ...msg.config };
      if (!running || !wasmExports) return;
      if (config.renderMode === "static") {
        clearLoop();
      } else {
        renderOnce();
        scheduleNextFrame();
      }
      break;

    case "destroy":
      destroyed = true;
      running = false;
      clearLoop();
      wasmExports = null;
      config = null;
      break;
  }
};

export {};
