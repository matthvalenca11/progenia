/**
 * WasmUltrasoundRenderer.ts
 *
 * Main-thread WebAssembly ultrasound physics renderer for Android.
 *
 * WHY main thread and not a worker?
 * The Vite build for this project does NOT bundle worker files — they are
 * copied verbatim and their `import` statements are never resolved in the
 * built APK. Workers therefore fail silently on Android. Running WASM on the
 * main thread with frame throttling is both simpler and reliable.
 *
 * Performance profile (vs JS engine at same resolution):
 *   JS engine  → ~200 ms/frame → ~5 fps, 100% main-thread busy
 *   WASM       → ~50  ms/frame → ~12 fps, 40% main-thread idle
 *
 * The 40% idle windows between renders let the browser process pointer/touch
 * events, keeping sliders responsive even though rendering is synchronous.
 */

import type { UnifiedEngineConfig } from "./UnifiedUltrasoundEngine";
import type { UltrasoundRenderer } from "./UltrasoundRendererAdapter";
import { ACOUSTIC_MEDIA, type Echogenicity, type UltrasoundLayerConfig, type UltrasoundInclusionConfig } from "@/types/acousticMedia";
import { ULTRASOUND_WASM_B64 } from "../../wasm/ultrasoundWasmBytes";

// ─── Echogenicity → linear reflectance ───────────────────────────────────────
// These values match the ranges used in UnifiedUltrasoundEngine for visual parity.

const ECHO_VALUES: Record<Echogenicity, number> = {
  hyperechoic: 0.72,
  isoechoic:   0.42,
  hypoechoic:  0.18,
  anechoic:    0.025,
};

// ─── WASM exports ─────────────────────────────────────────────────────────────

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

// ─── Singleton WASM module (shared across renderer instances) ─────────────────
let wasmSingleton: WasmExports | null = null;
let wasmInitPromise: Promise<WasmExports> | null = null;

async function getWasm(): Promise<WasmExports> {
  if (wasmSingleton) return wasmSingleton;
  if (wasmInitPromise) return wasmInitPromise;

  wasmInitPromise = (async () => {
    // Decode base64 → Uint8Array (no network request, works offline / Capacitor)
    const b64   = ULTRASOUND_WASM_B64;
    const raw   = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    const { instance } = await WebAssembly.instantiate(bytes.buffer, {
      env: {
        abort(_msg: number, _file: number, line: number, col: number): void {
          console.error(`[wasm-ultrasound] abort at ${line}:${col}`);
        },
      },
    });

    wasmSingleton = instance.exports as unknown as WasmExports;
    return wasmSingleton;
  })();

  return wasmInitPromise;
}

// ─── Config helpers ───────────────────────────────────────────────────────────

function writeLayerData(view: Float32Array, layers: UltrasoundLayerConfig[]): number {
  let cumDepth = 0;
  let n = 0;
  for (let i = 0; i < Math.min(layers.length, 8); i++) {
    const l  = layers[i];
    const m  = ACOUSTIC_MEDIA[l.mediumId];
    const e  = Math.max(0.01, ECHO_VALUES[m.baseEchogenicity] + (l.reflectivityBias ?? 0) * 0.2);
    view[n * 3 + 0] = cumDepth;
    view[n * 3 + 1] = e;
    view[n * 3 + 2] = m.attenuation_dB_per_cm_MHz;
    cumDepth += l.thicknessCm;
    n++;
  }
  return n;
}

