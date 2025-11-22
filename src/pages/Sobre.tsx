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
      .eq('is_published', true)
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
      <nav className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <img src={logo} alt="ProGenia" className="h-10" />
            <span className="text-xl font-bold gradient-text">ProGenia</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Entrar
            </Button>
            <Button className="gradient-accent text-white" onClick={() => navigate("/auth")}>
              Criar Conta
            </Button>
          </div>
        </div>
      </nav>

      {/* Dynamic Sections */}
      {sections.map((section) => (
        <DynamicSectionRenderer key={section.id} section={section} />
      ))}

      {/* Parceiros & Apoiadores */}
      {partners.length > 0 && (
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Nossos Parceiros</h2>
              <p className="text-lg text-muted-foreground">Parceiros e apoiadores da nossa missão</p>
            </div>

            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
              {partners.map(partner => (
                <a key={partner.id} href={partner.website_url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-6 bg-background border rounded-lg hover:shadow-lg transition-all cursor-pointer group">
                  <img src={partner.logo_url} alt={partner.name} className="max-h-16 w-full object-contain transition-all mb-3" />
                  <p className="font-medium text-center text-sm">{partner.name}</p>
                  {partner.description && <p className="text-xs text-muted-foreground text-center mt-1">{partner.description}</p>}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Equipe */}
      {team.length > 0 && (
        <section className="py-16 px-4 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Nossa Equipe</h2>
              <p className="text-lg text-muted-foreground">
                Especialistas dedicados a revolucionar a educação em saúde
              </p>
            </div>

            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
              {team.map(member => (
                <Card key={member.id} className="p-6 text-center">
                  {member.photo_url ? (
                    <img src={member.photo_url} alt={member.name} className="w-32 h-32 rounded-full mx-auto mb-4 object-cover" />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 mx-auto mb-4 flex items-center justify-center">
                      <Users className="h-12 w-12 text-primary" />
                    </div>
                  )}
                  <h3 className="font-semibold mb-1">{member.name}</h3>
                  <p className="text-sm text-muted-foreground">{member.role}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto max-w-6xl text-center text-muted-foreground">
          <p>© 2026 ProGenia - Learn & Evolve. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Sobre;
