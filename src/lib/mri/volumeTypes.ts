/**
 * MRI Volume Types - Formato único interno para todos os volumes
 * Este é o formato normalizado que todos os viewers consomem
 */

export type VolumeOrientation = 'RAS' | 'LPS' | 'UNKNOWN';

export type VolumeSource = 'DICOM' | 'NIFTI' | 'PHANTOM';

export interface NormalizedVolume {
  // Dados do volume
  data: Float32Array; // Sempre Float32Array para consistência
  
  // Dimensões
  width: number;   // X dimension
  height: number; // Y dimension
  depth: number;   // Z dimension
  
  // Espaçamento físico (mm)
  spacing: [number, number, number]; // [x, y, z]
  
  // Orientação
  orientation: VolumeOrientation;
  
  // Estatísticas
  min: number;
  max: number;
  
  // Metadados
  source: VolumeSource;
  
  // Validação
  isValid: boolean;
  validationErrors?: string[];
}

/**
 * Resultado do parsing de arquivos
 */
export interface ParsedVolume {
  volume: NormalizedVolume;
  metadata?: {
    modality?: string;
    seriesDescription?: string;
    patientId?: string;
    studyDate?: string;
    [key: string]: any;
  };
}

/**
 * Erro de parsing com contexto técnico
 */
export class VolumeParseError extends Error {
  constructor(
    message: string,
    public readonly technicalDetails?: Record<string, any>
  ) {
    super(message);
    this.name = 'VolumeParseError';
  }
}
