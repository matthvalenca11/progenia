/** Limite de upload para thumbnails e imagens (MB). */
export const IMAGE_UPLOAD_MAX_MB = 2;

export const IMAGE_UPLOAD_MAX_BYTES = IMAGE_UPLOAD_MAX_MB * 1024 * 1024;

export function assertImageUploadSize(file: File): void {
  if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
    throw new Error(
      `Arquivo muito grande. Tamanho máximo para imagens: ${IMAGE_UPLOAD_MAX_MB}MB`,
    );
  }
}
