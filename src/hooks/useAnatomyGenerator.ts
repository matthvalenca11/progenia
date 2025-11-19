import { useMemo } from 'react';
import { AnatomyLayer, AnatomyPreset } from '@/types/ultrasoundAdvanced';

export function useAnatomyGenerator(preset: AnatomyPreset): AnatomyLayer[] {
  return useMemo(() => [
    { name: 'skin', depthRange: [0, 0.05], reflectivity: 0.85, echogenicity: 'hyperechoic', texture: 'homogeneous', attenuationCoeff: 0.3 },
    { name: 'fat', depthRange: [0.05, 0.18], reflectivity: 0.15, echogenicity: 'hypoechoic', texture: 'heterogeneous', attenuationCoeff: 0.5 },
    { name: 'muscle', depthRange: [0.18, 1.0], reflectivity: 0.35, echogenicity: 'isoechoic', texture: 'striated', attenuationCoeff: 0.6 },
  ], [preset]);
}
