import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase, APP_URL } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { z } from "zod";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { enUS, ptBR } from "date-fns/locale";

const brazilianStates = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
];

const genderOptions = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "prefiro_nao_dizer", label: "Prefiro não dizer" },
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
  // África (principais países)
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
  {
    value: "Engenheiro(a) biomédico(a)",
    labelPt: "Engenheiro(a) biomédico(a)",
    labelEn: "Biomedical engineer",
  },
  { value: "Engenheiro(a) eletricista", labelPt: "Engenheiro(a) eletricista", labelEn: "Electrical Engineer" },
  { value: "Outras engenharias", labelPt: "Outras engenharias", labelEn: "Other Engineering" },
  { value: "Físico(a) médico(a)", labelPt: "Físico(a) médico(a)", labelEn: "Medical Physicist" },
  { value: "Técnico(a) em radiologia", labelPt: "Técnico(a) em radiologia", labelEn: "Radiology Technician" },
  { value: "Outra", labelPt: "Outra", labelEn: "Other" },
];

const LEGAL_SETTINGS_ID = "00000000-0000-0000-0000-000000000002";

const defaultLegalText = `TERMOS DE PRIVACIDADE E USO - PROGENIA

1. Coleta e uso de dados
Coletamos dados cadastrais e de uso da plataforma para oferecer uma melhor experiência educacional.

2. Finalidade
Os dados são utilizados para autenticação, personalização do conteúdo, análises internas e comunicação com o usuário.

3. Compartilhamento
Não vendemos dados pessoais. O compartilhamento ocorre apenas quando necessário para operação da plataforma e em conformidade com a legislação.

4. Segurança
Adotamos medidas técnicas e administrativas para proteção das informações.

5. Direitos do titular
Você pode solicitar atualização, correção ou exclusão dos seus dados, conforme a legislação aplicável.

6. Aceite
Ao criar sua conta, você declara que leu e concorda com estes termos de privacidade e uso.`;

const signUpSchema = z.object({
  firstName: z.string().trim().min(1, "Nome é obrigatório").max(60),
  lastName: z.string().trim().min(1, "Sobrenome é obrigatório").max(60),
  email: z.string().trim().email("Endereço de e-mail inválido").max(255),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres").max(100),
  confirmPassword: z.string().min(1, "Confirme sua senha"),
  institution: z.string().trim().max(200).optional(),
  birthDate: z
    .string()
    .min(1, "Data de nascimento é obrigatória")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Data de nascimento inválida")
    .refine((value) => new Date(value) <= new Date(), "Data de nascimento não pode ser no futuro"),
  gender: z.enum(["masculino", "feminino", "prefiro_nao_dizer"], {
    required_error: "Gênero é obrigatório",
  }),
  isBrazil: z.boolean(),
  stateUf: z.string().trim().max(2).optional(),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  educationLevel: z.string().trim().min(1, "Escolaridade é obrigatória").max(80),
  profession: z.string().trim().min(1, "Profissão é obrigatória").max(80),
  professionOther: z.string().trim().max(120).optional(),
  termsAccepted: z.boolean(),
}).superRefine((data, ctx) => {
  const fullName = `${data.firstName} ${data.lastName}`.trim();
  if (fullName.length < 2) {
    ctx.addIssue({
      path: ["lastName"],
      code: z.ZodIssueCode.custom,
      message: "Informe seu nome e sobrenome",
    });
  }
  if (fullName.length > 100) {
    ctx.addIssue({
      path: ["lastName"],
      code: z.ZodIssueCode.custom,
      message: "Nome completo muito longo",
    });
  }

  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      path: ["confirmPassword"],
      code: z.ZodIssueCode.custom,
      message: "As senhas não coincidem",
    });
  }

  if (!data.termsAccepted) {
    ctx.addIssue({
      path: ["termsAccepted"],
      code: z.ZodIssueCode.custom,
      message: "Você precisa aceitar os termos de privacidade e uso",
    });
  }

  if (data.profession === "Outra" && !data.professionOther?.trim()) {
    ctx.addIssue({
      path: ["professionOther"],
      code: z.ZodIssueCode.custom,
      message: "Informe sua profissão",
    });
  }

  if (data.isBrazil) {
    if (!data.stateUf || data.stateUf.length !== 2) {
      ctx.addIssue({
        path: ["stateUf"],
        code: z.ZodIssueCode.custom,
        message: "Estado é obrigatório",
      });
    }
    if (!data.city?.trim()) {
      ctx.addIssue({
        path: ["city"],
        code: z.ZodIssueCode.custom,
        message: "Cidade é obrigatória",
      });
    }
  } else if (!data.country?.trim()) {
    ctx.addIssue({
      path: ["country"],
      code: z.ZodIssueCode.custom,
      message: "País é obrigatório",
    });
  }
});

