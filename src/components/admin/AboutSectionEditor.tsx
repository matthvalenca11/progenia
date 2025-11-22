import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { storageService } from "@/services/storageService";
import { toast } from "sonner";
import { Upload, Trash2, ArrowUp, ArrowDown, Plus, X, Palette, Sparkles, Layout, Link as LinkIcon } from "lucide-react";

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
  theme: string;
  background_gradient: any;
  animation_type: string;
  animation_delay: number;
  spacing_top: string;
  spacing_bottom: string;
  custom_css: string | null;
  buttons: any[];
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
    { value: "hero", label: "🎯 Hero (Destaque Principal)" },
    { value: "text", label: "📝 Texto Simples" },
    { value: "text_image", label: "🖼️ Texto + Imagem" },
    { value: "text_video", label: "🎥 Texto + Vídeo" },
    { value: "features", label: "⭐ Grade de Funcionalidades" },
    { value: "stats", label: "📊 Estatísticas" },
    { value: "cta", label: "🚀 Call to Action (CTA)" },
    { value: "gallery", label: "🖼️ Galeria de Imagens" },
    { value: "timeline", label: "📅 Linha do Tempo" },
    { value: "testimonials", label: "💬 Depoimentos" },
    { value: "faq", label: "❓ FAQ (Perguntas Frequentes)" },
  ];

  const themes = [
    { value: "default", label: "Padrão (Claro)" },
    { value: "dark", label: "Escuro" },
    { value: "gradient", label: "Gradiente" },
    { value: "accent", label: "Accent (Destaque)" },
    { value: "minimal", label: "Minimalista" },
    { value: "glass", label: "Glassmorphism" },
  ];

  const animations = [
    { value: "none", label: "Sem Animação" },
    { value: "fade-in", label: "Fade In" },
    { value: "slide-up", label: "Slide Up" },
    { value: "scale-in", label: "Scale In" },
    { value: "slide-left", label: "Slide From Left" },
    { value: "slide-right", label: "Slide From Right" },
  ];

  const spacings = [
    { value: "none", label: "Nenhum" },
    { value: "sm", label: "Pequeno" },
    { value: "default", label: "Padrão" },
    { value: "lg", label: "Grande" },
    { value: "xl", label: "Extra Grande" },
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

  // Feature items management
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

  // Timeline items
  const addTimelineItem = () => {
    if (!editingSection) return;
    const items = editingSection.content_data?.timeline_items || [];
    handleContentDataUpdate("timeline_items", [
      ...items,
      { year: "", title: "", description: "" },
    ]);
  };

  const updateTimelineItem = (index: number, field: string, value: string) => {
    if (!editingSection) return;
    const items = [...(editingSection.content_data?.timeline_items || [])];
    items[index] = { ...items[index], [field]: value };
    handleContentDataUpdate("timeline_items", items);
  };

  const removeTimelineItem = (index: number) => {
    if (!editingSection) return;
    const items = editingSection.content_data?.timeline_items || [];
    handleContentDataUpdate("timeline_items", items.filter((_: any, i: number) => i !== index));
  };

  // Button management
  const addButton = () => {
    if (!editingSection) return;
    setEditingSection({
      ...editingSection,
      buttons: [...(editingSection.buttons || []), { text: "", link: "", style: "primary" }],
    });
  };

  const updateButton = (index: number, field: string, value: string) => {
    if (!editingSection) return;
    const buttons = [...(editingSection.buttons || [])];
    buttons[index] = { ...buttons[index], [field]: value };
    setEditingSection({ ...editingSection, buttons });
  };

  const removeButton = (index: number) => {
    if (!editingSection) return;
    setEditingSection({
      ...editingSection,
      buttons: editingSection.buttons.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      {editingSection ? (
        <Card>
          <CardHeader>
            <CardTitle>Editar Seção - Personalização Avançada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Accordion type="multiple" className="w-full">
              {/* Básico */}
              <AccordionItem value="basic">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Layout className="h-4 w-4" />
                    Configurações Básicas
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
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
                          <SelectItem value="default">Padrão</SelectItem>
                          <SelectItem value="left">Conteúdo à Esquerda</SelectItem>
                          <SelectItem value="right">Conteúdo à Direita</SelectItem>
                          <SelectItem value="center">Centralizado</SelectItem>
                          <SelectItem value="fullwidth">Largura Total</SelectItem>
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
                </AccordionContent>
              </AccordionItem>

              {/* Design & Tema */}
              <AccordionItem value="design">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Design & Tema
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div>
                    <Label>Tema da Seção</Label>
                    <Select
                      value={editingSection.theme}
                      onValueChange={(value) =>
                        setEditingSection({ ...editingSection, theme: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {themes.map((theme) => (
                          <SelectItem key={theme.value} value={theme.value}>
                            {theme.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Espaçamento Superior</Label>
                      <Select
                        value={editingSection.spacing_top}
                        onValueChange={(value) =>
                          setEditingSection({ ...editingSection, spacing_top: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {spacings.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Espaçamento Inferior</Label>
                      <Select
                        value={editingSection.spacing_bottom}
                        onValueChange={(value) =>
                          setEditingSection({ ...editingSection, spacing_bottom: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {spacings.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Classes CSS Customizadas (opcional)</Label>
                    <Input
                      value={editingSection.custom_css || ""}
                      onChange={(e) =>
                        setEditingSection({ ...editingSection, custom_css: e.target.value })
                      }
                      placeholder="Ex: bg-gradient-to-r from-blue-500 to-purple-600"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Animações */}
              <AccordionItem value="animations">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Animações
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Tipo de Animação</Label>
                      <Select
                        value={editingSection.animation_type}
                        onValueChange={(value) =>
                          setEditingSection({ ...editingSection, animation_type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {animations.map((anim) => (
                            <SelectItem key={anim.value} value={anim.value}>
                              {anim.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Delay (ms)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="100"
                        value={editingSection.animation_delay}
                        onChange={(e) =>
                          setEditingSection({
                            ...editingSection,
                            animation_delay: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Botões/CTAs */}
              <AccordionItem value="buttons">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Botões & CTAs
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  {(editingSection.buttons || []).map((button: any, index: number) => (
                    <div key={index} className="p-4 border rounded space-y-2">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">Botão {index + 1}</span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeButton(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        placeholder="Texto do botão"
                        value={button.text}
                        onChange={(e) => updateButton(index, "text", e.target.value)}
                      />
                      <Input
                        placeholder="Link (ex: /auth ou https://...)"
                        value={button.link}
                        onChange={(e) => updateButton(index, "link", e.target.value)}
                      />
                      <Select
                        value={button.style}
                        onValueChange={(value) => updateButton(index, "style", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="primary">Primário</SelectItem>
                          <SelectItem value="secondary">Secundário</SelectItem>
                          <SelectItem value="outline">Outline</SelectItem>
                          <SelectItem value="ghost">Ghost</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  <Button variant="outline" onClick={addButton}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Botão
                  </Button>
                </AccordionContent>
              </AccordionItem>

              {/* Mídia */}
              {(editingSection.section_type === "text_image" ||
                editingSection.section_type === "text_video" ||
                editingSection.section_type === "hero") && (
                <AccordionItem value="media">
                  <AccordionTrigger>Upload de Mídia</AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <Input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleMediaUpload}
                      disabled={uploading}
                    />
                    {editingSection.media_url && (
                      <div className="relative">
                        {editingSection.media_type === "video" ? (
                          <video
                            src={editingSection.media_url}
                            controls
                            className="w-full max-h-64"
                          />
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
                            setEditingSection({
                              ...editingSection,
                              media_url: null,
                              media_type: null,
                            })
                          }
                        >
                          Remover
                        </Button>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Conteúdo Dinâmico (Features, Timeline, etc) */}
              {editingSection.section_type === "features" && (
                <AccordionItem value="features">
                  <AccordionTrigger>Funcionalidades</AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    {(editingSection.content_data?.features || []).map(
                      (feature: any, index: number) => (
                        <div key={index} className="p-4 border rounded space-y-2">
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
                            placeholder="Ícone (emoji ou nome Lucide)"
                            value={feature.icon}
                            onChange={(e) =>
                              updateFeatureItem(index, "icon", e.target.value)
                            }
                          />
                          <Input
                            placeholder="Título"
                            value={feature.title}
                            onChange={(e) =>
                              updateFeatureItem(index, "title", e.target.value)
                            }
                          />
                          <Textarea
                            placeholder="Descrição"
                            value={feature.description}
                            onChange={(e) =>
                              updateFeatureItem(index, "description", e.target.value)
                            }
                            rows={2}
                          />
                        </div>
                      )
                    )}
                    <Button variant="outline" onClick={addFeatureItem}>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Funcionalidade
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              )}

              {editingSection.section_type === "timeline" && (
                <AccordionItem value="timeline">
                  <AccordionTrigger>Linha do Tempo</AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    {(editingSection.content_data?.timeline_items || []).map(
                      (item: any, index: number) => (
                        <div key={index} className="p-4 border rounded space-y-2">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">Item {index + 1}</span>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeTimelineItem(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <Input
                            placeholder="Ano/Data"
                            value={item.year}
                            onChange={(e) =>
                              updateTimelineItem(index, "year", e.target.value)
                            }
                          />
                          <Input
                            placeholder="Título"
                            value={item.title}
                            onChange={(e) =>
                              updateTimelineItem(index, "title", e.target.value)
                            }
                          />
                          <Textarea
                            placeholder="Descrição"
                            value={item.description}
                            onChange={(e) =>
                              updateTimelineItem(index, "description", e.target.value)
                            }
                            rows={2}
                          />
                        </div>
                      )
                    )}
                    <Button variant="outline" onClick={addTimelineItem}>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Item
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>

            <div className="flex gap-2 pt-4">
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
            <Card key={section.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{section.title || "Sem título"}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs px-2 py-1 bg-primary/10 rounded">
                        {sectionTypes.find((t) => t.value === section.section_type)?.label}
                      </span>
                      <span className="text-xs px-2 py-1 bg-secondary/10 rounded">
                        {themes.find((t) => t.value === section.theme)?.label}
                      </span>
                      {section.animation_type !== "none" && (
                        <span className="text-xs px-2 py-1 bg-accent/10 rounded">
                          ✨ {animations.find((a) => a.value === section.animation_type)?.label}
                        </span>
                      )}
                    </div>
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingSection(section)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onDelete(section.id)}
                    >
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
