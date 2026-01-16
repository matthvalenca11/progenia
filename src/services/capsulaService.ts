import { supabase } from "@/integrations/supabase/client";

export interface Capsula {
  id?: string;
  title: string;
  description?: string;
  module_id?: string;
  thumbnail_url?: string;
  content_data?: any;
  is_published?: boolean;
  duration_minutes?: number;
  order_index?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CapsulaProgress {
  id?: string;
  capsula_id: string;
  user_id: string;
  progress_percentage?: number;
  status?: string;
  data_conclusao?: string;
  created_at?: string;
  updated_at?: string;
}

export const capsulaService = {
  // Get all capsulas (admin view)
  getAll: async (): Promise<Capsula[]> => {
    const { data, error } = await supabase
      .from("capsulas")
      .select("*")
      .order("order_index", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Get published capsulas only (student view)
  getPublished: async (): Promise<Capsula[]> => {
    const { data, error } = await supabase
      .from("capsulas")
      .select("*")
      .eq("is_published", true)
      .order("order_index", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Get capsulas by module
  getByModule: async (moduleId: string): Promise<Capsula[]> => {
    const { data, error } = await supabase
      .from("capsulas")
      .select("*")
      .eq("module_id", moduleId)
      .eq("is_published", true)
      .order("order_index", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Get capsula by ID
  getById: async (id: string): Promise<Capsula | null> => {
    const { data, error } = await supabase
      .from("capsulas")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  // Create capsula
  create: async (capsula: Omit<Capsula, "id" | "created_at" | "updated_at">): Promise<Capsula> => {
    const { data, error } = await supabase
      .from("capsulas")
      .insert(capsula)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update capsula
  update: async (id: string, capsula: Partial<Capsula>): Promise<Capsula> => {
    const { data, error } = await supabase
      .from("capsulas")
      .update(capsula)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete capsula
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("capsulas")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  // Get user progress for a capsula
  getProgress: async (userId: string, capsulaId: string): Promise<CapsulaProgress | null> => {
    const { data, error } = await supabase
      .from("capsula_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("capsula_id", capsulaId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  // Update or create progress
  upsertProgress: async (progress: Omit<CapsulaProgress, "id" | "created_at" | "updated_at">): Promise<CapsulaProgress> => {
    const { data, error } = await supabase
      .from("capsula_progress")
      .upsert(progress, { onConflict: "user_id,capsula_id" })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get recommended capsulas for user (not started or in progress)
  getRecommended: async (userId: string, limit: number = 3): Promise<Capsula[]> => {
    // Get all published capsulas
    const { data: allCapsulas, error: capsulaError } = await supabase
      .from("capsulas")
      .select("*")
      .eq("is_published", true)
      .order("order_index", { ascending: true });

    if (capsulaError) throw capsulaError;

    // Get user progress
    const { data: progressData, error: progressError } = await supabase
      .from("capsula_progress")
      .select("capsula_id, status")
      .eq("user_id", userId);

    if (progressError) throw progressError;

    const completedIds = new Set(
      (progressData || [])
        .filter((p) => p.status === "concluido")
        .map((p) => p.capsula_id)
    );

    // Filter out completed
    const available = (allCapsulas || [])
      .filter((c) => !completedIds.has(c.id!));

    // Embaralhar aleatoriamente
    const shuffled = [...available].sort(() => Math.random() - 0.5);

    // Retornar limit cápsulas aleatórias
    const recommended = shuffled.slice(0, limit);

    return recommended;
  },

  // Get unfinished capsula for user
  getUnfinished: async (userId: string): Promise<Capsula | null> => {
    const { data: progressData, error: progressError } = await supabase
      .from("capsula_progress")
      .select("capsula_id")
      .eq("user_id", userId)
      .eq("status", "em_progresso")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (progressError) throw progressError;
    if (!progressData) return null;

    return capsulaService.getById(progressData.capsula_id);
  },
};
