import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LessonBlockEditor } from "./LessonBlockEditor";
import { BlockData } from "@/components/lesson/ContentBlock";
import { Plus, Video, FileText, Image as ImageIcon, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ContentEditorProps {
  open: boolean;
  onClose: () => void;
  contentId: string; // lesson_id or capsula_id
  contentType: "lesson" | "capsula";
  initialBlocks?: BlockData[];
}

export function ContentEditor({ open, onClose, contentId, contentType, initialBlocks = [] }: ContentEditorProps) {
  const [blocks, setBlocks] = useState<BlockData[]>(initialBlocks);
  const [saving, setSaving] = useState(false);

  const addBlock = (type: BlockData["type"]) => {
    const newBlock: BlockData = {
      id: crypto.randomUUID(),
      type,
      order: blocks.length,
      data: {},
    };
    setBlocks([...blocks, newBlock]);
  };

  const updateBlock = (id: string, updatedBlock: BlockData) => {
    setBlocks(blocks.map((b) => (b.id === id ? updatedBlock : b)));
  };

  const deleteBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
  };

  const moveBlockUp = (id: string) => {
    const index = blocks.findIndex((b) => b.id === id);
    if (index > 0) {
      const newBlocks = [...blocks];
      [newBlocks[index], newBlocks[index - 1]] = [newBlocks[index - 1], newBlocks[index]];
      // Update order indexes
      newBlocks.forEach((b, i) => (b.order = i));
      setBlocks(newBlocks);
    }
  };

  const moveBlockDown = (id: string) => {
    const index = blocks.findIndex((b) => b.id === id);
    if (index < blocks.length - 1) {
      const newBlocks = [...blocks];
      [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
      // Update order indexes
      newBlocks.forEach((b, i) => (b.order = i));
      setBlocks(newBlocks);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const table = contentType === "lesson" ? "lessons" : "capsulas";
      const { error } = await supabase
        .from(table)
        .update({ content_data: { blocks } as any })
        .eq("id", contentId);

      if (error) throw error;

      toast.success("Conteúdo salvo com sucesso!");
      onClose();
    } catch (error: any) {
      console.error("Error saving content:", error);
      toast.error("Erro ao salvar conteúdo", {
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Editor de Conteúdo - {contentType === "lesson" ? "Aula" : "Cápsula"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Add Block Buttons */}
          <div className="flex flex-wrap gap-2 sticky top-0 bg-background/95 backdrop-blur p-4 rounded-lg border z-10">
            <Button
              onClick={() => addBlock("text")}
              variant="outline"
              size="sm"
            >
              <FileText className="h-4 w-4 mr-2" />
              Adicionar Texto
            </Button>
            <Button
              onClick={() => addBlock("video")}
              variant="outline"
              size="sm"
            >
              <Video className="h-4 w-4 mr-2" />
              Adicionar Vídeo
            </Button>
            <Button
              onClick={() => addBlock("image")}
              variant="outline"
              size="sm"
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Adicionar Imagem
            </Button>
            <Button
              onClick={() => addBlock("lab")}
              variant="outline"
              size="sm"
            >
              <FlaskConical className="h-4 w-4 mr-2" />
              Adicionar Lab Virtual
            </Button>
          </div>

          {/* Blocks */}
          {blocks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Plus className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum bloco adicionado ainda.</p>
              <p className="text-sm">Clique nos botões acima para adicionar conteúdo.</p>
            </div>
          ) : (
            blocks.map((block, index) => (
              <LessonBlockEditor
                key={block.id}
                block={block}
                onChange={(updated) => updateBlock(block.id, updated)}
                onDelete={() => deleteBlock(block.id)}
                onMoveUp={() => moveBlockUp(block.id)}
                onMoveDown={() => moveBlockDown(block.id)}
                canMoveUp={index > 0}
                canMoveDown={index < blocks.length - 1}
              />
            ))
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Conteúdo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
