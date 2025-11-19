import { useEffect, useState } from "react";
import { moduleService } from "@/services/moduleService";
import { progressService } from "@/services/progressService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, CheckCircle2, Lock, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ModuleWithProgress {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  difficulty_level: string | null;
  thumbnail_url: string | null;
  progress: number;
  completed: number;
  total: number;
  isLocked: boolean;
  order: number;
}

export function LearningPath() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [modules, setModules] = useState<ModuleWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadLearningPath();
    }
  }, [user]);

  const loadLearningPath = async () => {
    try {
      const allModules = await moduleService.getPublishedModules();
      
      // Ordenar por dificuldade e categoria para criar uma trilha lógica
      const sorted = [...allModules].sort((a, b) => {
        const difficultyOrder = { "iniciante": 0, "intermediário": 1, "avançado": 2 };
        const diffA = difficultyOrder[a.difficulty_level as keyof typeof difficultyOrder] || 0;
        const diffB = difficultyOrder[b.difficulty_level as keyof typeof difficultyOrder] || 0;
        
        if (diffA !== diffB) return diffA - diffB;
        return (a.order_index || 0) - (b.order_index || 0);
      });

      // Carregar progresso de cada módulo
      const modulesWithProgress = await Promise.all(
        sorted.map(async (module, index) => {
          const progressData = await progressService.getModuleProgress(user!.id, module.id);
          
          // Lógica simples de "desbloqueio": primeiro módulo sempre desbloqueado,
          // demais precisam ter o anterior pelo menos 50% completo
          let isLocked = false;
          if (index > 0) {
            const prevModule = sorted[index - 1];
            const prevProgress = await progressService.getModuleProgress(user!.id, prevModule.id);
            isLocked = prevProgress.percentage < 50;
          }

          return {
            ...module,
            progress: progressData.percentage,
            completed: progressData.completed,
            total: progressData.total,
            isLocked,
            order: index + 1,
          };
        })
      );

      setModules(modulesWithProgress);
    } catch (error) {
      console.error("Erro ao carregar trilha:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (level: string | null) => {
    switch (level) {
      case "iniciante":
        return "bg-green-500";
      case "intermediário":
        return "bg-yellow-500";
      case "avançado":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getDifficultyLabel = (level: string | null) => {
    switch (level) {
      case "iniciante":
        return "Iniciante";
      case "intermediário":
        return "Intermediário";
      case "avançado":
        return "Avançado";
      default:
        return "—";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          Carregando trilha de aprendizado...
        </CardContent>
      </Card>
    );
  }

  if (modules.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum módulo disponível ainda
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Trilha de Aprendizado Sugerida
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Siga esta sequência para aproveitar melhor o conteúdo
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {modules.map((module, index) => (
          <div key={module.id} className="relative">
            {/* Linha conectora */}
            {index < modules.length - 1 && (
              <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-border" />
            )}

            <Card 
              className={`relative ${module.isLocked ? "opacity-60" : "hover:border-primary/50 transition-colors"}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Número da ordem */}
                  <div className="flex-shrink-0">
                    <div className={`
                      h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg
                      ${module.progress === 100 
                        ? "bg-green-500 text-white" 
                        : module.isLocked 
                          ? "bg-muted text-muted-foreground" 
                          : "bg-primary text-primary-foreground"
                      }
                    `}>
                      {module.progress === 100 ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : module.isLocked ? (
                        <Lock className="h-5 w-5" />
                      ) : (
                        module.order
                      )}
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-semibold">{module.title}</h3>
                        {module.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {module.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <Badge 
                          variant="secondary"
                          className={getDifficultyColor(module.difficulty_level)}
                        >
                          {getDifficultyLabel(module.difficulty_level)}
                        </Badge>
                        {module.category && (
                          <Badge variant="outline" className="text-xs">
                            {module.category}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Progresso */}
                    <div className="space-y-2 mt-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {module.completed} de {module.total} aulas
                        </span>
                        <span className="font-medium">
                          {module.progress}%
                        </span>
                      </div>
                      <Progress value={module.progress} />
                    </div>

                    {/* Ação */}
                    <div className="mt-4">
                      {module.isLocked ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Lock className="h-4 w-4" />
                          <span>Complete {Math.ceil(modules[index - 1]?.progress || 0)}% do módulo anterior</span>
                        </div>
                      ) : (
                        <Button
                          variant={module.progress > 0 ? "default" : "outline"}
                          size="sm"
                          onClick={() => navigate(`/dashboard?module=${module.id}`)}
                          className="w-full sm:w-auto"
                        >
                          {module.progress === 0 && "Começar"}
                          {module.progress > 0 && module.progress < 100 && "Continuar"}
                          {module.progress === 100 && "Revisar"}
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
