import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  Video, 
  FileText, 
  FlaskConical,
  Lock,
  CheckCircle2,
  PlayCircle
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { enrollmentService } from "@/services/enrollmentService";

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  order_index: number | null;
  is_published: boolean;
  content_data: any;
}

interface LessonWithProgress extends Lesson {
  progress?: {
    status: string;
    data_conclusao: string | null;
  };
  isUnlocked: boolean;
}

export default function ModuleViewer() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [module, setModule] = useState<any>(null);
  const [lessons, setLessons] = useState<LessonWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (moduleId) {
      loadModuleAndLessons();
    }
  }, [moduleId, user, navigate]);

  const loadModuleAndLessons = async () => {
    try {
      const { data: moduleData, error: moduleError } = await supabase
        .from("modules")
        .select("*")
        .eq("id", moduleId)
        .single();

      if (moduleError) throw moduleError;
      setModule(moduleData);

      const enrolled = await enrollmentService.isEnrolled(user!.id, moduleId);
      setIsEnrolled(enrolled);

      if (!enrolled) {
        setLoading(false);
        return;
      }

      const { data: lessonsData, error: lessonsError } = await supabase
        .from("lessons")
        .select("*")
        .eq("module_id", moduleId)
        .eq("is_published", true)
        .order("order_index", { ascending: true });

      if (lessonsError) throw lessonsError;

      const { data: progressData } = await supabase
        .from("lesson_progress")
        .select("lesson_id, status, data_conclusao")
        .eq("user_id", user!.id)
        .in("lesson_id", lessonsData.map(l => l.id));

      const progressMap = new Map(
        progressData?.map(p => [p.lesson_id, p]) || []
      );

      const lessonsWithProgress: LessonWithProgress[] = lessonsData.map((lesson, index) => {
        const progress = progressMap.get(lesson.id);
        
        let isUnlocked = index === 0;
        if (index > 0) {
          const previousLesson = lessonsData[index - 1];
          const previousProgress = progressMap.get(previousLesson.id);
          isUnlocked = previousProgress?.status === "concluido";
        }

        return {
          ...lesson,
          progress,
          isUnlocked,
        };
      });

      setLessons(lessonsWithProgress);
    } catch (error: any) {
      console.error("Erro ao carregar módulo:", error);
      toast.error("Erro ao carregar módulo", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLessonClick = (lesson: LessonWithProgress) => {
    if (!lesson.isUnlocked) {
      toast.error("Aula bloqueada", {
        description: "Complete a aula anterior para desbloquear esta.",
      });
      return;
    }

    navigate(`/lesson/${lesson.id}`);
  };

  const getContentTypeIcon = (lesson: LessonWithProgress) => {
    const contentData = lesson.content_data as any || {};
    if (contentData.blocks) return <FileText className="h-5 w-5" />;
    if (contentData.videoUrl || contentData.videoStoragePath) return <Video className="h-5 w-5" />;
    if (contentData.labType) return <FlaskConical className="h-5 w-5" />;
    return <FileText className="h-5 w-5" />;
  };

  const getContentTypeLabel = (lesson: LessonWithProgress) => {
    const contentData = lesson.content_data as any || {};
    if (contentData.blocks) return "Aula Completa";
    if (contentData.videoUrl || contentData.videoStoragePath) return "Vídeo";
    if (contentData.labType) return "Laboratório Virtual";
    return "Conteúdo";
  };

  const calculateProgress = () => {
    if (lessons.length === 0) return 0;
    const completed = lessons.filter(
      (l) => l.progress?.status === "concluido"
    ).length;
    return Math.round((completed / lessons.length) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Carregando módulo...</p>
        </div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Módulo não encontrado</h2>
          <p className="text-muted-foreground mb-4">
            O módulo que você está procurando não existe ou foi removido.
          </p>
          <Button onClick={() => navigate("/dashboard")}>
            Voltar ao Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  if (!isEnrolled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold mb-2">Matrícula Necessária</h2>
          <p className="text-muted-foreground mb-4">
            Você precisa se matricular neste módulo para acessar as aulas.
          </p>
          <Button onClick={() => navigate("/dashboard")}>
            Voltar ao Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div className="flex items-center gap-3 flex-1">
              <img src={logo} alt="ProGenia" className="h-8" />
              <h1 className="text-xl font-semibold truncate">{module.title}</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">{module.title}</h1>
          {module.description && (
            <p className="text-lg text-muted-foreground mb-6">
              {module.description}
            </p>
          )}

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progresso do Módulo</span>
              <span className="text-sm text-muted-foreground">
                {lessons.filter((l) => l.progress?.status === "concluido").length} de{" "}
                {lessons.length} aulas concluídas
              </span>
            </div>
            <Progress value={calculateProgress()} className="h-2" />
          </Card>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <FlaskConical className="h-6 w-6" />
            Laboratórios Virtuais
          </h2>
          <Card className="p-6">
            <p className="text-muted-foreground">
              Os laboratórios virtuais estarão disponíveis em breve.
            </p>
          </Card>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4">Aulas</h2>
          <div className="space-y-4">
            {lessons.map((lesson, index) => {
              const isCompleted = lesson.progress?.status === "concluido";
              const isInProgress = lesson.progress?.status === "em_andamento";
              const isLocked = !lesson.isUnlocked;

              return (
                <Card
                  key={lesson.id}
                  className={`overflow-hidden transition-all hover:shadow-md ${
                    isLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                  }`}
                  onClick={() => !isLocked && handleLessonClick(lesson)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold ${
                          isCompleted
                            ? "bg-green-500/20 text-green-600"
                            : isInProgress
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : isLocked ? (
                          <Lock className="h-5 w-5" />
                        ) : (
                          index + 1
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="flex items-center gap-1">
                            {getContentTypeIcon(lesson)}
                            {getContentTypeLabel(lesson)}
                          </Badge>
                        </div>

                        <h3 className="font-semibold mb-1">{lesson.title}</h3>
                        
                        {lesson.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {lesson.description}
                          </p>
                        )}

                        {isInProgress && !isCompleted && (
                          <div className="mt-2">
                            <Badge variant="secondary">Em Andamento</Badge>
                          </div>
                        )}

                        {isCompleted && lesson.progress?.data_conclusao && (
                          <div className="mt-2">
                            <Badge variant="default" className="bg-green-500">
                              Concluída
                            </Badge>
                          </div>
                        )}
                      </div>

                      {!isLocked && (
                        <Button variant="ghost" size="icon">
                          <PlayCircle className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
