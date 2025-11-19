import * as React from "react";
const { createContext, useContext, useEffect, useState } = React;
import type { ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/services/authService";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  userRole: "aluno" | "instrutor" | "admin" | null;
  profile: any;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: { email: string; password: string; full_name: string; institution?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: any) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Debug: confirmar que só há uma instância do AuthProvider
  console.log("🔐 AuthProvider initialized");
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<"aluno" | "instrutor" | "admin" | null>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    // Configurar listener de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user || null);
        
        if (session?.user) {
          // Carregar perfil e role do usuário
          setTimeout(async () => {
            await loadUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setUserRole(null);
          setIsAdmin(false);
        }
      }
    );

    // Verificar sessão inicial
    authService.getSession().then(({ session }) => {
      setSession(session);
      setUser(session?.user || null);
      
      if (session?.user) {
        loadUserData(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      const profileData = await authService.getProfile(userId);
      const role = await authService.getUserRole(userId);
      
      setProfile(profileData);
      setUserRole(role);
      setIsAdmin(role === "admin");
    } catch (error) {
      console.error("Erro ao carregar dados do usuário:", error);
    }
  };

  const signIn = async (email: string, password: string) => {
    await authService.signIn({ email, password });
  };

  const signUp = async (data: any) => {
    await authService.signUp(data);
  };

  const signOut = async () => {
    try {
      await authService.signOut();
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      setUserRole(null);
      setIsAdmin(false);
    }
  };

  const updateProfile = async (updates: any) => {
    if (!user) return;
    await authService.updateProfile(user.id, updates);
    await refreshProfile();
  };

  const refreshProfile = async () => {
    if (!user) return;
    await loadUserData(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAdmin,
        userRole,
        profile,
        signIn,
        signUp,
        signOut,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}