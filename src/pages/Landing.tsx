import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from "react";
import { virtualLabService, type VirtualLab } from "@/services/virtualLabService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  GraduationCap,
  Brain,
  Award,
  Microscope,
  Zap,
  BookOpen,
  Newspaper,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import logo from "@/assets/logo.png";
import landingHeroVideoPoster from "@/assets/landing-hero-video-poster.png";
import { PostCard } from "@/components/blog/PostCard";
import { PostDetailModal } from "@/components/blog/PostDetailModal";
import type { InstagramPost } from "@/pages/BlogNoticias";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { cn } from "@/lib/utils";
import {
  FotobioLabVisual,
  UltrasoundLabVisual,
  DiagnosticUltrasoundLabVisual,
  MriLabVisual,
  ElectroLabVisual,
} from "@/components/landing/LabCardVisuals";
import { useAuth } from "@/hooks/useAuth";
import { LabDemoBoundary } from "@/contexts/LabDemoContext";

const LabPreviewContentLazy = lazy(() =>
  import("@/components/labs/LabPreviewContent").then((m) => ({ default: m.LabPreviewContent })),
);

const sectionPadding = "py-8 lg:py-11";
const LEGAL_SETTINGS_ID = "00000000-0000-0000-0000-000000000002";

/** Mint CTA — header (Acessar) e blog (Todas as notícias / All posts) */
const landingMintCtaButtonClass =
  "h-9 rounded-xl border-0 bg-[hsl(160_52%_44%)] px-4 text-sm font-semibold text-white shadow-md shadow-[hsl(160_45%_25%/0.35)] transition-[box-shadow,transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-[hsl(160_52%_38%)] hover:text-white hover:shadow-lg hover:shadow-[hsl(160_45%_22%/0.4)] focus-visible:ring-[hsl(160_52%_50%)] dark:bg-[hsl(158_48%_52%)] dark:text-[hsl(220_30%_10%)] dark:shadow-[hsl(160_40%_20%/0.45)] dark:hover:bg-[hsl(158_48%_46%)] dark:hover:text-[hsl(220_30%_10%)] sm:h-10 sm:px-5";

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

type LabCardDef = {
  id: string;
  Visual: ComponentType;
  title: { pt: string; en: string };
  description: { pt: string; en: string };
};

const LAB_CARDS: LabCardDef[] = [
  {
    id: "fbm",
    Visual: FotobioLabVisual,
    title: { pt: "Fotobiomodulação", en: "Photobiomodulation" },
    description: {
      pt: "Visualização 3D do tecido, feixe pulsante e parâmetros clínicos em tempo real — como na prática, sem risco ao paciente.",
      en: "3D tissue view, a pulsing beam, and live clinical parameters—like real practice, without patient risk.",
    },
  },
  {
    id: "us",
    Visual: UltrasoundLabVisual,
    title: { pt: "Ultrassom terapêutico", en: "Therapeutic Ultrasound" },
    description: {
      pt: "Explore ganho, profundidade e resposta tecidual em um ambiente seguro para consolidar protocolos.",
      en: "Explore gain, depth, and tissue response in a safe space to reinforce protocols.",
    },
  },
  {
    id: "us-dx",
    Visual: DiagnosticUltrasoundLabVisual,
    title: { pt: "Ultrassom diagnóstico", en: "Diagnostic Ultrasound" },
    description: {
      pt: "Ajuste TGC, profundidade e presets como em um equipamento real e interprete o eco em tempo real.",
      en: "Tune TGC, depth, and presets like on a real system—and read the echo in real time.",
    },
  },
  {
    id: "mri",
    Visual: MriLabVisual,
    title: { pt: "Ressonância magnética", en: "Magnetic Resonance Imaging" },
    description: {
      pt: "Contraste, sequências e parâmetros de imagem com feedback imediato para fechar a curva de aprendizado.",
      en: "Contrast, sequences, and imaging parameters with instant feedback to close the learning loop.",
    },
  },
  {
    id: "electro",
    Visual: ElectroLabVisual,
    title: { pt: "Eletroterapia", en: "Electrotherapy" },
    description: {
      pt: "Correntes, eletrodos e respostas fisiológicas simuladas para treinar decisão clínica com precisão.",
      en: "Currents, electrodes, and simulated physiological responses to train clinical decisions with precision.",
    },
  },
];

