/**
 * MRI Lab Configuration Types
 */

export type MRISequenceType = "spin_echo" | "gradient_echo" | "inversion_recovery";

export type MRIViewerType = "magnetization" | "slice_2d" | "volume_3d";

export type MRIPreset = "t1_weighted" | "t2_weighted" | "proton_density" | "custom";

export type MRIPhantomType = "brain" | "knee" | "abdomen";

export type MRIDataSource = "phantom" | "dicom" | "nifti";

export type MRIModule = "magnetization" | "clinical_image";

export interface MRILabConfig {
  // Data Source Mode
  dataSource: MRIDataSource; // "phantom" or "dicom"
  
  // Enabled Modules
  enabledModules: {
    magnetization: boolean; // Physics/conceptual module
    clinicalImage: boolean; // DICOM image module
  };
  
  // Preset (for phantom mode)
  preset: MRIPreset;
  
  // Phantom Type (for phantom mode)
  phantomType?: MRIPhantomType;
  
  // Acquisition Parameters (for phantom mode)
  tr: number; // Repetition Time (ms)
  te: number; // Echo Time (ms)
  flipAngle: number; // Flip angle (degrees)
  sequenceType: MRISequenceType;
  
  // Active Viewer
  activeViewer: MRIViewerType;
  
  // Viewer modes (for DICOM)
  viewer2DMode?: 'cornerstone' | 'canvas'; // Default: cornerstone
  viewer3DMode?: 'mpr' | 'volume'; // Default: mpr
  
  // Slice selection (for 2D viewer)
  sliceIndex?: number;
  
  // Window/Level for 2D viewer
  window?: number; // Window width for contrast
  level?: number;  // Window center/level
  
  // DICOM Series (for dicom mode)
  dicomSeries?: DICOMSeries;
  
  // NIfTI Volume (for nifti mode)
  niftiVolume?: DICOMVolume; // Reuse DICOMVolume type for NIfTI
  
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
  dataSource: "phantom",
  enabledModules: {
    magnetization: true,
    clinicalImage: false,
  },
  preset: "t1_weighted",
  phantomType: "brain",
  tr: 500,
  te: 20,
  flipAngle: 90,
  sequenceType: "spin_echo",
  activeViewer: "magnetization",
  viewer2DMode: "cornerstone",
  viewer3DMode: "mpr",
  sliceIndex: 0, // Will be set to middle slice after volume generation
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
    name: "Líquido Cefalorraquidiano (LCR)",
    t1: 4000, // T1 longo (água pura)
    t2: 2000, // T2 muito longo
    pd: 1.0,  // Alta densidade de prótons
    color: "#4A90E2",
  },
  white_matter: {
    name: "Substância Branca",
    t1: 800,  // T1 intermediário
    t2: 80,   // T2 curto (mielina)
    pd: 0.7,  // Densidade intermediária
    color: "#E8E8E8",
  },
  gray_matter: {
    name: "Substância Cinzenta",
    t1: 1200, // T1 mais longo que WM
    t2: 100,  // T2 mais longo que WM
    pd: 0.85, // Maior densidade que WM
    color: "#A0A0A0",
  },
  muscle: {
    name: "Músculo",
    t1: 900,  // T1 similar a tecidos moles
    t2: 50,   // T2 curto
    pd: 0.8,  // Densidade intermediária
    color: "#E06A6A",
  },
  fat: {
    name: "Tecido Adiposo",
    t1: 250,  // T1 muito curto (característico)
    t2: 60,   // T2 intermediário
    pd: 0.9,  // Alta densidade
    color: "#F2D16B",
  },
  bone: {
    name: "Osso",
    t1: 500,  // T1 longo
    t2: 0.5,  // T2 extremamente curto (praticamente sem sinal)
    pd: 0.1,  // Baixíssima densidade de prótons
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

// DICOM Series Types
export interface DICOMSlice {
  file: File;
  imageId: string; // Unique identifier for the image
  instanceNumber: number;
  sliceLocation?: number;
  imagePositionPatient?: [number, number, number]; // [x, y, z] in mm
  imageOrientationPatient?: number[]; // 6 values: row/column direction cosines
  rows: number;
  columns: number;
  pixelSpacing?: [number, number]; // [row, column] spacing in mm
  sliceThickness?: number;
  spacingBetweenSlices?: number;
  rescaleSlope?: number;
  rescaleIntercept?: number;
  pixelData?: Uint16Array | Uint8Array; // Pixel intensity values
  modality?: string;
  seriesDescription?: string;
  tr?: number; // Repetition Time (if available)
  te?: number; // Echo Time (if available)
}

export interface DICOMSeries {
  slices: DICOMSlice[];
  modality: string;
  seriesDescription: string;
  patientId?: string;
  studyDate?: string;
  studyTime?: string;
  // Computed metadata
  totalSlices: number;
  rows: number;
  columns: number;
  pixelSpacing: [number, number] | null;
  sliceThickness: number | null;
  spacingBetweenSlices: number | null;
  // Volume dimensions (after reconstruction)
  volumeWidth?: number;
  volumeHeight?: number;
  volumeDepth?: number;
}
