/**
 * Perfil térmico por profundidade — amostra o mapa de interação no eixo do feixe.
 */

import type { UltrasoundInteractionMap } from "@/lib/ultrasoundTherapyInteractionMap";

export interface ThermalDepthSample {
  depthCm: number;
  centerTemp: number;
  midTemp: number;
  edgeTemp: number;
  beamRadiusCm: number;
  centerIntensity: number;
}

function weightedTemp(cells: Array<{ temp: number; weight: number }>): number {
  if (cells.length === 0) return 37;
  let sum = 0;
  let w = 0;
  for (const c of cells) {
    sum += c.temp * c.weight;
    w += c.weight;
  }
  return w > 0 ? sum / w : 37;
}

export function buildThermalDepthProfile(
  interactionMap: UltrasoundInteractionMap,
  beamRadiusAtDepth: (depthCm: number) => number,
  stepCm = 0.14,
): ThermalDepthSample[] {
  const maxDepth = interactionMap.maxDepthCm;
  const samples: ThermalDepthSample[] = [];

  for (let depth = 0.06; depth <= maxDepth + 0.001; depth += stepCm) {
    const centerCells: Array<{ temp: number; weight: number }> = [];
    const midCells: Array<{ temp: number; weight: number }> = [];
    const edgeCells: Array<{ temp: number; weight: number }> = [];

    for (const cell of interactionMap.cells) {
      if (Math.abs(cell.depthCm - depth) > stepCm * 0.55) continue;
      const ax = Math.abs(cell.xNorm);
      const w = cell.relativeIntensity;
      const entry = { temp: cell.estimatedTemp, weight: w };
      if (ax < 0.18) centerCells.push(entry);
      else if (ax < 0.55) midCells.push(entry);
      else edgeCells.push(entry);
    }

    const centerTemp = weightedTemp(centerCells);
    const midTemp = weightedTemp(midCells.length > 0 ? midCells : centerCells);
    const edgeTemp = weightedTemp(edgeCells.length > 0 ? edgeCells : midCells);
    const centerIntensity =
      centerCells.reduce((s, c) => s + c.weight, 0) / Math.max(1, centerCells.length);

    if (centerTemp < 37.25 && centerIntensity < 0.08) continue;

    samples.push({
      depthCm: depth,
      centerTemp,
      midTemp,
      edgeTemp,
      beamRadiusCm: Math.max(0.12, beamRadiusAtDepth(depth)),
      centerIntensity,
    });
  }

  return samples;
}
