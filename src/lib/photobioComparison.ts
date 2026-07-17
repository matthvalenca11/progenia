/**
 * Comparação pedagógica A/B entre snapshots de simulação PBM.
 */

import type { PhotobioAnatomyPreset } from "@/simulation/photobioEngine";
import type { TissueInteractionResult } from "@/simulation/photobioEngine";
import type { PhotobioApplicatorType } from "@/components/labs/photobio/photobioApplicatorTypes";
import type { PhotobioMode, PhotobioViewerTab } from "@/config/photobioPresets";
import type { PhotobioWavelength } from "@/lib/photobioOptics";
import { classifyPhotobioDose } from "@/lib/photobioOptics";

export interface PhotobioLabConfigSnapshot {
  wavelength: PhotobioWavelength;
  power: number;
  spotSize: number;
  exposureTime: number;
  mode: PhotobioMode;
  dutyCycle: number;
  transducerAngle: number;
  contactPressure: number;
  isDragging: boolean;
  draggingSpeed: number;
  anatomyPreset: PhotobioAnatomyPreset;
  applicatorType: PhotobioApplicatorType;
}

export interface PhotobioSnapshot {
  id: string;
  label: string;
  createdAt: number;
  config: PhotobioLabConfigSnapshot;
  interaction: TissueInteractionResult;
}

export interface PhotobioComparisonDeltas {
  deltaEffectiveFluence: number;
  deltaNominalFluence: number;
  deltaMuscleFluence: number;
  deltaMuscleTransmission: number;
  deltaThermalRisk: number;
  deltaRealDoseFactor: number;
  deltaIrradiance: number;
  deltaSuperficialAbsorption: number;
  wavelengthChanged: boolean;
  modeChanged: boolean;
  anatomyChanged: boolean;
}

export interface PhotobioComparisonInsight {
  id: string;
  message: string;
  tone: "positive" | "negative" | "neutral";
}

const THRESH = {
  fluence: 0.4,
  transmission: 0.02,
  thermal: 0.08,
  doseFactor: 0.05,
  irradiance: 25,
} as const;

export function suggestPhotobioSnapshotLabel(config: PhotobioLabConfigSnapshot): string {
  if (config.transducerAngle < 70 || config.contactPressure < 30) {
    return "Técnica inadequada";
  }
  if (config.anatomyPreset === "obese") {
    return `${config.wavelength} nm · obese`;
  }
  if (config.mode === "Pulsed") {
    return `${config.wavelength} nm pulsado`;
  }
  if (config.wavelength === 660) return "660 nm superficial";
  if (config.wavelength === 808) return "808 nm profundo";
  return `${config.wavelength} nm · ${config.power} mW`;
}

export function comparePhotobioInteractions(
  a: TissueInteractionResult,
  b: TissueInteractionResult,
  configA?: PhotobioLabConfigSnapshot,
  configB?: PhotobioLabConfigSnapshot,
): PhotobioComparisonDeltas {
  return {
    deltaEffectiveFluence: b.effectiveFluence - a.effectiveFluence,
    deltaNominalFluence: b.fluence - a.fluence,
    deltaMuscleFluence: b.muscleFluence - a.muscleFluence,
    deltaMuscleTransmission: b.muscleFluenceRatio - a.muscleFluenceRatio,
    deltaThermalRisk: b.thermalRiskIndex - a.thermalRiskIndex,
    deltaRealDoseFactor: b.realDoseFactor - a.realDoseFactor,
    deltaIrradiance: b.irradiance - a.irradiance,
    deltaSuperficialAbsorption: b.superficialAbsorptionIndex - a.superficialAbsorptionIndex,
    wavelengthChanged: configA != null && configB != null && configA.wavelength !== configB.wavelength,
    modeChanged: configA != null && configB != null && configA.mode !== configB.mode,
    anatomyChanged: configA != null && configB != null && configA.anatomyPreset !== configB.anatomyPreset,
  };
}

function doseZoneLabel(f: number): string {
  return classifyPhotobioDose(f).zone;
}

