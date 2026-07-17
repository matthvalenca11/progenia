import { describe, expect, it } from "vitest";
import {
  buildPhotobioLayers,
  classifyPhotobioDose,
  computePhotobioOptics,
  formatPhotobioFraction,
  type PhotobioLayerConfig,
  type PhotobioWavelength,
} from "@/lib/photobioOptics";

const defaultLayerConfig: PhotobioLayerConfig = {
  epidermisMm: 1,
  dermisMm: 4,
  adiposeMm: 15,
  muscleMm: 25,
};

function optics(
  wavelength: PhotobioWavelength,
  layerConfig: PhotobioLayerConfig = defaultLayerConfig,
  skinMelaninIndex = 0.35,
) {
  return computePhotobioOptics({
    wavelength,
    fluenceJcm2: 5,
    effectiveFluenceJcm2: 5,
    irradianceMwCm2: 150,
    spotSizeCm2: 0.5,
    layers: buildPhotobioLayers(layerConfig),
    skinMelaninIndex,
  });
}

describe("photobioOptics", () => {
  it("delivers more deep energy at 808 nm than 660 nm in default anatomy", () => {
    const red = optics(660);
    const nir = optics(808);

    expect(nir.deepDeliveryIndex).toBeGreaterThan(red.deepDeliveryIndex);
    expect(nir.targetMuscleTransmission).toBeGreaterThan(red.targetMuscleTransmission);
  });

  it("reduces stack muscle transmission when adipose thickness increases", () => {
    const defaultAnatomy = optics(808, defaultLayerConfig);
    const highAdipose = optics(808, { ...defaultLayerConfig, adiposeMm: 40 });

    expect(highAdipose.deepDeliveryIndex).toBeLessThan(defaultAnatomy.deepDeliveryIndex);
    expect(highAdipose.targetMuscleTransmission).toBeLessThan(defaultAnatomy.targetMuscleTransmission);
  });

  it("increases superficial absorption and reduces muscle delivery with melanin", () => {
    const redLowMelanin = optics(660, defaultLayerConfig, 0.15);
    const redHighMelanin = optics(660, defaultLayerConfig, 0.85);
    const nirLowMelanin = optics(808, defaultLayerConfig, 0.15);
    const nirHighMelanin = optics(808, defaultLayerConfig, 0.85);

    const redDelta = redHighMelanin.superficialAbsorptionIndex - redLowMelanin.superficialAbsorptionIndex;
    const nirDelta = nirHighMelanin.superficialAbsorptionIndex - nirLowMelanin.superficialAbsorptionIndex;

    expect(redHighMelanin.superficialAbsorptionIndex).toBeGreaterThan(redLowMelanin.superficialAbsorptionIndex);
    expect(nirHighMelanin.superficialAbsorptionIndex).toBeGreaterThan(nirLowMelanin.superficialAbsorptionIndex);
    expect(redHighMelanin.superficialAbsorptionIndex).toBeGreaterThan(nirHighMelanin.superficialAbsorptionIndex);
    expect(nirHighMelanin.deepDeliveryIndex).toBeLessThan(nirLowMelanin.deepDeliveryIndex);
    expect(redHighMelanin.deepDeliveryIndex).toBeLessThan(redLowMelanin.deepDeliveryIndex);
    expect(redDelta).toBeGreaterThan(nirDelta);
    expect(redDelta).toBeGreaterThan(0.15);
    expect(nirDelta).toBeGreaterThan(0.04);
  });

  it("keeps deep delivery below superficial absorption at 660 nm", () => {
    const red = optics(660, defaultLayerConfig, 0.35);
    expect(red.superficialAbsorptionIndex).toBeGreaterThan(red.deepDeliveryIndex);
  });

  it("formats small physical fractions with extra precision", () => {
    expect(formatPhotobioFraction(0.258)).toBe("26%");
    expect(formatPhotobioFraction(0.085)).toBe("8.5%");
    expect(formatPhotobioFraction(0.0431)).toBe("4.3%");
    expect(formatPhotobioFraction(0.004095)).toBe("0.41%");
  });

  it("classifies very low and high doses coherently", () => {
    expect(classifyPhotobioDose(0.5).zone).toBe("subdose");
    expect(classifyPhotobioDose(20).zone).toBe("inhibitory");
    expect(classifyPhotobioDose(60).zone).toBe("saturation");
  });
});
