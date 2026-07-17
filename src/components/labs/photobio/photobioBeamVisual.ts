import type { PhotobioDepthSample, PhotobioOpticsResult, PhotobioTissueType, PhotobioWavelength } from "@/lib/photobioOptics";
import {
  getBeamRadiusAtDepthMm,
  getPhotobioWavelengthVisualPreset,
  photobioDepthMmToWorldUnits,
} from "@/lib/photobioOptics";
import type { PhotobioInteractionMap } from "@/lib/photobioInteractionMap";
import { PHOTOBIO_TISSUE_HALF_WIDTH_WORLD } from "@/lib/photobioInteractionMap";
import { PHOTOBIO_MM_TO_WORLD } from "./photobioViewerLayout";
import { clamp } from "./photobioViewerLayout";

export interface BeamSlice {
  progress: number;
  zMm: number;
  worldY: number;
  worldX: number;
  radiusWorld: number;
  fluenceRelative: number;
  absorbedRelative: number;
  scatteredRelative: number;
  layerType: PhotobioTissueType;
}

export interface ScatterParticle {
  x: number;
  y: number;
  z: number;
  weight: number;
}

export interface AbsorptionMarker {
  x: number;
  y: number;
  z: number;
  intensity: number;
  layerType: PhotobioTissueType;
}

const CM_TO_WORLD = PHOTOBIO_MM_TO_WORLD * 10;

export function cmRadiusToWorld(radiusCm: number): number {
  return radiusCm * CM_TO_WORLD;
}

const SURFACE_SLICE_MIN_Z_MM = 1.2;

export function buildBeamSlices(
  opticsProfile: PhotobioOpticsResult,
  spotSizeCm2: number,
  contactSurfaceY: number,
  transducerX: number,
  transducerAngleDeg: number,
  maxSlices = 22,
): BeamSlice[] {
  const samples = opticsProfile.samples ?? opticsProfile.depthSamples ?? [];
  if (samples.length === 0) return [];

  const step = Math.max(1, Math.floor(samples.length / maxSlices));
  const tiltRad = ((transducerAngleDeg - 90) * Math.PI) / 180;
  const slices: BeamSlice[] = [];

  for (let i = 0; i < samples.length; i += step) {
    const sample = samples[i];
    if (sample.fluenceRelative < 0.02) continue;
    if (sample.zMm < SURFACE_SLICE_MIN_Z_MM) continue;

    const zMm = sample.zMm;
    const progress = clamp(zMm / Math.max(opticsProfile.beamVisualDepthMm, 0.1), 0, 1);
    const lateralShiftCm = Math.tan(tiltRad) * zMm * 0.1;
    const lateralWorld = lateralShiftCm * CM_TO_WORLD;
    const depthWorld = photobioDepthMmToWorldUnits(zMm);
    const radiusCm = sample.beamRadiusCm ?? getBeamRadiusAtDepthMm(zMm, spotSizeCm2, opticsProfile.wavelength);

    slices.push({
      progress,
      zMm,
      worldY: contactSurfaceY - depthWorld,
      worldX: transducerX + lateralWorld + Math.sin(tiltRad) * progress * 0.35,
      radiusWorld: cmRadiusToWorld(radiusCm),
      fluenceRelative: sample.fluenceRelative,
      absorbedRelative: sample.absorbedRelative,
      scatteredRelative: sample.scatteredRelative,
      layerType: sample.layerType,
    });
  }

  return slices;
}

export function buildScatterParticlesFromMap(
  map: PhotobioInteractionMap,
  maxCount: number,
  contactSurfaceY: number,
  stackDepthMm: number,
): ScatterParticle[] {
  const candidates = map.cells
    .filter((c) => c.scatteredRelative > 0.12 && c.fluenceRelative > 0.04)
    .sort((a, b) => b.scatteredRelative * b.fluenceRelative - a.scatteredRelative * a.fluenceRelative);

  const step = Math.max(1, Math.floor(candidates.length / maxCount));
  const particles: ScatterParticle[] = [];

  for (let i = 0; i < candidates.length && particles.length < maxCount; i += step) {
    const cell = candidates[i];
    const x = (cell.xNorm * PHOTOBIO_TISSUE_HALF_WIDTH_WORLD * 0.85);
    const depthWorld = photobioDepthMmToWorldUnits(cell.zMm);
    particles.push({
      x,
      y: contactSurfaceY - depthWorld,
      z: (cell.zNorm - 0.5) * 1.6,
      weight: cell.scatteredRelative * cell.fluenceRelative,
    });
  }

  return particles;
}

