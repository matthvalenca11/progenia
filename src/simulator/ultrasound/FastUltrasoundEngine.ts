/**
 * Motor B-mode leve para app nativo.
 * Render estático sob demanda (sem loop de animação) — ~10–20× mais rápido que UnifiedUltrasoundEngine.
 */

import type { AnatomyLayer } from "@/types/ultrasoundAdvanced";
import type { UltrasoundInclusionConfig, UltrasoundLayerConfig } from "@/types/acousticMedia";
import type { UnifiedEngineConfig } from "./UnifiedUltrasoundEngine";

const SPECKLE_TILE = 96;

function echogenicityBase(level: AnatomyLayer["echogenicity"]): number {
  switch (level) {
    case "hyperechoic":
      return 0.82;
    case "hypoechoic":
      return 0.28;
    case "anechoic":
      return 0.06;
    default:
      return 0.5;
  }
}

function pickLayer(layers: AnatomyLayer[], depthRatio: number): AnatomyLayer | null {
  for (const layer of layers) {
    const [a, b] = layer.depthRange;
    if (depthRatio >= a && depthRatio <= b) return layer;
  }
  return layers[layers.length - 1] ?? null;
}

function hashNoise(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export class FastUltrasoundEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: UnifiedEngineConfig;
  private renderJob: number | null = null;
  private speckleTile: Uint8Array;
  private isRunning = false;

  constructor(canvas: HTMLCanvasElement, config: UnifiedEngineConfig) {
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) throw new Error("Failed to get canvas context");
    this.canvas = canvas;
    this.ctx = ctx;
    this.config = config;
    this.speckleTile = new Uint8Array(SPECKLE_TILE * SPECKLE_TILE);
    for (let i = 0; i < this.speckleTile.length; i++) {
      this.speckleTile[i] = Math.floor(hashNoise(i % SPECKLE_TILE, Math.floor(i / SPECKLE_TILE)) * 255);
    }
  }

  public updateConfig(updates: Partial<UnifiedEngineConfig>): void {
    this.config = { ...this.config, ...updates };
    if (this.isRunning) this.scheduleRender();
  }

  /** No nativo: um frame sob demanda, não animação contínua. */
  public start(): void {
    this.isRunning = true;
    this.scheduleRender();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.renderJob != null) {
      cancelAnimationFrame(this.renderJob);
      this.renderJob = null;
    }
  }

  public destroy(): void {
    this.stop();
  }

  public renderFrame(): void {
    const { width, height } = this.canvas;
    if (width <= 0 || height <= 0) return;

    if (!this.config.showStructuralBMode) {
      this.ctx.fillStyle = "#050505";
      this.ctx.fillRect(0, 0, width, height);
      this.drawOverlays(width, height);
      return;
    }

    const imageData = this.ctx.createImageData(width, height);
    const out = imageData.data;
    const layers = this.config.layers?.length
      ? this.config.layers
      : [
          {
            name: "Tissue",
            depthRange: [0, 1] as [number, number],
            reflectivity: 0.5,
            echogenicity: "isoechoic" as const,
            texture: "homogeneous" as const,
            attenuationCoeff: 0.7,
          },
        ];

    const gain = this.config.gain / 50;
    const focusRatio = this.config.focus / Math.max(0.1, this.config.depth);
    const freq = this.config.frequency;
    const maxDepthCm = this.config.depth;
    const lateralOffset = this.config.lateralOffset ?? 0;
    const isConvex =
      this.config.transducerType === "convex" || this.config.transducerType === "microconvex";

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let depthRatio = y / height;
        let lateral = (x / width - 0.5) * 2;

        if (isConvex) {
          const cx = width / 2;
          const cy = height * 0.08;
          const dx = x - cx;
          const dy = y - cy;
          const angle = Math.atan2(dx, dy);
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxR = height * 0.92;
          if (dist > maxR || dist < 4) {
            const idx = (y * width + x) * 4;
            out[idx] = out[idx + 1] = out[idx + 2] = 0;
            out[idx + 3] = 255;
            continue;
          }
          depthRatio = dist / maxR;
          lateral = angle / (Math.PI / 3);
        }

        const depthCm = depthRatio * maxDepthCm;
        if (depthCm > maxDepthCm) continue;

        const layer = pickLayer(layers, depthRatio);
        let intensity = layer ? echogenicityBase(layer.echogenicity) * layer.reflectivity : 0.45;

        if (layer?.texture === "striated") {
          intensity *= 0.85 + 0.15 * Math.sin((lateral + depthRatio) * 40);
        }

        intensity *= Math.exp(-0.35 * freq * depthRatio * (layer?.attenuationCoeff ?? 0.7));

        const focusDist = Math.abs(depthRatio - focusRatio);
        intensity *= 1 + 0.35 * Math.exp(-focusDist * focusDist / 0.012);

        const beam = Math.exp(-lateral * lateral * (1.2 + depthRatio));
        intensity *= beam;

        intensity *= this.inclusionFactor(lateral + lateralOffset * 0.15, depthCm);

        const speckle =
          this.speckleTile[(x % SPECKLE_TILE) + (y % SPECKLE_TILE) * SPECKLE_TILE] / 255;
        intensity *= 0.72 + speckle * 0.36;

        intensity *= gain;
        intensity = intensity / (1 + intensity * 0.25);
        intensity = Math.max(0, Math.min(1, intensity));

        const gray = Math.round(intensity * 255);
        const idx = (y * width + x) * 4;
        out[idx] = gray;
        out[idx + 1] = gray;
        out[idx + 2] = Math.min(255, gray + 8);
        out[idx + 3] = 255;
      }
    }

    this.ctx.putImageData(imageData, 0, 0);
    this.drawOverlays(width, height);
  }

  private inclusionFactor(lateral: number, depthCm: number): number {
    let factor = 1;
    const enableShadow = this.config.enableAcousticShadow ?? true;
    const enableEnhancement = this.config.enablePosteriorEnhancement ?? true;

    for (const inc of this.config.inclusions ?? []) {
      const dx = lateral - (inc.centerLateralPos ?? 0);
      const dy = depthCm - (inc.centerDepthCm ?? depthCm);
      const rx = (inc.sizeCm?.width ?? 1) / this.config.depth;
      const ry = (inc.sizeCm?.height ?? 0.6) / this.config.depth;
      const d = (dx / Math.max(0.05, rx)) ** 2 + (dy / Math.max(0.05, ry)) ** 2;

      if (d < 1) {
        if (inc.mediumInsideId === "cyst_fluid" || (inc.posteriorEnhancement && enableEnhancement)) {
          factor *= 0.15;
        } else if (inc.hasStrongShadow || inc.mediumInsideId === "bone_cortical") {
          factor *= enableShadow ? 1.6 : 0.55;
        } else {
          factor *= 0.55;
        }
      } else if (enableShadow && (inc.hasStrongShadow || inc.mediumInsideId === "bone_cortical")) {
        const shadowDepth = depthCm - (inc.centerDepthCm ?? 0) - (inc.sizeCm?.height ?? 0.6) * 0.5;
        if (shadowDepth > 0 && Math.abs(dx) < rx * 1.2) {
          factor *= 0.25;
        }
      } else if (enableEnhancement && inc.posteriorEnhancement) {
        const enhanceDepth = depthCm - (inc.centerDepthCm ?? 0) - (inc.sizeCm?.height ?? 0.6) * 0.5;
        if (enhanceDepth > 0 && Math.abs(dx) < rx * 1.1) {
          factor *= 1.35;
        }
      }
    }
    return factor;
  }

  private drawOverlays(width: number, height: number): void {
    if (this.config.showDepthScale) {
      this.ctx.fillStyle = "rgba(0,255,120,0.55)";
      this.ctx.font = "9px monospace";
      const steps = Math.min(6, Math.ceil(this.config.depth));
      for (let i = 0; i <= steps; i++) {
        const yy = (i / steps) * height;
        this.ctx.fillRect(width - 28, yy, 12, 1);
        this.ctx.fillText(`${i}`, width - 16, yy + 3);
      }
    }

    if (this.config.showFocusMarker) {
      const fy = (this.config.focus / Math.max(0.1, this.config.depth)) * height;
      this.ctx.strokeStyle = "rgba(255,255,80,0.7)";
      this.ctx.beginPath();
      this.ctx.moveTo(width * 0.35, fy);
      this.ctx.lineTo(width * 0.65, fy);
      this.ctx.stroke();
    }
  }

  private scheduleRender(): void {
    if (this.renderJob != null) cancelAnimationFrame(this.renderJob);
    this.renderJob = requestAnimationFrame(() => {
      this.renderJob = null;
      this.renderFrame();
    });
  }
}

export type { UltrasoundLayerConfig };
