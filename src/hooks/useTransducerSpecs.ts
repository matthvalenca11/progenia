import { useMemo } from 'react';
import { TransducerSpec, TransducerType } from '@/types/ultrasoundAdvanced';

/**
 * Get transducer specifications
 */
export function useTransducerSpecs(): Record<TransducerType, TransducerSpec> {
  return useMemo(() => ({
    linear: {
      name: 'Linear',
      type: 'linear',
      frequencyRange: [2, 11],
      depthRange: [1, 6],
      geometryType: 'linear',
      aperture: 40,
      footprint: 40,
    },
    convex: {
      name: 'Convexo',
      type: 'convex',
      frequencyRange: [2, 6],
      depthRange: [3, 15],
      geometryType: 'trapezoid',
      aperture: 50,
      footprint: 60,
      beamAngle: 70,
    },
    microconvex: {
      name: 'Microconvexo',
      type: 'microconvex',
      frequencyRange: [4, 10],
      depthRange: [2, 10],
      geometryType: 'trapezoid',
      aperture: 25,
      footprint: 35,
      beamAngle: 60,
    },
  }), []);
}
