import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function DeleteUserTest() {
  const [userId, setUserId] = useState("b56c1387-8cb9-402b-94c3-365ebb0a5cab");
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      console.log("Chamando edge function delete-user com userId:", userId);
      
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      console.log("Resposta da edge function:", { data, error });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("Usuário deletado com sucesso do Auth!");
    } catch (error: any) {
      console.error("Erro ao deletar:", error);
      toast.error("Erro ao deletar usuário", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>Deletar Usuário do Auth</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="User ID"
          />
          <Button onClick={handleDelete} disabled={loading}>
            {loading ? "Deletando..." : "Deletar do Auth"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
