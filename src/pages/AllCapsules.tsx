import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Clock, CheckCircle2, PlayCircle, Filter, Search } from "lucide-react";
import { toast } from "sonner";
import { capsulaService, Capsula } from "@/services/capsulaService";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.png";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Module {
  id: string;
  title: string;
}

export default function AllCapsules() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [capsulas, setCapsulas] = useState<Capsula[]>([]);
  const [loading, setLoading] = useState(true);
  const [progressMap, setProgressMap] = useState<Record<string, any>>({});
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [shuffledCapsulas, setShuffledCapsulas] = useState<Capsula[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Buscar módulos
        const { data: modulesData, error: modulesError } = await supabase
          .from("modules")
          .select("id, title")
          .eq("is_published", true)
          .order("order_index", { ascending: true });

        if (modulesError) throw modulesError;
        setModules(modulesData || []);

        // Buscar todas as cápsulas publicadas
        const allCapsulas = await capsulaService.getPublished();
        
        // Embaralhar aleatoriamente
        const shuffled = [...allCapsulas].sort(() => Math.random() - 0.5);
        setCapsulas(allCapsulas);
        setShuffledCapsulas(shuffled);

        // Buscar progresso do usuário
        if (user?.id) {
          const { data: progressData } = await supabase
            .from("capsula_progress")
            .select("capsula_id, status, progress_percentage")
            .eq("user_id", user.id);

          const progress: Record<string, any> = {};
          (progressData || []).forEach((p: any) => {
            progress[p.capsula_id] = p;
          });
          setProgressMap(progress);

          // Carregar thumbnails
          const urls: Record<string, string> = {};
          for (const capsula of allCapsulas) {
            if (capsula.thumbnail_url) {
              urls[capsula.id!] = capsula.thumbnail_url;
            }
          }
          setThumbnailUrls(urls);
        }
      } catch (error: any) {
        console.error("Erro ao carregar dados:", error);
        toast.error("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando cápsulas...</p>
        </div>
      </div>
    );
  }

  // Filtrar cápsulas por módulo e busca
  const getFilteredCapsulas = (capsulasList: Capsula[]) => {
    let filtered = capsulasList;

    // Filtrar por módulo
    if (selectedModuleId !== "all") {
      filtered = filtered.filter(c => c.module_id === selectedModuleId);
    }

    // Filtrar por busca (título ou descrição)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(c => {
        const titleMatch = c.title?.toLowerCase().includes(query);
        const descMatch = c.description?.toLowerCase().includes(query);
        return titleMatch || descMatch;
      });
    }

    return filtered;
  };

  // Usar cápsulas embaralhadas para exibição
  const displayCapsulas = shuffledCapsulas.length > 0 ? shuffledCapsulas : capsulas;
  
  // Filtrar cápsulas do módulo selecionado
  const filteredCapsulas = getFilteredCapsulas(displayCapsulas);
  
  // Outras cápsulas (apenas quando um módulo específico está selecionado e não há busca ativa)
  const otherCapsulas = selectedModuleId === "all" || searchQuery.trim()
    ? []
    : getFilteredCapsulas(displayCapsulas.filter(c => c.module_id !== selectedModuleId));

  const selectedModule = modules.find(m => m.id === selectedModuleId);

  return (
    <div className="min-h-screen bg-background">
      {/* Header fixo */}
      <div className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logo} alt="ProGenia" className="h-11 progenia-logo cursor-pointer" onClick={() => navigate("/dashboard")} />
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 text-base font-semibold"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Campo de busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar cápsulas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-[300px] text-base placeholder:font-semibold"
              />
            </div>
            
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedModuleId} onValueChange={setSelectedModuleId}>
              <SelectTrigger className="w-[200px] text-base">
                <SelectValue placeholder="Filtrar por módulo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os módulos</SelectItem>
                {modules.map((module) => (
                  <SelectItem key={module.id} value={module.id}>
                    {module.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Todas as Cápsulas</h1>
          <p className="text-muted-foreground">
            {searchQuery.trim() 
              ? `Encontradas ${filteredCapsulas.length} cápsula${filteredCapsulas.length !== 1 ? 's' : ''} para "${searchQuery}"`
              : selectedModuleId === "all" 
                ? "Explore todas as cápsulas disponíveis"
                : `Cápsulas do módulo: ${selectedModule?.title || ""}`
            }
          </p>
        </div>

        {/* Cápsulas do módulo selecionado (em destaque) */}
        {filteredCapsulas.length > 0 && (
          <div className="mb-12">
            {selectedModuleId !== "all" && (
              <h2 className="text-2xl font-bold mb-6">
                {selectedModule?.title || "Módulo Selecionado"}
              </h2>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCapsulas.map((capsula) => {
                const progress = progressMap[capsula.id!];
                const isCompleted = progress?.status === "concluido";
                const isInProgress = progress?.status === "em_progresso";

                return (
                  <Card
                    key={capsula.id}
                    className={`cursor-pointer hover:shadow-lg transition-smooth border-border bg-card hover:border-accent overflow-hidden group ${
                      selectedModuleId !== "all" ? "border-2 border-primary/50" : ""
                    }`}
                    onClick={() => navigate(`/capsula/${capsula.id}`)}
                  >
                    <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden relative">
                      {thumbnailUrls[capsula.id!] ? (
                        <img
                          src={thumbnailUrls[capsula.id!]}
                          alt={capsula.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <Sparkles className="h-12 w-12 text-muted-foreground" />
                      )}
                      {isCompleted && (
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Concluída
                          </Badge>
                        </div>
                      )}
                      {isInProgress && (
                        <div className="absolute top-2 right-2">
                          <Badge variant="secondary">
                            <PlayCircle className="h-3 w-3 mr-1" />
                            Em Progresso
                          </Badge>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-6">
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
                      <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                        {capsula.title}
                      </h3>
                      {capsula.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {capsula.description}
                        </p>
                      )}
                      <Button className="w-full" size="sm">
                        {isCompleted ? "Revisar" : isInProgress ? "Continuar" : "Conferir"}
                        <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Outras cápsulas de outros módulos */}
        {otherCapsulas.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Outras Cápsulas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherCapsulas.map((capsula) => {
                const progress = progressMap[capsula.id!];
                const isCompleted = progress?.status === "concluido";
                const isInProgress = progress?.status === "em_progresso";

                return (
                  <Card
                    key={capsula.id}
                    className="cursor-pointer hover:shadow-lg transition-smooth border-border bg-card hover:border-accent overflow-hidden group opacity-75"
                    onClick={() => navigate(`/capsula/${capsula.id}`)}
                  >
                    <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden relative">
                      {thumbnailUrls[capsula.id!] ? (
                        <img
                          src={thumbnailUrls[capsula.id!]}
                          alt={capsula.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <Sparkles className="h-12 w-12 text-muted-foreground" />
                      )}
                      {isCompleted && (
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Concluída
                          </Badge>
                        </div>
                      )}
                      {isInProgress && (
                        <div className="absolute top-2 right-2">
                          <Badge variant="secondary">
                            <PlayCircle className="h-3 w-3 mr-1" />
                            Em Progresso
                          </Badge>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-6">
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
                      <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                        {capsula.title}
                      </h3>
                      {capsula.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {capsula.description}
                        </p>
                      )}
                      <Button className="w-full" size="sm">
                        {isCompleted ? "Revisar" : isInProgress ? "Continuar" : "Conferir"}
                        <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Mensagem quando não há cápsulas */}
        {filteredCapsulas.length === 0 && otherCapsulas.length === 0 && (
          <Card className="p-12 text-center">
            <Sparkles className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma Cápsula Disponível</h3>
            <p className="text-muted-foreground">
              {selectedModuleId === "all" 
                ? "Ainda não há cápsulas publicadas."
                : "Não há cápsulas neste módulo."
              }
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
