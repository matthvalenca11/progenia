/**
 * MRI Lab Configuration Types
 */

export type MRISequenceType = "spin_echo" | "gradient_echo" | "inversion_recovery";

export type MRIViewerType = "magnetization" | "slice_2d" | "volume_3d";

export type MRIPreset = "t1_weighted" | "t2_weighted" | "proton_density" | "custom";

export type MRIPhantomType = "brain" | "knee" | "abdomen";

export interface MRILabConfig {
  // Preset
  preset: MRIPreset;
  
  // Phantom Type
  phantomType?: MRIPhantomType;
  
  // Acquisition Parameters
  tr: number; // Repetition Time (ms)
  te: number; // Echo Time (ms)
  flipAngle: number; // Flip angle (degrees)
  sequenceType: MRISequenceType;
  
  // Active Viewer
  activeViewer: MRIViewerType;
  
  // Slice selection (for 2D viewer)
  sliceIndex?: number;
  
  // Window/Level for 2D viewer
  window?: number; // Window width for contrast
  level?: number;  // Window center/level
  
  // Enabled Controls
  enabledControls: {
    preset: boolean;
    tr: boolean;
    te: boolean;
    flipAngle: boolean;
    sequenceType: boolean;
    viewer: boolean;
  };
  
  // Ranges
  ranges: {
    tr: { min: number; max: number };
    te: { min: number; max: number };
    flipAngle: { min: number; max: number };
  };
}

export const defaultMRILabConfig: MRILabConfig = {
  preset: "t1_weighted",
  phantomType: "brain",
  tr: 500,
  te: 20,
  flipAngle: 90,
  sequenceType: "spin_echo",
  activeViewer: "magnetization",
  sliceIndex: 0,
  window: 2000, // Default window width
  level: 1000,  // Default window center
  enabledControls: {
    preset: true,
    tr: true,
    te: true,
    flipAngle: true,
    sequenceType: true,
    viewer: true,
  },
  ranges: {
    tr: { min: 100, max: 5000 },
    te: { min: 10, max: 200 },
    flipAngle: { min: 10, max: 180 },
  },
};

// Tissue Properties (T1, T2, Proton Density)
export interface TissueProperties {
  t1: number; // T1 relaxation time (ms)
  t2: number; // T2 relaxation time (ms)
  pd: number; // Proton Density (0-1)
  name: string;
  color?: string; // For visualization
}

export const TISSUE_PROPERTIES: Record<string, TissueProperties> = {
  csf: {
    name: "CSF",
    t1: 4000,
    t2: 2000,
    pd: 1.0,
    color: "#4A90E2",
  },
  white_matter: {
    name: "White Matter",
    t1: 800,
    t2: 80,
    pd: 0.7,
    color: "#E8E8E8",
  },
  gray_matter: {
    name: "Gray Matter",
    t1: 1200,
    t2: 100,
    pd: 0.85,
    color: "#A0A0A0",
  },
  muscle: {
    name: "Muscle",
    t1: 900,
    t2: 50,
    pd: 0.8,
    color: "#E06A6A",
  },
  fat: {
    name: "Fat",
    t1: 250,
    t2: 60,
    pd: 0.9,
    color: "#F2D16B",
  },
  bone: {
    name: "Bone",
    t1: 500,
    t2: 0.5,
    pd: 0.1,
    color: "#D9D9D9",
  },
};

// Volume MRI Structure
export interface VolumeMRI {
  width: number;
  height: number;
  depth: number;
  voxels: VoxelMRI[];
}

export interface VoxelMRI {
  x: number;
  y: number;
  z: number;
  tissueType: string;
  properties: TissueProperties;
  signal?: number; // Calculated signal intensity
}
