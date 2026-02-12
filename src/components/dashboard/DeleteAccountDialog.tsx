import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!password.trim()) {
      toast.error("Digite sua senha para confirmar.");
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        toast.error("Sessão inválida. Faça login novamente.");
        setLoading(false);
        return;
      }
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: password.trim(),
      });
      if (signInError) {
        toast.error("Senha incorreta. Tente novamente.");
        setLoading(false);
        return;
      }
      const token = signInData.session?.access_token ?? session.access_token;
      const { data, error } = await supabase.functions.invoke("delete-my-account", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) {
        const err = error as Error & { context?: { status?: number; body?: { error?: string } } };
        const status = err.context?.status;
        const bodyMsg = err.context?.body && typeof err.context.body === "object" && "error" in err.context.body ? (err.context.body as { error: string }).error : null;
        if (status === 404 || err.message?.includes("non-2xx")) {
          toast.error("Função de exclusão não está disponível. Publique-a com: supabase functions deploy delete-my-account");
        } else {
          toast.error(bodyMsg || err.message || "Falha ao excluir conta.");
        }
        setLoading(false);
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        setLoading(false);
        return;
      }
      toast.success("Conta excluída. Até logo.");
      onOpenChange(false);
      await supabase.auth.signOut();
      navigate("/");
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? (e as Error).message : "Erro ao excluir conta.";
      toast.error(msg);
    } finally {
      setLoading(false);
      setPassword("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">Excluir minha conta</DialogTitle>
          <DialogDescription>
            Esta ação é irreversível. Seu cadastro será removido da plataforma e seus históricos (progresso, conclusões, dados no banco) serão apagados. Para confirmar, digite sua senha abaixo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="delete-password">Confirme sua senha</Label>
            <Input
              id="delete-password"
              type="password"
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir conta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
