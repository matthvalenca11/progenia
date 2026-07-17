/**
 * Configuration types for Photobiomodulation (PBM) Lab
 */

import type { PhotobioApplicatorType } from "@/components/labs/photobio/photobioApplicatorTypes";
import type { PhotobioLabMode, PhotobioMode, PhotobioViewerTab } from "@/config/photobioPresets";
import { PHOTOBIO_CLINICAL_PRESETS } from "@/config/photobioPresets";
import { calculateTissueInteraction } from "@/simulation/photobioEngine";
import type { PhotobioAnatomyPreset, PhotobioLayerConfig } from "@/simulation/photobioEngine";
import type { PhotobioWavelength } from "@/lib/photobioOptics";
import { classifyPhotobioDose, PHOTOBIO_DOSE_THRESHOLDS } from "@/lib/photobioOptics";

export type PhotobioTargetTissue = "superficial" | "subcutaneous" | "muscle" | "mixed";

export type PhotobioScenarioKey =
  | "superficialRepair"
  | "deepAnalgesia"
  | "inflammation"
  | "obesePatient"
  | "overdoseExample"
  | "custom";

export type PhotobioControlVisibilityMode = "show" | "hidden" | "disabled";

export interface PhotobioNumericRange {
  min: number;
  max: number;
  step?: number;
}

export interface PhotobioControlModes {
  showWavelength: PhotobioControlVisibilityMode;
  showPower: PhotobioControlVisibilityMode;
  showSpotSize: PhotobioControlVisibilityMode;
  showExposureTime: PhotobioControlVisibilityMode;
  showMode: PhotobioControlVisibilityMode;
  showDutyCycle: PhotobioControlVisibilityMode;
  showTechnique: PhotobioControlVisibilityMode;
  showAnatomyPresets: PhotobioControlVisibilityMode;
  showCustomAnatomy: PhotobioControlVisibilityMode;
  showMelanin: PhotobioControlVisibilityMode;
  showApplicatorType: PhotobioControlVisibilityMode;
}

export interface PhotobioFeatureFlags {
  showGuidedMode: boolean;
  showSnapshots: boolean;
  showAdvancedPhysics: boolean;
  showClinicalPresets: boolean;
}

export interface PhotobioLabConfig {
  scenario: PhotobioScenarioKey;
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
  applicatorType: PhotobioApplicatorType;
  anatomyPreset: PhotobioAnatomyPreset;
  layerConfig: PhotobioLayerConfig;
  skinMelaninIndex: number;
  targetTissue: PhotobioTargetTissue;
  viewerTab: PhotobioViewerTab;
  initialLabMode: PhotobioLabMode;
  controlModes: PhotobioControlModes;
  featureFlags: PhotobioFeatureFlags;
  ranges: {
    power: PhotobioNumericRange;
    spotSize: PhotobioNumericRange;
    exposureTime: PhotobioNumericRange;
    dutyCycle: PhotobioNumericRange;
    transducerAngle: PhotobioNumericRange;
    contactPressure: PhotobioNumericRange;
    layerThickness: {
      epidermisMm: PhotobioNumericRange;
      dermisMm: PhotobioNumericRange;
      adiposeMm: PhotobioNumericRange;
      muscleMm: PhotobioNumericRange;
    };
    skinMelaninIndex: PhotobioNumericRange;
  };
}

export const PHOTOBIO_ANATOMY_LAYER_PRESETS: Record<PhotobioAnatomyPreset, PhotobioLayerConfig> = {
  default: { epidermisMm: 1, dermisMm: 4, adiposeMm: 15, muscleMm: 25 },
  elderly: { epidermisMm: 0.5, dermisMm: 2, adiposeMm: 10, muscleMm: 12 },
  athlete: { epidermisMm: 1, dermisMm: 4, adiposeMm: 5, muscleMm: 35 },
  obese: { epidermisMm: 1, dermisMm: 4, adiposeMm: 40, muscleMm: 10 },
  custom: { epidermisMm: 1, dermisMm: 4, adiposeMm: 15, muscleMm: 25 },
};

