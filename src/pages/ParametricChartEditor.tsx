import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField } from "@/components/ui/FileUploadField";
import { ArrowLeft, Save, Loader2, LineChart, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { parametricChartService, ParametricChart } from "@/services/parametricChartService";
import { storageService } from "@/services/storageService";
import { DynamicChartAdminBuilder } from "@/components/dynamic-chart";
import { buildPresetBlockData } from "@/lib/dynamicChart/presets";
import type { DynamicChartBlockData, ParametricChartCategory } from "@/types/dynamicChart";
import {
  PARAMETRIC_CHART_CATEGORY_OPTIONS,
  resolveI18nText,
} from "@/types/dynamicChart";
import { IMAGE_UPLOAD_MAX_MB } from "@/lib/uploadLimits";
import { toErrorMessage } from "@/lib/utils";

type ThumbnailSource = "link" | "upload";

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
    category: ParametricChartCategory | "";
    thumbnail_url: string;
    thumbnailSource: ThumbnailSource;
    thumbnailFile: File | null;
    is_published: boolean;
    is_landing_demo: boolean;
    config_data: DynamicChartBlockData;
  }>({
    name: "",
    slug: "",
    title: "",
    description: "",
    category: "",
    thumbnail_url: "",
    thumbnailSource: "link",
    thumbnailFile: null,
    is_published: false,
    is_landing_demo: false,
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
          category: (data.category as ParametricChartCategory) || "",
          thumbnail_url: data.thumbnail_url || "",
          thumbnailSource: "link",
          thumbnailFile: null,
          is_published: data.is_published ?? false,
          is_landing_demo: data.is_landing_demo ?? false,
          config_data: data.config_data,
        });
      }
    } catch (error: unknown) {
      toast.error("Erro ao carregar", { description: toErrorMessage(error) });
      navigate("/admin/charts");
    } finally {
      setLoading(false);
    }
  };

  const uploadThumbnail = async (targetChartId: string): Promise<string | undefined> => {
    if (chart.thumbnailSource === "upload" && chart.thumbnailFile) {
      const fileName = storageService.generateUniqueFileName(chart.thumbnailFile.name);
      const path = `parametric-charts/${targetChartId}/thumbnail_${fileName}`;
      const result = await storageService.uploadFile({
        bucket: "lesson-assets",
        path,
        file: chart.thumbnailFile,
      });
      return storageService.getPublicUrl("lesson-assets", result.path);
    }
    if (chart.thumbnailSource === "link" && chart.thumbnail_url.trim()) {
      return chart.thumbnail_url.trim();
    }
    return undefined;
  };

  const handleSave = async () => {
    if (!chart.name.trim()) {
      toast.error("Informe o nome interno.");
      return;
    }

    const displayTitle = resolveI18nText(chart.config_data.title).trim() || chart.name.trim();

    try {
      setSaving(true);
      const slug = await parametricChartService.ensureUniqueSlug(
        chart.slug || chart.name,
        isEdit ? chartId : undefined,
      );

      const basePayload: Omit<ParametricChart, "id" | "created_at" | "updated_at"> = {
        name: chart.name.trim(),
        slug,
        title: displayTitle,
        description: chart.description.trim() || undefined,
        category: chart.category || null,
        config_data: {
          ...chart.config_data,
          title: displayTitle,
        },
        is_published: chart.is_published,
        is_landing_demo: chart.is_landing_demo,
      };

      if (isEdit && chartId) {
        const thumbnail_url = await uploadThumbnail(chartId);
        await parametricChartService.update(chartId, {
          ...basePayload,
          ...(thumbnail_url !== undefined ? { thumbnail_url } : {}),
        });
        toast.success("Gráfico atualizado");
      } else {
        const created = await parametricChartService.create(basePayload);
        if (created.id) {
          const thumbnail_url = await uploadThumbnail(created.id);
          if (thumbnail_url) {
            await parametricChartService.update(created.id, { thumbnail_url });
          }
        }
        toast.success("Gráfico criado");
      }

      navigate("/admin/charts");
    } catch (error: unknown) {
      toast.error("Erro ao salvar", { description: toErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const thumbnailPreview =
    chart.thumbnailFile != null
      ? URL.createObjectURL(chart.thumbnailFile)
      : chart.thumbnail_url || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 native-page-top">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" onClick={() => navigate("/admin/charts")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="mobile-page-title flex items-center gap-2">
            <LineChart className="h-7 w-7" />
            {isEdit ? "Editar gráfico paramétrico" : "Novo gráfico paramétrico"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Fórmulas, sliders e feedbacks. Depois vincule em aulas ou cápsulas.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="lg" className="w-full sm:w-auto">
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identificação admin</CardTitle>
          <CardDescription>
            Metadados internos do painel. Título e descrição ao aluno ficam no builder, aba Geral.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="chart-name">Nome interno *</Label>
              <Input
                id="chart-name"
                placeholder="Eletroterapia curva intensidade × duração"
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="chart-category">Categoria</Label>
              <Select
                value={chart.category || "none"}
                onValueChange={(value) =>
                  setChart((prev) => ({
                    ...prev,
                    category: value === "none" ? "" : (value as ParametricChartCategory),
                  }))
                }
              >
                <SelectTrigger id="chart-category">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {PARAMETRIC_CHART_CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chart-description">Notas internas</Label>
              <Textarea
                id="chart-description"
                placeholder="Uso pedagógico, módulos sugeridos, observações da equipe"
                value={chart.description}
                onChange={(e) => setChart((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Só neste painel. Descrição ao aluno fica no builder.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Thumbnail</Label>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">URL da imagem</Label>
                  <Input
                    placeholder="https://..."
                    value={chart.thumbnail_url}
                    onChange={(e) =>
                      setChart((prev) => ({
                        ...prev,
                        thumbnail_url: e.target.value,
                        thumbnailSource: "link",
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Upload</Label>
                  <FileUploadField
                    accept="image/*"
                    maxSize={IMAGE_UPLOAD_MAX_MB}
                    onFilesSelected={(files) =>
                      setChart((prev) => ({
                        ...prev,
                        thumbnailFile: files[0] ?? null,
                        thumbnailSource: "upload",
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-center">
                {thumbnailPreview ? (
                  <img
                    src={thumbnailPreview}
                    alt="Preview thumbnail"
                    className="h-32 w-48 rounded-xl border object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex h-32 w-48 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 text-muted-foreground">
                    <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                    <span className="text-xs">Sem thumbnail</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Publicado</p>
                <p className="text-sm text-muted-foreground">
                  Só gráficos publicados entram em aulas e cápsulas.
                </p>
              </div>
              <Switch
                checked={chart.is_published}
                onCheckedChange={(checked) =>
                  setChart((prev) => ({ ...prev, is_published: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Demo na landing</p>
                <p className="text-sm text-muted-foreground">
                  Candidato à landing (máx. 1 por categoria).
                </p>
              </div>
              <Switch
                checked={chart.is_landing_demo}
                onCheckedChange={(checked) =>
                  setChart((prev) => ({ ...prev, is_landing_demo: checked }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <DynamicChartAdminBuilder
        value={chart.config_data}
        onChange={(next) =>
          setChart((prev) => ({
            ...prev,
            config_data: next,
            title: resolveI18nText(next.title),
          }))
        }
      />
    </div>
  );
}
