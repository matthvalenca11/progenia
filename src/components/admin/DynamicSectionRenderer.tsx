import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, Sparkles, TrendingUp, CheckCircle2, ArrowRight } from "lucide-react";

interface AboutSection {
  id: string;
  section_type: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  media_url: string | null;
  media_type: string | null;
  content_data: any;
  layout: string;
}

interface Props {
  section: AboutSection;
}

export const DynamicSectionRenderer = ({ section }: Props) => {
  const renderHeroSection = () => (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-6xl text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-6 gradient-text">
          {section.title}
        </h1>
        {section.subtitle && (
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            {section.subtitle}
          </p>
        )}
        {section.media_url && section.media_type === "video" && (
          <video src={section.media_url} controls className="w-full max-w-4xl mx-auto rounded-lg shadow-xl mb-8" />
        )}
        {section.media_url && section.media_type === "image" && (
          <img src={section.media_url} alt={section.title || ""} className="w-full max-w-4xl mx-auto rounded-lg shadow-xl mb-8" />
        )}
      </div>
    </section>
  );

  const renderTextSection = () => (
    <section className="py-16 px-4">
      <div className="container mx-auto max-w-4xl">
        {section.title && <h2 className="text-3xl font-bold mb-4">{section.title}</h2>}
        {section.subtitle && <p className="text-lg text-muted-foreground mb-6">{section.subtitle}</p>}
        {section.description && <p className="text-muted-foreground">{section.description}</p>}
      </div>
    </section>
  );

  const renderTextImageSection = () => {
    const isLeftLayout = section.layout === "left";
    const isRightLayout = section.layout === "right";

    return (
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className={`grid md:grid-cols-2 gap-12 items-center ${isRightLayout ? "md:flex-row-reverse" : ""}`}>
            <div className={isRightLayout ? "md:order-2" : ""}>
              {section.title && <h2 className="text-3xl font-bold mb-4">{section.title}</h2>}
              {section.description && <p className="text-lg text-muted-foreground mb-6">{section.description}</p>}
            </div>
            <div className={isRightLayout ? "md:order-1" : ""}>
              {section.media_url && section.media_type === "image" && (
                <img src={section.media_url} alt={section.title || ""} className="w-full rounded-lg shadow-lg" />
              )}
              {section.media_url && section.media_type === "video" && (
                <video src={section.media_url} controls className="w-full rounded-lg shadow-lg" />
              )}
              {!section.media_url && (
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center">
                  <span className="text-muted-foreground">Sem mídia</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderFeaturesSection = () => {
    const features = section.content_data?.features || [];
    const icons = [GraduationCap, Sparkles, TrendingUp];

    return (
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            {section.title && <h2 className="text-3xl font-bold mb-4">{section.title}</h2>}
            {section.subtitle && (
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{section.subtitle}</p>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature: any, i: number) => {
              const Icon = icons[i % icons.length];
              return (
                <Card key={i} className="p-6 hover:shadow-lg transition-shadow">
                  {feature.icon ? (
                    <div className="text-4xl mb-4">{feature.icon}</div>
                  ) : (
                    <Icon className="h-12 w-12 text-primary mb-4" />
                  )}
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    );
  };

  const renderStatsSection = () => {
    const stats = section.content_data?.stats || [];

    return (
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            {section.title && <h2 className="text-3xl font-bold mb-4">{section.title}</h2>}
            {section.subtitle && <p className="text-lg text-muted-foreground">{section.subtitle}</p>}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {stats.map((stat: any, i: number) => (
              <Card key={i} className="p-6 text-center hover:shadow-lg transition-shadow">
                <div className="text-5xl mb-3">{stat.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{stat.title}</h3>
                <p className="text-3xl font-bold text-primary mb-1">{stat.count}</p>
                <p className="text-sm text-muted-foreground">{stat.subtitle}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderCTASection = () => (
    <section className="py-20 px-4 bg-gradient-to-br from-primary/10 via-secondary/10 to-primary/10">
      <div className="container mx-auto max-w-4xl text-center">
        {section.title && <h2 className="text-4xl font-bold mb-6">{section.title}</h2>}
        {section.subtitle && <p className="text-xl text-muted-foreground mb-8">{section.subtitle}</p>}
        {section.media_url && section.media_type === "image" && (
          <img src={section.media_url} alt={section.title || ""} className="w-full max-w-2xl mx-auto rounded-lg shadow-xl mb-8" />
        )}
      </div>
    </section>
  );

  switch (section.section_type) {
    case "hero":
      return renderHeroSection();
    case "text":
      return renderTextSection();
    case "text_image":
    case "text_video":
      return renderTextImageSection();
    case "features":
      return renderFeaturesSection();
    case "stats":
      return renderStatsSection();
    case "cta":
      return renderCTASection();
    default:
      return null;
  }
};
