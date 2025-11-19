/**
 * Advanced Ultrasound Physics Engine with Acoustic Impedance
 * Renders ultrasound images using layer-based acoustic media and inclusions
 */

import { 
  UltrasoundLayerConfig, 
  UltrasoundInclusionConfig, 
  getAcousticMedium, 
  calculateReflectionCoefficient 
} from "@/types/acousticMedia";

/**
 * Check if a point is inside an inclusion
 */
function isPointInInclusion(
  x: number,
  y: number,
  width: number,
  height: number,
  depthCm: number,
  maxDepthCm: number,
  inclusion: UltrasoundInclusionConfig
): boolean {
  const depthRatio = y / height;
  const lateralRatio = (x - width / 2) / (width / 2);
  const currentDepth = depthRatio * maxDepthCm;
  
  const dx = lateralRatio - inclusion.centerLateralPos;
  const dy = (currentDepth - inclusion.centerDepthCm) / maxDepthCm * 10; // scale for ellipse
  
  const rx = inclusion.sizeCm.width / 2;
  const ry = inclusion.sizeCm.height / 2;
  
  if (inclusion.shape === "circle" || inclusion.shape === "ellipse") {
    const distSq = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
    return distSq <= 1.0;
  } else { // rectangle
    return Math.abs(dx) <= rx && Math.abs(dy * maxDepthCm / 10) <= ry;
  }
}

/**
 * Get the acoustic medium at a specific depth and lateral position
 */
function getMediumAtPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  depthCm: number,
  maxDepthCm: number,
  layers: UltrasoundLayerConfig[],
  inclusions: UltrasoundInclusionConfig[]
): { mediumId: string; medium: ReturnType<typeof getAcousticMedium>; isInclusion: boolean; inclusion?: UltrasoundInclusionConfig } {
  // Check inclusions first (they override layers)
  for (const inclusion of inclusions) {
    if (isPointInInclusion(x, y, width, height, depthCm, maxDepthCm, inclusion)) {
      return {
        mediumId: inclusion.mediumInsideId,
        medium: getAcousticMedium(inclusion.mediumInsideId),
        isInclusion: true,
        inclusion,
      };
    }
  }
  
  // Find which layer we're in based on cumulative depth
  const depthRatio = y / height;
  const currentDepth = depthRatio * maxDepthCm;
  
  let cumulativeDepth = 0;
  for (const layer of layers) {
    cumulativeDepth += layer.thicknessCm;
    if (currentDepth <= cumulativeDepth) {
      return {
        mediumId: layer.mediumId,
        medium: getAcousticMedium(layer.mediumId),
        isInclusion: false,
      };
    }
  }
  
  // Default to last layer if we're beyond all layers
  const lastLayer = layers[layers.length - 1];
  if (lastLayer) {
    return {
      mediumId: lastLayer.mediumId,
      medium: getAcousticMedium(lastLayer.mediumId),
      isInclusion: false,
    };
  }
  
  // Fallback to generic soft tissue
  return {
    mediumId: "generic_soft",
    medium: getAcousticMedium("generic_soft"),
    isInclusion: false,
  };
}

/**
 * Calculate layer interfaces and reflection coefficients
 */
function calculateLayerInterfaces(
  layers: UltrasoundLayerConfig[],
  maxDepthCm: number
): Array<{ depthCm: number; reflectionCoeff: number; prevMediumId: string; nextMediumId: string }> {
  const interfaces: Array<{ depthCm: number; reflectionCoeff: number; prevMediumId: string; nextMediumId: string }> = [];
  
  let cumulativeDepth = 0;
  for (let i = 0; i < layers.length - 1; i++) {
    cumulativeDepth += layers[i].thicknessCm;
    
    if (cumulativeDepth <= maxDepthCm) {
      const prevMedium = getAcousticMedium(layers[i].mediumId);
      const nextMedium = getAcousticMedium(layers[i + 1].mediumId);
      const reflectionCoeff = calculateReflectionCoefficient(
        prevMedium.acousticImpedance_MRayl,
        nextMedium.acousticImpedance_MRayl
      );
      
      interfaces.push({
        depthCm: cumulativeDepth,
        reflectionCoeff,
        prevMediumId: layers[i].mediumId,
        nextMediumId: layers[i + 1].mediumId,
      });
    }
  }
  
  return interfaces;
}

/**
 * Generate ultrasound frame with physics-based rendering
 */
export function generatePhysicsBasedUltrasoundFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gain: number,
  depth: number,
  frequency: number,
  focus: number,
  layers: UltrasoundLayerConfig[],
  inclusions: UltrasoundInclusionConfig[],
  time: number
): void {
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  
  // Calculate layer interfaces for strong reflections
  const interfaces = calculateLayerInterfaces(layers, depth);
  
  // Physics parameters
  const gainFactor = Math.pow(10, (gain - 50) / 40);
  
  // Noise function for speckle
  const noise2D = (x: number, y: number, seed: number = 0): number => {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
    return n - Math.floor(n);
  };
  
  const multiOctaveNoise = (x: number, y: number, octaves: number, seed: number): number => {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      value += noise2D(x * frequency, y * frequency, seed + i) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    
    return value / maxValue;
  };
  
  // Render each pixel
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      const depthRatio = y / height;
      const lateralRatio = (x - width / 2) / width;
      const depthCm = depthRatio * depth;
      
      // Get medium at this position
      const { medium, isInclusion, inclusion } = getMediumAtPosition(
        x, y, width, height, depthCm, depth, layers, inclusions
      );
      
      // Base speckle noise
      const speckleScale = medium.baseEchogenicity === "anechoic" ? 0.1 : 
                          medium.baseEchogenicity === "hypoechoic" ? 0.5 :
                          medium.baseEchogenicity === "isoechoic" ? 0.7 :
                          0.9; // hyperechoic
      
      let speckleNoise = multiOctaveNoise(
        x * 0.15 + time * 0.01,
        y * 0.15,
        4,
        1000
      ) * speckleScale;
      
      // Depth-dependent attenuation using medium's attenuation coefficient
      const attenuationDb = medium.attenuation_dB_per_cm_MHz * frequency * depthCm;
      const attenuationFactor = Math.pow(10, -attenuationDb / 20);
      
      // Focal zone enhancement
      const focalDistance = Math.abs(depthCm - focus);
      const focalGain = 1.0 + 0.3 * Math.exp(-focalDistance * focalDistance);
      
      // Check for interface reflections
      let interfaceReflection = 0;
      for (const iface of interfaces) {
        const distToInterface = Math.abs(depthCm - iface.depthCm);
        if (distToInterface < 0.2) {
          interfaceReflection += iface.reflectionCoeff * Math.exp(-distToInterface * distToInterface * 50);
        }
      }
      
      // Inclusion-specific effects
      if (isInclusion && inclusion) {
        // Border enhancement for sharp borders
        if (inclusion.borderEchogenicity === "sharp") {
          const edgeDist = 0.1; // Distance from edge in cm
          // Check if near edge (simplified)
          const isNearEdge = Math.random() < 0.1; // Placeholder for actual edge detection
          if (isNearEdge) {
            interfaceReflection += 0.5;
          }
        }
        
        // Posterior enhancement (increase intensity below cyst)
        if (inclusion.posteriorEnhancement && depthCm > inclusion.centerDepthCm + inclusion.sizeCm.height / 2) {
          const posteriorDepth = depthCm - (inclusion.centerDepthCm + inclusion.sizeCm.height / 2);
          const posteriorGain = 1.0 + 0.4 * Math.exp(-posteriorDepth * 2);
          speckleNoise *= posteriorGain;
        }
        
        // Strong shadow (reduce intensity below bone/calcification)
        if (inclusion.hasStrongShadow && depthCm > inclusion.centerDepthCm + inclusion.sizeCm.height / 2) {
          const shadowDepth = depthCm - (inclusion.centerDepthCm + inclusion.sizeCm.height / 2);
          const shadowAttenuation = Math.exp(-shadowDepth * 3);
          speckleNoise *= shadowAttenuation * 0.2;
        }
      }
      
      // Combine all factors
      let intensity = speckleNoise * attenuationFactor * focalGain * gainFactor;
      intensity += interfaceReflection * 0.8;
      
      // Beam geometry falloff (lateral)
      const beamWidth = 0.3 + depthCm * 0.05;
      const lateralDist = Math.abs(lateralRatio * depth);
      const beamFalloff = Math.exp(-lateralDist * lateralDist / (beamWidth * beamWidth));
      intensity *= beamFalloff;
      
      // Clamp and convert to grayscale
      intensity = Math.max(0, Math.min(1, intensity));
      const gray = Math.floor(intensity * 255);
      
      data[idx] = gray;
      data[idx + 1] = gray;
      data[idx + 2] = gray;
      data[idx + 3] = 255;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
}
