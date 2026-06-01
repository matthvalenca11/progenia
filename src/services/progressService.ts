import { supabase } from "@/integrations/supabase/client";
import { gamificationService } from "./gamificationService";

export type UserProgressItem = {
  id: string;
  type: "lesson" | "capsule";
  resourceId: string;
  title: string;
  status: string;
  progress_percentage: number;
  data_conclusao: string | null;
  updated_at: string | null;
};

export const progressService = {
  markLessonComplete: async (userId: string, lessonId: string) => {
    const { error } = await supabase
      .from("lesson_progress")
      .upsert(
        {
          user_id: userId,
          lesson_id: lessonId,
          status: "concluido",
          progress_percentage: 100,
          data_conclusao: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_id" },
      );

    if (error) throw error;
  },

  getUserProgress: async (userId: string): Promise<UserProgressItem[]> => {
    const [lessonsRes, capsulesRes] = await Promise.all([
      supabase
        .from("lesson_progress")
        .select("id, status, progress_percentage, data_conclusao, updated_at, lesson_id, lessons(title)")
        .eq("user_id", userId),
      supabase
        .from("capsula_progress")
        .select("id, status, progress_percentage, data_conclusao, updated_at, capsula_id, capsulas(title)")
        .eq("user_id", userId),
    ]);

    if (lessonsRes.error) console.error("Erro ao buscar progresso de aulas:", lessonsRes.error);
    if (capsulesRes.error) console.error("Erro ao buscar progresso de cápsulas:", capsulesRes.error);

    const lessonItems: UserProgressItem[] = (lessonsRes.data || []).map((row) => ({
      id: row.id,
      type: "lesson" as const,
      resourceId: row.lesson_id,
      title: (row.lessons as { title?: string } | null)?.title || "Aula",
      status: row.status || "em_andamento",
      progress_percentage: row.progress_percentage ?? 0,
      data_conclusao: row.data_conclusao,
      updated_at: row.updated_at,
    }));

    const capsuleItems: UserProgressItem[] = (capsulesRes.data || []).map((row) => ({
      id: row.id,
      type: "capsule" as const,
      resourceId: row.capsula_id,
      title: (row.capsulas as { title?: string } | null)?.title || "Cápsula",
      status: row.status || "em_andamento",
      progress_percentage: row.progress_percentage ?? 0,
      data_conclusao: row.data_conclusao,
      updated_at: row.updated_at,
    }));

    return [...lessonItems, ...capsuleItems].sort((a, b) => {
      const dateA = new Date(a.updated_at || a.data_conclusao || 0).getTime();
      const dateB = new Date(b.updated_at || b.data_conclusao || 0).getTime();
      return dateB - dateA;
    });
  },

  getLessonProgress: async (userId: string, lessonId: string) => {
    const { data } = await supabase
      .from("lesson_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .maybeSingle();
    return data;
  },

  getModuleProgress: async (userId: string, moduleId: string) => {
    const [{ data: lessons }, { data: capsules }] = await Promise.all([
      supabase.from("lessons").select("id").eq("module_id", moduleId).eq("is_published", true),
      supabase.from("capsulas").select("id").eq("module_id", moduleId).eq("is_published", true),
    ]);

    const lessonIds = (lessons || []).map((l) => l.id);
    const capsuleIds = (capsules || []).map((c) => c.id);
    const total = lessonIds.length + capsuleIds.length;

    const [{ count: doneLessons }, { count: doneCapsules }] = await Promise.all([
      lessonIds.length
        ? supabase
            .from("lesson_progress")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "concluido")
            .in("lesson_id", lessonIds)
        : Promise.resolve({ count: 0 }),
      capsuleIds.length
        ? supabase
            .from("capsula_progress")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "concluido")
            .in("capsula_id", capsuleIds)
        : Promise.resolve({ count: 0 }),
    ]);

    const completed = (doneLessons || 0) + (doneCapsules || 0);
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  },

  startLesson: async (userId: string, lessonId: string) => {
    const { error } = await supabase
      .from("lesson_progress")
      .upsert(
        {
          user_id: userId,
          lesson_id: lessonId,
          status: "em_andamento",
          progress_percentage: 0,
        },
        { onConflict: "user_id,lesson_id" },
      );
    if (error) throw error;
  },

  completeLesson: async (userId: string, lessonId: string) => {
    return progressService.markLessonComplete(userId, lessonId);
  },

  getPointsHistory: async (userId: string) => {
    return gamificationService.getPointsHistory(userId);
  },
};