export function buildAbsorptionMarkers(
  opticsProfile: PhotobioOpticsResult,
  layout: {
    contactSurfaceY: number;
    epidermisCenterY: number;
    dermisCenterY: number;
    adiposeCenterY: number;
    muscleCenterY: number;
  },
  wavelength: PhotobioWavelength,
  transducerX: number,
  maxMarkers: number,
): AbsorptionMarker[] {
  const samples = opticsProfile.samples ?? [];
  const layerY: Record<PhotobioTissueType, number> = {
    epidermis: layout.epidermisCenterY,
    dermis: layout.dermisCenterY,
    adipose: layout.adiposeCenterY,
    muscle: layout.muscleCenterY,
    bone: layout.muscleCenterY - 0.4,
  };

  const layerBias =
    wavelength === 660
      ? { epidermis: 1.4, dermis: 1.25, adipose: 0.45, muscle: 0.35, bone: 0.2 }
      : { epidermis: 0.35, dermis: 0.45, adipose: 0.85, muscle: 1.1, bone: 0.5 };

  const grouped = new Map<PhotobioTissueType, number>();
  for (const s of samples) {
    const prev = grouped.get(s.layerType) ?? 0;
    grouped.set(s.layerType, Math.max(prev, s.absorbedRelative * s.fluenceRelative));
  }

  const markers: AbsorptionMarker[] = [];
  for (const [layerType, raw] of grouped) {
    const bias = layerBias[layerType] ?? 0.5;
    const intensity = clamp(raw * bias, 0, 1);
    if (intensity < 0.08) continue;

    const count = Math.max(2, Math.round(intensity * (maxMarkers / 4)));
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + layerType.length;
      const spread = 0.15 + intensity * 0.35;
      const wobble = Math.sin(i * 2.17 + layerType.charCodeAt(0)) * 0.03;
      markers.push({
        x: transducerX + Math.cos(angle) * spread,
        y: layerY[layerType] + wobble,
        z: Math.sin(angle) * spread * 0.6,
        intensity,
        layerType,
      });
    }
  }

  return markers.slice(0, maxMarkers);
}

export function getWavelengthBeamColors(wavelength: PhotobioWavelength) {
  const preset = getPhotobioWavelengthVisualPreset(wavelength);
  if (wavelength === 660) {
    return {
      core: preset.beamColor,
      halo: preset.glowColor,
      scatter: "#ff6b35",
      deep: "#cc2200",
      surfaceBoost: 1.35,
      depthBias: 1.25,
    };
  }
  return {
    core: "#9d0070",
    halo: preset.glowColor,
    scatter: "#c4008f",
    deep: "#6b1050",
    surfaceBoost: 0.55,
    depthBias: 0.72,
  };
}

export function sliceOpacity(
  slice: BeamSlice,
  wavelength: PhotobioWavelength,
  coupling: number,
  intensityScale: number,
): number {
  const colors = getWavelengthBeamColors(wavelength);
  const superficial =
    slice.progress < 0.15
      ? colors.surfaceBoost
      : 1 + (1 - slice.progress) * (colors.surfaceBoost - 1) * 0.35;
  const depthAtten = Math.pow(slice.fluenceRelative, wavelength === 660 ? 1.1 : 0.82);
  return clamp(depthAtten * superficial * coupling * intensityScale * 0.42, 0.015, 0.55);
}

export function couplingVisualState(coupling: number, thermalRiskIndex: number) {
  const low = coupling < 0.78;
  const good = coupling >= 0.88 && coupling <= 1.05;
  const thermal = thermalRiskIndex > 0.55;
  return { low, good, thermal, coupling };
}
