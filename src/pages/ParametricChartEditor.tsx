import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, Loader2, LineChart } from "lucide-react";
import { toast } from "sonner";
import { parametricChartService, ParametricChart } from "@/services/parametricChartService";
import { DynamicChartAdminBuilder } from "@/components/dynamic-chart";
import { buildPresetBlockData } from "@/lib/dynamicChart/presets";
import type { DynamicChartBlockData } from "@/types/dynamicChart";
import { toErrorMessage } from "@/lib/utils";

export default function ParametricChartEditor() {
  const navigate = useNavigate();
  const { chartId } = useParams();
  const isEdit = !!chartId;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [chart, setChart] = useState<{
    name: string;
    slug: string;
    title: string;
    description: string;
    is_published: boolean;
    config_data: DynamicChartBlockData;
  }>({
    name: "",
    slug: "",
    title: "",
    description: "",
    is_published: false,
    config_data: buildPresetBlockData("tens_strength_duration"),
  });

  useEffect(() => {
    if (isEdit && chartId) {
      loadChart();
    }
  }, [chartId, isEdit]);

  const loadChart = async () => {
    try {
      setLoading(true);
      const data = await parametricChartService.getById(chartId!);
      if (data) {
        setChart({
          name: data.name,
          slug: data.slug,
          title: data.title,
          description: data.description || "",
          is_published: data.is_published ?? false,
          config_data: data.config_data,
        });
      }
    } catch (error: unknown) {
      toast.error("Erro ao carregar gráfico", { description: toErrorMessage(error) });
      navigate("/admin/charts");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!chart.name.trim()) {
      toast.error("Informe um nome interno para o gráfico.");
      return;
    }

    const displayTitle = chart.config_data.title?.trim() || chart.name.trim();

    try {
      setSaving(true);
      const slug = await parametricChartService.ensureUniqueSlug(
        chart.slug || chart.name,
        isEdit ? chartId : undefined,
      );

      const payload: Omit<ParametricChart, "id" | "created_at" | "updated_at"> = {
        name: chart.name.trim(),
        slug,
        title: displayTitle,
        description: chart.description.trim() || undefined,
        config_data: {
          ...chart.config_data,
          title: displayTitle,
        },
        is_published: chart.is_published,
      };

      if (isEdit && chartId) {
        await parametricChartService.updateChart(chartId, payload);
        toast.success("Gráfico atualizado com sucesso!");
      } else {
        await parametricChartService.createChart(payload);
        toast.success("Gráfico criado com sucesso!");
      }

      navigate("/admin/charts");
    } catch (error: unknown) {
      toast.error("Erro ao salvar gráfico", { description: toErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" onClick={() => navigate("/admin/charts")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar à lista
          </Button>
          <h1 className="mobile-page-title flex items-center gap-2">
            <LineChart className="h-7 w-7" />
            {isEdit ? "Editar Gráfico Paramétrico" : "Novo Gráfico Paramétrico"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure fórmulas, sliders e feedbacks. Depois selecione este gráfico em aulas ou cápsulas.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="lg" className="w-full sm:w-auto">
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Gráfico
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
          <CardDescription>
            Nome interno para organização no admin. O título exibido ao aluno vem da configuração do gráfico.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="chart-name">Nome interno *</Label>
              <Input
                id="chart-name"
                placeholder="Ex: TENS — curva intensidade × duração"
                value={chart.name}
                onChange={(e) =>
                  setChart((prev) => ({
                    ...prev,
                    name: e.target.value,
                    slug: prev.slug || parametricChartService.generateSlug(e.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chart-slug">Slug</Label>
              <Input
                id="chart-slug"
                placeholder="tens-curva-intensidade"
                value={chart.slug}
                onChange={(e) => setChart((prev) => ({ ...prev, slug: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="chart-description">Descrição (admin)</Label>
            <Textarea
              id="chart-description"
              placeholder="Notas internas sobre o uso deste gráfico..."
              value={chart.description}
              onChange={(e) => setChart((prev) => ({ ...prev, description: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Publicado</p>
              <p className="text-sm text-muted-foreground">
                Apenas gráficos publicados aparecem ao montar aulas e cápsulas.
              </p>
            </div>
            <Switch
              checked={chart.is_published}
              onCheckedChange={(checked) =>
                setChart((prev) => ({ ...prev, is_published: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <DynamicChartAdminBuilder
        value={chart.config_data}
        onChange={(next) =>
          setChart((prev) => ({
            ...prev,
            config_data: next,
            title: next.title,
          }))
        }
      />
    </div>
  );
}
