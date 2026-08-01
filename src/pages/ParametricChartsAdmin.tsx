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
import {
  Plus,
  Edit,
  Trash2,
  Search,
  LineChart,
  Eye,
  EyeOff,
  ArrowLeft,
  Copy,
  Loader2,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { parametricChartService, ParametricChart, ParametricChartUsageBreakdown } from "@/services/parametricChartService";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DynamicChartViewer } from "@/components/dynamic-chart";
import { getCategoryLabel, resolveI18nText } from "@/types/dynamicChart";
import { cn, toErrorMessage } from "@/lib/utils";

function ChartThumbnail({
  chart,
  className,
}: {
  chart: ParametricChart;
  className?: string;
}) {
  if (chart.thumbnail_url) {
    return (
      <img
        src={chart.thumbnail_url}
        alt=""
        className={cn("rounded-lg border object-cover bg-muted", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/40 text-muted-foreground",
        className,
      )}
    >
      <LineChart className="h-6 w-6 opacity-40" />
      <ImageIcon className="h-3 w-3 mt-1 opacity-30" />
    </div>
  );
}

function ChartActions({
  chart,
  duplicating,
  onPreview,
  onEdit,
  onDuplicate,
  onTogglePublish,
  onDelete,
  compact = false,
}: {
  chart: ParametricChart;
  duplicating: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  const btnSize = compact ? "sm" : "sm";
  const variant = compact ? "outline" : "ghost";

  return (
    <div className={cn("flex flex-wrap gap-1", !compact && "justify-end")}>
      <Button size={btnSize} variant={variant} onClick={onPreview} title="Pré-visualizar">
        <Eye className={cn("h-4 w-4", compact && "mr-1")} />
        {compact && "Prévia"}
      </Button>
      <Button size={btnSize} variant={variant} onClick={onEdit} title="Editar">
        <Edit className={cn("h-4 w-4", compact && "mr-1")} />
        {compact && "Editar"}
      </Button>
      <Button
        size={btnSize}
        variant={variant}
        onClick={onDuplicate}
        disabled={duplicating}
        title="Duplicar"
      >
        {duplicating ? (
          <Loader2 className={cn("h-4 w-4 animate-spin", compact && "mr-1")} />
        ) : (
          <Copy className={cn("h-4 w-4", compact && "mr-1")} />
        )}
        {compact && "Duplicar"}
      </Button>
      <Button size={btnSize} variant={variant} onClick={onTogglePublish} title={chart.is_published ? "Despublicar" : "Publicar"}>
        {chart.is_published ? (
          <EyeOff className={cn("h-4 w-4", compact && "mr-1")} />
        ) : (
          <Eye className={cn("h-4 w-4", compact && "mr-1")} />
        )}
        {compact && (chart.is_published ? "Despublicar" : "Publicar")}
      </Button>
      <Button
        size={btnSize}
        variant={compact ? "destructive" : "ghost"}
        onClick={onDelete}
        title="Excluir"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function ParametricChartsAdmin() {
  const navigate = useNavigate();
  const [charts, setCharts] = useState<ParametricChart[]>([]);
  const [filteredCharts, setFilteredCharts] = useState<ParametricChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chartToDelete, setChartToDelete] = useState<ParametricChart | null>(null);
  const [usageCount, setUsageCount] = useState<number>(0);
  const [usageBreakdown, setUsageBreakdown] = useState<ParametricChartUsageBreakdown | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [chartToPreview, setChartToPreview] = useState<ParametricChart | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  useEffect(() => {
    loadCharts();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const filtered = charts.filter(
        (chart) =>
          chart.name.toLowerCase().includes(term) ||
          chart.title.toLowerCase().includes(term) ||
          chart.description?.toLowerCase().includes(term) ||
          getCategoryLabel(chart.category).toLowerCase().includes(term),
      );
      setFilteredCharts(filtered);
    } else {
      setFilteredCharts(charts);
    }
  }, [searchTerm, charts]);

  const loadCharts = async () => {
    try {
      setLoading(true);
      const data = await parametricChartService.getAll();
      setCharts(data);
      setFilteredCharts(data);
    } catch (error: unknown) {
      toast.error("Erro ao carregar", { description: toErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = async (chart: ParametricChart) => {
    setChartToDelete(chart);
    if (chart.id) {
      const breakdown = await parametricChartService.getChartUsageBreakdown(chart.id);
      setUsageBreakdown(breakdown);
      setUsageCount(breakdown.total);
    }
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!chartToDelete?.id) return;

    try {
      await parametricChartService.delete(chartToDelete.id);
      toast.success("Gráfico excluído");
      loadCharts();
    } catch (error: unknown) {
      toast.error("Erro ao excluir", { description: toErrorMessage(error) });
    } finally {
      setDeleteDialogOpen(false);
      setChartToDelete(null);
      setUsageCount(0);
      setUsageBreakdown(null);
    }
  };

  const handleTogglePublish = async (chart: ParametricChart) => {
    if (!chart.id) return;

    try {
      await parametricChartService.update(chart.id, {
        is_published: !chart.is_published,
      });
      toast.success(
        chart.is_published
          ? "Gráfico retirado de aulas e cápsulas"
          : "Gráfico disponível em aulas e cápsulas",
      );
      loadCharts();
    } catch (error: unknown) {
      toast.error("Erro ao alterar status", { description: toErrorMessage(error) });
    }
  };

  const handleDuplicate = async (chart: ParametricChart) => {
    if (!chart.id) return;

    try {
      setDuplicatingId(chart.id);
      const copy = await parametricChartService.duplicateChart(chart.id);
      toast.success(`Duplicado: "${copy.name}"`);
      loadCharts();
    } catch (error: unknown) {
      toast.error("Erro ao duplicar", { description: toErrorMessage(error) });
    } finally {
      setDuplicatingId(null);
    }
  };

  const handlePreviewClick = (chart: ParametricChart) => {
    setChartToPreview(chart);
    setPreviewDialogOpen(true);
  };

  const displayTitle = (chart: ParametricChart) =>
    resolveI18nText(chart.config_data?.title) || chart.title;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="mobile-page-title flex items-center gap-2">
            <LineChart className="h-8 w-8" />
            Gráficos paramétricos
          </h1>
          <p className="text-muted-foreground mt-1">
            Gráficos interativos para aulas e cápsulas
          </p>
        </div>
        <Button onClick={() => navigate("/admin/charts/novo")} size="lg" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Criar gráfico
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome, categoria ou descrição"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Todos os gráficos</CardTitle>
          <CardDescription>{filteredCharts.length} resultado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCharts.length === 0 ? (
            <div className="text-center py-12">
              <LineChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm
                  ? "Nenhum resultado"
                  : "Nenhum gráfico ainda"}
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => navigate("/admin/charts/novo")}
                  variant="outline"
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar gráfico
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filteredCharts.map((chart) => (
                  <Card key={chart.id} className="overflow-hidden">
                    <div className="flex gap-0">
                      <ChartThumbnail chart={chart} className="h-auto w-24 shrink-0 rounded-none border-0 border-r" />
                      <div className="min-w-0 flex-1 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-medium content-break">{chart.name}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-2 content-break">
                              {displayTitle(chart)}
                            </p>
                            {chart.category && (
                              <Badge variant="outline" className="mt-1.5 text-[10px]">
                                {getCategoryLabel(chart.category)}
                              </Badge>
                            )}
                          </div>
                          <Badge variant={chart.is_published ? "default" : "secondary"}>
                            {chart.is_published ? "Publicado" : "Rascunho"}
                          </Badge>
                        </div>
                        <ChartActions
                          chart={chart}
                          duplicating={duplicatingId === chart.id}
                          compact
                          onPreview={() => handlePreviewClick(chart)}
                          onEdit={() => navigate(`/admin/charts/editar/${chart.id}`)}
                          onDuplicate={() => handleDuplicate(chart)}
                          onTogglePublish={() => handleTogglePublish(chart)}
                          onDelete={() => handleDeleteClick(chart)}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[72px]" />
                      <TableHead>Nome</TableHead>
                      <TableHead>Título exibido</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Atualizado</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCharts.map((chart) => (
                      <TableRow key={chart.id}>
                        <TableCell className="py-2">
                          <ChartThumbnail chart={chart} className="h-12 w-14" />
                        </TableCell>
                        <TableCell className="font-medium max-w-[180px]">
                          <span className="line-clamp-2">{chart.name}</span>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="line-clamp-2 text-muted-foreground">
                            {displayTitle(chart)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {getCategoryLabel(chart.category)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={chart.is_published ? "default" : "secondary"}>
                            {chart.is_published ? "Publicado" : "Rascunho"}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {chart.updated_at
                            ? format(new Date(chart.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <ChartActions
                            chart={chart}
                            duplicating={duplicatingId === chart.id}
                            onPreview={() => handlePreviewClick(chart)}
                            onEdit={() => navigate(`/admin/charts/editar/${chart.id}`)}
                            onDuplicate={() => handleDuplicate(chart)}
                            onTogglePublish={() => handleTogglePublish(chart)}
                            onDelete={() => handleDeleteClick(chart)}
                          />
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
              Excluir &quot;{chartToDelete?.name}&quot;?
              {usageCount > 0 && usageBreakdown && (
                <span className="block mt-2 text-amber-600 space-y-1">
                  <span className="block">
                    Em uso em {usageCount} lugar(es).
                  </span>
                  {(usageBreakdown.capsula_chart_id > 0 ||
                    usageBreakdown.lesson_chart_id > 0) && (
                    <span className="block text-sm">
                      Por ID: {usageBreakdown.capsula_chart_id} cápsula(s),{" "}
                      {usageBreakdown.lesson_chart_id} aula(s).
                    </span>
                  )}
                  {(usageBreakdown.capsula_legacy_inline > 0 ||
                    usageBreakdown.lesson_legacy_inline > 0) && (
                    <span className="block text-sm">
                      Legado inline: {usageBreakdown.capsula_legacy_inline} cápsula(s),{" "}
                      {usageBreakdown.lesson_legacy_inline} aula(s). Não quebra ao excluir, mas mantém gráficos embutidos.
                    </span>
                  )}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{chartToPreview?.name}</DialogTitle>
            <DialogDescription>Vista do aluno</DialogDescription>
          </DialogHeader>
          {chartToPreview?.config_data && (
            <DynamicChartViewer config={chartToPreview.config_data} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
