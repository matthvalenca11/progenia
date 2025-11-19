import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { capsulaService, Capsula, CapsulaProgresso } from "@/services/capsulaService";
import { moduleService, Module } from "@/services/moduleService";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, Circle, ArrowLeft, Sparkles } from "lucide-react";

export default function CapsulasGrid() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState<Module | null>(null);
  const [capsulas, setCapsulas] = useState<Capsula[]>([]);
  const [progressoMap, setProgressoMap] = useState<Map<string, CapsulaProgresso>>(new Map());
  const [stats, setStats] = useState({ total: 0, concluidas: 0, percentual: 0 });
  const [capaUrls, setCapaUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (moduleId) {
      loadData();
    }
  }, [moduleId, user]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar módulo
      const moduleData = await moduleService.getModuleById(moduleId!);
      setModule(moduleData);

      // Carregar cápsulas
      const capsulasData = await capsulaService.getCapsulasByModulo(moduleId!);
      setCapsulas(capsulasData);

      // Carregar progresso
      if (user) {
        const progressoData = await capsulaService.getProgressoModulo(user.id, moduleId!);
        setProgressoMap(progressoData);

      // Carregar estatísticas
        const statsData = await capsulaService.calcularEstatisticasModulo(user.id, moduleId!);
        setStats(statsData);

        // Carregar URLs das capas
        const urls: Record<string, string> = {};
        for (const capsula of capsulasData) {
          if (capsula.capa_path) {
            try {
              const url = await capsulaService.getVisualUrl("imagem", capsula.capa_path);
              urls[capsula.id!] = url;
            } catch (error) {
              console.error("Erro ao carregar capa:", error);
            }
          }
        }
        setCapaUrls(urls);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCapsulaClick = (capsulaId: string) => {
    navigate(`/capsula/${capsulaId}`);
  };

  const getCategoriaColor = (categoria: string) => {
    const colors: Record<string, string> = {
      Parâmetros: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
      Física: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
      "Aplicações clínicas": "bg-green-500/10 text-green-700 dark:text-green-300",
      Técnica: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
    };
    return colors[categoria] || "bg-gray-500/10 text-gray-700 dark:text-gray-300";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Carregando cápsulas...</p>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Módulo não encontrado</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Dashboard
        </Button>

        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{module.title}</h1>
            <p className="text-muted-foreground">{module.description}</p>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            <Sparkles className="w-4 h-4 mr-2" />
            {stats.concluidas} / {stats.total}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Seu progresso</span>
            <span className="font-medium">{stats.percentual}%</span>
          </div>
          <Progress value={stats.percentual} className="h-2" />
        </div>
      </div>

      {/* Grid de Cápsulas */}
      {capsulas.length === 0 ? (
        <div className="text-center py-16">
          <Sparkles className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-muted-foreground">Nenhuma cápsula disponível ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capsulas.map((capsula) => {
            const progresso = progressoMap.get(capsula.id!);
            const concluida = progresso?.concluida || false;

            return (
              <Card
                key={capsula.id}
                className="hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden"
                onClick={() => handleCapsulaClick(capsula.id!)}
              >
                {/* Indicador de conclusão */}
                {concluida && (
                  <div className="absolute top-3 right-3 z-10">
                    <CheckCircle2 className="w-6 h-6 text-green-500 fill-green-500" />
                  </div>
                )}

                <CardContent className="p-0">
                  {/* Thumbnail/Visual com Capa */}
                  <div className="relative h-40 overflow-hidden">
                    {capaUrls[capsula.id!] ? (
                      <img
                        src={capaUrls[capsula.id!]}
                        alt={capsula.titulo}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        {capsula.tipo_visual === "lab" ? (
                          <div className="text-center">
                            <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p className="text-sm font-medium opacity-70">Lab Virtual</p>
                          </div>
                        ) : (
                          <Sparkles className="w-12 h-12 opacity-30" />
                        )}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                    <Badge className={`absolute top-3 left-3 ${getCategoriaColor(capsula.categoria)}`}>
                      {capsula.categoria}
                    </Badge>
                  </div>

                  {/* Conteúdo */}
                  <div className="p-5 space-y-3">
                    <h3 className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors">
                      {capsula.titulo}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {capsula.pergunta_gatilho}
                    </p>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {concluida ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              Concluída
                            </span>
                          </>
                        ) : (
                          <>
                            <Circle className="w-4 h-4" />
                            <span>Não iniciada</span>
                          </>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {capsula.perguntas?.length || 0} pergunta(s)
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
