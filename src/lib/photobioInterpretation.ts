/**
 * Interpretação educacional centralizada — lab PBM.
 * Consome outputs do motor + photobioOptics sem duplicar limiares.
 */

import {
  classifyPhotobioDose,
  formatPhotobioFraction,
  getMuscleEntryDepthMm,
  type PhotobioDepthSample,
  type PhotobioLayerConfig,
  type PhotobioOpticsResult,
  type PhotobioWavelength,
} from "@/lib/photobioOptics";
import type { TissueInteractionResult } from "@/simulation/photobioEngine";

export type PhotobioDominantPhenomenonId =
  | "superficial_absorption"
  | "deep_delivery"
  | "therapeutic_window"
  | "subdose"
  | "saturation"
  | "technique_loss"
  | "thermal_risk"
  | "adipose_attenuation"
  | "transition";

export interface PhotobioDominantEffectInfo {
  id: PhotobioDominantPhenomenonId;
  label: string;
  explanation: string;
  causes: string[];
  accentClass: string;
}

export interface PhotobioTechniqueSuggestion {
  id: string;
  message: string;
  priority: "high" | "medium" | "low";
}

export function resolvePhotobioDominantEffect(
  interaction: TissueInteractionResult,
  optics: Pick<
    PhotobioOpticsResult,
    | "wavelength"
    | "superficialAbsorptionIndex"
    | "deepDeliveryIndex"
    | "thermalRiskIndex"
    | "dominantOpticalPhenomenon"
    | "doseClassification"
  >,
  layerConfig: PhotobioLayerConfig,
  wavelength: PhotobioWavelength,
  skinMelaninIndex = 0.35,
): PhotobioDominantEffectInfo {
  const causes: string[] = [];
  const doseZone = classifyPhotobioDose(interaction.effectiveFluence).zone;
  const adiposeThick = layerConfig.adiposeMm >= 20;

  if (wavelength === 660) causes.push("660 nm (absorção superficial)");
  else causes.push("808 nm (penetração profunda — visual didático NIR)");

  causes.push(`melanina ${(skinMelaninIndex * 100).toFixed(0)}%`);
  causes.push(`abs. superficial ${formatPhotobioFraction(optics.superficialAbsorptionIndex)}`);
  causes.push(`transm. muscular ${formatPhotobioFraction(interaction.muscleFluenceRatio)}`);

  if (interaction.realDoseFactor < 0.95) {
    causes.push(`fator técnico ${(interaction.realDoseFactor * 100).toFixed(0)}%`);
  }
  if (adiposeThick) causes.push(`adiposo ${layerConfig.adiposeMm} mm`);

  if (
    skinMelaninIndex >= 0.55 &&
    wavelength === 660 &&
    optics.superficialAbsorptionIndex >= 0.72
  ) {
    return {
      id: "superficial_absorption",
      label: "Filtragem melanínica superficial",
      explanation:
        `Com melanina ${(skinMelaninIndex * 100).toFixed(0)}%, 660 nm absorve ${formatPhotobioFraction(optics.superficialAbsorptionIndex)} ` +
        `do feixe incidente na epiderme/derme (Beer–Lambert). A fluência efetiva (${interaction.effectiveFluence.toFixed(1)} J/cm²) permanece, ` +
        `mas a transmissão muscular cai para ${formatPhotobioFraction(interaction.muscleFluenceRatio)}.`,
      causes,
      accentClass: "text-orange-500",
    };
  }

  if (optics.thermalRiskIndex >= 0.55 || interaction.thermalWarning) {
    return {
      id: "thermal_risk",
      label: "Risco térmico superficial",
      explanation:
        `Irradiância de ${interaction.irradiance.toFixed(0)} mW/cm² eleva o índice térmico (${(optics.thermalRiskIndex * 100).toFixed(0)}%). ` +
        `Embora a PBM seja predominantemente não térmica, densidades altas podem aquecer a superfície. Considere reduzir potência ou ampliar o spot.`,
      causes: [...causes, `irradiância ${interaction.irradiance.toFixed(0)} mW/cm²`],
      accentClass: "text-red-500",
    };
  }

  if (
    interaction.realDoseFactor < 0.68 &&
    (interaction.techniqueWarnings.length > 0 || interaction.angleEfficiency < 0.75)
  ) {
    return {
      id: "technique_loss",
      label: "Perda por técnica inadequada",
      explanation:
        `A dose efetiva (${interaction.effectiveFluence.toFixed(1)} J/cm²) ficou abaixo da nominal ` +
        `(${(interaction.realDoseFactor * 100).toFixed(0)}% entregue) por combinação de ângulo, contato e/ou velocidade de varredura. ` +
        `Ajustes de técnica podem recuperar fluência sem alterar potência.`,
      causes,
      accentClass: "text-amber-500",
    };
  }

  if (doseZone === "subdose") {
    return {
      id: "subdose",
      label: "Subdose provável",
      explanation:
        `Com ${interaction.effectiveFluence.toFixed(1)} J/cm² efetivos, a simulação situa o protocolo abaixo do limiar de ativação mitocondrial educacional. ` +
        `Aumentar tempo, potência ou melhorar acoplamento óptico pode elevar a resposta simulada.`,
      causes,
      accentClass: "text-slate-400",
    };
  }

  if (doseZone === "saturation" || doseZone === "inhibitory") {
    return {
      id: "saturation",
      label: "Saturação/inibição por dose alta",
      explanation:
        `Fluência efetiva de ${interaction.effectiveFluence.toFixed(1)} J/cm² ultrapassa a janela terapêutica na curva Arndt–Schulz educacional. ` +
        `Doses excessivas podem reduzir o brilho da resposta biológica simulada (bioinibição).`,
      causes,
      accentClass: "text-red-400",
    };
  }

  if (adiposeThick && interaction.muscleFluenceRatio < 0.12) {
    return {
      id: "adipose_attenuation",
      label: "Atenuação por adiposidade elevada",
      explanation:
        `Camada adiposa de ${layerConfig.adiposeMm} mm dispersa e absorve parte relevante do feixe. ` +
        `Apenas ${formatPhotobioFraction(interaction.muscleFluenceRatio)} da fluência efetiva chega ao músculo. ` +
        `Comparar 808 nm e revisar parâmetros de entrega pode ajudar em alvos profundos.`,
      causes,
      accentClass: "text-yellow-500",
    };
  }

  if (doseZone === "therapeutic") {
    if (wavelength === 660 && optics.superficialAbsorptionIndex > 0.55) {
      return {
        id: "superficial_absorption",
        label: "Absorção superficial predominante",
        explanation:
          `660 nm absorve ${formatPhotobioFraction(optics.superficialAbsorptionIndex)} do feixe na epiderme/derme ` +
          `com dose efetiva na janela terapêutica. Adequado para alvos superficiais; transmissão muscular ${formatPhotobioFraction(interaction.muscleFluenceRatio)}.`,
        causes,
        accentClass: "text-orange-400",
      };
    }
    if (wavelength === 808 && optics.deepDeliveryIndex > 0.08) {
      return {
        id: "deep_delivery",
        label: "Entrega profunda favorecida",
        explanation:
          `808 nm (representado didaticamente em magenta no viewer) penetra adiposo e alcança o músculo com ` +
          `transmissão de ${formatPhotobioFraction(interaction.muscleFluenceRatio)} (stack: ${formatPhotobioFraction(optics.deepDeliveryIndex)}), dentro da janela terapêutica efetiva.`,
        causes,
        accentClass: "text-fuchsia-400",
      };
    }
    return {
      id: "therapeutic_window",
      label: "Janela terapêutica ativa",
      explanation:
        `Fluência efetiva de ${interaction.effectiveFluence.toFixed(1)} J/cm² situa o protocolo na faixa de ativação mitocondrial simulada. ` +
        `${optics.dominantOpticalPhenomenon}. Transmissão muscular: ${formatPhotobioFraction(interaction.muscleFluenceRatio)}.`,
      causes,
      accentClass: "text-emerald-400",
    };
  }

  return {
    id: "transition",
    label: "Transição entre zonas biológicas",
    explanation:
      `Dose efetiva (${interaction.effectiveFluence.toFixed(1)} J/cm²) entre faixas da curva Arndt–Schulz. ` +
      `${optics.dominantOpticalPhenomenon}. Pequenos ajustes de tempo ou técnica podem otimizar a resposta.`,
    causes,
    accentClass: "text-amber-400",
  };
}

