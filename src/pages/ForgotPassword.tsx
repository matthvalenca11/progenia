import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { ArrowLeft, Mail } from "lucide-react";
import { z } from "zod";

const emailSchema = z.object({
  email: z.string().trim().email("Endereço de e-mail inválido").max(255),
});

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = emailSchema.parse({ email });
      setLoading(true);

      // Use our custom edge function instead of Supabase's resetPasswordForEmail
      const { error } = await supabase.functions.invoke('request-password-reset', {
        body: { email: validated.email },
      });

      if (error) {
        toast.error("Erro ao processar solicitação", {
          description: error.message,
        });
      } else {
        setEmailSent(true);
        toast.success("Solicitação enviada!", {
          description: "Se o e-mail existir, você receberá um link de recuperação.",
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Ocorreu um erro ao processar sua solicitação");
      }
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">E-mail Enviado</h2>
            <p className="text-muted-foreground">
              Enviamos um link de recuperação para <strong>{email}</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              Verifique sua caixa de entrada e clique no link para redefinir sua senha.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate("/auth")}
              className="mt-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Login
            </Button>
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
          <h2 className="text-2xl font-bold text-center mb-2">Esqueceu sua senha?</h2>
          <p className="text-muted-foreground text-center text-sm">
            Digite seu e-mail e enviaremos um link para redefinir sua senha.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Enviando..." : "Enviar Link de Recuperação"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => navigate("/auth")}
            disabled={loading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Login
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ForgotPassword;
