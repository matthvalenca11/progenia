import { create } from "zustand";
import { loadVolume } from "@/lib/mri/volumeLoader";
import type { NormalizedVolume } from "@/lib/mri/volumeTypes";
import { resolveBundledAssetUrl } from "@/lib/labRuntime";
import { computeDisplayScale } from "@/features/ar-slice/mri/volumeSampling";

/** Same T1 case as the MRI lab (BraTS training case 001). */
const AR_SLICE_T1_URLS = [
  "/assets/cases/001/BraTS20_Training_001_t1.nii",
  "/models/ar-slice/brain_t1.nii",
] as const;

type ArSliceMriState = {
  volume: NormalizedVolume | null;
  loading: boolean;
  error: string | null;
  displayScale: number;
  iso: number;
  window: number;
  level: number;
  loadVolume: () => Promise<void>;
};

export const useArSliceMriStore = create<ArSliceMriState>((set, get) => ({
  volume: null,
  loading: false,
  error: null,
  displayScale: 1.9,
  iso: 0.56,
  window: 0,
  level: 0,

  loadVolume: async () => {
    if (get().loading || get().volume) return;

    set({ loading: true, error: null });

    try {
      let lastErr: Error | null = null;

      for (const url of AR_SLICE_T1_URLS) {
        try {
          const resolved = resolveBundledAssetUrl(url);
          const res = await fetch(resolved);
          if (!res.ok) {
            throw new Error(`${url} (${res.status})`);
          }
          const buf = await res.arrayBuffer();
          const file = new File([buf], "brain_t1.nii");
          const parsed = await loadVolume([file]);
          const volume = parsed.volume;

          if (!volume.isValid) {
            throw new Error("Volume T1 inválido");
          }

          const window = volume.max - volume.min;
          const level = (volume.max + volume.min) / 2;

          set({
            volume,
            loading: false,
            error: null,
            displayScale: computeDisplayScale(volume),
            window,
            level,
          });
          return;
        } catch (e) {
          lastErr = e instanceof Error ? e : new Error(String(e));
        }
      }

      throw lastErr ?? new Error("NIfTI T1 não encontrado");
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Falha ao carregar ressonância";
      set({
        loading: false,
        error: message,
        volume: null,
      });
    }
  },
}));
