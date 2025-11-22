import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users } from "lucide-react";
import logo from "@/assets/logo.png";
import { DynamicSectionRenderer } from "@/components/admin/DynamicSectionRenderer";

interface Partner {
  id: string;
  name: string;
  description: string | null;
  logo_url: string;
  website_url: string;
  order_index: number;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  photo_url: string | null;
  order_index: number;
}

interface AboutSection {
  id: string;
  section_type: string;
  order_index: number;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  media_url: string | null;
  media_type: string | null;
  content_data: any;
  layout: string;
  theme: string;
  background_gradient: any;
  animation_type: string;
  animation_delay: number;
  spacing_top: string;
  spacing_bottom: string;
  custom_css: string | null;
  buttons: any[];
}

const Sobre = () => {
  const navigate = useNavigate();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [sections, setSections] = useState<AboutSection[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: partnersData } = await supabase
      .from('partners')
      .select('*')
      .order('order_index', { ascending: true });
    
    const { data: teamData } = await supabase
      .from('team_members')
      .select('*')
      .order('order_index', { ascending: true });
    
    const { data: sectionsData } = await supabase
      .from('about_page_sections')
      .select('*')
      .order('order_index', { ascending: true });

    if (partnersData) setPartners(partnersData);
    if (teamData) setTeam(teamData);
    if (sectionsData) {
      setSections(
        sectionsData.map((section) => ({
          ...section,
          buttons: (section.buttons as any) || [],
        }))
      );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer hover-scale" onClick={() => navigate("/")}>
            <img src={logo} alt="ProGenia" className="h-12" />
            <span className="text-2xl font-bold gradient-text">ProGenia</span>
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" className="font-medium" onClick={() => navigate("/auth")}>
              Entrar
            </Button>
            <Button className="gradient-accent text-white font-semibold px-6" onClick={() => navigate("/auth")}>
              Criar Conta
            </Button>
          </div>
        </div>
      </nav>

      {/* Dynamic Sections */}
      {/* Dynamic Sections, Parceiros e Equipe */}
      {sections.map((section) => {
        // Renderiza Parceiros antes da seção com order_index específico
        if (section.order_index === 6) {
          return (
            <>
              {partners.length > 0 && (
                <section key="partners" className="py-20 px-4 bg-gradient-to-b from-background to-muted/20">
                  <div className="container mx-auto max-w-7xl">
                    <div className="text-center mb-16 animate-fade-in">
                      <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        Parceiros & Apoiadores
                      </h2>
                      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                        Organizações que acreditam na transformação da educação em saúde
                      </p>
                    </div>

                    <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-8 animate-fade-in" style={{ animationDelay: '100ms' }}>
                      {partners.map((partner, index) => (
                        <a 
                          key={partner.id} 
                          href={partner.website_url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="group flex flex-col items-center justify-center p-8 bg-card border border-border/50 rounded-xl hover:border-primary/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                          style={{ animationDelay: `${(index + 1) * 50}ms` }}
                        >
                          <div className="w-full h-20 flex items-center justify-center mb-4">
                            <img 
                              src={partner.logo_url} 
                              alt={partner.name} 
                              className="max-h-16 max-w-full object-contain group-hover:scale-110 transition-all duration-300" 
                            />
                          </div>
                          <p className="font-semibold text-center text-sm mb-1">{partner.name}</p>
                          {partner.description && (
                            <p className="text-xs text-muted-foreground text-center leading-relaxed">
                              {partner.description}
                            </p>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {team.length > 0 && (
                <section key="team" className="py-20 px-4 bg-gradient-to-b from-muted/20 to-background">
                  <div className="container mx-auto max-w-7xl">
                    <div className="text-center mb-16 animate-fade-in">
                      <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        Nossa Equipe
                      </h2>
                      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                        Especialistas dedicados à revolução da educação científica em saúde
                      </p>
                    </div>

                    <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-8 animate-fade-in" style={{ animationDelay: '100ms' }}>
                      {team.map((member, index) => (
                        <Card 
                          key={member.id} 
                          className="p-8 text-center hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-border/50 group"
                          style={{ animationDelay: `${(index + 1) * 50}ms` }}
                        >
                          {member.photo_url ? (
                            <img 
                              src={member.photo_url} 
                              alt={member.name} 
                              className="w-32 h-32 rounded-full mx-auto mb-6 object-cover border-4 border-primary/10 group-hover:border-primary/30 transition-all shadow-lg" 
                            />
                          ) : (
                            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20 mx-auto mb-6 flex items-center justify-center border-4 border-primary/10 group-hover:border-primary/30 transition-all shadow-lg">
                              <Users className="h-14 w-14 text-primary" />
                            </div>
                          )}
                          <h3 className="font-bold text-lg mb-2">{member.name}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">{member.role}</p>
                        </Card>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              <DynamicSectionRenderer key={section.id} section={section} />
            </>
          );
        }
        
        return <DynamicSectionRenderer key={section.id} section={section} />;
      })}

      {/* Footer */}
      <footer className="border-t border-border/50 bg-muted/10 py-12 px-4">
        <div className="container mx-auto max-w-7xl text-center">
          <p className="text-muted-foreground text-sm md:text-base">
            © 2026 <span className="font-semibold gradient-text">ProGenia</span> - Learn & Evolve. 
            Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Sobre;
