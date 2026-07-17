import { describe, expect, it } from "vitest";
import { computePhotobioScore } from "@/lib/photobioScoring";
import {
  calculatePhotobioEnergy,
  calculatePhotobioFluence,
  calculatePhotobioIrradiance,
  calculateTissueInteraction,
} from "@/simulation/photobioEngine";
import type { PhotobioLayerConfig } from "@/lib/photobioOptics";

const layerConfig: PhotobioLayerConfig = {
  epidermisMm: 1,
  dermisMm: 4,
  adiposeMm: 15,
  muscleMm: 25,
};

function makeInteraction({
  powerMw,
  spotSize,
  exposureTimeSec,
  transducerAngle,
  contactPressure,
}: {
  powerMw: number;
  spotSize: number;
  exposureTimeSec: number;
  transducerAngle: number;
  contactPressure: number;
}) {
  const energy = calculatePhotobioEnergy(powerMw, exposureTimeSec, "CW", 100);
  const fluence = calculatePhotobioFluence(energy, spotSize);

  return calculateTissueInteraction({
    wavelength: 660,
    irradiance: calculatePhotobioIrradiance(powerMw, spotSize),
    energy,
    fluence,
    spotSize,
    layerConfig,
    transducerAngle,
    contactPressure,
    isDragging: false,
    draggingSpeed: 1,
  });
}

describe("photobioScoring", () => {
  it("penalizes thermal risk and poor technique", () => {
    const safeTechnique = makeInteraction({
      powerMw: 100,
      spotSize: 0.8,
      exposureTimeSec: 40,
      transducerAngle: 90,
      contactPressure: 55,
    });
    const riskyTechnique = makeInteraction({
      powerMw: 500,
      spotSize: 0.12,
      exposureTimeSec: 90,
      transducerAngle: 45,
      contactPressure: 5,
    });

    const safeScore = computePhotobioScore({
      interaction: safeTechnique,
      wavelength: 660,
      isDragging: false,
      doseMap: [],
    });
    const riskyScore = computePhotobioScore({
      interaction: riskyTechnique,
      wavelength: 660,
      isDragging: false,
      doseMap: [],
    });

    expect(riskyTechnique.thermalRiskIndex).toBeGreaterThan(safeTechnique.thermalRiskIndex);
    expect(riskyTechnique.realDoseFactor).toBeLessThan(safeTechnique.realDoseFactor);
    expect(riskyScore.total).toBeLessThan(safeScore.total);
    expect(riskyScore.penalties).toBeGreaterThan(safeScore.penalties);
  });
});
