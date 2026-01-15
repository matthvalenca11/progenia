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
 * Calculate MRI signal for a voxel using simplified model
 * S ≈ PD * (1 - exp(-TR/T1)) * exp(-TE/T2) * sin(flipAngle)
 */
export function calculateMRISignal(
  tissue: TissueProperties,
  tr: number,
  te: number,
  flipAngle: number
): MRISignalResult {
  const flipAngleRad = (flipAngle * Math.PI) / 180;
  
  // T1 recovery factor
  const t1Recovery = 1 - Math.exp(-tr / tissue.t1);
  
  // T2 decay factor
  const t2Decay = Math.exp(-te / tissue.t2);
  
  // Flip angle effect
  const flipEffect = Math.sin(flipAngleRad);
  
  // Magnetization (before T2 decay)
  const magnetization = tissue.pd * t1Recovery * flipEffect;
  
  // Final signal
  const signal = tissue.pd * t1Recovery * t2Decay * flipEffect;
  
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
  level: number = 1000
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
  
  // Draw voxels
  sliceVoxels.forEach((voxel) => {
    const index = (voxel.y * width + voxel.x) * 4;
    
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
    const intensity = Math.min(255, Math.max(0, Math.round(normalized * 255)));
    
    // Grayscale MRI appearance
    imageData[index] = intensity;     // R
    imageData[index + 1] = intensity; // G
    imageData[index + 2] = intensity; // B
    imageData[index + 3] = 255;       // Alpha
  });
  
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
      config.flipAngle
    );
    
    voxel.signal = result.signal;
    signals.push(result.signal);
    
    if (!tissueSignals[voxel.tissueType]) {
      tissueSignals[voxel.tissueType] = [];
    }
    tissueSignals[voxel.tissueType].push(result.signal);
  });
  
  // Calculate statistics
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
