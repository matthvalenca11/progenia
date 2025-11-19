import { useEffect, useRef } from 'react';
import { UltrasoundPhysicsParams, AnatomyLayer } from '@/types/ultrasoundAdvanced';

/**
 * Enhanced noise functions for realistic speckle generation
 */
function noise2D(x: number, y: number, seed: number = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

function multiOctaveNoise(x: number, y: number, octaves: number, seed: number): number {
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
}

/**
 * Perlin-like smooth noise for organic textures
 */
function smoothNoise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const x1 = x0 + 1;
  const y0 = Math.floor(y);
  const y1 = y0 + 1;
  
  const sx = x - x0;
  const sy = y - y0;
  
  const n00 = noise2D(x0, y0);
  const n10 = noise2D(x1, y0);
  const n01 = noise2D(x0, y1);
  const n11 = noise2D(x1, y1);
  
  const nx0 = n00 * (1 - sx) + n10 * sx;
  const nx1 = n01 * (1 - sx) + n11 * sx;
  
  return nx0 * (1 - sy) + nx1 * sy;
}

/**
 * Rayleigh distribution for realistic speckle
 */
function rayleighNoise(sigma: number = 0.5): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.abs(Math.cos(2 * Math.PI * u2));
}

/**
 * Enhanced velocity field generator for realistic Doppler
 */
function generateVelocityField(
  width: number,
  height: number,
  layers: AnatomyLayer[],
  depthCm: number,
  time: number
): Float32Array {
  const velocityField = new Float32Array(width * height * 2); // vx, vy
  
  for (let y = 0; y < height; y++) {
    const depthRatio = y / height;
    const currentDepth = depthRatio * depthCm;
    
    // Find if we're in a vessel
    const layer = layers.find(l => {
      const [minD, maxD] = l.depthRange;
      return depthRatio >= minD && depthRatio <= maxD && l.hasFlow;
    });
    
    if (layer && layer.flowVelocity) {
      for (let x = 0; x < width; x++) {
        const lateralRatio = (x - width / 2) / width;
        const idx = (y * width + x) * 2;
        
        // Parabolic flow profile (laminar) with pulsation
        const distFromCenter = Math.abs(lateralRatio * 4);
        const radialProfile = Math.max(0, 1 - distFromCenter * distFromCenter);
        
        // Add pulsatile component (simulates cardiac cycle)
        const pulsation = 0.85 + 0.15 * Math.sin(time * 3.0);
        
        // Add turbulence at edges
        const turbulence = distFromCenter > 0.7 ? 
          (Math.random() - 0.5) * 0.2 : 0;
        
        // Velocity in cm/s
        const baseVelocity = layer.flowVelocity * radialProfile * pulsation;
        const velocity = baseVelocity + turbulence;
        
        velocityField[idx] = velocity * 0.866; // vx (mostly axial, cos 30°)
        velocityField[idx + 1] = velocity * 0.5; // vy (some lateral, sin 30°)
      }
    }
  }
  
  return velocityField;
}

/**
 * Generate ultrasound frame with advanced physics
 */
