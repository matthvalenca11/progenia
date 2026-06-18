/**
 * Configuração cumulativa STACK — cada camada começa onde a anterior termina.
 * Pele (espessura) → gordura → músculo → osso (profundidade absoluta = fim do músculo).
 */

import type { AnatomicalScenario } from "@/types/ultrasoundTherapyConfig";
import { TOTAL_BLOCK_DEPTH, type StackCustomThicknesses } from "@/lib/ultrasoundTherapyStack";

export const DEFAULT_STACK_THICKNESSES: StackCustomThicknesses = {
  skin: 0.2,
  fat: 0.5,
  muscle: 2.0,
  boneDepth: 2.7,
};

export interface StackLayerLayout {
  skin: number;
  fat: number;
  muscle: number;
  boneDepth: number;
  skinStart: number;
  fatStart: number;
  muscleStart: number;
}

export function resolveStackLayout(
  thicknesses?: Partial<StackCustomThicknesses>,
): StackLayerLayout {
  const skin = thicknesses?.skin ?? DEFAULT_STACK_THICKNESSES.skin;
  const fat = thicknesses?.fat ?? DEFAULT_STACK_THICKNESSES.fat;
  const muscle = thicknesses?.muscle ?? DEFAULT_STACK_THICKNESSES.muscle;
  const skinStart = 0;
  const fatStart = skinStart + skin;
  const muscleStart = fatStart + fat;
  const boneDepth = Math.min(TOTAL_BLOCK_DEPTH, muscleStart + muscle);

  return {
    skin,
    fat,
    muscle,
    boneDepth,
    skinStart,
    fatStart,
    muscleStart,
  };
}

export function toStackCustomThicknesses(
  thicknesses?: Partial<StackCustomThicknesses>,
): StackCustomThicknesses {
  const layout = resolveStackLayout(thicknesses);
  return {
    skin: layout.skin,
    fat: layout.fat,
    muscle: layout.muscle,
    boneDepth: layout.boneDepth,
  };
}

/** Aplica patch mantendo empilhamento: osso sempre começa após pele + gordura + músculo. */
export function patchStackThicknesses(
  current: StackCustomThicknesses | undefined,
  patch: Partial<Pick<StackCustomThicknesses, "skin" | "fat" | "muscle">>,
): StackCustomThicknesses {
  const base = resolveStackLayout(current);

  const skin = patch.skin ?? base.skin;
  const fat = patch.fat ?? base.fat;
  const muscle = patch.muscle ?? base.muscle;
  const muscleStart = skin + fat;
  const boneDepth = Math.min(TOTAL_BLOCK_DEPTH, muscleStart + muscle);

  return { skin, fat, muscle, boneDepth };
}

export interface ResolvedMixedLayer {
  enabled: true;
  depth: number;
  division: number;
}

/** Camada mista: profundidade = fim do músculo (STACK); só a divisão lateral é configurável. */
export function resolveMixedLayerConfig(
  scenario: AnatomicalScenario,
  customThicknesses?: StackCustomThicknesses,
  mixedLayer?: { enabled?: boolean; depth?: number; division?: number },
): ResolvedMixedLayer | undefined {
  if (!mixedLayer?.enabled || scenario !== "custom") return undefined;
  return {
    enabled: true,
    depth: resolveStackLayout(customThicknesses).boneDepth,
    division: mixedLayer.division ?? 50,
  };
}
