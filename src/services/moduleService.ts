import { supabase } from "@/integrations/supabase/client";

export type Module = {
  id: string;
  title: string;
  description: string;
  is_published: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type ModuleInsert = {
  title: string;
  description: string;
  order_index?: number;
  is_published?: boolean;
};

export const moduleService = {
  async getPublishedModules(): Promise<Module[]> {
    const { data, error } = await supabase
      .from("modules")
      .select("*")
      .eq("is_published", true)
      .order("order_index", { ascending: true });

    if (error) throw error;
    return (data || []) as Module[];
  },

  async getAllModules(): Promise<Module[]> {
    const { data, error } = await supabase
      .from("modules")
      .select("*")
      .order("order_index", { ascending: true });

    if (error) throw error;
    return (data || []) as Module[];
  },

  async getModuleById(id: string): Promise<Module | null> {
    const { data, error } = await supabase
      .from("modules")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data as Module;
  },

  async createModule(module: ModuleInsert): Promise<Module> {
    const { data, error } = await supabase
      .from("modules")
      .insert(module)
      .select()
      .single();

    if (error) throw error;
    return data as Module;
  },

  async updateModule(id: string, updates: Partial<Module>): Promise<Module> {
    const { data, error } = await supabase
      .from("modules")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as Module;
  },

  async deleteModule(id: string): Promise<void> {
    const { error } = await supabase
      .from("modules")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async togglePublish(id: string, published: boolean): Promise<void> {
    const { error } = await supabase
      .from("modules")
      .update({ is_published: published })
      .eq("id", id);

    if (error) throw error;
  },

  async reorderModules(modules: { id: string; order_index: number }[]): Promise<void> {
    const updates = modules.map((m) =>
      supabase
        .from("modules")
        .update({ order_index: m.order_index })
        .eq("id", m.id)
    );

    await Promise.all(updates);
  },

  async getModuleStats(moduleId: string): Promise<{ totalLessons: number; publishedLessons: number }> {
    const { count: totalLessons } = await supabase
      .from("lessons")
      .select("*", { count: "exact", head: true })
      .eq("module_id", moduleId);

    const { count: publishedLessons } = await supabase
      .from("lessons")
      .select("*", { count: "exact", head: true })
      .eq("module_id", moduleId)
      .eq("is_published", true);

    return {
      totalLessons: totalLessons || 0,
      publishedLessons: publishedLessons || 0,
    };
  },
};