export const PHOTOBIO_SCENARIO_LABELS: Record<PhotobioScenarioKey, string> = {
  superficialRepair: "Reparo tecidual superficial",
  deepAnalgesia: "Analgesia / alvo muscular",
  inflammation: "Anti-inflamatório subcutâneo",
  obesePatient: "Adiposidade elevada",
  overdoseExample: "Exemplo: overdose / saturação",
  custom: "Personalizado",
};

export const PHOTOBIO_TARGET_TISSUE_LABELS: Record<PhotobioTargetTissue, string> = {
  superficial: "Superficial (epiderme/derme)",
  subcutaneous: "Subcutâneo / adiposo",
  muscle: "Músculo profundo",
  mixed: "Misto / demonstração",
};

export const PHOTOBIO_APPLICATOR_LABELS: Record<PhotobioApplicatorType, string> = {
  cluster: "Cluster LED",
  pointLaser: "Laser pontual",
  dualWavelengthCluster: "Cluster dual 660/808",
  largeAreaPanel: "Painel grande área",
};

const PRESET_TO_SCENARIO: Record<string, PhotobioScenarioKey> = {
  "superficial-repair": "superficialRepair",
  "deep-analgesia": "deepAnalgesia",
  "subcutaneous-antiinflammatory": "inflammation",
  "obese-deep-target": "obesePatient",
  "bad-overdose": "overdoseExample",
};

export const PHOTOBIO_SCENARIO_PRESETS: Record<
  Exclude<PhotobioScenarioKey, "custom">,
  Partial<PhotobioLabConfig>
> = {
  superficialRepair: {
    wavelength: 660,
    power: 80,
    spotSize: 0.45,
    exposureTime: 40,
    mode: "CW",
    transducerAngle: 90,
    contactPressure: 55,
    isDragging: false,
    anatomyPreset: "default",
    applicatorType: "cluster",
    targetTissue: "superficial",
    viewerTab: "beam",
    skinMelaninIndex: 0.35,
  },
  deepAnalgesia: {
    wavelength: 808,
    power: 120,
    spotSize: 0.85,
    exposureTime: 50,
    mode: "CW",
    transducerAngle: 90,
    contactPressure: 60,
    anatomyPreset: "athlete",
    applicatorType: "dualWavelengthCluster",
    targetTissue: "muscle",
    viewerTab: "penetration",
    skinMelaninIndex: 0.3,
  },
  inflammation: {
    wavelength: 808,
    power: 100,
    spotSize: 0.6,
    exposureTime: 45,
    mode: "Pulsed",
    dutyCycle: 50,
    transducerAngle: 90,
    contactPressure: 55,
    anatomyPreset: "default",
    applicatorType: "dualWavelengthCluster",
    targetTissue: "subcutaneous",
    viewerTab: "penetration",
  },
  obesePatient: {
    wavelength: 808,
    power: 150,
    spotSize: 0.75,
    exposureTime: 60,
    mode: "CW",
    transducerAngle: 90,
    contactPressure: 55,
    anatomyPreset: "obese",
    applicatorType: "dualWavelengthCluster",
    targetTissue: "muscle",
    viewerTab: "penetration",
  },
  overdoseExample: {
    wavelength: 660,
    power: 450,
    spotSize: 0.15,
    exposureTime: 120,
    mode: "CW",
    transducerAngle: 90,
    contactPressure: 40,
    isDragging: false,
    draggingSpeed: 1,
    anatomyPreset: "default",
    applicatorType: "pointLaser",
    targetTissue: "superficial",
    viewerTab: "bioresponse",
  },
};

