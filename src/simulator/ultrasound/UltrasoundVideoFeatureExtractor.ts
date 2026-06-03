/**
 * Analyzes reference ultrasound videos (linear or convex B-mode) and extracts
 * imaging parameters to calibrate the virtual lab simulator.
 */

export type DetectedTransducerType = 'linear' | 'convex' | 'microconvex' | 'unknown';

export type UltrasoundVideoProfile = {
  transducerType: DetectedTransducerType;
  transducerConfidence: number;
  /** Estimated display depth in cm (heuristic from attenuation falloff). */
  depthCm: number;
  /** Suggested TGC / overall gain 35–75. */
  gain: number;
  dynamicRangeDb: number;
  /** 0.5–1.5 mapped from speckle grain size in the clip. */
  speckleIntensity: number;
  /** Suggested MHz from speckle fineness (5–12). */
  frequencyMHz: number;
  /** Focus depth as fraction of depth. */
  focusCm: number;
  attenuationSlope: number;
  nearFieldClutterScore: number;
  acousticShadowScore: number;
  posteriorEnhancementScore: number;
  reverberationScore: number;
  pulsationScore: number;
  motionScore: number;
  /** Normalized depth echogenicity 0–1 per band (top → bottom). */
  depthBands: number[];
  suggestedLayers: Array<{
    name: string;
    mediumId: 'skin' | 'fat' | 'muscle' | 'tendon' | 'blood' | 'generic_soft';
    thicknessCm: number;
    reflectivityBias: number;
  }>;
  framesAnalyzed: number;
  analysisWidth: number;
  analysisHeight: number;
};

export type ExtractVideoProfileOptions = {
  maxFrames?: number;
  sampleStep?: number;
  onProgress?: (progress: number) => void;
};

const DEFAULT_FRAMES = 24;

function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

type Region = { x0: number; y0: number; w: number; h: number };

