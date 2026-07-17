import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2 } from "lucide-react";
import {
  YOUTUBE_URL_HINT,
  YOUTUBE_URL_PLACEHOLDER,
  getYouTubeThumbnailUrl,
  getYouTubeVideoId,
} from "@/lib/youtube";
import type {
  CompletionSuggestionCount,
  CompletionSuggestionItem,
  CompletionSuggestionsConfig,
} from "@/types/completionSuggestions";

type ResourceOption = {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  subtitle?: string | null;
};

interface CompletionSuggestionsEditorProps {
  value: CompletionSuggestionsConfig;
  onChange: (value: CompletionSuggestionsConfig) => void;
  excludeCapsuleId?: string;
  excludeLessonId?: string;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const emptyItem = (): CompletionSuggestionItem => ({
  id: generateId(),
  type: "capsule",
  title: "",
});

export function CompletionSuggestionsEditor({
  value,
  onChange,
  excludeCapsuleId,
  excludeLessonId,
}: CompletionSuggestionsEditorProps) {
  const [capsules, setCapsules] = useState<ResourceOption[]>([]);
  const [lessons, setLessons] = useState<ResourceOption[]>([]);

  useEffect(() => {
    const loadResources = async () => {
      const [{ data: capsulaRows }, { data: lessonRows }] = await Promise.all([
        supabase
          .from("capsulas")
          .select("id, title, description, thumbnail_url")
          .order("title"),
        supabase
          .from("lessons")
          .select("id, title, description, content_data")
          .order("title"),
      ]);

      setCapsules(
        (capsulaRows || [])
          .filter((row) => row.id !== excludeCapsuleId)
          .map((row) => ({
            id: row.id,
            title: row.title,
            subtitle: row.description,
            thumbnailUrl: row.thumbnail_url,
          })),
      );

      setLessons(
        (lessonRows || [])
          .filter((row) => row.id !== excludeLessonId)
          .map((row) => {
            const content = (row.content_data || {}) as {
              thumbnail?: string;
              thumbnail_en?: string;
            };
            return {
              id: row.id,
              title: row.title,
              subtitle: row.description,
              thumbnailUrl: content.thumbnail || content.thumbnail_en || null,
            };
          }),
      );
    };

    loadResources();
  }, [excludeCapsuleId, excludeLessonId]);

  const maxItems = value.count;
  const canAddMore = value.items.length < maxItems;

  const updateConfig = (patch: Partial<CompletionSuggestionsConfig>) => {
    onChange({ ...value, ...patch });
  };

  const updateItem = (id: string, patch: Partial<CompletionSuggestionItem>) => {
    updateConfig({
      items: value.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  const removeItem = (id: string) => {
    updateConfig({ items: value.items.filter((item) => item.id !== id) });
  };

  const addItem = () => {
    if (!canAddMore) return;
    updateConfig({ items: [...value.items, emptyItem()] });
  };

  const handleCountChange = (count: CompletionSuggestionCount) => {
    updateConfig({
      count,
      items: value.items.slice(0, count),
    });
  };

  const handleResourcePick = (
    itemId: string,
    type: "capsule" | "lesson",
    resourceId: string,
  ) => {
    const resource =
      type === "capsule"
        ? capsules.find((row) => row.id === resourceId)
        : lessons.find((row) => row.id === resourceId);

    if (!resource) return;

    updateItem(itemId, {
      type,
      resourceId,
      title: resource.title,
      subtitle: resource.subtitle || undefined,
      thumbnailUrl: resource.thumbnailUrl || undefined,
      url: undefined,
    });
  };

  const handleYoutubeUrlChange = (itemId: string, url: string) => {
    const videoId = getYouTubeVideoId(url);
    updateItem(itemId, {
      type: "youtube",
      url,
      resourceId: undefined,
      thumbnailUrl: videoId ? getYouTubeThumbnailUrl(videoId) : undefined,
    });
  };

  const previewGridClass = useMemo(() => {
    if (value.count === 3) return "grid grid-cols-3 grid-rows-2 gap-1 h-28";
    if (value.count === 6) return "grid grid-cols-3 grid-rows-2 gap-1 h-28";
    return "grid grid-cols-3 grid-rows-3 gap-1 h-36";
  }, [value.count]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div>
          <Label htmlFor="completion-suggestions-enabled" className="text-base">
            Sugestões ao concluir
          </Label>
          <p className="text-sm text-muted-foreground">
            Exibe um mosaico de conteúdos relacionados quando o aluno marca como concluído.
          </p>
        </div>
        <Switch
          id="completion-suggestions-enabled"
          checked={value.enabled}
          onCheckedChange={(enabled) => updateConfig({ enabled })}
        />
      </div>

      {value.enabled && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Quantidade de sugestões</Label>
              <Select
                value={String(value.count)}
                onValueChange={(next) => handleCountChange(Number(next) as CompletionSuggestionCount)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 conteúdos</SelectItem>
                  <SelectItem value="6">6 conteúdos</SelectItem>
                  <SelectItem value="9">9 conteúdos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Prévia do mosaico</Label>
              <div className={previewGridClass}>
                {Array.from({ length: value.count }).map((_, index) => (
                  <div
                    key={index}
                    className={
                      value.count === 3 && index === 0
                        ? "col-span-2 row-span-2 rounded bg-muted"
                        : "rounded bg-muted/70"
                    }
                  />
                ))}
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Itens sugeridos</h4>
              <p className="text-sm text-muted-foreground">
                Configure até {maxItems} boxes (cápsulas, aulas, YouTube ou artigos).
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={!canAddMore}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </div>

          <div className="space-y-3">
            {value.items.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma sugestão adicionada ainda.
              </div>
            )}

            {value.items.map((item, index) => (
              <Card key={item.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-medium">Sugestão {index + 1}</CardTitle>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={item.type}
                      onValueChange={(type) =>
                        updateItem(item.id, {
                          type: type as CompletionSuggestionItem["type"],
                          resourceId: undefined,
                          url: undefined,
                          title: "",
                          subtitle: undefined,
                          thumbnailUrl: undefined,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="capsule">Cápsula</SelectItem>
                        <SelectItem value="lesson">Aula</SelectItem>
                        <SelectItem value="youtube">Vídeo do YouTube</SelectItem>
                        <SelectItem value="paper">Artigo / Paper</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(item.type === "capsule" || item.type === "lesson") && (
                    <div>
                      <Label>{item.type === "capsule" ? "Cápsula" : "Aula"}</Label>
                      <Select
                        value={item.resourceId || "none"}
                        onValueChange={(resourceId) => {
                          if (resourceId === "none") {
                            updateItem(item.id, { resourceId: undefined, title: "" });
                            return;
                          }
                          handleResourcePick(item.id, item.type as "capsule" | "lesson", resourceId);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Selecione...</SelectItem>
                          {(item.type === "capsule" ? capsules : lessons).map((resource) => (
                            <SelectItem key={resource.id} value={resource.id}>
                              {resource.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {item.type === "youtube" && (
                    <div>
                      <Label>Link do YouTube</Label>
                      <Input
                        value={item.url || ""}
                        onChange={(e) => handleYoutubeUrlChange(item.id, e.target.value)}
                        placeholder={YOUTUBE_URL_PLACEHOLDER}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">{YOUTUBE_URL_HINT}</p>
                    </div>
                  )}

                  {item.type === "paper" && (
                    <div>
                      <Label>Link do artigo</Label>
                      <Input
                        value={item.url || ""}
                        onChange={(e) => updateItem(item.id, { url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  )}

                  <div>
                    <Label>Título exibido</Label>
                    <Input
                      value={item.title}
                      onChange={(e) => updateItem(item.id, { title: e.target.value })}
                      placeholder="Título da sugestão"
                    />
                  </div>

                  <div>
                    <Label>Subtítulo (opcional)</Label>
                    <Textarea
                      value={item.subtitle || ""}
                      onChange={(e) => updateItem(item.id, { subtitle: e.target.value })}
                      placeholder="Breve descrição"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>Thumbnail (opcional)</Label>
                    <Input
                      value={item.thumbnailUrl || ""}
                      onChange={(e) => updateItem(item.id, { thumbnailUrl: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
