import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { capsulaService, Capsula } from "@/services/capsulaService";
import { moduleService, Module } from "@/services/moduleService";
import { Plus, Edit, Trash2, Sparkles } from "lucide-react";

export default function CapsulasList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [capsulas, setCapsulas] = useState<Capsula[]>([]);

  useEffect(() => {
    loadModules();
  }, []);

  useEffect(() => {
    if (selectedModuleId) {
      loadCapsulas();
    }
  }, [selectedModuleId]);

  const loadModules = async () => {
    try {
      const data = await moduleService.getAllModules();
      setModules(data);
      if (data.length > 0) {
        setSelectedModuleId(data[0].id!);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar módulos",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadCapsulas = async () => {
    try {
      setLoading(true);
      const data = await capsulaService.getCapsulasByModulo(selectedModuleId);
      setCapsulas(data);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar cápsulas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (capsulaId: string) => {
    if (!confirm("Tem certeza que deseja deletar esta cápsula?")) return;

    try {
      await capsulaService.deleteCapsula(capsulaId);
      toast({ title: "Cápsula deletada com sucesso!" });
      loadCapsulas();
    } catch (error: any) {
      toast({
        title: "Erro ao deletar cápsula",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Gerenciar Cápsulas
              </CardTitle>
            </div>
            <Button onClick={() => navigate(`/admin/capsulas/novo/${selectedModuleId}`)}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Cápsula
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Módulo</label>
            <Select value={selectedModuleId} onValueChange={setSelectedModuleId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um módulo" />
              </SelectTrigger>
              <SelectContent>
                {modules.map((module) => (
                  <SelectItem key={module.id} value={module.id!}>
                    {module.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : capsulas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma cápsula criada ainda.</p>
              <p className="text-sm">Comece criando sua primeira cápsula de aprendizado!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {capsulas.map((capsula) => (
                <Card key={capsula.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{capsula.titulo}</h4>
                          {!capsula.ativo && <Badge variant="secondary">Inativa</Badge>}
                          <Badge variant="outline">{capsula.categoria}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {capsula.pergunta_gatilho}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-xs">
                            {capsula.tipo_visual === "imagem"
                              ? "Imagem"
                              : capsula.tipo_visual === "video"
                              ? "Vídeo"
                              : "Lab Virtual"}
                          </Badge>
                          <span>•</span>
                          <span>{capsula.perguntas?.length || 0} pergunta(s)</span>
                          <span>•</span>
                          <span>Ordem: {capsula.ordem}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/capsulas/editar/${capsula.id}`)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(capsula.id!)}
                        >
                          <Trash2 className="w-4 h-4" />
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
    </div>
  );
}
