/**
 * MRI Engine - Cálculo de sinal e física do MRI
 * Separado dos viewers para permitir evolução independente
 */

import { MRILabConfig, MRIPreset, VolumeMRI, VoxelMRI, TissueProperties, TISSUE_PROPERTIES, MRIPhantomType } from "@/types/mriLabConfig";

export interface MRISignalResult {
  signal: number;
  magnetization: number;
  t1Recovery: number;
  t2Decay: number;
}

export interface MRISimulationResult {
  volume: VolumeMRI;
  averageSignal: number;
  maxSignal: number;
  minSignal: number;
  tissueSignals: Record<string, number>;
  riskFactors: string[];
  recommendations: string[];
}

/**
 * Hybrid synthetic contrast for real volumes (per-voxel, brightness-space)
 * originalValue: intensidade normalizada 0..1
 */
export function calculateSyntheticVoxel(
  originalValueNormalized: number,
  targetTR: number,
  targetTE: number,
  originalTR: number = 500,
  originalTE: number = 15,
): number {
  // Clamp brilho para [0,1]
  const v = Math.min(1, Math.max(0, originalValueNormalized));

  // Ar/osso: praticamente sem sinal e sem alteração relevante
  if (v < 0.05) {
    return v;
  }

  // Classificação aproximada de tecido para T1 original
  let T1 = 600;
  let T2 = 80;

  if (v < 0.15) {
    // CSF
    T1 = 4000;
    T2 = 2000;
  } else if (v < 0.45) {
    // Substância cinzenta
    T1 = 900;
    T2 = 100;
  } else if (v < 0.75) {
    // Substância branca
    T1 = 600;
    T2 = 80;
  } else {
    // Gordura
    T1 = 250;
    T2 = 60;
  }

  const signalModel = (tr: number, te: number) => {
    const t1Rec = 1 - Math.exp(-tr / T1);
    const t2Dec = Math.exp(-te / T2);
    return t1Rec * t2Dec;
  };

  const sOrig = signalModel(originalTR, originalTE);
  const sTarget = signalModel(targetTR, targetTE);

  const denom = Math.max(sOrig, 1e-6);
  const factor = sTarget / denom;

  const synthetic = v * factor;
  return Math.min(1, Math.max(0, synthetic));
}

/**
 * Calculate MRI signal for a voxel using simplified model
 * S ≈ PD * (1 - exp(-TR/T1)) * exp(-TE/T2) * sin(flipAngle)
 */
export function calculateMRISignal(
  tissue: TissueProperties,
  tr: number,
  te: number,
  flipAngle: number,
  sequenceType: MRISequenceType,
  ti?: number,
  isGradientEcho?: boolean,
): MRISignalResult {
  const flipAngleRad = (flipAngle * Math.PI) / 180;

  // T1 recovery factor for non-IR sequences
  const t1Recovery = 1 - Math.exp(-tr / tissue.t1);

  // Base T2 decay
  let t2Effective = tissue.t2;
  // For gradient echo, simulate T2* with faster decay (empirical factor)
  if (isGradientEcho && sequenceType === "gradient_echo") {
    t2Effective = tissue.t2 * 0.6;
  }
  const t2Decay = Math.exp(-te / t2Effective);

  // Flip angle effect
  const flipEffect = Math.sin(flipAngleRad);

  let magnetization: number;
  let signal: number;

  if (sequenceType === "inversion_recovery" && ti != null) {
    // Inversion recovery longitudinal term: Mz ≈ 1 - 2e^{-TI/T1} + e^{-TR/T1}
    const mzLongitudinal =
      tissue.pd * Math.abs(1 - 2 * Math.exp(-ti / tissue.t1) + Math.exp(-tr / tissue.t1));
    magnetization = mzLongitudinal * flipEffect;
    signal = mzLongitudinal * t2Decay * flipEffect;
  } else {
    // Standard SE / GE model: S ≈ PD * (1 - e^{-TR/T1}) * e^{-TE/T2} * sin(α)
    magnetization = tissue.pd * t1Recovery * flipEffect;
    signal = tissue.pd * t1Recovery * t2Decay * flipEffect;
  }

  return {
    signal: Math.max(0, signal),
    magnetization,
    t1Recovery,
    t2Decay,
  };
}