const signInSchema = z.object({
  email: z.string().trim().email("Endereço de e-mail inválido"),
  password: z.string().min(1, "A senha é obrigatória"),
});

const formatIsoDateForInput = (iso: string, isEnglish: boolean) => {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const [, yyyy, mm, dd] = match;
  return isEnglish ? `${mm}/${dd}/${yyyy}` : `${dd}/${mm}/${yyyy}`;
};

const parseBirthDateInputToIso = (input: string, isEnglish: boolean) => {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  // Suporte caso já venha como ISO.
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;

  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;

  const [, a, b, yyyy] = match;
  const day = isEnglish ? Number(b) : Number(a);
  const month = isEnglish ? Number(a) : Number(b);
  const year = Number(yyyy);

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return undefined;

  // Cria data em UTC e valida se "bate" (evita 31/02 virar 03/03).
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return undefined;
  }

  const isoMonth = String(month).padStart(2, "0");
  const isoDay = String(day).padStart(2, "0");
  return `${year}-${isoMonth}-${isoDay}`;
};

const Auth = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const [loading, setLoading] = useState(false);
  const [activeAuthTab, setActiveAuthTab] = useState<"signin" | "signup">("signin");
  
  // Sign Up State
  const [signUpData, setSignUpData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    institution: "",
    birthDate: "",
    gender: "",
    isBrazil: true,
    stateUf: "",
    city: "",
    country: "",
    educationLevel: "",
    profession: "",
    professionOther: "",
    termsAccepted: false,
  });
  const [birthDateInput, setBirthDateInput] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [isLegalDialogOpen, setIsLegalDialogOpen] = useState(false);
  const [legalText, setLegalText] = useState(defaultLegalText);
  const [loadingLegalText, setLoadingLegalText] = useState(false);
  const [isEmailConfirmDialogOpen, setIsEmailConfirmDialogOpen] = useState(false);

  useEffect(() => {
    setBirthDateInput(formatIsoDateForInput(signUpData.birthDate, isEnglish));
  }, [signUpData.birthDate, isEnglish]);

  const selectedBirthDate = signUpData.birthDate
    ? new Date(`${signUpData.birthDate}T00:00:00`)
    : undefined;

  const sortedCountryOptions = [...countryOptions].sort((a, b) => {
    const left = isEnglish ? a.labelEn : a.labelPt;
    const right = isEnglish ? b.labelEn : b.labelPt;
    return left.localeCompare(right, isEnglish ? "en" : "pt-BR", { sensitivity: "base" });
  });

  const sortedHealthProfessionOptions = [...healthProfessionOptions].sort((a, b) => {
    const left = isEnglish ? a.labelEn : a.labelPt;
    const right = isEnglish ? b.labelEn : b.labelPt;
    return left.localeCompare(right, isEnglish ? "en" : "pt-BR", { sensitivity: "base" });
  });

  // Sign In State
  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });

  useEffect(() => {
    // 1) Ouvir mudanças de auth primeiro
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const isEmailConfirmed = session.user.email_confirmed_at != null;
        const { data: profile } = await supabase
          .from('profiles')
          .select('email_verified')
          .eq('id', session.user.id)
          .maybeSingle();
        if (isEmailConfirmed || profile?.email_verified) {
          navigate('/dashboard');
        }
      }
    });

    // 2) Verificar estado atual com getUser
    supabase.auth.getUser().then(async ({ data }) => {
      if (data?.user) {
        const isEmailConfirmed = data.user.email_confirmed_at != null;
        const { data: profile } = await supabase
          .from('profiles')
          .select('email_verified')
          .eq('id', data.user.id)
          .maybeSingle();
        if (isEmailConfirmed || profile?.email_verified) {
          navigate('/dashboard');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchCities = async () => {
      if (!signUpData.isBrazil || !signUpData.stateUf) {
        setCities([]);
        if (!signUpData.isBrazil) {
          setSignUpData((prev) => ({ ...prev, stateUf: "", city: "" }));
        } else {
          setSignUpData((prev) => ({ ...prev, city: "" }));
        }
        return;
      }

      try {
        setCitiesLoading(true);
        const response = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${signUpData.stateUf}/municipios`,
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
  }, [signUpData.isBrazil, signUpData.stateUf]);

  useEffect(() => {
    const loadLegalText = async () => {
      try {
        setLoadingLegalText(true);
        const { data, error } = await supabase
          .from("legal_settings")
          .select("terms_privacy_text")
          .eq("id", LEGAL_SETTINGS_ID)
          .maybeSingle();

        if (error) throw error;
        if (data?.terms_privacy_text) {
          setLegalText(data.terms_privacy_text);
        }
      } catch (error) {
        console.error("Erro ao carregar termos de privacidade e uso:", error);
      } finally {
        setLoadingLegalText(false);
      }
    };

    void loadLegalText();
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const parsedBirthDateIso = parseBirthDateInputToIso(birthDateInput, isEnglish);
      const validated = signUpSchema.parse({
        ...signUpData,
        birthDate: parsedBirthDateIso ?? signUpData.birthDate,
      });
      const resolvedProfession =
        validated.profession === "Outra" ? validated.professionOther!.trim() : validated.profession;
      setLoading(true);

      // Create user with Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: `${APP_URL}/verify-email`,
          data: {
            full_name: `${validated.firstName} ${validated.lastName}`.replace(/\s+/g, " ").trim(),
            institution: validated.institution,
            birth_date: validated.birthDate,
            gender: validated.gender,
            state_uf: validated.isBrazil ? validated.stateUf : null,
            city: validated.isBrazil ? validated.city : null,
            country: validated.isBrazil ? "Brasil" : validated.country,
            education_level: validated.educationLevel,
            profession: resolvedProfession,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          toast.error("Este e-mail já está registrado. Por favor, faça login.");
        } else {
          toast.error(signUpError.message);
        }
        return;
      }

      if (authData.user) {
        // Supabase envia o email de confirmação automaticamente (Resend/SMTP).
        // O fluxo customizado (token + send-verification-email) foi removido
        // para evitar duplicidade e mensagens de erro falsas.
        setIsEmailConfirmDialogOpen(true);

        // Sign out até o usuário confirmar o email
        await supabase.auth.signOut();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Ocorreu um erro durante o cadastro");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = signInSchema.parse(signInData);
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("E-mail ou senha inválidos");
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("E-mail não verificado", {
            description: "Por favor, verifique seu e-mail e clique no link de confirmação antes de fazer login.",
          });
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Verificar se o email foi verificado (Supabase nativo ou perfil custom)
      if (data.user) {
        const isEmailConfirmed = data.user.email_confirmed_at != null;
        const { data: profile } = await supabase
          .from('profiles')
          .select('email_verified')
          .eq('id', data.user.id)
          .maybeSingle();
        if (!isEmailConfirmed && !profile?.email_verified) {
          await supabase.auth.signOut();
          toast.error("E-mail não verificado", {
            description: "Por favor, verifique seu e-mail e clique no link de confirmação para ativar sua conta.",
          });
          return;
        }
      }

      toast.success("Bem-vindo de volta!");
      navigate('/dashboard');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Ocorreu um erro durante o login");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <img src={logo} alt="ProGenia" className="h-16 mx-auto mb-4 progenia-logo" />
          <h1 className="text-3xl font-bold">Bem-vindo à ProGenia</h1>
          <p className="text-muted-foreground mt-2">
            Sua jornada para dominar a tecnologia médica começa aqui
          </p>
        </div>

        <Card className="p-6">
          <Tabs value={activeAuthTab} onValueChange={(v) => setActiveAuthTab(v as "signin" | "signup")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">E-mail</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder={isEnglish ? "your.email@example.com" : "seu.email@exemplo.com"}
                    value={signInData.email}
                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Senha</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={signInData.password}
                    onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full gradient-accent text-white" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>

                <div className="text-center mt-4 space-y-2">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => navigate("/forgot-password")}
                    className="text-sm text-muted-foreground hover:text-primary"
                  >
                    Esqueceu sua senha?
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 px-4">
                    Após criar sua conta, você receberá um e-mail de verificação. Clique no link para ativar sua conta antes de fazer login.
                  </p>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="signup-first-name">{isEnglish ? "First name" : "Nome"}</Label>
                    <Input
                      id="signup-first-name"
                      type="text"
                      placeholder={isEnglish ? "John" : "João"}
                      value={signUpData.firstName}
                      onChange={(e) => setSignUpData({ ...signUpData, firstName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-last-name">{isEnglish ? "Last name" : "Sobrenome"}</Label>
                    <Input
                      id="signup-last-name"
                      type="text"
                      placeholder={isEnglish ? "Smith" : "Silva"}
                      value={signUpData.lastName}
                      onChange={(e) => setSignUpData({ ...signUpData, lastName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-mail</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder={isEnglish ? "your.email@example.com" : "seu.email@exemplo.com"}
                      value={signUpData.email}
                      onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-birthdate">Data de nascimento</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          {birthDateInput || (isEnglish ? "MM/DD/YYYY" : "DD/MM/AAAA")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={selectedBirthDate}
                          onSelect={(date) => {
                            if (!date) {
                              setSignUpData((prev) => ({ ...prev, birthDate: "" }));
                              return;
                            }
                            const yyyy = date.getFullYear();
                            const mm = String(date.getMonth() + 1).padStart(2, "0");
                            const dd = String(date.getDate()).padStart(2, "0");
                            setSignUpData((prev) => ({
                              ...prev,
                              birthDate: `${yyyy}-${mm}-${dd}`,
                            }));
                          }}
                          locale={isEnglish ? enUS : ptBR}
                          captionLayout="dropdown"
                          fromDate={new Date(1900, 0, 1)}
                          toDate={new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                    <input type="hidden" id="signup-birthdate" value={signUpData.birthDate} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Deve ter pelo menos 8 caracteres</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">Confirmar senha</Label>
                    <Input
                      id="signup-confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={signUpData.confirmPassword}
                      onChange={(e) =>
                        setSignUpData({ ...signUpData, confirmPassword: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Gênero</Label>
                    <Select
                      value={signUpData.gender}
                      onValueChange={(value) => setSignUpData({ ...signUpData, gender: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isEnglish ? "Select" : "Selecione"} />
                      </SelectTrigger>
                      <SelectContent>
                        {genderOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2" data-no-auto-translate="true">
                    <Label>{isEnglish ? "Do you live in Brazil?" : "Você mora no Brasil?"}</Label>
                    <Select
                      value={signUpData.isBrazil ? "br" : "intl"}
                      onValueChange={(value) =>
                        setSignUpData((prev) => ({
                          ...prev,
                          isBrazil: value === "br",
                          stateUf: "",
                          city: "",
                          country: value === "br" ? "" : prev.country,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isEnglish ? "Select" : "Selecione"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="br">{isEnglish ? "Yes, I live in Brazil" : "Sim, moro no Brasil"}</SelectItem>
                        <SelectItem value="intl">
                          {isEnglish ? "No, I live outside Brazil" : "Não, moro fora do Brasil"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {signUpData.isBrazil ? (
                    <>
                      <div className="space-y-2">
                        <Label>Estado</Label>
                        <Select
                          value={signUpData.stateUf}
                          onValueChange={(value) =>
                            setSignUpData((prev) => ({ ...prev, stateUf: value, city: "" }))
                          }
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
                        <Label>Cidade</Label>
                        <Select
                          value={signUpData.city}
                          onValueChange={(value) => setSignUpData({ ...signUpData, city: value })}
                          disabled={!signUpData.stateUf || citiesLoading || cities.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                !signUpData.stateUf
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
                    <div className="space-y-2" data-no-auto-translate="true">
                      <Label>{isEnglish ? "Country" : "País"}</Label>
                      <Select
                        value={signUpData.country}
                        onValueChange={(value) => setSignUpData((prev) => ({ ...prev, country: value }))}
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
                      value={signUpData.educationLevel}
                      onValueChange={(value) => setSignUpData({ ...signUpData, educationLevel: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={language === "en" ? "Select" : "Selecione"} />
                      </SelectTrigger>
                      <SelectContent>
                        {educationLevelOptions.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {language === "en" ? level.labelEn : level.labelPt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2" data-no-auto-translate="true">
                    <Label>Profissão</Label>
                    <Select
                      value={signUpData.profession}
                      onValueChange={(value) => setSignUpData({ ...signUpData, profession: value })}
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

                  {signUpData.profession === "Outra" && (
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="signup-profession-other">Qual sua profissão?</Label>
                      <Input
                        id="signup-profession-other"
                        type="text"
                        placeholder={isEnglish ? "Describe your profession" : "Descreva sua profissão"}
                        value={signUpData.professionOther}
                        onChange={(e) => setSignUpData({ ...signUpData, professionOther: e.target.value })}
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="signup-institution">Instituição onde trabalha ou estuda</Label>
                    <Input
                      id="signup-institution"
                      type="text"
                      placeholder={isEnglish ? "University, hospital, clinic..." : "Universidade, hospital, clínica..."}
                      value={signUpData.institution}
                      onChange={(e) => setSignUpData({ ...signUpData, institution: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-2 flex items-start gap-3 rounded-md border border-border p-3">
                    <Checkbox
                      id="signup-terms"
                      checked={signUpData.termsAccepted}
                      onCheckedChange={(checked) =>
                        setSignUpData({ ...signUpData, termsAccepted: checked === true })
                      }
                    />
                    <div className="text-sm leading-5">
                      <Label htmlFor="signup-terms" className="cursor-pointer">
                        Li e concordo com os{" "}
                      </Label>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 align-baseline text-sm font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                        onClick={() => setIsLegalDialogOpen(true)}
                      >
                        termos de privacidade e uso
                      </Button>
                    </div>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full gradient-accent text-white"
                  disabled={loading || !signUpData.termsAccepted}
                >
                  {loading ? "Criando conta..." : "Criar Conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      <Dialog open={isLegalDialogOpen} onOpenChange={setIsLegalDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Termos de Privacidade e Uso</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm leading-6">
            {loadingLegalText ? "Carregando termos..." : legalText}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEmailConfirmDialogOpen} onOpenChange={setIsEmailConfirmDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{isEnglish ? "Check your email" : "Verifique seu e-mail"}</DialogTitle>
          </DialogHeader>
          <div className="text-sm leading-relaxed text-muted-foreground">
            {isEnglish ? (
              <>
                Your confirmation email may take up to <span className="font-semibold text-foreground">3 minutes</span>{" "}
                to be sent. Please also check your spam folder.
              </>
            ) : (
              <>
                O e-mail de confirmação pode levar até{" "}
                <span className="font-semibold text-foreground">3 minutos</span> para ser enviado. Verifique também a
                pasta de spam.
              </>
            )}
          </div>
          <div className="flex justify-end pt-4">
            <Button
              type="button"
              className="gradient-accent text-white"
              onClick={() => {
                setIsEmailConfirmDialogOpen(false);
                setActiveAuthTab("signin");
              }}
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;