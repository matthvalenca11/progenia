import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BookOpen,
  Users,
  Home,
  GraduationCap,
  Info,
  Beaker,
  Award,
  FlaskConical,
  LineChart,
  Mail,
  Bug,
  Instagram,
  ShieldCheck,
  Languages,
  Settings,
} from "lucide-react";
import { ProGeniaLogo } from "@/components/ProGeniaLogo";
import { toast } from "sonner";
import { LessonsManager } from "@/components/admin/LessonsManager";
import { CapsulasManager } from "@/components/admin/CapsulasManager";
import { UsersManager } from "@/components/admin/UsersManager";
import { ModulesManager } from "@/components/admin/ModulesManager";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import VirtualLabsAdmin from "./VirtualLabsAdmin";
import ParametricChartsAdmin from "./ParametricChartsAdmin";
import { EmailSettingsManager } from "@/components/admin/EmailSettingsManager";
import { AboutManager } from "@/components/admin/AboutManager";
import { ComplainsManager } from "@/components/admin/ComplainsManager";
import { InstagramPostsManager } from "@/components/admin/InstagramPostsManager";
import { LegalSettingsManager } from "@/components/admin/LegalSettingsManager";
import { TranslationGlossaryManager } from "@/components/admin/TranslationGlossaryManager";
import { AdminDashboard } from "@/components/admin/dashboard/AdminDashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { isNativeApp } from "@/lib/capacitor";
import { cn } from "@/lib/utils";

const Admin = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contentOpenItems, setContentOpenItems] = useState<string[]>([]);
  const [usersOpenItems, setUsersOpenItems] = useState<string[]>([]);
  const [settingsOpenItems, setSettingsOpenItems] = useState<string[]>([]);
  const [activeAdminTab, setActiveAdminTab] = useState("dashboard");
  const isMobile = useIsMobile();

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          navigate("/auth");
          return;
        }

        const { data: roleData, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();

        if (error || roleData?.role !== "admin") {
          toast.error("Acesso restrito a administradores");
          navigate("/dashboard");
          return;
        }

        setIsAdmin(true);
      } catch (error) {
        console.error("Erro ao verificar permissões de admin:", error);
        toast.error("Não foi possível verificar permissões");
        navigate("/auth");
      } finally {
        setLoading(false);
      }
    };

    void checkAdminAccess();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <p className="text-muted-foreground">Verificando permissões...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <p className="text-muted-foreground">Redirecionando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Navbar */}
      <nav className="safe-sticky-top border-b border-border bg-background/95 backdrop-blur">
        <div
          className={cn(
            "container mx-auto flex min-w-0 flex-wrap items-center justify-between gap-3 py-3 sm:py-4",
            isNativeApp ? "px-0" : "px-3 sm:px-4",
          )}
        >
          <div
            className="flex min-w-0 cursor-pointer items-center gap-2 sm:gap-3"
            onClick={() => navigate("/dashboard")}
          >
            <ProGeniaLogo className="h-10 shrink-0 progenia-logo" />
            <span className="truncate text-lg font-bold gradient-text sm:text-xl">ProGenia Admin</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <Button variant="ghost" onClick={() => navigate("/dashboard")} className="hidden sm:inline-flex">
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Button variant="ghost" onClick={() => navigate("/profile")} className="hidden sm:inline-flex">
              Perfil
            </Button>
          </div>
        </div>
      </nav>

      {/* Conteúdo Principal */}
      <div
        className={cn(
          "container mx-auto min-w-0 py-6 sm:py-8",
          isNativeApp ? "px-0" : "px-3 sm:px-4",
        )}
      >
        <Tabs value={activeAdminTab} onValueChange={setActiveAdminTab} className="min-w-0 w-full">
          {isMobile && (
            <div className="mb-4">
              <Select value={activeAdminTab} onValueChange={setActiveAdminTab}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar seção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dashboard">Dashboard</SelectItem>
                  <SelectItem value="content">Conteúdo</SelectItem>
                  <SelectItem value="users-complains">Usuários e Complains</SelectItem>
                  <SelectItem value="settings">Configurações</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <TabsList className="hidden h-auto w-full grid-cols-2 gap-1 p-1 sm:grid lg:grid-cols-4">
            <TabsTrigger
              value="dashboard"
              className="h-auto min-h-10 whitespace-normal px-2 py-2 text-xs leading-tight sm:text-sm lg:whitespace-nowrap"
            >
              <Home className="mr-1.5 h-4 w-4 shrink-0" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="content"
              className="h-auto min-h-10 whitespace-normal px-2 py-2 text-xs leading-tight sm:text-sm lg:whitespace-nowrap"
            >
              <BookOpen className="mr-1.5 h-4 w-4 shrink-0" />
              Conteúdo
            </TabsTrigger>
            <TabsTrigger
              value="users-complains"
              className="h-auto min-h-10 whitespace-normal px-2 py-2 text-xs leading-tight sm:text-sm lg:whitespace-nowrap"
            >
              <Users className="mr-1.5 h-4 w-4 shrink-0" />
              Usuários e Complains
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="h-auto min-h-10 whitespace-normal px-2 py-2 text-xs leading-tight sm:text-sm lg:whitespace-nowrap"
            >
              <Settings className="mr-1.5 h-4 w-4 shrink-0" />
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

              <AccordionItem value="content-charts">
                <AccordionTrigger>
                  <span className="inline-flex items-center gap-2">
                    <LineChart className="h-4 w-4" />
                    {isEnglish ? "Parametric Charts" : "Gráficos Paramétricos"}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2">
                    <ParametricChartsAdmin />
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
