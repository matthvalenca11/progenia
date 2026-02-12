import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bug, CheckCircle2, Loader2 } from "lucide-react";

interface ComplainRow {
  id: string;
  user_id: string;
  description: string;
  created_at: string;
  status: string;
  profiles?: { full_name: string | null } | null;
}

export function ComplainsManager() {
  const [complains, setComplains] = useState<ComplainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("complains")
      .select("id, user_id, description, created_at, status, profiles(full_name)")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setComplains([]);
    } else {
      setComplains((data ?? []) as ComplainRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setResolved = async (id: string) => {
    setUpdatingId(id);
    const { error } = await supabase
      .from("complains")
      .update({ status: "resolved" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      setComplains((prev) => prev.map((c) => (c.id === id ? { ...c, status: "resolved" } : c)));
      toast.success("Marcado como resolvido.");
    }
    setUpdatingId(null);
  };

  if (loading) {
    return (
      <Card className="p-8 flex items-center justify-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Carregando reclamações...</span>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Bug className="h-5 w-5" />
        <span>Bugs e reclamações reportados pelos usuários.</span>
      </div>
      {complains.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhum relato no momento.
        </Card>
      ) : (
        <div className="space-y-3">
          {complains.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">
                    {(c.profiles as { full_name?: string } | null)?.full_name ?? "Usuário"} ·{" "}
                    {new Date(c.created_at).toLocaleString("pt-BR")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{c.description}</p>
                  <Badge variant={c.status === "resolved" ? "secondary" : "default"} className="mt-2">
                    {c.status === "resolved" ? "Resolvido" : "Aberto"}
                  </Badge>
                </div>
                {c.status === "open" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResolved(c.id)}
                    disabled={updatingId === c.id}
                  >
                    {updatingId === c.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Marcar resolvido
                      </>
                    )}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
