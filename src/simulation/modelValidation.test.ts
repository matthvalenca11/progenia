import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPhotobioLayers,
  computePhotobioOptics,
  getPhotobioOpticalProperties,
  type PhotobioLayer,
  type PhotobioWavelength,
} from "@/lib/photobioOptics";
import { getBeamGeometryFactor } from "@/lib/ultrasoundTherapyPhysics";
import { buildStackLayers, stackLayersToTissueLayers } from "@/lib/ultrasoundTherapyStack";
import { simulateUltrasoundTherapy, type TissueLayer } from "@/simulation/ultrasoundTherapyEngine";

type Metric = {
  cases: number;
  mae: number;
  rmse: number;
  mapePercent: number;
};

function summarize(platform: number[], reference: number[]): Metric {
  const absolute = platform.map((value, index) => Math.abs(value - reference[index]));
  const squared = platform.map((value, index) => (value - reference[index]) ** 2);
  const percent = platform.map(
    (value, index) => (Math.abs(value - reference[index]) / Math.max(Math.abs(reference[index]), 1e-9)) * 100,
  );
  return {
    cases: platform.length,
    mae: absolute.reduce((sum, value) => sum + value, 0) / platform.length,
    rmse: Math.sqrt(squared.reduce((sum, value) => sum + value, 0) / platform.length),
    mapePercent: percent.reduce((sum, value) => sum + value, 0) / platform.length,
  };
}

/**
 * Independent closed-form baseline for the attenuation retained by the
 * therapeutic-US engine. Beam geometry is divided out of the displayed
 * profile so this check isolates the tissue/frequency term.
 */
function referenceUsTissueTransmission(depthCm: number, frequencyMHz: number, layers: TissueLayer[]) {
  const frequencyFactor = 0.5 + (frequencyMHz - 1) * 0.8;
  let attenuationDb = 0;
  for (const layer of layers) {
    if (depthCm <= layer.depth) break;
    const traversedCm = Math.min(depthCm - layer.depth, layer.thickness);
    attenuationDb += layer.attenuationCoeff * frequencyFactor * traversedCm * 1.5;
  }
  return 10 ** (-attenuationDb / 10);
}

function referencePbmTransmission(
  depthMm: number,
  wavelength: PhotobioWavelength,
  layers: PhotobioLayer[],
  melaninIndex: number,
) {
  let remainingMm = depthMm;
  let exponent = 0;
  for (const layer of layers) {
    if (remainingMm <= 0) break;
    const traversedMm = Math.min(remainingMm, layer.thicknessMm);
    const properties = getPhotobioOpticalProperties(wavelength, layer.type, melaninIndex);
    exponent += properties.muEff * traversedMm;
    remainingMm -= traversedMm;
  }
  return Math.exp(-exponent);
}

describe("model-validation baseline sweeps", () => {
  it("matches independent US and PBM reference calculations and exports the metrics", () => {
    const usPlatform: number[] = [];
    const usReference: number[] = [];
    const sataPlatform: number[] = [];
    const sataReference: number[] = [];
    const frequencies = [1, 1.5, 3];
    const dutyCycles = [10, 50, 100];

    for (const frequency of frequencies) {
      for (const dutyCycle of dutyCycles) {
        const result = simulateUltrasoundTherapy({
          frequency,
          intensity: 1,
          era: 5,
          mode: "pulsed",
          dutyCycle,
          duration: 1,
          coupling: "good",
          movement: "stationary",
          scenario: "custom",
          beamProfile: "planar",
          customThicknesses: { skin: 0.1, fat: 0, muscle: 8 },
          interactionMapResolution: { width: 8, height: 8 },
        });
        const layers = stackLayersToTissueLayers(
          buildStackLayers("custom", { skin: 0.1, fat: 0, muscle: 8 }),
        ) as TissueLayer[];
        const acoustic = {
          frequencyMHz: frequency,
          eraCm2: 5,
          transducerType: "planar_circular" as const,
          beamProfile: "planar" as const,
          focusDepthCm: 0,
        };
        for (const sample of result.acousticProfile?.depthSamples ?? []) {
          if (sample.depthCm > 6) continue;
          const geometry = getBeamGeometryFactor(sample.depthCm, acoustic);
          usPlatform.push(sample.relativeIntensity / Math.max(geometry, 1e-9));
          usReference.push(referenceUsTissueTransmission(sample.depthCm, frequency, layers));
        }
        sataPlatform.push(result.doseJcm2 / 60);
        sataReference.push(1 * 0.95 * (dutyCycle / 100));
      }
    }

    const pbmPlatform: number[] = [];
    const pbmReference: number[] = [];
    const pbmLayers = buildPhotobioLayers(
      { epidermisMm: 1, dermisMm: 4, adiposeMm: 15, muscleMm: 25 },
      false,
    );
    for (const wavelength of [660, 808] as const) {
      const profile = computePhotobioOptics({
        wavelength,
        fluenceJcm2: 6,
        effectiveFluenceJcm2: 6,
        irradianceMwCm2: 100,
        spotSizeCm2: 1,
        layers: pbmLayers,
        skinMelaninIndex: 0,
        contactOpticalCoupling: 1,
        incidenceEfficiency: 1,
      });
      for (const sample of profile.samples) {
        pbmPlatform.push(sample.fluenceRelative);
        pbmReference.push(referencePbmTransmission(sample.zMm, wavelength, pbmLayers, 0));
      }
    }

    const output = {
      generatedAt: new Date().toISOString(),
      protocol: {
        therapeuticUltrasound: {
          frequenciesMHz: frequencies,
          dutyCyclesPercent: dutyCycles,
          depthsCm: "0.0–6.0 in 0.2 cm samples",
          coupling: "good",
          beamProfile: "planar",
          output: "tissue transmission and SATA-equivalent intensity",
        },
        photobiomodulation: {
          wavelengthsNm: [660, 808],
          depthsMm: "0.0–45.0 in 0.5 mm samples",
          layers: "1 mm epidermis, 4 mm dermis, 15 mm adipose, 25 mm muscle",
          output: "relative fluence",
        },
      },
      metrics: {
        ultrasoundTransmission: summarize(usPlatform, usReference),
        ultrasoundSata: summarize(sataPlatform, sataReference),
        photobioFluence: summarize(pbmPlatform, pbmReference),
      },
    };

    mkdirSync(resolve(process.cwd(), "results"), { recursive: true });
    writeFileSync(
      resolve(process.cwd(), "results/model-validation.json"),
      `${JSON.stringify(output, null, 2)}\n`,
    );
    const rows = [
      ["series", "cases", "mae", "rmse", "mape_percent"],
      ...Object.entries(output.metrics).map(([series, metric]) => [
        series,
        String(metric.cases),
        String(metric.mae),
        String(metric.rmse),
        String(metric.mapePercent),
      ]),
    ];
    writeFileSync(
      resolve(process.cwd(), "results/model-validation.csv"),
      `${rows.map((row) => row.join(",")).join("\n")}\n`,
    );

    expect(output.metrics.ultrasoundTransmission.mapePercent).toBeLessThan(1e-6);
    expect(output.metrics.ultrasoundSata.mapePercent).toBeLessThan(1e-6);
    expect(output.metrics.photobioFluence.mapePercent).toBeLessThan(1e-6);
  });
});
