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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Plus, Pencil, Trash2, Eye, EyeOff, BookOpen, Link as LinkIcon, 
  Upload, Loader2, Video, Image as ImageIcon, Beaker, FileText,
  ExternalLink, X, GripVertical, ChevronDown, ChevronUp
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { storageService, StorageBucket } from "@/services/storageService";
import { virtualLabService, VirtualLab } from "@/services/virtualLabService";

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  module_id: string | null;
  is_published: boolean;
  duration_minutes: number | null;
  order_index: number | null;
  content_data: any;
};

interface ContentBlock {
  id: string;
  type: "text" | "video" | "image" | "virtualLab";
  order: number;
  data: any;
}

interface Reference {
  id: string;
  title: string;
  url: string;
  description: string;
}

interface MediaUpload {
  type: "video" | "image";
  source: "upload" | "link";
  url?: string;
  file?: File;
}

type LessonFormData = {
  title: string;
  description: string;
  module_id: string;
  is_published: boolean;
  duration_minutes: string;
  prerequisiteLessons: string[];
  thumbnail_url: string;
  thumbnailSource: "upload" | "link";
  thumbnailFile: File | null;
  contentBlocks: ContentBlock[];
  references: Reference[];
};

export function LessonsManager() {
  const { modules } = useModules(true);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteLessonId, setDeleteLessonId] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [filterModuleId, setFilterModuleId] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [virtualLabs, setVirtualLabs] = useState<VirtualLab[]>([]);
  const [availableLessons, setAvailableLessons] = useState<Lesson[]>([]);
  const [activeTab, setActiveTab] = useState("basic");
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<LessonFormData>({
    title: "",
    description: "",
    module_id: "none",
    is_published: false,
    duration_minutes: "",
    prerequisiteLessons: [],
    thumbnail_url: "",
    thumbnailSource: "link",
    thumbnailFile: null,
    contentBlocks: [],
    references: [],
  });

  const loadLessons = async () => {
    try {
      setLoading(true);
      let query = supabase.from("lessons").select("*").order("order_index", { ascending: true });
      
      if (filterModuleId !== "all") {
        query = filterModuleId === "none" 
          ? query.is("module_id", null)
          : query.eq("module_id", filterModuleId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLessons(data || []);
      setAvailableLessons(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar aulas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLessons();
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
      prerequisiteLessons: [],
      thumbnail_url: "",
      thumbnailSource: "link",
      thumbnailFile: null,
      contentBlocks: [],
      references: [],
    });
    setActiveTab("basic");
  };

  const uploadMedia = async (file: File, lessonId: string, type: "video" | "image"): Promise<string> => {
    const bucket = type === "video" ? "lesson-videos" : "lesson-assets";
    const fileName = storageService.generateUniqueFileName(file.name);
    const path = `lessons/${lessonId}/${fileName}`;

    const result = await storageService.uploadFile({
      bucket,
      path,
      file,
    });

    return storageService.getPublicUrl(bucket, result.path);
  };

  const processContentBlocks = async (blocks: ContentBlock[], lessonId: string) => {
    const processedBlocks = await Promise.all(
      blocks.map(async (block) => {
        if ((block.type === "video" || block.type === "image") && block.data.source === "upload" && block.data.file) {
          const url = await uploadMedia(block.data.file, lessonId, block.type);
          return {
            ...block,
            data: {
              ...block.data, // Preservar todos os campos existentes (caption, etc.)
              url, // Adicionar/atualizar a URL
              source: "upload"
            }
          };
        }
        // Se for link, garantir que url está presente
        if ((block.type === "video" || block.type === "image") && block.data.source === "link") {
          return {
            ...block,
            data: {
              ...block.data,
              url: block.data.url || block.data.imageUrl || block.data.videoUrl
            }
          };
        }
        return block;
      })
    );
    return processedBlocks;
  };

  const handleCreate = async () => {
    try {
      setSaving(true);

      // Criar aula primeiro para obter o ID
      const { data: newLesson, error: createError } = await supabase
        .from("lessons")
        .insert({
          title: formData.title,
          description: formData.description,
          module_id: formData.module_id && formData.module_id !== "none" ? formData.module_id : null,
          is_published: formData.is_published,
          duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
          content_data: { blocks: [], references: [], prerequisites: [] },
          content_type: 'interactive', // Valor padrão para compatibilidade com schema antigo
        })
        .select()
        .single();

      if (createError) throw createError;
      const lessonId = newLesson.id;

      // Processar blocos de conteúdo
      const processedBlocks = await processContentBlocks(formData.contentBlocks, lessonId);

      // Upload de thumbnail se necessário
      let finalThumbnailUrl = formData.thumbnail_url;
      if (formData.thumbnailSource === "upload" && formData.thumbnailFile) {
        const fileName = storageService.generateUniqueFileName(formData.thumbnailFile.name);
        const path = `lessons/${lessonId}/thumbnail_${fileName}`;
        const result = await storageService.uploadFile({
          bucket: "lesson-assets",
          path,
          file: formData.thumbnailFile,
        });
        finalThumbnailUrl = storageService.getPublicUrl("lesson-assets", result.path);
      }

      // Atualizar com conteúdo completo
      const contentToSave = {
        blocks: processedBlocks,
        references: formData.references,
        prerequisites: formData.prerequisiteLessons,
        thumbnail: finalThumbnailUrl || null,
      };

      const { error: updateError } = await supabase
        .from("lessons")
        .update({ content_data: contentToSave as any })
        .eq("id", lessonId);

      if (updateError) throw updateError;

      toast.success("Aula criada com sucesso!");
      setIsDialogOpen(false);
      resetForm();
      setEditingLesson(null);
      loadLessons();
    } catch (error: any) {
      toast.error("Erro ao criar aula: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editingLesson) return;

    try {
      setSaving(true);

      // Processar blocos de conteúdo
      const processedBlocks = await processContentBlocks(formData.contentBlocks, editingLesson.id);

      // Upload de thumbnail se necessário
      let finalThumbnailUrl = formData.thumbnail_url;
      if (formData.thumbnailSource === "upload" && formData.thumbnailFile) {
        const fileName = storageService.generateUniqueFileName(formData.thumbnailFile.name);
        const path = `lessons/${editingLesson.id}/thumbnail_${fileName}`;
        const result = await storageService.uploadFile({
          bucket: "lesson-assets",
          path,
          file: formData.thumbnailFile,
        });
        finalThumbnailUrl = storageService.getPublicUrl("lesson-assets", result.path);
      }

      // Atualizar aula
      const contentToSave = {
        blocks: processedBlocks,
        references: formData.references,
        prerequisites: formData.prerequisiteLessons,
        thumbnail: finalThumbnailUrl || null,
      };

      const { error } = await supabase
        .from("lessons")
        .update({
          title: formData.title,
          description: formData.description,
          module_id: formData.module_id && formData.module_id !== "none" ? formData.module_id : null,
          is_published: formData.is_published,
          duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
          content_data: contentToSave as any,
        })
        .eq("id", editingLesson.id);

      if (error) throw error;

      toast.success("Aula atualizada com sucesso!");
      setIsDialogOpen(false);
      setEditingLesson(null);
      resetForm();
      loadLessons();
    } catch (error: any) {
      toast.error("Erro ao atualizar aula: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteLessonId) return;

    try {
      // Buscar aula para extrair URLs de mídia antes de excluir
      const { data: lesson } = await supabase
        .from("lessons")
        .select("content_data")
        .eq("id", deleteLessonId)
        .single();

      if (lesson?.content_data) {
        const urls: string[] = [];
        const content = lesson.content_data as any;
        // Thumbnail
        if (content.thumbnail && typeof content.thumbnail === "string") urls.push(content.thumbnail);
        // Blocos de imagem/vídeo
        (content.blocks || []).forEach((b: any) => {
          if ((b.type === "video" || b.type === "image") && b.data?.url) urls.push(b.data.url);
          if (b.data?.imageUrl) urls.push(b.data.imageUrl);
          if (b.data?.videoUrl) urls.push(b.data.videoUrl);
        });
        // Deletar mídia do storage (apenas URLs do Supabase)
        await Promise.allSettled(
          urls.filter((u) => u?.includes?.("/storage/v1/object/public/")).map((u) => storageService.deleteFileFromSupabaseUrl(u))
        );
      }

      const { error } = await supabase.from("lessons").delete().eq("id", deleteLessonId);
      if (error) throw error;

      toast.success("Aula excluída com sucesso!");
      setDeleteLessonId(null);
      loadLessons();
    } catch (error: any) {
      toast.error("Erro ao excluir aula: " + error.message);
    }
  };

  const handleTogglePublish = async (lessonId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("lessons")
        .update({ is_published: !currentStatus })
        .eq("id", lessonId);

      if (error) throw error;

      toast.success(currentStatus ? "Aula despublicada" : "Aula publicada");
      loadLessons();
    } catch (error: any) {
      toast.error("Erro ao alterar status: " + error.message);
    }
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingLesson(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (lesson: Lesson) => {
    setEditingLesson(lesson);
    const contentData = lesson.content_data || {};
    setFormData({
      title: lesson.title,
      description: lesson.description || "",
      module_id: lesson.module_id || "none",
      is_published: lesson.is_published,
      duration_minutes: lesson.duration_minutes?.toString() || "",
      prerequisiteLessons: contentData.prerequisites || [],
      thumbnail_url: contentData.thumbnail || "",
      thumbnailSource: "link",
      thumbnailFile: null,
      contentBlocks: contentData.blocks || [],
      references: contentData.references || [],
    });
    setIsDialogOpen(true);
  };

  const getModuleName = (moduleId: string | null) => {
    if (!moduleId) return "Sem módulo";
    const module = modules.find((m) => m.id === moduleId);
    return module?.title || "Módulo não encontrado";
  };

  // Content Block Management
  const addContentBlock = (type: ContentBlock["type"]) => {
    const newBlock: ContentBlock = {
      id: `block_${Date.now()}`,
      type,
      order: formData.contentBlocks.length,
      data: type === "text" ? { content: "" } : 
            type === "virtualLab" ? { labId: "" } :
            { source: "link", url: "" }
    };
    setFormData({
      ...formData,
      contentBlocks: [...formData.contentBlocks, newBlock]
    });
    setExpandedBlock(newBlock.id);
  };

  const removeContentBlock = (blockId: string) => {
    setFormData({
      ...formData,
      contentBlocks: formData.contentBlocks.filter(b => b.id !== blockId)
    });
  };

  const deleteMediaFromStorage = async (url: string, type: "video" | "image") => {
    try {
      // Extrair bucket e path da URL do Supabase Storage
      // Formato: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
      const urlPattern = /\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/;
      const match = url.match(urlPattern);
      
      if (!match) {
        console.warn("URL não é do Supabase Storage:", url);
        return;
      }

      const [, bucket, path] = match;
      
      // Validar que é um bucket permitido
      const allowedBuckets = ["lesson-assets", "lesson-videos"];
      if (!allowedBuckets.includes(bucket)) {
        console.warn("Bucket não permitido:", bucket);
        return;
      }

      // Deletar arquivo do storage
      await storageService.deleteFile(bucket as StorageBucket, decodeURIComponent(path));
      // O storageService já mostra toast, então não precisamos mostrar outro
    } catch (error: any) {
      console.error("Erro ao deletar arquivo do storage:", error);
      toast.error(`Erro ao remover arquivo: ${error.message || "Erro desconhecido"}`);
    }
  };

  const updateContentBlock = (blockId: string, data: any) => {
    setFormData({
      ...formData,
      contentBlocks: formData.contentBlocks.map(b => 
        b.id === blockId ? { ...b, data: { ...b.data, ...data } } : b
      )
    });
  };

  const moveBlockUp = (index: number) => {
    if (index === 0) return;
    const newBlocks = [...formData.contentBlocks];
    [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
    setFormData({ ...formData, contentBlocks: newBlocks });
  };

  const moveBlockDown = (index: number) => {
    if (index === formData.contentBlocks.length - 1) return;
    const newBlocks = [...formData.contentBlocks];
    [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
    setFormData({ ...formData, contentBlocks: newBlocks });
  };

  // Reference Management
  const addReference = () => {
    const newRef: Reference = {
      id: `ref_${Date.now()}`,
      title: "",
      url: "",
      description: ""
    };
    setFormData({
      ...formData,
      references: [...formData.references, newRef]
    });
  };

  const removeReference = (refId: string) => {
    setFormData({
      ...formData,
      references: formData.references.filter(r => r.id !== refId)
    });
  };

  const updateReference = (refId: string, updates: Partial<Reference>) => {
    setFormData({
      ...formData,
      references: formData.references.map(r => 
        r.id === refId ? { ...r, ...updates } : r
      )
    });
  };

  const getBlockIcon = (type: ContentBlock["type"]) => {
    switch (type) {
      case "text": return <FileText className="h-4 w-4" />;
      case "video": return <Video className="h-4 w-4" />;
      case "image": return <ImageIcon className="h-4 w-4" />;
      case "virtualLab": return <Beaker className="h-4 w-4" />;
    }
  };

  const getBlockLabel = (type: ContentBlock["type"]) => {
    switch (type) {
      case "text": return "Texto";
      case "video": return "Vídeo";
      case "image": return "Imagem";
      case "virtualLab": return "Lab Virtual";
    }
  };

  if (loading) {
    return <div className="p-4">Carregando aulas...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Gerenciar Aulas
              </CardTitle>
              <CardDescription>Crie aulas completas com múltiplos tipos de conteúdo</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Aula
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingLesson ? "Editar Aula" : "Criar Nova Aula"}</DialogTitle>
                  <DialogDescription>
                    Configure todos os aspectos da aula de forma sequencial
                  </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="basic">1. Básico</TabsTrigger>
                    <TabsTrigger value="content">2. Conteúdo</TabsTrigger>
                    <TabsTrigger value="references">3. Referências</TabsTrigger>
                    <TabsTrigger value="config">4. Configurações</TabsTrigger>
                  </TabsList>

                  {/* Tab 1: Informações Básicas */}
                  <TabsContent value="basic" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label htmlFor="title">Título da Aula</Label>
                        <Input
                          id="title"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder="Ex: Fundamentos da Fisioterapia"
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Descreva o que será abordado nesta aula"
                          rows={3}
                        />
                      </div>

                      <div>
                        <Label htmlFor="module">Módulo</Label>
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
                          placeholder="Ex: 45"
                        />
                      </div>

                      <div className="col-span-2">
                        <Label>Thumbnail da Aula</Label>
                        
                        {/* Preview da thumbnail atual */}
                        {(formData.thumbnail_url || formData.thumbnailFile) && (
                          <div className="mb-4 border rounded-lg p-3 bg-muted/50">
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-sm font-medium">Preview da Thumbnail</Label>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  // Se for URL do Supabase Storage, deletar do storage
                                  if (formData.thumbnail_url && formData.thumbnail_url.includes('supabase.co/storage')) {
                                    await deleteMediaFromStorage(formData.thumbnail_url, "image");
                                  }
                                  setFormData({ 
                                    ...formData, 
                                    thumbnail_url: "", 
                                    thumbnailFile: null 
                                  });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            {formData.thumbnailFile ? (
                              <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                                <img
                                  src={URL.createObjectURL(formData.thumbnailFile)}
                                  alt="Preview"
                                  className="w-full h-full object-cover"
                                />
                                <p className="text-xs text-muted-foreground mt-2">
                                  Novo arquivo selecionado: {formData.thumbnailFile.name}
                                </p>
                              </div>
                            ) : formData.thumbnail_url ? (
                              <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                                <img
                                  src={formData.thumbnail_url}
                                  alt="Preview"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    console.error("Erro ao carregar thumbnail:", formData.thumbnail_url);
                                    const img = e.currentTarget;
                                    img.style.display = 'none';
                                    const parent = img.parentElement;
                                    if (parent && !parent.querySelector('.error-message')) {
                                      const errorDiv = document.createElement('div');
                                      errorDiv.className = 'error-message aspect-video flex flex-col items-center justify-center bg-red-50 dark:bg-red-950 rounded-lg p-4 border border-red-200 dark:border-red-800';
                                      errorDiv.innerHTML = `
                                        <svg class="h-8 w-8 text-red-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <p class="text-sm text-red-600 dark:text-red-400 text-center font-medium">Erro ao carregar thumbnail</p>
                                        <p class="text-xs text-muted-foreground mt-1 text-center break-all">${formData.thumbnail_url}</p>
                                      `;
                                      parent.appendChild(errorDiv);
                                    }
                                  }}
                                />
                                <p className="text-xs text-muted-foreground mt-2 break-all">
                                  {formData.thumbnail_url}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div>
                            <Label className="text-sm">Tipo</Label>
                            <Select 
                              value={formData.thumbnailSource} 
                              onValueChange={(value: "upload" | "link") => {
                                // Não limpar URL se já existe uma thumbnail
                                if (formData.thumbnail_url) {
                                  setFormData({ ...formData, thumbnailSource: value, thumbnailFile: null });
                                } else {
                                  setFormData({ ...formData, thumbnailSource: value, thumbnail_url: "", thumbnailFile: null });
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="link">Link Externo</SelectItem>
                                <SelectItem value="upload">Upload</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            {formData.thumbnailSource === "link" ? (
                              <>
                                <Label className="text-sm">URL da Imagem</Label>
                                <Input
                                  value={formData.thumbnail_url}
                                  onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                                  placeholder="https://..."
                                />
                              </>
                            ) : (
                              <>
                                <Label className="text-sm">Arquivo</Label>
                                <FileUploadField
                                  accept="image/*"
                                  multiple={false}
                                  onFilesSelected={(files) => setFormData({ ...formData, thumbnailFile: files[0] || null })}
                                />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button onClick={() => setActiveTab("content")}>
                        Próximo: Conteúdo →
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Tab 2: Conteúdo */}
                  <TabsContent value="content" className="space-y-4 mt-4">
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addContentBlock("text")}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Adicionar Texto
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addContentBlock("video")}
                      >
                        <Video className="h-4 w-4 mr-2" />
                        Adicionar Vídeo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addContentBlock("image")}
                      >
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Adicionar Imagem
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addContentBlock("virtualLab")}
                      >
                        <Beaker className="h-4 w-4 mr-2" />
                        Adicionar Lab Virtual
                      </Button>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      {formData.contentBlocks.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>Nenhum bloco de conteúdo adicionado ainda</p>
                          <p className="text-sm">Use os botões acima para adicionar conteúdo</p>
                        </div>
                      ) : (
                        formData.contentBlocks.map((block, index) => (
                          <Card key={block.id} className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-5 w-5 text-muted-foreground" />
                                {getBlockIcon(block.type)}
                                <span className="font-medium">{getBlockLabel(block.type)} #{index + 1}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setExpandedBlock(expandedBlock === block.id ? null : block.id)}
                                >
                                  {expandedBlock === block.id ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => moveBlockUp(index)}
                                  disabled={index === 0}
                                >
                                  ↑
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => moveBlockDown(index)}
                                  disabled={index === formData.contentBlocks.length - 1}
                                >
                                  ↓
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeContentBlock(block.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {expandedBlock === block.id && (
                              <div className="space-y-3 pt-3 border-t">
                                {block.type === "text" && (
                                  <div>
                                    <Label>Conteúdo de Texto</Label>
                                    <Textarea
                                      value={block.data.content || ""}
                                      onChange={(e) => updateContentBlock(block.id, { content: e.target.value })}
                                      placeholder="Digite o conteúdo textual aqui..."
                                      rows={6}
                                    />
                                  </div>
                                )}

                                {(block.type === "video" || block.type === "image") && (
                                  <div className="space-y-3">
                                    {/* Mostrar preview do arquivo já enviado */}
                                    {(block.data.url || block.data.imageUrl || block.data.videoUrl) && !block.data.file && (
                                      <div className="border rounded-lg p-3 bg-muted/50">
                                        <div className="flex items-center justify-between mb-2">
                                          <Label className="text-sm font-medium">
                                            {block.type === "video" ? "Vídeo" : "Imagem"} Atual
                                          </Label>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={async () => {
                                              const urlToDelete = block.data.url || block.data.imageUrl || block.data.videoUrl;
                                              
                                              // Deletar do storage se for URL do Supabase
                                              if (urlToDelete && urlToDelete.includes('supabase.co/storage')) {
                                                await deleteMediaFromStorage(urlToDelete, block.type as "video" | "image");
                                              }
                                              
                                              // Remover do estado
                                              updateContentBlock(block.id, { url: "", imageUrl: "", videoUrl: "" });
                                            }}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                        {block.type === "video" ? (
                                          <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                                            <video
                                              src={block.data.url || block.data.videoUrl}
                                              controls
                                              className="w-full h-full"
                                            >
                                              Seu navegador não suporta vídeo.
                                            </video>
                                          </div>
                                        ) : (
                                          <div className="relative">
                                            <img
                                              src={block.data.url || block.data.imageUrl}
                                              alt="Preview"
                                              className="w-full max-h-48 object-contain rounded-lg border border-border"
                                              onError={(e) => {
                                                console.error("Erro ao carregar imagem:", {
                                                  url: block.data.url || block.data.imageUrl,
                                                  error: "Imagem não encontrada ou sem permissão de acesso"
                                                });
                                                const img = e.currentTarget;
                                                img.style.display = 'none';
                                                const parent = img.parentElement;
                                                if (parent && !parent.querySelector('.error-message')) {
                                                  const errorDiv = document.createElement('div');
                                                  errorDiv.className = 'error-message aspect-video flex flex-col items-center justify-center bg-red-50 dark:bg-red-950 rounded-lg p-4 border border-red-200 dark:border-red-800';
                                                  errorDiv.innerHTML = `
                                                    <ImageIcon class="h-8 w-8 text-red-500 mb-2" />
                                                    <p class="text-sm text-red-600 dark:text-red-400 text-center font-medium">Erro ao carregar imagem</p>
                                                    <p class="text-xs text-muted-foreground mt-1 text-center break-all">Verifique as permissões do bucket no Supabase</p>
                                                  `;
                                                  parent.appendChild(errorDiv);
                                                }
                                              }}
                                              onLoad={(e) => {
                                                // Remover mensagem de erro se a imagem carregar com sucesso
                                                const parent = e.currentTarget.parentElement;
                                                if (parent) {
                                                  const errorMsg = parent.querySelector('.error-message');
                                                  if (errorMsg) errorMsg.remove();
                                                }
                                              }}
                                            />
                                          </div>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-2 break-all">
                                          {block.data.url || block.data.imageUrl || block.data.videoUrl}
                                        </p>
                                      </div>
                                    )}

                                    {/* Mostrar preview do arquivo selecionado mas ainda não enviado */}
                                    {block.data.file && (
                                      <div className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-950">
                                        <div className="flex items-center justify-between mb-2">
                                          <Label className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                            Novo Arquivo Selecionado
                                          </Label>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => updateContentBlock(block.id, { file: null })}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                        <p className="text-sm text-blue-600 dark:text-blue-400">
                                          {block.data.file.name} ({(block.data.file.size / 1024 / 1024).toFixed(2)} MB)
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          O arquivo será enviado ao salvar a aula.
                                        </p>
                                      </div>
                                    )}

                                    <div>
                                      <Label>Origem do Arquivo</Label>
                                      <Select
                                        value={block.data.source || "link"}
                                        onValueChange={(value: "upload" | "link") => {
                                          // Não limpar URL se já existe um arquivo enviado
                                          if (block.data.url || block.data.imageUrl || block.data.videoUrl) {
                                            updateContentBlock(block.id, { source: value, file: null });
                                          } else {
                                            updateContentBlock(block.id, { source: value, url: "", file: null });
                                          }
                                        }}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="link">Link Externo</SelectItem>
                                          <SelectItem value="upload">Upload</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {block.data.source === "link" ? (
                                      <div>
                                        <Label>URL do {block.type === "video" ? "Vídeo" : "Imagem"}</Label>
                                        <Input
                                          value={block.data.url || block.data.imageUrl || block.data.videoUrl || ""}
                                          onChange={(e) => updateContentBlock(block.id, { url: e.target.value })}
                                          placeholder="https://..."
                                        />
                                      </div>
                                    ) : (
                                      <div>
                                        <Label>Arquivo</Label>
                                        <FileUploadField
                                          accept={block.type === "video" ? "video/*" : "image/*"}
                                          multiple={false}
                                          onFilesSelected={(files) => updateContentBlock(block.id, { file: files[0] || null })}
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}

                                {block.type === "virtualLab" && (
                                  <div>
                                    <Label>Selecionar Lab Virtual</Label>
                                    {virtualLabs.length === 0 ? (
                                      <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-md mt-2">
                                        <p>Nenhum lab virtual publicado disponível.</p>
                                        <p className="mt-1">Vá para a aba "Labs Virtuais" para criar e publicar labs.</p>
                                      </div>
                                    ) : (
                                      <Select
                                        value={block.data.labId || ""}
                                        onValueChange={(value) => updateContentBlock(block.id, { labId: value })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Escolha um lab virtual" />
                                        </SelectTrigger>
                                        <SelectContent>
                                           {virtualLabs.map((lab) => (
                                            <SelectItem key={lab.id} value={lab.id}>
                                              {lab.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </Card>
                        ))
                      )}
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button variant="outline" onClick={() => setActiveTab("basic")}>
                        ← Anterior
                      </Button>
                      <Button onClick={() => setActiveTab("references")}>
                        Próximo: Referências →
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Tab 3: Referências */}
                  <TabsContent value="references" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Aprenda Mais</h3>
                        <p className="text-sm text-muted-foreground">
                          Adicione links e recursos complementares para os alunos
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addReference}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Referência
                      </Button>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      {formData.references.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <ExternalLink className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>Nenhuma referência adicionada ainda</p>
                        </div>
                      ) : (
                        formData.references.map((ref, index) => (
                          <Card key={ref.id} className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-medium">Referência #{index + 1}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeReference(ref.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <Label>Título</Label>
                                <Input
                                  value={ref.title}
                                  onChange={(e) => updateReference(ref.id, { title: e.target.value })}
                                  placeholder="Ex: Artigo sobre o tema"
                                />
                              </div>
                              <div>
                                <Label>URL</Label>
                                <Input
                                  value={ref.url}
                                  onChange={(e) => updateReference(ref.id, { url: e.target.value })}
                                  placeholder="https://..."
                                />
                              </div>
                              <div>
                                <Label>Descrição (opcional)</Label>
                                <Textarea
                                  value={ref.description}
                                  onChange={(e) => updateReference(ref.id, { description: e.target.value })}
                                  placeholder="Breve descrição do recurso"
                                  rows={2}
                                />
                              </div>
                            </div>
                          </Card>
                        ))
                      )}
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button variant="outline" onClick={() => setActiveTab("content")}>
                        ← Anterior
                      </Button>
                      <Button onClick={() => setActiveTab("config")}>
                        Próximo: Configurações →
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Tab 4: Configurações Avançadas */}
                  <TabsContent value="config" className="space-y-4 mt-4">
                    <div>
                      <h3 className="font-semibold mb-3">Pré-requisitos</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Selecione aulas que devem ser concluídas antes desta
                      </p>
                      <Select
                        value=""
                        onValueChange={(value) => {
                          if (!formData.prerequisiteLessons.includes(value)) {
                            setFormData({
                              ...formData,
                              prerequisiteLessons: [...formData.prerequisiteLessons, value]
                            });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Adicionar pré-requisito..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableLessons
                            .filter(l => !formData.prerequisiteLessons.includes(l.id) && l.id !== editingLesson?.id)
                            .map((lesson) => (
                              <SelectItem key={lesson.id} value={lesson.id}>
                                {lesson.title}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>

                      {formData.prerequisiteLessons.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {formData.prerequisiteLessons.map((lessonId) => {
                            const lesson = availableLessons.find(l => l.id === lessonId);
                            return (
                              <div key={lessonId} className="flex items-center justify-between p-2 border rounded">
                                <span className="text-sm">{lesson?.title || "Aula não encontrada"}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setFormData({
                                      ...formData,
                                      prerequisiteLessons: formData.prerequisiteLessons.filter(id => id !== lessonId)
                                    });
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <Separator />

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="published"
                        checked={formData.is_published}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                      />
                      <Label htmlFor="published">Publicar aula imediatamente</Label>
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button variant="outline" onClick={() => setActiveTab("references")}>
                        ← Anterior
                      </Button>
                      <Button onClick={editingLesson ? handleEdit : handleCreate} disabled={saving}>
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {editingLesson ? "Salvar Alterações" : "Criar Aula"}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
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
              {lessons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhuma aula criada ainda
                  </TableCell>
                </TableRow>
              ) : (
                lessons.map((lesson) => (
                  <TableRow key={lesson.id}>
                    <TableCell className="font-medium">{lesson.title}</TableCell>
                    <TableCell>{getModuleName(lesson.module_id)}</TableCell>
                    <TableCell>{lesson.duration_minutes ? `${lesson.duration_minutes} min` : "-"}</TableCell>
                    <TableCell>
                      <Badge variant={lesson.is_published ? "default" : "secondary"}>
                        {lesson.is_published ? "Publicado" : "Rascunho"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePublish(lesson.id, lesson.is_published)}
                        >
                          {lesson.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(lesson)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteLessonId(lesson.id)}>
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
      <AlertDialog open={!!deleteLessonId} onOpenChange={() => setDeleteLessonId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta aula? Esta ação não pode ser desfeita.
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