/**
 * NIfTI Parser - Browser-based NIfTI file parsing
 * Uses nifti-reader-js library for reading NIfTI files
 */

import { NIFTI1 } from 'nifti-reader-js';

export interface NIfTIMetadata {
  dims: [number, number, number, number]; // [x, y, z, t] dimensions
  pixDims: [number, number, number, number]; // Pixel dimensions/spacing
  qform?: number[][]; // Affine transformation matrix
  sform?: number[][]; // Standard space transformation matrix
  datatype: number; // Data type code
  bitpix: number; // Bits per pixel
  sclSlope?: number; // Scale slope
  sclInter?: number; // Scale intercept
  descrip?: string; // Description
  intentName?: string; // Intent name
  calMin?: number; // Calibration minimum
  calMax?: number; // Calibration maximum
}

/**
 * Parse a NIfTI file and extract metadata and voxel data
 */
export async function parseNIfTIFile(file: File): Promise<{
  metadata: NIfTIMetadata;
  voxels: Float32Array | Int16Array | Uint16Array | Uint8Array;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
          reject(new Error("Failed to read file"));
          return;
        }
        
        console.log("[NIfTI Parser] File read, size:", arrayBuffer.byteLength, "bytes");
        
        // Parse NIfTI file
        const nifti = NIFTI1.read(arrayBuffer);
        
        if (!nifti) {
          reject(new Error("Failed to parse NIfTI file - invalid format"));
          return;
        }
        
        console.log("[NIfTI Parser] NIfTI parsed successfully");
        
        // Extract dimensions
        const dims: [number, number, number, number] = [
          nifti.dims[1] || 0,
          nifti.dims[2] || 0,
          nifti.dims[3] || 0,
          nifti.dims[4] || 1, // Time dimension, default to 1
        ];
        
        // Extract pixel dimensions
        const pixDims: [number, number, number, number] = [
          nifti.pixDims[1] || 1.0,
          nifti.pixDims[2] || 1.0,
          nifti.pixDims[3] || 1.0,
          nifti.pixDims[4] || 1.0,
        ];
        
        // Validate dimensions
        if (dims[0] === 0 || dims[1] === 0 || dims[2] === 0) {
          reject(new Error(`NIfTI file has invalid dimensions: ${dims[0]}×${dims[1]}×${dims[2]}`));
          return;
        }
        
        // Extract voxel data
        const totalVoxels = dims[0] * dims[1] * dims[2] * dims[3];
        let voxels: Float32Array | Int16Array | Uint16Array | Uint8Array;
        
        // Get raw data array based on datatype
        const rawData = nifti.data;
        
        if (rawData instanceof Float32Array) {
          voxels = rawData;
        } else if (rawData instanceof Int16Array) {
          voxels = rawData;
        } else if (rawData instanceof Uint16Array) {
          voxels = rawData;
        } else if (rawData instanceof Uint8Array) {
          voxels = rawData;
        } else {
          // Convert to Float32Array as fallback
          voxels = new Float32Array(rawData);
        }
        
        // Apply scale slope/intercept if available
        if (nifti.sclSlope !== undefined && nifti.sclSlope !== 0) {
          const slope = nifti.sclSlope;
          const intercept = nifti.sclInter || 0;
          const scaledVoxels = new Float32Array(voxels.length);
          for (let i = 0; i < voxels.length; i++) {
            scaledVoxels[i] = voxels[i] * slope + intercept;
          }
          voxels = scaledVoxels;
        }
        
        // Extract metadata
        const metadata: NIfTIMetadata = {
          dims,
          pixDims,
          datatype: nifti.datatype || 0,
          bitpix: nifti.bitpix || 16,
          sclSlope: nifti.sclSlope,
          sclInter: nifti.sclInter,
          descrip: nifti.descrip,
          intentName: nifti.intentName,
          calMin: nifti.calMin,
          calMax: nifti.calMax,
        };
        
        // Extract transformation matrices if available
        if (nifti.qform && nifti.qform.length > 0) {
          metadata.qform = nifti.qform;
        }
        if (nifti.sform && nifti.sform.length > 0) {
          metadata.sform = nifti.sform;
        }
        
        console.log("[NIfTI Parser] ✅ File parsed successfully:", {
          dims: `${dims[0]}×${dims[1]}×${dims[2]}×${dims[3]}`,
          pixDims: pixDims.slice(0, 3),
          voxelsLength: voxels.length,
          datatype: metadata.datatype,
          bitpix: metadata.bitpix,
          min: Math.min(...Array.from(voxels.slice(0, Math.min(1000, voxels.length)))),
          max: Math.max(...Array.from(voxels.slice(0, Math.min(1000, voxels.length)))),
        });
        
        resolve({ metadata, voxels });
      } catch (error: any) {
        console.error("[NIfTI Parser] Error parsing file:", error);
        reject(new Error(`Failed to parse NIfTI file: ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Build NIfTI Volume from parsed file
 */
export function buildNIfTIVolume(
  metadata: NIfTIMetadata,
  voxels: Float32Array | Int16Array | Uint16Array | Uint8Array
): import('@/types/mriLabConfig').DICOMVolume {
  const [width, height, depth, timeDim] = metadata.dims;
  
  // For now, use first time point if 4D
  const totalVoxels = width * height * depth;
  const volumeVoxels = timeDim > 1 
    ? voxels.slice(0, totalVoxels) 
    : voxels;
  
  // Convert to Float32Array for consistency
  const floatVoxels = volumeVoxels instanceof Float32Array
    ? volumeVoxels
    : new Float32Array(volumeVoxels);
  
  // Calculate min/max
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < floatVoxels.length; i++) {
    const val = floatVoxels[i];
    if (!isNaN(val) && isFinite(val)) {
      min = Math.min(min, val);
      max = Math.max(max, val);
    }
  }
  
  if (min === Infinity) min = 0;
  if (max === -Infinity) max = 0;
  
  const [spacingX, spacingY, spacingZ] = metadata.pixDims;
  
  console.log("[NIfTI Parser] ✅ Volume built:", {
    dimensions: `${width}×${height}×${depth}`,
    spacing: [spacingX, spacingY, spacingZ],
    min,
    max,
    voxelsLength: floatVoxels.length,
  });
  
  return {
    width,
    height,
    depth,
    voxels: floatVoxels,
    min,
    max,
    spacing: [spacingX, spacingY, spacingZ],
    origin: [0, 0, 0], // NIfTI origin is typically in the transformation matrix
    direction: new Float32Array([1, 0, 0, 0, 1, 0]), // Default direction, can be extracted from qform/sform
  };
}
