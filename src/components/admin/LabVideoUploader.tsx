import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, Trash2 } from "lucide-react";
import { EmbeddedVideo } from "@/components/EmbeddedVideo";
import {
  YOUTUBE_URL_PLACEHOLDER,
  validateYouTubeUrl,
} from "@/lib/youtube";

interface LabVideoUploaderProps {
  videoUrl?: string;
  onVideoChange: (url: string | undefined) => void;
  disabled?: boolean;
}

export function LabVideoUploader({
  videoUrl,
  onVideoChange,
  disabled = false,
}: LabVideoUploaderProps) {
  const [draftUrl, setDraftUrl] = useState(videoUrl ?? "");

  useEffect(() => {
    setDraftUrl(videoUrl ?? "");
  }, [videoUrl]);

  const handleUrlChange = (value: string) => {
    setDraftUrl(value);
    const trimmed = value.trim();
    if (!trimmed) {
      onVideoChange(undefined);
      return;
    }
    if (validateYouTubeUrl(trimmed)) {
      onVideoChange(trimmed);
    }
  };

  const handleRemoveVideo = () => {
    setDraftUrl("");
    onVideoChange(undefined);
  };

  const previewUrl = videoUrl?.trim();
  const showPreview = previewUrl && validateYouTubeUrl(previewUrl);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Vídeo de Apoio (Opcional)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="lab-support-video-url">Link do YouTube</Label>
          <Input
            id="lab-support-video-url"
            value={draftUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder={YOUTUBE_URL_PLACEHOLDER}
            disabled={disabled}
          />
          {draftUrl.trim() && !validateYouTubeUrl(draftUrl.trim()) && (
            <p className="text-xs text-destructive">
              Informe um link válido do YouTube para salvar o vídeo de apoio.
            </p>
          )}
        </div>

        {showPreview && (
          <div className="space-y-3">
            <EmbeddedVideo url={previewUrl} title="Pré-visualização do vídeo de apoio" />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemoveVideo}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remover vídeo
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
