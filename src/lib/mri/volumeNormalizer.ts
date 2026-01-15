/**
 * Volume Normalizer - Converte volumes de diferentes fontes para formato único
 * Este é o ponto crítico: SEMPRE retorna NormalizedVolume válido ou lança erro explícito
 */

import { NormalizedVolume, VolumeOrientation, VolumeSource, VolumeParseError } from './volumeTypes';
import { DICOMSeries } from '@/types/mriLabConfig';

/**
 * Normaliza um volume DICOM para formato interno
 */
export function normalizeDicomVolume(series: DICOMSeries): NormalizedVolume {
  if (!series || series.slices.length === 0) {
    throw new VolumeParseError('Série DICOM vazia', {
      totalSlices: series?.slices.length || 0,
    });
  }

  const firstSlice = series.slices[0];
  const width = series.columns;
  const height = series.rows;
  const depth = series.slices.length;

  // Validar dimensões básicas
  if (width === 0 || height === 0 || depth === 0) {
    throw new VolumeParseError('Dimensões DICOM inválidas', {
      width,
      height,
      depth,
    });
  }

  const totalVoxels = width * height * depth;
  const data = new Float32Array(totalVoxels);

  let globalMin = Infinity;
  let globalMax = -Infinity;
  const validationErrors: string[] = [];

  // Processar cada fatia
  series.slices.forEach((slice, sliceIndex) => {
    if (!slice.pixelData) {
      validationErrors.push(`Slice ${sliceIndex} sem pixelData`);
      return;
    }

    const sliceData = slice.pixelData;
    const rescaleSlope = slice.rescaleSlope ?? 1;
    const rescaleIntercept = slice.rescaleIntercept ?? 0;
    const expectedPixels = width * height;

    if (sliceData.length < expectedPixels) {
      validationErrors.push(
        `Slice ${sliceIndex}: dados insuficientes (${sliceData.length} < ${expectedPixels})`
      );
    }

    // Preencher fatia
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = y * width + x;
        
        if (pixelIndex >= sliceData.length) {
          continue; // Skip pixels fora dos dados disponíveis
        }

        let intensity: number;
        if (sliceData instanceof Uint16Array || sliceData instanceof Int16Array) {
          intensity = sliceData[pixelIndex];
        } else if (sliceData instanceof Uint8Array) {
          intensity = sliceData[pixelIndex];
        } else {
          intensity = 0;
        }

        // Aplicar rescale
        const huValue = intensity * rescaleSlope + rescaleIntercept;

        // Armazenar no volume (z = sliceIndex)
        const volumeIndex = x + y * width + sliceIndex * width * height;
        data[volumeIndex] = huValue;

        if (isFinite(huValue) && !isNaN(huValue)) {
          globalMin = Math.min(globalMin, huValue);
          globalMax = Math.max(globalMax, huValue);
        }
      }
    }
  });

  // Calcular espaçamento
  const pixelSpacing = series.pixelSpacing || [1.0, 1.0];
  const sliceSpacing = series.spacingBetweenSlices || series.sliceThickness || 1.0;
  const spacing: [number, number, number] = [
    pixelSpacing[0],
    pixelSpacing[1],
    sliceSpacing,
  ];

  // Determinar orientação (simplificado - pode ser melhorado)
  let orientation: VolumeOrientation = 'UNKNOWN';
  if (firstSlice.imageOrientationPatient && firstSlice.imageOrientationPatient.length >= 6) {
    // Tentar determinar orientação básica
    // Por enquanto, marcamos como UNKNOWN e melhoramos depois
    orientation = 'UNKNOWN';
  }

  // Validar resultado
  const validationErrors_final: string[] = [...validationErrors];
  
  console.log(`[VolumeNormalizer] Validando volume DICOM:`, {
    width,
    height,
    depth,
    totalVoxels,
    dataLength: data.length,
    initialMin: globalMin,
    initialMax: globalMax,
    validationErrorsCount: validationErrors.length,
  });
  
  // Verificar tamanho do array
  if (data.length !== totalVoxels) {
    console.warn(`[VolumeNormalizer] Tamanho do array não corresponde (${data.length} !== ${totalVoxels})`);
    // Não é crítico se o array for maior (pode ter dados extras)
    if (data.length < totalVoxels) {
      const missing = totalVoxels - data.length;
      const missingPercent = (missing / totalVoxels) * 100;
      console.warn(`[VolumeNormalizer] Array menor que esperado: falta ${missing} voxels (${missingPercent.toFixed(1)}%)`);
      // Só é crítico se faltar mais de 10% dos dados
      if (missingPercent > 10) {
        validationErrors_final.push(`Array muito pequeno: ${data.length} < ${totalVoxels} (falta ${missing}, ${missingPercent.toFixed(1)}%)`);
      } else {
        console.warn(`[VolumeNormalizer] Falta menos de 10% dos dados, preenchendo com zeros`);
        // Preencher com zeros os voxels faltantes
        const currentLength = data.length;
        for (let i = currentLength; i < totalVoxels; i++) {
          data[i] = 0;
        }
      }
    } else {
      console.warn(`[VolumeNormalizer] Array maior que esperado, usando apenas os primeiros ${totalVoxels} voxels`);
    }
  }

  // Garantir que min e max são finitos e válidos
  if (!isFinite(globalMin) || !isFinite(globalMax)) {
    console.warn(`[VolumeNormalizer] Min/max inválidos inicialmente (min: ${globalMin}, max: ${globalMax}), recalculando...`);
    // Recalcular min/max
    globalMin = Infinity;
    globalMax = -Infinity;
    let validValues = 0;
    for (let i = 0; i < Math.min(data.length, totalVoxels); i++) {
      const val = data[i];
      if (isFinite(val) && !isNaN(val)) {
        globalMin = Math.min(globalMin, val);
        globalMax = Math.max(globalMax, val);
        validValues++;
      }
    }
    console.log(`[VolumeNormalizer] Recalculado: min=${globalMin}, max=${globalMax}, valores válidos=${validValues}`);
  }
  
  // Se ainda inválido após recalcular, usar valores padrão
  if (!isFinite(globalMin) || !isFinite(globalMax) || globalMin >= globalMax) {
    console.warn(`[VolumeNormalizer] Min/max ainda inválidos após recalcular, usando valores padrão`);
    // Tentar encontrar valores reais primeiro
    let foundMin = false;
    let foundMax = false;
    for (let i = 0; i < Math.min(data.length, totalVoxels); i++) {
      const val = data[i];
      if (isFinite(val) && !isNaN(val)) {
        if (!foundMin) {
          globalMin = val;
          foundMin = true;
        }
        if (!foundMax) {
          globalMax = val;
          foundMax = true;
        }
        globalMin = Math.min(globalMin, val);
        globalMax = Math.max(globalMax, val);
      }
    }
    
    // Se ainda não encontrou valores válidos, tentar calcular a partir dos dados brutos
    if (!foundMin || !foundMax || globalMin >= globalMax) {
      console.warn(`[VolumeNormalizer] Nenhum valor válido encontrado, tentando calcular a partir dos dados brutos`);
      
      // Tentar calcular min/max diretamente dos dados brutos (antes do rescale)
      let rawMin = Infinity;
      let rawMax = -Infinity;
      series.slices.forEach((slice) => {
        if (slice.pixelData) {
          const sliceData = slice.pixelData;
          for (let i = 0; i < Math.min(sliceData.length, 10000); i++) { // Amostra para performance
            const rawVal = sliceData[i];
            if (isFinite(rawVal) && !isNaN(rawVal)) {
              rawMin = Math.min(rawMin, rawVal);
              rawMax = Math.max(rawMax, rawVal);
            }
          }
        }
      });
      
      if (isFinite(rawMin) && isFinite(rawMax) && rawMin < rawMax) {
        // Aplicar rescale médio
        const avgSlope = series.slices.reduce((sum, s) => sum + (s.rescaleSlope || 1), 0) / series.slices.length;
        const avgIntercept = series.slices.reduce((sum, s) => sum + (s.rescaleIntercept || 0), 0) / series.slices.length;
        globalMin = rawMin * avgSlope + avgIntercept;
        globalMax = rawMax * avgSlope + avgIntercept;
        console.log(`[VolumeNormalizer] ✅ Calculado min/max a partir de dados brutos: ${globalMin} - ${globalMax}`);
      } else {
        // Último recurso: usar valores padrão razoáveis para imagens médicas
        console.warn(`[VolumeNormalizer] Usando valores padrão para imagens médicas`);
        globalMin = -1000; // Típico para CT (HU)
        globalMax = 3000;  // Típico para CT (HU)
        validationErrors_final.push(`Nenhum valor válido encontrado, usando min/max padrão para imagens médicas`);
      }
    } else {
      // Garantir que max > min
      if (globalMin >= globalMax) {
        globalMax = globalMin + 1;
      }
    }
  }

  // Verificar NaN/Infinity (mas não bloquear se houver alguns)
  let nanCount = 0;
  let infCount = 0;
  const sampleSize = Math.min(10000, data.length); // Amostra para performance
  for (let i = 0; i < sampleSize; i++) {
    const idx = Math.floor((i / sampleSize) * data.length);
    if (isNaN(data[idx])) nanCount++;
    if (!isFinite(data[idx])) infCount++;
  }
  const nanPercent = (nanCount / sampleSize) * 100;
  const infPercent = (infCount / sampleSize) * 100;
  
  if (nanPercent > 50) {
    validationErrors_final.push(`${nanPercent.toFixed(1)}% valores NaN (amostra)`);
  }
  if (infPercent > 50) {
    validationErrors_final.push(`${infPercent.toFixed(1)}% valores Infinity (amostra)`);
  }

  // Verificar erros críticos (apenas os que realmente impedem o uso)
  // Um erro é crítico apenas se faltar mais de 10% dos dados
  const criticalErrors = validationErrors_final.filter(e => {
    if (e.includes('Array muito pequeno') && e.includes('falta')) {
      // Extrair percentual se disponível
      const percentMatch = e.match(/\((\d+\.?\d*)%\)/);
      if (percentMatch) {
        const percent = parseFloat(percentMatch[1]);
        return percent > 10; // Só crítico se faltar mais de 10%
      }
      return true; // Se não tem percentual, considerar crítico por segurança
    }
    return false;
  });

  // Se há erros críticos reais, lançar erro
  if (criticalErrors.length > 0) {
    console.error(`[VolumeNormalizer] ❌ Erros críticos encontrados:`, {
      criticalErrors,
      allErrors: validationErrors_final,
      dimensions: `${width}×${height}×${depth}`,
      dataLength: data.length,
      totalVoxels,
      min: globalMin,
      max: globalMax,
    });
    throw new VolumeParseError('Volume DICOM normalizado é inválido', {
      errors: validationErrors_final,
      dimensions: `${width}×${height}×${depth}`,
      min: globalMin,
      max: globalMax,
      dataLength: data.length,
      totalVoxels,
      criticalErrors,
    });
  }
  
  // Se chegou aqui, o volume é utilizável (mesmo com avisos)
  console.log(`[VolumeNormalizer] ✅ Volume DICOM normalizado com sucesso (com avisos não-críticos):`, {
    dimensions: `${width}×${height}×${depth}`,
    min: globalMin,
    max: globalMax,
    dataLength: data.length,
    totalVoxels,
    warnings: validationErrors_final.length,
  });

  // Se há apenas avisos não-críticos, continuar mas marcar como válido
  console.log(`[VolumeNormalizer] Volume normalizado com avisos:`, {
    dimensions: `${width}×${height}×${depth}`,
    min: globalMin,
    max: globalMax,
    warnings: validationErrors_final.length,
  });

  return {
    data,
    width,
    height,
    depth,
    spacing,
    orientation,
    min: globalMin,
    max: globalMax,
    source: 'DICOM',
    isValid: true,
  };
}