export function buildPhotobioTechniqueSuggestions(
  interaction: TissueInteractionResult,
  layerConfig: PhotobioLayerConfig,
  wavelength: PhotobioWavelength,
  transducerAngle: number,
  isDragging: boolean,
  draggingSpeed: number,
  irradiance: number,
  spotSize: number,
): PhotobioTechniqueSuggestion[] {
  const suggestions: PhotobioTechniqueSuggestion[] = [];

  if (transducerAngle < 70 || transducerAngle > 110) {
    suggestions.push({
      id: "angle",
      message: "Aproxime o ângulo de incidência para ~90° para maximizar a eficiência óptica.",
      priority: "high",
    });
  }
  if (isDragging && draggingSpeed > 1.4) {
    suggestions.push({
      id: "speed",
      message: "Reduza a velocidade de varredura — movimento rápido subdosa regiões do mapa.",
      priority: "high",
    });
  }
  if (!isDragging && interaction.effectiveFluence > 25) {
    suggestions.push({
      id: "stationary",
      message: "Evite manter o aplicador parado por longos períodos — risco de concentração local.",
      priority: "medium",
    });
  }
  if (interaction.contactOpticalCoupling < 0.78) {
    suggestions.push({
      id: "contact",
      message: "Melhore o contato óptico (pressão moderada, lente em apoio) para reduzir reflexão superficial.",
      priority: "high",
    });
  }
  if (irradiance > 400) {
    suggestions.push({
      id: "spot",
      message: "Aumente a área do spot se a irradiância estiver alta, para distribuir potência.",
      priority: "medium",
    });
  }
  if (layerConfig.adiposeMm >= 20 && interaction.muscleFluenceRatio < 0.2) {
    suggestions.push({
      id: "adipose",
      message: "Em adiposidade elevada, observe a perda de fluência no músculo e ajuste expectativa de profundidade.",
      priority: "medium",
    });
    if (wavelength === 660) {
      suggestions.push({
        id: "808",
        message: "Considere 808 nm para alvo mais profundo (visual didático do infravermelho no viewer).",
        priority: "low",
      });
    }
  }
  if (spotSize < 0.25 && irradiance > 350) {
    suggestions.push({
      id: "spot-small",
      message: "Spot pequeno concentra irradiância — verifique conforto térmico superficial.",
      priority: "low",
    });
  }

  return suggestions.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
}

