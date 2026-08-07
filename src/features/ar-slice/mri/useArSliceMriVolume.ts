import { useEffect } from "react";
import { useArSliceMriStore } from "@/features/ar-slice/mri/arSliceMriStore";

/** Loads the clinical T1 brain volume once when AR Slice mounts. */
export function useArSliceMriVolume() {
  const loadVolume = useArSliceMriStore((s) => s.loadVolume);

  useEffect(() => {
    void loadVolume();
  }, [loadVolume]);
}
