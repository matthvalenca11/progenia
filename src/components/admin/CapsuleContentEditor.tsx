import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUploadField } from "@/components/ui/FileUploadField";
import { supabase } from "@/integrations/supabase/client";
import { storageService } from "@/services/storageService";
import { virtualLabService, VirtualLab } from "@/services/virtualLabService";
import { toast } from "sonner";
import { Loader2, Link as LinkIcon, Upload, Trash2, Plus } from "lucide-react";

interface CapsuleContentEditorProps {
  capsulaId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

interface MediaItem {
  type: "video" | "image";
  source: "upload" | "link";
  url?: string;
  file?: File;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  [key: string]: any;
}

interface CapsuleContent {
  text?: string;
  media: MediaItem[];
  virtualLabId?: string;
  quiz?: QuizQuestion[];
  [key: string]: any;
}

export function CapsuleContentEditor({ capsulaId, open, onOpenChange, onSave }: CapsuleContentEditorProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState<CapsuleContent>({
    text: "",
    media: [],
    virtualLabId: undefined,
    quiz: [],
  });
  const [thumbnailSource, setThumbnailSource] = useState<"upload" | "link">("link");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [virtualLabs, setVirtualLabs] = useState<VirtualLab[]>([]);

  useEffect(() => {
    if (open) {
      loadContent();
      loadVirtualLabs();
    }
  }, [open, capsulaId]);

  const loadContent = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("capsulas")
        .select("content_data, thumbnail_url")
        .eq("id", capsulaId)
        .single();

      if (error) throw error;

      if (data?.content_data) {
        const contentData = data.content_data as any;
        setContent({
          text: contentData.text || "",
          media: contentData.media || [],
          virtualLabId: contentData.virtualLabId,
          quiz: contentData.quiz || [],
        });
      }
      if (data?.thumbnail_url) {
        setThumbnailUrl(data.thumbnail_url);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar conteúdo: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadVirtualLabs = async () => {
    try {
      const labs = await virtualLabService.getAll();
      setVirtualLabs(labs.filter(lab => lab.is_published));
    } catch (error: any) {
      console.error("Erro ao carregar labs:", error);
    }
  };

  const handleAddMedia = (type: "video" | "image") => {
    setContent({
      ...content,
      media: [...content.media, { type, source: "link" }],
    });
  };

  const handleRemoveMedia = (index: number) => {
    setContent({
      ...content,
      media: content.media.filter((_, i) => i !== index),
    });
  };

  const handleMediaChange = (index: number, updates: Partial<MediaItem>) => {
    const newMedia = [...content.media];
    newMedia[index] = { ...newMedia[index], ...updates };
    setContent({ ...content, media: newMedia });
  };

  const handleAddQuizQuestion = () => {
    setContent({
      ...content,
      quiz: [
        ...(content.quiz || []),
        { question: "", options: ["", "", "", ""], correctAnswer: 0 },
      ],
    });
  };

  const handleRemoveQuizQuestion = (index: number) => {
    setContent({
      ...content,
      quiz: content.quiz?.filter((_, i) => i !== index) || [],
    });
  };

  const handleQuizQuestionChange = (index: number, field: string, value: any) => {
    const newQuiz = [...(content.quiz || [])];
    newQuiz[index] = { ...newQuiz[index], [field]: value };
    setContent({ ...content, quiz: newQuiz });
  };

  const handleQuizOptionChange = (qIndex: number, oIndex: number, value: string) => {
    const newQuiz = [...(content.quiz || [])];
    newQuiz[qIndex].options[oIndex] = value;
    setContent({ ...content, quiz: newQuiz });
  };

  const uploadMedia = async (media: MediaItem): Promise<string> => {
    if (media.source === "link") {
      return media.url || "";
    }

    if (!media.file) {
      throw new Error("Arquivo não encontrado");
    }

    const bucket = media.type === "video" ? "lesson-videos" : "lesson-assets";
    const fileName = storageService.generateUniqueFileName(media.file.name);
    const path = `capsulas/${capsulaId}/${fileName}`;

    const result = await storageService.uploadFile({
      bucket,
      path,
      file: media.file,
    });

    return storageService.getPublicUrl(bucket, result.path);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Upload de mídia
      const mediaWithUrls = await Promise.all(
        content.media.map(async (media) => {
          const url = await uploadMedia(media);
          return { type: media.type, url };
        })
      );

      // Upload de thumbnail se necessário
      let finalThumbnailUrl = thumbnailUrl;
      if (thumbnailSource === "upload" && thumbnailFile) {
        const fileName = storageService.generateUniqueFileName(thumbnailFile.name);
        const path = `capsulas/${capsulaId}/thumbnail_${fileName}`;
        const result = await storageService.uploadFile({
          bucket: "lesson-assets",
          path,
          file: thumbnailFile,
        });
        finalThumbnailUrl = storageService.getPublicUrl("lesson-assets", result.path);
      }

      // Salvar conteúdo
      const contentToSave: any = {
        text: content.text,
        media: mediaWithUrls,
        virtualLabId: content.virtualLabId,
        quiz: content.quiz,
      };

      const { error } = await supabase
        .from("capsulas")
        .update({
          content_data: contentToSave,
          thumbnail_url: finalThumbnailUrl || null,
        })
        .eq("id", capsulaId);

      if (error) throw error;

      toast.success("Conteúdo salvo com sucesso!");
      onSave?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao salvar conteúdo: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Conteúdo da Cápsula</DialogTitle>
          <DialogDescription>
            Adicione texto, vídeos, imagens, lab virtual ou mini quiz
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="text" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="text">Texto</TabsTrigger>
            <TabsTrigger value="media">Mídia</TabsTrigger>
            <TabsTrigger value="thumbnail">Thumbnail</TabsTrigger>
            <TabsTrigger value="lab">Lab Virtual</TabsTrigger>
            <TabsTrigger value="quiz">Mini Quiz</TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4">
            <div>
              <Label htmlFor="text">Conteúdo de Texto</Label>
              <Textarea
                id="text"
                value={content.text || ""}
                onChange={(e) => setContent({ ...content, text: e.target.value })}
                placeholder="Digite o conteúdo da cápsula..."
                rows={10}
                className="mt-2"
              />
            </div>
          </TabsContent>

          <TabsContent value="media" className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Vídeos e Imagens</Label>
              <div className="space-x-2">
                <Button type="button" variant="outline" size="sm" onClick={() => handleAddMedia("video")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Vídeo
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => handleAddMedia("image")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Imagem
                </Button>
              </div>
            </div>

            {content.media.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma mídia adicionada ainda
              </p>
            ) : (
              <div className="space-y-4">
                {content.media.map((media, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="capitalize">{media.type}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMedia(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <Tabs
                      value={media.source}
                      onValueChange={(value) =>
                        handleMediaChange(index, { source: value as "upload" | "link" })
                      }
                    >
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="link">
                          <LinkIcon className="h-4 w-4 mr-2" />
                          Link
                        </TabsTrigger>
                        <TabsTrigger value="upload">
                          <Upload className="h-4 w-4 mr-2" />
                          Upload
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="link">
                        <Input
                          placeholder={`URL do ${media.type === "video" ? "vídeo" : "imagem"}`}
                          value={media.url || ""}
                          onChange={(e) => handleMediaChange(index, { url: e.target.value })}
                        />
                      </TabsContent>

                      <TabsContent value="upload">
                        <FileUploadField
                          accept={media.type === "video" ? "video/*" : "image/*"}
                          maxSize={media.type === "video" ? 100 : 10}
                          onFilesSelected={(files) => handleMediaChange(index, { file: files[0] })}
                          label={`Selecione o ${media.type === "video" ? "vídeo" : "imagem"}`}
                        />
                      </TabsContent>
                    </Tabs>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="thumbnail" className="space-y-4">
            <Label>Thumbnail da Cápsula</Label>
            <Tabs value={thumbnailSource} onValueChange={(v) => setThumbnailSource(v as "upload" | "link")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="link">
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Link
                </TabsTrigger>
                <TabsTrigger value="upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </TabsTrigger>
              </TabsList>

              <TabsContent value="link">
                <Input
                  placeholder="URL da thumbnail"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                />
              </TabsContent>

              <TabsContent value="upload">
                <FileUploadField
                  accept="image/*"
                  maxSize={5}
                  onFilesSelected={(files) => setThumbnailFile(files[0])}
                  label="Selecione a thumbnail"
                />
              </TabsContent>
            </Tabs>

            {(thumbnailUrl || thumbnailFile) && (
              <div className="mt-4">
                <Label className="mb-2 block">Preview:</Label>
                <img
                  src={thumbnailFile ? URL.createObjectURL(thumbnailFile) : thumbnailUrl}
                  alt="Thumbnail preview"
                  className="w-full max-w-sm rounded-lg border"
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="lab" className="space-y-4">
            <div>
              <Label htmlFor="virtualLab">Selecionar Lab Virtual</Label>
              <Select
                value={content.virtualLabId || "none"}
                onValueChange={(value) =>
                  setContent({ ...content, virtualLabId: value === "none" ? undefined : value })
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecione um lab virtual" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum lab virtual</SelectItem>
                  {virtualLabs.map((lab) => (
                    <SelectItem key={lab.id} value={lab.id!}>
                      {lab.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="quiz" className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Mini Quiz</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddQuizQuestion}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Questão
              </Button>
            </div>

            {!content.quiz || content.quiz.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma questão adicionada ainda
              </p>
            ) : (
              <div className="space-y-6">
                {content.quiz.map((question, qIndex) => (
                  <div key={qIndex} className="border rounded-lg p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <Label>Questão {qIndex + 1}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveQuizQuestion(qIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <Textarea
                      placeholder="Digite a pergunta..."
                      value={question.question}
                      onChange={(e) => handleQuizQuestionChange(qIndex, "question", e.target.value)}
                      rows={2}
                    />

                    <div className="space-y-2">
                      <Label>Opções de Resposta</Label>
                      {question.options.map((option, oIndex) => (
                        <div key={oIndex} className="flex items-center gap-2">
                          <Input
                            placeholder={`Opção ${oIndex + 1}`}
                            value={option}
                            onChange={(e) => handleQuizOptionChange(qIndex, oIndex, e.target.value)}
                          />
                          <input
                            type="radio"
                            name={`correct-${qIndex}`}
                            checked={question.correctAnswer === oIndex}
                            onChange={() => handleQuizQuestionChange(qIndex, "correctAnswer", oIndex)}
                            className="h-4 w-4"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Conteúdo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
