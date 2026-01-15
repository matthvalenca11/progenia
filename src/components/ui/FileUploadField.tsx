import { useState, useRef, useCallback } from "react";
import { Upload, X, File, Loader2 } from "lucide-react";
import { Button } from "./button";
import { Progress } from "./progress";
import { cn } from "@/lib/utils";

interface FileUploadFieldProps {
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // em MB
  onFilesSelected?: (files: File[]) => void;
  disabled?: boolean;
  value?: File[];
  className?: string;
  label?: string;
  description?: string;
}

export function FileUploadField({
  accept,
  multiple = false,
  maxSize = 100,
  onFilesSelected,
  disabled = false,
  value = [],
  className,
  label = "Selecione ou arraste arquivos aqui",
  description,
}: FileUploadFieldProps) {
  const [files, setFiles] = useState<File[]>(value);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return;

      const fileArray = Array.from(newFiles);
      
      // Validar tamanho
      const maxSizeBytes = maxSize * 1024 * 1024;
      const validFiles = fileArray.filter(file => {
        if (file.size > maxSizeBytes) {
          alert(`Arquivo "${file.name}" excede o tamanho máximo de ${maxSize}MB`);
          return false;
        }
        return true;
      });

      if (validFiles.length === 0) return;

      const updatedFiles = multiple ? [...files, ...validFiles] : validFiles;
      setFiles(updatedFiles);
      onFilesSelected?.(updatedFiles);
    },
    [files, multiple, maxSize, onFilesSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      
      if (disabled) return;
      handleFiles(e.dataTransfer.files);
    },
    [disabled, handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const removeFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    onFilesSelected?.(updatedFiles);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => {
            const selectedFiles = e.target.files;
            if (selectedFiles && selectedFiles.length > 0) {
              handleFiles(selectedFiles);
            }
          }}
          className="hidden"
          disabled={disabled}
          style={{ display: 'none' }}
        />
        
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-10 w-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">{label}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Tamanho máximo: {maxSize}MB por arquivo
            </p>
          </div>
          <div className="upload-button-container">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (!disabled && inputRef.current) {
                  inputRef.current.click();
                }
              }}
            >
              Selecionar arquivo{multiple ? "s" : ""}
            </Button>
          </div>
        </div>
      </div>

      {uploadProgress !== null && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Enviando...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} />
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Arquivo{files.length > 1 ? "s" : ""} selecionado{files.length > 1 ? "s" : ""}:
          </p>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg bg-card"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  disabled={disabled}
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
