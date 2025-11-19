import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BookOpen, 
  Users, 
  Home,
  GraduationCap,
  Handshake,
  UsersRound,
  Beaker,
  Award,
  FlaskConical
} from "lucide-react";
import logo from "@/assets/logo.png";
import { toast } from "sonner";
import { LessonsManager } from "@/components/admin/LessonsManager";
import { PartnersManager } from "@/components/admin/PartnersManager";
import { TeamManager } from "@/components/admin/TeamManager";
import { UsersManager } from "@/components/admin/UsersManager";
import { GamificationManager } from "@/components/admin/GamificationManager";
import { ModulesManager } from "@/components/admin/ModulesManager";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import CapsulasList from "@/components/admin/CapsulasList";
import VirtualLabsAdmin from "./VirtualLabsAdmin";

const Admin = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminAccess = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      // Verificar se é admin via tabela user_roles
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (roleData?.role !== "admin") {
        toast.error("Acesso restrito a administradores");
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      setLoading(false);
    };

    checkAdminAccess();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Verificando permissões...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/dashboard")}>
            <img src={logo} alt="ProGenia" className="h-10" />
            <span className="text-xl font-bold gradient-text">ProGenia Admin</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Button variant="ghost" onClick={() => navigate("/profile")}>
              Perfil
            </Button>
          </div>
        </div>
      </nav>

      {/* Conteúdo Principal */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="modules" className="w-full">
          <TabsList className="grid w-full grid-cols-9 gap-1">
            <TabsTrigger value="modules">
              <BookOpen className="h-4 w-4 mr-2" />
              Módulos
            </TabsTrigger>
            <TabsTrigger value="capsulas">
              <BookOpen className="h-4 w-4 mr-2" />
              Cápsulas
            </TabsTrigger>
            <TabsTrigger value="lessons">
              <GraduationCap className="h-4 w-4 mr-2" />
              Aulas
            </TabsTrigger>
            <TabsTrigger value="labs">
              <FlaskConical className="h-4 w-4 mr-2" />
              Labs Virtuais
            </TabsTrigger>
            <TabsTrigger value="media">
              <Beaker className="h-4 w-4 mr-2" />
              Biblioteca
            </TabsTrigger>
            <TabsTrigger value="team">
              <UsersRound className="h-4 w-4 mr-2" />
              Equipe
            </TabsTrigger>
            <TabsTrigger value="partners">
              <Handshake className="h-4 w-4 mr-2" />
              Parceiros
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="gamification">
              <Award className="h-4 w-4 mr-2" />
              Gamificação
            </TabsTrigger>
          </TabsList>

          <TabsContent value="modules">
            <ModulesManager />
          </TabsContent>

          <TabsContent value="capsulas">
            <CapsulasList />
          </TabsContent>

          <TabsContent value="lessons">
            <LessonsManager />
          </TabsContent>

          <TabsContent value="labs">
            <VirtualLabsAdmin />
          </TabsContent>

          <TabsContent value="media">
            <MediaLibrary />
          </TabsContent>

          <TabsContent value="team">
            <TeamManager />
          </TabsContent>

          <TabsContent value="partners">
            <PartnersManager />
          </TabsContent>

          <TabsContent value="users">
            <UsersManager />
          </TabsContent>

          <TabsContent value="gamification">
            <GamificationManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
