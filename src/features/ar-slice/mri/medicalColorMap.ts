import type { MedicalVolumeColorMap } from "@/features/ar-slice/mri/arSliceMriStore";

export type Rgb = readonly [number, number, number];

const PET_STOPS: readonly { at: number; rgb: Rgb }[] = [
  { at: 0, rgb: [0, 0, 0] },
  { at: 0.16, rgb: [28, 8, 72] },
  { at: 0.36, rgb: [104, 18, 110] },
  { at: 0.56, rgb: [196, 45, 68] },
  { at: 0.76, rgb: [247, 126, 30] },
  { at: 0.92, rgb: [252, 224, 90] },
  { at: 1, rgb: [255, 255, 238] },
];

export function medicalColor(value: number, colorMap: MedicalVolumeColorMap): Rgb {
  const t = Math.min(1, Math.max(0, value));
  if (colorMap === "grayscale") {
    const gray = Math.round(t * 255);
    return [gray, gray, gray];
  }

  let upper = PET_STOPS[1];
  let lower = PET_STOPS[0];
  for (let i = 1; i < PET_STOPS.length; i++) {
    upper = PET_STOPS[i];
    lower = PET_STOPS[i - 1];
    if (t <= upper.at) break;
  }
  const span = Math.max(1e-6, upper.at - lower.at);
  const mix = (t - lower.at) / span;
  return [
    Math.round(lower.rgb[0] + (upper.rgb[0] - lower.rgb[0]) * mix),
    Math.round(lower.rgb[1] + (upper.rgb[1] - lower.rgb[1]) * mix),
    Math.round(lower.rgb[2] + (upper.rgb[2] - lower.rgb[2]) * mix),
  ];
}

export function createMedicalColorMapData(
  colorMap: MedicalVolumeColorMap,
): Uint8Array {
  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = medicalColor(i / 255, colorMap);
    const offset = i * 4;
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = i < 4 ? 0 : 255;
  }
  return data;
}
