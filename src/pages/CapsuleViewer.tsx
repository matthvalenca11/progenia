import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import logo from "@/assets/logo.png";
import { toast } from "sonner";
import { capsulaService, Capsula } from "@/services/capsulaService";
import { ContentBlock } from "@/components/lesson/ContentBlock";

const CapsuleViewer = () => {
  const { capsulaId } = useParams();
  const navigate = useNavigate();
  const [capsula, setCapsula] = useState<Capsula | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const loadCapsula = async () => {
      if (!capsulaId) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/auth");
          return;
        }

        const capsulaData = await capsulaService.getById(capsulaId);
        if (!capsulaData) {
          toast.error("Cápsula não encontrada");
          navigate("/dashboard");
          return;
        }

        setCapsula(capsulaData);

        // Load progress
        const progressData = await capsulaService.getProgress(session.user.id, capsulaId);
        if (progressData) {
          setProgress(progressData.progress_percentage || 0);
        }
      } catch (error: any) {
        console.error("Error loading capsula:", error);
        toast.error("Erro ao carregar cápsula");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadCapsula();
  }, [capsulaId, navigate]);

  const handleComplete = async () => {
    if (!capsulaId) return;

    try {
      setCompleting(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await capsulaService.upsertProgress({
        user_id: session.user.id,
        capsula_id: capsulaId,
        progress_percentage: 100,
        status: "concluido",
        data_conclusao: new Date().toISOString(),
      });

      toast.success("Cápsula concluída!", {
        description: "Continue explorando outras cápsulas.",
      });

      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (error: any) {
      console.error("Error completing capsula:", error);
      toast.error("Erro ao marcar cápsula como concluída");
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando cápsula...</p>
        </div>
      </div>
    );
  }

  if (!capsula) return null;

  const contentData = capsula.content_data as any;
  const hasContent = contentData && (contentData.text || contentData.media?.length > 0 || contentData.quiz?.length > 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="ProGenia" className="h-10" />
          </div>
          <div className="flex items-center gap-4">
            {capsula.duration_minutes && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{capsula.duration_minutes} min</span>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="container max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-block px-3 py-1 bg-accent/10 text-accent text-sm rounded-full mb-4">
            Cápsula Rápida
          </div>
          <h1 className="text-4xl font-bold mb-4">{capsula.title}</h1>
          {capsula.description && (
            <p className="text-xl text-muted-foreground mb-4">{capsula.description}</p>
          )}
          
          {progress > 0 && progress < 100 && (
            <Card className="p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Seu Progresso</span>
                <span className="text-sm text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </Card>
          )}

          {progress === 100 && (
            <Card className="p-4 mb-6 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Cápsula Concluída</span>
              </div>
            </Card>
          )}
        </div>

        {/* Content */}
        <div className="space-y-6 mb-8">
          {hasContent ? (
            <>
              {/* Text Content */}
              {contentData.text && (
                <Card className="p-6">
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap">{contentData.text}</p>
                  </div>
                </Card>
              )}

              {/* Media Content */}
              {contentData.media && contentData.media.map((item: any, index: number) => (
                <Card key={index} className="p-6">
                  {item.type === 'image' && (
                    <img 
                      src={item.url} 
                      alt={`Media ${index + 1}`}
                      className="w-full rounded-lg"
                    />
                  )}
                  {item.type === 'video' && (
                    <video 
                      controls 
                      className="w-full rounded-lg"
                      src={item.url}
                    />
                  )}
                </Card>
              ))}

              {/* Quiz Content */}
              {contentData.quiz && contentData.quiz.length > 0 && (
                <Card className="p-6">
                  <h3 className="text-xl font-semibold mb-4">Mini Quiz</h3>
                  <div className="space-y-6">
                    {contentData.quiz.map((question: any, qIndex: number) => (
                      <div key={qIndex} className="space-y-3">
                        <p className="font-medium">{qIndex + 1}. {question.question}</p>
                        <div className="space-y-2 pl-4">
                          {question.options.map((option: string, oIndex: number) => (
                            <div 
                              key={oIndex}
                              className="p-3 rounded-lg border border-border hover:bg-accent/5 cursor-pointer transition-colors"
                            >
                              {option}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Esta cápsula ainda não possui conteúdo.
              </p>
            </Card>
          )}
        </div>

        {/* Complete Button */}
        {progress < 100 && (
          <Card className="p-6 text-center">
            <h3 className="text-xl font-semibold mb-4">
              Parabéns por concluir esta cápsula!
            </h3>
            <Button
              size="lg"
              onClick={handleComplete}
              disabled={completing}
              className="gradient-accent text-white"
            >
              {completing ? "Marcando como concluída..." : "Marcar como Concluída"}
              <CheckCircle2 className="h-5 w-5 ml-2" />
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CapsuleViewer;
