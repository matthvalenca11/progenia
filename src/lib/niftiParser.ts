/**
 * NIfTI Parser - Browser-based NIfTI file parsing
 * Uses nifti-reader-js library for reading NIfTI files
 */

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
  // Ler arquivo como ArrayBuffer
  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as ArrayBuffer;
      if (result) {
        resolve(result);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
  
  console.log("[NIfTI Parser] File read, size:", arrayBuffer.byteLength, "bytes");
  
  // Carregar nifti-reader-js dinamicamente (compatível com browser)
  const niftiModule = await import('nifti-reader-js');
  
  // nifti-reader-js exporta NIFTI1 como classe, mas o método read é estático
  // Verificar todas as formas possíveis de acesso
  const NIFTI1Class = (niftiModule as any).NIFTI1 || (niftiModule as any).default?.NIFTI1 || (niftiModule as any).default;
  
  if (!NIFTI1Class) {
    throw new Error('NIFTI1 not found in nifti-reader-js module. Available exports: ' + Object.keys(niftiModule).join(', '));
  }
  
  console.log('[NIfTI Parser] NIFTI1 loaded:', {
    type: typeof NIFTI1Class,
    hasRead: typeof NIFTI1Class?.read === 'function',
    hasParse: typeof NIFTI1Class?.parse === 'function',
    isClass: typeof NIFTI1Class === 'function' && NIFTI1Class.prototype,
    keys: Object.keys(NIFTI1Class || {}).slice(0, 10),
  });
  
  // Parse NIfTI file
  // nifti-reader-js: NIFTI1.read() é um método estático da classe
  let nifti: any;
  
  try {
    // Tentar método estático read primeiro (forma mais comum)
    if (typeof NIFTI1Class.read === 'function') {
      nifti = NIFTI1Class.read(arrayBuffer);
    } 
    // Tentar método parse se read não existir
    else if (typeof NIFTI1Class.parse === 'function') {
      nifti = NIFTI1Class.parse(arrayBuffer);
    }
    // Se for uma classe, tentar instanciar com new e passar arrayBuffer
    else if (typeof NIFTI1Class === 'function') {
      // Verificar se é uma classe (tem prototype)
      if (NIFTI1Class.prototype) {
        // É uma classe - instanciar com new
        nifti = new NIFTI1Class(arrayBuffer);
      } else {
        // É uma função - chamar diretamente
        nifti = NIFTI1Class(arrayBuffer);
      }
    } else {
      throw new Error('NIFTI1.read/parse is not available. NIFTI1 type: ' + typeof NIFTI1Class);
    }
  } catch (err: any) {
    // Se der erro de "cannot be invoked without 'new'", tentar com new
    if (err.message && err.message.includes('cannot be invoked without')) {
      try {
        nifti = new NIFTI1Class(arrayBuffer);
      } catch (newErr: any) {
        throw new Error(`Failed to parse NIfTI: ${err.message}. Also tried with 'new': ${newErr.message}`);
      }
    } else {
      throw new Error(`Failed to parse NIfTI: ${err.message}`);
    }
  }
  
  if (!nifti) {
    throw new Error("Failed to parse NIfTI file - invalid format");
  }
  
  console.log("[NIfTI Parser] NIfTI parsed successfully");
  console.log("[NIfTI Parser] NIfTI object structure:", {
    keys: Object.keys(nifti),
    dims: nifti.dims,
    pixDims: nifti.pixDims,
    hasData: !!nifti.data,
    dataType: nifti.data?.constructor?.name,
    dataLength: nifti.data?.length,
  });
  
  // Extract dimensions
  // nifti-reader-js pode retornar dims como array começando em 0 ou 1
  // Verificar estrutura real
  let dims: [number, number, number, number];
  
  if (Array.isArray(nifti.dims)) {
    // Se dims[0] for o número de dimensões, começar em dims[1]
    // Se dims[0] for a primeira dimensão, usar dims[0]
    if (nifti.dims[0] > 0 && nifti.dims[0] < 10) {
      // dims[0] provavelmente é o número de dimensões, começar em dims[1]
      dims = [
        nifti.dims[1] || 0,
        nifti.dims[2] || 0,
        nifti.dims[3] || 0,
        nifti.dims[4] || 1,
      ];
    } else {
      // dims[0] é a primeira dimensão
      dims = [
        nifti.dims[0] || 0,
        nifti.dims[1] || 0,
        nifti.dims[2] || 0,
        nifti.dims[3] || 1,
      ];
    }
  } else if (nifti.dims && typeof nifti.dims === 'object') {
    // Pode ser um objeto com propriedades
    dims = [
      (nifti.dims as any).x || (nifti.dims as any).width || (nifti.dims as any)[0] || 0,
      (nifti.dims as any).y || (nifti.dims as any).height || (nifti.dims as any)[1] || 0,
      (nifti.dims as any).z || (nifti.dims as any).depth || (nifti.dims as any)[2] || 0,
      (nifti.dims as any).t || (nifti.dims as any).time || (nifti.dims as any)[3] || 1,
    ];
  } else {
    // Tentar inferir das propriedades do objeto
    dims = [
      (nifti as any).width || (nifti as any).nx || 0,
      (nifti as any).height || (nifti as any).ny || 0,
      (nifti as any).depth || (nifti as any).nz || 0,
      (nifti as any).nt || 1,
    ];
  }
  
  // Extract pixel dimensions
  let pixDims: [number, number, number, number];
  
  if (Array.isArray(nifti.pixDims)) {
    if (nifti.pixDims[0] > 0 && nifti.pixDims[0] < 10) {
      // pixDims[0] provavelmente é o número de dimensões
      pixDims = [
        nifti.pixDims[1] || 1.0,
        nifti.pixDims[2] || 1.0,
        nifti.pixDims[3] || 1.0,
        nifti.pixDims[4] || 1.0,
      ];
    } else {
      pixDims = [
        nifti.pixDims[0] || 1.0,
        nifti.pixDims[1] || 1.0,
        nifti.pixDims[2] || 1.0,
        nifti.pixDims[3] || 1.0,
      ];
    }
  } else {
    pixDims = [
      (nifti.pixDims as any)?.x || (nifti.pixDims as any)?.[0] || 1.0,
      (nifti.pixDims as any)?.y || (nifti.pixDims as any)?.[1] || 1.0,
      (nifti.pixDims as any)?.z || (nifti.pixDims as any)?.[2] || 1.0,
      (nifti.pixDims as any)?.t || (nifti.pixDims as any)?.[3] || 1.0,
    ];
  }
  
  console.log("[NIfTI Parser] Extracted dimensions:", { dims, pixDims });
  
  // Validate dimensions
  if (dims[0] === 0 || dims[1] === 0 || dims[2] === 0) {
    throw new Error(`NIfTI file has invalid dimensions: ${dims[0]}×${dims[1]}×${dims[2]}`);
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
  
  return { metadata, voxels };
}

/**
 * Build NIfTI Volume from parsed file
 */
export function buildNIfTIVolume(
  metadata: NIfTIMetadata,
  voxels: Float32Array | Int16Array | Uint16Array | Uint8Array
): import('@/stores/mriLabStore').DICOMVolume {
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
    pixelSpacing: [spacingX, spacingY] as [number, number],
    sliceThickness: spacingZ,
    spacingBetweenSlices: spacingZ,
  };
}
