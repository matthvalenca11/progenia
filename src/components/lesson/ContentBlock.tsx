import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmbeddedVideo } from "@/components/EmbeddedVideo";

export interface BlockData {
  id: string;
  type: 'video' | 'text' | 'image' | 'lab';
  order: number;
  data: {
    // Video
    videoUrl?: string;
    url?: string;
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
  const renderVideoBlock = () => {
    const videoUrl = block.data.videoUrl || block.data.url;
    if (!videoUrl) return null;

    return (
      <div className="space-y-3">
        {block.data.videoTitle && (
          <h3 className="text-lg font-semibold">{block.data.videoTitle}</h3>
        )}
        <EmbeddedVideo url={videoUrl} title={block.data.videoTitle || "Vídeo"} />
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
