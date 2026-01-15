/**
 * Volume Loader - Carrega e detecta automaticamente DICOM ou NIfTI
 * Entrada: File[] (múltiplos .dcm ou um único .nii/.nii.gz)
 * Saída: ParsedVolume normalizado
 */

import { ParsedVolume, VolumeParseError } from './volumeTypes';
import { parseDICOMFile, sortDICOMSlices, buildDICOMSeries } from '@/lib/dicomParser';
import { parseNIfTIFile, buildNIfTIVolume } from '@/lib/niftiParser';
import { normalizeDicomVolume, normalizeNiftiVolume } from './volumeNormalizer';

/**
 * Detecta o tipo de arquivo automaticamente
 */
export function detectFileType(files: File[]): 'DICOM' | 'NIFTI' | 'INVALID' {
  if (files.length === 0) {
    return 'INVALID';
  }

  // Verificar se há arquivo .nii ou .nii.gz
  const hasNifti = files.some(f => 
    f.name.toLowerCase().endsWith('.nii') || 
    f.name.toLowerCase().endsWith('.nii.gz')
  );

  if (hasNifti) {
    if (files.length > 1) {
      throw new VolumeParseError('Múltiplos arquivos detectados, mas um deles é NIfTI. NIfTI deve ser um único arquivo.', {
        files: files.map(f => f.name),
      });
    }
    return 'NIFTI';
  }

  // Verificar se todos são .dcm
  const allDcm = files.every(f => f.name.toLowerCase().endsWith('.dcm'));
  if (allDcm) {
    return 'DICOM';
  }

  // Mistura inválida
  throw new VolumeParseError('Mistura inválida de tipos de arquivo. Use apenas arquivos .dcm (múltiplos) ou um único .nii/.nii.gz', {
    files: files.map(f => ({ name: f.name, type: f.type })),
  });
}

/**
 * Carrega uma série DICOM e retorna volume normalizado
 */
export async function loadDicomSeries(files: File[]): Promise<ParsedVolume> {
  if (files.length === 0) {
    throw new VolumeParseError('Nenhum arquivo DICOM fornecido');
  }

  console.log('[VolumeLoader] Carregando série DICOM:', files.length, 'arquivos');

  try {
    // Parse todos os arquivos
    const parsedSlices = await Promise.all(
      files.map(async (file, index) => {
        try {
          const { metadata, pixelData } = await parseDICOMFile(file);
          return { metadata, file, pixelData };
        } catch (error: any) {
          throw new VolumeParseError(`Erro ao processar ${file.name}: ${error.message}`, {
            fileName: file.name,
            fileIndex: index,
            originalError: error.message,
          });
        }
      })
    );

    // Ordenar fatias
    const sortedSlices = sortDICOMSlices(parsedSlices);

    // Construir série
    const series = buildDICOMSeries(sortedSlices);

    // Normalizar volume
    let volume: NormalizedVolume;
    try {
      volume = normalizeDicomVolume(series);
      console.log('[VolumeLoader] ✅ DICOM carregado e normalizado:', {
        dimensions: `${volume.width}×${volume.height}×${volume.depth}`,
        spacing: volume.spacing,
        min: volume.min,
        max: volume.max,
        isValid: volume.isValid,
        warnings: volume.validationErrors?.length || 0,
      });
    } catch (error: any) {
      console.error('[VolumeLoader] ❌ Erro ao normalizar volume DICOM:', error);
      // Re-throw com contexto adicional
      if (error instanceof VolumeParseError) {
        throw error;
      }
      throw new VolumeParseError(`Erro ao normalizar volume DICOM: ${error.message}`, {
        originalError: error.message,
        seriesInfo: {
          totalSlices: series.totalSlices,
          rows: series.rows,
          columns: series.columns,
        },
      });
    }

    return {
      volume,
      metadata: {
        modality: series.modality,
        seriesDescription: series.seriesDescription,
        patientId: series.patientId,
        studyDate: series.studyDate,
        totalSlices: series.totalSlices,
      },
    };
  } catch (error: any) {
    if (error instanceof VolumeParseError) {
      throw error;
    }
    throw new VolumeParseError(`Erro ao carregar série DICOM: ${error.message}`, {
      originalError: error.message,
      stack: error.stack,
    });
  }
}

/**
 * Carrega um arquivo NIfTI e retorna volume normalizado
 */
export async function loadNifti(file: File): Promise<ParsedVolume> {
  console.log('[VolumeLoader] Carregando arquivo NIfTI:', file.name);

  try {
    // Parse NIfTI
    const { metadata, voxels } = await parseNIfTIFile(file);

    // Normalizar volume
    const volume = normalizeNiftiVolume(metadata, voxels);

    console.log('[VolumeLoader] ✅ NIfTI carregado e normalizado:', {
      dimensions: `${volume.width}×${volume.height}×${volume.depth}`,
      spacing: volume.spacing,
      min: volume.min,
      max: volume.max,
    });

    return {
      volume,
      metadata: {
        descrip: metadata.descrip,
        intentName: metadata.intentName,
      },
    };
  } catch (error: any) {
    if (error instanceof VolumeParseError) {
      throw error;
    }
    throw new VolumeParseError(`Erro ao carregar arquivo NIfTI: ${error.message}`, {
      fileName: file.name,
      originalError: error.message,
      stack: error.stack,
    });
  }
}

/**
 * Carrega arquivos automaticamente detectando o tipo
 */
export async function loadVolume(files: File[]): Promise<ParsedVolume> {
  if (files.length === 0) {
    throw new VolumeParseError('Nenhum arquivo fornecido');
  }

  const fileType = detectFileType(files);

  switch (fileType) {
    case 'DICOM':
      return loadDicomSeries(files);
    case 'NIFTI':
      return loadNifti(files[0]);
    case 'INVALID':
      throw new VolumeParseError('Tipo de arquivo inválido ou não suportado');
    default:
      throw new VolumeParseError(`Tipo de arquivo desconhecido: ${fileType}`);
  }
}
