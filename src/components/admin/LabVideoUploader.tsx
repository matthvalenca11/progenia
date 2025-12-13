import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Video, Upload, X, Loader2, Trash2 } from "lucide-react";
import { storageService } from "@/services/storageService";
import { toast } from "sonner";

interface LabVideoUploaderProps {
  videoUrl?: string;
  onVideoChange: (url: string | undefined) => void;
  disabled?: boolean;
}

export function LabVideoUploader({ 
  videoUrl, 
  onVideoChange, 
  disabled = false 
}: LabVideoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback(async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast.error("Formato inválido", { 
        description: "Por favor, selecione um arquivo de vídeo (MP4, WebM, etc.)" 
      });
      return;
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Arquivo muito grande", { 
        description: "O tamanho máximo permitido é 100MB" 
      });
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const fileName = storageService.generateUniqueFileName(file.name);
      const path = `labs/${fileName}`;

      const result = await storageService.uploadFile({
        bucket: 'lab-videos' as const,
        path,
        file,
        onProgress: (progress) => setUploadProgress(progress),
      });

      const publicUrl = storageService.getPublicUrl('lab-videos' as const, result.path);
      onVideoChange(publicUrl);
      toast.success("Vídeo enviado com sucesso!");
    } catch (error: any) {
      console.error("Error uploading video:", error);
      toast.error("Erro ao enviar vídeo", { description: error.message });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [onVideoChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled || isUploading) return;
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [disabled, isUploading, handleFileSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemoveVideo = async () => {
    if (videoUrl) {
      // Extract path from URL for deletion
      try {
        const urlParts = videoUrl.split('/lab-videos/');
        if (urlParts.length > 1) {
          const path = urlParts[1];
          await storageService.deleteFile('lab-videos' as const, path);
        }
      } catch (error) {
        console.error("Error deleting video file:", error);
      }
    }
    onVideoChange(undefined);
    toast.success("Vídeo removido");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Vídeo de Apoio (Opcional)
        </CardTitle>
        <CardDescription>
          Adicione um vídeo explicativo que será exibido dentro da área do laboratório virtual.
          O vídeo será carregado diretamente na plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {videoUrl ? (
          <div className="space-y-4">
            {/* Video Preview */}
            <div className="rounded-lg overflow-hidden border border-border bg-black">
              <video
                src={videoUrl}
                controls
                className="w-full aspect-video object-contain"
                preload="metadata"
              />
            </div>
            
            {/* Remove Button */}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRemoveVideo}
              disabled={disabled || isUploading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remover vídeo
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Upload Area */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              className={`
                relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                ${(disabled || isUploading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <input
                type="file"
                accept="video/*"
                onChange={handleInputChange}
                disabled={disabled || isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              <div className="flex flex-col items-center gap-3">
                {isUploading ? (
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                ) : (
                  <Upload className="h-10 w-10 text-muted-foreground" />
                )}
                
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {isUploading ? 'Enviando vídeo...' : 'Arraste um vídeo ou clique para selecionar'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos: MP4, WebM, MOV • Máximo: 100MB
                  </p>
                </div>
              </div>
            </div>
            
            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Enviando...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
