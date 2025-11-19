import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

export interface SignUpData {
  email: string;
  password: string;
  full_name: string;
  institution?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface UpdateProfileData {
  full_name?: string;
  avatar_url?: string;
  institution?: string;
  professional_role?: string;
  cargo?: string;
  descricao?: string;
}

export const authService = {
  /**
   * Registrar novo usuário
   */
  async signUp(data: SignUpData) {
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.full_name,
          institution: data.institution || "",
        },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (error) throw error;
    return { success: true };
  },

  /**
   * Fazer login
   */
  async signIn(data: SignInData) {
    const { data: session, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) throw error;
    return session;
  },

  /**
   * Fazer logout
   */
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      // Ignorar erro de sessão inexistente, mas avisar no console
      if (error && !String(error.message || '').toLowerCase().includes('session not found')) {
        console.warn('signOut warning:', error.message);
      }
    } catch (e) {
      console.warn('signOut error:', e);
    } finally {
      // Limpeza defensiva: remover quaisquer tokens persistidos
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
            localStorage.removeItem(key);
          }
        }
      } catch {}
    }
  },

  /**
   * Obter sessão atual
   */
  async getSession(): Promise<{ session: Session | null; user: User | null }> {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return { session, user: session?.user || null };
  },

  /**
   * Resetar senha
   */
  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) throw error;
  },

  /**
   * Atualizar senha
   */
  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  },

  /**
   * Obter perfil do usuário
   */
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Atualizar perfil
   */
  async updateProfile(userId: string, updates: UpdateProfileData) {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (error) throw error;
  },

  /**
   * Verificar se usuário é admin
   */
  async isAdmin(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("profiles")
      .select("papel")
      .eq("id", userId)
      .single();

    if (error) return false;
    return data?.papel === "admin";
  },

  /**
   * Obter role do usuário
   */
  async getUserRole(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("papel")
      .eq("id", userId)
      .single();

    if (error) throw error;
    return data?.papel || "aluno";
  },
};