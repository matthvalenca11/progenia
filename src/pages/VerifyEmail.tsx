import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    verifyEmail();
  }, []);

  const verifyEmail = async () => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Token de verificação não encontrado");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("verify-email", {
        body: { token },
      });

      if (error) throw error;

      if (data?.error) {
        setStatus("error");
        setMessage(data.error);
        toast.error(data.error);
      } else {
        setStatus("success");
        setMessage("E-mail verificado com sucesso!");
        toast.success("E-mail verificado! Você já pode fazer login.");
      }
    } catch (error: any) {
      console.error("Error verifying email:", error);
      setStatus("error");
      setMessage("Erro ao verificar e-mail. Tente novamente.");
      toast.error("Erro ao verificar e-mail");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center text-center space-y-6">
          <img src={logo} alt="ProGenia" className="h-16 mb-2" />
          
          {status === "loading" && (
            <>
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
              <h2 className="text-2xl font-bold">Verificando e-mail...</h2>
              <p className="text-muted-foreground">
                Aguarde enquanto confirmamos seu e-mail.
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-green-600">E-mail Verificado!</h2>
              <p className="text-muted-foreground">{message}</p>
              <Button onClick={() => navigate("/auth")} className="mt-4">
                Fazer Login
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-red-600">Erro na Verificação</h2>
              <p className="text-muted-foreground">{message}</p>
              <Button 
                variant="outline" 
                onClick={() => navigate("/auth")} 
                className="mt-4"
              >
                Voltar ao Login
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default VerifyEmail;