export const defaultPhotobioLabConfig: PhotobioLabConfig = {
  scenario: "custom",
  wavelength: 660,
  power: 100,
  spotSize: 0.5,
  exposureTime: 30,
  mode: "CW",
  dutyCycle: 50,
  transducerAngle: 90,
  contactPressure: 50,
  isDragging: false,
  draggingSpeed: 1,
  applicatorType: "dualWavelengthCluster",
  anatomyPreset: "default",
  layerConfig: { ...PHOTOBIO_ANATOMY_LAYER_PRESETS.default },
  skinMelaninIndex: 0.35,
  targetTissue: "mixed",
  viewerTab: "anatomy",
  initialLabMode: "free",
  controlModes: {
    showWavelength: "show",
    showPower: "show",
    showSpotSize: "show",
    showExposureTime: "show",
    showMode: "show",
    showDutyCycle: "show",
    showTechnique: "show",
    showAnatomyPresets: "show",
    showCustomAnatomy: "show",
    showMelanin: "hidden",
    showApplicatorType: "hidden",
  },
  featureFlags: {
    showGuidedMode: true,
    showSnapshots: true,
    showAdvancedPhysics: true,
    showClinicalPresets: true,
  },
  ranges: {
    power: { min: 10, max: 500, step: 1 },
    spotSize: { min: 0.1, max: 1.0, step: 0.01 },
    exposureTime: { min: 1, max: 300, step: 1 },
    dutyCycle: { min: 10, max: 90, step: 1 },
    transducerAngle: { min: 30, max: 150, step: 1 },
    contactPressure: { min: 0, max: 100, step: 1 },
    layerThickness: {
      epidermisMm: { min: 0.2, max: 3, step: 0.1 },
      dermisMm: { min: 0.5, max: 10, step: 0.1 },
      adiposeMm: { min: 1, max: 60, step: 0.5 },
      muscleMm: { min: 5, max: 60, step: 0.5 },
    },
    skinMelaninIndex: { min: 0.1, max: 0.9, step: 0.05 },
  },
};

/** @deprecated alias — use defaultPhotobioLabConfig */
export const defaultPhotobioConfig = defaultPhotobioLabConfig;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function mergeControlModes(
  partial?: Partial<PhotobioControlModes> | Record<string, PhotobioControlVisibilityMode>,
  legacy?: Record<string, boolean>,
  legacyDisplayMode?: "hidden" | "disabled",
): PhotobioControlModes {
  const base = { ...defaultPhotobioLabConfig.controlModes };
  if (partial) {
    Object.assign(base, partial);
  }
  if (legacy) {
    const fallback = legacyDisplayMode ?? "hidden";
    (Object.keys(legacy) as Array<keyof PhotobioControlModes>).forEach((key) => {
      const visible = legacy[key as string];
      if (typeof visible === "boolean") {
        base[key] = visible ? "show" : fallback;
      }
    });
  }
  return base;
}

function resolveAnatomyPreset(raw?: string): PhotobioAnatomyPreset | undefined {
  if (!raw) return undefined;
  const map: Record<string, PhotobioAnatomyPreset> = {
    default: "default",
    padrao: "default",
    padrão: "default",
    elderly: "elderly",
    idoso: "elderly",
    athlete: "athlete",
    atleta: "athlete",
    obese: "obese",
    obeso: "obese",
    custom: "custom",
  };
  return map[String(raw).toLowerCase()] ?? (raw as PhotobioAnatomyPreset);
}

