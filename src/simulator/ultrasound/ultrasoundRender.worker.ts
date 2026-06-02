import { UnifiedUltrasoundEngine, type UnifiedEngineConfig } from "./UnifiedUltrasoundEngine";

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
  | { type: "stats"; fps: number; avgRenderMs: number; droppedFrames: number };

let engine: UnifiedUltrasoundEngine | null = null;
let config: UnifiedEngineConfig | null = null;
let renderCanvas: OffscreenCanvas | null = null;
let mirrorFrames = false;
let running = false;
let destroyed = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let rendering = false;
let pendingRender = false;

// Stats
let avgRenderMs = 0;
let droppedFrames = 0;
let lastStatsAt = 0;
let frameCount = 0;
let bitmapInFlight = false;

// Fire animation frames at ~60fps. On Android, the engine keeps using the
// structural cache between config changes so the animation cadence stays smooth
// instead of pausing for periodic full-physics keyframes.
const FRAME_INTERVAL_MS = 16;

function scheduleNextFrame(): void {
  if (!running || destroyed || !config || config.renderMode === "static") return;
  if (timer != null) clearTimeout(timer);
  timer = setTimeout(renderAnimatedFrame, FRAME_INTERVAL_MS);
}

function postMirroredFrame(): void {
  if (!mirrorFrames || !renderCanvas) return;
  if (bitmapInFlight || typeof createImageBitmap !== "function") {
    droppedFrames++;
    return;
  }

  bitmapInFlight = true;
  createImageBitmap(renderCanvas)
    .then((bitmap) => {
      const msg: WorkerOutboundMessage = { type: "frame", bitmap };
      self.postMessage(msg, [bitmap]);
      bitmapInFlight = false;
    })
    .catch(() => {
      bitmapInFlight = false;
      droppedFrames++;
    });
}

function postStatsIfNeeded(now: number): void {
  if (now - lastStatsAt < 2000) return;
  const elapsed = (now - lastStatsAt) / 1000;
  const fps = elapsed > 0 ? frameCount / elapsed : 0;
  lastStatsAt = now;
  frameCount = 0;
  const msg: WorkerOutboundMessage = { type: "stats", fps, avgRenderMs, droppedFrames };
  self.postMessage(msg);
  droppedFrames = 0;
}

/**
 * Core render step.
 *
 * The engine decides on every call whether to run a full physics render (expensive)
 * or a structural-cache warp frame (cheap). On mobile, once the cache is warm, the
 * live loop remains cache-only until a config change invalidates that cache.
 *
 * Cache is automatically invalidated by engine.updateConfig(), so the frame right
 * after a slider commit always produces a fresh full-quality physics render.
 */
function renderFrame(): void {
  if (!engine || !config || destroyed || rendering) {
    if (!destroyed) pendingRender = true;
    return;
  }

  rendering = true;
  const start = performance.now();
  engine.renderFrameAt(start);
  const elapsed = performance.now() - start;

  avgRenderMs = avgRenderMs === 0 ? elapsed : avgRenderMs * 0.9 + elapsed * 0.1;
  frameCount++;
  postMirroredFrame();
  postStatsIfNeeded(start);
  rendering = false;
}

function renderAnimatedFrame(): void {
  if (!running || destroyed || !engine || !config) return;
  if (config.renderMode === "static") return;
  if (rendering) {
    scheduleNextFrame();
    return;
  }

  renderFrame();

  if (pendingRender) {
    pendingRender = false;
    setTimeout(renderFrame, 0);
    return;
  }

  scheduleNextFrame();
}

function clearLoop(): void {
  if (timer != null) {
    clearTimeout(timer);
    timer = null;
  }
}

self.onmessage = (event: MessageEvent<WorkerInboundMessage>) => {
  const message = event.data;

  switch (message.type) {
    case "init": {
      const incoming = message.config;

      if ("canvas" in message) {
        renderCanvas = message.canvas;
        mirrorFrames = false;
      } else {
        renderCanvas = new OffscreenCanvas(message.width, message.height);
        mirrorFrames = message.mirrorFrames;
      }

      // Always init at full quality so the structural cache is available from the
      // very first frame.  ConvexPolarEngine allocates 160-sample buffers once here
      // and never reallocates — no more per-frame quality switching overhead.
      config = { ...incoming, renderQuality: "full" };
      engine = new UnifiedUltrasoundEngine(renderCanvas, config);
      running = true;
      lastStatsAt = performance.now();

      // Render first frame immediately (warms the structural cache).
      renderFrame();
      scheduleNextFrame();
      break;
    }

    case "start": {
      running = true;
      if (config?.renderMode === "static") {
        renderFrame();
      } else {
        scheduleNextFrame();
      }
      break;
    }

    case "stop": {
      running = false;
      clearLoop();
      break;
    }

    case "renderOnce": {
      // Explicit committed render (e.g. slider onValueCommit).
      // engine.updateConfig() called just before this message (from the lab component)
      // has already invalidated the structural cache, so the next renderFrame() call
      // will be a full physics render at the new config values.
      renderFrame();
      break;
    }

    case "updateConfig": {
      if (!engine || !config) return;
      const incoming = message.config;

      // Always keep engine at full quality regardless of what the main thread sends
      // (the structural cache relies on full-quality renders as keyframes).
      const sanitised = { ...incoming, renderQuality: "full" as const };
      config = { ...config, ...sanitised };
      engine.updateConfig(sanitised);

      if (!running) return;
      if (config.renderMode === "static") {
        clearLoop();
      } else {
        if (!timer) scheduleNextFrame();
      }
      break;
    }

    case "destroy": {
      destroyed = true;
      running = false;
      clearLoop();
      engine?.destroy();
      engine = null;
      config = null;
      mirrorFrames = false;
      break;
    }
  }
};

export {};
