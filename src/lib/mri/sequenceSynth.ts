import type { DICOMVolume } from "@/stores/mriLabStore";

export type ClinicalSequenceId = "t1" | "t2" | "flair" | "t1ce";

export interface SynthParams {
  tr: number;
  te: number;
  /** TI (Inversion Time) em ms – usado principalmente em FLAIR/IR */
  ti: number;
  flipAngle: number;
  activeSequence: ClinicalSequenceId;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function norm(v: number, min: number, max: number) {
  return clamp01((v - min) / (max - min || 1));
}

type TissueId = 1 | 2 | 3 | 4 | 5 | 6;
// 1 CSF, 2 White, 3 Gray, 4 Edema, 5 Enhancing, 6 Other

const UNK = 0xff;
const tissueCache = new WeakMap<ArrayBuffer, Uint8Array>();

function getOrCreateTissueMap(volT1: DICOMVolume) {
  const buf = volT1.voxels.buffer;
  const cached = tissueCache.get(buf);
  if (cached) return cached;
  const total = volT1.width * volT1.height * volT1.depth;
  const map = new Uint8Array(total);
  map.fill(UNK);
  tissueCache.set(buf, map);
  return map;
}

function nFromVol(vol: DICOMVolume | null, idx: number) {
  if (!vol) return 0;
  const v = vol.voxels[idx] as number;
  return clamp01((v - vol.min) / (vol.max - vol.min || 1));
}

function classifyTissue(
  idx: number,
  vols: { t1: DICOMVolume | null; t2: DICOMVolume | null; flair: DICOMVolume | null; t1ce: DICOMVolume | null },
): TissueId {
  // Heurísticas simples, baseadas em comportamento típico das sequências:
  const t1 = nFromVol(vols.t1, idx);
  const t2 = nFromVol(vols.t2, idx);
  const fl = nFromVol(vols.flair, idx);
  const t1ce = nFromVol(vols.t1ce, idx);

  // Realce: T1ce significativamente mais alto que T1
  if (vols.t1ce && vols.t1 && t1ce - t1 > 0.18 && t1ce > 0.55) return 5;

  // CSF: muito alto em T2, baixo em T1 e suprimido no FLAIR (quando existir)
  if (t2 > 0.72 && t1 < 0.45 && (!vols.flair || fl < 0.28)) return 1;

  // Edema/água patológica: alto em T2 e alto em FLAIR (não suprimido)
  if (vols.flair && fl > 0.58 && t2 > 0.58) return 4;

  // Substância branca: relativamente alta em T1, baixa em T2/FLAIR
  if (t1 > 0.58 && t2 < 0.48 && (!vols.flair || fl < 0.48)) return 2;

  // Substância cinzenta: intermediária
  if (t1 > 0.42 && t1 < 0.6 && t2 > 0.42 && t2 < 0.62) return 3;

  return 6;
}

function tissueProps(t: TissueId) {
  switch (t) {
    case 1: // CSF
      return { t1: 4000, t2: 2000, pd: 1.0 };
    case 2: // WM
      return { t1: 800, t2: 80, pd: 0.7 };
    case 3: // GM
      return { t1: 1200, t2: 100, pd: 0.85 };
    case 4: // Edema (T2 longo)
      return { t1: 2000, t2: 250, pd: 0.95 };
    case 5: // Enhancing tumor (T1 reduzido por gad)
      return { t1: 600, t2: 120, pd: 0.9 };
    default:
      return { t1: 1400, t2: 120, pd: 0.8 };
  }
}

function rad(deg: number) {
  return (deg * Math.PI) / 180;
}

function signalGRE(pd: number, t1: number, t2s: number, tr: number, te: number, faDeg: number) {
  const E1 = Math.exp(-tr / Math.max(1, t1));
  const E2 = Math.exp(-te / Math.max(1, t2s));
  const a = rad(Math.max(1, Math.min(179, faDeg)));
  const num = Math.sin(a) * (1 - E1);
  const den = 1 - Math.cos(a) * E1;
  return pd * (num / Math.max(1e-6, den)) * E2;
}

function signalSE(pd: number, t1: number, t2: number, tr: number, te: number) {
  const E1 = 1 - Math.exp(-tr / Math.max(1, t1));
  const E2 = Math.exp(-te / Math.max(1, t2));
  return pd * E1 * E2;
}

// Aproximação para sequência de inversão-recuperação (ex.: FLAIR)
// S ~ PD · (1 − 2·e^{−TI/T1} + e^{−TR/T1}) · e^{−TE/T2}
function signalIR(pd: number, t1: number, t2: number, tr: number, te: number, ti: number) {
  const T1 = Math.max(1, t1);
  const T2 = Math.max(1, t2);
  const TR = Math.max(1, tr);
  const TI = Math.max(1, ti);

  const E1_TI = Math.exp(-TI / T1);
  const E1_TR = Math.exp(-TR / T1);
  const E2 = Math.exp(-te / T2);

  const mz = 1 - 2 * E1_TI + E1_TR;
  return pd * mz * E2;
}

function defaultParamsFor(seq: ClinicalSequenceId) {
  switch (seq) {
    case "t2":
      return { tr: 2000, te: 80, ti: 0, flipAngle: 90 };
    case "flair":
      // Valores típicos de FLAIR 1.5T (~TI que “zera” LCR)
      return { tr: 9000, te: 120, ti: 2500, flipAngle: 90 };
    case "t1ce":
      return { tr: 600, te: 15, ti: 0, flipAngle: 90 };
    case "t1":
    default:
      return { tr: 500, te: 15, ti: 0, flipAngle: 90 };
  }
}

export function computeSequenceWeights(
  params: SynthParams,
  available: {
    t1: boolean;
    t2: boolean;
    flair: boolean;
    t1ce: boolean;
  },
): Record<ClinicalSequenceId, number> {
  const nTR = norm(params.tr, 400, 3500);
  const nTE = norm(params.te, 10, 120);
  const nFA = norm(params.flipAngle, 10, 180);

  // “tendência” (0=T1-like, 1=T2-like)
  const t2Tendency = clamp01(0.55 * nTE + 0.35 * nTR + 0.1 * (1 - nFA));
  const t1Tendency = 1 - t2Tendency;

  // Dominância por sequência selecionada + modulação por sliders
  const base = 0.72;
  let wT1 = 0;
  let wT2 = 0;
  let wFlair = 0;
  let wT1ce = 0;

  switch (params.activeSequence) {
    case "t2":
      wT2 = base;
      wT1 = (1 - base) * t1Tendency;
      wFlair = (1 - base) * t2Tendency * 0.6;
      wT1ce = (1 - base) * t1Tendency * 0.4;
      break;
    case "flair":
      wFlair = base;
      wT2 = (1 - base) * t2Tendency;
      wT1 = (1 - base) * t1Tendency * 0.5;
      wT1ce = (1 - base) * t1Tendency * 0.5;
      break;
    case "t1ce":
      wT1ce = base;
      wT1 = (1 - base) * (0.6 + 0.4 * t1Tendency);
      wT2 = (1 - base) * t2Tendency * 0.6;
      wFlair = (1 - base) * t2Tendency * 0.4;
      break;
    case "t1":
    default:
      wT1 = base;
      wT1ce = (1 - base) * (0.6 + 0.4 * t1Tendency);
      wT2 = (1 - base) * t2Tendency;
      wFlair = (1 - base) * t2Tendency * 0.5;
      break;
  }

  // Zerar o que não existe e renormalizar
  const raw: Record<ClinicalSequenceId, number> = {
    t1: available.t1 ? wT1 : 0,
    t2: available.t2 ? wT2 : 0,
    flair: available.flair ? wFlair : 0,
    t1ce: available.t1ce ? wT1ce : 0,
  };

  const sum = raw.t1 + raw.t2 + raw.flair + raw.t1ce;
  if (sum <= 1e-6) {
    // fallback seguro
    return {
      t1: available.t1 ? 1 : 0,
      t2: !available.t1 && available.t2 ? 1 : 0,
      flair: 0,
      t1ce: 0,
    };
  }

  raw.t1 /= sum;
  raw.t2 /= sum;
  raw.flair /= sum;
  raw.t1ce /= sum;
  return raw;
}

export function synthVoxel(
  idx: number,
  vols: {
    t1: DICOMVolume | null;
    t2: DICOMVolume | null;
    flair: DICOMVolume | null;
    t1ce: DICOMVolume | null;
  },
  params: SynthParams,
): number {
  const domVol =
    params.activeSequence === "t2"
      ? vols.t2 ?? vols.t1
      : params.activeSequence === "flair"
      ? vols.flair ?? vols.t2 ?? vols.t1
      : params.activeSequence === "t1ce"
      ? vols.t1ce ?? vols.t1
      : vols.t1 ?? vols.t2;

  if (!domVol) return 0;

  // 1) Classificar “tecido” (cache por voxel no buffer do T1)
  const baseForCache = vols.t1 ?? domVol;
  const map = getOrCreateTissueMap(baseForCache);
  let tid = map[idx];
  if (tid === UNK) {
    tid = classifyTissue(idx, vols) as any;
    map[idx] = tid;
  }

  const props = tissueProps(tid as any);

  // 2) Modelo físico aproximado: usar SE/IR para ponderações clássicas e GRE para sensibilidade ao Flip
  const def = defaultParamsFor(params.activeSequence);
  const tiDef = typeof def.ti === "number" ? def.ti : 0;
  const tiCur = typeof params.ti === "number" ? params.ti : tiDef;

  let sDefSE: number;
  let sCurSE: number;

  if (params.activeSequence === "flair") {
    // Em FLAIR usamos um modelo de inversão-recuperação para captar o “nulled CSF”
    sDefSE = signalIR(props.pd, props.t1, props.t2, def.tr, def.te, tiDef);
    sCurSE = signalIR(props.pd, props.t1, props.t2, params.tr, params.te, tiCur);
  } else {
    sDefSE = signalSE(props.pd, props.t1, props.t2, def.tr, def.te);
    sCurSE = signalSE(props.pd, props.t1, props.t2, params.tr, params.te);
  }

  const sDefGRE = signalGRE(props.pd, props.t1, props.t2, def.tr, def.te, def.flipAngle);
  const sCurGRE = signalGRE(props.pd, props.t1, props.t2, params.tr, params.te, params.flipAngle);

  // Misturar SE/IR + GRE para que Flip Angle tenha efeito perceptível mesmo em sequências SE
  const wFlip = clamp01(norm(params.flipAngle, 10, 180));
  let sDef = (1 - wFlip) * sDefSE + wFlip * sDefGRE;
  let sCur = (1 - wFlip) * sCurSE + wFlip * sCurGRE;

  // Para CSF em FLAIR, aplicar uma supressão MUITO forte em função de TI (nulled CSF)
  if (params.activeSequence === "flair" && tid === 1) {
    const t1 = Math.max(1, props.t1);
    const tiNull = t1 * Math.log(2); // TI ~ T1*ln(2) → magnetização ~0
    const rel = Math.abs(tiCur - tiNull) / tiNull; // 0 perto do nulo, >0 longe
    // Janela de nulagem bem estreita: perto de rel=0, o sinal cai quase a zero,
    // e para rel ≥ 0.25 praticamente não há nulagem (comportamento “on/off” mais realista).
    const csfSuppression = clamp01(1 - rel * 4); // 1 em TI ótimo, 0 em rel ≥ 0.25
    // Quando csfSuppression ~1 (TI ótimo) → extraFactor ~0.03 (CSF quase apagado).
    // Quando csfSuppression ~0 (TI longe) → extraFactor ~1 (CSF volta ao brilho original).
    const extraFactor = 0.03 + 0.97 * (1 - csfSuppression);
    sCur *= extraFactor;
  }

  // Para edema em FLAIR, reforçar hiperintensidade mesmo quando o CSF está nulled.
  if (params.activeSequence === "flair" && tid === 4) {
    // Boost moderado, mas só atua em tecidos que já tinham sinal razoável.
    const boost = 1.35;
    sCur *= boost;
  }

  const factor = sDef > 1e-6 ? sCur / sDef : 1;
  // 3) Aplicar fator relativo no voxel da sequência dominante (preserva “look” do dataset)
  const baseIntensity = domVol.voxels[idx] as number;
  const min = domVol.min;
  const max = domVol.max;
  const range = max - min || 1;
  const x = clamp01((baseIntensity - min) / range);

  // Fator age mais em mid/high; evita estourar background
  const shaped = Math.pow(x, 0.85);
  let signal = clamp01(shaped * factor);

  // 4) Campo de inhomogeneidade suave (B1/B0) + ruído “de scanner”
  // Recuperar coordenadas (x,y,z) do voxel dentro do volume
  const { width, height, depth } = domVol;
  const wh = width * height;
  const ix = idx % width;
  const iy = Math.floor((idx % wh) / width);
  const iz = Math.floor(idx / wh);

  const nx = width > 1 ? ix / (width - 1) : 0.5;
  const ny = height > 1 ? iy / (height - 1) : 0.5;
  const nz = depth > 1 ? iz / (depth - 1) : 0.5;

  // Bias field radial + angular para simular coil / B1 inhomogêneo
  const cx = nx - 0.5;
  const cy = ny - 0.5;
  const r = Math.sqrt(cx * cx + cy * cy);
  const baseBias = 1 + 0.18 * (0.6 * cx + 0.4 * cy) - 0.12 * r * r;
  const angular = 0.06 * Math.cos(2 * Math.PI * nx) * Math.sin(2 * Math.PI * ny);
  const sliceGrad = 0.04 * (nz - 0.5);
  const biasField = clamp01(baseBias + angular + sliceGrad);

  // Ruído pseudo-aleatório determinístico por voxel (não depende de frame)
  const seed = (idx * 374761393 + 1_003_141 * (params.tr | 0) + 97 * (params.te | 0)) >>> 0;
  const randUnit = ((seed ^ (seed >>> 13)) * 1274126177 >>> 0) / 0xffffffff;
  const noiseCentered = (randUnit * 2 - 1); // [-1, 1]

  // Amplitude de ruído um pouco maior para edema / tecidos patológicos
  const isPathologic = tid === 4 || tid === 5;
  const noiseSigma = isPathologic ? 0.045 : 0.03;
  const noise = noiseCentered * noiseSigma;

  // Aplicar bias multiplicativo e ruído aditivo em cima do sinal normalizado
  signal = clamp01(signal * (0.9 + 0.2 * biasField) + noise);

  const out = min + signal * range;
  return out;
}

