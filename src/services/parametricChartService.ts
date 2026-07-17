import { supabase } from "@/integrations/supabase/client";
import type { DynamicChartBlockData } from "@/types/dynamicChart";

export interface ParametricChart {
  id?: string;
  name: string;
  slug: string;
  title: string;
  description?: string;
  config_data: DynamicChartBlockData;
  thumbnail_url?: string;
  is_published?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const parametricChartService = {
  getAll: async (): Promise<ParametricChart[]> => {
    const { data, error } = await supabase
      .from("parametric_charts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as ParametricChart[];
  },

  getAllCharts: async (): Promise<ParametricChart[]> => {
    return parametricChartService.getAll();
  },

  getById: async (id: string): Promise<ParametricChart | null> => {
    const { data, error } = await supabase
      .from("parametric_charts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as ParametricChart;
  },

  getChartById: async (id: string): Promise<ParametricChart | null> => {
    return parametricChartService.getById(id);
  },

  getPublishedCharts: async (): Promise<ParametricChart[]> => {
    const { data, error } = await supabase
      .from("parametric_charts")
      .select("*")
      .eq("is_published", true)
      .order("name", { ascending: true });

    if (error) throw error;
    return (data || []) as ParametricChart[];
  },

  create: async (
    chart: Omit<ParametricChart, "id" | "created_at" | "updated_at">,
  ): Promise<ParametricChart> => {
    const { data, error } = await supabase
      .from("parametric_charts")
      .insert(chart)
      .select()
      .single();

    if (error) throw error;
    return data as ParametricChart;
  },

  createChart: async (
    chart: Omit<ParametricChart, "id" | "created_at" | "updated_at">,
  ): Promise<ParametricChart> => {
    return parametricChartService.create(chart);
  },

  update: async (id: string, chart: Partial<ParametricChart>): Promise<ParametricChart> => {
    const { data, error } = await supabase
      .from("parametric_charts")
      .update(chart)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as ParametricChart;
  },

  updateChart: async (id: string, chart: Partial<ParametricChart>): Promise<ParametricChart> => {
    return parametricChartService.update(id, chart);
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from("parametric_charts").delete().eq("id", id);
    if (error) throw error;
  },

  deleteChart: async (id: string): Promise<void> => {
    return parametricChartService.delete(id);
  },

  getChartUsageCount: async (chartId: string): Promise<number> => {
    let count = 0;

    try {
      const { data: capsulas, error: capsulasError } = await supabase
        .from("capsulas")
        .select("content_data");

      if (!capsulasError) {
        (capsulas || []).forEach((capsula: { content_data?: Record<string, unknown> }) => {
          const contentData = capsula.content_data;
          if (contentData?.chartId === chartId) count += 1;
        });
      }

      const { data: lessons, error: lessonsError } = await supabase
        .from("lessons")
        .select("content_data");

      if (!lessonsError) {
        (lessons || []).forEach((lesson: { content_data?: { blocks?: Array<{ type?: string; data?: Record<string, unknown> }> } }) => {
          const blocks = lesson.content_data?.blocks || [];
          blocks.forEach((block) => {
            if (block.type === "dynamic_chart" && block.data?.chartId === chartId) {
              count += 1;
            }
          });
        });
      }
    } catch (error) {
      console.error("Error counting chart usage:", error);
    }

    return count;
  },

  ensureUniqueSlug: async (baseSlug: string, excludeId?: string): Promise<string> => {
    const normalizedBase = parametricChartService.generateSlug(baseSlug);
    let candidate = normalizedBase;
    let i = 1;

    while (true) {
      const { data, error } = await supabase
        .from("parametric_charts")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();

      if (error) throw error;
      if (!data) return candidate;
      if (excludeId && data.id === excludeId) return candidate;

      i += 1;
      candidate = `${normalizedBase}-${i}`;
    }
  },

  generateSlug: (title: string): string => {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  },
};
