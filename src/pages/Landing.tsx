import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GraduationCap, Brain, Award, Microscope, Zap, BookOpen, Newspaper } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import logo from "@/assets/logo.png";
import landingHeroVideoPoster from "@/assets/landing-hero-video-poster.png";
import { PostCard } from "@/components/blog/PostCard";
import { PostDetailModal } from "@/components/blog/PostDetailModal";
import type { InstagramPost } from "@/pages/BlogNoticias";

/* Ritmo único: padding de seção e margens de título */
const sectionPadding = "py-20 lg:py-24";
const sectionHeader = "mb-12";
const eyebrow = "text-sm font-medium uppercase tracking-widest text-muted-foreground mb-2";
const sectionTitle = "text-3xl lg:text-4xl font-bold max-w-2xl";
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

const Landing = () => {
  const [isLegalDialogOpen, setIsLegalDialogOpen] = useState(false);
  const [legalText, setLegalText] = useState(defaultLegalText);
  const [loadingLegalText, setLoadingLegalText] = useState(false);
  const [blogPosts, setBlogPosts] = useState<InstagramPost[]>([]);
  const [blogLoading, setBlogLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);
  const [heroVideoFailed, setHeroVideoFailed] = useState(false);

  const { language } = useLanguage();

  const landingHeroVideoUrl = useMemo(
    () => `/videos/${language === "en" ? "landing-hero-video-en.mp4" : "landing-hero-video-pt.mp4"}`,
    [language]
  );

  useEffect(() => {
    // Se o usuário alternar idioma e o vídeo anterior falhou, mostramos novamente o vídeo do novo idioma.
    setHeroVideoFailed(false);
  }, [language]);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="ProGenia" className="h-10 progenia-logo" />
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link to="/sobre">
              <Button variant="ghost">Sobre</Button>
            </Link>
            <Link to="/contato">
              <Button variant="ghost">Contato</Button>
            </Link>
            <Link to="/blog">
              <Button variant="ghost">Blog e Notícias</Button>
            </Link>
            <Link to="/auth">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link to="/auth">
              <Button className="gradient-accent text-white shadow-glow">Começar</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className={`relative overflow-hidden ${sectionPadding}`}>
        <div className="absolute inset-0 gradient-hero opacity-[0.06]" aria-hidden="true" />
        <div className="container mx-auto px-4 relative">
          <div className="grid lg:grid-cols-[1fr,minmax(320px,0.9fr)] gap-12 lg:gap-16 items-center">
            <div className="space-y-8">
              <p className={eyebrow}>
                Educação médica baseada em evidências
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight">
                Da teoria ao equipamento médico.{" "}
                <span className="text-gradient">ProGenia</span> conecta o conhecimento científico à prática.
              </h1>
              <ul className="space-y-4 text-muted-foreground text-lg max-w-lg">
                <li className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary">
                    <Zap className="h-4 w-4" />
                  </span>
                  Conteúdo científico revisado: eletroestimulação, imagem e terapias
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Microscope className="h-4 w-4" />
                  </span>
                  Laboratórios virtuais para experimentar parâmetros em ambiente seguro
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary">
                    <Brain className="h-4 w-4" />
                  </span>
                  Tutor de IA contextual para dúvidas 24/7
                </li>
              </ul>
              <div className="flex flex-wrap gap-4 pt-2">
                <Link to="/auth">
                  <Button size="lg" className="gradient-accent text-white shadow-xl hover:shadow-glow transition-smooth text-base px-6">
                    <GraduationCap className="mr-2 h-4 w-4" />
                    Começar a aprender
                  </Button>
                </Link>
                <Link to="/sobre">
                  <Button size="lg" variant="outline" className="text-base px-6">
                    Sobre a ProGenia
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative hidden lg:block w-full">
              {!heroVideoFailed ? (
                <div className="aspect-video w-full overflow-hidden border border-border/60 bg-muted/20 shadow-xl">
                  <video
                    className="h-full w-full object-cover"
                    controls
                    playsInline
                    preload="metadata"
                    poster={landingHeroVideoPoster}
                    aria-label="Vídeo de apresentação da ProGenia"
                    onError={() => setHeroVideoFailed(true)}
                  >
                    <source src={landingHeroVideoUrl} type="video/mp4" />
                  </video>
                </div>
              ) : (
                <div className="aspect-video w-full overflow-hidden border border-border/60 bg-muted/20 shadow-xl">
                  <img src={landingHeroVideoPoster} alt="ProGenia" className="h-full w-full object-cover" />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Blog e Notícias */}
      <section className="pt-6 pb-2 lg:pt-8 lg:pb-4">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div>
              <p className={eyebrow}>Novidades</p>
              <h2 className={sectionTitle}>Blog e Notícias</h2>
            </div>
            <Link to="/blog" className="shrink-0">
              <Button variant="outline" className="gap-2">
                <Newspaper className="h-4 w-4" />
                Todas as notícias
              </Button>
            </Link>
          </div>
          {blogLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/30 aspect-square animate-pulse" />
              ))}
            </div>
          ) : blogPosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {blogPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onClick={() => setSelectedPost(post)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* Jornada em 3 passos */}
      <section className="pt-10 pb-20 lg:pt-12 lg:pb-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <p className={eyebrow}>Como funciona</p>
          <h2 className={`${sectionTitle} ${sectionHeader}`}>
            Uma jornada pensada para quem atua na saúde
          </h2>
          <div className="grid md:grid-cols-3 gap-10 lg:gap-12">
            <div>
              <span className="text-5xl lg:text-6xl font-bold text-primary/15 leading-none">01</span>
              <h3 className="text-xl font-semibold mt-3 mb-2">Estude o fundamento</h3>
              <p className="text-muted-foreground leading-relaxed">
                Módulos e cápsulas com base científica: princípios, indicações e parâmetros.
              </p>
            </div>
            <div>
              <span className="text-5xl lg:text-6xl font-bold text-primary/15 leading-none">02</span>
              <h3 className="text-xl font-semibold mt-3 mb-2">Simule e experimente</h3>
              <p className="text-muted-foreground leading-relaxed">
                Laboratórios virtuais para testar configurações e ver respostas em tempo real.
              </p>
            </div>
            <div>
              <span className="text-5xl lg:text-6xl font-bold text-primary/15 leading-none">03</span>
              <h3 className="text-xl font-semibold mt-3 mb-2">Consolide com a IA</h3>
              <p className="text-muted-foreground leading-relaxed">
                Tire dúvidas no contexto da aula e acompanhe seu progresso com gamificação.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bento de diferenciais */}
      <section className={sectionPadding}>
        <div className="container mx-auto px-4">
          <p className={eyebrow}>Diferenciais</p>
          <h2 className={`${sectionTitle} ${sectionHeader}`}>
            Recursos que fazem a diferença no seu aprendizado
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-6 md:grid-rows-[200px_auto_auto] gap-5 lg:gap-6">
            <div className="md:col-span-3 md:row-span-1 md:h-[200px] p-6 lg:p-8 rounded-2xl border border-border/50 bg-card hover:shadow-lg transition-smooth flex flex-col justify-between">
              <div className="rounded-xl bg-secondary/10 w-12 h-12 flex items-center justify-center mb-4 shrink-0">
                <Brain className="h-6 w-6 text-secondary" />
              </div>
              <div className="min-h-0">
                <h3 className="text-xl font-semibold mb-2">Tutor de IA contextual</h3>
                <p className="text-muted-foreground leading-relaxed text-sm lg:text-base line-clamp-3">
                  Assistente 24/7 no conteúdo: perguntas, explicações e reforço no momento em que você estuda.
                </p>
              </div>
            </div>
            <div className="md:col-span-3 md:row-span-1 md:h-[200px] p-6 lg:p-8 rounded-2xl border border-border/50 bg-card hover:shadow-lg transition-smooth flex flex-col justify-between">
              <div className="rounded-xl bg-primary/10 w-12 h-12 flex items-center justify-center mb-4 shrink-0">
                <Microscope className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Laboratórios virtuais</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  Simule parâmetros e observe respostas biológicas em ambiente seguro.
                </p>
              </div>
            </div>
            <div className="md:col-span-3 p-6 rounded-2xl border border-border/50 bg-card hover:shadow-md transition-smooth">
              <div className="rounded-xl bg-secondary/10 w-10 h-10 flex items-center justify-center mb-3">
                <BookOpen className="h-5 w-5 text-secondary" />
              </div>
              <h3 className="font-semibold mb-1">Conteúdo especializado</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Material cientificamente preciso e revisado, de eletroestimulação a imagem.
              </p>
            </div>
            <div className="md:col-span-3 p-6 rounded-2xl border border-border/50 bg-card hover:shadow-md transition-smooth">
              <div className="rounded-xl bg-primary/10 w-10 h-10 flex items-center justify-center mb-3">
                <Award className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Gamificação</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Emblemas, níveis e progresso por módulos e marcos de aprendizado.
              </p>
            </div>
            <div className="md:col-span-3 p-6 rounded-2xl border border-border/50 bg-card hover:shadow-md transition-smooth">
              <div className="rounded-xl bg-secondary/10 w-10 h-10 flex items-center justify-center mb-3">
                <GraduationCap className="h-5 w-5 text-secondary" />
              </div>
              <h3 className="font-semibold mb-1">Progresso detalhado</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Análises, taxas de conclusão e recomendações personalizadas.
              </p>
            </div>
            <div className="md:col-span-3 p-6 rounded-2xl border border-border/50 bg-card hover:shadow-md transition-smooth">
              <div className="rounded-xl bg-primary/10 w-10 h-10 flex items-center justify-center mb-3">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Aprendizado interativo</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Vídeos, animações, questionários e casos para maximizar retenção.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={`${sectionPadding} bg-muted/30`}>
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 rounded-2xl border border-border/50 bg-card p-8 lg:p-10">
            <div className="max-w-xl">
              <h2 className="text-2xl lg:text-3xl font-bold mb-2 leading-tight">
                Pronto para levar seu conhecimento médico ao próximo nível?
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Comece hoje e tenha acesso a conteúdo, laboratórios e suporte de IA.
              </p>
            </div>
            <div className="shrink-0">
              <Link to="/auth">
                <Button size="lg" className="gradient-accent text-white shadow-xl hover:shadow-glow transition-smooth text-base px-8">
                  <GraduationCap className="mr-2 h-4 w-4" />
                  Começar gratuitamente
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-12 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="ProGenia" className="h-8 progenia-logo" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-muted-foreground text-sm">
                © 2026 ProGenia. Todos os direitos reservados.
              </p>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-sm font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                onClick={() => setIsLegalDialogOpen(true)}
              >
                Termos de uso e privacidade da plataforma
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
    </div>
  );
};

export default Landing;
