import { supabase } from "@/integrations/supabase/client";

export interface ModuleEnrollment {
  id: string;
  user_id: string;
  module_id: string;
  enrolled_at: string;
}

export const enrollmentService = {
  async enrollInModule(userId: string, moduleId: string): Promise<void> {
    const { error } = await supabase
      .from("module_enrollments")
      .insert({ user_id: userId, module_id: moduleId });

    if (error) throw error;
  },

  async unenrollFromModule(userId: string, moduleId: string): Promise<void> {
    const { error } = await supabase
      .from("module_enrollments")
      .delete()
      .eq("user_id", userId)
      .eq("module_id", moduleId);

    if (error) throw error;
  },

  async isEnrolled(userId: string, moduleId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("module_enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("module_id", moduleId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  },

  async getUserEnrollments(userId: string): Promise<ModuleEnrollment[]> {
    const { data, error } = await supabase
      .from("module_enrollments")
      .select("*")
      .eq("user_id", userId);

    if (error) throw error;
    return data || [];
  },
};
