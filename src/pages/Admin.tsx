import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  Users,
  Home,
  GraduationCap,
  Info,
  Beaker,
  Award,
  FlaskConical,
  Mail,
  Bug,
  Instagram,
  ShieldCheck,
  Languages,
  Settings,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { toast } from "sonner";
import { LessonsManager } from "@/components/admin/LessonsManager";
import { CapsulasManager } from "@/components/admin/CapsulasManager";
import { UsersManager } from "@/components/admin/UsersManager";
import { ModulesManager } from "@/components/admin/ModulesManager";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import VirtualLabsAdmin from "./VirtualLabsAdmin";
import { EmailSettingsManager } from "@/components/admin/EmailSettingsManager";
import { AboutManager } from "@/components/admin/AboutManager";
import { ComplainsManager } from "@/components/admin/ComplainsManager";
import { InstagramPostsManager } from "@/components/admin/InstagramPostsManager";
import { LegalSettingsManager } from "@/components/admin/LegalSettingsManager";
import { TranslationGlossaryManager } from "@/components/admin/TranslationGlossaryManager";
import { AdminDashboard } from "@/components/admin/dashboard/AdminDashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLanguage } from "@/contexts/LanguageContext";

const Admin = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contentOpenItems, setContentOpenItems] = useState<string[]>([]);
  const [usersOpenItems, setUsersOpenItems] = useState<string[]>([]);
  const [settingsOpenItems, setSettingsOpenItems] = useState<string[]>([]);

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
            <img src={logo} alt="ProGenia" className="h-10 progenia-logo" />
            <span className="text-xl font-bold gradient-text">ProGenia Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
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
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-4 gap-1">
            <TabsTrigger value="dashboard">
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="content">
              <BookOpen className="h-4 w-4 mr-2" />
              Conteúdo
            </TabsTrigger>
            <TabsTrigger value="users-complains">
              <Users className="h-4 w-4 mr-2" />
              Usuários e Complains
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <AdminDashboard />
          </TabsContent>

          <TabsContent value="content" className="mt-6">
            <Accordion
              type="multiple"
              value={contentOpenItems}
              onValueChange={setContentOpenItems}
              className="w-full rounded-lg border px-4"
            >
              <AccordionItem value="content-modules">
                <AccordionTrigger>
                  <span className="inline-flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    {isEnglish ? "Modules" : "Módulos"}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2">
                    <ModulesManager />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="content-capsules">
                <AccordionTrigger>
                  <span className="inline-flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    {isEnglish ? "Capsules" : "Cápsulas"}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2">
                    <CapsulasManager />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="content-lessons">
                <AccordionTrigger>
                  <span className="inline-flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    {isEnglish ? "Lessons" : "Aulas"}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2">
                    <LessonsManager />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="content-labs">
                <AccordionTrigger>
                  <span className="inline-flex items-center gap-2">
                    <FlaskConical className="h-4 w-4" />
                    {isEnglish ? "Virtual Labs" : "Labs Virtuais"}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2">
                    <VirtualLabsAdmin />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="content-media">
                <AccordionTrigger>
                  <span className="inline-flex items-center gap-2">
                    <Beaker className="h-4 w-4" />
                    {isEnglish ? "Library" : "Biblioteca"}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2">
                    <MediaLibrary />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="users-complains" className="mt-6">
            <Accordion
              type="multiple"
              value={usersOpenItems}
              onValueChange={setUsersOpenItems}
              className="w-full rounded-lg border px-4"
            >
              <AccordionItem value="users-list">
                <AccordionTrigger>
                  <span className="inline-flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Usuários
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2">
                    <UsersManager />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="users-complains-list">
                <AccordionTrigger>
                  <span className="inline-flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    Complains
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2">
                    <ComplainsManager />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Accordion
              type="multiple"
              value={settingsOpenItems}
              onValueChange={setSettingsOpenItems}
              className="w-full rounded-lg border px-4"
            >
              <AccordionItem value="settings-about">
                <AccordionTrigger>
                  <span className="inline-flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Sobre
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2">
                    <AboutManager />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="settings-email">
                <AccordionTrigger>
                  <span className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    E-mails
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2">
                    <EmailSettingsManager
                      onSaved={() =>
                        setSettingsOpenItems((prev) => prev.filter((item) => item !== "settings-email"))
                      }
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="settings-instagram">
                <AccordionTrigger>
                  <span className="inline-flex items-center gap-2">
                    <Instagram className="h-4 w-4" />
                    Instagram
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2">
                    <InstagramPostsManager />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="settings-legal">
                <AccordionTrigger>
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Termos
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2">
                    <LegalSettingsManager
                      onSaved={() =>
                        setSettingsOpenItems((prev) => prev.filter((item) => item !== "settings-legal"))
                      }
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="settings-glossary">
                <AccordionTrigger>
                  <span className="inline-flex items-center gap-2">
                    <Languages className="h-4 w-4" />
                    Glossário de Tradução
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2">
                    <TranslationGlossaryManager
                      onSaved={() =>
                        setSettingsOpenItems((prev) => prev.filter((item) => item !== "settings-glossary"))
                      }
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
