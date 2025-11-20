import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { Lock } from "lucide-react";
import { z } from "zod";

const passwordSchema = z
  .object({
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres").max(100),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // For custom token-based reset, we don't need a Supabase session
    // Just check if we have a token in the URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (token) {
      setHasSession(true);
    } else {
      toast.error("Link inválido ou expirado", {
        description: "Por favor, solicite um novo link de recuperação.",
      });
      setTimeout(() => navigate("/forgot-password"), 2000);
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = passwordSchema.parse({ password, confirmPassword });
      setLoading(true);

      // Get token from URL
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');

      if (!token) {
        toast.error("Token inválido");
        return;
      }

      // Use our custom edge function
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { token, newPassword: validated.password },
      });

      if (error || data?.error) {
        toast.error("Erro ao redefinir senha", {
          description: error?.message || data?.error || "Tente novamente",
        });
      } else {
        toast.success("Senha redefinida com sucesso!", {
          description: "Você já pode fazer login com sua nova senha.",
        });
        setTimeout(() => navigate("/auth"), 1500);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Ocorreu um erro ao redefinir sua senha");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!hasSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-muted-foreground">Verificando link de recuperação...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="ProGenia" className="h-16 mb-4" />
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-center mb-2">Redefinir Senha</h2>
          <p className="text-muted-foreground text-center text-sm">
            Digite sua nova senha abaixo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="password">Nova Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Digite a senha novamente"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Salvar Nova Senha"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ResetPassword;
