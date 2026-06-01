import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { gamificationService } from "@/services/gamificationService";
import { progressService, type UserProgressItem } from "@/services/progressService";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { enUS, ptBR } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BadgeIcon } from "@/components/gamification/BadgeIcon";
import { cn } from "@/lib/utils";
import { 
  Award, 
  TrendingUp, 
  Trophy, 
  Clock,
  BookOpen,
  ArrowLeft,
  Edit,
  Lock,
  Loader2,
  GraduationCap,
  BookMarked,
  CheckCircle2,
} from "lucide-react";

const formatIsoDateForInput = (iso: string, isEnglish: boolean) => {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const [, yyyy, mm, dd] = match;
  return isEnglish ? `${mm}/${dd}/${yyyy}` : `${dd}/${mm}/${yyyy}`;
};

const brazilianStates = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapa" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceara" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espirito Santo" },
  { uf: "GO", name: "Goias" },
  { uf: "MA", name: "Maranhao" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Para" },
  { uf: "PB", name: "Paraiba" },
  { uf: "PR", name: "Parana" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piaui" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondonia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "Sao Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
];

const educationLevelOptions = [
  { value: "Médio incompleto", labelPt: "Médio incompleto", labelEn: "Incomplete high school" },
  { value: "Médio completo", labelPt: "Médio completo", labelEn: "Complete high school" },
  { value: "Técnico completo", labelPt: "Técnico completo", labelEn: "Completed technical education" },
  { value: "Superior incompleto", labelPt: "Superior incompleto", labelEn: "Incomplete undergraduate" },
  { value: "Superior completo", labelPt: "Superior completo", labelEn: "Complete undergraduate" },
  { value: "Mestrado", labelPt: "Mestrado", labelEn: "Master's degree" },
  { value: "Doutorado", labelPt: "Doutorado", labelEn: "Doctorate" },
];

const countryOptions = [
  { value: "Alemanha", labelPt: "Alemanha", labelEn: "Germany" },
  { value: "Argentina", labelPt: "Argentina", labelEn: "Argentina" },
  { value: "Austrália", labelPt: "Austrália", labelEn: "Australia" },
  { value: "Áustria", labelPt: "Áustria", labelEn: "Austria" },
  { value: "Bélgica", labelPt: "Bélgica", labelEn: "Belgium" },
  { value: "Bolívia", labelPt: "Bolívia", labelEn: "Bolivia" },
  { value: "Canadá", labelPt: "Canadá", labelEn: "Canada" },
  { value: "Chile", labelPt: "Chile", labelEn: "Chile" },
  { value: "China", labelPt: "China", labelEn: "China" },
  { value: "Colômbia", labelPt: "Colômbia", labelEn: "Colombia" },
  { value: "Coreia do Sul", labelPt: "Coreia do Sul", labelEn: "South Korea" },
  { value: "Dinamarca", labelPt: "Dinamarca", labelEn: "Denmark" },
  { value: "Espanha", labelPt: "Espanha", labelEn: "Spain" },
  { value: "Estados Unidos", labelPt: "Estados Unidos", labelEn: "United States" },
  { value: "Finlândia", labelPt: "Finlândia", labelEn: "Finland" },
  { value: "França", labelPt: "França", labelEn: "France" },
  { value: "Grécia", labelPt: "Grécia", labelEn: "Greece" },
  { value: "Holanda", labelPt: "Holanda", labelEn: "Netherlands" },
  { value: "Índia", labelPt: "Índia", labelEn: "India" },
  { value: "Inglaterra", labelPt: "Inglaterra", labelEn: "England" },
  { value: "Irlanda", labelPt: "Irlanda", labelEn: "Ireland" },
  { value: "Israel", labelPt: "Israel", labelEn: "Israel" },
  { value: "Itália", labelPt: "Itália", labelEn: "Italy" },
  { value: "Japão", labelPt: "Japão", labelEn: "Japan" },
  { value: "México", labelPt: "México", labelEn: "Mexico" },
  { value: "Noruega", labelPt: "Noruega", labelEn: "Norway" },
  { value: "Paraguai", labelPt: "Paraguai", labelEn: "Paraguay" },
  { value: "Peru", labelPt: "Peru", labelEn: "Peru" },
  { value: "Portugal", labelPt: "Portugal", labelEn: "Portugal" },
  { value: "Suécia", labelPt: "Suécia", labelEn: "Sweden" },
  { value: "Suíça", labelPt: "Suíça", labelEn: "Switzerland" },
  { value: "Uruguai", labelPt: "Uruguai", labelEn: "Uruguay" },
  { value: "Venezuela", labelPt: "Venezuela", labelEn: "Venezuela" },
  { value: "Angola", labelPt: "Angola", labelEn: "Angola" },
  { value: "Argélia", labelPt: "Argélia", labelEn: "Algeria" },
  { value: "África do Sul", labelPt: "África do Sul", labelEn: "South Africa" },
  { value: "Camarões", labelPt: "Camarões", labelEn: "Cameroon" },
  { value: "Costa do Marfim", labelPt: "Costa do Marfim", labelEn: "Côte d'Ivoire" },
  { value: "Egito", labelPt: "Egito", labelEn: "Egypt" },
  { value: "Etiópia", labelPt: "Etiópia", labelEn: "Ethiopia" },
  { value: "Gana", labelPt: "Gana", labelEn: "Ghana" },
  { value: "Quênia", labelPt: "Quênia", labelEn: "Kenya" },
  { value: "Marrocos", labelPt: "Marrocos", labelEn: "Morocco" },
  { value: "Namíbia", labelPt: "Namíbia", labelEn: "Namibia" },
  { value: "Moçambique", labelPt: "Moçambique", labelEn: "Mozambique" },
  { value: "Nigéria", labelPt: "Nigéria", labelEn: "Nigeria" },
  { value: "República Democrática do Congo", labelPt: "República Democrática do Congo", labelEn: "Democratic Republic of the Congo" },
  { value: "Ruanda", labelPt: "Ruanda", labelEn: "Rwanda" },
  { value: "Senegal", labelPt: "Senegal", labelEn: "Senegal" },
  { value: "Sudão", labelPt: "Sudão", labelEn: "Sudan" },
  { value: "Tanzânia", labelPt: "Tanzânia", labelEn: "Tanzania" },
  { value: "Tunísia", labelPt: "Tunísia", labelEn: "Tunisia" },
  { value: "Uganda", labelPt: "Uganda", labelEn: "Uganda" },
  { value: "Zâmbia", labelPt: "Zâmbia", labelEn: "Zambia" },
  { value: "Zimbábue", labelPt: "Zimbábue", labelEn: "Zimbabwe" },
  { value: "Outro país", labelPt: "Outro país", labelEn: "Other country" },
];

const healthProfessionOptions = [
  { value: "Estudante", labelPt: "Estudante", labelEn: "Student" },
  { value: "Médico(a)", labelPt: "Médico(a)", labelEn: "Physician" },
  { value: "Enfermeiro(a)", labelPt: "Enfermeiro(a)", labelEn: "Nurse" },
  { value: "Fisioterapeuta", labelPt: "Fisioterapeuta", labelEn: "Physiotherapist" },
  { value: "Farmacêutico(a)", labelPt: "Farmacêutico(a)", labelEn: "Pharmacist" },
  { value: "Nutricionista", labelPt: "Nutricionista", labelEn: "Nutritionist" },
  { value: "Psicólogo(a)", labelPt: "Psicólogo(a)", labelEn: "Psychologist" },
  { value: "Odontólogo(a)", labelPt: "Odontólogo(a)", labelEn: "Dentist" },
  { value: "Fonoaudiólogo(a)", labelPt: "Fonoaudiólogo(a)", labelEn: "Speech Therapist" },
  { value: "Terapeuta ocupacional", labelPt: "Terapeuta ocupacional", labelEn: "Occupational Therapist" },
  { value: "Biomédico(a)", labelPt: "Biomédico(a)", labelEn: "Biomedical Scientist" },
  { value: "Engenheiro(a) biomédico(a)", labelPt: "Engenheiro(a) biomédico(a)", labelEn: "Biomedical engineer" },
  { value: "Engenheiro(a) eletricista", labelPt: "Engenheiro(a) eletricista", labelEn: "Electrical Engineer" },
  { value: "Outras engenharias", labelPt: "Outras engenharias", labelEn: "Other Engineering" },
  { value: "Físico(a) médico(a)", labelPt: "Físico(a) médico(a)", labelEn: "Medical Physicist" },
  { value: "Técnico(a) em radiologia", labelPt: "Técnico(a) em radiologia", labelEn: "Radiology Technician" },
  { value: "Outra", labelPt: "Outra", labelEn: "Other" },
];

const Profile = () => {
  const { user, profile, loading: authLoading, updateProfile } = useAuth();
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [allBadges, setAllBadges] = useState<any[]>([]);
  const [progress, setProgress] = useState<UserProgressItem[]>([]);
  const [pointsHistory, setPointsHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    institution: "",
    birthDate: "",
    gender: "prefiro_nao_dizer" as "masculino" | "feminino" | "prefiro_nao_dizer",
    stateUf: "",
    city: "",
    country: "",
    educationLevel: "",
    profession: "",
    isBrazil: true,
  });

  const setProfileField = (
    field: keyof typeof profileForm,
    value: string | boolean
  ) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };
  const sortedCountryOptions = useMemo(() => {
    return [...countryOptions].sort((a, b) => {
      const left = isEnglish ? a.labelEn : a.labelPt;
      const right = isEnglish ? b.labelEn : b.labelPt;
      return left.localeCompare(right, isEnglish ? "en" : "pt-BR", { sensitivity: "base" });
    });
  }, [isEnglish]);

  const sortedHealthProfessionOptions = useMemo(() => {
    return [...healthProfessionOptions].sort((a, b) => {
      const left = isEnglish ? a.labelEn : a.labelPt;
      const right = isEnglish ? b.labelEn : b.labelPt;
      return left.localeCompare(right, isEnglish ? "en" : "pt-BR", { sensitivity: "base" });
    });
  }, [isEnglish]);


  const splitFullName = (fullName: string | null | undefined) => {
    const safeName = (fullName || "").trim();
    if (!safeName) return { firstName: "", lastName: "" };
    const nameParts = safeName.split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ");
    return { firstName, lastName };
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      loadProfileData();
    }
  }, [user, authLoading, navigate]);

  const loadProfileData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      await gamificationService.backfillMissingPoints(user.id);
      const [statsData, badgesData, allBadgesData, progressData, historyData] = await Promise.all([
        gamificationService.getUserStats(user.id),
        gamificationService.getUserBadges(user.id),
        gamificationService.getAllBadgesWithProgress(user.id),
        progressService.getUserProgress(user.id),
        progressService.getPointsHistory(user.id),
      ]);

      setStats(statsData);
      setBadges(badgesData);
      setAllBadges(allBadgesData);
      setProgress(progressData);
      setPointsHistory(historyData);
    } catch (error) {
      console.error("Erro ao carregar dados do perfil:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const names = splitFullName(profile?.full_name);
    const isBrazilProfile = (profile?.country || "Brasil") === "Brasil";
    setProfileForm({
      firstName: names.firstName,
      lastName: names.lastName,
      institution: profile?.institution || "",
      birthDate: profile?.birth_date || "",
      gender: (profile?.gender as "masculino" | "feminino" | "prefiro_nao_dizer") || "prefiro_nao_dizer",
      stateUf: profile?.state_uf || "",
      city: profile?.city || "",
      country: isBrazilProfile ? "" : (profile?.country || ""),
      educationLevel: profile?.education_level || "",
      profession: profile?.profession || "",
      isBrazil: isBrazilProfile,
    });
  }, [profile]);

  useEffect(() => {
    const fetchCities = async () => {
      if (!profileForm.isBrazil || !profileForm.stateUf) {
        setCities([]);
        if (!profileForm.isBrazil) {
          setProfileForm((prev) => ({ ...prev, stateUf: "", city: "" }));
        } else {
          setProfileForm((prev) => ({ ...prev, city: "" }));
        }
        return;
      }

      try {
        setCitiesLoading(true);
        const response = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${profileForm.stateUf}/municipios`
        );
        if (!response.ok) {
          throw new Error("Falha ao carregar cidades");
        }
        const data = (await response.json()) as Array<{ nome: string }>;
        setCities(data.map((item) => item.nome));
      } catch (error) {
        console.error("Erro ao buscar cidades:", error);
        setCities([]);
        toast.error("Não foi possível carregar as cidades desse estado.");
      } finally {
        setCitiesLoading(false);
      }
    };

    void fetchCities();
  }, [profileForm.isBrazil, profileForm.stateUf]);

  const handleSaveProfile = async () => {
    const firstName = profileForm.firstName.trim();
    const lastName = profileForm.lastName.trim();
    const fullName = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();

    if (!firstName || !lastName) {
      toast.error("Informe nome e sobrenome");
      return;
    }

    if (fullName.length < 2 || fullName.length > 100) {
      toast.error("Nome completo inválido");
      return;
    }

    if (!profileForm.birthDate) {
      toast.error("Informe a data de nascimento");
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile({
        full_name: fullName,
        institution: profileForm.institution.trim() || null,
        birth_date: profileForm.birthDate,
        gender: profileForm.gender,
        state_uf: profileForm.isBrazil ? (profileForm.stateUf.trim() || null) : null,
        city: profileForm.isBrazil ? (profileForm.city.trim() || null) : null,
        country: profileForm.isBrazil ? "Brasil" : (profileForm.country.trim() || null),
        education_level: profileForm.educationLevel.trim() || null,
        profession: profileForm.profession.trim() || null,
      });

      toast.success("Perfil atualizado com sucesso!");
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      toast.error("Não foi possível atualizar o perfil");
    } finally {
      setSavingProfile(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {isEnglish ? "Loading profile..." : "Carregando perfil..."}
          </p>
        </div>
      </div>
    );
  }

  const levelProgress = stats?.total_xp 
    ? ((stats.total_xp % 100) / 100) * 100 
    : 0;
  const currentLevel = stats?.total_xp 
    ? Math.floor(Math.sqrt(stats.total_xp / 100))
    : 0;
  const xpToNext = 100 - (stats?.total_xp % 100 || 0);
  const profileInitial = profile?.full_name?.charAt(0)?.toUpperCase() || "U";
  const studyHours = Math.floor((stats?.total_time_minutes || 0) / 60);
  const selectedBirthDate = profileForm.birthDate
    ? new Date(`${profileForm.birthDate}T00:00:00`)
    : undefined;

  const labels = {
    back: isEnglish ? "Dashboard" : "Dashboard",
    title: isEnglish ? "Profile" : "Perfil",
    edit: isEnglish ? "Edit" : "Editar",
    level: isEnglish ? "Level" : "Nível",
    xpTotal: isEnglish ? "Total XP" : "XP Total",
    xpNext: isEnglish ? "XP to next level" : "XP p/ próximo nível",
    streak: "Streak",
    capsules: isEnglish ? "Capsules" : "Cápsulas",
    modules: isEnglish ? "Modules" : "Módulos",
    hours: isEnglish ? "Hours" : "Horas",
    badges: "Badges",
    progress: isEnglish ? "Progress" : "Progresso",
    history: isEnglish ? "Points" : "Pontos",
    password: isEnglish ? "Change password" : "Alterar senha",
    noBadges: isEnglish ? "No badges yet" : "Nenhum badge ainda",
    noBadgesHint: isEnglish
      ? "Complete lessons and modules to earn badges."
      : "Complete aulas e cápsulas para ganhar badges.",
    badgesUnlocked: isEnglish ? "Unlocked" : "Desbloqueados",
    badgesLocked: isEnglish ? "In progress" : "Em progresso",
    noProgress: isEnglish ? "No progress yet" : "Nenhum progresso ainda",
    noProgressHint: isEnglish
      ? "Start studying to see your progress here."
      : "Comece a estudar para ver seu progresso aqui.",
    noHistory: isEnglish ? "No history yet" : "Nenhum histórico",
    noHistoryHint: isEnglish
      ? "Complete activities to earn points."
      : "Complete atividades para ganhar pontos.",
    completed: isEnglish ? "Completed" : "Concluído",
    inProgress: isEnglish ? "In progress" : "Em progresso",
    lesson: isEnglish ? "Lesson" : "Aula",
    capsule: isEnglish ? "Capsule" : "Cápsula",
    progressSummary: isEnglish ? "Your activity" : "Sua atividade",
    goStudy: isEnglish ? "Explore content" : "Explorar conteúdo",
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <header className="safe-sticky-top border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto flex items-center gap-2 px-3 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="h-9 shrink-0 px-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">{labels.back}</span>
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{labels.title}</h1>
          <ThemeToggle />
        </div>
      </header>

      <div className="container mx-auto space-y-4 px-3 py-4 sm:space-y-6 sm:py-6">
        {/* Senha */}
        {isMobile ? (
          <details className="rounded-xl border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <Lock className="h-4 w-4 text-muted-foreground" />
              {labels.password}
            </summary>
            <div className="border-t border-border px-4 pb-4 pt-2">
              <ChangePasswordForm />
            </div>
          </details>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4" />
                {labels.password}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>
        )}

        {/* Hero */}
        <section className="overflow-hidden rounded-xl gradient-hero p-4 text-white shadow-glow sm:p-5">
          <div className="flex items-start gap-3">
            <Avatar className="h-14 w-14 shrink-0 border-2 border-white/25 sm:h-16 sm:w-16">
              <AvatarFallback className="bg-white/15 text-lg font-bold text-white sm:text-xl">
                {profileInitial}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-bold leading-tight sm:text-xl">
                  {profile?.full_name || (isEnglish ? "User" : "Usuário")}
                </h2>
                <Badge className="shrink-0 border-white/25 bg-white/15 text-[10px] text-white hover:bg-white/15">
                  {labels.level} {currentLevel}
                </Badge>
              </div>

              {(profile?.profession || profile?.professional_role) && (
                <p className="mt-0.5 truncate text-xs text-white/70">
                  {profile.profession || profile.professional_role}
                </p>
              )}
            </div>

            <Button
              variant="secondary"
              size="sm"
              className="h-8 shrink-0 bg-white/15 px-2.5 text-xs text-white hover:bg-white/25 sm:h-9 sm:px-3"
              onClick={() => setIsEditDialogOpen(true)}
            >
              <Edit className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">{labels.edit}</span>
            </Button>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/80 sm:text-xs">
              <span>{labels.xpTotal}: {stats?.total_xp || 0}</span>
              <span>{xpToNext} {labels.xpNext}</span>
            </div>
            <Progress value={levelProgress} className="h-1.5 bg-white/20 [&>div]:bg-white" />
          </div>
        </section>

        {/* Stats compactos */}
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">{labels.streak}</p>
                <p className="text-lg font-semibold leading-tight">
                  {stats?.streak_days || 0}
                  <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                    {isEnglish ? "d" : "d"}
                  </span>
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">{labels.capsules}</p>
                <p className="text-lg font-semibold leading-tight">{stats?.capsules_completed || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">{labels.hours}</p>
                <p className="text-lg font-semibold leading-tight">{studyHours}h</p>
              </div>
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Award className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">{labels.badges}</p>
                <p className="text-lg font-semibold leading-tight">{badges.length}</p>
              </div>
            </div>
          </Card>
        </section>

        {/* Tabs */}
        <Tabs defaultValue="badges" className="space-y-4">
          <TabsList
            className={cn(
              "grid h-auto w-full gap-1 bg-muted/60 p-1",
              isMobile ? "grid-cols-3" : "grid-cols-3 sm:w-auto sm:inline-flex",
            )}
          >
            <TabsTrigger value="badges" className="min-w-0 px-1.5 text-[11px] sm:px-3 sm:text-sm">
              <Award className="mr-1 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{labels.badges} ({badges.length})</span>
            </TabsTrigger>
            <TabsTrigger value="progress" className="min-w-0 px-1.5 text-[11px] sm:px-3 sm:text-sm">
              <BookOpen className="mr-1 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{labels.progress}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="min-w-0 px-1.5 text-[11px] sm:px-3 sm:text-sm">
              <TrendingUp className="mr-1 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{labels.history}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="badges" className="mt-0 space-y-4">
            {badges.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {labels.badgesUnlocked}
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                  {badges.map((badge) => (
                    <Card key={badge.id} className="border-emerald-500/30 bg-emerald-500/5 p-3 text-center sm:p-4">
                      <div className="mb-2 flex justify-center">
                        <BadgeIcon iconName={badge.badges.icon_name} unlocked size="lg" />
                      </div>
                      <h4 className="line-clamp-2 text-xs font-semibold sm:text-sm">{badge.badges.name}</h4>
                      <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground sm:text-xs">
                        {badge.badges.description}
                      </p>
                      <p className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400">
                        {new Date(badge.earned_at).toLocaleDateString(isEnglish ? "en-US" : "pt-BR")}
                      </p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {badges.length > 0 ? labels.badgesLocked : labels.badges}
              </h3>
              {allBadges.filter((b) => !b.unlocked).length === 0 && badges.length === 0 ? (
                <Card className="p-8 text-center sm:p-12">
                  <Award className="mx-auto mb-3 h-12 w-12 text-muted-foreground/60" />
                  <h3 className="text-base font-semibold sm:text-lg">{labels.noBadges}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{labels.noBadgesHint}</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {allBadges
                    .filter((b) => !b.unlocked)
                    .map((badge) => (
                      <Card key={badge.id} className="p-3 sm:p-4">
                        <div className="flex items-start gap-3">
                          <BadgeIcon iconName={badge.icon_name} unlocked={false} size="md" />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold">{badge.name}</h4>
                            <p className="mt-0.5 text-xs text-muted-foreground">{badge.description}</p>
                            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>
                                {badge.current}/{badge.target}
                              </span>
                              <span>+{badge.points} XP</span>
                            </div>
                            <Progress value={badge.progress} className="mt-1.5 h-1.5" />
                          </div>
                        </div>
                      </Card>
                    ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="progress" className="mt-0">
            {progress.length === 0 ? (
              <Card className="p-8 text-center sm:p-12">
                <BookOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground/60" />
                <h3 className="text-base font-semibold sm:text-lg">{labels.noProgress}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{labels.noProgressHint}</p>
                <Button className="mt-4" size="sm" onClick={() => navigate("/capsulas")}>
                  {labels.goStudy}
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {labels.progressSummary}
                </p>
                <div className="space-y-2">
                  {progress.map((item) => {
                    const isDone = item.status === "concluido";
                    const TypeIcon = item.type === "capsule" ? BookMarked : GraduationCap;
                    return (
                      <Card
                        key={`${item.type}-${item.id}`}
                        className="cursor-pointer p-3 transition-colors hover:bg-muted/30 sm:p-4"
                        onClick={() =>
                          navigate(item.type === "capsule" ? `/capsula/${item.resourceId}` : `/lesson/${item.resourceId}`)
                        }
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                              isDone
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "border-border bg-muted/40 text-muted-foreground",
                            )}
                          >
                            <TypeIcon className="h-4 w-4" strokeWidth={1.75} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  {item.type === "capsule" ? labels.capsule : labels.lesson}
                                </p>
                                <h4 className="truncate text-sm font-semibold">{item.title}</h4>
                              </div>
                              {isDone ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                                  {item.progress_percentage}%
                                </span>
                              )}
                            </div>
                            {!isDone && item.progress_percentage > 0 && (
                              <Progress value={item.progress_percentage} className="mt-2 h-1.5" />
                            )}
                            {item.data_conclusao && isDone && (
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                {new Date(item.data_conclusao).toLocaleDateString(isEnglish ? "en-US" : "pt-BR")}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            {pointsHistory.length === 0 ? (
              <Card className="p-8 text-center sm:p-12">
                <TrendingUp className="mx-auto mb-3 h-12 w-12 text-muted-foreground/60" />
                <h3 className="text-base font-semibold sm:text-lg">{labels.noHistory}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{labels.noHistoryHint}</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {pointsHistory.map((entry) => (
                  <Card key={entry.id} className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{entry.descricao}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleString(isEnglish ? "en-US" : "pt-BR")}
                        </p>
                      </div>
                      <Badge className="shrink-0 bg-emerald-600 hover:bg-emerald-600">
                        +{entry.pontos} XP
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
            <DialogDescription>
              Atualize seus dados cadastrais. Ao salvar, as informações serão enviadas ao servidor.
            </DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="profile-first-name">Nome</Label>
              <Input
                id="profile-first-name"
                value={profileForm.firstName}
                onChange={(e) => setProfileField("firstName", e.target.value)}
                disabled={savingProfile}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-last-name">Sobrenome</Label>
              <Input
                id="profile-last-name"
                value={profileForm.lastName}
                onChange={(e) => setProfileField("lastName", e.target.value)}
                disabled={savingProfile}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="profile-email">E-mail</Label>
              <Input
                id="profile-email"
                value={profile?.email || user?.email || ""}
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-institution">Instituição</Label>
              <Input
                id="profile-institution"
                value={profileForm.institution}
                onChange={(e) => setProfileField("institution", e.target.value)}
                disabled={savingProfile}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-birth-date">Data de nascimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    disabled={savingProfile}
                  >
                    {formatIsoDateForInput(profileForm.birthDate, isEnglish) || (isEnglish ? "MM/DD/YYYY" : "DD/MM/AAAA")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedBirthDate}
                    onSelect={(date) => {
                      if (!date) {
                        setProfileField("birthDate", "");
                        return;
                      }
                      const yyyy = date.getFullYear();
                      const mm = String(date.getMonth() + 1).padStart(2, "0");
                      const dd = String(date.getDate()).padStart(2, "0");
                      setProfileField("birthDate", `${yyyy}-${mm}-${dd}`);
                    }}
                    locale={isEnglish ? enUS : ptBR}
                    captionLayout="dropdown"
                    fromDate={new Date(1900, 0, 1)}
                    toDate={new Date()}
                  />
                </PopoverContent>
              </Popover>
              <input type="hidden" id="profile-birth-date" value={profileForm.birthDate} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-gender">Gênero</Label>
              <select
                id="profile-gender"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={profileForm.gender}
                onChange={(e) => setProfileField("gender", e.target.value)}
                disabled={savingProfile}
              >
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
                <option value="prefiro_nao_dizer">Prefiro não dizer</option>
              </select>
            </div>

            <div className="space-y-2" data-no-auto-translate="true">
              <Label>{isEnglish ? "Do you live in Brazil?" : "Você mora no Brasil?"}</Label>
              <Select
                value={profileForm.isBrazil ? "br" : "intl"}
                onValueChange={(value) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    isBrazil: value === "br",
                    stateUf: "",
                    city: "",
                    country: value === "br" ? "" : prev.country,
                  }))
                }
                disabled={savingProfile}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isEnglish ? "Select" : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="br">{isEnglish ? "Yes, I live in Brazil" : "Sim, moro no Brasil"}</SelectItem>
                  <SelectItem value="intl">{isEnglish ? "No, I live outside Brazil" : "Não, moro fora do Brasil"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {profileForm.isBrazil ? (
              <>
                <div className="space-y-2">
                  <Label>{isEnglish ? "State" : "Estado"}</Label>
                  <Select
                    value={profileForm.stateUf}
                    onValueChange={(value) =>
                      setProfileForm((prev) => ({ ...prev, stateUf: value, city: "" }))
                    }
                    disabled={savingProfile}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isEnglish ? "Select state" : "Selecione o estado"} />
                    </SelectTrigger>
                    <SelectContent>
                      {brazilianStates.map((state) => (
                        <SelectItem key={state.uf} value={state.uf}>
                          {state.name} ({state.uf})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{isEnglish ? "City" : "Cidade"}</Label>
                  <Select
                    value={profileForm.city}
                    onValueChange={(value) => setProfileField("city", value)}
                    disabled={!profileForm.stateUf || citiesLoading || cities.length === 0 || savingProfile}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !profileForm.stateUf
                            ? (isEnglish ? "Choose a state first" : "Escolha um estado antes")
                            : citiesLoading
                              ? (isEnglish ? "Loading cities..." : "Carregando cidades...")
                              : (isEnglish ? "Select city" : "Selecione a cidade")
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((cityName) => (
                        <SelectItem key={cityName} value={cityName}>
                          {cityName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>{isEnglish ? "Country" : "País"}</Label>
                <Select
                  value={profileForm.country}
                  onValueChange={(value) => setProfileField("country", value)}
                  disabled={savingProfile}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isEnglish ? "Select your country" : "Selecione seu país"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedCountryOptions.map((country) => (
                      <SelectItem key={country.value} value={country.value}>
                        {isEnglish ? country.labelEn : country.labelPt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2" data-no-auto-translate="true">
              <Label>{isEnglish ? "Education" : "Escolaridade"}</Label>
              <Select
                value={profileForm.educationLevel}
                onValueChange={(value) => setProfileField("educationLevel", value)}
                disabled={savingProfile}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isEnglish ? "Select" : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  {educationLevelOptions.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {isEnglish ? level.labelEn : level.labelPt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2" data-no-auto-translate="true">
              <Label>{isEnglish ? "Profession" : "Profissão"}</Label>
              <Select
                value={profileForm.profession}
                onValueChange={(value) => setProfileField("profession", value)}
                disabled={savingProfile}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isEnglish ? "Select" : "Selecione"} />
                </SelectTrigger>
                <SelectContent data-no-auto-translate="true">
                  {sortedHealthProfessionOptions.map((profession) => (
                    <SelectItem key={profession.value} value={profession.value}>
                      {isEnglish ? profession.labelEn : profession.labelPt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={savingProfile}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Separate component for Change Password form
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Senha atual é obrigatória"),
    newPassword: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres").max(100),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "A nova senha deve ser diferente da senha atual",
    path: ["newPassword"],
  });

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = changePasswordSchema.parse({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setLoading(true);

      // Get current user email
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser?.email) {
        toast.error("Erro ao obter informações do usuário");
        return;
      }

      // Verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: validated.currentPassword,
      });

      if (signInError) {
        toast.error("Senha atual incorreta");
        return;
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: validated.newPassword,
      });

      if (updateError) {
        toast.error("Erro ao alterar senha", {
          description: updateError.message,
        });
      } else {
        toast.success("Senha alterada com sucesso!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Ocorreu um erro ao alterar a senha");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
      <div>
        <Label htmlFor="currentPassword">Senha Atual</Label>
        <Input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <Separator />

      <div>
        <Label htmlFor="newPassword">Nova Senha</Label>
        <Input
          id="newPassword"
          type="password"
          placeholder="Mínimo 6 caracteres"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Digite a senha novamente"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Alterando..." : "Alterar Senha"}
      </Button>
    </form>
  );
}

export default Profile;