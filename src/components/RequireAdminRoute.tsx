import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface RequireAdminRouteProps {
  children: ReactNode;
}

/**
 * Guarda rotas admin no frontend — evita flash de UI antes do RLS do Supabase.
 */
export function RequireAdminRoute({ children }: RequireAdminRouteProps) {
  const navigate = useNavigate();
  const { user, isAdmin, bootstrapped, loading } = useAuth();

  useEffect(() => {
    if (!bootstrapped || loading) return;

    if (!user) {
      navigate("/auth");
      return;
    }

    if (!isAdmin) {
      toast.error("Acesso restrito a administradores");
      navigate("/dashboard");
    }
  }, [bootstrapped, loading, user, isAdmin, navigate]);

  if (!bootstrapped || loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Redirecionando...</p>
      </div>
    );
  }

  return children;
}
