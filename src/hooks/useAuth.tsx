import * as React from "react";
const { createContext, useContext, useEffect, useRef, useState } = React;
import type { ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/services/authService";
import {
  isNative,
  restoreNativeSessionIntoSupabase,
  saveNativeSession,
} from "@/lib/nativeSessionPersistence";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  /** True while cold-start auth bootstrap is running (native + web). */
  bootstrapped: boolean;
  loading: boolean;
  isAdmin: boolean;
  userRole: string | null;
  profile: any;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: {
    email: string;
    password: string;
    full_name: string;
    institution?: string;
    birth_date: string;
    gender: "masculino" | "feminino" | "prefiro_nao_dizer";
    state_uf?: string | null;
    city?: string | null;
    country?: string | null;
    education_level: string;
    profession: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: any) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const bootstrapDoneRef = useRef(false);

  const applySession = (next: Session | null) => {
    setSession(next);
    setUser(next?.user ?? null);
  };

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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        // Supabase fires INITIAL_SESSION with null on native before Preferences restore.
        // Ignore all auth events until our bootstrap finishes.
        if (!bootstrapDoneRef.current) return;

        applySession(nextSession);

        if (nextSession && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
          await saveNativeSession({
            access_token: nextSession.access_token,
            refresh_token: nextSession.refresh_token,
          });
        }

        if (nextSession?.user) {
          setLoading(false);
          void loadUserData(nextSession.user.id);
        } else if (event === "SIGNED_OUT") {
          setProfile(null);
          setUserRole(null);
          setIsAdmin(false);
          setLoading(false);
        }
      },
    );

    const bootstrap = async () => {
      try {
        if (isNative) {
          const { session: restored } = await restoreNativeSessionIntoSupabase();
          if (restored) {
            applySession(restored);
            void loadUserData(restored.user.id);
          }
        } else {
          const { session: existing } = await authService.getSession();
          if (existing) {
            applySession(existing);
            void loadUserData(existing.user.id);
          }
        }
      } catch (e) {
        console.error("[auth] bootstrap failed:", e);
      } finally {
        bootstrapDoneRef.current = true;
        setBootstrapped(true);
        setLoading(false);
      }
    };

    void bootstrap();

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const result = await authService.signIn({ email, password });
    if (result.session) {
      applySession(result.session);
      await saveNativeSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
      void loadUserData(result.session.user.id);
    }
  };

  const signUp = async (data: any) => {
    await authService.signUp(data);
  };

  const signOut = async () => {
    try {
      await authService.signOut();
    } finally {
      applySession(null);
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
        bootstrapped,
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
