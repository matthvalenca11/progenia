import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Search, LineChart, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { parametricChartService, ParametricChart } from "@/services/parametricChartService";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DynamicChartViewer } from "@/components/dynamic-chart";
import { toErrorMessage } from "@/lib/utils";

export default function ParametricChartsAdmin() {
  const navigate = useNavigate();
  const [charts, setCharts] = useState<ParametricChart[]>([]);
  const [filteredCharts, setFilteredCharts] = useState<ParametricChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chartToDelete, setChartToDelete] = useState<ParametricChart | null>(null);
  const [usageCount, setUsageCount] = useState<number>(0);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [chartToPreview, setChartToPreview] = useState<ParametricChart | null>(null);

  useEffect(() => {
    loadCharts();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = charts.filter(
        (chart) =>
          chart.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          chart.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          chart.description?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      setFilteredCharts(filtered);
    } else {
      setFilteredCharts(charts);
    }
  }, [searchTerm, charts]);

  const loadCharts = async () => {
    try {
      setLoading(true);
      const data = await parametricChartService.getAllCharts();
      setCharts(data);
      setFilteredCharts(data);
    } catch (error: unknown) {
      toast.error("Erro ao carregar gráficos", { description: toErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = async (chart: ParametricChart) => {
    setChartToDelete(chart);
    if (chart.id) {
      const count = await parametricChartService.getChartUsageCount(chart.id);
      setUsageCount(count);
    }
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!chartToDelete?.id) return;

    try {
      await parametricChartService.deleteChart(chartToDelete.id);
      toast.success("Gráfico excluído com sucesso!");
      loadCharts();
    } catch (error: unknown) {
      toast.error("Erro ao excluir gráfico", { description: toErrorMessage(error) });
    } finally {
      setDeleteDialogOpen(false);
      setChartToDelete(null);
      setUsageCount(0);
    }
  };

  const handleTogglePublish = async (chart: ParametricChart) => {
    if (!chart.id) return;

    try {
      await parametricChartService.updateChart(chart.id, {
        is_published: !chart.is_published,
      });
      toast.success(
        chart.is_published
          ? "Gráfico indisponível para aulas e cápsulas"
          : "Gráfico disponível para uso em aulas e cápsulas!",
      );
      loadCharts();
    } catch (error: unknown) {
      toast.error("Erro ao alterar status", { description: toErrorMessage(error) });
    }
  };

  const handlePreviewClick = (chart: ParametricChart) => {
    setChartToPreview(chart);
    setPreviewDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Carregando gráficos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          <h1 className="mobile-page-title flex items-center gap-2">
            <LineChart className="h-8 w-8" />
            Gráficos Paramétricos
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure gráficos interativos reutilizáveis em aulas e cápsulas
          </p>
        </div>
        <Button onClick={() => navigate("/admin/charts/novo")} size="lg" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Criar Novo Gráfico
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar Gráficos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Todos os Gráficos</CardTitle>
          <CardDescription>{filteredCharts.length} gráfico(s) encontrado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCharts.length === 0 ? (
            <div className="text-center py-12">
              <LineChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm
                  ? "Nenhum gráfico encontrado com esse termo"
                  : "Nenhum gráfico criado ainda"}
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => navigate("/admin/charts/novo")}
                  variant="outline"
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Gráfico
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filteredCharts.map((chart) => (
                  <Card key={chart.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-medium content-break">{chart.name}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-2 content-break">
                            {chart.config_data?.title || chart.title}
                          </p>
                        </div>
                        <Badge variant={chart.is_published ? "default" : "secondary"}>
                          {chart.is_published ? "Publicado" : "Rascunho"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => handlePreviewClick(chart)}>
                          <Eye className="h-4 w-4 mr-1" />
                          Prévia
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/charts/editar/${chart.id}`)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleTogglePublish(chart)}>
                          {chart.is_published ? (
                            <EyeOff className="h-4 w-4 mr-1" />
                          ) : (
                            <Eye className="h-4 w-4 mr-1" />
                          )}
                          {chart.is_published ? "Despublicar" : "Publicar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteClick(chart)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Título exibido</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Atualizado</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCharts.map((chart) => (
                      <TableRow key={chart.id}>
                        <TableCell className="font-medium">{chart.name}</TableCell>
                        <TableCell>{chart.config_data?.title || chart.title}</TableCell>
                        <TableCell>
                          <Badge variant={chart.is_published ? "default" : "secondary"}>
                            {chart.is_published ? "Publicado" : "Rascunho"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {chart.updated_at
                            ? format(new Date(chart.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePreviewClick(chart)}
                              title="Pré-visualizar"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/admin/charts/editar/${chart.id}`)}
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleTogglePublish(chart)}
                              title={chart.is_published ? "Despublicar" : "Publicar"}
                            >
                              {chart.is_published ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteClick(chart)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir gráfico?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{chartToDelete?.name}&quot;?
              {usageCount > 0 && (
                <span className="block mt-2 text-amber-600">
                  Este gráfico está sendo usado em {usageCount} conteúdo(s). A exclusão pode quebrar
                  essas aulas ou cápsulas.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{chartToPreview?.name}</DialogTitle>
            <DialogDescription>Pré-visualização do gráfico como o aluno verá</DialogDescription>
          </DialogHeader>
          {chartToPreview?.config_data && (
            <DynamicChartViewer config={chartToPreview.config_data} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
