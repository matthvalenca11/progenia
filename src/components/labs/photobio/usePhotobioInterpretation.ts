import { useMemo } from "react";
import { usePhotobioStore } from "@/stores/photobioStore";
import { buildPhotobioInterpretation, type PhotobioInterpretationContext } from "@/lib/photobioInterpretation";

export function usePhotobioInterpretation(): PhotobioInterpretationContext {
  const interaction = usePhotobioStore((s) => s.interaction);
  const wavelength = usePhotobioStore((s) => s.wavelength);
  const layerConfig = usePhotobioStore((s) => s.layerConfig);
  const transducerAngle = usePhotobioStore((s) => s.transducerAngle);
  const isDragging = usePhotobioStore((s) => s.isDragging);
  const draggingSpeed = usePhotobioStore((s) => s.draggingSpeed);
  const spotSize = usePhotobioStore((s) => s.spotSize);
  const skinMelaninIndex = usePhotobioStore((s) => s.skinMelaninIndex);
  const irradiance = usePhotobioStore((s) => s.irradiance());

  return useMemo(
    () =>
      buildPhotobioInterpretation(
        interaction,
        layerConfig,
        wavelength,
        transducerAngle,
        isDragging,
        draggingSpeed,
        irradiance,
        spotSize,
        skinMelaninIndex,
      ),
    [
      interaction,
      layerConfig,
      wavelength,
      transducerAngle,
      isDragging,
      draggingSpeed,
      irradiance,
      spotSize,
      skinMelaninIndex,
    ],
  );
}
