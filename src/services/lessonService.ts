// Temporary stub - lessons functionality needs to be reimplemented
import { supabase } from "@/integrations/supabase/client";

export const lessonService = {
  getLessonById: async (id: string) => {
    const { data, error } = await supabase
      .from("lessons")
      .select("*, modules(*)")
      .eq("id", id)
      .single();
    
    if (error) throw error;
    return data;
  },

  getVirtualLab: async (lessonId: string) => {
    // Virtual labs not fully implemented
    return null;
  }
};