/**
 * Generate procedural phantom volumes
 * In the future, this can be replaced with real volume loading
 */
export function generatePhantomVolume(phantomType: MRIPhantomType = "brain"): VolumeMRI {
  // Increase resolution for better visibility
  const width = 128;
  const height = 128;
  const depth = 64;
  const voxels: VoxelMRI[] = [];
  
  console.log("[MRI Engine] generatePhantomVolume start:", {
    phantomType,
    plannedDims: `${width}x${height}x${depth}`,
    expectedVoxels: width * height * depth,
  });
  
  if (phantomType === "brain") {
    // Brain-like phantom: Anatomically realistic structure
    // Based on real brain anatomy: WM (outer), GM (middle), CSF/ventricles (center)
    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const cx = width / 2;
          const cy = height / 2;
          const cz = depth / 2;
          
          const dx = x - cx;
          const dy = y - cy;
          const dz = z - cz;
          
          // Distance from center (3D)
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const maxRadius = Math.min(width, height, depth) * 0.45;
          
          let tissueType: string;
          
          // Anatomical regions (realistic proportions)
          // 1. Ventricles (CSF) - central, ~15-20% of brain volume
          if (dist < maxRadius * 0.18) {
            tissueType = "csf";
          }
          // 2. Gray Matter (GM) - cortical and subcortical, ~40% of brain volume
          else if (dist < maxRadius * 0.55) {
            // Add some anatomical variation (gyri/sulci pattern)
            const angle = Math.atan2(dy, dx);
            const corticalPattern = Math.sin(angle * 4) * 0.08; // Simulates cortical folds
            if (dist < maxRadius * (0.42 + corticalPattern)) {
              tissueType = "gray_matter";
            } else {
              tissueType = "white_matter";
            }
          }
          // 3. White Matter (WM) - outer layer, ~40% of brain volume
          else if (dist < maxRadius * 0.95) {
            tissueType = "white_matter";
          }
          // 4. Skull/Bone - outer boundary
          else {
            tissueType = "bone";
          }
          
          // Ensure we have a valid tissue type
          if (!tissueType) {
            tissueType = "white_matter";
          }
          
          voxels.push({
            x,
            y,
            z,
            tissueType,
            properties: TISSUE_PROPERTIES[tissueType] || TISSUE_PROPERTIES.white_matter,
          });
        }
      }
    }
  } else if (phantomType === "knee") {
    // Knee-like: bone, cartilage/fluid, muscle
    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const cy = height / 2;
          const distFromCenterY = Math.abs(y - cy);
          
          let tissueType: string;
          
          // Bone at top and bottom
          if (distFromCenterY > height * 0.35) {
            tissueType = "bone";
          } else if (distFromCenterY < height * 0.15) {
            // Center - fluid/cartilage (CSF-like for high T2)
            tissueType = "csf";
          } else {
            // Middle - muscle
            tissueType = "muscle";
          }
          
          voxels.push({
            x,
            y,
            z,
            tissueType,
            properties: TISSUE_PROPERTIES[tissueType] || TISSUE_PROPERTIES.muscle,
          });
        }
      }
    }
  } else if (phantomType === "abdomen") {
    // Abdomen-like: fat, muscle, organ
    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const cx = width / 2;
          const cy = height / 2;
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          let tissueType: string;
          
          if (y < height * 0.2) {
            // Top - subcutaneous fat
            tissueType = "fat";
          } else if (dist < width * 0.25) {
            // Center - organ (muscle-like)
            tissueType = "muscle";
          } else {
            // Outer - muscle
            tissueType = "muscle";
          }
          
          voxels.push({
            x,
            y,
            z,
            tissueType,
            properties: TISSUE_PROPERTIES[tissueType] || TISSUE_PROPERTIES.muscle,
          });
        }
      }
    }
  }
  
  // Validate that we have voxels
  const expectedVoxels = width * height * depth;
  if (voxels.length === 0) {
    console.error("[MRI Engine] ❌ generatePhantomVolume: No voxels generated!");
    // Return a minimal valid volume
    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          voxels.push({
            x,
            y,
            z,
            tissueType: "white_matter",
            properties: TISSUE_PROPERTIES.white_matter,
          });
        }
      }
    }
  }
  
  if (voxels.length !== expectedVoxels) {
    console.error("[MRI Engine] ❌ Voxel count mismatch:", {
      expected: expectedVoxels,
      got: voxels.length,
      dims: `${width}x${height}x${depth}`,
    });
    throw new Error(`Voxel count mismatch in generatePhantomVolume: expected ${expectedVoxels}, got ${voxels.length}`);
  }
  
  console.log("[MRI Engine] ✅ generatePhantomVolume complete:", {
    phantomType,
    dims: `${width}x${height}x${depth}`,
    voxelsLength: voxels.length,
    sampleVoxel: voxels[0],
  });
  
  return {
    width,
    height,
    depth,
    voxels,
  };
}