export function buildPhotobioComparisonInsights(
  snapshotA: Pick<PhotobioSnapshot, "label" | "config" | "interaction">,
  snapshotB: Pick<PhotobioSnapshot, "label" | "config" | "interaction">,
): PhotobioComparisonInsight[] {
  const deltas = comparePhotobioInteractions(
    snapshotA.interaction,
    snapshotB.interaction,
    snapshotA.config,
    snapshotB.config,
  );
  const insights: PhotobioComparisonInsight[] = [];

  if (deltas.wavelengthChanged) {
    insights.push({
      id: "wavelength",
      message:
        deltas.deltaMuscleTransmission > THRESH.transmission
          ? `${snapshotB.label}: 808 nm (ou comprimento mais profundo) preservou mais transmissão muscular (+${(deltas.deltaMuscleTransmission * 100).toFixed(0)} pp).`
          : deltas.deltaMuscleTransmission < -THRESH.transmission
            ? `${snapshotB.label} ficou mais superficial — absorção dermal aumentou em relação a ${snapshotA.label}.`
            : `Comprimento de onda mudou (${snapshotA.config.wavelength} → ${snapshotB.config.wavelength}); observe penetração e glow superficial.`,
      tone: deltas.deltaMuscleTransmission > 0 ? "positive" : "neutral",
    });
  }

  if (deltas.modeChanged) {
    insights.push({
      id: "mode",
      message:
        deltas.deltaEffectiveFluence < -THRESH.fluence
          ? "Modo pulsado reduziu fluência efetiva — útil para controlar dose em áreas sensíveis."
          : "Mudança CW ↔ Pulsed alterou entrega temporal de energia.",
      tone: "neutral",
    });
  }

  if (deltas.anatomyChanged) {
    insights.push({
      id: "anatomy",
      message:
        deltas.deltaMuscleTransmission < -THRESH.transmission
          ? "Anatomia com mais adiposo reduziu transmissão muscular — ajuste wavelength e dose."
          : "Mudança de anatomia alterou atenuação subcutânea e entrega profunda.",
      tone: deltas.deltaMuscleTransmission < 0 ? "negative" : "neutral",
    });
  }

  if (Math.abs(deltas.deltaEffectiveFluence) >= THRESH.fluence) {
    const zoneA = doseZoneLabel(snapshotA.interaction.effectiveFluence);
    const zoneB = doseZoneLabel(snapshotB.interaction.effectiveFluence);
    insights.push({
      id: "effective-fluence",
      message:
        deltas.deltaEffectiveFluence > 0
          ? `Fluência efetiva subiu (${zoneA} → ${zoneB}). Verifique se ainda está na janela terapêutica.`
          : `Fluência efetiva caiu — fenômeno dominante pode ter mudado de ${zoneA} para ${zoneB}.`,
      tone:
        zoneB === "therapeutic"
          ? "positive"
          : zoneB === "saturation" || zoneB === "inhibitory"
            ? "negative"
            : "neutral",
    });
  }

  if (Math.abs(deltas.deltaRealDoseFactor) >= THRESH.doseFactor) {
    insights.push({
      id: "technique",
      message:
        deltas.deltaRealDoseFactor > 0
          ? "Técnica melhorou — mais dose nominal virou dose efetiva (ângulo/contato/varredura)."
          : "Técnica piorou — perdas por ângulo, pressão ou velocidade aumentaram.",
      tone: deltas.deltaRealDoseFactor > 0 ? "positive" : "negative",
    });
  }

  if (Math.abs(deltas.deltaThermalRisk) >= THRESH.thermal) {
    insights.push({
      id: "thermal",
      message:
        deltas.deltaThermalRisk > 0
          ? "Risco térmico aumentou — irradiância ou tempo parado elevaram calor superficial."
          : "Risco térmico reduziu — configuração mais segura para PBM.",
      tone: deltas.deltaThermalRisk > 0 ? "negative" : "positive",
    });
  }

  if (Math.abs(deltas.deltaIrradiance) >= THRESH.irradiance) {
    insights.push({
      id: "irradiance",
      message:
        deltas.deltaIrradiance > 0
          ? "Irradiância subiu — spot menor ou potência maior concentrou energia."
          : "Irradiância caiu — entrega mais distribuída ou potência menor.",
      tone: deltas.deltaIrradiance > 80 ? "negative" : "neutral",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "similar",
      message:
        "Configurações muito parecidas — tente mudar wavelength, anatomia ou técnica para ver diferença clara.",
      tone: "neutral",
    });
  }

  const coherent =
    snapshotB.interaction.muscleFluenceRatio >= snapshotA.interaction.muscleFluenceRatio &&
    snapshotB.interaction.thermalRiskIndex <= snapshotA.interaction.thermalRiskIndex + 0.05;
  if (deltas.wavelengthChanged || deltas.anatomyChanged) {
    insights.push({
      id: "coherence",
      message: coherent
        ? `${snapshotB.label} parece mais coerente para alvo profundo com segurança térmica.`
        : `${snapshotA.label} pode ser mais adequado para demonstração superficial ou menor risco.`,
      tone: coherent ? "positive" : "neutral",
    });
  }

  return insights;
}

export function formatPhotobioDelta(value: number, unit: string, decimals = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)} ${unit}`;
}
