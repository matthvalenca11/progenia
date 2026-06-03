import type { UltrasoundLayerConfig } from '@/types/acousticMedia';
import type { UltrasoundSimulationFeatures } from '@/types/ultrasoundAdvanced';
import type { UltrasoundLabState } from '@/stores/ultrasoundLabStore';
import { acousticLayersToAnatomyLayers } from '@/lib/ultrasoundLabConfig';
import type { UltrasoundVideoProfile } from './UltrasoundVideoFeatureExtractor';

export type VideoProfileLabPatch = Partial<
  Pick<
    UltrasoundLabState,
    | 'transducerType'
    | 'frequency'
    | 'depth'
    | 'focus'
    | 'gain'
    | 'dynamicRange'
    | 'acousticLayers'
    | 'layers'
    | 'simulationFeatures'
  >
> & {
  /** Stored in preset override when saving lab JSON (optional). */
  speckleIntensity?: number;
};

/**
 * Maps extracted video statistics to virtual lab simulator parameters.
 */
export function mapVideoProfileToLabPatch(profile: UltrasoundVideoProfile): VideoProfileLabPatch {
  const transducerType =
    profile.transducerType === 'unknown' ? 'linear' : profile.transducerType;

  const simulationFeatures: Partial<UltrasoundSimulationFeatures> = {
    enableAcousticShadow: profile.acousticShadowScore > 0.04,
    enableNearFieldClutter: profile.nearFieldClutterScore > 0.35,
    enableReverberation: profile.reverberationScore > 0.25,
    // Posterior enhancement stays off unless very clear in reference (avoids cyst artifacts)
    enablePosteriorEnhancement: profile.posteriorEnhancementScore > 0.18,
  };

  const acousticLayers: UltrasoundLayerConfig[] = profile.suggestedLayers.map((layer, index) => ({
    id: `video-layer-${index}`,
    mediumId: layer.mediumId,
    name: layer.name,
    thicknessCm: layer.thicknessCm,
    noiseScale: 0.85 + profile.speckleIntensity * 0.2,
    reflectivityBias: layer.reflectivityBias,
  }));

  const totalCm = acousticLayers.reduce((s, l) => s + l.thicknessCm, 0) || profile.depthCm;
  const scale = profile.depthCm / totalCm;
  if (Math.abs(scale - 1) > 0.05) {
    for (const layer of acousticLayers) {
      layer.thicknessCm = Math.round(layer.thicknessCm * scale * 100) / 100;
    }
  }

  return {
    transducerType,
    frequency: profile.frequencyMHz,
    depth: profile.depthCm,
    focus: Math.min(profile.focusCm, profile.depthCm - 0.2),
    gain: profile.gain,
    dynamicRange: profile.dynamicRangeDb,
    acousticLayers,
    layers: acousticLayersToAnatomyLayers(acousticLayers),
    simulationFeatures,
    speckleIntensity: profile.speckleIntensity,
  };
}

export function applyVideoProfileToLabStore(
  profile: UltrasoundVideoProfile,
  loadConfig: (patch: Partial<UltrasoundLabState>) => void,
): VideoProfileLabPatch {
  const patch = mapVideoProfileToLabPatch(profile);
  loadConfig(patch);
  return patch;
}
