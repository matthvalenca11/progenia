import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField } from "@/components/ui/FileUploadField";
import { 
  Video, 
  FileText, 
  Image as ImageIcon, 
  FlaskConical, 
  GripVertical, 
  Trash2,
  ChevronUp,
  ChevronDown,
  Upload
} from "lucide-react";
import { BlockData } from "@/components/lesson/ContentBlock";
import { useState } from "react";

interface LessonBlockEditorProps {
  block: BlockData;
  onChange: (block: BlockData) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onFileChange?: (blockId: string, file: File | null, type: 'video' | 'image') => void;
}

export const LessonBlockEditor = ({
  block,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onFileChange
}: LessonBlockEditorProps) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  const handleVideoFileChange = (files: File[]) => {
    const file = files[0] || null;
    setVideoFile(file);
    if (onFileChange) {
      onFileChange(block.id, file, 'video');
    }
  };
  
  const handleImageFileChange = (files: File[]) => {
    const file = files[0] || null;
    setImageFile(file);
    if (onFileChange) {
      onFileChange(block.id, file, 'image');
    }
  };
  const getBlockIcon = () => {
    switch (block.type) {
      case 'video':
        return <Video className="h-5 w-5" />;
      case 'text':
        return <FileText className="h-5 w-5" />;
      case 'image':
        return <ImageIcon className="h-5 w-5" />;
      case 'lab':
        return <FlaskConical className="h-5 w-5" />;
    }
  };

  const getBlockTitle = () => {
    switch (block.type) {
      case 'video':
        return 'Bloco de Vídeo';
      case 'text':
        return 'Bloco de Texto';
      case 'image':
        return 'Bloco de Imagem';
      case 'lab':
        return 'Laboratório Virtual';
    }
  };

  const updateBlockData = (updates: Partial<BlockData['data']>) => {
    onChange({
      ...block,
      data: { ...block.data, ...updates }
    });
  };

  const renderVideoFields = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`video-title-${block.id}`}>Título do Vídeo (opcional)</Label>
        <Input
          id={`video-title-${block.id}`}
          value={block.data.videoTitle || ''}
          onChange={(e) => updateBlockData({ videoTitle: e.target.value })}
          placeholder="Ex: Introdução à Ressonância Magnética"
        />
      </div>
      <div>
        <Label>Upload de Vídeo ou URL Externa</Label>
        <div className="space-y-3">
          <FileUploadField
            accept="video/*"
            onFilesSelected={handleVideoFileChange}
            label="Fazer upload de vídeo"
            description="MP4, MOV, AVI - Máx 100MB"
            maxSize={100}
          />
          <div className="text-center text-sm text-muted-foreground">ou</div>
          <div>
            <Label htmlFor={`video-url-${block.id}`}>URL Externa (YouTube, Vimeo, etc.)</Label>
            <Input
              id={`video-url-${block.id}`}
              value={block.data.videoUrl || ''}
              onChange={(e) => updateBlockData({ videoUrl: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>
        </div>
        {videoFile && (
          <p className="text-sm text-green-600 mt-2">
            ✓ Arquivo selecionado: {videoFile.name}
          </p>
        )}
      </div>
    </div>
  );

  const renderTextFields = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`text-title-${block.id}`}>Título (opcional)</Label>
        <Input
          id={`text-title-${block.id}`}
          value={block.data.title || ''}
          onChange={(e) => updateBlockData({ title: e.target.value })}
          placeholder="Ex: Fundamentos Teóricos"
        />
      </div>
      <div>
        <Label htmlFor={`text-content-${block.id}`}>Conteúdo *</Label>
        <Textarea
          id={`text-content-${block.id}`}
          value={block.data.content || ''}
          onChange={(e) => updateBlockData({ content: e.target.value })}
          placeholder="Digite o conteúdo do texto..."
          rows={8}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Suporta HTML básico para formatação
        </p>
      </div>
    </div>
  );

  const renderImageFields = () => (
    <div className="space-y-4">
      <div>
        <Label>Upload de Imagem *</Label>
        <FileUploadField
          accept="image/*"
          onFilesSelected={handleImageFileChange}
          label="Fazer upload de imagem"
          description="JPG, PNG, WEBP - Máx 10MB"
          maxSize={10}
        />
        {imageFile && (
          <p className="text-sm text-green-600 mt-2">
            ✓ Arquivo selecionado: {imageFile.name}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor={`image-caption-${block.id}`}>Legenda (opcional)</Label>
        <Input
          id={`image-caption-${block.id}`}
          value={block.data.caption || ''}
          onChange={(e) => updateBlockData({ caption: e.target.value })}
          placeholder="Descrição da imagem"
        />
      </div>
      {block.data.imageUrl && (
        <div className="border rounded-lg p-2">
          <img 
            src={block.data.imageUrl} 
            alt="Preview" 
            className="max-h-48 mx-auto"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}
    </div>
  );

  const renderLabFields = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`lab-type-${block.id}`}>Tipo de Laboratório *</Label>
        <Select
          value={block.data.labType || ''}
          onValueChange={(value) => updateBlockData({ labType: value })}
        >
          <SelectTrigger id={`lab-type-${block.id}`}>
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mri_viewer">Visualizador de RM</SelectItem>
            <SelectItem value="ultrassom_simulador">Simulador de Ultrassom</SelectItem>
            <SelectItem value="eletroterapia_sim">Simulador de Eletroterapia</SelectItem>
            <SelectItem value="termico_sim">Simulador Térmico</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-sm text-muted-foreground">
        O laboratório virtual será carregado automaticamente quando o aluno acessar esta aula.
      </p>
    </div>
  );

  return (
    <Card className="p-4 border-2">
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1 pt-1">
          <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
        </div>
        
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getBlockIcon()}
              <span className="font-semibold">{getBlockTitle()}</span>
              <span className="text-xs text-muted-foreground">#{block.order + 1}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={onMoveUp}
                disabled={!canMoveUp}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onMoveDown}
                disabled={!canMoveDown}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {block.type === 'video' && renderVideoFields()}
          {block.type === 'text' && renderTextFields()}
          {block.type === 'image' && renderImageFields()}
          {block.type === 'lab' && renderLabFields()}
        </div>
      </div>
    </Card>
  );
};
