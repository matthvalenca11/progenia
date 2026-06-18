/**
 * Texturas procedurais opacas — pele e tecidos internos com map + bump
 */

import * as THREE from "three";
import type { ClinicalSkinTone } from "@/lib/clinicalSkinTones";
import { CLINICAL_SKIN_TONES } from "@/lib/clinicalSkinTones";
import { getTissueTextureSize, getTextureDetailScale } from "@/lib/ultrasoundVisualQuality";

export type ClinicalTissueKind = "skin" | "epidermis" | "dermis" | "fat" | "adipose" | "muscle" | "bone";

export interface ClinicalTissueTextureOptions {
  skinTone?: ClinicalSkinTone;
  /** 0–1 — eritema / dano (eletroterapia) */
  lesionIndex?: number;
  /** 0–1 — microvermelhidão cutânea (hiperemia) */
  hyperemiaIndex?: number;
  /** 0–1 — reflexão óssea (brilho periosteal educacional) */
  reflectionIndex?: number;
}

export interface ClinicalTissueMaps {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

const TEX_SIZE = getTissueTextureSize();
const DETAIL = getTextureDetailScale();

function scaledCount(base: number): number {
  return Math.max(4, Math.round(base * DETAIL));
}

type PaintCtx = CanvasRenderingContext2D;
type Rand = () => number;

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createSeededRandom(seed: number): Rand {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function wrapCanvasTexture(
  canvas: HTMLCanvasElement,
  repeat: number,
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = colorSpace;
  texture.anisotropy = DETAIL >= 1 ? 4 : 2;
  texture.needsUpdate = true;
  return texture;
}

function fillBumpBase(ctx: PaintCtx, level = 128) {
  ctx.fillStyle = `rgb(${level}, ${level}, ${level})`;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
}

function bumpDot(ctx: PaintCtx, x: number, y: number, r: number, depth: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  const inner = Math.max(0, Math.min(255, 128 - depth));
  const outer = 128;
  g.addColorStop(0, `rgb(${inner}, ${inner}, ${inner})`);
  g.addColorStop(1, `rgb(${outer}, ${outer}, ${outer})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function bumpStroke(ctx: PaintCtx, width: number, depth: number) {
  ctx.strokeStyle = `rgb(${128 - depth}, ${128 - depth}, ${128 - depth})`;
  ctx.lineWidth = width;
  ctx.stroke();
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function paintSkinSurface(
  ctx: PaintCtx,
  bump: PaintCtx,
  tone: ClinicalSkinTone,
  lesionIndex: number,
  hyperemiaIndex: number,
  rand: Rand,
) {
  const base = hexToRgb(tone.epidermis);
  const warm = [base[0] + 18, base[1] + 8, base[2] - 6] as [number, number, number];
  const cool = [base[0] - 12, base[1] - 4, base[2] + 6] as [number, number, number];
  const flush = [Math.min(255, base[0] + 42), Math.max(0, base[1] - 18), Math.max(0, base[2] - 22)] as [
    number,
    number,
    number,
  ];

  fillBumpBase(bump, 132);

  for (let y = 0; y < TEX_SIZE; y += 4) {
    for (let x = 0; x < TEX_SIZE; x += 4) {
      const t = rand();
      let mixTarget = t > 0.55 ? warm : cool;
      if (hyperemiaIndex > 0.12 && rand() < hyperemiaIndex * 0.35) {
        mixTarget = flush;
      }
      ctx.fillStyle = mixRgb(base, mixTarget, 0.12 + rand() * 0.28);
      ctx.fillRect(x, y, 4, 4);
    }
  }

  for (let i = 0; i < scaledCount(2800); i += 1) {
    const x = rand() * TEX_SIZE;
    const y = rand() * TEX_SIZE;
    const r = rand() * 1.1 + 0.25;
    const poreAlpha = 0.08 + rand() * 0.16 + hyperemiaIndex * 0.12;
    ctx.fillStyle = `rgba(${tone.poreRgb},${poreAlpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < scaledCount(520); i += 1) {
    const x = rand() * TEX_SIZE;
    const y = rand() * TEX_SIZE;
    const r = 1.2 + rand() * 2.8;
    ctx.fillStyle = `rgba(${Math.max(0, base[0] - 55)}, ${Math.max(0, base[1] - 45)}, ${Math.max(0, base[2] - 35)}, ${0.35 + rand() * 0.35})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${tone.poreRgb},0.25)`;
    ctx.lineWidth = 0.4;
    ctx.stroke();
    bumpDot(bump, x, y, r * 1.4, 22 + rand() * 18);
  }

  for (let i = 0; i < 140; i += 1) {
    const x = rand() * TEX_SIZE;
    const y = rand() * TEX_SIZE;
    const r = 3 + rand() * 5;
    ctx.fillStyle = `rgba(${Math.max(0, base[0] - 70)}, ${Math.max(0, base[1] - 55)}, ${Math.max(0, base[2] - 40)}, 0.5)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${tone.poreRgb},0.35)`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(x, y, r + 1.2, 0, Math.PI * 2);
    ctx.stroke();
    bumpDot(bump, x, y, r + 1.5, 30 + rand() * 12);
  }

  for (let i = 0; i < 55; i += 1) {
    const x = rand() * TEX_SIZE;
    const y = rand() * TEX_SIZE;
    const len = 18 + rand() * 42;
    const ang = rand() * Math.PI;
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    ctx.strokeStyle = `rgba(${tone.poreRgb},${0.06 + rand() * 0.1})`;
    ctx.lineWidth = 0.5 + rand() * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    bump.beginPath();
    bump.moveTo(x, y);
    bump.lineTo(x2, y2);
    bumpStroke(bump, 1.2, 8 + rand() * 6);
  }

  for (let i = 0; i < 220; i += 1) {
    const x = rand() * TEX_SIZE;
    const y = rand() * TEX_SIZE;
    const w = 1.5 + rand() * 4;
    ctx.fillStyle = `rgba(${tone.poreRgb},${0.03 + rand() * 0.07})`;
    ctx.fillRect(x, y, w, 0.8 + rand() * 1.5);
  }

  for (let i = 0; i < 80; i += 1) {
    const x = rand() * TEX_SIZE;
    const y = rand() * TEX_SIZE;
    const r = 4 + rand() * 9;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${base[0] - 20}, ${base[1] - 14}, ${base[2] - 8}, 0.35)`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (hyperemiaIndex > 0.08) {
    const capillaries = scaledCount(Math.floor(hyperemiaIndex * 180));
    for (let i = 0; i < capillaries; i += 1) {
      const x = rand() * TEX_SIZE;
      const y = rand() * TEX_SIZE;
      const r = 1.5 + rand() * 4;
      ctx.fillStyle = `rgba(210, 55, 65, ${0.08 + hyperemiaIndex * 0.22})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (lesionIndex > 0.25) {
    const spots = Math.floor(lesionIndex * scaledCount(22));
    for (let i = 0; i < spots; i += 1) {
      const x = rand() * TEX_SIZE;
      const y = rand() * TEX_SIZE;
      const radius = 10 + rand() * 32;
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const a = lesionIndex * 0.8;
      g.addColorStop(0, `rgba(220, 40, 40, ${a})`);
      g.addColorStop(0.55, `rgba(180, 30, 30, ${a * 0.45})`);
      g.addColorStop(1, "rgba(220, 40, 40, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      bumpDot(bump, x, y, radius * 0.6, -10 - lesionIndex * 12);
    }
  }
}

function paintDermis(ctx: PaintCtx, bump: PaintCtx, tone: ClinicalSkinTone, rand: Rand) {
  const base = hexToRgb(tone.dermis);
  ctx.fillStyle = tone.dermis;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  fillBumpBase(bump, 126);

  for (let i = 0; i < 90; i += 1) {
    ctx.strokeStyle = `rgba(150, 38, 52, ${0.1 + rand() * 0.16})`;
    ctx.lineWidth = 0.6 + rand() * 1.4;
    ctx.beginPath();
    let px = rand() * TEX_SIZE;
    let py = rand() * TEX_SIZE;
    ctx.moveTo(px, py);
    for (let j = 0; j < 6; j += 1) {
      px += (rand() - 0.5) * 80;
      py += (rand() - 0.5) * 80;
      ctx.quadraticCurveTo(rand() * TEX_SIZE, rand() * TEX_SIZE, px, py);
    }
    ctx.stroke();
    bump.beginPath();
    bump.moveTo(px, py);
    bumpStroke(bump, 0.8, 6 + rand() * 5);
  }

  for (let i = 0; i < 120; i += 1) {
    const x = rand() * TEX_SIZE;
    const y = rand() * TEX_SIZE;
    const r = 0.8 + rand() * 2.2;
    ctx.fillStyle = `rgba(190, 45, 55, ${0.25 + rand() * 0.35})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (rand() > 0.4) {
      ctx.strokeStyle = `rgba(160, 35, 45, ${0.2 + rand() * 0.25})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 28, y + (rand() - 0.5) * 28);
      ctx.stroke();
    }
  }

  for (let i = 0; i < 35; i += 1) {
    const x = rand() * TEX_SIZE;
    const y = rand() * TEX_SIZE;
    const len = 40 + rand() * 120;
    const ang = rand() * Math.PI;
    ctx.strokeStyle = `rgba(${base[0] - 30}, ${base[1] - 20}, ${base[2] - 15}, 0.22)`;
    ctx.lineWidth = 1.5 + rand() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x + Math.cos(ang) * len * 0.3,
      y + Math.sin(ang) * len * 0.3,
      x + Math.cos(ang + 0.4) * len * 0.7,
      y + Math.sin(ang + 0.4) * len * 0.7,
      x + Math.cos(ang) * len,
      y + Math.sin(ang) * len,
    );
    ctx.stroke();
  }
}

function paintFat(ctx: PaintCtx, bump: PaintCtx, rand: Rand) {
  ctx.fillStyle = "#D4B060";
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  fillBumpBase(bump, 130);

  const lobes = scaledCount(72);
  for (let i = 0; i < lobes; i += 1) {
    const cx = rand() * TEX_SIZE;
    const cy = rand() * TEX_SIZE;
    const rx = TEX_SIZE * (0.045 + rand() * 0.055);
    const ry = TEX_SIZE * (0.038 + rand() * 0.052);
    const rot = rand() * Math.PI * 2;
    const wobble = 0.82 + rand() * 0.36;

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry) * wobble);
    g.addColorStop(0, `rgba(255, 248, 210, ${0.5 + rand() * 0.35})`);
    g.addColorStop(0.55, `rgba(238, 210, 130, ${0.32 + rand() * 0.28})`);
    g.addColorStop(1, "rgba(165, 125, 55, 0.12)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * wobble, ry * (1.1 - rand() * 0.25), rot, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(115, 88, 42, ${0.22 + rand() * 0.28})`;
    ctx.lineWidth = 0.7 + rand() * 1.4;
    ctx.stroke();

    bumpDot(bump, cx, cy, Math.max(rx, ry) * wobble * 0.8, -6 - rand() * 12);
  }

  for (let i = 0; i < scaledCount(48); i += 1) {
    ctx.strokeStyle = "rgba(95, 72, 38, 0.38)";
    ctx.lineWidth = 0.9 + rand() * 1.6;
    ctx.beginPath();
    let px = rand() * TEX_SIZE;
    let py = rand() * TEX_SIZE;
    ctx.moveTo(px, py);
    for (let j = 0; j < 3 + Math.floor(rand() * 3); j += 1) {
      px += (rand() - 0.5) * TEX_SIZE * 0.12;
      py += (rand() - 0.5) * TEX_SIZE * 0.12;
      ctx.quadraticCurveTo(rand() * TEX_SIZE, rand() * TEX_SIZE, px, py);
    }
    ctx.stroke();
    bump.beginPath();
    bump.moveTo(px, py);
    bumpStroke(bump, 1.2, 10 + rand() * 8);
  }

  for (let i = 0; i < scaledCount(35); i += 1) {
    const x1 = rand() * TEX_SIZE;
    const y1 = rand() * TEX_SIZE;
    const x2 = x1 + (rand() - 0.5) * TEX_SIZE * 0.18;
    const y2 = y1 + (rand() - 0.5) * TEX_SIZE * 0.18;
    ctx.strokeStyle = "rgba(110, 85, 45, 0.35)";
    ctx.lineWidth = 1.1 + rand() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function paintMuscle(ctx: PaintCtx, bump: PaintCtx, lesionIndex: number, rand: Rand) {
  const satBoost = Math.min(0.35, lesionIndex * 0.28);
  const baseR = Math.floor(112 + satBoost * 28 - Math.floor(lesionIndex * 22));
  const baseG = Math.floor(32 + satBoost * 8 - Math.floor(lesionIndex * 10));
  const baseB = Math.floor(30 + satBoost * 4 - Math.floor(lesionIndex * 10));
  ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  fillBumpBase(bump, 124);

  const fascicles = scaledCount(32);
  const bundleH = TEX_SIZE / fascicles;
  for (let f = 0; f < fascicles; f += 1) {
    const y0 = f * bundleH;
    const shade = f % 2 === 0 ? 0.42 : 0.22;
    const angle = (f % 3) * 0.04;
    ctx.save();
    ctx.translate(0, y0);
    ctx.rotate(angle);
    ctx.fillStyle = `rgba(${Math.floor(baseR * 0.65)}, ${Math.floor(baseG * 0.5)}, ${Math.floor(baseB * 0.5)}, ${shade})`;
    ctx.fillRect(-TEX_SIZE * 0.02, 0, TEX_SIZE * 1.04, bundleH + 2);

    ctx.fillStyle = "rgba(245, 235, 220, 0.24)";
    ctx.fillRect(0, bundleH - 1.5, TEX_SIZE, 1.2 + rand() * 0.8);
    ctx.restore();
    bump.fillStyle = "rgb(148, 148, 148)";
    bump.fillRect(0, y0 + bundleH - 1, TEX_SIZE, 1.5);
  }

  for (let i = 0; i < scaledCount(280); i += 1) {
    const x = rand() * TEX_SIZE;
    const y = rand() * TEX_SIZE;
    const h = 20 + rand() * 56;
    const w = 1.6 + rand() * 2.8;
    const ang = (rand() - 0.5) * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = `rgba(175, 52, 48, ${0.14 + rand() * 0.24})`;
    ctx.fillRect(0, 0, w, h);
    if (rand() > 0.5) {
      ctx.fillStyle = "rgba(250, 240, 225, 0.2)";
      ctx.fillRect(w, rand() * 8, 0.7, h * 0.75);
    }
    ctx.restore();
  }

  for (let i = 0; i < scaledCount(65); i += 1) {
    ctx.strokeStyle = "rgba(250, 238, 220, 0.42)";
    ctx.lineWidth = 0.6 + rand() * 1.2;
    ctx.beginPath();
    const sx = rand() * TEX_SIZE;
    const sy = rand() * TEX_SIZE;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (rand() - 0.5) * 110, sy + (rand() - 0.5) * 18);
    ctx.stroke();
  }

  if (lesionIndex > 0.2 && lesionIndex <= 0.5) {
    const patches = scaledCount(Math.floor((lesionIndex - 0.2) * 40));
    for (let i = 0; i < patches; i += 1) {
      const x = rand() * TEX_SIZE;
      const y = rand() * TEX_SIZE;
      const radius = 12 + rand() * 28;
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const a = (lesionIndex - 0.2) * 1.2;
      g.addColorStop(0, `rgba(190, 45, 38, ${a})`);
      g.addColorStop(1, "rgba(190, 45, 38, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (lesionIndex > 0.45 && lesionIndex <= 0.72) {
    const tears = scaledCount(Math.floor((lesionIndex - 0.45) * 32));
    for (let i = 0; i < tears; i += 1) {
      const x = rand() * TEX_SIZE;
      const y = rand() * TEX_SIZE;
      const radius = 16 + rand() * 36;
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const a = (lesionIndex - 0.45) * 1.4;
      g.addColorStop(0, `rgba(120, 18, 18, ${a})`);
      g.addColorStop(0.6, `rgba(80, 8, 8, ${a * 0.5})`);
      g.addColorStop(1, "rgba(50, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(40, 0, 0, ${a * 0.4})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.6, y);
      ctx.lineTo(x + radius * 0.5, y + radius * 0.2);
      ctx.stroke();
    }
  }

  if (lesionIndex > 0.72) {
    const dark = scaledCount(Math.floor((lesionIndex - 0.72) * 36));
    for (let i = 0; i < dark; i += 1) {
      const x = rand() * TEX_SIZE;
      const y = rand() * TEX_SIZE;
      const radius = 22 + rand() * 44;
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const a = (lesionIndex - 0.72) * 2.2;
      g.addColorStop(0, `rgba(28, 0, 0, ${a})`);
      g.addColorStop(1, "rgba(28, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = (lesionIndex - 0.72) * 0.35;
    for (let i = 0; i < scaledCount(80); i += 1) {
      ctx.strokeStyle = "rgba(20, 0, 0, 0.5)";
      ctx.lineWidth = 0.5 + rand();
      ctx.beginPath();
      ctx.moveTo(rand() * TEX_SIZE, rand() * TEX_SIZE);
      ctx.lineTo(rand() * TEX_SIZE, rand() * TEX_SIZE);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function paintBone(ctx: PaintCtx, bump: PaintCtx, reflectionIndex: number, rand: Rand) {
  ctx.fillStyle = "#E8E0D4";
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  fillBumpBase(bump, 136);

  for (let i = 0; i < scaledCount(52); i += 1) {
    const x = rand() * TEX_SIZE;
    const y = rand() * TEX_SIZE;
    const r = 4 + rand() * 14;
    ctx.strokeStyle = "rgba(145, 128, 108, 0.62)";
    ctx.lineWidth = 0.8 + rand() * 1.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(200, 188, 170, 0.32)";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    for (let s = 0; s < 3; s += 1) {
      ctx.strokeStyle = "rgba(165, 148, 128, 0.35)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r * (0.45 + s * 0.18), rand() * Math.PI, rand() * Math.PI * 2);
      ctx.stroke();
    }
    bumpDot(bump, x, y, r, -6 - rand() * 8);
  }

  for (let i = 0; i < scaledCount(18); i += 1) {
    const x = rand() * TEX_SIZE;
    const y = rand() * TEX_SIZE;
    const len = 40 + rand() * 120;
    const ang = rand() * Math.PI;
    ctx.strokeStyle = "rgba(140, 125, 105, 0.45)";
    ctx.lineWidth = 0.6 + rand() * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang + 0.9) * len * 0.7, y + Math.sin(ang + 0.9) * len * 0.7);
    ctx.stroke();
  }

  for (let i = 0; i < scaledCount(5000); i += 1) {
    const x = rand() * TEX_SIZE;
    const y = rand() * TEX_SIZE;
    const v = 168 + rand() * 40;
    ctx.fillStyle = `rgba(${v}, ${v - 8}, ${v - 16}, ${0.1 + rand() * 0.26})`;
    ctx.fillRect(x, y, 1, 1);
  }

  if (reflectionIndex > 0.2) {
    const glow = scaledCount(Math.floor(reflectionIndex * 14));
    for (let i = 0; i < glow; i += 1) {
      const x = rand() * TEX_SIZE;
      const y = rand() * TEX_SIZE;
      const r = 8 + rand() * 22;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const a = reflectionIndex * 0.35;
      g.addColorStop(0, `rgba(255, 248, 220, ${a})`);
      g.addColorStop(1, "rgba(255, 248, 220, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function createDualCanvas(): { color: HTMLCanvasElement; bump: HTMLCanvasElement } {
  const color = document.createElement("canvas");
  const bump = document.createElement("canvas");
  color.width = TEX_SIZE;
  color.height = TEX_SIZE;
  bump.width = TEX_SIZE;
  bump.height = TEX_SIZE;
  return { color, bump };
}

export function createClinicalTissueTexture(
  kind: ClinicalTissueKind,
  options: ClinicalTissueTextureOptions = {},
): ClinicalTissueMaps {
  const tone = options.skinTone ?? CLINICAL_SKIN_TONES[1];
  const lesionIndex = options.lesionIndex ?? 0;
  const hyperemiaIndex = options.hyperemiaIndex ?? 0;
  const reflectionIndex = options.reflectionIndex ?? 0;
  const { color, bump } = createDualCanvas();
  const ctx = color.getContext("2d");
  const bumpCtx = bump.getContext("2d");
  if (!ctx || !bumpCtx) {
    return {
      map: wrapCanvasTexture(color, 2),
      bumpMap: wrapCanvasTexture(bump, 2, THREE.NoColorSpace),
    };
  }

  const seed =
    hashString(`${tone.id}:${kind}:${Math.floor(lesionIndex * 1000)}:${Math.floor(hyperemiaIndex * 500)}`) ^
    (kind.length * 9973);
  const rand = createSeededRandom(seed);

  switch (kind) {
    case "skin":
    case "epidermis":
      paintSkinSurface(ctx, bumpCtx, tone, lesionIndex, hyperemiaIndex, rand);
      break;
    case "dermis":
      paintDermis(ctx, bumpCtx, tone, rand);
      break;
    case "fat":
    case "adipose":
      paintFat(ctx, bumpCtx, rand);
      break;
    case "muscle":
      paintMuscle(ctx, bumpCtx, lesionIndex, rand);
      break;
    case "bone":
      paintBone(ctx, bumpCtx, reflectionIndex, rand);
      break;
  }

  const repeat =
    kind === "muscle" ? 3.2 : kind === "bone" ? 4.2 : kind === "fat" || kind === "adipose" ? 1.8 : 2.4;

  return {
    map: wrapCanvasTexture(color, repeat),
    bumpMap: wrapCanvasTexture(bump, repeat, THREE.NoColorSpace),
  };
}

export interface ClinicalTissueTextureSet {
  skin: ClinicalTissueMaps;
  fat: ClinicalTissueMaps;
  muscle: ClinicalTissueMaps;
  bone: ClinicalTissueMaps;
}

export function createClinicalTissueTextureSet(
  options: ClinicalTissueTextureOptions = {},
): ClinicalTissueTextureSet {
  return {
    skin: createClinicalTissueTexture("skin", options),
    fat: createClinicalTissueTexture("fat", options),
    muscle: createClinicalTissueTexture("muscle", options),
    bone: createClinicalTissueTexture("bone", options),
  };
}

/** Materiais opacos — acabamento orgânico com relevo e SSS fake leve */
export const CLINICAL_TISSUE_SURFACE = {
  skin: { roughness: 0.76, metalness: 0.012, bumpScale: 0.016, sssEmissive: "#ffd4c8", sssIntensity: 0.04 },
  fat: { roughness: 0.88, metalness: 0, bumpScale: 0.013 },
  muscle: { roughness: 0.8, metalness: 0.022, bumpScale: 0.01 },
  bone: { roughness: 0.72, metalness: 0.05, bumpScale: 0.008 },
} as const;

export type ClinicalTissueSurfaceKind = keyof typeof CLINICAL_TISSUE_SURFACE;

export function clinicalTissueMaterialProps(
  kind: ClinicalTissueSurfaceKind,
  maps: ClinicalTissueMaps,
  extras?: { hyperemiaIndex?: number; reflectionIndex?: number },
): THREE.MeshStandardMaterialParameters {
  const surface = CLINICAL_TISSUE_SURFACE[kind];
  const params: THREE.MeshStandardMaterialParameters = {
    map: maps.map,
    bumpMap: maps.bumpMap,
    bumpScale: surface.bumpScale,
    roughness: surface.roughness,
    metalness: surface.metalness,
    envMapIntensity: kind === "bone" ? 0.22 : 0.14,
  };

  if (kind === "skin" && "sssEmissive" in surface) {
    const hyper = extras?.hyperemiaIndex ?? 0;
    params.emissive = surface.sssEmissive;
    params.emissiveIntensity = surface.sssIntensity + hyper * 0.08;
  }

  if (kind === "bone" && (extras?.reflectionIndex ?? 0) > 0.22) {
    const refl = extras!.reflectionIndex!;
    params.emissive = "#fff4dc";
    params.emissiveIntensity = (refl - 0.22) * 0.35;
    params.envMapIntensity = 0.28 + refl * 0.2;
  }

  return params;
}
