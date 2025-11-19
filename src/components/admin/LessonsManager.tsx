import { useState, useEffect } from "react";
import { moduleService } from "@/services/moduleService";
import { lessonService } from "@/services/lessonService";
import { storageService } from "@/services/storageService";
import { quizService, QuizPergunta, QuizAlternativa } from "@/services/quizService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField } from "@/components/ui/FileUploadField";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { QuizQuestionsEditor } from "@/components/admin/QuizQuestionsEditor";
import { LessonBlockEditor } from "@/components/admin/LessonBlockEditor";
import { LessonPreview } from "@/components/admin/LessonPreview";
import { BlockData } from "@/components/lesson/ContentBlock";
import { toast } from "@/hooks/use-toast";
import { 
  GraduationCap, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  Video, 
  FileText,
  FlaskConical,
  ClipboardCheck,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers
} from "lucide-react";

export function LessonsManager() {
  const [modules, setModules] = useState<any[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [lessons, setLessons] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content_type: "composto",
    descricao_curta: "",
    duration_minutes: 0,
    video_external_url: "",
    conteudo_rich_text: "",
    published: false,
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [assetFiles, setAssetFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  
  // Estados para Blocos de Conteúdo
  const [contentBlocks, setContentBlocks] = useState<BlockData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [blockFiles, setBlockFiles] = useState<Map<string, { video?: File; image?: File }>>(new Map());
  
  // Estados para Quiz
  const [quizData, setQuizData] = useState({
    titulo: "",
    descricao: "",
    nota_minima_aprovacao: 70,
    tentativas_maximas: 3,
    tempo_limite_segundos: null as number | null,
    modo_de_navegacao: "livre",
    aleatorizar_ordem_perguntas: false,
    aleatorizar_ordem_alternativas: true,
    feedback_imediato: false,
    ativo: true,
  });
  const [perguntas, setPerguntas] = useState<(QuizPergunta & { alternativas: QuizAlternativa[] })[]>([]);

  useEffect(() => {
    loadModules();
  }, []);

  useEffect(() => {
    if (selectedModuleId) {
      loadLessons();
    }
  }, [selectedModuleId]);

  const loadModules = async () => {
    try {
      const data = await moduleService.getAllModules();
      setModules(data);
      if (data.length > 0 && !selectedModuleId) {
        setSelectedModuleId(data[0].id);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    }
  };

  const loadLessons = async () => {
    try {
      const data = await lessonService.getAllLessonsByModule(selectedModuleId);
      setLessons(data);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    }
  };

  const startEdit = async (lesson?: any) => {
    if (lesson) {
      setEditing(lesson.id);
      setFormData({
        title: lesson.title,
        content_type: lesson.content_type,
        descricao_curta: lesson.descricao_curta || "",
        duration_minutes: lesson.duration_minutes || 0,
        video_external_url: lesson.video_external_url || "",
        conteudo_rich_text: lesson.conteudo_rich_text || "",
        published: lesson.published || false,
      });
      
      // Carregar blocos de conteúdo se existirem
      if (lesson.content_data && Array.isArray(lesson.content_data.blocks)) {
        setContentBlocks(lesson.content_data.blocks);
      } else {
        setContentBlocks([]);
      }
      
      // Carregar dados do quiz se for tipo quiz
      if (lesson.content_type === "quiz") {
        const quizzes = await quizService.getQuizzesByLesson(lesson.id);
        if (quizzes.length > 0) {
          const quiz = quizzes[0];
          setQuizData({
            titulo: quiz.titulo,
            descricao: quiz.descricao || "",
            nota_minima_aprovacao: quiz.nota_minima_aprovacao,
            tentativas_maximas: quiz.tentativas_maximas,
            tempo_limite_segundos: quiz.tempo_limite_segundos,
            modo_de_navegacao: quiz.modo_de_navegacao,
            aleatorizar_ordem_perguntas: quiz.aleatorizar_ordem_perguntas,
            aleatorizar_ordem_alternativas: quiz.aleatorizar_ordem_alternativas,
            feedback_imediato: quiz.feedback_imediato,
            ativo: quiz.ativo,
          });
          
          const perguntasData = await quizService.getPerguntasByQuiz(quiz.id);
          setPerguntas(perguntasData);
        }
      }
    } else {
      setEditing("new");
      setFormData({
        title: "",
        content_type: "composto",
        descricao_curta: "",
        duration_minutes: 0,
        video_external_url: "",
        conteudo_rich_text: "",
        published: false,
      });
      setContentBlocks([]);
      setQuizData({
        titulo: "",
        descricao: "",
        nota_minima_aprovacao: 70,
        tentativas_maximas: 3,
        tempo_limite_segundos: null,
        modo_de_navegacao: "livre",
        aleatorizar_ordem_perguntas: false,
        aleatorizar_ordem_alternativas: true,
        feedback_imediato: false,
        ativo: true,
      });
      setPerguntas([]);
    }
    setVideoFile(null);
    setAssetFiles([]);
  };

  const cancelEdit = () => {
    setEditing(null);
    setFormData({
      title: "",
      content_type: "composto",
      descricao_curta: "",
      duration_minutes: 0,
      video_external_url: "",
      conteudo_rich_text: "",
      published: false,
    });
    setContentBlocks([]);
    setBlockFiles(new Map());
    setQuizData({
      titulo: "",
      descricao: "",
      nota_minima_aprovacao: 70,
      tentativas_maximas: 3,
      tempo_limite_segundos: null,
      modo_de_navegacao: "livre",
      aleatorizar_ordem_perguntas: false,
      aleatorizar_ordem_alternativas: true,
      feedback_imediato: false,
      ativo: true,
    });
    setPerguntas([]);
    setVideoFile(null);
    setAssetFiles([]);
  };
  
  // Funções para gerenciar blocos
  const addBlock = (type: BlockData['type']) => {
    const newBlock: BlockData = {
      id: `block-${Date.now()}`,
      type,
      order: contentBlocks.length,
      data: {}
    };
    setContentBlocks([...contentBlocks, newBlock]);
  };
  
  const handleBlockFileChange = (blockId: string, file: File | null, type: 'video' | 'image') => {
    setBlockFiles(prev => {
      const newMap = new Map(prev);
      const blockFiles = newMap.get(blockId) || {};
      
      if (type === 'video') {
        blockFiles.video = file || undefined;
      } else {
        blockFiles.image = file || undefined;
      }
      
      if (blockFiles.video || blockFiles.image) {
        newMap.set(blockId, blockFiles);
      } else {
        newMap.delete(blockId);
      }
      
      return newMap;
    });
  };
  
  const updateBlock = (id: string, updatedBlock: BlockData) => {
    setContentBlocks(contentBlocks.map(block => 
      block.id === id ? updatedBlock : block
    ));
  };
  
  const deleteBlock = (id: string) => {
    const filtered = contentBlocks.filter(block => block.id !== id);
    // Reordenar
    const reordered = filtered.map((block, index) => ({
      ...block,
      order: index
    }));
    setContentBlocks(reordered);
  };
  
  const moveBlockUp = (id: string) => {
    const index = contentBlocks.findIndex(block => block.id === id);
    if (index > 0) {
      const newBlocks = [...contentBlocks];
      [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
      // Atualizar orders
      const reordered = newBlocks.map((block, idx) => ({
        ...block,
        order: idx
      }));
      setContentBlocks(reordered);
    }
  };
  
  const moveBlockDown = (id: string) => {
    const index = contentBlocks.findIndex(block => block.id === id);
    if (index < contentBlocks.length - 1) {
      const newBlocks = [...contentBlocks];
      [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
      // Atualizar orders
      const reordered = newBlocks.map((block, idx) => ({
        ...block,
        order: idx
      }));
      setContentBlocks(reordered);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Título é obrigatório",
      });
      return;
    }

    if (!selectedModuleId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione um módulo",
      });
      return;
    }

    setUploading(true);
    try {
      // Validação: quiz publicado precisa ter ao menos 1 pergunta
      if (formData.content_type === "quiz" && formData.published && perguntas.length === 0) {
        toast({
          variant: "destructive",
          title: "Quiz sem perguntas",
          description: "Adicione pelo menos 1 pergunta para publicar esta aula como quiz.",
        });
        return;
      }

      // Preparar dados básicos da aula
      const lessonData: any = {
        module_id: selectedModuleId,
        title: formData.title.trim(),
        content_type: formData.content_type,
        descricao_curta: formData.descricao_curta.trim() || null,
        duration_minutes: formData.duration_minutes || null,
        published: formData.published,
      };
      
      // Salvar blocos de conteúdo se tipo for "composto"
      if (formData.content_type === "composto") {
        lessonData.content_data = { blocks: contentBlocks } as any;
      }

      if (formData.content_type === "video") {
        lessonData.video_external_url = formData.video_external_url.trim() || null;
      }

      if (formData.content_type === "artigo") {
        lessonData.conteudo_rich_text = formData.conteudo_rich_text;
      }

      // Se for nova aula, criar primeiro para obter o ID
      let lessonId = editing;
      if (editing === "new") {
        const newLesson = await lessonService.createLesson(lessonData);
        lessonId = newLesson.id;
      }

      // Agora fazer upload dos arquivos usando o ID real da aula
      let videoStoragePath = null;
      let assetsData: any[] = [];

      if (videoFile) {
        const fileName = storageService.generateUniqueFileName(videoFile.name);
        const path = `${selectedModuleId}/${lessonId}/${fileName}`;
        const result = await storageService.uploadFile({
          bucket: "lesson-videos",
          path,
          file: videoFile,
        });
        videoStoragePath = result.path;
      }

      if (assetFiles.length > 0) {
        const uploads = await Promise.all(
          assetFiles.map(async (file) => {
            const fileName = storageService.generateUniqueFileName(file.name);
            const path = `${selectedModuleId}/${lessonId}/${fileName}`;
            const result = await storageService.uploadFile({
              bucket: "lesson-assets",
              path,
              file,
            });
            return {
              name: file.name,
              path: result.path,
              type: file.type,
            };
          })
        );
        assetsData = uploads;
      }

      // Atualizar aula com os paths dos arquivos
      if (videoStoragePath || assetsData.length > 0) {
        const updateData: any = {};
        if (videoStoragePath) {
          updateData.video_storage_path = videoStoragePath;
        }
        if (assetsData.length > 0) {
          updateData.assets = assetsData;
        }
        await lessonService.updateLesson(lessonId, updateData);
      }
      
      // Upload de arquivos dos blocos se for aula composta
      if (formData.content_type === "composto" && blockFiles.size > 0) {
        const updatedBlocks = await Promise.all(
          contentBlocks.map(async (block) => {
            const files = blockFiles.get(block.id);
            if (!files) return block;
            
            const updatedData = { ...block.data };
            
            // Upload de vídeo do bloco
            if (files.video && block.type === 'video') {
              const fileName = storageService.generateUniqueFileName(files.video.name);
              const path = `${selectedModuleId}/${lessonId}/blocks/${fileName}`;
              const result = await storageService.uploadFile({
                bucket: "lesson-videos",
                path,
                file: files.video,
              });
              // Salvar o path do storage (não a URL assinada)
              updatedData.videoStoragePath = result.path;
              // Limpar URL anterior se houver
              delete updatedData.videoUrl;
            }
            
            // Upload de imagem do bloco
            if (files.image && block.type === 'image') {
              const fileName = storageService.generateUniqueFileName(files.image.name);
              const path = `${selectedModuleId}/${lessonId}/blocks/${fileName}`;
              const result = await storageService.uploadFile({
                bucket: "lesson-assets",
                path,
                file: files.image,
              });
              // Salvar o path do storage (não a URL assinada)
              updatedData.imageStoragePath = result.path;
              // Limpar URL anterior se houver
              delete updatedData.imageUrl;
            }
            
            return {
              ...block,
              data: updatedData
            };
          })
        );
        
        // Atualizar a aula com os blocos atualizados
        await lessonService.updateLesson(lessonId, {
          content_data: { blocks: updatedBlocks } as any
        });
      }

      if (editing === "new") {
        toast({
          title: "Aula criada",
          description: "A aula foi criada com sucesso",
        });
      } else {
        await lessonService.updateLesson(editing, lessonData);
        toast({
          title: "Aula atualizada",
          description: "As alterações foram salvas com sucesso",
        });
      }

      // Salvar quiz se for tipo quiz
      if (formData.content_type === "quiz") {
        // Buscar quiz existente
        const existingQuizzes = await quizService.getQuizzesByLesson(lessonId);
        let quizId: string;
        
        if (existingQuizzes.length > 0) {
          // Atualizar quiz existente
          quizId = existingQuizzes[0].id;
          await quizService.updateQuiz(quizId, {
            ...quizData,
            titulo: quizData.titulo || formData.title,
          });
        } else {
          // Criar novo quiz - garantir valores padrão
          const newQuiz = await quizService.createQuiz({
            aula_id: lessonId,
            titulo: quizData.titulo || formData.title,
            descricao: quizData.descricao || null,
            nota_minima_aprovacao: quizData.nota_minima_aprovacao || 70,
            tentativas_maximas: quizData.tentativas_maximas || 3,
            tempo_limite_segundos: quizData.tempo_limite_segundos || null,
            modo_de_navegacao: quizData.modo_de_navegacao || 'livre',
            aleatorizar_ordem_perguntas: quizData.aleatorizar_ordem_perguntas ?? false,
            aleatorizar_ordem_alternativas: quizData.aleatorizar_ordem_alternativas ?? true,
            feedback_imediato: quizData.feedback_imediato ?? false,
            ativo: true,
          });
          quizId = newQuiz.id;
        }

        // Salvar perguntas e alternativas
        for (const pergunta of perguntas) {
          if (pergunta.id && pergunta.id.startsWith('temp-')) {
            // Nova pergunta
            const { id, alternativas, created_at, ...perguntaData } = pergunta;
            const novaPergunta = await quizService.createPergunta({
              ...perguntaData,
              quiz_id: quizId,
            });

            // Salvar alternativas
            for (const alt of alternativas) {
              const { id: altId, created_at: altCreated, ...altData } = alt;
              await quizService.createAlternativa({
                ...altData,
                pergunta_id: novaPergunta.id,
              });
            }
          } else {
            // Atualizar pergunta existente
            const { alternativas, created_at, ...perguntaData } = pergunta;
            await quizService.updatePergunta(pergunta.id, perguntaData);

            // Atualizar/criar alternativas
            for (const alt of alternativas) {
              if (alt.id.startsWith('temp-alt-')) {
                const { id: altId, created_at: altCreated, ...altData } = alt;
                await quizService.createAlternativa({
                  ...altData,
                  pergunta_id: pergunta.id,
                });
              } else {
                const { created_at: altCreated, ...altData } = alt;
                await quizService.updateAlternativa(alt.id, altData);
              }
            }
          }
        }
        
        toast({
          title: "Quiz salvo",
          description: "Quiz e perguntas foram salvos com sucesso",
        });
      }

      loadLessons();
      cancelEdit();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${title}"?`)) return;

    try {
      await lessonService.deleteLesson(id);
      toast({
        title: "Aula excluída",
        description: "A aula foi removida com sucesso",
      });
      loadLessons();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    }
  };

  const togglePublish = async (id: string, currentStatus: boolean) => {
    try {
      await lessonService.togglePublish(id, !currentStatus);
      toast({
        title: currentStatus ? "Aula despublicada" : "Aula publicada",
        description: currentStatus 
          ? "A aula não está mais visível para os alunos"
          : "A aula está agora visível para os alunos",
      });
      loadLessons();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    }
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case "composto":
        return <Layers className="h-4 w-4" />;
      case "video":
        return <Video className="h-4 w-4" />;
      case "artigo":
        return <FileText className="h-4 w-4" />;
      case "quiz":
        return <ClipboardCheck className="h-4 w-4" />;
      case "laboratorio_virtual":
        return <FlaskConical className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getContentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      composto: "Aula Composta",
      video: "Vídeo",
      artigo: "Artigo",
      quiz: "Quiz",
      laboratorio_virtual: "Lab Virtual",
    };
    return labels[type] || type;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Gerenciar Aulas
          </CardTitle>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <Select value={selectedModuleId} onValueChange={setSelectedModuleId}>
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue placeholder="Selecione um módulo" />
              </SelectTrigger>
              <SelectContent>
                {modules.map((module) => (
                  <SelectItem key={module.id} value={module.id}>
                    {module.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => startEdit()} size="sm" disabled={!selectedModuleId} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nova Aula
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing && (
          <Card className="border-primary">
            <CardContent className="pt-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Nome da aula"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Conteúdo *</Label>
                  <Select 
                    value={formData.content_type} 
                    onValueChange={(v) => setFormData({ ...formData, content_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="composto">Aula Composta (Blocos)</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                      <SelectItem value="artigo">Artigo</SelectItem>
                      <SelectItem value="quiz">Quiz</SelectItem>
                      <SelectItem value="laboratorio_virtual">Laboratório Virtual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição Curta</Label>
                <Textarea
                  value={formData.descricao_curta}
                  onChange={(e) => setFormData({ ...formData, descricao_curta: e.target.value })}
                  placeholder="Breve descrição do conteúdo"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Duração (minutos)</Label>
                <Input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </div>

              {formData.content_type === "composto" && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Blocos de Conteúdo</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPreview(true)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addBlock('video')}
                      >
                        <Video className="h-4 w-4 mr-2" />
                        Adicionar Vídeo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addBlock('text')}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Adicionar Texto
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addBlock('image')}
                      >
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Adicionar Imagem
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addBlock('lab')}
                      >
                        <FlaskConical className="h-4 w-4 mr-2" />
                        Adicionar Lab
                      </Button>
                    </div>

                    {contentBlocks.length === 0 ? (
                      <Card className="p-8 text-center">
                        <p className="text-muted-foreground">
                          Nenhum bloco adicionado. Clique nos botões acima para adicionar conteúdo.
                        </p>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        {contentBlocks
                          .sort((a, b) => a.order - b.order)
                          .map((block, index) => (
                            <LessonBlockEditor
                              key={block.id}
                              block={block}
                              onChange={(updated) => updateBlock(block.id, updated)}
                              onDelete={() => deleteBlock(block.id)}
                              onMoveUp={() => moveBlockUp(block.id)}
                              onMoveDown={() => moveBlockDown(block.id)}
                              canMoveUp={index > 0}
                              canMoveDown={index < contentBlocks.length - 1}
                              onFileChange={handleBlockFileChange}
                            />
                          ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {formData.content_type === "quiz" && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Configurações do Quiz</h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Título do Quiz</Label>
                        <Input
                          value={quizData.titulo}
                          onChange={(e) => setQuizData({ ...quizData, titulo: e.target.value })}
                          placeholder="Deixe vazio para usar o título da aula"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Nota Mínima para Aprovação (%)</Label>
                        <Input
                          type="number"
                          value={quizData.nota_minima_aprovacao}
                          onChange={(e) => setQuizData({ ...quizData, nota_minima_aprovacao: parseInt(e.target.value) || 70 })}
                          min={0}
                          max={100}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Tentativas Máximas</Label>
                        <Input
                          type="number"
                          value={quizData.tentativas_maximas}
                          onChange={(e) => setQuizData({ ...quizData, tentativas_maximas: parseInt(e.target.value) || 3 })}
                          min={1}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Tempo Limite (segundos, opcional)</Label>
                        <Input
                          type="number"
                          value={quizData.tempo_limite_segundos || ""}
                          onChange={(e) => setQuizData({ ...quizData, tempo_limite_segundos: e.target.value ? parseInt(e.target.value) : null })}
                          placeholder="Sem limite"
                          min={0}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Modo de Navegação</Label>
                        <Select
                          value={quizData.modo_de_navegacao}
                          onValueChange={(v) => setQuizData({ ...quizData, modo_de_navegacao: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="livre">Navegação Livre</SelectItem>
                            <SelectItem value="sequencial">Sequencial (não pode voltar)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Descrição do Quiz</Label>
                      <Textarea
                        value={quizData.descricao}
                        onChange={(e) => setQuizData({ ...quizData, descricao: e.target.value })}
                        placeholder="Instruções ou descrição do quiz"
                        rows={2}
                      />
                    </div>

                    <div className="flex flex-col gap-3 p-4 border rounded-lg">
                      <label className="flex items-center justify-between cursor-pointer">
                        <div>
                          <div className="font-medium">Aleatorizar Perguntas</div>
                          <div className="text-sm text-muted-foreground">Ordem das perguntas será aleatória</div>
                        </div>
                        <Switch
                          checked={quizData.aleatorizar_ordem_perguntas}
                          onCheckedChange={(checked) => setQuizData({ ...quizData, aleatorizar_ordem_perguntas: checked })}
                        />
                      </label>
                      
                      <label className="flex items-center justify-between cursor-pointer">
                        <div>
                          <div className="font-medium">Aleatorizar Alternativas</div>
                          <div className="text-sm text-muted-foreground">Ordem das respostas será aleatória</div>
                        </div>
                        <Switch
                          checked={quizData.aleatorizar_ordem_alternativas}
                          onCheckedChange={(checked) => setQuizData({ ...quizData, aleatorizar_ordem_alternativas: checked })}
                        />
                      </label>
                      
                      <label className="flex items-center justify-between cursor-pointer">
                        <div>
                          <div className="font-medium">Feedback Imediato</div>
                          <div className="text-sm text-muted-foreground">Mostrar se acertou ou errou após cada resposta</div>
                        </div>
                        <Switch
                          checked={quizData.feedback_imediato}
                          onCheckedChange={(checked) => setQuizData({ ...quizData, feedback_imediato: checked })}
                        />
                      </label>
                    </div>
                  </div>

                  <Separator />
                  
                  <QuizQuestionsEditor
                    perguntas={perguntas}
                    onChange={setPerguntas}
                  />
                </>
              )}

              {formData.content_type === "video" && (
                <>
                  <div className="space-y-2">
                    <Label>Upload de Vídeo</Label>
                    <FileUploadField
                      accept="video/*"
                      onFilesSelected={(files) => setVideoFile(files[0])}
                      label="Selecione o vídeo da aula"
                      description="Formatos: MP4, WEBM"
                      maxSize={100}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>OU URL Externa (YouTube, Vimeo, etc.)</Label>
                    <Input
                      value={formData.video_external_url}
                      onChange={(e) => setFormData({ ...formData, video_external_url: e.target.value })}
                      placeholder="https://..."
                      type="url"
                    />
                  </div>
                </>
              )}

              {formData.content_type === "artigo" && (
                <div className="space-y-2">
                  <Label>Conteúdo do Artigo</Label>
                  <Textarea
                    value={formData.conteudo_rich_text}
                    onChange={(e) => setFormData({ ...formData, conteudo_rich_text: e.target.value })}
                    placeholder="Conteúdo em HTML ou texto"
                    rows={10}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Materiais Complementares</Label>
                <FileUploadField
                  multiple
                  onFilesSelected={setAssetFiles}
                  label="PDFs, imagens, slides, etc."
                  description="Múltiplos arquivos permitidos"
                  maxSize={50}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>Publicar aula</Label>
                  <p className="text-sm text-muted-foreground">
                    Tornar visível para os alunos
                  </p>
                </div>
                <Switch
                  checked={formData.published}
                  onCheckedChange={(checked) => setFormData({ ...formData, published: checked })}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={uploading} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  {uploading ? "Salvando..." : "Salvar"}
                </Button>
                <Button onClick={cancelEdit} variant="outline" disabled={uploading}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Preview Modal */}
        <LessonPreview
          open={showPreview}
          onOpenChange={setShowPreview}
          lessonTitle={formData.title}
          lessonDescription={formData.descricao_curta}
          blocks={contentBlocks}
        />

        {!selectedModuleId ? (
          <div className="text-center py-8 text-muted-foreground">
            Selecione um módulo para gerenciar suas aulas
          </div>
        ) : lessons.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma aula cadastrada neste módulo ainda
          </div>
        ) : (
          <div className="space-y-2">
            {lessons.map((lesson, index) => (
              <Card key={lesson.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="flex-shrink-0 mt-1">
                        <Badge variant="outline" className="gap-1">
                          {getContentTypeIcon(lesson.content_type)}
                          {getContentTypeLabel(lesson.content_type)}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-muted-foreground">#{index + 1}</span>
                          <h4 className="font-medium">{lesson.title}</h4>
                          {lesson.published ? (
                            <Eye className="h-4 w-4 text-green-600" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        {lesson.descricao_curta && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {lesson.descricao_curta}
                          </p>
                        )}
                        {lesson.duration_minutes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {lesson.duration_minutes} minutos
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePublish(lesson.id, lesson.published)}
                        title={lesson.published ? "Despublicar" : "Publicar"}
                      >
                        {lesson.published ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(lesson)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(lesson.id, lesson.title)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
