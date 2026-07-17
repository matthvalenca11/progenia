import { describe, expect, it } from "vitest";
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

function interaction(overrides: Partial<Parameters<typeof calculateTissueInteraction>[0]> = {}) {
  const powerMw = overrides.irradiance != null ? overrides.irradiance * 0.5 : 100;
  const spotSize = overrides.spotSize ?? 0.5;
  const energy = overrides.energy ?? calculatePhotobioEnergy(powerMw, 30, "CW", 100);
  const fluence = overrides.fluence ?? calculatePhotobioFluence(energy, spotSize);

  return calculateTissueInteraction({
    wavelength: 660,
    irradiance: calculatePhotobioIrradiance(powerMw, spotSize),
    energy,
    fluence,
    spotSize,
    layerConfig,
    transducerAngle: 90,
    contactPressure: 55,
    isDragging: false,
    draggingSpeed: 1,
    ...overrides,
  });
}

describe("photobioEngine", () => {
  it("reduces effective fluence when angle is far from 90 degrees", () => {
    const perpendicular = interaction({ transducerAngle: 90 });
    const oblique = interaction({ transducerAngle: 45 });

    expect(oblique.effectiveFluence).toBeLessThan(perpendicular.effectiveFluence);
    expect(oblique.realDoseFactor).toBeLessThan(perpendicular.realDoseFactor);
  });

  it("increases irradiance when spot is smaller with the same power", () => {
    const powerMw = 100;

    expect(calculatePhotobioIrradiance(powerMw, 0.2)).toBeGreaterThan(
      calculatePhotobioIrradiance(powerMw, 0.8),
    );
  });

  it("reduces delivered dose when contact is poor", () => {
    const goodContact = interaction({ contactPressure: 55 });
    const poorContact = interaction({ contactPressure: 5 });

    expect(poorContact.effectiveFluence).toBeLessThan(goodContact.effectiveFluence);
    expect(poorContact.contactOpticalCoupling).toBeLessThan(goodContact.contactOpticalCoupling);
  });

  it("reduces energy in pulsed mode with lower duty cycle", () => {
    const highDutyEnergy = calculatePhotobioEnergy(100, 30, "Pulsed", 80);
    const lowDutyEnergy = calculatePhotobioEnergy(100, 30, "Pulsed", 20);
    const cwEnergy = calculatePhotobioEnergy(100, 30, "CW", 20);

    expect(lowDutyEnergy).toBeLessThan(highDutyEnergy);
    expect(cwEnergy).toBeGreaterThan(highDutyEnergy);
  });
});