function detectImageRegion(gray: Float32Array, w: number, h: number): Region {
  const threshold = 0.06;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (gray[y * w + x] > threshold) {
        found = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (!found) return { x0: 0, y0: 0, w, h };

  const padX = Math.floor((maxX - minX) * 0.02);
  const padY = Math.floor((maxY - minY) * 0.02);
  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(w - 1, maxX + padX);
  maxY = Math.min(h - 1, maxY + padY);

  return { x0: minX, y0: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function regionGray(
  gray: Float32Array,
  w: number,
  region: Region,
): { data: Float32Array; w: number; h: number } {
  const rw = region.w;
  const rh = region.h;
  const out = new Float32Array(rw * rh);
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      out[y * rw + x] = gray[(region.y0 + y) * w + (region.x0 + x)];
    }
  }
  return { data: out, w: rw, h: rh };
}

function detectTransducerType(regionGray: Float32Array, rw: number, rh: number): {
  type: DetectedTransducerType;
  confidence: number;
} {
  const topRows = Math.max(3, Math.floor(rh * 0.08));
  const colMeans: number[] = [];

  for (let x = 0; x < rw; x++) {
    let sum = 0;
    let n = 0;
    for (let y = 0; y < topRows; y++) {
      sum += regionGray[y * rw + x];
      n++;
    }
    colMeans.push(sum / n);
  }

  const leftW = Math.floor(rw * 0.15);
  const rightW = Math.floor(rw * 0.15);
  const centerStart = Math.floor(rw * 0.35);
  const centerEnd = Math.floor(rw * 0.65);

  const leftMean = mean(colMeans.slice(0, leftW));
  const rightMean = mean(colMeans.slice(rw - rightW));
  const centerMean = mean(colMeans.slice(centerStart, centerEnd));
  const cornerMean = (leftMean + rightMean) / 2;
  const cornerRatio = centerMean > 0.01 ? cornerMean / centerMean : 1;

  const activeCols = colMeans.filter((v) => v > 0.08).length / rw;

  if (cornerRatio < 0.55 && activeCols > 0.55) {
    const confidence = Math.min(1, (0.55 - cornerRatio) * 2.5 + 0.35);
    return { type: 'convex', confidence };
  }

  if (cornerRatio < 0.72 && activeCols > 0.5) {
    return { type: 'microconvex', confidence: 0.55 };
  }

  if (activeCols > 0.65) {
    return { type: 'linear', confidence: Math.min(1, 0.5 + (cornerRatio - 0.7) * 1.2) };
  }

  return { type: 'unknown', confidence: 0.3 };
}

function depthAttenuationProfile(regionGray: Float32Array, rw: number, rh: number): number[] {
  const profile: number[] = [];
  for (let y = 0; y < rh; y++) {
    let sum = 0;
    let n = 0;
    for (let x = 0; x < rw; x++) {
      const v = regionGray[y * rw + x];
      if (v > 0.04) {
        sum += v;
        n++;
      }
    }
    profile.push(n > 0 ? sum / n : 0);
  }
  return profile;
}

function estimateSpeckleGrain(regionGray: Float32Array, rw: number, rh: number): number {
  const block = 8;
  const samples: number[] = [];
  const yStart = Math.floor(rh * 0.15);
  const yEnd = Math.floor(rh * 0.75);
  const xStart = Math.floor(rw * 0.2);
  const xEnd = Math.floor(rw * 0.8);

  for (let by = yStart; by < yEnd - block; by += block * 2) {
    for (let bx = xStart; bx < xEnd - block; bx += block * 2) {
      const vals: number[] = [];
      for (let dy = 0; dy < block; dy++) {
        for (let dx = 0; dx < block; dx++) {
          vals.push(regionGray[(by + dy) * rw + (bx + dx)]);
        }
      }
      samples.push(stdDev(vals));
    }
  }

  const grain = mean(samples);
  return Math.max(0.02, grain);
}

function shadowScore(regionGray: Float32Array, rw: number, rh: number): number {
  let shadowCols = 0;
  const midH = Math.floor(rh * 0.55);

  for (let x = 0; x < rw; x++) {
    let maxUpper = 0;
    let minLower = 1;
    for (let y = 0; y < midH; y++) {
      maxUpper = Math.max(maxUpper, regionGray[y * rw + x]);
    }
    for (let y = midH; y < rh; y++) {
      minLower = Math.min(minLower, regionGray[y * rw + x]);
    }
    if (maxUpper > 0.35 && minLower < maxUpper * 0.35) shadowCols++;
  }

  return shadowCols / rw;
}

function nearFieldClutterScore(regionGray: Float32Array, rw: number, rh: number): number {
  const nearH = Math.max(4, Math.floor(rh * 0.12));
  const midStart = Math.floor(rh * 0.35);
  const midEnd = Math.floor(rh * 0.55);

  const nearVars: number[] = [];
  const midVars: number[] = [];

  for (let x = 0; x < rw; x += 4) {
    const nearCol: number[] = [];
    const midCol: number[] = [];
    for (let y = 0; y < nearH; y++) nearCol.push(regionGray[y * rw + x]);
    for (let y = midStart; y < midEnd; y++) midCol.push(regionGray[y * rw + x]);
    nearVars.push(stdDev(nearCol));
    midVars.push(stdDev(midCol));
  }

  const ratio = mean(midVars) > 0.001 ? mean(nearVars) / mean(midVars) : 1;
  return Math.max(0, Math.min(1, (ratio - 0.9) / 0.8));
}

function posteriorEnhancementScore(regionGray: Float32Array, rw: number, rh: number): number {
  let hits = 0;
  let tests = 0;

  for (let x = Math.floor(rw * 0.25); x < Math.floor(rw * 0.75); x += 3) {
    for (let y = Math.floor(rh * 0.1); y < Math.floor(rh * 0.65); y++) {
      const v = regionGray[y * rw + x];
      if (v > 0.12) continue;
      const y2 = Math.min(rh - 1, y + Math.floor(rh * 0.08));
      const v2 = regionGray[y2 * rw + x];
      tests++;
      if (v2 > v + 0.12) hits++;
    }
  }

  return tests > 0 ? hits / tests : 0;
}

function reverberationScore(regionGray: Float32Array, rw: number, rh: number): number {
  const cx = Math.floor(rw / 2);
  const col: number[] = [];
  for (let y = 0; y < rh; y++) col.push(regionGray[y * rw + cx]);

  let bestCorr = 0;
  const maxLag = Math.min(40, Math.floor(rh * 0.25));
  for (let lag = 8; lag < maxLag; lag++) {
    let corr = 0;
    let n = 0;
    for (let y = 0; y < rh - lag; y++) {
      corr += col[y] * col[y + lag];
      n++;
    }
    if (n > 0) bestCorr = Math.max(bestCorr, corr / n);
  }

  const baseline = mean(col) ** 2;
  return baseline > 0 ? Math.max(0, Math.min(1, (bestCorr / baseline - 0.85) * 3)) : 0;
}

function pulsationScore(frameMeans: number[]): number {
  if (frameMeans.length < 8) return 0;
  const m = mean(frameMeans);
  if (m < 0.01) return 0;
  const cv = stdDev(frameMeans) / m;
  return Math.min(1, cv * 25);
}

function motionScore(frameDiffs: number[]): number {
  return Math.min(1, mean(frameDiffs) * 8);
}

function mediumFromBrightness(b: number): UltrasoundVideoProfile['suggestedLayers'][0]['mediumId'] {
  if (b < 0.12) return 'blood';
  if (b < 0.22) return 'fat';
  if (b < 0.42) return 'muscle';
  if (b > 0.62) return 'tendon';
  return 'generic_soft';
}

function layerNameForMedium(id: UltrasoundVideoProfile['suggestedLayers'][0]['mediumId'], i: number): string {
  const names: Record<string, string> = {
    skin: 'Pele',
    fat: 'Gordura subcutânea',
    muscle: 'Músculo / parênquima',
    tendon: 'Interface densa',
    blood: 'Estrutura anecoica',
    generic_soft: `Camada ${i + 1}`,
  };
  return names[id] ?? `Camada ${i + 1}`;
}

function suggestLayersFromProfile(
  depthBands: number[],
  totalDepthCm: number,
): UltrasoundVideoProfile['suggestedLayers'] {
  if (!depthBands.length) {
    return [
      { name: 'Pele', mediumId: 'skin', thicknessCm: 0.2, reflectivityBias: 0.05 },
      { name: 'Tecido mole', mediumId: 'muscle', thicknessCm: totalDepthCm - 0.2, reflectivityBias: 0 },
    ];
  }

  const bandDepth = totalDepthCm / depthBands.length;
  return depthBands.map((brightness, i) => {
    const mediumId = i === 0 ? 'skin' : mediumFromBrightness(brightness);
    const reflectivityBias = Math.max(-0.25, Math.min(0.35, (brightness - 0.35) * 0.5));
    return {
      name: layerNameForMedium(mediumId, i),
      mediumId: i === 0 ? 'skin' : mediumId,
      thicknessCm: Math.max(0.15, bandDepth),
      reflectivityBias,
    };
  });
}

function segmentDepthBands(profile: number[], bands = 4): number[] {
  const n = profile.length;
  const bandH = Math.floor(n / bands);
  const result: number[] = [];

  for (let b = 0; b < bands; b++) {
    const start = b * bandH;
    const end = b === bands - 1 ? n : (b + 1) * bandH;
    const slice = profile.slice(start, end).filter((v) => v > 0.02);
    result.push(slice.length ? mean(slice) : 0.1);
  }

  return result;
}

function analyzeGrayFrame(
  gray: Float32Array,
  w: number,
  h: number,
  accum: {
    transducerVotes: Record<string, number>;
    profiles: number[][];
    speckleGrains: number[];
    shadowScores: number[];
    nearFieldScores: number[];
    posteriorScores: number[];
    reverberationScores: number[];
    frameMeans: number[];
    frameDiffs: number[];
    lastGray: Float32Array | null;
  },
): Region {
  const region = detectImageRegion(gray, w, h);
  const { data: rg, w: rw, h: rh } = regionGray(gray, w, region);

  const { type, confidence } = detectTransducerType(rg, rw, rh);
  accum.transducerVotes[type] = (accum.transducerVotes[type] ?? 0) + confidence;

  accum.profiles.push(depthAttenuationProfile(rg, rw, rh));
  accum.speckleGrains.push(estimateSpeckleGrain(rg, rw, rh));
  accum.shadowScores.push(shadowScore(rg, rw, rh));
  accum.nearFieldScores.push(nearFieldClutterScore(rg, rw, rh));
  accum.posteriorScores.push(posteriorEnhancementScore(rg, rw, rh));
  accum.reverberationScores.push(reverberationScore(rg, rw, rh));

  let tissueSum = 0;
  let tissueN = 0;
  for (let i = 0; i < rg.length; i++) {
    if (rg[i] > 0.05) {
      tissueSum += rg[i];
      tissueN++;
    }
  }
  accum.frameMeans.push(tissueN > 0 ? tissueSum / tissueN : 0);

  if (accum.lastGray && accum.lastGray.length === rg.length) {
    let diff = 0;
    for (let i = 0; i < rg.length; i++) diff += Math.abs(rg[i] - accum.lastGray[i]);
    accum.frameDiffs.push(diff / rg.length);
  }
  accum.lastGray = rg.slice();

  return region;
}

function mergeProfiles(profiles: number[][]): number[] {
  if (!profiles.length) return [];
  const len = Math.max(...profiles.map((p) => p.length));
  const merged = new Array(len).fill(0);
  const counts = new Array(len).fill(0);

  for (const p of profiles) {
    for (let i = 0; i < p.length; i++) {
      const idx = Math.floor((i / p.length) * len);
      merged[idx] += p[i];
      counts[idx]++;
    }
  }

  return merged.map((v, i) => (counts[i] > 0 ? v / counts[i] : 0));
}

function estimateDepthCm(profile: number[], transducer: DetectedTransducerType): number {
  const maxV = Math.max(...profile, 0.01);
  let lastActive = 0;
  for (let i = profile.length - 1; i >= 0; i--) {
    if (profile[i] > maxV * 0.1) {
      lastActive = i;
      break;
    }
  }
  const fraction = lastActive / Math.max(1, profile.length - 1);
  const base = transducer === 'convex' || transducer === 'microconvex' ? 10 : 6;
  return Math.round(Math.max(3, Math.min(16, base * (0.55 + fraction * 0.65))) * 10) / 10;
}

function attenuationSlope(profile: number[]): number {
  const samples: { z: number; logI: number }[] = [];
  const maxV = Math.max(...profile, 0.01);
  for (let i = 0; i < profile.length; i++) {
    const z = i / Math.max(1, profile.length - 1);
    const v = profile[i];
    if (v > maxV * 0.08) samples.push({ z, logI: Math.log(v + 0.02) });
  }
  if (samples.length < 4) return 0.5;
  const zMean = mean(samples.map((s) => s.z));
  const lMean = mean(samples.map((s) => s.logI));
  let num = 0;
  let den = 0;
  for (const s of samples) {
    num += (s.z - zMean) * (s.logI - lMean);
    den += (s.z - zMean) ** 2;
  }
  return den > 0 ? Math.abs(num / den) : 0.5;
}

export function buildProfileFromAccum(
  accum: ReturnType<typeof createAccumulator>,
  region: Region,
  framesAnalyzed: number,
): UltrasoundVideoProfile {
  const votes = accum.transducerVotes;
  const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const best = sorted[0];
  const transducerType = (best?.[0] ?? 'unknown') as DetectedTransducerType;
  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
  const transducerConfidence = totalVotes > 0 ? (best?.[1] ?? 0) / totalVotes : 0.3;

  const mergedProfile = mergeProfiles(accum.profiles);
  const depthCm = estimateDepthCm(mergedProfile, transducerType);
  const attSlope = attenuationSlope(mergedProfile);
  const depthBands = segmentDepthBands(mergedProfile, 4);

  const tissueSamples: number[] = [];
  for (const p of accum.profiles) {
    for (const v of p) if (v > 0.05) tissueSamples.push(v);
  }
  tissueSamples.sort((a, b) => a - b);
  const meanLum = mean(tissueSamples);
  const p5 = percentile(tissueSamples, 5);
  const p95 = percentile(tissueSamples, 95);
  const dynamicRangeDb = Math.round(Math.max(45, Math.min(72, 40 + (p95 - p5) * 90)));

  const grain = mean(accum.speckleGrains);
  const speckleIntensity = Math.round(Math.max(0.55, Math.min(1.45, 0.65 + grain * 4.5)) * 100) / 100;
  const frequencyMHz =
    Math.round(Math.max(5, Math.min(12, 11 - speckleIntensity * 3.5)) * 10) / 10;

  const gain = Math.round(Math.max(38, Math.min(72, 32 + meanLum * 75 + attSlope * 8)));

  const focusCm = Math.round(depthCm * (transducerType === 'convex' ? 0.42 : 0.48) * 10) / 10;

  return {
    transducerType,
    transducerConfidence: Math.round(transducerConfidence * 100) / 100,
    depthCm,
    gain,
    dynamicRangeDb,
    speckleIntensity,
    frequencyMHz,
    focusCm,
    attenuationSlope: Math.round(attSlope * 100) / 100,
    nearFieldClutterScore: mean(accum.nearFieldScores),
    acousticShadowScore: mean(accum.shadowScores),
    posteriorEnhancementScore: mean(accum.posteriorScores),
    reverberationScore: mean(accum.reverberationScores),
    pulsationScore: pulsationScore(accum.frameMeans),
    motionScore: motionScore(accum.frameDiffs),
    depthBands,
    suggestedLayers: suggestLayersFromProfile(depthBands, depthCm),
    framesAnalyzed,
    analysisWidth: region.w,
    analysisHeight: region.h,
  };
}

function createAccumulator() {
  return {
    transducerVotes: {} as Record<string, number>,
    profiles: [] as number[][],
    speckleGrains: [] as number[],
    shadowScores: [] as number[],
    nearFieldScores: [] as number[],
    posteriorScores: [] as number[],
    reverberationScores: [] as number[],
    frameMeans: [] as number[],
    frameDiffs: [] as number[],
    lastGray: null as Float32Array | null,
  };
}

/**
 * Extract imaging profile from a loaded HTMLVideoElement (same-origin or CORS-enabled).
 */
export async function extractUltrasoundVideoProfile(
  video: HTMLVideoElement,
  options: ExtractVideoProfileOptions = {},
): Promise<UltrasoundVideoProfile> {
  const maxFrames = options.maxFrames ?? DEFAULT_FRAMES;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D não disponível');

  const analysisW = 320;
  const analysisH = Math.round(analysisW * (video.videoHeight / Math.max(1, video.videoWidth)));

  canvas.width = analysisW;
  canvas.height = Math.max(180, analysisH);

  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('Vídeo sem duração válida — aguarde o carregamento dos metadados');
  }

  const wasPaused = video.paused;
  const prevTime = video.currentTime;
  video.pause();

  const accum = createAccumulator();
  let lastRegion: Region = { x0: 0, y0: 0, w: analysisW, h: canvas.height };

  const times: number[] = [];
  for (let i = 0; i < maxFrames; i++) {
    times.push((duration * (i + 0.5)) / (maxFrames + 1));
  }

  for (let i = 0; i < times.length; i++) {
    video.currentTime = times[i];
    await new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      const onError = () => {
        video.removeEventListener('error', onError);
        reject(new Error('Falha ao buscar frame do vídeo'));
      };
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);
      setTimeout(() => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      }, 2500);
    });

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const gray = new Float32Array(canvas.width * canvas.height);
    for (let p = 0; p < gray.length; p++) {
      const o = p * 4;
      gray[p] = luminance(img.data[o], img.data[o + 1], img.data[o + 2]);
    }

    lastRegion = analyzeGrayFrame(gray, canvas.width, canvas.height, accum);
    options.onProgress?.(Math.round(((i + 1) / times.length) * 100));
  }

  video.currentTime = prevTime;
  if (!wasPaused) void video.play();

  return buildProfileFromAccum(accum, lastRegion, times.length);
}

/**
 * Extract from a local File before upload (object URL).
 */
export async function extractUltrasoundVideoProfileFromFile(
  file: File,
  options: ExtractVideoProfileOptions = {},
): Promise<UltrasoundVideoProfile> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Não foi possível ler o vídeo'));
      setTimeout(() => reject(new Error('Timeout ao carregar vídeo')), 15000);
    });

    return await extractUltrasoundVideoProfile(video, options);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Extract from a remote/public URL (requires CORS on the bucket).
 */
export async function extractUltrasoundVideoProfileFromUrl(
  url: string,
  options: ExtractVideoProfileOptions = {},
): Promise<UltrasoundVideoProfile> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Não foi possível carregar o vídeo (verifique CORS)'));
    setTimeout(() => reject(new Error('Timeout ao carregar vídeo')), 20000);
  });

  return extractUltrasoundVideoProfile(video, options);
}
