import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { AboutSectionEditor } from "./AboutSectionEditor";

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

export const AboutPageBuilder = () => {
  const [sections, setSections] = useState<AboutSection[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSections();
  }, []);

  const loadSections = async () => {
    const { data, error } = await supabase
      .from("about_page_sections")
      .select("*")
      .order("order_index", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar seções");
      return;
    }

    if (data) {
      setSections(
        data.map((section) => ({
          ...section,
          buttons: (section.buttons as any) || [],
        }))
      );
    }
  };

  const handleAddSection = async () => {
    setLoading(true);
    const maxOrder = sections.length > 0 ? Math.max(...sections.map((s) => s.order_index)) : 0;

    const { error } = await supabase.from("about_page_sections").insert({
      section_type: "text",
      order_index: maxOrder + 1,
      title: "Nova Seção",
      layout: "default",
      is_published: true,
      theme: "default",
      animation_type: "fade-in",
      animation_delay: 0,
      spacing_top: "default",
      spacing_bottom: "default",
      buttons: [],
    });

    if (error) {
      toast.error("Erro ao adicionar seção");
    } else {
      toast.success("Seção adicionada!");
      loadSections();
    }
    setLoading(false);
  };

  const handleSaveSection = async (section: AboutSection) => {
    const { error } = await supabase
      .from("about_page_sections")
      .update(section)
      .eq("id", section.id);

    if (error) {
      toast.error("Erro ao salvar seção");
    } else {
      toast.success("Seção salva!");
      loadSections();
    }
  };

  const handleDeleteSection = async (id: string) => {
    const { error } = await supabase.from("about_page_sections").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao deletar seção");
    } else {
      toast.success("Seção deletada!");
      loadSections();
    }
  };

  const handleReorder = async (id: string, direction: "up" | "down") => {
    const index = sections.findIndex((s) => s.id === id);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const newSections = [...sections];
    [newSections[index], newSections[targetIndex]] = [
      newSections[targetIndex],
      newSections[index],
    ];

    // Update order_index
    const updates = newSections.map((section, idx) => ({
      id: section.id,
      order_index: idx + 1,
    }));

    for (const update of updates) {
      await supabase
        .from("about_page_sections")
        .update({ order_index: update.order_index })
        .eq("id", update.id);
    }

    loadSections();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Page Builder - Seções Dinâmicas</CardTitle>
          <Button onClick={handleAddSection} disabled={loading}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Seção
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <AboutSectionEditor
          sections={sections}
          onUpdate={loadSections}
          onDelete={handleDeleteSection}
          onReorder={handleReorder}
          onSave={handleSaveSection}
        />
      </CardContent>
    </Card>
  );
};
