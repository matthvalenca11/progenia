import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GraduationCap, Brain, Award, Users, Microscope, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/logo.png";

const Landing = () => {
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
            <Link to="/auth">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link to="/auth">
              <Button className="gradient-accent text-white shadow-glow">Começar</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-10"></div>
        <div className="container mx-auto px-4 py-20 lg:py-32 relative">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20 text-secondary text-sm font-medium mb-4">
              <Zap className="h-4 w-4" />
              Plataforma de Aprendizado Científico
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold leading-tight">
              Domine a Tecnologia Médica com{" "}
              <span className="text-gradient">ProGenia</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Uma plataforma digital abrangente para profissionais de saúde compreenderem 
              os fundamentos científicos por trás das tecnologias terapêuticas e diagnósticas.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link to="/auth">
                <Button size="lg" className="gradient-accent text-white shadow-xl hover:shadow-glow transition-smooth text-lg px-8">
                  <GraduationCap className="mr-2 h-5 w-5" />
                  Começar a Aprender
                </Button>
              </Link>
              <Link to="/sobre">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Sobre a ProGenia
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Por Que Escolher a ProGenia?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Recursos de ponta projetados para a educação médica moderna
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-8 hover:shadow-xl transition-smooth border-border/50">
              <div className="rounded-lg bg-secondary/10 w-14 h-14 flex items-center justify-center mb-4">
                <Brain className="h-7 w-7 text-secondary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">Tutor de IA</h3>
              <p className="text-muted-foreground leading-relaxed">
                Obtenha ajuda personalizada com nosso assistente de IA contextual, disponível 24/7 para responder perguntas e fornecer explicações.
              </p>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-smooth border-border/50">
              <div className="rounded-lg bg-primary/10 w-14 h-14 flex items-center justify-center mb-4">
                <Microscope className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">Laboratórios Virtuais</h3>
              <p className="text-muted-foreground leading-relaxed">
                Experimente com parâmetros terapêuticos simulados e veja respostas biológicas em tempo real em um ambiente seguro.
              </p>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-smooth border-border/50">
              <div className="rounded-lg bg-secondary/10 w-14 h-14 flex items-center justify-center mb-4">
                <Award className="h-7 w-7 text-secondary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">Gamificação</h3>
              <p className="text-muted-foreground leading-relaxed">
                Ganhe emblemas, suba de nível e acompanhe seu progresso ao dominar cada módulo e alcançar marcos de aprendizado.
              </p>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-smooth border-border/50">
              <div className="rounded-lg bg-primary/10 w-14 h-14 flex items-center justify-center mb-4">
                <GraduationCap className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">Conteúdo Especializado</h3>
              <p className="text-muted-foreground leading-relaxed">
                Aprenda com conteúdo cientificamente preciso e revisado por pares, cobrindo eletroestimulação, imagem e muito mais.
              </p>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-smooth border-border/50">
              <div className="rounded-lg bg-secondary/10 w-14 h-14 flex items-center justify-center mb-4">
                <Users className="h-7 w-7 text-secondary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">Acompanhamento de Progresso</h3>
              <p className="text-muted-foreground leading-relaxed">
                Monitore sua jornada de aprendizado com análises detalhadas, taxas de conclusão e recomendações personalizadas.
              </p>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-smooth border-border/50">
              <div className="rounded-lg bg-primary/10 w-14 h-14 flex items-center justify-center mb-4">
                <Zap className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">Aprendizado Interativo</h3>
              <p className="text-muted-foreground leading-relaxed">
                Envolva-se com vídeos, animações, questionários e estudos de caso projetados para maximizar a retenção e compreensão.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-10"></div>
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-4xl lg:text-5xl font-bold">
              Pronto para Transformar Seu Conhecimento Médico?
            </h2>
            <p className="text-xl text-muted-foreground">
              Junte-se à ProGenia hoje e comece sua jornada rumo ao domínio da tecnologia médica.
            </p>
            <Link to="/auth">
              <Button size="lg" className="gradient-accent text-white shadow-xl hover:shadow-glow transition-smooth text-lg px-12">
                <GraduationCap className="mr-2 h-5 w-5" />
                Começar Gratuitamente
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="ProGenia" className="h-8 progenia-logo" />
            </div>
            <p className="text-muted-foreground text-sm">
              © 2026 ProGenia. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;