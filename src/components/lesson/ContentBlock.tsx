import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

export interface BlockData {
  id: string;
  type: 'video' | 'text' | 'image' | 'lab';
  order: number;
  data: {
    // Video
    videoUrl?: string;
    videoTitle?: string;
    videoStoragePath?: string;
    // Text
    content?: string;
    title?: string;
    // Image
    imageUrl?: string;
    imageStoragePath?: string;
    caption?: string;
    // Lab
    labType?: string;
    labConfig?: any;
  };
}

interface ContentBlockProps {
  block: BlockData;
  isPreview?: boolean;
}

export const ContentBlock = ({ block, isPreview = false }: ContentBlockProps) => {
  const [videoError, setVideoError] = useState(false);

  const renderVideoBlock = () => {
    const videoUrl = block.data.videoUrl;
    if (!videoUrl) return null;

    // Check if it's a YouTube URL
    const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
    
    if (isYouTube) {
      // Extract video ID from various YouTube URL formats
      let videoId = '';
      if (videoUrl.includes('youtube.com/watch?v=')) {
        videoId = videoUrl.split('v=')[1]?.split('&')[0] || '';
      } else if (videoUrl.includes('youtu.be/')) {
        videoId = videoUrl.split('youtu.be/')[1]?.split('?')[0] || '';
      } else if (videoUrl.includes('youtube.com/embed/')) {
        videoId = videoUrl.split('embed/')[1]?.split('?')[0] || '';
      }

      const embedUrl = `https://www.youtube.com/embed/${videoId}`;

      return (
        <div className="space-y-3">
          {block.data.videoTitle && (
            <h3 className="text-lg font-semibold">{block.data.videoTitle}</h3>
          )}
          <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
            <iframe
              src={embedUrl}
              title={block.data.videoTitle || 'Vídeo'}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        </div>
      );
    }

    // For other video URLs, use video tag
    return (
      <div className="space-y-3">
        {block.data.videoTitle && (
          <h3 className="text-lg font-semibold">{block.data.videoTitle}</h3>
        )}
        <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
          {!videoError ? (
            <video
              src={videoUrl}
              controls
              className="w-full h-full"
              onError={() => setVideoError(true)}
            >
              Seu navegador não suporta vídeos.
            </video>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              Erro ao carregar vídeo
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTextBlock = () => {
    return (
      <div className="space-y-3">
        {block.data.title && (
          <h3 className="text-xl font-semibold">{block.data.title}</h3>
        )}
        <div 
          className="prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: block.data.content || '' }}
        />
      </div>
    );
  };

  const renderImageBlock = () => {
    return (
      <div className="space-y-3">
        <div className="rounded-lg overflow-hidden">
          <img 
            src={block.data.imageUrl} 
            alt={block.data.caption || 'Imagem'}
            className="w-full h-auto"
          />
        </div>
        {block.data.caption && (
          <p className="text-sm text-muted-foreground text-center italic">
            {block.data.caption}
          </p>
        )}
      </div>
    );
  };

  const renderLabBlock = () => {
    return (
      <div className="space-y-3">
        <Card className="p-6 bg-secondary/10 border-secondary/20">
          <h3 className="text-lg font-semibold mb-2">Laboratório Virtual</h3>
          <p className="text-muted-foreground">
            Tipo: {block.data.labType}
          </p>
          {!isPreview && (
            <p className="text-sm text-muted-foreground mt-2">
              O laboratório será carregado quando você acessar esta aula.
            </p>
          )}
        </Card>
      </div>
    );
  };

  const renderContent = () => {
    switch (block.type) {
      case 'video':
        return renderVideoBlock();
      case 'text':
        return renderTextBlock();
      case 'image':
        return renderImageBlock();
      case 'lab':
        return renderLabBlock();
      default:
        return null;
    }
  };

  return (
    <div className="content-block">
      {renderContent()}
      {!isPreview && block.order > 0 && (
        <Separator className="my-8" />
      )}
    </div>
  );
};
