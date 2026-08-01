import { supabase } from "@/integrations/supabase/client";
import { isInlineDynamicChartData } from "@/lib/dynamicChart/parametricChartValidation";
import type { DynamicChartBlockData, ParametricChartCategory } from "@/types/dynamicChart";
import { resolveI18nText } from "@/types/dynamicChart";

export interface ParametricChart {
  id?: string;
  name: string;
  slug: string;
  title: string;
  description?: string;
  category?: ParametricChartCategory | string | null;
  config_data: DynamicChartBlockData;
  thumbnail_url?: string;
  is_published?: boolean;
  is_landing_demo?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LegacyChartMigrationItem {
  source: "lesson" | "capsula";
  sourceId: string;
  chartId: string;
  slug: string;
}

export interface LegacyChartMigrationResult {
  chartsCreated: number;
  lessonsUpdated: number;
  capsulasUpdated: number;
  items: LegacyChartMigrationItem[];
  errors: string[];
}

export interface LegacyChartMigrationOptions {
  /** Quando true, apenas simula a migração sem gravar alterações. */
  dryRun?: boolean;
}

export interface ParametricChartUsageBreakdown {
  capsula_chart_id: number;
  lesson_chart_id: number;
  capsula_legacy_inline: number;
  lesson_legacy_inline: number;
  total: number;
}

const EMPTY_USAGE: ParametricChartUsageBreakdown = {
  capsula_chart_id: 0,
  lesson_chart_id: 0,
  capsula_legacy_inline: 0,
  lesson_legacy_inline: 0,
  total: 0,
};

export const parametricChartService = {
  getAll: async (): Promise<ParametricChart[]> => {
    const { data, error } = await supabase
      .from("parametric_charts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as ParametricChart[];
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

  getBySlug: async (slug: string): Promise<ParametricChart | null> => {
    const { data, error } = await supabase
      .from("parametric_charts")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error("Error getting chart by slug:", error);
      return null;
    }

    return data as ParametricChart | null;
  },

  getPublishedBySlug: async (slug: string): Promise<ParametricChart | null> => {
    const chart = await parametricChartService.getBySlug(slug);
    if (!chart?.is_published) return null;
    return chart;
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

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from("parametric_charts").delete().eq("id", id);
    if (error) throw error;
  },

  duplicateChart: async (chartId: string): Promise<ParametricChart> => {
    const source = await parametricChartService.getById(chartId);
    if (!source) {
      throw new Error("Gráfico não encontrado.");
    }

    const copyName = `Cópia de ${source.name}`;
    const slug = await parametricChartService.ensureUniqueSlug(
      parametricChartService.generateSlug(copyName),
    );

    return parametricChartService.create({
      name: copyName,
      slug,
      title: source.title,
      description: source.description,
      category: source.category ?? null,
      config_data: structuredClone(source.config_data),
      thumbnail_url: source.thumbnail_url,
      is_published: false,
      is_landing_demo: false,
    });
  },

  getChartUsageBreakdown: async (chartId: string): Promise<ParametricChartUsageBreakdown> => {
    const { data, error } = await supabase.rpc("get_parametric_chart_usage", {
      p_chart_id: chartId,
    });

    if (error) {
      console.error("Error fetching chart usage via RPC:", error);
      return parametricChartService.getChartUsageBreakdownFallback(chartId);
    }

    const row = data as Record<string, number> | null;
    if (!row) return EMPTY_USAGE;

    return {
      capsula_chart_id: row.capsula_chart_id ?? 0,
      lesson_chart_id: row.lesson_chart_id ?? 0,
      capsula_legacy_inline: row.capsula_legacy_inline ?? 0,
      lesson_legacy_inline: row.lesson_legacy_inline ?? 0,
      total: row.total ?? 0,
    };
  },

  getChartUsageCount: async (chartId: string): Promise<number> => {
    const breakdown = await parametricChartService.getChartUsageBreakdown(chartId);
    return breakdown.total;
  },

  /** Fallback client-side caso a RPC ainda não esteja aplicada no ambiente. */
  getChartUsageBreakdownFallback: async (
    chartId: string,
  ): Promise<ParametricChartUsageBreakdown> => {
    const [capsulasResult, lessonsResult] = await Promise.all([
      supabase.from("capsulas").select("content_data").not("content_data", "is", null),
      supabase.from("lessons").select("content_data").not("content_data", "is", null),
    ]);

    let capsula_chart_id = 0;
    let capsula_legacy_inline = 0;
    let lesson_chart_id = 0;
    let lesson_legacy_inline = 0;

    if (!capsulasResult.error) {
      for (const capsula of capsulasResult.data ?? []) {
        const contentData = capsula.content_data as Record<string, unknown> | null;
        if (!contentData) continue;
        if (contentData.chartId === chartId) capsula_chart_id += 1;
        if (contentData.dynamic_chart && !contentData.chartId) capsula_legacy_inline += 1;
      }
    }

    if (!lessonsResult.error) {
      for (const lesson of lessonsResult.data ?? []) {
        const contentData = lesson.content_data as {
          blocks?: Array<{ type?: string; data?: Record<string, unknown> }>;
        } | null;
        const blocks = contentData?.blocks ?? [];
        for (const block of blocks) {
          if (block.type !== "dynamic_chart" || !block.data) continue;
          const refChartId = block.data.chartId;
          if (refChartId === chartId) {
            lesson_chart_id += 1;
            continue;
          }
          if (!refChartId && typeof block.data.source_type === "string") {
            lesson_legacy_inline += 1;
          }
        }
      }
    }

    const total =
      capsula_chart_id + lesson_chart_id + capsula_legacy_inline + lesson_legacy_inline;

    return {
      capsula_chart_id,
      lesson_chart_id,
      capsula_legacy_inline,
      lesson_legacy_inline,
      total,
    };
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

  /**
   * Varre aulas e cápsulas com config inline `dynamic_chart`, cria entidades em
   * `parametric_charts` e substitui o JSON por referência `{ chartId }`.
   * Requer sessão admin (RLS).
   */
  migrateLegacyInlineCharts: async (
    options: LegacyChartMigrationOptions = {},
  ): Promise<LegacyChartMigrationResult> => {
    const { dryRun = false } = options;
    const result: LegacyChartMigrationResult = {
      chartsCreated: 0,
      lessonsUpdated: 0,
      capsulasUpdated: 0,
      items: [],
      errors: [],
    };

    const buildMigrationPayload = async (
      inline: DynamicChartBlockData,
      context: { parentTitle: string; parentId: string; isPublished: boolean },
    ) => {
      const configTitle =
        resolveI18nText(inline.title) ||
        resolveI18nText(inline.subtitle) ||
        "Gráfico interativo";
      const name = `${context.parentTitle} — ${configTitle}`.slice(0, 160);
      const slug = await parametricChartService.ensureUniqueSlug(
        parametricChartService.generateSlug(`${context.parentTitle}-${configTitle}-${context.parentId.slice(0, 8)}`),
      );

      return {
        name,
        slug,
        title: configTitle,
        description: resolveI18nText(inline.description) || undefined,
        category: null,
        config_data: structuredClone(inline),
        is_published: context.isPublished,
        is_landing_demo: false,
      } satisfies Omit<ParametricChart, "id" | "created_at" | "updated_at">;
    };

    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select("id, title, content_data, is_published")
      .not("content_data", "is", null);

    if (lessonsError) {
      result.errors.push(`Erro ao listar aulas: ${lessonsError.message}`);
    } else {
      for (const lesson of lessons ?? []) {
        const contentData = lesson.content_data as {
          blocks?: Array<{ type?: string; data?: unknown }>;
        } | null;
        const blocks = contentData?.blocks;
        if (!blocks?.length) continue;

        let lessonChanged = false;
        const nextBlocks = [...blocks];

        for (let index = 0; index < nextBlocks.length; index += 1) {
          const block = nextBlocks[index];
          if (block.type !== "dynamic_chart" || !block.data) continue;

          const blockData = block.data as { chartId?: string };
          if (blockData.chartId?.trim()) continue;
          if (!isInlineDynamicChartData(block.data)) continue;

          try {
            const payload = await buildMigrationPayload(block.data, {
              parentTitle: lesson.title,
              parentId: lesson.id,
              isPublished: lesson.is_published === true,
            });

            if (dryRun) {
              result.chartsCreated += 1;
              result.items.push({
                source: "lesson",
                sourceId: lesson.id,
                chartId: "(dry-run)",
                slug: payload.slug,
              });
              lessonChanged = true;
              nextBlocks[index] = { ...block, data: { chartId: "(dry-run)" } };
              continue;
            }

            const created = await parametricChartService.create(payload);
            result.chartsCreated += 1;
            result.items.push({
              source: "lesson",
              sourceId: lesson.id,
              chartId: created.id!,
              slug: created.slug,
            });
            nextBlocks[index] = { ...block, data: { chartId: created.id! } };
            lessonChanged = true;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            result.errors.push(`Aula ${lesson.id} (bloco ${index + 1}): ${message}`);
          }
        }

        if (lessonChanged && !dryRun) {
          const { error: updateError } = await supabase
            .from("lessons")
            .update({ content_data: { ...contentData, blocks: nextBlocks } })
            .eq("id", lesson.id);

          if (updateError) {
            result.errors.push(`Erro ao atualizar aula ${lesson.id}: ${updateError.message}`);
          } else {
            result.lessonsUpdated += 1;
          }
        } else if (lessonChanged && dryRun) {
          result.lessonsUpdated += 1;
        }
      }
    }

    const { data: capsulas, error: capsulasError } = await supabase
      .from("capsulas")
      .select("id, title, content_data, is_published")
      .not("content_data", "is", null);

    if (capsulasError) {
      result.errors.push(`Erro ao listar cápsulas: ${capsulasError.message}`);
    } else {
      for (const capsula of capsulas ?? []) {
        const contentData = (capsula.content_data ?? {}) as Record<string, unknown>;
        const inline = contentData.dynamic_chart;

        if (!inline || typeof inline !== "object") continue;
        if (typeof contentData.chartId === "string" && contentData.chartId.trim()) continue;
        if (!isInlineDynamicChartData(inline)) continue;

        try {
          const payload = await buildMigrationPayload(inline, {
            parentTitle: capsula.title,
            parentId: capsula.id,
            isPublished: capsula.is_published === true,
          });

          if (dryRun) {
            result.chartsCreated += 1;
            result.capsulasUpdated += 1;
            result.items.push({
              source: "capsula",
              sourceId: capsula.id,
              chartId: "(dry-run)",
              slug: payload.slug,
            });
            continue;
          }

          const created = await parametricChartService.create(payload);
          const nextContentData = { ...contentData, chartId: created.id! };
          delete nextContentData.dynamic_chart;

          const { error: updateError } = await supabase
            .from("capsulas")
            .update({ content_data: nextContentData })
            .eq("id", capsula.id);

          if (updateError) {
            result.errors.push(`Erro ao atualizar cápsula ${capsula.id}: ${updateError.message}`);
            continue;
          }

          result.chartsCreated += 1;
          result.capsulasUpdated += 1;
          result.items.push({
            source: "capsula",
            sourceId: capsula.id,
            chartId: created.id!,
            slug: created.slug,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Cápsula ${capsula.id}: ${message}`);
        }
      }
    }

    return result;
  },
};
