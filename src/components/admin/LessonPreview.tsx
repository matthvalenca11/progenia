import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ContentBlock, BlockData } from "@/components/lesson/ContentBlock";
import { Eye } from "lucide-react";

interface LessonPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonTitle: string;
  lessonDescription?: string;
  blocks: BlockData[];
}

export const LessonPreview = ({
  open,
  onOpenChange,
  lessonTitle,
  lessonDescription,
  blocks
}: LessonPreviewProps) => {
  const sortedBlocks = [...blocks].sort((a, b) => a.order - b.order);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview da Aula
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[calc(90vh-120px)]">
          <div className="space-y-6 pr-4">
            {/* Header da Aula */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{lessonTitle || 'Título da Aula'}</CardTitle>
              </CardHeader>
              {lessonDescription && (
                <CardContent>
                  <p className="text-muted-foreground">{lessonDescription}</p>
                </CardContent>
              )}
            </Card>

            {/* Blocos de Conteúdo */}
            {sortedBlocks.length > 0 ? (
              <Card>
                <CardContent className="pt-6 space-y-8">
                  {sortedBlocks.map((block, index) => (
                    <div key={block.id}>
                      <ContentBlock block={block} isPreview={true} />
                      {index < sortedBlocks.length - 1 && (
                        <div className="border-t my-8" />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card className="p-12">
                <div className="text-center text-muted-foreground">
                  <p>Nenhum bloco de conteúdo adicionado ainda.</p>
                  <p className="text-sm mt-2">Adicione vídeos, textos, imagens ou labs para ver o preview.</p>
                </div>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
