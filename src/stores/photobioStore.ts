import { create } from "zustand";
import {
  calculateTissueInteraction,
  TissueInteractionResult,
  PhotobioWavelength,
  PhotobioAnatomyPreset,
  PhotobioLayerConfig,
} from "@/simulation/photobioEngine";

export type PhotobioMode = "CW" | "Pulsed";
export type ControlDisplayMode = "hidden" | "disabled";
export type ControlVisibilityMode = "show" | "hidden" | "disabled";
export interface ControlModes {
  showWavelength: ControlVisibilityMode;
  showPower: ControlVisibilityMode;
  showSpotSize: ControlVisibilityMode;
  showExposureTime: ControlVisibilityMode;
  showMode: ControlVisibilityMode;
  showAnatomyPresets: ControlVisibilityMode;
  showCustomAnatomy: ControlVisibilityMode;
}

interface PhotobioState {
  // Inputs
  wavelength: PhotobioWavelength;
  power: number; // mW (10-500)
  spotSize: number; // cm² (0.1-1.0)
  exposureTime: number; // s (1-300)
  mode: PhotobioMode;
  dutyCycle: 50; // % fixo para modo pulsado
  transducerAngle: number; // 0..180, default 90
  contactPressure: number; // 0..100
  isDragging: boolean;
  draggingSpeed: number; // relative speed factor
  transducerX: number; // scanning position
  anatomyPreset: PhotobioAnatomyPreset;
  layerConfig: PhotobioLayerConfig;
  controlModes: ControlModes;
  doseMap: number[];

  // Derived + simulation output
  interaction: TissueInteractionResult;

  // Selectors
  irradiance: () => number; // mW/cm²
  energy: () => number; // J
  fluence: () => number; // J/cm²

  // Actions
  setWavelength: (value: PhotobioWavelength) => void;
  setPower: (value: number) => void;
  setSpotSize: (value: number) => void;
  setExposureTime: (value: number) => void;
  setMode: (value: PhotobioMode) => void;
  setDutyCycle: (value: number) => void;
  setTransducerAngle: (value: number) => void;
  setContactPressure: (value: number) => void;
  setIsDragging: (value: boolean) => void;
  setDraggingSpeed: (value: number) => void;
  setTransducerX: (value: number) => void;
  accumulateDoseAt: (positionX: number, doseDelta: number) => void;
  resetDoseMap: () => void;
  setControlMode: (control: keyof ControlModes, mode: ControlVisibilityMode) => void;
  setAnatomyPreset: (preset: PhotobioAnatomyPreset) => void;
  setCustomLayerThickness: (
    layer: keyof PhotobioLayerConfig,
    value: number
  ) => void;
  setFromConfig: (config: Partial<{
    wavelength: PhotobioWavelength;
    power: number;
    spotSize: number;
    exposureTime: number;
    mode: PhotobioMode;
    dutyCycle: 50;
    transducerAngle: number;
    contactPressure: number;
    isDragging: boolean;
    draggingSpeed: number;
    transducerX: number;
    anatomyPreset: PhotobioAnatomyPreset;
    layerConfig: Partial<PhotobioLayerConfig>;
    controlDisplayMode: ControlDisplayMode;
    controlModes: Partial<ControlModes>;
    visibleControls: Partial<Record<keyof ControlModes, boolean>>;
  }>) => void;
  resetDefaults: () => void;
  runSimulation: () => void;
}

const DEFAULTS = {
  wavelength: 660 as PhotobioWavelength,
  power: 100,
  spotSize: 0.5,
  exposureTime: 30,
  mode: "CW" as PhotobioMode,
  dutyCycle: 50 as const,
  transducerAngle: 90,
  contactPressure: 50,
  isDragging: false,
  draggingSpeed: 1,
  transducerX: 0,
  anatomyPreset: "default" as PhotobioAnatomyPreset,
  layerConfig: {
    epidermisMm: 1,
    dermisMm: 4,
    adiposeMm: 15,
    muscleMm: 25,
  } satisfies PhotobioLayerConfig,
  controlModes: {
    showWavelength: "show",
    showPower: "show",
    showSpotSize: "show",
    showExposureTime: "show",
    showMode: "show",
    showAnatomyPresets: "show",
    showCustomAnatomy: "show",
  } satisfies ControlModes,
  doseMap: Array.from({ length: 56 }, () => 0),
};

