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
  const width = 64;
  const height = 64;
  const depth = 32;
  const voxels: VoxelMRI[] = [];
  
  if (phantomType === "brain") {
    // Brain-like: WM/GM + ventricles
    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const cx = width / 2;
          const cy = height / 2;
          const cz = depth / 2;
          
          const dx = x - cx;
          const dy = y - cy;
          const dz = z - cz;
          
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const radius = Math.min(width, height, depth) * 0.4;
          
          let tissueType: string;
          
          if (dist > radius) {
            tissueType = "bone"; // Background
          } else if (dist < radius * 0.15) {
            // Center - ventricles (CSF)
            tissueType = "csf";
          } else if (dist < radius * 0.5) {
            // Middle - gray matter
            tissueType = "gray_matter";
          } else {
            // Outer - white matter
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
  if (!volume || !volume.voxels || volume.voxels.length === 0) {
    return null;
  }
  
  const maxSlice = Math.max(0, volume.depth - 1);
  const sliceZ = Math.max(0, Math.min(maxSlice, sliceIndex));
  
  // Extract slice voxels
  const sliceVoxels = volume.voxels.filter((v) => v.z === sliceZ);
  
  if (sliceVoxels.length === 0) {
    return null;
  }
  
  const width = volume.width || 64;
  const height = volume.height || 64;
  const imageData = new Uint8ClampedArray(width * height * 4);
  
  // Initialize with black
  for (let i = 0; i < imageData.length; i += 4) {
    imageData[i] = 0;     // R
    imageData[i + 1] = 0; // G
    imageData[i + 2] = 0; // B
    imageData[i + 3] = 255; // Alpha
  }
  
  // Collect signals for normalization
  const signals = sliceVoxels.map(v => {
    if (v.signal !== undefined) return v.signal;
    // Calculate signal on the fly if not present
    const result = calculateMRISignal(v.properties, tr, te, flipAngle);
    return result.signal;
  });
  
  const minSignal = Math.min(...signals);
  const maxSignal = Math.max(...signals);
  const signalRange = maxSignal - minSignal || 0.001; // Avoid division by zero
  
  // Window/Level processing
  const windowMin = level - window / 2;
  const windowMax = level + window / 2;
  const windowRange = windowMax - windowMin || 0.001;
  
  // Draw voxels
  sliceVoxels.forEach((voxel) => {
    const index = (voxel.y * width + voxel.x) * 4;
    let signal = voxel.signal !== undefined 
      ? voxel.signal 
      : calculateMRISignal(voxel.properties, tr, te, flipAngle).signal;
    
    // Apply window/level
    signal = Math.max(windowMin, Math.min(windowMax, signal));
    const normalized = (signal - windowMin) / windowRange;
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
  try {
    // Generate or load volume based on phantom type
    const volume = generatePhantomVolume(config.phantomType || "brain");
    
    // Calculate signal for each voxel
    const signals: number[] = [];
    const tissueSignals: Record<string, number[]> = {};
    
    volume.voxels.forEach((voxel) => {
      try {
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
      } catch (error) {
        console.error("Error calculating signal for voxel:", error);
        voxel.signal = 0;
        signals.push(0);
      }
    });
    
    // Calculate statistics
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
    
    return {
      volume,
      averageSignal,
      maxSignal,
      minSignal,
      tissueSignals: avgTissueSignals,
      riskFactors,
      recommendations,
    };
  } catch (error) {
    console.error("Error in simulateMRI:", error);
    // Return a safe default result
    return {
      volume: {
        width: 64,
        height: 64,
        depth: 32,
        voxels: [],
      },
      averageSignal: 0,
      maxSignal: 0,
      minSignal: 0,
      tissueSignals: {},
      riskFactors: ["Erro ao simular MRI"],
      recommendations: ["Verifique os parâmetros de configuração"],
    };
  }
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
