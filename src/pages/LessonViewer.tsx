import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { lessonService } from "@/services/lessonService";
import { progressService } from "@/services/progressService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, FileText, Video, CheckCircle2, ExternalLink, Beaker, Image as ImageIcon, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { VirtualLabRenderer } from "@/components/VirtualLabRenderer";
export default function LessonViewer() {
  const {
    lessonId
  } = useParams();
  const navigate = useNavigate();
  const {
    user,
    loading: authLoading
  } = useAuth();
  const [lesson, setLesson] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nextLesson, setNextLesson] = useState<any>(null);
  const [showNextLessonDialog, setShowNextLessonDialog] = useState(false);
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (lessonId && user) {
      loadLesson();
      loadProgress();
    }
  }, [lessonId, user, authLoading, navigate]);
  const loadLesson = async () => {
    try {
      const data = await lessonService.getLessonById(lessonId!);
      setLesson(data);

      // Buscar próxima aula do módulo
      if (data.module_id) {
        const { data: lessons } = await supabase
          .from("lessons")
          .select("*")
          .eq("module_id", data.module_id)
          .eq("is_published", true)
          .order("order_index", { ascending: true });

        if (lessons && lessons.length > 0) {
          const currentIndex = lessons.findIndex(l => l.id === lessonId);
          if (currentIndex >= 0 && currentIndex < lessons.length - 1) {
            setNextLesson(lessons[currentIndex + 1]);
          }
        }
      }
    } catch (error: any) {
      console.error("Erro ao carregar aula:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar a aula"
      });
    } finally {
      setLoading(false);
    }
  };
  const loadProgress = async () => {
    try {
      const data = await progressService.getLessonProgress(user!.id, lessonId!);
      setProgress(data);

      // Se não iniciou ainda, marcar como iniciada
      if (!data) {
        await progressService.startLesson(user!.id, lessonId!);
        loadProgress();
      }
    } catch (error) {
      console.error("Erro ao carregar progresso:", error);
    }
  };
  const handleComplete = async () => {
    if (!user || !lessonId) return;
    try {
      await progressService.completeLesson(user.id, lessonId);
      toast({
        title: "Aula concluída!",
        description: "Você ganhou pontos por completar esta aula"
      });
      await loadProgress();
      
      // Mostrar diálogo de próxima aula se houver
      if (nextLesson) {
        setShowNextLessonDialog(true);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Não foi possível concluir a aula"
      });
    }
  };
  if (loading) {
    return <div className="container mx-auto py-8">
        <div className="text-center">Carregando aula...</div>
      </div>;
  }
  if (!lesson) {
    return <div className="container mx-auto py-8">
        <div className="text-center">Aula não encontrada</div>
      </div>;
  }
  const isCompleted = progress?.status === "concluido";
  const contentData = lesson.content_data || {};
  const blocks = contentData.blocks || [];
  const references = contentData.references || [];
  const thumbnail = contentData.thumbnail;
  return <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/module/${lesson.module_id}`)}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Voltar ao Módulo
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>{lesson.modules?.title}</span>
          </div>
          <h1 className="text-2xl font-bold">{lesson.title}</h1>
        </div>
        {isCompleted && <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Concluída
          </Badge>}
      </div>

      {/* Thumbnail */}
      {thumbnail && (
        <Card className="overflow-hidden">
          <img src={thumbnail} alt={lesson.title} className="w-full h-64 object-cover" />
        </Card>
      )}

      {/* Sobre esta aula */}
      {lesson.description && (
        <Card>
          <CardHeader>
            <CardTitle>Sobre esta aula</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{lesson.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Conteúdo Principal */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Renderizar Blocos de Conteúdo */}
          {blocks.length > 0 ? (
            blocks
              .sort((a: any, b: any) => a.order - b.order)
              .map((block: any, index: number) => (
                <Card key={block.id || index}>
                  <CardContent className="pt-6">
                    {/* Bloco de Texto */}
                    {block.type === "text" && (
                      <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
                        {block.data.content}
                      </div>
                    )}

                    {/* Bloco de Vídeo */}
                    {block.type === "video" && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Video className="h-5 w-5" />
                          <h3 className="font-semibold">Vídeo</h3>
                        </div>
                        {block.data.url ? (
                          block.data.source === "link" ? (
                            <div className="aspect-video">
                              <iframe
                                src={block.data.url}
                                className="w-full h-full rounded-lg"
                                allowFullScreen
                              />
                            </div>
                          ) : (
                            <video controls className="w-full rounded-lg">
                              <source src={block.data.url} type="video/mp4" />
                              <source src={block.data.url} type="video/webm" />
                              <source src={block.data.url} type="video/ogg" />
                              Seu navegador não suporta vídeo HTML5.
                            </video>
                          )
                        ) : (
                          <div className="aspect-video flex items-center justify-center bg-muted rounded-lg">
                            <p className="text-muted-foreground">Vídeo não disponível</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bloco de Imagem */}
                    {block.type === "image" && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <ImageIcon className="h-5 w-5" />
                          <h3 className="font-semibold">Imagem</h3>
                        </div>
                        {block.data.url ? (
                          <img
                            src={block.data.url}
                            alt="Conteúdo da aula"
                            className="w-full rounded-lg"
                          />
                        ) : (
                          <div className="aspect-video flex items-center justify-center bg-muted rounded-lg">
                            <p className="text-muted-foreground">Imagem não disponível</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bloco de Lab Virtual */}
                    {block.type === "virtualLab" && block.data.labId && (
                      <Card>
                        <CardContent className="pt-6">
                          <VirtualLabRenderer labId={block.data.labId} />
                        </CardContent>
                      </Card>
                    )}
                  </CardContent>
                </Card>
              ))
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum conteúdo disponível ainda</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seção Aprenda Mais / Referências */}
          {references.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Aprenda Mais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {references.map((ref: any, index: number) => (
                  <a
                    key={ref.id || index}
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="font-medium mb-1">{ref.title}</h4>
                        {ref.description && (
                          <p className="text-sm text-muted-foreground">{ref.description}</p>
                        )}
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </a>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ação de Conclusão */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              {!isCompleted ? <Button onClick={handleComplete} className="w-full" size="lg">
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Marcar como concluída
                </Button> : <div className="text-center py-4">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-2" />
                  <p className="font-medium">Aula concluída!</p>
                  <p className="text-sm text-muted-foreground">
                    Continue aprendendo
                  </p>
                </div>}
            </CardContent>
          </Card>

          {/* Info da Aula */}
          {lesson.duration_minutes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Duração: <span className="font-medium text-foreground">{lesson.duration_minutes} minutos</span>
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Diálogo de Próxima Aula */}
      <Dialog open={showNextLessonDialog} onOpenChange={setShowNextLessonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Parabéns! Aula Concluída
            </DialogTitle>
            <DialogDescription>
              Você completou esta aula com sucesso. Quer continuar para a próxima?
            </DialogDescription>
          </DialogHeader>
          {nextLesson && (
            <div className="py-4">
              <div className="border rounded-lg p-4 bg-accent/50">
                <h4 className="font-semibold mb-2">Próxima Aula:</h4>
                <p className="text-sm mb-1">{nextLesson.title}</p>
                {nextLesson.description && (
                  <p className="text-xs text-muted-foreground">{nextLesson.description}</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowNextLessonDialog(false);
                navigate(`/module/${lesson.module_id}`);
              }}
            >
              Voltar ao Módulo
            </Button>
            {nextLesson && (
              <Button
                onClick={() => {
                  setShowNextLessonDialog(false);
                  navigate(`/lesson/${nextLesson.id}`);
                }}
              >
                Próxima Aula
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
}