/**
 * Generate slice image data (pure function)
 * Returns ImageData for a given slice of the volume
 */
export function getSliceImageData(
  volume: VolumeMRI,
  sliceIndex: number,
  tr: number,
  te: number,
  flipAngle: number,
  window: number = 2000,
  level: number = 1000,
  snrRelative: number = 1,
  simulateArtifacts: boolean = false
): ImageData | null {
  // Validate volume
  if (!volume || !volume.voxels || volume.voxels.length === 0) {
    console.warn("getSliceImageData: Volume is empty or invalid");
    return null;
  }
  
  const width = volume.width || 128;
  const height = volume.height || 128;
  const depth = volume.depth || 64;
  
  // Validate dimensions
  if (width <= 0 || height <= 0 || depth <= 0) {
    console.warn(`getSliceImageData: Invalid volume dimensions: ${width}x${height}x${depth}`);
    return null;
  }
  
  // Clamp sliceIndex
  const maxSlice = Math.max(0, depth - 1);
  const sliceZ = Math.max(0, Math.min(maxSlice, sliceIndex));
  
  // Extract slice voxels
  const sliceVoxels = volume.voxels.filter((v) => v.z === sliceZ);
  
  if (sliceVoxels.length === 0) {
    console.warn(`getSliceImageData: No voxels found for slice ${sliceZ}`);
    // Return a black image instead of null
    const imageData = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < imageData.length; i += 4) {
      imageData[i] = 0;
      imageData[i + 1] = 0;
      imageData[i + 2] = 0;
      imageData[i + 3] = 255;
    }
    return new ImageData(imageData, width, height);
  }
  
  const imageData = new Uint8ClampedArray(width * height * 4);
  
  // Initialize with black
  for (let i = 0; i < imageData.length; i += 4) {
    imageData[i] = 0;     // R
    imageData[i + 1] = 0; // G
    imageData[i + 2] = 0; // B
    imageData[i + 3] = 255; // Alpha
  }
  
  // Calculate signals for all voxels in slice
  const signals: number[] = [];
  sliceVoxels.forEach((voxel) => {
    let signal: number;
    if (voxel.signal !== undefined && voxel.signal !== null) {
      signal = voxel.signal;
    } else {
      // Calculate signal on the fly
      const result = calculateMRISignal(voxel.properties, tr, te, flipAngle);
      signal = result.signal;
    }
    signals.push(signal);
  });
  
  // Find min/max for normalization
  const minSignal = Math.min(...signals);
  const maxSignal = Math.max(...signals);
  
  // Ensure we have a valid range (avoid division by zero)
  const signalRange = maxSignal - minSignal;
  const epsilon = 1e-6;
  const effectiveRange = signalRange < epsilon ? epsilon : signalRange;
  
  // Window/Level processing
  const windowMin = level - window / 2;
  const windowMax = level + window / 2;
  const windowRange = windowMax - windowMin;
  const effectiveWindowRange = windowRange < epsilon ? epsilon : windowRange;

  // Noise model: base sigma modulado por SNR relativo
  const snrSafe = Math.max(snrRelative, 0.1);
  const baseSigma = 0.06; // intensidade relativa de ruído
  const noiseSigma = (baseSigma / snrSafe) * 255;

  // Simple Gaussian RNG (Box-Muller)
  const gaussian = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };
  
  // Draw voxels (with optional chemical shift)
  sliceVoxels.forEach((voxel) => {
    let signal: number;
    if (voxel.signal !== undefined && voxel.signal !== null) {
      signal = voxel.signal;
    } else {
      const result = calculateMRISignal(voxel.properties, tr, te, flipAngle);
      signal = result.signal;
    }
    
    // Apply window/level
    let clampedSignal = Math.max(windowMin, Math.min(windowMax, signal));
    const normalized = (clampedSignal - windowMin) / effectiveWindowRange;
    let intensity = Math.min(255, Math.max(0, Math.round(normalized * 255)));

    // Add Gaussian noise inversamente proporcional ao SNR relativo
    const noise = gaussian() * noiseSigma;
    intensity = Math.min(255, Math.max(0, Math.round(intensity + noise)));
    
    // Chemical shift: deslocar gordura no eixo de frequência (x)
    let drawX = voxel.x;
    let drawY = voxel.y;
    if (simulateArtifacts && voxel.tissueType === "fat") {
      drawX = Math.min(width - 1, Math.max(0, voxel.x + 3));
    }

    const clampedX = Math.min(width - 1, Math.max(0, drawX));
    const clampedY = Math.min(height - 1, Math.max(0, drawY));
    const index = (clampedY * width + clampedX) * 4;

    // Grayscale MRI appearance
    imageData[index] = intensity;     // R
    imageData[index + 1] = intensity; // G
    imageData[index + 2] = intensity; // B
    imageData[index + 3] = 255;       // Alpha
  });

  // Motion / ghosting artifact along phase-encoding (vertical) axis
  if (simulateArtifacts) {
    const ghostCopies = 2;
    const alphaFactor = 0.4;
    for (let g = 1; g <= ghostCopies; g++) {
      const offsetY = g * 4;
      for (let y = 0; y < height - offsetY; y++) {
        for (let x = 0; x < width; x++) {
          const srcIdx = (y * width + x) * 4;
          const dstIdx = ((y + offsetY) * width + x) * 4;
          const srcR = imageData[srcIdx];
          const srcG = imageData[srcIdx + 1];
          const srcB = imageData[srcIdx + 2];
          // Alpha blend fantasma sobre o pixel existente
          imageData[dstIdx] = Math.min(255, imageData[dstIdx] + srcR * alphaFactor);
          imageData[dstIdx + 1] = Math.min(255, imageData[dstIdx + 1] + srcG * alphaFactor);
          imageData[dstIdx + 2] = Math.min(255, imageData[dstIdx + 2] + srcB * alphaFactor);
        }
      }
    }
  }

  return new ImageData(imageData, width, height);
}

