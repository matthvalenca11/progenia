/**
 * Geometria orgânica — interfaces suaves entre camadas de tecido (cross-section educacional)
 */

import * as THREE from "three";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Ondulação compartilhada na fronteira entre duas camadas (mesmo seed = encaixe perfeito) */
export function tissueInterfaceWave(
  x: number,
  z: number,
  boundarySeed: number,
  amplitude: number,
): number {
  if (amplitude <= 0) return 0;
  const s = boundarySeed * 0.173;
  // Baixa frequência + harmonico suave — orgânico sem degraus
  const low =
    Math.sin(x * 0.22 + s * 1.1) * Math.cos(z * 0.19 + s * 0.85) * 0.62 +
    Math.sin(x * 0.09 + z * 0.11 + s * 1.6) * 0.24;
  const mid =
    Math.sin(x * 0.38 + z * 0.31 + s * 2.2) * Math.cos(z * 0.34 + s * 1.4) * 0.14;
  return (low + mid) * amplitude;
}

/** Meio-termo entre cross-section plano (0.5) e ondulação forte (1.32) */
export const TISSUE_WAVE_INTENSITY = 0.88;

/** Micro-relevo na superfície cutânea (rugas finas) */
const SKIN_SURFACE_MICRO_AMP = 0.0036;

/** Segmentação — subdivisões suficientes para curvas suaves sem artefatos */
export const ORGANIC_LAYER_SEGMENTS: [number, number, number] = [40, 9, 22];

/**
 * Deslocamento máximo nas interfaces internas (cm).
 * Valor fixo garante que camadas adjacentes (mesmo seed) encaixem sem degraus.
 */
export const SHARED_INTERFACE_AMP_CM = 0.032;

/** Relevo interno no miolo da camada (zero nas bordas — não quebra encaixe) */
const MID_LAYER_BULK_RATIO = 0.38;

/** Multiplicadores reservados para ajuste fino por tipo (relativos ao amp compartilhado) */
export const ORGANIC_LAYER_WAVE = {
  skin: { top: 0.02, bottom: 1 },
  epidermis: { top: 0.03, bottom: 1 },
  dermis: { top: 0.85, bottom: 0.85 },
  fat: { top: 1, bottom: 1 },
  adipose: { top: 1, bottom: 1 },
  muscle: { top: 1, bottom: 0.85 },
  bone: { top: 0.85, bottom: 0.52 },
} as const;

export type OrganicLayerKind = keyof typeof ORGANIC_LAYER_WAVE;

const SKIN_LIKE_KINDS = new Set<OrganicLayerKind>(["skin", "epidermis"]);

export interface OrganicLayerGeometryOptions {
  width: number;
  height: number;
  depth: number;
  boundarySeedTop: number;
  boundarySeedBottom: number;
  kind?: OrganicLayerKind;
  topAmplitudeScale?: number;
  bottomAmplitudeScale?: number;
  segments?: [number, number, number];
}

function interfaceAmplitudeCm(
  layerHeight: number,
  edgeScale: number,
  overrideScale?: number,
): number {
  if (overrideScale != null) {
    return layerHeight * overrideScale * TISSUE_WAVE_INTENSITY;
  }
  const scaled = SHARED_INTERFACE_AMP_CM * edgeScale * TISSUE_WAVE_INTENSITY;
  return Math.min(scaled, layerHeight * 0.14);
}

export function buildOrganicLayerGeometry({
  width,
  height,
  depth,
  boundarySeedTop,
  boundarySeedBottom,
  kind = "muscle",
  topAmplitudeScale,
  bottomAmplitudeScale,
  segments = ORGANIC_LAYER_SEGMENTS,
}: OrganicLayerGeometryOptions): THREE.BufferGeometry {
  const wave = ORGANIC_LAYER_WAVE[kind];
  const topAmp = interfaceAmplitudeCm(height, wave.top, topAmplitudeScale);
  const bottomAmp = interfaceAmplitudeCm(height, wave.bottom, bottomAmplitudeScale);
  const midAmp = Math.min(topAmp, bottomAmp) * MID_LAYER_BULK_RATIO;
  const midSeed = boundarySeedTop * 0.62 + boundarySeedBottom * 0.38;
  const [segX, segY, segZ] = segments;

  const geometry = new THREE.BoxGeometry(width, height, depth, segX, segY, segZ);
  const pos = geometry.attributes.position;
  const halfH = height / 2;
  const blendBand = Math.max(height * 0.52, 0.006);

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const distTop = halfH - y;
    const distBottom = y + halfH;
    const topW = clamp(1 - distTop / blendBand, 0, 1);
    const bottomW = clamp(1 - distBottom / blendBand, 0, 1);

    const dy =
      tissueInterfaceWave(x, z, boundarySeedTop, topAmp) * topW +
      tissueInterfaceWave(x, z, boundarySeedBottom, bottomAmp) * bottomW;

    const midW = clamp((4 * (distTop / halfH) * (distBottom / halfH)), 0, 1);
    const bulkDy = midW > 0.02 ? tissueInterfaceWave(x, z, midSeed, midAmp) * midW : 0;

    let microY = 0;
    if (SKIN_LIKE_KINDS.has(kind) && topW > 0.02) {
      const micro =
        Math.sin(x * 1.6 + boundarySeedTop * 0.11) * Math.cos(z * 1.8 + boundarySeedTop * 0.09) * 0.6 +
        Math.sin(x * 2.4 + z * 0.9 + boundarySeedTop * 0.17) * 0.2;
      microY = micro * SKIN_SURFACE_MICRO_AMP * topW;
    }

    pos.setXYZ(i, x, y + dy + bulkDy + microY, z);
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

export function createTissueStackSeed(): number {
  return Math.floor(Math.random() * 10000) + 1;
}

export function tissueBoundarySeed(stackSeed: number, layerIndex: number): number {
  return stackSeed + layerIndex * 31 + 7;
}