function writeInclusionData(view: Float32Array, inclusions: UltrasoundInclusionConfig[]): number {
  let n = 0;
  for (let i = 0; i < Math.min(inclusions.length, 6); i++) {
    const inc = inclusions[i];
    const m   = ACOUSTIC_MEDIA[inc.mediumInsideId];
    view[n * 5 + 0] = inc.centerLateralPos * 2.5;   // −1..+1 → cm
    view[n * 5 + 1] = inc.centerDepthCm;
    view[n * 5 + 2] = (inc.sizeCm?.width  ?? 1.0) / 2;
    view[n * 5 + 3] = (inc.sizeCm?.height ?? 1.0) / 2;
    view[n * 5 + 4] = Math.max(0.01, ECHO_VALUES[m.baseEchogenicity]);
    n++;
  }
  return n;
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

/**
 * Frame throttle: render at most once every MIN_FRAME_MS milliseconds.
 * At WASM ~50 ms/frame:
 *   MIN_FRAME_MS=80 → 12.5 fps, ~37% main-thread idle  (default)
 *   MIN_FRAME_MS=50 → 20   fps, ~0%  main-thread idle  (high-end devices)
 */
const MIN_FRAME_MS = 80;

export class WasmUltrasoundRenderer implements UltrasoundRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: UnifiedEngineConfig;

  private wasm: WasmExports | null   = null;
  private layerView: Float32Array    | null = null;
  private inclView: Float32Array     | null = null;

  private rafId: number | null       = null;
  private running = false;
  private destroyed = false;
  private pendingOnce = false;

  private startTime = performance.now();
  private lastRenderAt = -Infinity;

  constructor(canvas: HTMLCanvasElement, config: UnifiedEngineConfig) {
    this.canvas = canvas;
    this.config = config;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("[WasmRenderer] cannot get 2d context");
    this.ctx = ctx;

    this.init();
  }

  private async init(): Promise<void> {
    try {
      const wasm = await getWasm();
      if (this.destroyed) return;

      this.wasm = wasm;
      const mem = wasm.memory.buffer;
      this.layerView = new Float32Array(mem, wasm.getLayersBufPtr(), 8 * 3);
      this.inclView  = new Float32Array(mem, wasm.getInclBufPtr(),   6 * 5);

      // First render right away
      this.execRender();

      if (this.running) this.scheduleLoop();
      if (this.pendingOnce) { this.pendingOnce = false; this.execRender(); }
    } catch (err) {
      console.error("[WasmRenderer] WASM init failed", err);
    }
  }

  private execRender(): void {
    if (!this.wasm || this.destroyed) return;

    const { width, height } = this.canvas;
    if (width === 0 || height === 0) return;

    const numLayers = writeLayerData(this.layerView!, this.config.acousticLayers ?? []);
    const numIncl   = writeInclusionData(this.inclView!, this.config.inclusions ?? []);

    const transducer =
      this.config.transducerType === "linear" ? 0 :
      this.config.transducerType === "convex" ? 1 : 2;

    const t = (performance.now() - this.startTime) / 1000;

    this.wasm.render(
      width, height, t,
      this.config.gain, this.config.depth, this.config.frequency,
      this.config.focus, this.config.dynamicRange,
      transducer, this.config.lateralOffset ?? 0,
      numLayers, numIncl,
      this.config.enableAcousticShadow        ? 1 : 0,
      this.config.enablePosteriorEnhancement  ? 1 : 0,
      this.config.showDepthScale   ? 1 : 0,
      this.config.showFocusMarker  ? 1 : 0,
    );

    // Read directly from WASM memory — zero copy
    const pixelCount = Math.min(width * height, 512 * 384);
    const outPtr  = this.wasm.getOutBufPtr();
    const pixels  = new Uint8ClampedArray(this.wasm.memory.buffer, outPtr, pixelCount * 4);
    const imgData = new ImageData(pixels, width, height);
    this.ctx.putImageData(imgData, 0, 0);

    this.lastRenderAt = performance.now();
  }

  private scheduleLoop(): void {
    if (!this.running || this.destroyed) return;
    this.rafId = requestAnimationFrame((now) => {
      if (!this.running || this.destroyed) return;
      // Throttle: only render when enough time has elapsed.
      // The idle gap between renders keeps the main thread free for touch events.
      if (now - this.lastRenderAt >= MIN_FRAME_MS && this.config.renderMode !== "static") {
        this.execRender();
      }
      this.scheduleLoop();
    });
  }

  // ─── UltrasoundRenderer interface ─────────────────────────────────────────

  updateConfig(updates: Partial<UnifiedEngineConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  renderOnce(): void {
    if (!this.wasm) { this.pendingOnce = true; return; }
    this.execRender();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    if (this.wasm) this.scheduleLoop();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.stop();
    this.wasm      = null;
    this.layerView = null;
    this.inclView  = null;
  }
}