function generateAdvancedUltrasoundFrame(
  ctx: CanvasRenderingContext2D,
  params: UltrasoundPhysicsParams,
  layers: AnatomyLayer[]
): void {
  const { width, height, gain, depth, frequency, focus, dynamicRange, tgcCurve, transducer, mode, time } = params;

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  // Physics constants
  const baseAttenuationCoeff = 0.65;
  const attenuationCoeff = baseAttenuationCoeff * frequency;
  const gainFactor = Math.pow(10, (gain - 50) / 40);
  const focusDepthCm = focus;
  const maxDepthCm = depth;

  // Geometry parameters based on transducer
  const { geometryType, beamAngle } = transducer;
  
  // Generate velocity field for Doppler modes
  const velocityField = (mode === 'color-doppler') 
    ? generateVelocityField(width, height, layers, maxDepthCm, time)
    : null;

  // Simple beam simulation
  const numAngles = 1;
  const angleRange = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Normalized coordinates
      const depthRatio = y / height;
      const lateralRatio = (x - width / 2) / width;
      const depthCm = depthRatio * maxDepthCm;

      // Beam geometry - respecting transducer type
      let beamIntensity = 1.0;
      
      if (geometryType === 'sector') {
        // Phased array - true sector scan (narrow origin, wide field)
        const maxAngle = (beamAngle || 90) / 2; // degrees
        const angleRad = (lateralRatio * maxAngle * Math.PI) / 180;
        const distFromAxis = Math.abs(Math.tan(angleRad) * depthRatio);
        const beamWidth = 0.15 + depthRatio * 0.35; // Widens significantly with depth
        
        if (distFromAxis > beamWidth) {
          const overshoot = (distFromAxis - beamWidth) / 0.10;
          beamIntensity = Math.max(0, 1 - overshoot * overshoot);
        }
      } else if (geometryType === 'trapezoid') {
        // Convex/curved array - trapezoidal field
        const beamWidth = 0.20 + depthRatio * 0.28; // Moderate widening
        const distFromCenter = Math.abs(lateralRatio);
        
        if (distFromCenter > beamWidth) {
          const overshoot = (distFromCenter - beamWidth) / 0.10;
          beamIntensity = Math.max(0, 1 - overshoot * overshoot);
        }
      } else {
        // Linear scan - rectangular field with PARALLEL edges
        const beamCenterWidth = 0.35; // Fixed width, NO widening with depth
        const distFromCenter = Math.abs(lateralRatio);
        
        if (distFromCenter > beamCenterWidth) {
          const overshoot = (distFromCenter - beamCenterWidth) / 0.08;
          beamIntensity = Math.max(0, 1 - overshoot);
        }
      }

      // Depth attenuation with TGC compensation
      const attenuation_dB = attenuationCoeff * depthCm;
      let attenuationFactor = Math.pow(10, -attenuation_dB / 20);
      
      // Apply TGC curve (8 zones)
      const tgcIndex = Math.floor(depthRatio * 8);
      const tgcGain = tgcCurve[Math.min(tgcIndex, 7)] / 50;
      attenuationFactor *= (1 + tgcGain * 0.5);

      // Focal zone enhancement
      const focusSigma = 0.8;
      const distanceFromFocus = Math.abs(depthCm - focusDepthCm);
      const focusEnhancement = Math.exp(
        -Math.pow(distanceFromFocus, 2) / (2 * focusSigma * focusSigma)
      );
      const totalFocusGain = 0.65 + 0.7 * focusEnhancement;
      
      // Blur away from focus
      const blurFactor = 1.0 - 0.25 * Math.min(distanceFromFocus / 2, 1);

      // Enhanced multi-scale Rayleigh-distributed speckle
      const noiseScale = 0.02 + 0.03 * (frequency / 15); // Frequency-dependent grain
      
      // Three octaves for realistic texture
      const fineSpeckle = multiOctaveNoise(
        x * noiseScale * 2 + time * 0.008,
        y * noiseScale * 2 + time * 0.012,
        6,
        12345
      );
      const mediumSpeckle = smoothNoise(
        x * noiseScale * 0.5 + time * 0.005,
        y * noiseScale * 0.5 + time * 0.007
      );
      const coarseSpeckle = multiOctaveNoise(
        x * noiseScale * 0.15 + time * 0.003,
        y * noiseScale * 0.15 + time * 0.004,
        2,
        54321
      );
      
      // Rayleigh distribution for realistic amplitude
      const rayleighMod = rayleighNoise(0.4);
      const speckleBase = (
        fineSpeckle * 0.55 + 
        mediumSpeckle * 0.30 + 
        coarseSpeckle * 0.15
      );
      const speckleNoise = speckleBase * (0.5 + 0.5 * rayleighMod);

      // Find current anatomical layer
      const currentLayer = layers.find(l => {
        const [minD, maxD] = l.depthRange;
        return depthRatio >= minD && depthRatio <= maxD;
      });

      let tissueReflectivity = 0.30;
      let tissueBoost = 1.0;
      let posteriorEnhancement = 1.0;
      let textureModulation = 1.0;

      if (currentLayer) {
        tissueReflectivity = currentLayer.reflectivity;
        attenuationFactor *= Math.exp(-currentLayer.attenuationCoeff * depthCm * 0.5);

        // Texture-based modulation
        switch (currentLayer.texture) {
          case 'striated': {
            const striationAngle = Math.sin((y * 0.2 + x * 0.06) + time * 0.05);
            textureModulation = 0.85 + Math.abs(striationAngle) * 0.15;
            break;
          }
          case 'fibrillar': {
            const fibrilPattern = Math.sin(y * 0.4 + time * 0.08) * Math.cos(x * 0.15);
            textureModulation = 0.90 + Math.abs(fibrilPattern) * 0.10;
            break;
          }
          case 'heterogeneous': {
            const heteroNoise = multiOctaveNoise(x * 0.04, y * 0.04, 2, 77777);
            textureModulation = 0.80 + heteroNoise * 0.20;
            break;
          }
          case 'homogeneous':
          default:
            textureModulation = 1.0;
        }

        // Echogenicity boost
        switch (currentLayer.echogenicity) {
          case 'anechoic':
            tissueBoost = 0.05;
            posteriorEnhancement = 1.20; // Enhancement below cysts/vessels
            break;
          case 'hypoechoic':
            tissueBoost = 0.45;
            posteriorEnhancement = 1.10;
            break;
          case 'isoechoic':
            tissueBoost = 1.0;
            break;
          case 'hyperechoic':
            tissueBoost = 1.8;
            break;
        }
      }

      // Check for posterior enhancement from previous layers
      for (const layer of layers) {
        if (layer.depthRange[1] < depthRatio && layer.echogenicity === 'anechoic') {
          posteriorEnhancement *= 1.12;
        }
      }

      // Near-field clutter
      if (depthRatio < 0.03) {
        tissueBoost *= 2.5;
        tissueReflectivity = Math.max(tissueReflectivity, 0.85);
      }

      // Lateral shadowing
      const edgeDistance = Math.abs(lateralRatio);
      if (edgeDistance > 0.38) {
        const shadowFactor = Math.max(0, 1 - (edgeDistance - 0.38) / 0.15);
        tissueBoost *= 0.4 + 0.6 * shadowFactor;
      }

      // Apply all modulations
      let intensity =
        tissueReflectivity *
        attenuationFactor *
        totalFocusGain *
        beamIntensity *
        gainFactor *
        tissueBoost *
        posteriorEnhancement *
        blurFactor *
        textureModulation *
        (0.35 + 0.65 * speckleNoise);

      // Add motion jitter
      const motionNoise = Math.sin(time * 0.4 + x * 0.08 + y * 0.12) * 0.02;
      const microJitter = (Math.random() - 0.5) * 0.012;
      intensity *= 0.98 + motionNoise + microJitter;

      // Mode-specific rendering
      if (mode === 'color-doppler' && velocityField && currentLayer?.hasFlow) {
        const velIdx = (y * width + x) * 2;
        const vx = velocityField[velIdx];
        const vy = velocityField[velIdx + 1];
        const velocity = Math.sqrt(vx * vx + vy * vy);
        
        if (velocity > 0.8) {
          // Enhanced Doppler shift calculation
          const dopplerShift = (2 * frequency * 1e6 * velocity * Math.cos(Math.PI / 6)) / 1540; // Hz with angle
          const prf = 3000 + frequency * 200; // PRF varies with frequency
          const nyquistVel = (prf * 1540) / (4 * frequency * 1e6); // Nyquist limit
          const normalized = velocity / nyquistVel;
          
          // Aliasing with wrapping
          let wrappedVel = normalized;
          if (Math.abs(wrappedVel) > 1) {
            wrappedVel = ((wrappedVel + 1) % 2) - 1;
          }
          
          // Add Doppler noise
          const dopplerNoise = (Math.random() - 0.5) * 0.15;
          wrappedVel += dopplerNoise;
          
          // Enhanced color mapping with saturation
          const saturation = Math.min(1, Math.abs(wrappedVel) * 1.2);
          const brightness = 0.6 + 0.4 * saturation;
          
          if (wrappedVel > 0) {
            // Toward probe - RED spectrum
            data[idx] = Math.min(255, 80 + wrappedVel * 175 * brightness);
            data[idx + 1] = Math.min(255, 10 + wrappedVel * 45 * brightness);
            data[idx + 2] = 0;
          } else {
            // Away from probe - BLUE spectrum
            data[idx] = 0;
            data[idx + 1] = Math.min(255, 10 - wrappedVel * 45 * brightness);
            data[idx + 2] = Math.min(255, 80 - wrappedVel * 175 * brightness);
          }
          data[idx + 3] = Math.min(255, saturation * 240);
        } else {
          // No significant flow - show B-mode with slight transparency
          const pixelValue = Math.floor(Math.max(0, Math.min(1, intensity)) * 255);
          data[idx] = pixelValue;
          data[idx + 1] = pixelValue;
          data[idx + 2] = pixelValue;
          data[idx + 3] = 255;
        }
      } else {
        // B-mode, M-mode, harmonic - grayscale
        // Dynamic range compression
        intensity = Math.pow(intensity, 1 / (dynamicRange / 50));
        
        // Clamp and convert to grayscale
        const pixelValue = Math.floor(Math.max(0, Math.min(1, intensity)) * 255);
        
        data[idx] = pixelValue;
        data[idx + 1] = pixelValue;
        data[idx + 2] = pixelValue;
        data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Advanced ultrasound engine hook
 */
export function useUltrasoundEngineAdvanced(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  params: UltrasoundPhysicsParams,
  layers: AnatomyLayer[],
  isActive: boolean = true
) {
  const animationFrameRef = useRef<number>();
  const startTimeRef = useRef<number>(Date.now());
  const lastRenderRef = useRef<number>(0);
  const targetFPS = 30; // Limit to 30 FPS for better performance
  const frameInterval = 1000 / targetFPS;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isActive) return;

    const ctx = canvas.getContext('2d', { 
      alpha: false,
      desynchronized: true, // Improve performance
      willReadFrequently: false
    });
    if (!ctx) return;

    // Throttled animation loop for better performance
    const animate = (timestamp: number) => {
      const elapsed = timestamp - lastRenderRef.current;
      
      if (elapsed >= frameInterval) {
        lastRenderRef.current = timestamp - (elapsed % frameInterval);
        const time = (Date.now() - startTimeRef.current) / 1000;
        
        generateAdvancedUltrasoundFrame(ctx, {
          ...params,
          time,
        }, layers);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [canvasRef, params, layers, isActive]);
}
