import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

export type Module = Tables<"modules">;
export type ModuleInsert = {
  title: string;
  description: string;
  category: string;
  difficulty_level: string;
  estimated_hours: number;
  order_index?: number;
  published?: boolean;
  thumbnail_url?: string;
};

export const moduleService = {
  /**
   * Listar todos os módulos publicados
   */
  async getPublishedModules() {
    const { data, error } = await supabase
      .from("modules")
      .select("*")
      .eq("published", true)
      .order("order_index", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Listar todos os módulos (admin)
   */
  async getAllModules() {
    const { data, error } = await supabase
      .from("modules")
      .select("*")
      .order("order_index", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Obter módulo por ID
   */
  async getModuleById(id: string) {
    const { data, error } = await supabase
      .from("modules")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Criar módulo
   */
  async createModule(module: ModuleInsert) {
    const { data, error } = await supabase
      .from("modules")
      .insert(module)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Atualizar módulo
   */
  async updateModule(id: string, updates: Partial<Module>) {
    const { data, error } = await supabase
      .from("modules")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Deletar módulo
   */
  async deleteModule(id: string) {
    const { error } = await supabase
      .from("modules")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  /**
   * Publicar/despublicar módulo
   */
  async togglePublish(id: string, published: boolean) {
    const { error } = await supabase
      .from("modules")
      .update({ is_published: published })
      .eq("id", id);

    if (error) throw error;
  },

  /**
   * Reordenar módulos
   */
  async reorderModules(modules: { id: string; order_index: number }[]) {
    const updates = modules.map((m) =>
      supabase
        .from("modules")
        .update({ order_index: m.order_index })
        .eq("id", m.id)
    );

    await Promise.all(updates);
  },

  /**
   * Obter estatísticas do módulo
   */
  async getModuleStats(moduleId: string) {
    // Contar aulas do módulo
    const { count: totalLessons } = await supabase
      .from("lessons")
      .select("*", { count: "exact", head: true })
      .eq("module_id", moduleId);

    // Contar aulas publicadas
    const { count: publishedLessons } = await supabase
      .from("lessons")
      .select("*", { count: "exact", head: true })
      .eq("module_id", moduleId)
      .eq("published", true);

    return {
      totalLessons: totalLessons || 0,
      publishedLessons: publishedLessons || 0,
    };
  },
};