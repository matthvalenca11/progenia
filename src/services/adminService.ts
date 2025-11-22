import { supabase } from "@/integrations/supabase/client";

export const adminService = {
  /**
   * Listar todos os usuários
   */
  async getAllUsers() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*, user_stats(*)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Promover usuário a admin
   */
  async promoteToAdmin(userId: string) {
    // Atualizar papel no perfil
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ papel: "admin" })
      .eq("id", userId);

    if (profileError) throw profileError;

    // Verificar se já tem a role de admin
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();

    if (!existingRole) {
      // Adicionar role de admin
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "admin",
        });

      if (roleError) throw roleError;
    }
  },

  /**
   * Remover admin de usuário
   */
  async revokeAdmin(userId: string) {
    // Atualizar papel no perfil para aluno
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ papel: "aluno" })
      .eq("id", userId);

    if (profileError) throw profileError;

    // Remover role de admin
    const { error: roleError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "admin");

    if (roleError) throw roleError;
  },

  /**
   * Promover a instrutor
   */
  async promoteToInstructor(userId: string) {
    const { error } = await supabase
      .from("profiles")
      .update({ papel: "instrutor" })
      .eq("id", userId);

    if (error) throw error;
  },

  /**
   * Obter estatísticas da plataforma
   */
  async getPlatformStats() {
    // Total de usuários
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    // Total de módulos
    const { count: totalModules } = await supabase
      .from("modules")
      .select("*", { count: "exact", head: true });

    // Total de aulas
    const { count: totalLessons } = await supabase
      .from("lessons")
      .select("*", { count: "exact", head: true });

    // Total de progresso concluído
    const { count: completedLessons } = await supabase
      .from("lesson_progress")
      .select("*", { count: "exact", head: true })
      .eq("status", "concluido");

    // Usuários ativos (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { count: activeUsers } = await supabase
      .from("user_stats")
      .select("*", { count: "exact", head: true })
      .gte("last_activity_date", thirtyDaysAgo.toISOString().split('T')[0]);

    return {
      totalUsers: totalUsers || 0,
      totalModules: totalModules || 0,
      totalLessons: totalLessons || 0,
      completedLessons: completedLessons || 0,
      activeUsers: activeUsers || 0,
    };
  },

  /**
   * Obter usuários por papel
   */
  async getUsersByRole(role: "aluno" | "instrutor" | "admin") {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("papel", role)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Atualizar perfil de usuário (admin)
   */
  async updateUserProfile(userId: string, updates: any) {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (error) throw error;
  },

  /**
   * Deletar usuário completamente (auth + perfil)
   */
  async deleteUser(userId: string) {
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { userId }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  },

  /**
   * Obter relatório de progresso geral
   */
  async getProgressReport() {
    const { data, error } = await supabase
      .from("lesson_progress")
      .select(`
        *,
        profiles(full_name, papel),
        lessons(title, modules(title))
      `)
      .eq("status", "concluido")
      .order("data_conclusao", { ascending: false })
      .limit(100);

    if (error) throw error;
    return data || [];
  },
};