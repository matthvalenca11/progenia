import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  MEDICAL_VOLUME_PRESETS,
  computeMedicalWindowLevel,
} from "@/features/ar-slice/mri/arSliceMriStore";
import {
  createMedicalColorMapData,
  medicalColor,
} from "@/features/ar-slice/mri/medicalColorMap";
import type { NormalizedVolume } from "@/lib/mri/volumeTypes";
import { loadVolume } from "@/lib/mri/volumeLoader";
import { computeDisplayHalfExtents } from "@/features/ar-slice/mri/volumeSampling";

class TestFileReader {
  onload: ((event: { target: { result: ArrayBuffer } }) => void) | null = null;
  onerror: (() => void) | null = null;

  readAsArrayBuffer(file: Blob) {
    void file
      .arrayBuffer()
      .then((result) => this.onload?.({ target: { result } }))
      .catch(() => this.onerror?.());
  }
}

Object.defineProperty(globalThis, "FileReader", {
  configurable: true,
  value: TestFileReader,
});

function volume(values: number[]): NormalizedVolume {
  return {
    data: new Float32Array(values),
    width: values.length,
    height: 1,
    depth: 1,
    spacing: [2, 2, 2],
    orientation: "RAS",
    min: Math.min(...values),
    max: Math.max(...values),
    source: "NIFTI",
    isValid: true,
  };
}

describe("medical imaging presets", () => {
  it("defines independent public assets for MRI, CT and PET", () => {
    expect(Object.keys(MEDICAL_VOLUME_PRESETS)).toEqual([
      "mri",
      "ct",
      "pet",
      "petct",
    ]);
    expect(MEDICAL_VOLUME_PRESETS.ct.urls[0]).toContain("clinical_scct_highres");
    expect(MEDICAL_VOLUME_PRESETS.pet.urls[0]).toContain("fdg_pet_mni_ctgrid");
    expect(MEDICAL_VOLUME_PRESETS.pet.colorMap).toBe("pet");
    expect(MEDICAL_VOLUME_PRESETS.petct.colorMap).toBe("grayscale");
  });

  it("uses modality-specific robust intensity windows", () => {
    const input = volume([0, 0, ...Array.from({ length: 100 }, (_, i) => i + 1), 1000]);
    const mri = computeMedicalWindowLevel(input, "mri");
    const ct = computeMedicalWindowLevel(input, "ct");

    expect(mri.window).toBeGreaterThan(0);
    expect(ct.window).toBeGreaterThan(0);
    expect(mri.level).not.toBe(ct.level);
  });

  it("preserves physical aspect ratio instead of forcing a cube", () => {
    const input = volume([0, 1]);
    input.width = 181;
    input.height = 217;
    input.depth = 181;
    const extents = computeDisplayHalfExtents(input, 1.9);

    expect(extents.x).toBeCloseTo(extents.y);
    expect(extents.z).toBeCloseTo(1.9);
    expect(extents.x).toBeCloseTo(1.9 * (181 / 217));
  });

  it.each([
    ["ct", "clinical_scct_highres.nii", [181, 217, 181]],
    ["pet", "fdg_pet_mni_ctgrid.nii", [181, 217, 181]],
  ] as const)("parses the bundled %s atlas", async (_, fileName, dimensions) => {
    const bytes = readFileSync(
      resolve(process.cwd(), "public/assets/cases/001", fileName),
    );
    const parsed = await loadVolume([
      new File([bytes], fileName, { type: "application/octet-stream" }),
    ]);

    expect(parsed.volume.isValid).toBe(true);
    expect([
      parsed.volume.width,
      parsed.volume.height,
      parsed.volume.depth,
    ]).toEqual(dimensions);
    expect(parsed.volume.max).toBeGreaterThan(parsed.volume.min);
  });
});

describe("medical color maps", () => {
  it("keeps diagnostic modalities grayscale", () => {
    expect(medicalColor(0.5, "grayscale")).toEqual([128, 128, 128]);
  });

  it("maps PET uptake from dark purple to hot yellow-white", () => {
    const low = medicalColor(0.2, "pet");
    const high = medicalColor(0.9, "pet");
    expect(low[2]).toBeGreaterThan(low[0]);
    expect(high[0]).toBeGreaterThan(high[2]);

    const texture = createMedicalColorMapData("pet");
    expect(texture).toHaveLength(1024);
    expect(texture[3]).toBe(0);
    expect(texture[1023]).toBe(255);
  });
});
