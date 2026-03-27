import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { gamificationService } from "@/services/gamificationService";
import { progressService } from "@/services/progressService";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
import { 
  User, 
  Award, 
  TrendingUp, 
  Trophy, 
  Clock,
  BookOpen,
  ArrowLeft,
  Edit,
  Lock
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
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
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
      const [statsData, badgesData, progressData, historyData] = await Promise.all([
        gamificationService.getUserStats(user.id),
        gamificationService.getUserBadges(user.id),
        progressService.getUserProgress(user.id),
        progressService.getPointsHistory(user.id),
      ]);

      setStats(statsData);
      setBadges(badgesData);
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando perfil...</p>
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
  const selectedBirthDate = profileForm.birthDate
    ? new Date(`${profileForm.birthDate}T00:00:00`)
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>

          <div className="flex items-start gap-6">
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold">
              {profile?.full_name?.charAt(0) || "U"}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{profile?.full_name || "Usuário"}</h1>
                <Badge variant="outline">Nível {currentLevel}</Badge>
              </div>
              
              {profile?.institution && (
                <p className="text-muted-foreground mb-2">📍 {profile.institution}</p>
              )}
              
              {profile?.professional_role && (
                <p className="text-muted-foreground">{profile.professional_role}</p>
              )}

              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setIsEditDialogOpen(true)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar Perfil
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Estatísticas principais */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">XP Total</p>
                <p className="text-2xl font-bold">{stats?.total_xp || 0}</p>
              </div>
            </div>
            <Progress value={levelProgress} className="mt-4" />
            <p className="text-xs text-muted-foreground mt-2">
              {100 - (stats?.total_xp % 100 || 0)} XP para o próximo nível
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Streak</p>
                <p className="text-2xl font-bold">{stats?.streak_days || 0} dias</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Módulos</p>
                <p className="text-2xl font-bold">{stats?.modules_completed || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Horas</p>
                <p className="text-2xl font-bold">
                  {Math.floor((stats?.total_time_minutes || 0) / 60)}h
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="badges" className="space-y-6">
          <TabsList>
            <TabsTrigger value="badges">
              <Award className="mr-2 h-4 w-4" />
              Badges ({badges.length})
            </TabsTrigger>
            <TabsTrigger value="progress">
              <BookOpen className="mr-2 h-4 w-4" />
              Progresso
            </TabsTrigger>
            <TabsTrigger value="history">
              <TrendingUp className="mr-2 h-4 w-4" />
              Histórico de Pontos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="badges">
            {badges.length === 0 ? (
              <Card className="p-12 text-center">
                <Award className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nenhum Badge Ainda</h3>
                <p className="text-muted-foreground">
                  Complete aulas e módulos para ganhar badges!
                </p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
                {badges.map((badge) => (
                  <Card key={badge.id} className="p-6 text-center">
                    <div className="text-4xl mb-3">{badge.badges.icon || "🏆"}</div>
                    <h4 className="font-semibold mb-1">{badge.badges.name}</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      {badge.badges.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(badge.earned_at).toLocaleDateString("pt-BR")}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="progress">
            {progress.length === 0 ? (
              <Card className="p-12 text-center">
                <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nenhum Progresso Ainda</h3>
                <p className="text-muted-foreground">
                  Comece a estudar para ver seu progresso aqui!
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {progress.map((item) => (
                  <Card key={item.id} className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{item.lessons?.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          Status: {item.status === "concluido" ? "✅ Concluído" : "📖 Em progresso"}
                        </p>
                      </div>
                      <Badge variant={item.status === "concluido" ? "default" : "outline"}>
                        {item.status}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            {pointsHistory.length === 0 ? (
              <Card className="p-12 text-center">
                <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nenhum Histórico</h3>
                <p className="text-muted-foreground">
                  Complete atividades para ganhar pontos!
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {pointsHistory.map((entry) => (
                  <Card key={entry.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{entry.descricao}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(entry.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <Badge className="bg-green-500">+{entry.pontos} XP</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Change Password Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Alterar Senha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
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