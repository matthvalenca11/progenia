import { isAndroidNativeLabRuntime } from "@/lib/labRuntime";
import { UnifiedUltrasoundEngine, type UnifiedEngineConfig } from "./UnifiedUltrasoundEngine";
import { tryCreateWebGLEngine, WebGLUltrasoundEngine } from "./WebGLUltrasoundEngine";

// `?worker` tells Vite to bundle the worker file into a self-contained IIFE.
// All imports are resolved and inlined — the worker runs correctly in Capacitor
// Android WebView without any external module resolution.
import UltrasoundRenderWorker from "./ultrasoundRender.worker.ts?worker";

type WorkerMessage =
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

export interface UltrasoundRenderer {
  updateConfig(updates: Partial<UnifiedEngineConfig>): void;
  /** Trigger a single static render immediately. */
  renderOnce(): void;
  start(): void;
  stop(): void;
  destroy(): void;
}

/**
 * Wraps the GPU WebGL engine with the UltrasoundRenderer interface.
 */
class WebGLRenderer implements UltrasoundRenderer {
  private engine: WebGLUltrasoundEngine;

  constructor(canvas: HTMLCanvasElement, config: UnifiedEngineConfig) {
    const engine = tryCreateWebGLEngine(canvas, config);
    if (!engine) throw new Error("WebGL2 unavailable");
    this.engine = engine;
  }

  updateConfig(updates: Partial<UnifiedEngineConfig>): void {
    this.engine.updateConfig(updates);
  }

  renderOnce(): void {
    this.engine.renderFrameAt(performance.now());
  }

  start(): void {
    this.engine.start();
  }

  stop(): void {
    this.engine.stop();
  }

  destroy(): void {
    this.engine.destroy();
  }
}

class DirectUltrasoundRenderer implements UltrasoundRenderer {
  private engine: UnifiedUltrasoundEngine;

  constructor(canvas: HTMLCanvasElement, config: UnifiedEngineConfig) {
    this.engine = new UnifiedUltrasoundEngine(canvas, config);
  }

  updateConfig(updates: Partial<UnifiedEngineConfig>): void {
    this.engine.updateConfig(updates);
  }

  renderOnce(): void {
    this.engine.renderFrameAt(performance.now());
  }

  start(): void {
    this.engine.start();
  }

  stop(): void {
    this.engine.stop();
  }

  destroy(): void {
    this.engine.destroy();
  }
}

type CanvasWithOffscreen = HTMLCanvasElement & {
  transferControlToOffscreen?: () => OffscreenCanvas;
};

/**
 * Runs the UnifiedUltrasoundEngine in a Web Worker so the main thread stays
 * free for UI interactions (sliders, buttons, animations).
 *
 * The worker is imported with `?worker` so Vite bundles it as a self-contained
 * IIFE — all TypeScript compiled, all imports inlined. This is what makes it
 * work inside the Capacitor Android WebView (which cannot resolve ES module
 * imports from separate worker files).
 */
class WorkerUltrasoundRenderer implements UltrasoundRenderer {
  private worker: Worker;
  private destroyed = false;
  private visibleCtx: CanvasRenderingContext2D | null = null;

  constructor(
    canvas: OffscreenCanvas | { width: number; height: number; visibleCanvas: HTMLCanvasElement },
    config: UnifiedEngineConfig,
  ) {
    // Instantiate the pre-bundled worker class from the ?worker import.
    this.worker = new UltrasoundRenderWorker();

    this.worker.onerror = (event) => {
      console.warn("[ultrasound-worker] render worker error", event.message);
    };

    this.worker.onmessage = (event: MessageEvent<WorkerOutboundMessage>) => {
      this.handleWorkerMessage(event.data);
    };

    if (canvas instanceof OffscreenCanvas) {
      this.post({ type: "init", canvas, config }, [canvas]);
    } else {
      this.visibleCtx = canvas.visibleCanvas.getContext("2d", { alpha: false });
      this.post({
        type: "init",
        width: canvas.width,
        height: canvas.height,
        config,
        mirrorFrames: true,
      });
    }
  }

  updateConfig(updates: Partial<UnifiedEngineConfig>): void {
    this.post({ type: "updateConfig", config: updates });
  }

  renderOnce(): void {
    this.post({ type: "renderOnce" });
  }

  start(): void {
    this.post({ type: "start" });
  }

  stop(): void {
    this.post({ type: "stop" });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.post({ type: "destroy" });
    this.worker.terminate();
    this.destroyed = true;
  }

  private post(message: WorkerMessage, transfer?: Transferable[]): void {
    if (this.destroyed) return;
    this.worker.postMessage(message, transfer ?? []);
  }

  private handleWorkerMessage(message: WorkerOutboundMessage): void {
    if (this.destroyed) return;

    if (message.type === "error") {
      console.warn("[ultrasound-worker]", message.message);
      return;
    }

    if (message.type === "stats") {
      console.debug(
        `[ultrasound-worker] fps=${message.fps} render=${message.avgRenderMs.toFixed(1)}ms dropped=${message.droppedFrames}`,
      );
      return;
    }

    if (message.type === "frame") {
      if (!this.visibleCtx) {
        message.bitmap.close();
        return;
      }
      // Stretch the bitmap to fill the visible canvas.  When the worker renders at
      // reduced resolution (e.g. 384×288 for a 512×384 canvas) this upscales it
      // smoothly via the browser's bilinear filtering.
      const { width, height } = this.visibleCtx.canvas;
      this.visibleCtx.drawImage(message.bitmap, 0, 0, width, height);
      message.bitmap.close();
      return;
    }
  }
}

export function createUltrasoundRenderer(
  canvas: HTMLCanvasElement,
  config: UnifiedEngineConfig,
): UltrasoundRenderer {
  const canUseWorker = typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined";
  const canTransferCanvas =
    canUseWorker &&
    typeof (canvas as CanvasWithOffscreen).transferControlToOffscreen === "function";

  if (isAndroidNativeLabRuntime && canUseWorker) {
    // Android: run the JS engine inside a Web Worker.
    // The worker is bundled by Vite (?worker import) so all dependencies are
    // inlined — no module resolution issues in the Capacitor WebView.
    // The main thread stays completely free, keeping sliders fully responsive.
    //
    // Always use the mirror-frames path (not transferControlToOffscreen) so we can
    // render at a reduced internal resolution for better performance.  The bitmap is
    // stretched back to the visible canvas size by drawImage, so the user sees a
    // full-size image.  At 75% linear scale the pixel count drops by ~44 %, cutting
    // both full-render time (~200 ms → ~112 ms) and warp-frame time (~30 ms → ~17 ms).
    const RENDER_SCALE = 0.75;
    try {
      return new WorkerUltrasoundRenderer(
        {
          width: Math.round(canvas.width * RENDER_SCALE),
          height: Math.round(canvas.height * RENDER_SCALE),
          visibleCanvas: canvas,
        },
        config,
      );
    } catch (error) {
      console.warn("[ultrasound-worker] falling back to main-thread renderer", error);
    }
  }

  // Web / iOS: use JS physics engine directly on the main thread.
  return new DirectUltrasoundRenderer(canvas, config);
}
