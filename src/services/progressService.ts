// Progress service stub - simplified version
import { supabase } from "@/integrations/supabase/client";

export const progressService = {
  markLessonComplete: async (userId: string, lessonId: string) => {
    const { error } = await supabase
      .from("lesson_progress")
      .upsert({
        user_id: userId,
        lesson_id: lessonId,
        status: "concluido",
        progress_percentage: 100,
        data_conclusao: new Date().toISOString()
      }, {
        onConflict: "user_id,lesson_id"
      });
    
    if (error) throw error;
  },
  getUserProgress: async (userId: string) => {
    return [];
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
    return { completed: 0, total: 0, percentage: 0 };
  },
  startLesson: async (userId: string, lessonId: string) => {
    const { error } = await supabase
      .from("lesson_progress")
      .upsert({
        user_id: userId,
        lesson_id: lessonId,
        status: "em_andamento",
        progress_percentage: 0
      }, {
        onConflict: "user_id,lesson_id"
      });
    if (error) throw error;
  },
  completeLesson: async (userId: string, lessonId: string) => {
    return progressService.markLessonComplete(userId, lessonId);
  },
  getPointsHistory: async (userId: string) => {
    return [];
  }
};