/** Mescla config parcial do admin/DB com defaults completos — compatível com labs antigos */
export function mergePhotobioLabConfig(
  partial?: Partial<PhotobioLabConfig> | Record<string, unknown> | null,
): PhotobioLabConfig {
  if (!partial || typeof partial !== "object") {
    return structuredClone(defaultPhotobioLabConfig);
  }

  const p = partial as Record<string, unknown>;
  const anatomyPreset =
    resolveAnatomyPreset(p.anatomyPreset as string | undefined) ??
    resolveAnatomyPreset(p.initialPreset as string | undefined) ??
    defaultPhotobioLabConfig.anatomyPreset;

  const layerConfig = {
    ...PHOTOBIO_ANATOMY_LAYER_PRESETS[anatomyPreset],
    ...((p.layerConfig as PhotobioLayerConfig | undefined) ?? {}),
  };

  const ranges = {
    ...defaultPhotobioLabConfig.ranges,
    ...((p.ranges as Partial<PhotobioLabConfig["ranges"]>) ?? {}),
    transducerAngle: (() => {
      const merged = {
        ...defaultPhotobioLabConfig.ranges.transducerAngle,
        ...((p.ranges as PhotobioLabConfig["ranges"] | undefined)?.transducerAngle ?? {}),
      };
      return {
        ...merged,
        min: clamp(merged.min, 30, 150),
        max: clamp(merged.max, 30, 150),
      };
    })(),
    layerThickness: {
      ...defaultPhotobioLabConfig.ranges.layerThickness,
      ...((p.ranges as PhotobioLabConfig["ranges"] | undefined)?.layerThickness ?? {}),
    },
    skinMelaninIndex: {
      ...defaultPhotobioLabConfig.ranges.skinMelaninIndex,
      ...((p.ranges as PhotobioLabConfig["ranges"] | undefined)?.skinMelaninIndex ?? {}),
    },
  };

  const rawAngle =
    typeof p.transducerAngle === "number"
      ? p.transducerAngle
      : defaultPhotobioLabConfig.transducerAngle;

  return {
    ...defaultPhotobioLabConfig,
    ...(partial as Partial<PhotobioLabConfig>),
    wavelength: (p.wavelength === 808 ? 808 : 660) as PhotobioWavelength,
    mode: p.mode === "Pulsed" ? "Pulsed" : "CW",
    anatomyPreset,
    layerConfig,
    transducerAngle: clamp(rawAngle, ranges.transducerAngle.min, ranges.transducerAngle.max),
    controlModes: mergeControlModes(
      p.controlModes as Partial<PhotobioControlModes>,
      p.visibleControls as Record<string, boolean> | undefined,
      p.controlDisplayMode as "hidden" | "disabled" | undefined,
    ),
    featureFlags: {
      ...defaultPhotobioLabConfig.featureFlags,
      ...((p.featureFlags as Partial<PhotobioFeatureFlags>) ?? {}),
    },
    ranges,
  };
}

export function applyPhotobioScenario(scenario: PhotobioScenarioKey): Partial<PhotobioLabConfig> {
  if (scenario === "custom") return { scenario: "custom" };
  const patch = PHOTOBIO_SCENARIO_PRESETS[scenario];
  const anatomyPreset = patch.anatomyPreset ?? "default";
  return {
    scenario,
    ...patch,
    layerConfig: { ...PHOTOBIO_ANATOMY_LAYER_PRESETS[anatomyPreset] },
  };
}

export interface PhotobioPreviewMetrics {
  effectiveFluence: number;
  nominalFluence: number;
  irradiance: number;
  muscleTransmission: number;
  muscleFluence: number;
  doseZone: string;
  doseLabel: string;
  thermalRiskIndex: number;
  thermalWarning: boolean;
  dominantPhenomenon: string;
  realDoseFactor: number;
}

export function computePhotobioPreviewMetrics(config: PhotobioLabConfig): PhotobioPreviewMetrics {
  const irradiance = config.power / config.spotSize;
  const modeFactor = config.mode === "Pulsed" ? config.dutyCycle / 100 : 1;
  const energy = (config.power / 1000) * config.exposureTime * modeFactor;
  const fluence = energy / config.spotSize;

  const interaction = calculateTissueInteraction({
    wavelength: config.wavelength,
    irradiance,
    energy,
    fluence,
    spotSize: config.spotSize,
    layerConfig: config.layerConfig,
    transducerAngle: config.transducerAngle,
    contactPressure: config.contactPressure,
    isDragging: config.isDragging,
    draggingSpeed: config.draggingSpeed,
    skinMelaninIndex: config.skinMelaninIndex,
  });

  const doseClass = classifyPhotobioDose(interaction.effectiveFluence);

  return {
    effectiveFluence: interaction.effectiveFluence,
    nominalFluence: fluence,
    irradiance,
    muscleTransmission: interaction.muscleFluenceRatio,
    muscleFluence: interaction.muscleFluence,
    doseZone: doseClass.zone,
    doseLabel: doseClass.label,
    thermalRiskIndex: interaction.thermalRiskIndex,
    thermalWarning: interaction.thermalWarning,
    dominantPhenomenon: interaction.dominantOpticalPhenomenon,
    realDoseFactor: interaction.realDoseFactor,
  };
}

