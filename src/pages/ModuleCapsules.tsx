import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  Sparkles,
  CheckCircle2,
  PlayCircle,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

interface Capsula {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  thumbnail_url: string | null;
  order_index: number | null;
}

interface CapsulaWithProgress extends Capsula {
  progress?: {
    status: string;
    progress_percentage: number;
  };
}

export default function ModuleCapsules() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [module, setModule] = useState<any>(null);
  const [capsulas, setCapsulas] = useState<CapsulaWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (moduleId) {
      loadModuleAndCapsulas();
    }
  }, [moduleId, user, navigate]);

  const loadModuleAndCapsulas = async () => {
    try {
      // Load module
      const { data: moduleData, error: moduleError } = await supabase
        .from("modules")
        .select("*")
        .eq("id", moduleId)
        .single();

      if (moduleError) throw moduleError;
      setModule(moduleData);

      // Load capsulas for this module
      const { data: capsulasData, error: capsulasError } = await supabase
        .from("capsulas")
        .select("*")
        .eq("module_id", moduleId)
        .eq("is_published", true)
        .order("order_index", { ascending: true });

      if (capsulasError) throw capsulasError;

      // Load progress
      const capsulaIds = capsulasData?.map(c => c.id) || [];
      const { data: progressData } = await supabase
        .from("capsula_progress")
        .select("capsula_id, status, progress_percentage")
        .eq("user_id", user!.id)
        .in("capsula_id", capsulaIds);

      const progressMap = new Map(
        progressData?.map(p => [p.capsula_id, p]) || []
      );

      const capsulasWithProgress: CapsulaWithProgress[] = capsulasData?.map(capsula => ({
        ...capsula,
        progress: progressMap.get(capsula.id),
      })) || [];

      setCapsulas(capsulasWithProgress);
    } catch (error: any) {
      console.error("Erro ao carregar cápsulas:", error);
      toast.error("Erro ao carregar cápsulas", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Carregando cápsulas...</p>
        </div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Módulo não encontrado</h2>
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
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-6 w-6 text-accent" />
            <h1 className="text-4xl font-bold">Cápsulas Rápidas</h1>
          </div>
          {module.description && (
            <p className="text-lg text-muted-foreground mb-6">
              {module.description}
            </p>
          )}
        </div>

        {capsulas.length === 0 ? (
          <Card className="p-12 text-center">
            <Sparkles className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma Cápsula Disponível</h3>
            <p className="text-muted-foreground mb-4">
              As cápsulas para este módulo ainda estão sendo preparadas.
            </p>
            <Button onClick={() => navigate("/dashboard")}>
              Voltar ao Dashboard
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {capsulas.map((capsula) => {
              const isCompleted = capsula.progress?.status === "concluido";
              const isInProgress = capsula.progress?.status === "em_progresso";

              return (
                <Card
                  key={capsula.id}
                  className="overflow-hidden transition-all hover:shadow-md cursor-pointer"
                  onClick={() => navigate(`/capsula/${capsula.id}`)}
                >
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row">
                      {/* Thumbnail */}
                      <div className="aspect-video md:w-48 bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {capsula.thumbnail_url ? (
                          <img 
                            src={capsula.thumbnail_url} 
                            alt={capsula.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Sparkles className="h-12 w-12 text-muted-foreground" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-6 flex-1">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Sparkles className="h-3 w-3" />
                                Cápsula Rápida
                              </Badge>
                              {capsula.duration_minutes && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {capsula.duration_minutes} min
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-semibold text-lg mb-1">{capsula.title}</h3>
                            {capsula.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {capsula.description}
                              </p>
                            )}
                          </div>

                          {isCompleted ? (
                            <CheckCircle2 className="h-8 w-8 text-green-600 flex-shrink-0" />
                          ) : (
                            <PlayCircle className="h-8 w-8 text-primary flex-shrink-0" />
                          )}
                        </div>

                        {isInProgress && !isCompleted && (
                          <div className="mt-3">
                            <Badge variant="secondary">Em Progresso</Badge>
                          </div>
                        )}

                        {isCompleted && (
                          <div className="mt-3">
                            <Badge variant="default" className="bg-green-500">
                              Concluída
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