const PRESET_LAYER_CONFIGS: Record<PhotobioAnatomyPreset, PhotobioLayerConfig> = {
  default: { epidermisMm: 1, dermisMm: 4, adiposeMm: 15, muscleMm: 25 },
  elderly: { epidermisMm: 0.5, dermisMm: 2, adiposeMm: 10, muscleMm: 12 },
  athlete: { epidermisMm: 1, dermisMm: 4, adiposeMm: 5, muscleMm: 35 },
  obese: { epidermisMm: 1, dermisMm: 4, adiposeMm: 40, muscleMm: 10 },
  custom: { epidermisMm: 1, dermisMm: 4, adiposeMm: 15, muscleMm: 25 },
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const round = (value: number, digits = 4) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

const computeIrradiance = (power: number, spotSize: number) => power / spotSize;

const computeEnergy = (
  power: number,
  exposureTime: number,
  mode: PhotobioMode,
  dutyCycle: 50
) => {
  const modeFactor = mode === "Pulsed" ? dutyCycle / 100 : 1;
  return (power / 1000) * exposureTime * modeFactor;
};

const computeFluence = (energy: number, spotSize: number) => energy / spotSize;

export const usePhotobioStore = create<PhotobioState>((set, get) => ({
  wavelength: DEFAULTS.wavelength,
  power: DEFAULTS.power,
  spotSize: DEFAULTS.spotSize,
  exposureTime: DEFAULTS.exposureTime,
  mode: DEFAULTS.mode,
  dutyCycle: DEFAULTS.dutyCycle,
  transducerAngle: DEFAULTS.transducerAngle,
  contactPressure: DEFAULTS.contactPressure,
  isDragging: DEFAULTS.isDragging,
  draggingSpeed: DEFAULTS.draggingSpeed,
  transducerX: DEFAULTS.transducerX,
  anatomyPreset: DEFAULTS.anatomyPreset,
  layerConfig: DEFAULTS.layerConfig,
  controlModes: DEFAULTS.controlModes,
  doseMap: DEFAULTS.doseMap,

  interaction: calculateTissueInteraction({
    wavelength: DEFAULTS.wavelength,
    irradiance: round(computeIrradiance(DEFAULTS.power, DEFAULTS.spotSize)),
    energy: round(
      computeEnergy(
        DEFAULTS.power,
        DEFAULTS.exposureTime,
        DEFAULTS.mode,
        DEFAULTS.dutyCycle
      )
    ),
    fluence: round(
      computeFluence(
        computeEnergy(
          DEFAULTS.power,
          DEFAULTS.exposureTime,
          DEFAULTS.mode,
          DEFAULTS.dutyCycle
        ),
        DEFAULTS.spotSize
      )
    ),
    layerConfig: DEFAULTS.layerConfig,
    transducerAngle: DEFAULTS.transducerAngle,
    contactPressure: DEFAULTS.contactPressure,
    isDragging: DEFAULTS.isDragging,
    draggingSpeed: DEFAULTS.draggingSpeed,
    transducerX: DEFAULTS.transducerX,
  }),

  irradiance: () => {
    const { power, spotSize } = get();
    return round(computeIrradiance(power, spotSize));
  },

  energy: () => {
    const { power, exposureTime, mode, dutyCycle } = get();
    return round(computeEnergy(power, exposureTime, mode, dutyCycle));
  },

  fluence: () => {
    const { spotSize } = get();
    const e = get().energy();
    return round(computeFluence(e, spotSize));
  },

  setWavelength: (value) => {
    set({ wavelength: value });
    get().runSimulation();
  },

  setPower: (value) => {
    set({ power: clamp(value, 10, 500) });
    get().runSimulation();
  },

  setSpotSize: (value) => {
    set({ spotSize: clamp(value, 0.1, 1.0) });
    get().runSimulation();
  },

  setExposureTime: (value) => {
    set({ exposureTime: clamp(value, 1, 300) });
    get().runSimulation();
  },

  setMode: (value) => {
    set({ mode: value });
    get().runSimulation();
  },

  setDutyCycle: (value) => {
    // Duty cycle fixo por especificacao: manter 50% para modo pulsado.
    void value;
    set({ dutyCycle: 50 });
    get().runSimulation();
  },

  setTransducerAngle: (value) => {
    set({ transducerAngle: clamp(value, 0, 180) });
    get().runSimulation();
  },

  setContactPressure: (value) => {
    set({ contactPressure: clamp(value, 0, 100) });
    get().runSimulation();
  },

  setIsDragging: (value) => {
    set({ isDragging: value });
    get().runSimulation();
  },

  setDraggingSpeed: (value) => {
    set({ draggingSpeed: clamp(value, 0.2, 5) });
    get().runSimulation();
  },

  setTransducerX: (value) => {
    set({ transducerX: clamp(value, -2.8, 2.8) });
  },

  accumulateDoseAt: (positionX, doseDelta) => {
    const map = get().doseMap;
    const index = Math.max(
      0,
      Math.min(
        map.length - 1,
        Math.round(((clamp(positionX, -2.8, 2.8) + 2.8) / 5.6) * (map.length - 1))
      )
    );
    const next = [...map];
    for (let offset = -2; offset <= 2; offset += 1) {
      const i = index + offset;
      if (i < 0 || i >= next.length) continue;
      const spread = offset === 0 ? 1 : offset === -1 || offset === 1 ? 0.55 : 0.25;
      next[i] = Math.max(0, Math.min(80, next[i] + doseDelta * spread));
    }
    set({ doseMap: next });
  },

  resetDoseMap: () => {
    set({ doseMap: Array.from({ length: DEFAULTS.doseMap.length }, () => 0) });
  },

  setControlMode: (control, mode) => {
    set((prev) => ({
      controlModes: {
        ...prev.controlModes,
        [control]: mode,
      },
    }));
  },

  setAnatomyPreset: (preset) => {
    const presetConfig = { ...PRESET_LAYER_CONFIGS[preset] };
    set({
      anatomyPreset: preset,
      layerConfig: presetConfig,
    });
    get().runSimulation();
  },

  setCustomLayerThickness: (layer, value) => {
    const limits: Record<keyof PhotobioLayerConfig, [number, number]> = {
      epidermisMm: [0.2, 3],
      dermisMm: [0.5, 10],
      adiposeMm: [1, 60],
      muscleMm: [5, 60],
    };
    const [min, max] = limits[layer];
    set((prev) => ({
      anatomyPreset: "custom",
      layerConfig: {
        ...prev.layerConfig,
        [layer]: clamp(value, min, max),
      },
    }));
    get().runSimulation();
  },

  setFromConfig: (config) => {
    const next = {
      wavelength: config.wavelength ?? get().wavelength,
      power: clamp(config.power ?? get().power, 10, 500),
      spotSize: clamp(config.spotSize ?? get().spotSize, 0.1, 1.0),
      exposureTime: clamp(config.exposureTime ?? get().exposureTime, 1, 300),
      mode: config.mode ?? get().mode,
      dutyCycle: 50 as const,
      transducerAngle: clamp(config.transducerAngle ?? get().transducerAngle, 0, 180),
      contactPressure: clamp(config.contactPressure ?? get().contactPressure, 0, 100),
      isDragging: config.isDragging ?? get().isDragging,
      draggingSpeed: clamp(config.draggingSpeed ?? get().draggingSpeed, 0.2, 5),
      transducerX: clamp(config.transducerX ?? get().transducerX, -2.8, 2.8),
      anatomyPreset: config.anatomyPreset ?? get().anatomyPreset,
      layerConfig: {
        epidermisMm: clamp(
          config.layerConfig?.epidermisMm ?? get().layerConfig.epidermisMm,
          0.2,
          3
        ),
        dermisMm: clamp(
          config.layerConfig?.dermisMm ?? get().layerConfig.dermisMm,
          0.5,
          10
        ),
        adiposeMm: clamp(
          config.layerConfig?.adiposeMm ?? get().layerConfig.adiposeMm,
          1,
          60
        ),
        muscleMm: clamp(
          config.layerConfig?.muscleMm ?? get().layerConfig.muscleMm,
          5,
          60
        ),
      },
      controlModes: {
        ...get().controlModes,
        ...(config.controlModes ?? {}),
      },
    };
    // Backward compatibility: old shape (visibleControls + global display mode)
    if (config.visibleControls) {
      (Object.keys(config.visibleControls) as Array<keyof ControlModes>).forEach((key) => {
        const isVisible = config.visibleControls?.[key];
        if (typeof isVisible === "boolean") {
          next.controlModes[key] = isVisible
            ? "show"
            : (config.controlDisplayMode ?? "hidden");
        }
      });
    }
    set(next);
    get().runSimulation();
  },

  resetDefaults: () => {
    set({
      wavelength: DEFAULTS.wavelength,
      power: DEFAULTS.power,
      spotSize: DEFAULTS.spotSize,
      exposureTime: DEFAULTS.exposureTime,
      mode: DEFAULTS.mode,
      dutyCycle: DEFAULTS.dutyCycle,
      transducerAngle: DEFAULTS.transducerAngle,
      contactPressure: DEFAULTS.contactPressure,
      isDragging: DEFAULTS.isDragging,
      draggingSpeed: DEFAULTS.draggingSpeed,
      transducerX: DEFAULTS.transducerX,
      anatomyPreset: DEFAULTS.anatomyPreset,
      layerConfig: DEFAULTS.layerConfig,
      controlModes: DEFAULTS.controlModes,
      doseMap: DEFAULTS.doseMap,
    });
    get().runSimulation();
  },

  runSimulation: () => {
    const state = get();
    const irradiance = round(computeIrradiance(state.power, state.spotSize));
    const energy = round(
      computeEnergy(state.power, state.exposureTime, state.mode, state.dutyCycle)
    );
    const fluence = round(computeFluence(energy, state.spotSize));

    const interaction = calculateTissueInteraction({
      wavelength: state.wavelength,
      irradiance,
      energy,
      fluence,
      layerConfig: state.layerConfig,
      transducerAngle: state.transducerAngle,
      contactPressure: state.contactPressure,
      isDragging: state.isDragging,
      draggingSpeed: state.draggingSpeed,
    });

    set({ interaction });
  },
}));

setTimeout(() => {
  usePhotobioStore.getState().runSimulation();
}, 0);

