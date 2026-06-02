import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react";
import { ProGeniaLogo } from "@/components/ProGeniaLogo";
import { toast } from "sonner";
import { capsulaService, Capsula } from "@/services/capsulaService";
import { gamificationService } from "@/services/gamificationService";
import { VirtualLabRenderer } from "@/components/VirtualLabRenderer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { isNativeApp } from "@/lib/capacitor";

const CapsuleViewer = () => {
  const { capsulaId } = useParams();
  const navigate = useNavigate();
  const [capsula, setCapsula] = useState<Capsula | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const { language } = useLanguage();
  const isEnglish = language === "en";

  const isValidUuid = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

  useEffect(() => {
    const loadCapsula = async () => {
      if (!capsulaId) return;

      if (!isValidUuid(capsulaId)) {
        toast.error("Link inválido. A cápsula deve ser acessada por um link correto.");
        navigate("/dashboard");
        setLoading(false);
        return;
      }

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

        try {
          const progressData = await capsulaService.getProgress(session.user.id, capsulaId);
          if (progressData) {
            setProgress(progressData.progress_percentage || 0);
          }
        } catch {
          // Falha no progresso não deve impedir exibir a cápsula
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

      const wasDone = progress === 100;

      await capsulaService.upsertProgress({
        user_id: session.user.id,
        capsula_id: capsulaId,
        progress_percentage: 100,
        status: "concluido",
        data_conclusao: new Date().toISOString(),
      });

      if (!wasDone) {
        const result = await gamificationService.onCapsuleCompleted(session.user.id, capsulaId);
        toast.success("Cápsula concluída!", {
          description: result.messages.length
            ? result.messages.join(" · ")
            : "Explore outras cápsulas para manter o ritmo de estudo.",
        });
      } else {
        toast.success("Cápsula concluída!", {
          description: "Explore outras cápsulas para manter o ritmo de estudo.",
        });
      }

      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (error: any) {
      console.error("Error completing capsula:", error);
      toast.error("Erro ao marcar cápsula como concluída");
    } finally {
      setCompleting(false);
    }
  };

  const handleQuizSubmit = async () => {
    const quiz = (capsula?.content_data as { quiz?: Array<{ correctAnswer: number }> } | undefined)?.quiz;
    if (!quiz?.length) {
      setQuizSubmitted(true);
      return;
    }

    setQuizSubmitted(true);

    const correctCount = quiz.filter(
      (_question, qIndex) => quizAnswers[qIndex] === quiz[qIndex].correctAnswer,
    ).length;

    if (correctCount !== quiz.length || !capsulaId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const result = await gamificationService.onCapsuleQuizPerfect(session.user.id, capsulaId);
      if (result.messages.length) {
        toast.success("Quiz perfeito!", {
          description: result.messages.join(" · "),
        });
      }
    } catch (error) {
      console.error("Erro ao registrar quiz perfeito:", error);
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
  const hasContent = contentData && (contentData.text || contentData.media?.length > 0 || contentData.quiz?.length > 0 || contentData.virtualLabId);
  const mediaItems = Array.isArray(contentData?.media) ? contentData.media : [];
  const orderedTokensRaw = Array.isArray(contentData?.content_order) ? contentData.content_order : [];
  const defaultOrder = [
    ...(contentData?.text ? ["text"] : []),
    ...mediaItems.map((_: any, idx: number) => `media:${idx}`),
    ...(contentData?.virtualLabId ? ["virtualLab"] : []),
    ...(Array.isArray(contentData?.quiz) && contentData.quiz.length > 0 ? ["quiz"] : []),
  ];
  const validTokens = new Set(defaultOrder);
  const orderedTokens = [
    ...orderedTokensRaw.filter((token: string) => validTokens.has(token)),
    ...defaultOrder.filter((token: string) => !orderedTokensRaw.includes(token)),
  ];

  return (
    <div className="layout-contained min-h-[100dvh] w-full overflow-x-hidden bg-background">
      {/* Navigation */}
      <nav className="safe-sticky-top border-b border-border bg-background/95 backdrop-blur">
        <div
          className={cn(
            "layout-contained mx-auto flex w-full max-w-4xl items-center justify-between gap-3 py-3 sm:py-4",
            isNativeApp ? "px-0" : "px-3 sm:px-4",
          )}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <ProGeniaLogo className="h-10 progenia-logo" />
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {capsula.duration_minutes && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{capsula.duration_minutes} min</span>
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div
        className={cn(
          "layout-contained mx-auto w-full max-w-4xl py-6 sm:py-8",
          isNativeApp ? "min-w-0 px-0" : "container px-3 sm:px-4",
        )}
      >
        {/* Header */}
        <div className="mb-8">
          <div className="inline-block px-3 py-1 bg-accent/10 text-accent text-sm rounded-full mb-4">
            Cápsula Rápida
          </div>
          <h1 className="mobile-page-title mb-4 content-break">{capsula.title}</h1>
          {capsula.description && (
            <p className="text-base sm:text-lg text-muted-foreground mb-4 content-break">{capsula.description}</p>
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
        <div className="layout-contained mb-8 min-w-0 w-full max-w-full space-y-6 overflow-x-hidden">
          {hasContent ? (
            <>
              {orderedTokens.map((token) => {
                if (token === "text" && contentData.text) {
                  return (
                    <Card key="text" className="p-6">
                      <div className="prose prose-slate dark:prose-invert max-w-none content-break">
                        <p className="whitespace-pre-wrap">{contentData.text}</p>
                      </div>
                    </Card>
                  );
                }

                if (token.startsWith("media:")) {
                  const index = Number(token.replace("media:", ""));
                  const item = mediaItems[index];
                  if (!item) return null;
                  const videoUrl = item.url;
                  const isYouTube = videoUrl && (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be"));
                  const isVimeo = videoUrl && videoUrl.includes("vimeo.com");

                  return (
                    <Card key={token} className="p-6">
                      {item.type === "image" && (
                        <img
                          src={(isEnglish ? item.url_en : null) || item.url}
                          alt={`Media ${index + 1}`}
                          className="w-full rounded-lg"
                        />
                      )}
                      {item.type === "video" && isYouTube && (() => {
                        let videoId = "";
                        if (videoUrl.includes("youtube.com/watch?v=")) {
                          videoId = videoUrl.split("v=")[1]?.split("&")[0] || "";
                        } else if (videoUrl.includes("youtu.be/")) {
                          videoId = videoUrl.split("youtu.be/")[1]?.split("?")[0] || "";
                        } else if (videoUrl.includes("youtube.com/embed/")) {
                          videoId = videoUrl.split("embed/")[1]?.split("?")[0] || "";
                        }

                        const embedUrl = `https://www.youtube.com/embed/${videoId}`;
                        return (
                          <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
                            <iframe
                              src={embedUrl}
                              title={`Vídeo ${index + 1}`}
                              className="w-full h-full"
                              allowFullScreen
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            />
                          </div>
                        );
                      })()}
                      {item.type === "video" && isVimeo && (() => {
                        const vimeoId = videoUrl.split("vimeo.com/")[1]?.split("?")[0] || "";
                        const embedUrl = `https://player.vimeo.com/video/${vimeoId}`;
                        return (
                          <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
                            <iframe
                              src={embedUrl}
                              title={`Vídeo ${index + 1}`}
                              className="w-full h-full"
                              allowFullScreen
                              allow="autoplay; fullscreen; picture-in-picture"
                            />
                          </div>
                        );
                      })()}
                      {item.type === "video" && !isYouTube && !isVimeo && (
                        <video controls className="w-full rounded-lg" preload="metadata">
                          <source src={item.url} type="video/mp4" />
                          <source src={item.url} type="video/webm" />
                          Seu navegador não suporta reprodução de vídeo.
                        </video>
                      )}
                    </Card>
                  );
                }

                if (token === "virtualLab" && contentData.virtualLabId) {
                  return (
                    <Card key="virtualLab" className="layout-contained min-w-0 w-full overflow-hidden p-0 sm:p-6">
                      <VirtualLabRenderer labId={contentData.virtualLabId} />
                    </Card>
                  );
                }

                if (token === "quiz" && contentData.quiz && contentData.quiz.length > 0) {
                  return (
                    <Card key="quiz" className="p-6">
                  <h3 className="text-xl font-semibold mb-4">Mini Quiz</h3>
                  <div className="space-y-6">
                    {contentData.quiz.map((question: any, qIndex: number) => {
                      const selectedAnswer = quizAnswers[qIndex];
                      const isCorrect = selectedAnswer === question.correctAnswer;
                      const showFeedback = quizSubmitted && selectedAnswer !== undefined;

                      return (
                        <div key={qIndex} className="space-y-3">
                          <p className="font-medium">{qIndex + 1}. {question.question}</p>
                          <div className="space-y-2 pl-4">
                            {question.options.map((option: string, oIndex: number) => {
                              const isSelected = selectedAnswer === oIndex;
                              const isCorrectOption = oIndex === question.correctAnswer;
                              
                              return (
                                <div 
                                  key={oIndex}
                                  onClick={() => !quizSubmitted && setQuizAnswers({...quizAnswers, [qIndex]: oIndex})}
                                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                                    isSelected && !quizSubmitted
                                      ? 'border-primary bg-primary/5'
                                      : showFeedback && isCorrectOption
                                      ? 'border-green-500 bg-green-50 dark:bg-green-950'
                                      : showFeedback && isSelected && !isCorrect
                                      ? 'border-red-500 bg-red-50 dark:bg-red-950'
                                      : 'border-border hover:bg-accent/5'
                                  } ${quizSubmitted ? 'cursor-default' : ''}`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="content-break">{option}</span>
                                    {showFeedback && isCorrectOption && (
                                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    )}
                                    {showFeedback && isSelected && !isCorrect && (
                                      <XCircle className="h-5 w-5 text-red-600" />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!quizSubmitted && (
                    <Button 
                      onClick={handleQuizSubmit}
                      className="mt-6 w-full"
                      disabled={Object.keys(quizAnswers).length !== contentData.quiz.length}
                    >
                      Verificar Respostas
                    </Button>
                  )}
                  {quizSubmitted && (
                    <div className="mt-6 p-4 rounded-lg bg-accent/10">
                      <p className="text-center font-medium">
                        Você acertou {Object.keys(quizAnswers).filter((key) => 
                          quizAnswers[parseInt(key)] === contentData.quiz[parseInt(key)].correctAnswer
                        ).length} de {contentData.quiz.length} questões!
                      </p>
                    </div>
                  )}
                    </Card>
                  );
                }

                return null;
              })}
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