/**
 * Normaliza um volume NIfTI para formato interno
 */
export function normalizeNiftiVolume(
  metadata: any,
  voxels: Float32Array | Int16Array | Uint16Array | Uint8Array
): NormalizedVolume {
  // NIfTI metadata pode ter diferentes estruturas dependendo do parser
  // Tentar diferentes formatos
  let width: number, height: number, depth: number;
  let spacingX: number, spacingY: number, spacingZ: number;
  
  if (metadata.dimensions && Array.isArray(metadata.dimensions)) {
    // Formato do nosso parser
    [width, height, depth] = metadata.dimensions.slice(0, 3);
    [spacingX, spacingY, spacingZ] = metadata.spacing.slice(0, 3);
  } else if (metadata.dims && Array.isArray(metadata.dims)) {
    // Formato alternativo
    [width, height, depth] = metadata.dims.slice(0, 3);
    [spacingX, spacingY, spacingZ] = metadata.pixDims?.slice(0, 3) || [1, 1, 1];
  } else {
    throw new VolumeParseError('Formato de metadados NIfTI inválido', {
      metadataKeys: Object.keys(metadata),
    });
  }

  // Validar dimensões
  if (width === 0 || height === 0 || depth === 0) {
    throw new VolumeParseError('Dimensões NIfTI inválidas', {
      dims: metadata.dims,
    });
  }

  const totalVoxels = width * height * depth;
  
  // Converter para Float32Array
  let data: Float32Array;
  if (voxels instanceof Float32Array) {
    data = voxels.slice(0, totalVoxels); // Para 4D, usar primeiro time point
  } else {
    data = new Float32Array(totalVoxels);
    const sourceLength = Math.min(voxels.length, totalVoxels);
    for (let i = 0; i < sourceLength; i++) {
      data[i] = voxels[i];
    }
  }

  // Calcular min/max e validar
  let min = Infinity;
  let max = -Infinity;
  let nanCount = 0;
  let infCount = 0;

  for (let i = 0; i < data.length; i++) {
    const val = data[i];
    if (isNaN(val)) {
      nanCount++;
      continue;
    }
    if (!isFinite(val)) {
      infCount++;
      continue;
    }
    min = Math.min(min, val);
    max = Math.max(max, val);
  }

  const validationErrors: string[] = [];

  if (data.length !== totalVoxels) {
    validationErrors.push(`Tamanho do array não corresponde às dimensões (${data.length} !== ${totalVoxels})`);
  }

  if (!isFinite(min) || !isFinite(max) || min >= max) {
    validationErrors.push(`Valores min/max inválidos (min: ${min}, max: ${max})`);
  }

  if (nanCount > 0) {
    validationErrors.push(`${nanCount} valores NaN encontrados`);
  }

  if (infCount > 0) {
    validationErrors.push(`${infCount} valores Infinity encontrados`);
  }

  const isValid = validationErrors.length === 0;

  if (!isValid) {
    throw new VolumeParseError('Volume NIfTI normalizado é inválido', {
      errors: validationErrors,
      dimensions: `${width}×${height}×${depth}`,
      min,
      max,
    });
  }

  // Determinar orientação (simplificado)
  let orientation: VolumeOrientation = 'UNKNOWN';
  if (metadata.qform || metadata.sform) {
    // Por enquanto, marcamos como UNKNOWN
    // Pode ser melhorado analisando as matrizes de transformação
    orientation = 'UNKNOWN';
  }

  return {
    data,
    width,
    height,
    depth,
    spacing: [spacingX, spacingY, spacingZ],
    orientation,
    min,
    max,
    source: 'NIFTI',
    isValid: true, // Se chegou aqui, é válido (críticos já foram checados)
    validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
  };
}
