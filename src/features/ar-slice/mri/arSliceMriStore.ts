import { create } from "zustand";
import { loadVolume } from "@/lib/mri/volumeLoader";
import type { NormalizedVolume } from "@/lib/mri/volumeTypes";
import { resolveBundledAssetUrl } from "@/lib/labRuntime";
import { computeDisplayScale } from "@/features/ar-slice/mri/volumeSampling";

export type MedicalImagingModality = "mri" | "ct" | "pet" | "petct";
export type MedicalVolumeColorMap = "grayscale" | "pet";

type MedicalVolumePreset = {
  label: string;
  longLabel: string;
  fileName: string;
  urls: readonly string[];
  lowQuantile: number;
  highQuantile: number;
  isoFloor: number;
  surfaceThreshold: number;
  colorMap: MedicalVolumeColorMap;
};

export const MEDICAL_VOLUME_PRESETS: Record<
  MedicalImagingModality,
  MedicalVolumePreset
> = {
  mri: {
    label: "RM",
    longLabel: "Ressonância magnética T1",
    fileName: "mni152_t1_2mm.nii",
    urls: [
      "/assets/cases/001/mni152_t1_2mm.nii",
      "/models/ar-slice/brain_t1.nii",
    ],
    lowQuantile: 0.1,
    highQuantile: 0.995,
    isoFloor: 0.015,
    surfaceThreshold: 0.12,
    colorMap: "grayscale",
  },
  ct: {
    label: "TC",
    longLabel: "Tomografia computadorizada",
    fileName: "clinical_scct_highres.nii",
    urls: ["/assets/cases/001/clinical_scct_highres.nii"],
    lowQuantile: 0.02,
    highQuantile: 0.995,
    isoFloor: 0.01,
    surfaceThreshold: 0.22,
    colorMap: "grayscale",
  },
  pet: {
    label: "PET",
    longLabel: "PET cerebral com 18F-FDG",
    fileName: "fdg_pet_mni_ctgrid.nii",
    urls: ["/assets/cases/001/fdg_pet_mni_ctgrid.nii"],
    lowQuantile: 0.08,
    highQuantile: 0.995,
    isoFloor: 0.035,
    surfaceThreshold: 0.3,
    colorMap: "pet",
  },
  petct: {
    label: "PET/TC",
    longLabel: "Fusão PET/TC em espaço MNI",
    fileName: "clinical_scct_highres.nii",
    urls: ["/assets/cases/001/clinical_scct_highres.nii"],
    lowQuantile: 0.02,
    highQuantile: 0.995,
    isoFloor: 0.01,
    surfaceThreshold: 0.22,
    colorMap: "grayscale",
  },
};

export function computeMedicalWindowLevel(
  volume: NormalizedVolume,
  modality: MedicalImagingModality,
): { window: number; level: number } {
  const preset = MEDICAL_VOLUME_PRESETS[modality];
  const sampled: number[] = [];
  const stride = Math.max(1, Math.floor(volume.data.length / 50_000));
  for (let i = 0; i < volume.data.length; i += stride) {
    const value = volume.data[i];
    if (Number.isFinite(value) && value > volume.min) sampled.push(value);
  }
  sampled.sort((a, b) => a - b);
  const at = (fraction: number) =>
    sampled[Math.min(sampled.length - 1, Math.floor(sampled.length * fraction))];
  const low = sampled.length ? at(preset.lowQuantile) : volume.min;
  const high = sampled.length ? at(preset.highQuantile) : volume.max;
  return {
    window: Math.max(1e-6, high - low),
    level: (high + low) / 2,
  };
}

type ArSliceMriState = {
  activeModality: MedicalImagingModality;
  loadedModality: MedicalImagingModality | null;
  volume: NormalizedVolume | null;
  overlayVolume: NormalizedVolume | null;
  loading: boolean;
  error: string | null;
  displayScale: number;
  iso: number;
  window: number;
  level: number;
  overlayWindow: number;
  overlayLevel: number;
  loadVolume: () => Promise<void>;
  setActiveModality: (modality: MedicalImagingModality) => void;
};

let loadGeneration = 0;

async function loadPresetVolume(
  modality: MedicalImagingModality,
): Promise<NormalizedVolume> {
  const preset = MEDICAL_VOLUME_PRESETS[modality];
  let lastErr: Error | null = null;
  for (const url of preset.urls) {
    try {
      const resolved = resolveBundledAssetUrl(url);
      const res = await fetch(resolved);
      if (!res.ok) throw new Error(`${url} (${res.status})`);
      const buf = await res.arrayBuffer();
      const parsed = await loadVolume([new File([buf], preset.fileName)]);
      if (!parsed.volume.isValid) {
        throw new Error(`Volume ${preset.label} inválido`);
      }
      return parsed.volume;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error(`NIfTI ${preset.label} não encontrado`);
}

export const useArSliceMriStore = create<ArSliceMriState>((set, get) => ({
  activeModality: "mri",
  loadedModality: null,
  volume: null,
  overlayVolume: null,
  loading: false,
  error: null,
  displayScale: 1.9,
  iso: 0.56,
  window: 0,
  level: 0,
  overlayWindow: 0,
  overlayLevel: 0,

  loadVolume: async () => {
    const modality = get().activeModality;
    if (get().loadedModality === modality && get().volume) return;
    const generation = ++loadGeneration;
    const preset = MEDICAL_VOLUME_PRESETS[modality];

    set({
      loading: true,
      error: null,
      volume: null,
      overlayVolume: null,
      loadedModality: null,
    });

    try {
      const volume = await loadPresetVolume(modality);
      const overlayVolume =
        modality === "petct" ? await loadPresetVolume("pet") : null;
      if (generation !== loadGeneration || get().activeModality !== modality) return;

      const { window, level } = computeMedicalWindowLevel(volume, modality);
      const overlayWindowLevel = overlayVolume
        ? computeMedicalWindowLevel(overlayVolume, "pet")
        : { window: 0, level: 0 };
      set({
        volume,
        overlayVolume,
        loadedModality: modality,
        loading: false,
        error: null,
        displayScale: computeDisplayScale(volume),
        window,
        level,
        overlayWindow: overlayWindowLevel.window,
        overlayLevel: overlayWindowLevel.level,
      });
    } catch (e) {
      if (generation !== loadGeneration || get().activeModality !== modality) return;
      const message =
        e instanceof Error
          ? e.message
          : `Falha ao carregar ${preset.longLabel}`;
      set({
        loading: false,
        error: message,
        volume: null,
        overlayVolume: null,
        loadedModality: null,
      });
    }
  },

  setActiveModality: (activeModality) => {
    if (activeModality === get().activeModality) return;
    loadGeneration++;
    set({
      activeModality,
      loadedModality: null,
      volume: null,
      overlayVolume: null,
      loading: false,
      error: null,
    });
    void get().loadVolume();
  },
}));