export interface PhotobioConfigSafetyWarning {
  id: string;
  message: string;
  severity: "warning" | "error";
}

export function validatePhotobioConfigSafety(config: PhotobioLabConfig): PhotobioConfigSafetyWarning[] {
  const warnings: PhotobioConfigSafetyWarning[] = [];
  const metrics = computePhotobioPreviewMetrics(config);

  if (metrics.doseZone === "saturation" || metrics.doseZone === "inhibitory") {
    warnings.push({
      id: "dose-high",
      message: `Defaults iniciam em ${metrics.doseLabel} (${metrics.effectiveFluence.toFixed(1)} J/cm² efetivos) — considere reduzir potência/tempo ou ampliar spot.`,
      severity: "error",
    });
  }

  if (metrics.effectiveFluence < PHOTOBIO_DOSE_THRESHOLDS.subdoseMax) {
    warnings.push({
      id: "dose-low",
      message: `Fluência efetiva inicial (${metrics.effectiveFluence.toFixed(1)} J/cm²) está abaixo da janela terapêutica — alunos podem ver subdose imediata.`,
      severity: "warning",
    });
  }

  if (metrics.irradiance > 400 || metrics.thermalWarning) {
    warnings.push({
      id: "thermal",
      message: `Irradiância inicial alta (${metrics.irradiance.toFixed(0)} mW/cm²) — risco térmico ${(metrics.thermalRiskIndex * 100).toFixed(0)}%.`,
      severity: metrics.thermalWarning ? "error" : "warning",
    });
  }

  const needsAdjust =
    config.scenario === "obesePatient" ||
    config.scenario === "overdoseExample" ||
    config.targetTissue === "muscle";

  const hiddenPower = config.controlModes.showPower !== "show";
  const hiddenWavelength = config.controlModes.showWavelength !== "show";
  const hiddenTechnique = config.controlModes.showTechnique !== "show";

  if (needsAdjust && (hiddenPower || hiddenWavelength)) {
    warnings.push({
      id: "hidden-critical",
      message:
        "Cenário/alvo exige ajuste de potência ou comprimento de onda, mas esses controles estão ocultos/desabilitados para o aluno.",
      severity: "warning",
    });
  }

  if (config.scenario === "overdoseExample" && hiddenPower && hiddenTechnique) {
    warnings.push({
      id: "overdose-fixed",
      message:
        "Exemplo de overdose com controles críticos ocultos — o aluno não conseguirá corrigir a configuração inadequada.",
      severity: "error",
    });
  }

  if (config.targetTissue === "muscle" && config.wavelength === 660 && config.anatomyPreset === "obese") {
    warnings.push({
      id: "wavelength-obese",
      message: "Alvo muscular em anatomia obese com 660 nm — considere 808 nm como default pedagógico.",
      severity: "warning",
    });
  }

  if (config.featureFlags.showGuidedMode === false && config.initialLabMode === "guided") {
    warnings.push({
      id: "guided-hidden",
      message: "Modo guiado inicial está ativo na config, mas showGuidedMode está desligado.",
      severity: "warning",
    });
  }

  void PHOTOBIO_CLINICAL_PRESETS;
  void PRESET_TO_SCENARIO;

  return warnings;
}

export interface PhotobioConfigSafetyGroup {
  id: string;
  title: string;
  severity: "warning" | "error";
  bullets: string[];
  suggestion?: string;
}

