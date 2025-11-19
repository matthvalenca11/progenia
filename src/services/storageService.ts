import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type StorageBucket = 
  | "lesson-videos" 
  | "lesson-assets" 
  | "lab-assets" 
  | "public-marketing"
  | "partner-logos"
  | "team-photos";

interface UploadFileParams {
  bucket: StorageBucket;
  path: string;
  file: File;
  onProgress?: (progress: number) => void;
}

interface UploadResult {
  path: string;
  fullPath: string;
}

export const storageService = {
  /**
   * Fazer upload de arquivo
   */
  async uploadFile({ bucket, path, file, onProgress }: UploadFileParams): Promise<UploadResult> {
    try {
      // Validar tamanho do arquivo (máximo 100MB)
      const maxSize = 100 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error("Arquivo muito grande. Tamanho máximo: 100MB");
      }

      // Fazer upload
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (error) throw error;

      // Simular progresso se callback fornecido
      if (onProgress) {
        onProgress(100);
      }

      return {
        path: data.path,
        fullPath: `${bucket}/${data.path}`,
      };
    } catch (error: any) {
      console.error("Erro ao fazer upload:", error);
      toast({
        variant: "destructive",
        title: "Erro no upload",
        description: error.message || "Não foi possível fazer upload do arquivo",
      });
      throw error;
    }
  },

  /**
   * Fazer upload de múltiplos arquivos
   */
  async uploadMultipleFiles(
    bucket: StorageBucket,
    files: File[],
    pathPrefix: string = ""
  ): Promise<UploadResult[]> {
    const uploads = files.map((file, index) => {
      const path = pathPrefix 
        ? `${pathPrefix}/${file.name}`
        : file.name;
      
      return this.uploadFile({ bucket, path, file });
    });

    return Promise.all(uploads);
  },

  /**
   * Obter URL pública (para buckets públicos)
   */
  getPublicUrl(bucket: StorageBucket, path: string): string {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return data.publicUrl;
  },

  /**
   * Obter URL assinada (para buckets privados)
   */
  async getSignedUrl(
    bucket: StorageBucket,
    path: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      if (error) throw error;
      if (!data) throw new Error("URL não gerada");

      return data.signedUrl;
    } catch (error: any) {
      console.error("Erro ao gerar URL assinada:", error);
      toast({
        variant: "destructive",
        title: "Erro ao acessar arquivo",
        description: error.message || "Não foi possível gerar URL de acesso",
      });
      throw error;
    }
  },

  /**
   * Deletar arquivo
   */
  async deleteFile(bucket: StorageBucket, path: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) throw error;

      toast({
        title: "Arquivo removido",
        description: "O arquivo foi excluído com sucesso",
      });
    } catch (error: any) {
      console.error("Erro ao deletar arquivo:", error);
      toast({
        variant: "destructive",
        title: "Erro ao deletar",
        description: error.message || "Não foi possível excluir o arquivo",
      });
      throw error;
    }
  },

  /**
   * Deletar múltiplos arquivos
   */
  async deleteMultipleFiles(bucket: StorageBucket, paths: string[]): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove(paths);

      if (error) throw error;

      toast({
        title: "Arquivos removidos",
        description: `${paths.length} arquivo(s) excluído(s) com sucesso`,
      });
    } catch (error: any) {
      console.error("Erro ao deletar arquivos:", error);
      toast({
        variant: "destructive",
        title: "Erro ao deletar",
        description: error.message || "Não foi possível excluir os arquivos",
      });
      throw error;
    }
  },

  /**
   * Listar arquivos em um caminho
   */
  async listFiles(bucket: StorageBucket, path: string = "") {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(path, {
          limit: 100,
          sortBy: { column: "created_at", order: "desc" },
        });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error("Erro ao listar arquivos:", error);
      return [];
    }
  },

  /**
   * Gerar nome de arquivo único
   */
  generateUniqueFileName(originalName: string): string {
    // Remove acentos e caracteres inválidos, manter apenas [a-z0-9._-]
    const normalized = originalName
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, ''); // remover diacríticos

    const extMatch = normalized.match(/\.([^.]+)$/);
    const extension = extMatch ? extMatch[1].toLowerCase() : '';
    const base = normalized.replace(/\.[^.]+$/, '');

    let safeBase = base
      .replace(/[^a-zA-Z0-9._-]+/g, '-') // trocar espaços e unicode por '-'
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .toLowerCase();

    if (!safeBase) safeBase = 'file';

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const unique = `${safeBase}-${timestamp}-${random}`;

    return extension ? `${unique}.${extension}` : unique;
  },

  /**
   * Validar tipo de arquivo
   */
  validateFileType(file: File, allowedTypes: string[]): boolean {
    return allowedTypes.some(type => {
      if (type.endsWith("/*")) {
        return file.type.startsWith(type.replace("/*", ""));
      }
      return file.type === type;
    });
  },
};
