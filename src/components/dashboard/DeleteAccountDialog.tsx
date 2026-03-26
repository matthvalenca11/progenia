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

  const getUUID = () => {
    // Alguns navegadores/ambientes não implementam `crypto.randomUUID`.
    // Usamos fallback com `crypto.getRandomValues` para gerar UUID v4.
    if (typeof crypto !== "undefined") {
      const c = crypto as Crypto & { randomUUID?: () => string };
      if (typeof c.randomUUID === "function") return c.randomUUID();
      if (typeof c.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        c.getRandomValues(bytes);
        // UUID v4: set version (4) and variant (10xx)
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0"));
        return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex
          .slice(8, 10)
          .join("")}-${hex.slice(10, 16).join("")}`;
      }
    }
    // Último recurso: não criptograficamente seguro (mas evita quebrar o fluxo).
    return `fallback-${Math.random().toString(16).slice(2)}-${Date.now()}`;
  };

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
      const userId = signInData.session?.user?.id;
      if (!userId) {
        toast.error("Não foi possível renovar a sessão. Faça login novamente.");
        setLoading(false);
        return;
      }
      const deleteToken = getUUID();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { error: insertError } = await supabase
        .from("delete_requests")
        .insert({ user_id: userId, token: deleteToken, expires_at: expiresAt });
      if (insertError) {
        console.error(insertError);
        toast.error("Erro ao preparar exclusão. Tente novamente.");
        setLoading(false);
        return;
      }
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/confirm-delete-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey ?? "",
        },
        body: JSON.stringify({ token: deleteToken }),
      });
      const body = await res.json().catch(() => ({}));
      const bodyMsg = typeof body?.error === "string" ? body.error : null;
      if (!res.ok) {
        if (res.status === 404) {
          toast.error("Função não encontrada. Rode: supabase functions deploy confirm-delete-account");
        } else if (res.status === 401) {
          toast.error(bodyMsg || "Não autorizado. Verifique se está logado e tente novamente.");
        } else {
          toast.error(bodyMsg || `Erro ${res.status}. Execute: supabase db push e supabase functions deploy confirm-delete-account`);
        }
        setLoading(false);
        return;
      }
      if (body?.error) {
        toast.error(body.error);
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
            Esta ação é irreversível. Seu cadastro será removido da plataforma e seus históricos (progresso, conclusões, dados no dataset) serão apagados. Para confirmar, digite sua senha abaixo.
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