/** Agrupa avisos relacionados (dose + térmico compartilham mesma causa) para UI admin. */
export function buildPhotobioConfigSafetyGroups(config: PhotobioLabConfig): PhotobioConfigSafetyGroup[] {
  const warnings = validatePhotobioConfigSafety(config);
  if (warnings.length === 0) return [];

  const metrics = computePhotobioPreviewMetrics(config);
  const byId = new Map(warnings.map((warning) => [warning.id, warning]));
  const groups: PhotobioConfigSafetyGroup[] = [];

  const doseHigh = byId.get("dose-high");
  const doseLow = byId.get("dose-low");
  const thermal = byId.get("thermal");

  if (doseHigh || thermal) {
    const bullets: string[] = [];
    if (doseHigh) {
      bullets.push(
        `Zona de dose: ${metrics.doseLabel} · ${metrics.effectiveFluence.toFixed(1)} J/cm² efetivos`,
      );
    }
    if (thermal) {
      bullets.push(
        `Irradiância ${metrics.irradiance.toFixed(0)} mW/cm² · risco térmico ${(metrics.thermalRiskIndex * 100).toFixed(0)}%`,
      );
    }
    groups.push({
      id: "dose-thermal",
      title: doseHigh && thermal ? "Dose e segurança térmica" : doseHigh ? "Dose inicial elevada" : "Irradiância elevada",
      severity:
        doseHigh?.severity === "error" || metrics.thermalWarning ? "error" : "warning",
      bullets,
      suggestion: "Reduza potência ou tempo de exposição, ou amplie a área do spot.",
    });
  } else if (doseLow) {
    groups.push({
      id: "dose-low",
      title: "Subdose no primeiro contato",
      severity: "warning",
      bullets: [`Fluência efetiva inicial: ${metrics.effectiveFluence.toFixed(1)} J/cm²`],
      suggestion: "Aumente potência, tempo ou melhore a técnica simulada nos defaults.",
    });
  }

  const pedagogyIds = new Set([
    "hidden-critical",
    "overdose-fixed",
    "wavelength-obese",
    "guided-hidden",
  ]);
  const pedagogyWarnings = warnings.filter((warning) => pedagogyIds.has(warning.id));
  if (pedagogyWarnings.length > 0) {
    groups.push({
      id: "pedagogy",
      title: "Experiência do aluno",
      severity: pedagogyWarnings.some((warning) => warning.severity === "error") ? "error" : "warning",
      bullets: pedagogyWarnings.map((warning) => warning.message),
    });
  }

  return groups;
}

export function photobioConfigToStorePatch(config: PhotobioLabConfig) {
  return {
    wavelength: config.wavelength,
    power: clamp(config.power, config.ranges.power.min, config.ranges.power.max),
    spotSize: clamp(config.spotSize, config.ranges.spotSize.min, config.ranges.spotSize.max),
    exposureTime: clamp(config.exposureTime, config.ranges.exposureTime.min, config.ranges.exposureTime.max),
    mode: config.mode,
    dutyCycle: clamp(config.dutyCycle, config.ranges.dutyCycle.min, config.ranges.dutyCycle.max),
    transducerAngle: clamp(config.transducerAngle, config.ranges.transducerAngle.min, config.ranges.transducerAngle.max),
    contactPressure: clamp(config.contactPressure, config.ranges.contactPressure.min, config.ranges.contactPressure.max),
    isDragging: config.isDragging,
    draggingSpeed: config.draggingSpeed,
    anatomyPreset: config.anatomyPreset,
    layerConfig: config.layerConfig,
    applicatorType: config.applicatorType,
    viewerTab: config.viewerTab,
    skinMelaninIndex: clamp(
      config.skinMelaninIndex,
      config.ranges.skinMelaninIndex.min,
      config.ranges.skinMelaninIndex.max,
    ),
    targetTissue: config.targetTissue,
    controlModes: config.controlModes,
    featureFlags: config.featureFlags,
    parameterRanges: config.ranges,
    labMode: config.initialLabMode,
  };
}
