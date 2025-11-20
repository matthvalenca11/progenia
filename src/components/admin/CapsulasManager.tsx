import { useState, useEffect } from "react";
import { useModules } from "@/hooks/useModules";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUploadField } from "@/components/ui/FileUploadField";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff, Zap, Link as LinkIcon, Upload, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { storageService } from "@/services/storageService";
import { virtualLabService, VirtualLab } from "@/services/virtualLabService";

type Capsula = {
  id: string;
  title: string;
  description: string | null;
  module_id: string | null;
  is_published: boolean;
  duration_minutes: number | null;
  order_index: number | null;
  thumbnail_url: string | null;
  content_data: any;
};

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
}

type CapsulaFormData = {
  title: string;
  description: string;
  module_id: string;
  is_published: boolean;
  duration_minutes: string;
  thumbnail_url: string;
  thumbnailSource: "upload" | "link";
  thumbnailFile: File | null;
  contentText: string;
  media: MediaItem[];
  virtualLabId: string;
  quiz: QuizQuestion[];
};

export function CapsulasManager() {
  const { modules } = useModules(true);
  const [capsulas, setCapsulas] = useState<Capsula[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteCapsulaId, setDeleteCapsulaId] = useState<string | null>(null);
  const [editingCapsula, setEditingCapsula] = useState<Capsula | null>(null);
  const [filterModuleId, setFilterModuleId] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [virtualLabs, setVirtualLabs] = useState<VirtualLab[]>([]);
  const [formData, setFormData] = useState<CapsulaFormData>({
    title: "",
    description: "",
    module_id: "none",
    is_published: false,
    duration_minutes: "",
    thumbnail_url: "",
    thumbnailSource: "link",
    thumbnailFile: null,
    contentText: "",
    media: [],
    virtualLabId: "none",
    quiz: [],
  });

  const loadCapsulas = async () => {
    try {
      setLoading(true);
      let query = supabase.from("capsulas").select("*").order("order_index", { ascending: true });
      
      if (filterModuleId !== "all") {
        query = filterModuleId === "none" 
          ? query.is("module_id", null)
          : query.eq("module_id", filterModuleId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setCapsulas(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar cápsulas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCapsulas();
  }, [filterModuleId]);

  useEffect(() => {
    loadVirtualLabs();
  }, []);

  const loadVirtualLabs = async () => {
    try {
      const labs = await virtualLabService.getAll();
      setVirtualLabs(labs.filter(lab => lab.is_published));
    } catch (error: any) {
      console.error("Erro ao carregar labs:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      module_id: "none",
      is_published: false,
      duration_minutes: "",
      thumbnail_url: "",
      thumbnailSource: "link",
      thumbnailFile: null,
      contentText: "",
      media: [],
      virtualLabId: "none",
      quiz: [],
    });
  };

  const uploadMedia = async (media: MediaItem, capsulaId: string): Promise<string> => {
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

  const handleCreate = async () => {
    try {
      setSaving(true);

      // Criar cápsula primeiro para obter o ID
      const { data: newCapsula, error: createError } = await supabase
        .from("capsulas")
        .insert({
          title: formData.title,
          description: formData.description,
          module_id: formData.module_id && formData.module_id !== "none" ? formData.module_id : null,
          is_published: formData.is_published,
          duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
          thumbnail_url: null,
          content_data: { blocks: [] },
        })
        .select()
        .single();

      if (createError) throw createError;
      const capsulaId = newCapsula.id;

      // Upload de mídia
      const mediaWithUrls = await Promise.all(
        formData.media.map(async (media) => {
          const url = await uploadMedia(media, capsulaId);
          return { type: media.type, url };
        })
      );

      // Upload de thumbnail se necessário
      let finalThumbnailUrl = formData.thumbnail_url;
      if (formData.thumbnailSource === "upload" && formData.thumbnailFile) {
        const fileName = storageService.generateUniqueFileName(formData.thumbnailFile.name);
        const path = `capsulas/${capsulaId}/thumbnail_${fileName}`;
        const result = await storageService.uploadFile({
          bucket: "lesson-assets",
          path,
          file: formData.thumbnailFile,
        });
        finalThumbnailUrl = storageService.getPublicUrl("lesson-assets", result.path);
      }

      // Atualizar com conteúdo e thumbnail
      const contentToSave: any = {
        text: formData.contentText,
        media: mediaWithUrls,
        virtualLabId: formData.virtualLabId !== "none" ? formData.virtualLabId : undefined,
        quiz: formData.quiz.length > 0 ? formData.quiz : undefined,
      };

      const { error: updateError } = await supabase
        .from("capsulas")
        .update({
          content_data: contentToSave,
          thumbnail_url: finalThumbnailUrl || null,
        })
        .eq("id", capsulaId);

      if (updateError) throw updateError;

      toast.success("Cápsula criada com sucesso!");
      setIsDialogOpen(false);
      resetForm();
      setEditingCapsula(null);
      loadCapsulas();
    } catch (error: any) {
      toast.error("Erro ao criar cápsula: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editingCapsula) return;

    try {
      setSaving(true);

      // Upload de mídia
      const mediaWithUrls = await Promise.all(
        formData.media.map(async (media) => {
          const url = await uploadMedia(media, editingCapsula.id);
          return { type: media.type, url };
        })
      );

      // Upload de thumbnail se necessário
      let finalThumbnailUrl = formData.thumbnail_url;
      if (formData.thumbnailSource === "upload" && formData.thumbnailFile) {
        const fileName = storageService.generateUniqueFileName(formData.thumbnailFile.name);
        const path = `capsulas/${editingCapsula.id}/thumbnail_${fileName}`;
        const result = await storageService.uploadFile({
          bucket: "lesson-assets",
          path,
          file: formData.thumbnailFile,
        });
        finalThumbnailUrl = storageService.getPublicUrl("lesson-assets", result.path);
      }

      // Atualizar cápsula
      const contentToSave: any = {
        text: formData.contentText,
        media: mediaWithUrls,
        virtualLabId: formData.virtualLabId !== "none" ? formData.virtualLabId : undefined,
        quiz: formData.quiz.length > 0 ? formData.quiz : undefined,
      };

      const { error } = await supabase
        .from("capsulas")
        .update({
          title: formData.title,
          description: formData.description,
          module_id: formData.module_id && formData.module_id !== "none" ? formData.module_id : null,
          is_published: formData.is_published,
          duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
          thumbnail_url: finalThumbnailUrl || null,
          content_data: contentToSave,
        })
        .eq("id", editingCapsula.id);

      if (error) throw error;

      toast.success("Cápsula atualizada com sucesso!");
      setIsDialogOpen(false);
      setEditingCapsula(null);
      resetForm();
      loadCapsulas();
    } catch (error: any) {
      toast.error("Erro ao atualizar cápsula: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteCapsulaId) return;

    try {
      const { error } = await supabase.from("capsulas").delete().eq("id", deleteCapsulaId);
      if (error) throw error;

      toast.success("Cápsula excluída com sucesso!");
      setDeleteCapsulaId(null);
      loadCapsulas();
    } catch (error: any) {
      toast.error("Erro ao excluir cápsula: " + error.message);
    }
  };

  const handleTogglePublish = async (capsulaId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("capsulas")
        .update({ is_published: !currentStatus })
        .eq("id", capsulaId);

      if (error) throw error;

      toast.success(currentStatus ? "Cápsula despublicada" : "Cápsula publicada");
      loadCapsulas();
    } catch (error: any) {
      toast.error("Erro ao alterar status: " + error.message);
    }
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingCapsula(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (capsula: Capsula) => {
    setEditingCapsula(capsula);
    const contentData = capsula.content_data as any || {};
    setFormData({
      title: capsula.title,
      description: capsula.description || "",
      module_id: capsula.module_id || "none",
      is_published: capsula.is_published,
      duration_minutes: capsula.duration_minutes?.toString() || "",
      thumbnail_url: capsula.thumbnail_url || "",
      thumbnailSource: "link",
      thumbnailFile: null,
      contentText: contentData.text || "",
      media: contentData.media || [],
      virtualLabId: contentData.virtualLabId || "none",
      quiz: contentData.quiz || [],
    });
    setIsDialogOpen(true);
  };

  const getModuleName = (moduleId: string | null) => {
    if (!moduleId) return "Sem módulo";
    const module = modules.find((m) => m.id === moduleId);
    return module?.title || "Módulo não encontrado";
  };

  const handleAddMedia = (type: "video" | "image") => {
    setFormData({
      ...formData,
      media: [...formData.media, { type, source: "link" }],
    });
  };

  const handleRemoveMedia = (index: number) => {
    setFormData({
      ...formData,
      media: formData.media.filter((_, i) => i !== index),
    });
  };

  const handleMediaChange = (index: number, updates: Partial<MediaItem>) => {
    const newMedia = [...formData.media];
    newMedia[index] = { ...newMedia[index], ...updates };
    setFormData({ ...formData, media: newMedia });
  };

  const handleAddQuizQuestion = () => {
    setFormData({
      ...formData,
      quiz: [
        ...formData.quiz,
        { question: "", options: ["", "", "", ""], correctAnswer: 0 },
      ],
    });
  };

  const handleRemoveQuizQuestion = (index: number) => {
    setFormData({
      ...formData,
      quiz: formData.quiz.filter((_, i) => i !== index),
    });
  };

  const handleQuizQuestionChange = (index: number, field: string, value: any) => {
    const newQuiz = [...formData.quiz];
    newQuiz[index] = { ...newQuiz[index], [field]: value };
    setFormData({ ...formData, quiz: newQuiz });
  };

  const handleQuizOptionChange = (qIndex: number, oIndex: number, value: string) => {
    const newQuiz = [...formData.quiz];
    newQuiz[qIndex].options[oIndex] = value;
    setFormData({ ...formData, quiz: newQuiz });
  };

  if (loading) {
    return <div className="p-4">Carregando cápsulas...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Gerenciar Cápsulas
              </CardTitle>
              <CardDescription>Conteúdos curtos e rápidos para aprendizado dinâmico</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Cápsula
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingCapsula ? "Editar Cápsula" : "Criar Nova Cápsula"}</DialogTitle>
                  <DialogDescription>
                    Preencha as informações e conteúdo da cápsula
                  </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="basic">Básico</TabsTrigger>
                    <TabsTrigger value="text">Texto</TabsTrigger>
                    <TabsTrigger value="media">Mídia</TabsTrigger>
                    <TabsTrigger value="thumbnail">Thumbnail</TabsTrigger>
                    <TabsTrigger value="lab">Lab Virtual</TabsTrigger>
                    <TabsTrigger value="quiz">Mini Quiz</TabsTrigger>
                  </TabsList>

                  {/* Tab Básico */}
                  <TabsContent value="basic" className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="title">Título</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Nome da cápsula"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Descrição breve"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label htmlFor="module">Módulo (opcional)</Label>
                      <Select value={formData.module_id} onValueChange={(value) => setFormData({ ...formData, module_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um módulo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem módulo</SelectItem>
                          {modules.map((module) => (
                            <SelectItem key={module.id} value={module.id}>
                              {module.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="duration">Duração (minutos)</Label>
                      <Input
                        id="duration"
                        type="number"
                        value={formData.duration_minutes}
                        onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                        placeholder="5-10"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="published"
                        checked={formData.is_published}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                      />
                      <Label htmlFor="published">Publicar imediatamente</Label>
                    </div>
                  </TabsContent>

                  {/* Tab Texto */}
                  <TabsContent value="text" className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="text">Conteúdo de Texto</Label>
                      <Textarea
                        id="text"
                        value={formData.contentText}
                        onChange={(e) => setFormData({ ...formData, contentText: e.target.value })}
                        placeholder="Digite o conteúdo da cápsula..."
                        rows={10}
                        className="mt-2"
                      />
                    </div>
                  </TabsContent>

                  {/* Tab Mídia */}
                  <TabsContent value="media" className="space-y-4 mt-4">
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

                    {formData.media.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Nenhuma mídia adicionada ainda
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {formData.media.map((media, index) => (
                          <div key={index} className="border rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-center">
                              <Label className="capitalize">{media.type === "video" ? "Vídeo" : "Imagem"}</Label>
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

                  {/* Tab Thumbnail */}
                  <TabsContent value="thumbnail" className="space-y-4 mt-4">
                    <Label>Thumbnail da Cápsula</Label>
                    <Tabs 
                      value={formData.thumbnailSource} 
                      onValueChange={(v) => setFormData({ ...formData, thumbnailSource: v as "upload" | "link" })}
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
                          placeholder="URL da thumbnail"
                          value={formData.thumbnail_url}
                          onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                        />
                      </TabsContent>

                      <TabsContent value="upload">
                        <FileUploadField
                          accept="image/*"
                          maxSize={5}
                          onFilesSelected={(files) => setFormData({ ...formData, thumbnailFile: files[0] })}
                          label="Selecione a thumbnail"
                        />
                      </TabsContent>
                    </Tabs>

                    {(formData.thumbnail_url || formData.thumbnailFile) && (
                      <div className="mt-4">
                        <Label className="mb-2 block">Preview:</Label>
                        <img
                          src={formData.thumbnailFile ? URL.createObjectURL(formData.thumbnailFile) : formData.thumbnail_url}
                          alt="Thumbnail preview"
                          className="w-full max-w-sm rounded-lg border"
                        />
                      </div>
                    )}
                  </TabsContent>

                  {/* Tab Lab Virtual */}
                  <TabsContent value="lab" className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="virtualLab">Selecionar Lab Virtual</Label>
                      <Select
                        value={formData.virtualLabId}
                        onValueChange={(value) => setFormData({ ...formData, virtualLabId: value })}
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

                  {/* Tab Mini Quiz */}
                  <TabsContent value="quiz" className="space-y-4 mt-4">
                    <div className="flex justify-between items-center">
                      <Label>Mini Quiz</Label>
                      <Button type="button" variant="outline" size="sm" onClick={handleAddQuizQuestion}>
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Questão
                      </Button>
                    </div>

                    {formData.quiz.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Nenhuma questão adicionada ainda
                      </p>
                    ) : (
                      <div className="space-y-6">
                        {formData.quiz.map((question, qIndex) => (
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

                <DialogFooter className="mt-6">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
                    Cancelar
                  </Button>
                  <Button onClick={editingCapsula ? handleEdit : handleCreate} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingCapsula ? "Salvar Alterações" : "Criar Cápsula"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label>Filtrar por módulo</Label>
            <Select value={filterModuleId} onValueChange={setFilterModuleId}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os módulos</SelectItem>
                <SelectItem value="none">Sem módulo</SelectItem>
                {modules.map((module) => (
                  <SelectItem key={module.id} value={module.id}>
                    {module.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {capsulas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhuma cápsula criada ainda
                  </TableCell>
                </TableRow>
              ) : (
                capsulas.map((capsula) => (
                  <TableRow key={capsula.id}>
                    <TableCell className="font-medium">{capsula.title}</TableCell>
                    <TableCell>{getModuleName(capsula.module_id)}</TableCell>
                    <TableCell>{capsula.duration_minutes ? `${capsula.duration_minutes} min` : "-"}</TableCell>
                    <TableCell>
                      <Badge variant={capsula.is_published ? "default" : "secondary"}>
                        {capsula.is_published ? "Publicado" : "Rascunho"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePublish(capsula.id, capsula.is_published)}
                        >
                          {capsula.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(capsula)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteCapsulaId(capsula.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteCapsulaId} onOpenChange={() => setDeleteCapsulaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta cápsula? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
