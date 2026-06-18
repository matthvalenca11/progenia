/**
 * STACK model compartilhado: pele → gordura → músculo → osso (6 cm total).
 * boneDepth = profundidade desde a superfície onde o osso começa (cm).
 */

import type { AnatomicalScenario } from "@/types/ultrasoundTherapyConfig";
import { resolveStackLayout } from "@/lib/ultrasoundTherapyStackConfig";

export const TOTAL_BLOCK_DEPTH = 6.0;

export interface StackCustomThicknesses {
  skin: number;
  fat: number;
  muscle: number;
  /** Profundidade (cm) onde o osso começa; se omitido, deriva da soma STACK. */
  boneDepth?: number;
}

export interface StackLayerSlice {
  type: "skin" | "fat" | "muscle" | "bone";
  depth: number;
  thickness: number;
}

const TISSUE_PROPERTIES = {
  skin: { attenuationCoeff: 0.5, heatCapacity: 0.8, perfusion: 1.0 },
  fat: { attenuationCoeff: 0.3, heatCapacity: 0.6, perfusion: 0.3 },
  muscle: { attenuationCoeff: 0.7, heatCapacity: 1.0, perfusion: 1.5 },
  bone: { attenuationCoeff: 2.0, heatCapacity: 0.5, perfusion: 0.2 },
} as const;

function buildPresetLayers(
  skin: number,
  fat: number,
  muscle: number,
  boneThickness: number | null,
): StackLayerSlice[] {
  const skinStart = 0;
  const fatStart = skinStart + skin;
  const muscleStart = fatStart + fat;
  const muscleEnd = muscleStart + muscle;

  const layers: StackLayerSlice[] = [
    { type: "skin", depth: skinStart, thickness: skin },
    { type: "fat", depth: fatStart, thickness: fat },
    { type: "muscle", depth: muscleStart, thickness: muscle },
  ];

  if (boneThickness !== null && boneThickness > 0.01) {
    layers.push({
      type: "bone",
      depth: muscleEnd,
      thickness: boneThickness,
    });
  }

  return layers;
}

/** Camadas empilhadas para simulação / visualização 3D. */
export function buildStackLayers(
  scenario: AnatomicalScenario,
  customThicknesses?: StackCustomThicknesses,
): StackLayerSlice[] {
  if (scenario === "custom" && customThicknesses) {
    const layout = resolveStackLayout(customThicknesses);
    const boneThickness = Math.max(0, TOTAL_BLOCK_DEPTH - layout.boneDepth);

    const layers: StackLayerSlice[] = [
      { type: "skin", depth: layout.skinStart, thickness: layout.skin },
      { type: "fat", depth: layout.fatStart, thickness: layout.fat },
      {
        type: "muscle",
        depth: layout.muscleStart,
        thickness: Math.max(0, layout.boneDepth - layout.muscleStart),
      },
    ];

    if (boneThickness > 0.01) {
      layers.push({ type: "bone", depth: layout.boneDepth, thickness: boneThickness });
    }

    return layers;
  }

  switch (scenario) {
    case "shoulder":
      return buildPresetLayers(0.2, 0.5, 2.0, 1.0);
    case "knee":
      return buildPresetLayers(0.2, 0.3, 1.5, 1.0);
    case "lumbar":
      return buildPresetLayers(0.2, 1.0, 3.0, null);
    case "forearm":
      return buildPresetLayers(0.2, 0.2, 1.0, null);
    default:
      return buildPresetLayers(0.2, 0.5, 2.0, null);
  }
}

/** Profundidade onde o osso começa (cm), ou null se não houver osso. */
export function getBoneStartDepth(
  scenario: AnatomicalScenario,
  customThicknesses?: StackCustomThicknesses,
): number | null {
  const boneLayer = buildStackLayers(scenario, customThicknesses).find(
    (l) => l.type === "bone",
  );
  return boneLayer ? boneLayer.depth : null;
}

/** Converte slices STACK para camadas do motor físico. */
export function stackLayersToTissueLayers(slices: StackLayerSlice[]) {
  return slices.map((layer) => ({
    type: layer.type,
    depth: layer.depth,
    thickness: layer.thickness,
    ...TISSUE_PROPERTIES[layer.type],
  }));
}
