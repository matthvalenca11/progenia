/**
 * DICOM Parser - Browser-based DICOM file parsing
 * Uses dicom-parser library for reading DICOM files
 */

import * as dicomParser from 'dicom-parser';

export interface DICOMMetadata {
  instanceNumber: number;
  sliceLocation?: number;
  imagePositionPatient?: [number, number, number];
  imageOrientationPatient?: number[];
  rows: number;
  columns: number;
  pixelSpacing?: [number, number];
  sliceThickness?: number;
  spacingBetweenSlices?: number;
  rescaleSlope?: number;
  rescaleIntercept?: number;
  modality?: string;
  seriesDescription?: string;
  patientId?: string;
  studyDate?: string;
  studyTime?: string;
  tr?: number;
  te?: number;
  bitsAllocated?: number;
  bitsStored?: number;
  samplesPerPixel?: number;
  photometricInterpretation?: string;
}

/**
 * Parse a DICOM file and extract metadata
 */
export async function parseDICOMFile(file: File): Promise<{
  metadata: DICOMMetadata;
  pixelData: Uint16Array | Uint8Array | null;
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
        
        const byteArray = new Uint8Array(arrayBuffer);
        const dataSet = dicomParser.parseDicom(byteArray);
        
        // Helper to get element value
        const getValue = (tag: string, defaultValue?: any) => {
          const element = dataSet.elements[tag];
          if (!element) return defaultValue;
          return dataSet.string(tag) || defaultValue;
        };
        
        const getNumber = (tag: string, defaultValue?: number) => {
          const element = dataSet.elements[tag];
          if (!element) return defaultValue;
          
          // Try multiple methods to extract number
          try {
            // Method 1: Try uint16 (for dimensions)
            if (element.vr === 'US' || element.vr === 'SS' || element.vr === 'IS') {
              const uintValue = dataSet.uint16(tag);
              if (uintValue !== undefined && uintValue !== null) {
                return uintValue;
              }
            }
            
            // Method 2: Try int16
            if (element.vr === 'SS') {
              const intValue = dataSet.int16(tag);
              if (intValue !== undefined && intValue !== null) {
                return intValue;
              }
            }
            
            // Method 3: Try floatString
            const value = dataSet.floatString(tag);
            if (value !== undefined && value !== null && !isNaN(parseFloat(value))) {
              return parseFloat(value);
            }
            
            // Method 4: Try string and parse
            const strValue = dataSet.string(tag);
            if (strValue) {
              const parsed = parseFloat(strValue);
              if (!isNaN(parsed)) {
                return parsed;
              }
            }
          } catch (e) {
            console.warn(`[DICOM Parser] Error reading tag ${tag}:`, e);
          }
          
          return defaultValue;
        };
        
        const getNumberArray = (tag: string): number[] | undefined => {
          const element = dataSet.elements[tag];
          if (!element) return undefined;
          const str = dataSet.string(tag);
          if (!str) return undefined;
          return str.split('\\').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        };
        
        // Extract metadata - try multiple tag formats
        let rows = getNumber('00280010') ?? 0;
        let columns = getNumber('00280011') ?? 0;
        
        // Fallback: try reading directly from dataSet if getNumber fails
        if (rows === 0 || columns === 0) {
          try {
            const rowsElement = dataSet.elements['00280010'];
            const colsElement = dataSet.elements['00280011'];
            if (rowsElement && rows === 0) {
              rows = dataSet.uint16('00280010') ?? 0;
            }
            if (colsElement && columns === 0) {
              columns = dataSet.uint16('00280011') ?? 0;
            }
          } catch (e) {
            console.warn("[DICOM Parser] Fallback dimension extraction failed:", e);
          }
        }
        
        // Additional fallback: check if pixel data exists and infer dimensions
        if ((rows === 0 || columns === 0) && dataSet.elements['7FE00010']) {
          const pixelDataElement = dataSet.elements['7FE00010'];
          const bitsAllocated = getNumber('00280100') ?? 16;
          const samplesPerPixel = getNumber('00280002') ?? 1;
          
          // Try to infer dimensions from pixel data length
          if (pixelDataElement && pixelDataElement.length > 0) {
            const expectedPixels = pixelDataElement.length / (bitsAllocated / 8) / samplesPerPixel;
            const inferredSize = Math.sqrt(expectedPixels);
            
            if (rows === 0 && inferredSize > 0 && Number.isInteger(inferredSize)) {
              rows = inferredSize;
              console.log("[DICOM Parser] Inferred rows from pixel data:", rows);
            }
            if (columns === 0 && inferredSize > 0 && Number.isInteger(inferredSize)) {
              columns = inferredSize;
              console.log("[DICOM Parser] Inferred columns from pixel data:", columns);
            }
          }
        }
        
        console.log("[DICOM Parser] Extracted dimensions:", { rows, columns });
        
        const metadata: DICOMMetadata = {
          instanceNumber: getNumber('00200013') ?? 0,
          sliceLocation: getNumber('00201041'),
          rows,
          columns,
          modality: getValue('00080060'),
          seriesDescription: getValue('00081030'),
          patientId: getValue('00100020'),
          studyDate: getValue('00080020'),
          studyTime: getValue('00080030'),
          tr: getNumber('00180080'), // Repetition Time
          te: getNumber('00180081'), // Echo Time
          bitsAllocated: getNumber('00280100') ?? 16,
          bitsStored: getNumber('00280101') ?? 16,
          samplesPerPixel: getNumber('00280002') ?? 1,
          photometricInterpretation: getValue('00280004'),
        };
        
        console.log("[DICOM Parser] Metadata extracted:", {
          rows: metadata.rows,
          columns: metadata.columns,
          modality: metadata.modality,
          bitsAllocated: metadata.bitsAllocated,
        });
        
        // Pixel spacing
        const pixelSpacingArray = getNumberArray('00280030');
        if (pixelSpacingArray && pixelSpacingArray.length >= 2) {
          metadata.pixelSpacing = [pixelSpacingArray[0], pixelSpacingArray[1]];
        }
        
        // Slice thickness
        metadata.sliceThickness = getNumber('00180050');
        
        // Spacing between slices
        metadata.spacingBetweenSlices = getNumber('00180088');
        
        // Rescale slope/intercept
        metadata.rescaleSlope = getNumber('00281053', 1);
        metadata.rescaleIntercept = getNumber('00281052', 0);
        
        // Image Position Patient
        const imagePositionArray = getNumberArray('00200032');
        if (imagePositionArray && imagePositionArray.length >= 3) {
          metadata.imagePositionPatient = [
            imagePositionArray[0],
            imagePositionArray[1],
            imagePositionArray[2],
          ];
        }
        
        // Image Orientation Patient
        const imageOrientationArray = getNumberArray('00200037');
        if (imageOrientationArray && imageOrientationArray.length >= 6) {
          metadata.imageOrientationPatient = imageOrientationArray;
        }
        
        // Extract pixel data
        let pixelData: Uint16Array | Uint8Array | null = null;
        const pixelDataElement = dataSet.elements['7FE00010'];
        if (pixelDataElement) {
          const pixelDataOffset = pixelDataElement.dataOffset;
          const pixelDataLength = pixelDataElement.length;
          
          console.log("[DICOM Parser] Pixel data element found:", {
            offset: pixelDataOffset,
            length: pixelDataLength,
            bitsAllocated: metadata.bitsAllocated,
            rows: metadata.rows,
            columns: metadata.columns,
            expectedPixels: metadata.rows * metadata.columns,
          });
          
          // Use dicom-parser's utility to get pixel data
          try {
            if (metadata.bitsAllocated === 16) {
              // For 16-bit, read as Uint16Array
              const pixelDataBuffer = arrayBuffer.slice(pixelDataOffset, pixelDataOffset + pixelDataLength);
              // Create Uint16Array directly from buffer (handles endianness automatically)
              pixelData = new Uint16Array(pixelDataBuffer);
            } else if (metadata.bitsAllocated === 8) {
              const pixelDataBuffer = arrayBuffer.slice(pixelDataOffset, pixelDataOffset + pixelDataLength);
              pixelData = new Uint8Array(pixelDataBuffer);
            } else {
              console.warn(`[DICOM Parser] Unsupported bitsAllocated: ${metadata.bitsAllocated}, trying 16-bit`);
              const pixelDataBuffer = arrayBuffer.slice(pixelDataOffset, pixelDataOffset + pixelDataLength);
              pixelData = new Uint16Array(pixelDataBuffer);
            }
            
            // Validate pixel data length matches expected
            const expectedPixels = metadata.rows * metadata.columns;
            if (pixelData.length !== expectedPixels) {
              console.warn(`[DICOM Parser] Pixel data length mismatch: got ${pixelData.length}, expected ${expectedPixels}`);
              // Try to handle cases where there might be padding or extra data
              if (pixelData.length > expectedPixels) {
                pixelData = pixelData.slice(0, expectedPixels) as Uint16Array | Uint8Array;
              }
            }
          } catch (pixelError: any) {
            console.error("[DICOM Parser] Error extracting pixel data:", pixelError);
            // Try fallback: use dicom-parser's utility if available
            try {
              const pixelDataUtil = (dicomParser as any).utilities?.getPixelData;
              if (pixelDataUtil) {
                pixelData = pixelDataUtil(dataSet);
              }
            } catch (fallbackError) {
              console.error("[DICOM Parser] Fallback pixel extraction also failed:", fallbackError);
            }
          }
          
          console.log("[DICOM Parser] Pixel data extracted:", {
            length: pixelData.length,
            firstFew: Array.from(pixelData.slice(0, 10)),
            min: Math.min(...Array.from(pixelData)),
            max: Math.max(...Array.from(pixelData)),
          });
        } else {
          console.warn("[DICOM Parser] No pixel data element found (tag 7FE00010)");
        }
        
        // Validate metadata - but be more lenient
        if (metadata.rows === 0 || metadata.columns === 0) {
          console.error("[DICOM Parser] Invalid dimensions:", {
            rows: metadata.rows,
            columns: metadata.columns,
            file: file.name,
            availableTags: Object.keys(dataSet.elements).slice(0, 20), // Log first 20 tags for debugging
          });
          
          // Try to get more information about the file
          const modality = getValue('00080060');
          const transferSyntax = getValue('00020010');
          const sopClass = getValue('00080016');
          
          console.error("[DICOM Parser] File info:", {
            modality,
            transferSyntax,
            sopClass,
            hasPixelData: !!dataSet.elements['7FE00010'],
            pixelDataLength: dataSet.elements['7FE00010']?.length || 0,
          });
          
          // Don't reject immediately - try to continue with warnings
          console.warn("[DICOM Parser] ⚠️ Continuing with invalid dimensions - file may be corrupted or non-image");
          
          // Set default dimensions if completely missing (will likely fail later, but gives more info)
          if (metadata.rows === 0) metadata.rows = 256; // Common default
          if (metadata.columns === 0) metadata.columns = 256; // Common default
          
          console.warn("[DICOM Parser] Using fallback dimensions:", {
            rows: metadata.rows,
            columns: metadata.columns,
          });
        }
        
        console.log("[DICOM Parser] ✅ File parsed successfully:", {
          rows: metadata.rows,
          columns: metadata.columns,
          hasPixelData: !!pixelData,
          pixelDataLength: pixelData?.length || 0,
          modality: metadata.modality,
        });
        
        resolve({ metadata, pixelData });
      } catch (error: any) {
        reject(new Error(`Failed to parse DICOM file: ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Sort slices by position (prefer ImagePositionPatient, fallback to InstanceNumber)
 */
export function sortDICOMSlices(slices: Array<{ metadata: DICOMMetadata; file: File }>): Array<{ metadata: DICOMMetadata; file: File }> {
  return [...slices].sort((a, b) => {
    // Prefer ImagePositionPatient (z coordinate projected onto normal)
    if (a.metadata.imagePositionPatient && b.metadata.imagePositionPatient) {
      const zA = a.metadata.imagePositionPatient[2];
      const zB = b.metadata.imagePositionPatient[2];
      return zA - zB;
    }
    
    // Fallback to SliceLocation
    if (a.metadata.sliceLocation !== undefined && b.metadata.sliceLocation !== undefined) {
      return a.metadata.sliceLocation - b.metadata.sliceLocation;
    }
    
    // Final fallback: InstanceNumber
    return a.metadata.instanceNumber - b.metadata.instanceNumber;
  });
}

/**
 * Build DICOM Series from sorted slices
 */
export function buildDICOMSeries(
  sortedSlices: Array<{ metadata: DICOMMetadata; file: File; pixelData: Uint16Array | Uint8Array | null }>
): import('@/types/mriLabConfig').DICOMSeries {
  if (sortedSlices.length === 0) {
    throw new Error("Cannot build series from empty slice array");
  }
  
  const firstSlice = sortedSlices[0];
  const rows = firstSlice.metadata.rows;
  const columns = firstSlice.metadata.columns;
  
  // Calculate spacing between slices if not provided
  let spacingBetweenSlices: number | null = null;
  if (sortedSlices.length > 1) {
    const firstPos = sortedSlices[0].metadata.imagePositionPatient;
    const lastPos = sortedSlices[sortedSlices.length - 1].metadata.imagePositionPatient;
    
    if (firstPos && lastPos) {
      const distance = Math.sqrt(
        Math.pow(lastPos[0] - firstPos[0], 2) +
        Math.pow(lastPos[1] - firstPos[1], 2) +
        Math.pow(lastPos[2] - firstPos[2], 2)
      );
      spacingBetweenSlices = distance / (sortedSlices.length - 1);
    } else if (firstSlice.metadata.spacingBetweenSlices) {
      spacingBetweenSlices = firstSlice.metadata.spacingBetweenSlices;
    }
  }
  
  const slices: import('@/types/mriLabConfig').DICOMSlice[] = sortedSlices.map((slice, index) => ({
    file: slice.file,
    imageId: `dicom-${index}-${slice.file.name}`,
    instanceNumber: slice.metadata.instanceNumber,
    sliceLocation: slice.metadata.sliceLocation,
    imagePositionPatient: slice.metadata.imagePositionPatient,
    imageOrientationPatient: slice.metadata.imageOrientationPatient,
    rows: slice.metadata.rows,
    columns: slice.metadata.columns,
    pixelSpacing: slice.metadata.pixelSpacing,
    sliceThickness: slice.metadata.sliceThickness,
    spacingBetweenSlices: spacingBetweenSlices ?? undefined,
    rescaleSlope: slice.metadata.rescaleSlope,
    rescaleIntercept: slice.metadata.rescaleIntercept,
    pixelData: slice.pixelData ?? undefined,
    modality: slice.metadata.modality,
    seriesDescription: slice.metadata.seriesDescription,
    tr: slice.metadata.tr,
    te: slice.metadata.te,
  }));
  
  return {
    slices,
    modality: firstSlice.metadata.modality || "MR",
    seriesDescription: firstSlice.metadata.seriesDescription || "Unknown Series",
    patientId: firstSlice.metadata.patientId,
    studyDate: firstSlice.metadata.studyDate,
    studyTime: firstSlice.metadata.studyTime,
    totalSlices: slices.length,
    rows,
    columns,
    pixelSpacing: firstSlice.metadata.pixelSpacing ?? null,
    sliceThickness: firstSlice.metadata.sliceThickness ?? null,
    spacingBetweenSlices,
  };
}
