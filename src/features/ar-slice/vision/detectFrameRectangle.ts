import type { NormalizedQuad, Point2 } from "@/features/ar-slice/vision/types";

const W = 160;
const H = 120;

function luminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function sampleToGray(image: ImageData, tw: number, th: number): Uint8Array {
  const gray = new Uint8Array(tw * th);
  const sx = image.width / tw;
  const sy = image.height / th;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const ix = Math.min(image.width - 1, Math.floor(x * sx));
      const iy = Math.min(image.height - 1, Math.floor(y * sy));
      const i = (iy * image.width + ix) * 4;
      gray[y * tw + x] = luminance(image.data[i], image.data[i + 1], image.data[i + 2]);
    }
  }
  return gray;
}

function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let max = 0;
  let threshold = 90;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > max) {
      max = between;
      threshold = t;
    }
  }
  // Favor detecting dark frames: bias threshold up a bit
  return Math.min(140, Math.max(40, threshold + 10));
}

/** Sobel magnitude → binary edges */
function edges(gray: Uint8Array, tw: number, th: number): Uint8Array {
  const out = new Uint8Array(tw * th);
  for (let y = 1; y < th - 1; y++) {
    for (let x = 1; x < tw - 1; x++) {
      const i = y * tw + x;
      const gx =
        -gray[i - tw - 1] +
        gray[i - tw + 1] -
        2 * gray[i - 1] +
        2 * gray[i + 1] -
        gray[i + tw - 1] +
        gray[i + tw + 1];
      const gy =
        -gray[i - tw - 1] -
        2 * gray[i - tw] -
        gray[i - tw + 1] +
        gray[i + tw - 1] +
        2 * gray[i + tw] +
        gray[i + tw + 1];
      out[i] = Math.hypot(gx, gy) > 70 ? 1 : 0;
    }
  }
  return out;
}

type Contour = Point2[];

function findContours(bin: Uint8Array, tw: number, th: number): Contour[] {
  const visited = new Uint8Array(tw * th);
  const contours: Contour[] = [];
  const dirs = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];

  for (let y = 1; y < th - 1; y++) {
    for (let x = 1; x < tw - 1; x++) {
      const start = y * tw + x;
      if (!bin[start] || visited[start]) continue;

      const contour: Contour = [];
      let cx = x;
      let cy = y;
      let guard = 0;
      while (guard++ < 4000) {
        const idx = cy * tw + cx;
        if (visited[idx]) break;
        visited[idx] = 1;
        contour.push({ x: cx, y: cy });
        let found = false;
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= tw || ny >= th) continue;
          const ni = ny * tw + nx;
          if (bin[ni] && !visited[ni]) {
            cx = nx;
            cy = ny;
            found = true;
            break;
          }
        }
        if (!found) break;
      }
      if (contour.length >= 40) contours.push(contour);
    }
  }
  return contours;
}

function contourAreaBBox(c: Contour) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of c) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  return { minX, minY, maxX, maxY, w, h, area: w * h };
}

function scoreDarkFrame(
  gray: Uint8Array,
  tw: number,
  th: number,
  box: ReturnType<typeof contourAreaBBox>,
  thr: number,
): number {
  // Prefer hollow dark border: border darker than interior
  let border = 0;
  let borderN = 0;
  let inner = 0;
  let innerN = 0;
  const pad = Math.max(2, Math.floor(Math.min(box.w, box.h) * 0.08));
  for (let y = Math.floor(box.minY); y <= Math.floor(box.maxY); y++) {
    for (let x = Math.floor(box.minX); x <= Math.floor(box.maxX); x++) {
      if (x < 0 || y < 0 || x >= tw || y >= th) continue;
      const v = gray[y * tw + x];
      const onBorder =
        x <= box.minX + pad ||
        x >= box.maxX - pad ||
        y <= box.minY + pad ||
        y >= box.maxY - pad;
      if (onBorder) {
        border += v;
        borderN++;
      } else if (
        x > box.minX + pad * 2 &&
        x < box.maxX - pad * 2 &&
        y > box.minY + pad * 2 &&
        y < box.maxY - pad * 2
      ) {
        inner += v;
        innerN++;
      }
    }
  }
  if (!borderN || !innerN) return 0;
  const borderMean = border / borderN;
  const innerMean = inner / innerN;
  const hollow = innerMean - borderMean; // positive if border darker
  const darkEnough = thr - borderMean;
  return hollow * 2 + darkEnough;
}

function orderCorners(corners: Point2[]): [Point2, Point2, Point2, Point2] {
  const sorted = [...corners].sort((a, b) => a.y - b.y || a.x - b.x);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);
  return [top[0], top[1], bottom[1], bottom[0]];
}

/**
 * Detect the largest dark rectangular frame (moldura) in an ImageData.
 * Returns normalized corners in [0,1] image space.
 */
export function detectFrameRectangle(image: ImageData): NormalizedQuad | null {
  if (image.width < 16 || image.height < 16) return null;

  const gray = sampleToGray(image, W, H);
  const thr = otsuThreshold(gray);
  const edge = edges(gray, W, H);

  // Also mark dark pixels as candidates for frame border
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < thr * 0.75) edge[i] = 1;
  }

  const contours = findContours(edge, W, H);
  let best: { box: ReturnType<typeof contourAreaBBox>; score: number } | null = null;

  for (const c of contours) {
    const box = contourAreaBBox(c);
    if (box.w < W * 0.2 || box.h < H * 0.15) continue;
    if (box.w > W * 0.98 || box.h > H * 0.98) continue;
    const aspect = box.w / Math.max(1, box.h);
    if (aspect < 0.45 || aspect > 2.4) continue;
    const fill = c.length / Math.max(1, box.area);
    if (fill < 0.02 || fill > 0.55) continue;
    const score = scoreDarkFrame(gray, W, H, box, thr) + box.area * 0.01;
    if (!best || score > best.score) best = { box, score };
  }

  if (!best || best.score < 5) return null;

  const { minX, minY, maxX, maxY } = best.box;
  const corners = orderCorners([
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]);

  const norm = corners.map((p) => ({
    x: p.x / (W - 1),
    y: p.y / (H - 1),
  })) as [Point2, Point2, Point2, Point2];

  const confidence = Math.max(0.15, Math.min(0.95, best.score / 120));
  return { corners: norm, confidence, source: "js" };
}

/** Decode base64 jpeg/png (no data: prefix) into ImageData via Offscreen/canvas. */
export async function imageDataFromBase64(base64: string): Promise<ImageData | null> {
  const src = base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;
  const img = new Image();
  img.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("image decode failed"));
  });
  img.src = src;
  try {
    await loaded;
  } catch {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  if (canvas.width < 8 || canvas.height < 8) return null;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function imageDataFromVideo(video: HTMLVideoElement, maxW = 320): ImageData | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const scale = Math.min(1, maxW / video.videoWidth);
  const w = Math.max(16, Math.floor(video.videoWidth * scale));
  const h = Math.max(16, Math.floor(video.videoHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}