export interface PhotobioInterpretationContext {
  interaction: TissueInteractionResult;
  dominantEffect: PhotobioDominantEffectInfo;
  techniqueSuggestions: PhotobioTechniqueSuggestion[];
  depthSamples: PhotobioDepthSample[];
  muscleEntryDepthMm: number;
}

export function buildPhotobioInterpretation(
  interaction: TissueInteractionResult,
  layerConfig: PhotobioLayerConfig,
  wavelength: PhotobioWavelength,
  transducerAngle: number,
  isDragging: boolean,
  draggingSpeed: number,
  irradiance: number,
  spotSize: number,
  skinMelaninIndex: number,
): PhotobioInterpretationContext {
  const dominantEffect = resolvePhotobioDominantEffect(
    interaction,
    {
      wavelength: interaction.opticsWavelength ?? wavelength,
      superficialAbsorptionIndex: interaction.superficialAbsorptionIndex,
      deepDeliveryIndex: interaction.deepDeliveryIndex,
      thermalRiskIndex: interaction.thermalRiskIndex,
      dominantOpticalPhenomenon: interaction.dominantOpticalPhenomenon,
      doseClassification: classifyPhotobioDose(interaction.effectiveFluence),
    },
    layerConfig,
    wavelength,
    skinMelaninIndex,
  );

  return {
    interaction,
    dominantEffect,
    techniqueSuggestions: buildPhotobioTechniqueSuggestions(
      interaction,
      layerConfig,
      wavelength,
      transducerAngle,
      isDragging,
      draggingSpeed,
      irradiance,
      spotSize,
    ),
    depthSamples: interaction.depthSamples,
    muscleEntryDepthMm: getMuscleEntryDepthMm(layerConfig),
  };
}

export { getMuscleEntryDepthMm };
