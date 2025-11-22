import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { storageService } from "@/services/storageService";
import { toast } from "sonner";
import { Upload, Trash2, ArrowUp, ArrowDown, Plus, X } from "lucide-react";

interface AboutSection {
  id: string;
  section_type: string;
  order_index: number;
  is_published: boolean;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  media_url: string | null;
  media_type: string | null;
  content_data: any;
  layout: string;
}

interface Props {
  sections: AboutSection[];
  onUpdate: () => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
  onSave: (section: AboutSection) => void;
}

export const AboutSectionEditor = ({ sections, onUpdate, onDelete, onReorder, onSave }: Props) => {
  const [editingSection, setEditingSection] = useState<AboutSection | null>(null);
  const [uploading, setUploading] = useState(false);

  const sectionTypes = [
    { value: "hero", label: "Hero (Destaque Principal)" },
    { value: "text", label: "Texto Simples" },
    { value: "text_image", label: "Texto + Imagem" },
    { value: "text_video", label: "Texto + Vídeo" },
    { value: "features", label: "Grade de Funcionalidades" },
    { value: "stats", label: "Estatísticas" },
    { value: "cta", label: "Call to Action (CTA)" },
  ];

  const layouts = [
    { value: "default", label: "Padrão" },
    { value: "left", label: "Conteúdo à Esquerda" },
    { value: "right", label: "Conteúdo à Direita" },
    { value: "center", label: "Centralizado" },
    { value: "fullwidth", label: "Largura Total" },
  ];

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingSection) return;

    const isVideo = file.type.startsWith("video/");
    const bucket = isVideo ? "lesson-videos" : "lesson-assets";

    setUploading(true);
    try {
      const fileName = storageService.generateUniqueFileName(file.name);
      const result = await storageService.uploadFile({
        bucket,
        path: `about/${fileName}`,
        file,
      });

      const mediaUrl = storageService.getPublicUrl(bucket, result.path);
      setEditingSection({
        ...editingSection,
        media_url: mediaUrl,
        media_type: isVideo ? "video" : "image",
      });
      toast.success(`${isVideo ? "Vídeo" : "Imagem"} enviado com sucesso!`);
    } catch (error) {
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const handleContentDataUpdate = (field: string, value: any) => {
    if (!editingSection) return;
    setEditingSection({
      ...editingSection,
      content_data: {
        ...editingSection.content_data,
        [field]: value,
      },
    });
  };

  const addFeatureItem = () => {
    if (!editingSection) return;
    const features = editingSection.content_data?.features || [];
    handleContentDataUpdate("features", [
      ...features,
      { title: "", description: "", icon: "" },
    ]);
  };

  const updateFeatureItem = (index: number, field: string, value: string) => {
    if (!editingSection) return;
    const features = [...(editingSection.content_data?.features || [])];
    features[index] = { ...features[index], [field]: value };
    handleContentDataUpdate("features", features);
  };

  const removeFeatureItem = (index: number) => {
    if (!editingSection) return;
    const features = editingSection.content_data?.features || [];
    handleContentDataUpdate("features", features.filter((_: any, i: number) => i !== index));
  };

  const addStatItem = () => {
    if (!editingSection) return;
    const stats = editingSection.content_data?.stats || [];
    handleContentDataUpdate("stats", [
      ...stats,
      { icon: "", title: "", count: "", subtitle: "" },
    ]);
  };

  const updateStatItem = (index: number, field: string, value: string) => {
    if (!editingSection) return;
    const stats = [...(editingSection.content_data?.stats || [])];
    stats[index] = { ...stats[index], [field]: value };
    handleContentDataUpdate("stats", stats);
  };

  const removeStatItem = (index: number) => {
    if (!editingSection) return;
    const stats = editingSection.content_data?.stats || [];
    handleContentDataUpdate("stats", stats.filter((_: any, i: number) => i !== index));
  };

  return (
    <div className="space-y-4">
      {editingSection ? (
        <Card>
          <CardHeader>
            <CardTitle>Editar Seção</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Seção</Label>
                <Select
                  value={editingSection.section_type}
                  onValueChange={(value) =>
                    setEditingSection({ ...editingSection, section_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sectionTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Layout</Label>
                <Select
                  value={editingSection.layout}
                  onValueChange={(value) =>
                    setEditingSection({ ...editingSection, layout: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {layouts.map((layout) => (
                      <SelectItem key={layout.value} value={layout.value}>
                        {layout.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Título</Label>
              <Input
                value={editingSection.title || ""}
                onChange={(e) =>
                  setEditingSection({ ...editingSection, title: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Subtítulo</Label>
              <Input
                value={editingSection.subtitle || ""}
                onChange={(e) =>
                  setEditingSection({ ...editingSection, subtitle: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={editingSection.description || ""}
                onChange={(e) =>
                  setEditingSection({ ...editingSection, description: e.target.value })
                }
                rows={3}
              />
            </div>

            {(editingSection.section_type === "text_image" ||
              editingSection.section_type === "text_video" ||
              editingSection.section_type === "hero") && (
              <div>
                <Label>Upload de Mídia (Imagem ou Vídeo)</Label>
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleMediaUpload}
                    disabled={uploading}
                  />
                  {editingSection.media_url && (
                    <div className="relative">
                      {editingSection.media_type === "video" ? (
                        <video src={editingSection.media_url} controls className="w-full max-h-64" />
                      ) : (
                        <img
                          src={editingSection.media_url}
                          alt="Preview"
                          className="w-full max-h-64 object-cover rounded"
                        />
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() =>
                          setEditingSection({ ...editingSection, media_url: null, media_type: null })
                        }
                      >
                        Remover
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {editingSection.section_type === "features" && (
              <div>
                <Label>Funcionalidades</Label>
                {(editingSection.content_data?.features || []).map((feature: any, index: number) => (
                  <div key={index} className="mb-4 p-4 border rounded space-y-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Item {index + 1}</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeFeatureItem(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Título"
                      value={feature.title}
                      onChange={(e) => updateFeatureItem(index, "title", e.target.value)}
                    />
                    <Textarea
                      placeholder="Descrição"
                      value={feature.description}
                      onChange={(e) => updateFeatureItem(index, "description", e.target.value)}
                      rows={2}
                    />
                    <Input
                      placeholder="Ícone (emoji ou nome do ícone)"
                      value={feature.icon}
                      onChange={(e) => updateFeatureItem(index, "icon", e.target.value)}
                    />
                  </div>
                ))}
                <Button variant="outline" onClick={addFeatureItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Funcionalidade
                </Button>
              </div>
            )}

            {editingSection.section_type === "stats" && (
              <div>
                <Label>Estatísticas</Label>
                {(editingSection.content_data?.stats || []).map((stat: any, index: number) => (
                  <div key={index} className="mb-4 p-4 border rounded space-y-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Estatística {index + 1}</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeStatItem(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Ícone (emoji)"
                      value={stat.icon}
                      onChange={(e) => updateStatItem(index, "icon", e.target.value)}
                    />
                    <Input
                      placeholder="Título"
                      value={stat.title}
                      onChange={(e) => updateStatItem(index, "title", e.target.value)}
                    />
                    <Input
                      placeholder="Número (ex: 300.000+)"
                      value={stat.count}
                      onChange={(e) => updateStatItem(index, "count", e.target.value)}
                    />
                    <Input
                      placeholder="Subtítulo"
                      value={stat.subtitle}
                      onChange={(e) => updateStatItem(index, "subtitle", e.target.value)}
                    />
                  </div>
                ))}
                <Button variant="outline" onClick={addStatItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Estatística
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => onSave(editingSection)} className="flex-1">
                Salvar Seção
              </Button>
              <Button variant="outline" onClick={() => setEditingSection(null)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sections.map((section, index) => (
            <Card key={section.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{section.title || "Sem título"}</p>
                    <p className="text-sm text-muted-foreground">
                      Tipo: {sectionTypes.find((t) => t.value === section.section_type)?.label}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReorder(section.id, "up")}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReorder(section.id, "down")}
                      disabled={index === sections.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingSection(section)}>
                      Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => onDelete(section.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