/**
 * Simulate MRI acquisition
 */
export function simulateMRI(config: MRILabConfig): MRISimulationResult {
  console.log("[MRI Engine] simulateMRI start:", {
    phantomType: config.phantomType || "brain",
    tr: config.tr,
    te: config.te,
    flipAngle: config.flipAngle,
    preset: config.preset,
  });
  
  // NO TRY-CATCH HERE - let errors propagate to store
  // Generate or load volume based on phantom type
  const volume = generatePhantomVolume(config.phantomType || "brain");
  
  console.log("[MRI Engine] Volume generated:", {
    dims: `${volume.width}x${volume.height}x${volume.depth}`,
    voxelsLength: volume.voxels.length,
    expectedVoxels: volume.width * volume.height * volume.depth,
  });
  
  // STRICT VALIDATION - throw explicit errors
  if (!volume) {
    throw new Error("generatePhantomVolume returned null or undefined");
  }
  
  if (!volume.voxels || volume.voxels.length === 0) {
    throw new Error(`Generated volume has no voxels (phantomType: ${config.phantomType || "brain"})`);
  }
  
  if (volume.width <= 0 || volume.height <= 0 || volume.depth <= 0) {
    throw new Error(`Invalid volume dimensions: ${volume.width}x${volume.height}x${volume.depth}`);
  }
  
  // Validate voxel count matches dimensions
  const expectedVoxels = volume.width * volume.height * volume.depth;
  if (volume.voxels.length !== expectedVoxels) {
    throw new Error(`Voxel count mismatch: expected ${expectedVoxels}, got ${volume.voxels.length}`);
  }
    
  // Calculate signal for each voxel
  const signals: number[] = [];
  const tissueSignals: Record<string, number[]> = {};
  
  volume.voxels.forEach((voxel) => {
    const result = calculateMRISignal(
      voxel.properties,
      config.tr,
      config.te,
      config.flipAngle,
      config.sequenceType,
      config.ti,
      config.isGradientEcho,
    );
    
    voxel.signal = result.signal;
    signals.push(result.signal);
    
    if (!tissueSignals[voxel.tissueType]) {
      tissueSignals[voxel.tissueType] = [];
    }
    tissueSignals[voxel.tissueType].push(result.signal);
  });
  
  // Apply relative SNR scaling based on Matrix Size and NEX
  const matrixSize = config.matrixSize ?? 128;
  const nex = config.nex ?? 1;
  const safeMatrix = matrixSize || 128;
  const safeNex = Math.max(nex, 1);
  const snrRelative = Math.sqrt(safeNex) / (safeMatrix / 128);

  const scaledSignals: number[] = [];
  volume.voxels.forEach((voxel, idx) => {
    if (voxel.signal == null) return;
    const scaled = voxel.signal * snrRelative;
    voxel.signal = scaled;
    scaledSignals.push(scaled);
    signals[idx] = scaled;
  });

  // Calculate statistics with scaled signals
  if (signals.length === 0) {
    throw new Error("No signals calculated - all voxels failed");
  }
  
  const averageSignal = signals.reduce((a, b) => a + b, 0) / signals.length;
  const maxSignal = Math.max(...signals);
  const minSignal = Math.min(...signals);
  
  // Average signal per tissue type
  const avgTissueSignals: Record<string, number> = {};
  Object.keys(tissueSignals).forEach((tissue) => {
    const tissueSigs = tissueSignals[tissue];
    avgTissueSignals[tissue] = tissueSigs.reduce((a, b) => a + b, 0) / tissueSigs.length;
  });
  
  // Risk factors and recommendations
  const riskFactors: string[] = [];
  const recommendations: string[] = [];
  
  if (config.tr < 300) {
    riskFactors.push("TR muito baixo pode reduzir contraste T1");
    recommendations.push("Aumente TR para melhor contraste T1");
  }
  
  if (config.te > 150) {
    riskFactors.push("TE muito alto pode reduzir sinal significativamente");
    recommendations.push("Reduza TE para melhor relação sinal/ruído");
  }
  
  if (config.flipAngle > 90) {
    riskFactors.push("Flip angle > 90° pode reduzir sinal");
    recommendations.push("Use flip angle ≤ 90° para Spin Echo");
  }
  
  console.log("[MRI Engine] ✅ simulateMRI complete:", {
    dims: `${volume.width}x${volume.height}x${volume.depth}`,
    voxelsLength: volume.voxels.length,
    signalsLength: signals.length,
    averageSignal: averageSignal.toFixed(4),
    minSignal: minSignal.toFixed(4),
    maxSignal: maxSignal.toFixed(4),
  });
  
  // Return result with validated volume
  return {
    volume,
    averageSignal,
    maxSignal,
    minSignal,
    tissueSignals: avgTissueSignals,
    riskFactors,
    recommendations,
  };
}

/**
 * Apply preset to config
 */
export function applyMRIPreset(preset: MRIPreset): Partial<MRILabConfig> {
  switch (preset) {
    case "t1_weighted":
      return {
        preset: "t1_weighted",
        tr: 500,
        te: 20,
        flipAngle: 90,
        sequenceType: "spin_echo",
      };
    case "t2_weighted":
      return {
        preset: "t2_weighted",
        tr: 3000,
        te: 100,
        flipAngle: 90,
        sequenceType: "spin_echo",
      };
    case "proton_density":
      return {
        preset: "proton_density",
        tr: 3000,
        te: 20,
        flipAngle: 90,
        sequenceType: "spin_echo",
      };
    default:
      return {};
  }
}