/** Ordem de prioridade de `lab_type` no Supabase para cada card da landing */
const CARD_LAB_TYPES: Record<string, string[]> = {
  fbm: ["photobiomodulation", "fbm"],
  us: ["ultrasound_therapy", "ultrassom_terapeutico"],
  "us-dx": ["ultrasound"],
  mri: ["mri"],
  electro: ["tens", "electrotherapy"],
};

function pickSlugForCard(cardId: string, rows: { slug: string; lab_type: string }[]): string | undefined {
  const types = CARD_LAB_TYPES[cardId];
  if (!types) return undefined;
  for (const lt of types) {
    const ltNorm = lt.toLowerCase();
    const found = rows.find((r) => String(r.lab_type).trim().toLowerCase() === ltNorm);
    if (found) return found.slug;
  }
  return undefined;
}

const Landing = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isLegalDialogOpen, setIsLegalDialogOpen] = useState(false);
  const [legalText, setLegalText] = useState(defaultLegalText);
  const [loadingLegalText, setLoadingLegalText] = useState(false);
  const [blogPosts, setBlogPosts] = useState<InstagramPost[]>([]);
  const [blogLoading, setBlogLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);
  const [heroVideoFailed, setHeroVideoFailed] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [labDemoSlugs, setLabDemoSlugs] = useState<Record<string, string>>({});
  const [demoSlug, setDemoSlug] = useState<string | null>(null);
  const [demoTitleFallback, setDemoTitleFallback] = useState("");
  const [demoVirtualLab, setDemoVirtualLab] = useState<VirtualLab | null>(null);
  const [demoFetchStatus, setDemoFetchStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");

  const { language } = useLanguage();
  const en = language === "en";

  const landingHeroVideoUrl = useMemo(
    () => `/videos/${en ? "landing-hero-video-en.mp4" : "landing-hero-video-pt.mp4"}`,
    [en]
  );

  useEffect(() => {
    let cancelled = false;
    void virtualLabService
      .getLandingDemoLabSlugs()
      .then((rows) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const card of LAB_CARDS) {
          const s = pickSlugForCard(card.id, rows);
          if (s) map[card.id] = s;
        }
        setLabDemoSlugs(map);
      })
      .catch(() => {
        if (!cancelled) setLabDemoSlugs({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!demoSlug) {
      setDemoVirtualLab(null);
      setDemoFetchStatus("idle");
      return;
    }
    let cancelled = false;
    setDemoFetchStatus("loading");
    setDemoVirtualLab(null);
    void virtualLabService
      .getBySlug(demoSlug)
      .then((lab) => {
        if (cancelled) return;
        if (!lab || lab.is_published === false) {
          setDemoVirtualLab(null);
          setDemoFetchStatus("error");
          return;
        }
        setDemoVirtualLab(lab);
        setDemoFetchStatus("ok");
      })
      .catch(() => {
        if (!cancelled) {
          setDemoVirtualLab(null);
          setDemoFetchStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [demoSlug]);

  const closeLabDemo = () => {
    setDemoSlug(null);
    setDemoVirtualLab(null);
    setDemoFetchStatus("idle");
  };

  const t = useMemo(
    () =>
      en
        ? {
            navAccess: "Sign in",
            heroTitleBefore: "Master clinical practice with science in",
            heroTitleHighlight: "simulators.",
            heroTitleAfter: "",
            heroLead:
              "From theory to equipment: learn with scientific rigor, practice in safe virtual labs, and keep an AI tutor on your side.",
            ctaPrimary: "Explore the platform",
            ctaSecondary: "About ProGenia",
            videoAria: "ProGenia product overview video",
            labsEyebrow: "Virtual labs",
            labsTitle: "Try it before you reach the patient",
            labsLead:
              "Simulators that respond in real time.",
            labDemo: "Try the demo",
            blogEyebrow: "News",
            blogTitle: "Blog & news",
            blogAll: "All posts",
            journeyEyebrow: "How it works",
            journeyTitle: "A journey built for healthcare professionals",
            journeySteps: [
              {
                title: "Learn the foundation",
                body: "Modules and capsules grounded in science—principles, indications, and parameters.",
              },
              {
                title: "Simulate and explore",
                body: "Virtual labs to test settings and see responses in real time.",
              },
              {
                title: "Reinforce with AI",
                body: "Ask questions in context and track progress with gamification.",
              },
            ],
            diffEyebrow: "Why ProGenia",
            diffTitle: "What sets your learning apart",
            diffCards: [
              {
                title: "Contextual AI tutor",
                body: "Ask questions, get explanations, and reinforce concepts while you study.",
              },
              {
                title: "Virtual labs",
                body: "Tune parameters and watch responses in real time—safely.",
              },
              {
                title: "Specialized content",
                body: "Accurate, reviewed material—from electrostimulation to imaging.",
              },
              {
                title: "Gamification",
                body: "Badges, levels, and progress across modules.",
              },
              {
                title: "Detailed progress",
                body: "Completion, recommendations, and a clear view of what’s next.",
              },
              {
                title: "Interactive learning",
                body: "Video, animation, and quizzes to lock in ideas.",
              },
            ],
            ctaBandTitle: "Ready to take your clinical knowledge further?",
            ctaBandLead: "Get access to content, labs, and AI support today.",
            ctaBandBtn: "Start for free",
            footerCopy: "© 2026 ProGenia. All rights reserved.",
            footerLegal: "Terms & privacy",
            footerAbout: "About",
            footerContact: "Contact",
            footerBlog: "Blog",
          }
        : {
            navAccess: "Acessar",
            heroTitleBefore: "Domine a prática clínica com ciência nos",
            heroTitleHighlight: "simuladores.",
            heroLead:
              "Da teoria ao equipamento: aprenda com rigor científico, pratique em laboratórios virtuais seguros e tenha um tutor de AI ao seu lado.",
            ctaPrimary: "Ver plataforma",
            ctaSecondary: "Conhecer a ProGenia",
            videoAria: "Vídeo de apresentação da ProGenia",
            labsEyebrow: "Laboratórios virtuais",
            labsTitle: "Experimente antes de chegar ao paciente",
            labsLead: "Simuladores que respondem em tempo real.",
            labDemo: "Experimentar demo",
            blogEyebrow: "Novidades",
            blogTitle: "Blog e Notícias",
            blogAll: "Todas as notícias",
            journeyEyebrow: "Como funciona",
            journeyTitle: "Uma jornada pensada para quem atua na saúde",
            journeySteps: [
              {
                title: "Estude o fundamento",
                body: "Módulos e cápsulas com base científica: princípios, indicações e parâmetros.",
              },
              {
                title: "Simule e experimente",
                body: "Laboratórios virtuais para testar configurações e ver respostas em tempo real.",
              },
              {
                title: "Consolide com a IA",
                body: "Tire dúvidas no contexto da aula e acompanhe seu progresso com gamificação.",
              },
            ],
            diffEyebrow: "Diferenciais",
            diffTitle: "Recursos que fazem a diferença no seu aprendizado",
            diffCards: [
              {
                title: "Tutor de AI contextual",
                body: "Assistente no conteúdo: perguntas, explicações e reforço no momento em que você estuda.",
              },
              {
                title: "Laboratórios virtuais",
                body: "Simule parâmetros e observe respostas em tempo real, com segurança.",
              },
              {
                title: "Conteúdo especializado",
                body: "Material preciso e revisado, de eletroestimulação a imagem.",
              },
              {
                title: "Gamificação",
                body: "Emblemas, níveis e progresso por módulos.",
              },
              {
                title: "Progresso detalhado",
                body: "Conclusão, recomendações e visão do que falta estudar.",
              },
              {
                title: "Aprendizado interativo",
                body: "Vídeos, animações e questionários para fixar conceitos.",
              },
            ],
            ctaBandTitle: "Pronto para levar seu conhecimento clínico ao próximo nível?",
            ctaBandLead: "Comece hoje e tenha acesso a conteúdo, laboratórios e suporte de IA.",
            ctaBandBtn: "Começar gratuitamente",
            footerCopy: "© 2026 ProGenia. Todos os direitos reservados.",
            footerLegal: "Termos de uso e privacidade da plataforma",
            footerAbout: "Sobre",
            footerContact: "Contato",
            footerBlog: "Blog",
          },
    [en]
  );

  useEffect(() => {
    setHeroVideoFailed(false);
  }, [language]);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  useEffect(() => {
    const loadBlogPosts = async () => {
      try {
        setBlogLoading(true);
        const { data, error } = await supabase.functions.invoke("get-instagram-posts", { body: {} });
        if (!error && data?.posts?.length) {
          setBlogPosts((data.posts as InstagramPost[]).slice(0, 3));
        }
      } catch {
        setBlogPosts([]);
      } finally {
        setBlogLoading(false);
      }
    };
    void loadBlogPosts();
  }, []);

  const parallaxSlow = scrollY * 0.08;
  const parallaxMed = scrollY * 0.12;
  const videoLift = Math.min(scrollY, 640) * 0.04;

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      {/* Minimal premium nav */}
      <header className="fixed left-0 right-0 top-0 z-50 px-3 pt-1.5 sm:px-4 sm:pt-2">
        <div className="landing-glass-nav mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[18px] px-4 py-2 sm:px-5 sm:py-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-4 md:gap-5">
            <Link
              to="/"
              className="flex shrink-0 items-center gap-2 rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            >
              <img src={logo} alt="ProGenia" className="h-9 progenia-logo sm:h-10" />
            </Link>
            <nav
              className="flex items-center gap-0.5 sm:gap-1"
              aria-label={en ? "Main" : "Principal"}
            >
              <Link to="/sobre">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 whitespace-nowrap rounded-lg px-2.5 text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary sm:px-3"
                >
                  {t.footerAbout}
                </Button>
              </Link>
              <Link to="/contato">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 whitespace-nowrap rounded-lg px-2.5 text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary sm:px-3"
                >
                  {t.footerContact}
                </Button>
              </Link>
              <Link to="/blog">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 whitespace-nowrap rounded-lg px-2.5 text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary sm:px-3"
                >
                  {t.footerBlog}
                </Button>
              </Link>
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link to="/auth">
              <Button variant="default" className={landingMintCtaButtonClass}>
                {t.navAccess}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — texto + vídeo adjacentes (lg+); empilhado no mobile */}
      <section className="relative flex min-h-[min(64vh,600px)] flex-col justify-center overflow-hidden pb-3 pt-20 sm:pb-4 sm:pt-24 lg:min-h-0 lg:pb-4 lg:pt-20">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div
            className="absolute -left-[20%] top-[8%] h-[min(520px,80vw)] w-[min(520px,80vw)] rounded-full bg-primary/[0.09] blur-[100px]"
            style={{ transform: `translate3d(0, ${parallaxMed}px, 0)` }}
          />
          <div
            className="absolute -right-[15%] top-[20%] h-[min(420px,70vw)] w-[min(420px,70vw)] rounded-full bg-secondary/[0.12] blur-[90px]"
            style={{ transform: `translate3d(0, ${parallaxSlow}px, 0)` }}
          />
          <div
            className="absolute bottom-[-10%] left-1/2 h-[min(480px,90vw)] w-[min(480px,90vw)] -translate-x-1/2 rounded-full bg-gradient-hero opacity-[0.07] blur-[120px]"
            style={{ transform: `translate3d(-50%, ${-parallaxSlow * 0.5}px, 0)` }}
          />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4">
          <div className="grid items-center gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)] lg:gap-6 xl:gap-8">
            {/* Copy + CTAs — adjacente ao vídeo em lg+ */}
            <div className="mx-auto w-full max-w-xl text-center lg:mx-0 lg:max-w-none lg:text-left">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground sm:text-sm">
                {t.heroEyebrow}
              </p>
              <h1 className="text-balance text-4xl font-bold leading-[1.06] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-[2.65rem] lg:leading-[1.08] xl:text-5xl xl:leading-[1.06] 2xl:text-6xl">
                {t.heroTitleBefore}{" "}
                <span className="text-gradient">{t.heroTitleHighlight}</span>
                {t.heroTitleAfter ? ` ${t.heroTitleAfter}` : ""}
              </h1>
              <p className="mx-auto mt-3 max-w-2xl text-pretty text-base font-light leading-relaxed text-muted-foreground sm:text-lg md:text-xl lg:mx-0 lg:max-w-xl">
                {t.heroLead}
              </p>
              <div className="mt-5 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
                <Link to="/auth" className="sm:inline-flex">
                  <Button
                    size="lg"
                    className="landing-cta-primary h-12 w-full rounded-xl px-8 text-sm font-semibold gradient-accent text-primary-foreground sm:w-auto sm:text-base"
                  >
                    {t.ctaPrimary}
                    <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </Link>
                <Link to="/sobre" className="sm:inline-flex">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 w-full rounded-xl border-2 border-[hsl(160_52%_42%)] bg-background/40 px-6 text-sm font-medium shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.08)] backdrop-blur-md transition-[transform,box-shadow,border-color,background-color] duration-300 ease-smooth hover:-translate-y-0.5 hover:border-[hsl(160_52%_34%)] hover:bg-[hsla(160,52%,44%,0.08)] hover:shadow-lg dark:border-[hsl(158_48%_50%)] dark:hover:border-[hsl(158_48%_58%)] dark:hover:bg-[hsla(158,48%,52%,0.12)] sm:w-auto sm:text-base"
                  >
                    {t.ctaSecondary}
                  </Button>
                </Link>
              </div>
            </div>

            <div
              className="relative w-full min-w-0"
              style={{ transform: `translate3d(0, ${videoLift}px, 0)` }}
            >
              <div className="landing-glass-video overflow-hidden rounded-[20px] sm:rounded-[24px]">
                <div className="aspect-video w-full overflow-hidden">
                  {!heroVideoFailed ? (
                    <video
                      className="h-full w-full object-cover"
                      controls
                      playsInline
                      preload="metadata"
                      poster={landingHeroVideoPoster}
                      aria-label={t.videoAria}
                      onError={() => setHeroVideoFailed(true)}
                    >
                      <source src={landingHeroVideoUrl} type="video/mp4" />
                    </video>
                  ) : (
                    <img src={landingHeroVideoPoster} alt="ProGenia" className="h-full w-full object-cover" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Labs — premium matrix */}
      <section className="relative pb-8 pt-3 sm:pt-4 lg:pb-11 lg:pt-5">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-muted/[0.35] to-background dark:via-muted/25"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4">
          <ScrollReveal>
            <p className="text-center text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground sm:text-sm">
              {t.labsEyebrow}
            </p>
            <h2 className="mx-auto mt-1 max-w-3xl text-balance text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              {t.labsTitle}
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-base font-light leading-relaxed text-muted-foreground md:text-lg">
              {t.labsLead}
            </p>
          </ScrollReveal>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {LAB_CARDS.map((lab, i) => {
              const Visual = lab.Visual;
              return (
                <ScrollReveal key={lab.id} delayMs={i * 90}>
                  <article
                    className="landing-glass-surface landing-card-lift flex h-full flex-col rounded-[18px] p-4 sm:rounded-[22px] sm:p-5"
                    data-no-auto-translate="true"
                  >
                    <div className="relative mb-3 overflow-hidden rounded-xl ring-1 ring-white/10">
                      <Visual />
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                      {en ? lab.title.en : lab.title.pt}
                    </h3>
                    <p className="mt-2 flex-1 text-sm font-light leading-relaxed text-muted-foreground sm:text-base">
                      {en ? lab.description.en : lab.description.pt}
                    </p>
                    <div className="pt-3">
                      <Button
                        type="button"
                        onClick={() => {
                          const slug = labDemoSlugs[lab.id];
                          if (slug) {
                            setDemoSlug(slug);
                            setDemoTitleFallback(en ? lab.title.en : lab.title.pt);
                          } else {
                            navigate("/auth");
                          }
                        }}
                        className="group h-11 w-full rounded-xl gradient-accent px-6 text-base font-semibold text-primary-foreground shadow-lg transition-[transform,box-shadow] duration-300 ease-smooth hover:-translate-y-0.5 hover:shadow-glow sm:w-auto sm:px-8"
                      >
                        {t.labDemo}
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </Button>
                    </div>
                  </article>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Blog */}
      <section className="pb-3 pt-1 lg:pb-4 lg:pt-3">
        <div className="mx-auto max-w-6xl px-4">
          <ScrollReveal>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground sm:text-sm">
                  {t.blogEyebrow}
                </p>
                <h2 className="mt-1 text-3xl font-bold tracking-tight text-foreground md:text-4xl">{t.blogTitle}</h2>
              </div>
              <Link to="/blog" className="shrink-0">
                <Button variant="default" className={`${landingMintCtaButtonClass} gap-2`}>
                  <Newspaper className="h-4 w-4 shrink-0" />
                  {t.blogAll}
                </Button>
              </Link>
            </div>
          </ScrollReveal>
          {blogLoading ? (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="aspect-square animate-pulse rounded-[18px] bg-muted/40 shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.05)]"
                />
              ))}
            </div>
          ) : blogPosts.length > 0 ? (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 md:gap-3">
              {blogPosts.map((post, i) => (
                <ScrollReveal key={post.id} delayMs={i * 80}>
                  <PostCard post={post} onClick={() => setSelectedPost(post)} />
                </ScrollReveal>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* Journey — timeline flow */}
      <section className={`${sectionPadding} relative overflow-hidden`}>
        <div className="absolute inset-0 bg-muted/25 dark:bg-muted/15" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4">
          <ScrollReveal>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground sm:text-sm">
              {t.journeyEyebrow}
            </p>
            <h2 className="mt-1 max-w-3xl text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
              {t.journeyTitle}
            </h2>
          </ScrollReveal>

          <div className="relative mt-5 md:mt-6">
            <div className="grid gap-4 md:grid-cols-3 md:gap-4">
              {t.journeySteps.map((step, index) => (
                <ScrollReveal key={step.title} delayMs={index * 100}>
                  <div className="relative rounded-[18px] bg-background/60 p-4 shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.08)] backdrop-blur-md dark:bg-card/40 md:p-5">
                    <span className="text-4xl font-bold leading-none text-primary/15 md:text-5xl lg:text-6xl">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground md:text-xl">{step.title}</h3>
                    <p className="mt-1.5 text-sm font-light leading-relaxed text-muted-foreground md:text-base">{step.body}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Diferenciais — glass bento */}
      <section className={sectionPadding}>
        <div className="mx-auto max-w-6xl px-4">
          <ScrollReveal>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground sm:text-sm">
              {t.diffEyebrow}
            </p>
            <h2 className="mt-1 max-w-2xl text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
              {t.diffTitle}
            </h2>
          </ScrollReveal>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-6 md:grid-rows-[minmax(160px,auto)_auto_auto] md:gap-4">
            <ScrollReveal className="md:col-span-3" delayMs={0}>
              <div className="landing-glass-surface landing-card-lift flex h-full min-h-[150px] flex-col justify-between rounded-[18px] p-4 lg:p-5">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
                  <Brain className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">{t.diffCards[0].title}</h3>
                  <p className="mt-1 text-sm font-light leading-relaxed text-muted-foreground md:text-base">
                    {t.diffCards[0].body}
                  </p>
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal className="md:col-span-3" delayMs={80}>
              <div className="landing-glass-surface landing-card-lift flex h-full min-h-[150px] flex-col justify-between rounded-[18px] p-4 lg:p-5">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Microscope className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">{t.diffCards[1].title}</h3>
                  <p className="mt-1 text-sm font-light leading-relaxed text-muted-foreground md:text-base">
                    {t.diffCards[1].body}
                  </p>
                </div>
              </div>
            </ScrollReveal>
            {(
              [
                { icon: BookOpen, accent: "secondary" as const, idx: 2 },
                { icon: Award, accent: "primary" as const, idx: 3 },
                { icon: GraduationCap, accent: "secondary" as const, idx: 4 },
                { icon: Zap, accent: "primary" as const, idx: 5 },
              ] as const
            ).map((item, i) => {
              const Icon = item.icon;
              const card = t.diffCards[item.idx];
              return (
                <ScrollReveal key={card.title} className="md:col-span-3" delayMs={120 + i * 60}>
                  <div className="landing-glass-surface landing-card-lift h-full rounded-[18px] p-4 md:p-5">
                    <div
                      className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
                        item.accent === "secondary" ? "bg-secondary/15 text-secondary" : "bg-primary/15 text-primary"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold tracking-tight">{card.title}</h3>
                    <p className="mt-2 text-sm font-light leading-relaxed text-muted-foreground">{card.body}</p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className={`${sectionPadding} relative`}>
        <div className="absolute inset-0 bg-muted/30 dark:bg-muted/20" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4">
          <ScrollReveal>
            <div className="landing-glass-surface flex flex-col gap-4 rounded-[20px] p-5 md:flex-row md:items-center md:justify-between md:gap-5 md:p-7 lg:p-8">
              <div className="max-w-xl">
                <h2 className="text-xl font-bold leading-tight tracking-tight text-foreground md:text-2xl lg:text-3xl">
                  {t.ctaBandTitle}
                </h2>
                <p className="mt-1.5 text-sm font-light leading-relaxed text-muted-foreground md:text-base">{t.ctaBandLead}</p>
              </div>
              <div className="shrink-0">
                <Link to="/auth">
                  <Button
                    size="lg"
                    className="landing-cta-primary h-12 rounded-xl px-8 text-sm font-semibold gradient-accent text-primary-foreground sm:text-base"
                  >
                    <GraduationCap className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    {t.ctaBandBtn}
                  </Button>
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <footer className="border-t border-border/40 py-6">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col items-center gap-3 md:flex-row md:justify-between md:gap-4">
            <img src={logo} alt="ProGenia" className="h-8 progenia-logo" />
            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground">
              <Link to="/sobre" className="transition-colors hover:text-primary">
                {t.footerAbout}
              </Link>
              <Link to="/contato" className="transition-colors hover:text-primary">
                {t.footerContact}
              </Link>
              <Link to="/blog" className="transition-colors hover:text-primary">
                {t.footerBlog}
              </Link>
            </nav>
            <div className="flex flex-col items-center gap-2 text-center md:items-end">
              <p className="text-sm font-light text-muted-foreground">{t.footerCopy}</p>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-sm font-semibold text-primary hover:text-secondary"
                onClick={() => setIsLegalDialogOpen(true)}
              >
                {t.footerLegal}
              </Button>
            </div>
          </div>
        </div>
      </footer>

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          open={!!selectedPost}
          onOpenChange={(open) => !open && setSelectedPost(null)}
        />
      )}

      <Dialog open={!!demoSlug} onOpenChange={(open) => !open && closeLabDemo()}>
        <DialogContent
          className={cn(
            "z-[100] flex max-h-[85vh] w-[min(96vw,1280px)] max-w-7xl flex-col gap-0 overflow-hidden border bg-background p-0 shadow-lg sm:rounded-xl",
          )}
        >
          {demoSlug ? (
            <>
              <DialogHeader className="shrink-0 border-b border-border/60 px-4 pb-3 pt-4 sm:px-6">
                <DialogTitle>
                  {demoFetchStatus === "ok" && demoVirtualLab
                    ? demoVirtualLab.name || demoVirtualLab.title || demoTitleFallback
                    : demoTitleFallback}
                </DialogTitle>
                <DialogDescription>
                  {demoFetchStatus === "loading"
                    ? en
                      ? "Loading…"
                      : "Carregando…"
                    : demoFetchStatus === "error"
                      ? en
                        ? "Could not load this lab. Try again later or sign in."
                        : "Não foi possível carregar este laboratório. Tente mais tarde ou entre na conta."
                      : demoVirtualLab?.description ||
                        (en ? "Interactive preview of the simulator." : "Pré-visualização interativa do simulador.")}
                </DialogDescription>
              </DialogHeader>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-3 sm:px-6">
                {demoFetchStatus === "loading" ? (
                  <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      {en ? "Loading lab…" : "Carregando laboratório…"}
                    </p>
                  </div>
                ) : null}
                {demoFetchStatus === "error" ? (
                  <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 py-8 text-center text-sm text-muted-foreground">
                    {en ? "Something went wrong." : "Algo deu errado."}
                  </div>
                ) : null}
                {demoFetchStatus === "ok" && demoVirtualLab ? (
                  <LabDemoBoundary
                    slug={demoSlug}
                    enabled={!authLoading && !user}
                    onDismissSecondary={closeLabDemo}
                  >
                    <Suspense
                      fallback={
                        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="text-sm text-muted-foreground">
                            {en ? "Opening simulator…" : "Abrindo simulador…"}
                          </p>
                        </div>
                      }
                    >
                      <LabPreviewContentLazy key={demoVirtualLab.slug} lab={demoVirtualLab} />
                    </Suspense>
                  </LabDemoBoundary>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isLegalDialogOpen} onOpenChange={setIsLegalDialogOpen}>
        <DialogContent className="max-w-3xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{en ? "Terms & privacy" : "Termos de Privacidade e Uso"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm leading-7 font-light">
            {loadingLegalText ? (en ? "Loading…" : "Carregando termos...") : legalText}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Landing;
