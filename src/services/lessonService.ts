import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

export type Lesson = Tables<"lessons">;
export type LessonInsert = {
  module_id: string;
  title: string;
  content_type: string;
  descricao_curta?: string;
  duration_minutes?: number;
  video_url?: string;
  content_url?: string;
  content_data?: any;
  recursos?: any;
  order_index?: number;
  published?: boolean;
};

export const lessonService = {
  /**
   * Listar aulas de um módulo (publicadas)
   */
  async getLessonsByModule(moduleId: string) {
    const { data, error } = await supabase
      .from("lessons")
      .select("*")
      .eq("module_id", moduleId)
      .eq("published", true)
      .order("order_index", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Listar todas as aulas de um módulo (admin)
   */
  async getAllLessonsByModule(moduleId: string) {
    const { data, error } = await supabase
      .from("lessons")
      .select("*")
      .eq("module_id", moduleId)
      .order("order_index", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Listar todas as aulas (admin)
   */
  async getAllLessons() {
    const { data, error } = await supabase
      .from("lessons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Obter aula por ID
   */
  async getLessonById(id: string) {
    const { data, error } = await supabase
      .from("lessons")
      .select("*, modules(*)")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Criar aula
   */
  async createLesson(lesson: LessonInsert) {
    const { data, error } = await supabase
      .from("lessons")
      .insert(lesson)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Atualizar aula
   */
  async updateLesson(id: string, updates: Partial<Lesson>) {
    const { data, error } = await supabase
      .from("lessons")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Deletar aula
   */
  async deleteLesson(id: string) {
    const { error } = await supabase
      .from("lessons")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  /**
   * Publicar/despublicar aula
   */
  async togglePublish(id: string, published: boolean) {
    const { error } = await supabase
      .from("lessons")
      .update({ published })
      .eq("id", id);

    if (error) throw error;
  },

  /**
   * Reordenar aulas
   */
  async reorderLessons(lessons: { id: string; order_index: number }[]) {
    const updates = lessons.map((l) =>
      supabase
        .from("lessons")
        .update({ order_index: l.order_index })
        .eq("id", l.id)
    );

    await Promise.all(updates);
  },

  /**
   * Obter laboratório virtual da aula
   */
  async getVirtualLab(lessonId: string) {
    const { data, error } = await supabase
      .from("virtual_labs")
      .select("*")
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Criar/atualizar laboratório virtual
   */
  async upsertVirtualLab(lessonId: string, labType: string, config: any) {
    const { data, error } = await supabase
      .from("virtual_labs")
      .upsert({
        lesson_id: lessonId,
        lab_type: labType,
        config_data: config,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};