import { useEffect, useRef } from 'react';
import { UltrasoundParams } from '@/types/ultrasound';

/**
 * Simple noise generator for speckle texture
 */
function noise2D(x: number, y: number, seed: number = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Multi-octave noise for realistic speckle
 */
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
 * Rayleigh distribution for realistic speckle intensity
 */
function rayleighDistribution(x: number, sigma: number = 0.5): number {
  return (x / (sigma * sigma)) * Math.exp(-(x * x) / (2 * sigma * sigma));
}

/**
 * Box-Muller transform for Gaussian random
 */
function gaussianRandom(mean: number = 0, stdDev: number = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * Generate realistic ultrasound frame
 */
function generateUltrasoundFrame(
  ctx: CanvasRenderingContext2D,
  params: UltrasoundParams
): void {
  const { width, height, gain, depth, frequency, focus, time } = params;

  // Create image data
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  // Physics parameters
  const attenuationCoeff = 0.7 * frequency; // dB/cm/MHz (increased for stronger attenuation)
  const maxDepthCm = depth;
  const focusDepthCm = focus;
  const gainFactor = Math.pow(10, (gain - 50) / 50); // Convert to linear scale
  const beamWidth = 2.0 / frequency; // Narrower beam for higher frequency

  // Tissue layers (as depth ratios)
  const skinEnd = 0.06;
  const fatEnd = 0.20;
  const fascia1Depth = 0.25;
  const fascia2Depth = 0.45;
  const muscleStart = 0.30;
  const deepShadowStart = 0.75;
  const boneDepth = 0.85;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Normalize coordinates
      const depthRatio = y / height;
      const lateralRatio = (x - width / 2) / width;
      const depthCm = depthRatio * maxDepthCm;

      // Beam geometry (trapezoid/fan shape)
      const beamCenterWidth = 0.15 + depthRatio * 0.35; // Widens with depth
      const beamEdgeSmooth = 0.08;
      const distanceFromCenter = Math.abs(lateralRatio);
      let beamIntensity = 1.0;

      if (distanceFromCenter > beamCenterWidth) {
        const overshoot = (distanceFromCenter - beamCenterWidth) / beamEdgeSmooth;
        beamIntensity = Math.max(0, 1 - overshoot);
      }

      // Depth attenuation
      const attenuation_dB = attenuationCoeff * depthCm;
      const attenuationFactor = Math.pow(10, -attenuation_dB / 20);

      // Focal zone enhancement with beam narrowing and blur
      const focusSigma = 1.0;
      const distanceFromFocus = Math.abs(depthCm - focusDepthCm);
      const focusEnhancement = Math.exp(
        -Math.pow(distanceFromFocus, 2) / (2 * focusSigma * focusSigma)
      );
      const totalFocusGain = 0.6 + 0.8 * focusEnhancement;
      
      // Blur away from focus (reduces contrast)
      const blurFactor = 1.0 - 0.3 * Math.min(distanceFromFocus / 2, 1);

      // Multi-scale speckle with Rayleigh modulation
      const noiseScale = 0.02 * frequency; // Higher frequency = finer speckle
      const fineSpeckle = multiOctaveNoise(
        x * noiseScale + time * 0.008,
        y * noiseScale + time * 0.012,
        4,
        12345
      );
      const mediumSpeckle = multiOctaveNoise(
        x * noiseScale * 0.5 + time * 0.005,
        y * noiseScale * 0.5 + time * 0.007,
        3,
        54321
      );
      
      // Rayleigh-distributed speckle intensity
      const speckleBase = (fineSpeckle * 0.6 + mediumSpeckle * 0.4);
      const rayleighMod = rayleighDistribution(speckleBase, 0.4);
      const speckleNoise = speckleBase * (0.7 + 0.3 * rayleighMod);

      // Tissue-specific reflectivity with enhanced layers
      let tissueReflectivity = 0.3; // Base muscle
      let tissueBoost = 1.0;
      let posteriorEnhancement = 1.0;

      // Near-field clutter (very bright close to probe)
      if (depthRatio < 0.03) {
        tissueReflectivity = 0.95;
        tissueBoost = 2.0;
      }
      // Bright skin surface
      else if (depthRatio < skinEnd) {
        tissueReflectivity = 0.85;
        tissueBoost = 1.4;
      }
      // Heterogeneous subcutaneous fat (hypoechoic with texture)
      else if (depthRatio < fatEnd) {
        const fatNoise = multiOctaveNoise(x * 0.03, y * 0.03, 2, 99999);
        tissueReflectivity = 0.12 + fatNoise * 0.08;
        tissueBoost = 0.6;
        posteriorEnhancement = 1.15; // Posterior enhancement below hypoechoic
      }
      // Hyperechoic fascia line 1
      else if (Math.abs(depthRatio - fascia1Depth) < 0.015) {
        tissueReflectivity = 0.90;
        tissueBoost = 2.0;
      }
      // Muscle with anisotropic striations
      else if (depthRatio >= muscleStart && depthRatio < deepShadowStart) {
        const striationAngle = Math.sin((y * 0.25 + x * 0.08) + time * 0.08);
        const striationPattern = Math.abs(striationAngle) * 0.2 + 0.8;
        tissueReflectivity = 0.32 * striationPattern;
        tissueBoost = 1.0;
      }
      // Hyperechoic fascia line 2
      else if (Math.abs(depthRatio - fascia2Depth) < 0.015) {
        tissueReflectivity = 0.88;
        tissueBoost = 1.9;
      }
      // Deep soft shadow
      else if (depthRatio >= deepShadowStart && depthRatio < boneDepth) {
        tissueReflectivity = 0.15;
        tissueBoost = 0.5;
      }
      // Bone-like reflective band with acoustic shadowing
      else if (depthRatio >= boneDepth) {
        if (Math.abs(depthRatio - boneDepth) < 0.02) {
          // Bright bone surface
          tissueReflectivity = 0.95;
          tissueBoost = 2.2;
        } else {
          // Acoustic shadow below bone
          tissueReflectivity = 0.05;
          tissueBoost = 0.3;
        }
      }

      // Lateral shadowing near edges
      const edgeDistance = Math.abs(lateralRatio);
      if (edgeDistance > 0.4) {
        const shadowFactor = Math.max(0, 1 - (edgeDistance - 0.4) / 0.1);
        tissueBoost *= 0.5 + 0.5 * shadowFactor;
      }

      // Combine all factors
      let intensity =
        tissueReflectivity *
        attenuationFactor *
        totalFocusGain *
        beamIntensity *
        gainFactor *
        tissueBoost *
        posteriorEnhancement *
        blurFactor *
        (0.4 + 0.6 * speckleNoise);

      // Add subtle motion/shimmer and micro-jitter
      const motionNoise = Math.sin(time * 0.5 + x * 0.1 + y * 0.1) * 0.03;
      const jitter = (Math.random() - 0.5) * 0.015;
      intensity *= 0.97 + motionNoise + jitter;

      // Clamp and convert to grayscale
      intensity = Math.max(0, Math.min(1, intensity));
      const pixelValue = Math.floor(intensity * 255);

      data[idx] = pixelValue;     // R
      data[idx + 1] = pixelValue; // G
      data[idx + 2] = pixelValue; // B
      data[idx + 3] = 255;        // A
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Custom hook for ultrasound image engine
 */
export function useUltrasoundImageEngine(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  params: UltrasoundParams,
  isActive: boolean = true
) {
  const animationFrameRef = useRef<number>();
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isActive) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Animation loop
    const animate = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      
      generateUltrasoundFrame(ctx, {
        ...params,
        time: elapsed,
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [canvasRef, params, isActive]);
}
