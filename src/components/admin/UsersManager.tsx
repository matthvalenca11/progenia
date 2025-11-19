import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Shield, ShieldOff, Search } from "lucide-react";

interface UserWithRole {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  role: "admin" | "student" | null;
}

export function UsersManager() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      // Buscar perfis de usuários
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Buscar roles dos usuários
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Para emails, vamos usar placeholder por enquanto
      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);

        return {
          id: profile.id,
          email: `user-${profile.id.slice(0, 8)}@email.com`,
          full_name: profile.full_name,
          created_at: profile.created_at || "",
          role: userRole?.role as "admin" | "student" | null,
        };
      });

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast.error("Erro ao carregar usuários", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteToAdmin = async (userId: string, userName: string) => {
    if (!confirm(`Tornar "${userName}" administrador?`)) return;

    setProcessing(userId);
    try {
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (existingRole) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role: "admin" })
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });

        if (error) throw error;
      }

      toast.success(`${userName} agora é administrador`);
      loadUsers();
    } catch (error: any) {
      toast.error("Erro ao promover usuário", {
        description: error.message,
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleRemoveAdmin = async (userId: string, userName: string) => {
    if (!confirm(`Remover privilégios de admin de "${userName}"?`)) return;

    setProcessing(userId);
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");

      if (error) throw error;

      toast.success(`${userName} não é mais administrador`);
      loadUsers();
    } catch (error: any) {
      toast.error("Erro ao remover admin", {
        description: error.message,
      });
    } finally {
      setProcessing(null);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Gerenciar Usuários
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredUsers.map((user) => (
              <Card key={user.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{user.full_name}</h4>
                        {user.role === "admin" && (
                          <Badge variant="default" className="gap-1">
                            <Shield className="h-3 w-3" />
                            Admin
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cadastrado em {new Date(user.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {user.role === "admin" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveAdmin(user.id, user.full_name)}
                          disabled={processing === user.id}
                        >
                          <ShieldOff className="h-4 w-4 mr-2" />
                          Remover Admin
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handlePromoteToAdmin(user.id, user.full_name)}
                          disabled={processing === user.id}
                        >
                          <Shield className="h-4 w-4 mr-2" />
                          Tornar Admin
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
