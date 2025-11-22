import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, Sparkles, TrendingUp, CheckCircle2, ArrowRight, Quote } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import * as LucideIcons from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  theme: string;
  background_gradient: any;
  animation_type: string;
  animation_delay: number;
  spacing_top: string;
  spacing_bottom: string;
  custom_css: string | null;
  buttons: any[];
}

interface Props {
  section: AboutSection;
}

export const DynamicSectionRenderer = ({ section }: Props) => {
  const navigate = useNavigate();

  const getSpacingClass = (spacing: string) => {
    const map: Record<string, string> = {
      none: "py-0",
      sm: "py-8",
      default: "py-16",
      lg: "py-24",
      xl: "py-32",
    };
    return map[spacing] || map.default;
  };

  const getThemeClasses = (theme: string) => {
    const themes: Record<string, string> = {
      default: "bg-background text-foreground",
      dark: "bg-gray-900 text-white",
      gradient: "bg-gradient-to-br from-primary/10 via-secondary/10 to-primary/10",
      accent: "bg-accent text-accent-foreground",
      minimal: "bg-white dark:bg-gray-950",
      glass: "bg-white/30 dark:bg-gray-900/30 backdrop-blur-lg",
    };
    return themes[theme] || themes.default;
  };

  const getAnimationClass = (animType: string) => {
    const animations: Record<string, string> = {
      none: "",
      "fade-in": "animate-fade-in",
      "slide-up": "animate-slide-up",
      "scale-in": "animate-scale-in",
      "slide-left": "animate-slide-left",
      "slide-right": "animate-slide-right",
    };
    return animations[animType] || "";
  };

  const renderIcon = (iconName: string) => {
    // Se for emoji, retorna direto
    if (/\p{Emoji}/u.test(iconName)) {
      return <span className="text-4xl">{iconName}</span>;
    }

    // Tenta renderizar ícone Lucide
    const IconComponent = (LucideIcons as any)[iconName];
    if (IconComponent) {
      return <IconComponent className="h-12 w-12 text-primary" />;
    }

    // Fallback
    return <Sparkles className="h-12 w-12 text-primary" />;
  };

  const renderButtons = () => {
    if (!section.buttons || section.buttons.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-4 justify-center mt-8">
        {section.buttons.map((button: any, i: number) => {
          const variants: Record<string, string> = {
            primary: "gradient-accent text-white",
            secondary: "bg-secondary text-secondary-foreground",
            outline: "border-2",
            ghost: "",
          };

          const isExternal = button.link?.startsWith("http");

          return (
            <Button
              key={i}
              size="lg"
              className={variants[button.style] || variants.primary}
              onClick={() => (isExternal ? window.open(button.link, "_blank") : navigate(button.link))}
            >
              {button.text}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          );
        })}
      </div>
    );
  };

  const wrapperClasses = `
    ${getSpacingClass(section.spacing_top)}
    ${getSpacingClass(section.spacing_bottom)}
    ${getThemeClasses(section.theme)}
    ${getAnimationClass(section.animation_type)}
    ${section.custom_css || ""}
    px-4
  `.trim();

  const animationStyle = {
    animationDelay: `${section.animation_delay}ms`,
  };

  const renderHeroSection = () => (
    <section className={wrapperClasses} style={animationStyle}>
      <div className="container mx-auto max-w-6xl text-center">
        {section.title && (
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent leading-tight">
            {section.title}
          </h1>
        )}
        {section.subtitle && (
          <p className="text-xl md:text-2xl text-muted-foreground mb-6 max-w-3xl mx-auto leading-relaxed">
            {section.subtitle}
          </p>
        )}
        {section.description && (
          <p className="text-lg text-muted-foreground/80 mb-10 max-w-4xl mx-auto">
            {section.description}
          </p>
        )}
        {section.media_url && section.media_type === "video" && (
          <video src={section.media_url} controls className="w-full max-w-4xl mx-auto rounded-2xl shadow-2xl mb-8" />
        )}
        {section.media_url && section.media_type === "image" && (
          <img src={section.media_url} alt={section.title || ""} className="w-full max-w-4xl mx-auto rounded-2xl shadow-2xl mb-8" />
        )}
        {renderButtons()}
      </div>
    </section>
  );

  const renderTextSection = () => (
    <section className={wrapperClasses} style={animationStyle}>
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-8">
          {section.title && <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{section.title}</h2>}
          {section.subtitle && <p className="text-xl md:text-2xl text-muted-foreground mb-6">{section.subtitle}</p>}
        </div>
        {section.description && (
          <div className="prose prose-lg max-w-none text-foreground/90 leading-relaxed">
            {section.description.split('\n').map((line: string, i: number) => {
              if (line.trim().startsWith('•')) {
                return <li key={i} className="ml-6 mb-3 text-lg">{line.replace('•', '').trim()}</li>;
              }
              return <p key={i} className="mb-4 text-lg">{line}</p>;
            })}
          </div>
        )}
        {renderButtons()}
      </div>
    </section>
  );

  const renderTextImageSection = () => {
    const isRightLayout = section.layout === "right";

    return (
      <section className={wrapperClasses} style={animationStyle}>
        <div className="container mx-auto max-w-7xl">
          <div className={`grid md:grid-cols-2 gap-16 items-center`}>
            <div className={isRightLayout ? "md:order-2" : ""}>
              {section.title && <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{section.title}</h2>}
              {section.subtitle && <p className="text-xl md:text-2xl text-muted-foreground mb-6">{section.subtitle}</p>}
              {section.description && (
                <div className="prose prose-lg max-w-none text-foreground/90 mb-8 leading-relaxed">
                  {section.description.split('\n').map((line: string, i: number) => {
                    if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
                      return <p key={i} className="font-bold text-xl mb-4">{line.replace(/\*\*/g, '')}</p>;
                    }
                    if (line.trim().startsWith('•')) {
                      return <li key={i} className="ml-6 mb-3 text-lg">{line.replace('•', '').trim()}</li>;
                    }
                    return line.trim() ? <p key={i} className="mb-4 text-lg">{line}</p> : null;
                  })}
                </div>
              )}
              {renderButtons()}
            </div>
            <div className={isRightLayout ? "md:order-1" : ""}>
              {section.media_url && section.media_type === "image" && (
                <img src={section.media_url} alt={section.title || ""} className="w-full rounded-2xl shadow-2xl" />
              )}
              {section.media_url && section.media_type === "video" && (
                <video src={section.media_url} controls className="w-full rounded-2xl shadow-2xl" />
              )}
              {!section.media_url && (
                <div className="aspect-video bg-gradient-to-br from-primary/30 via-primary/10 to-secondary/30 rounded-2xl shadow-xl flex items-center justify-center">
                  <GraduationCap className="h-32 w-32 text-primary/40" />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderFeaturesSection = () => {
    const features = Array.isArray(section.content_data) ? section.content_data : [];

    return (
      <section className={wrapperClasses} style={animationStyle}>
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            {section.title && <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{section.title}</h2>}
            {section.subtitle && (
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">{section.subtitle}</p>
            )}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature: any, i: number) => (
              <Card key={i} className="p-8 hover:shadow-2xl transition-all hover:-translate-y-2 border-border/50 group">
                <div className="mb-6 text-primary group-hover:scale-110 transition-transform">{renderIcon(feature.icon)}</div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
          {renderButtons()}
        </div>
      </section>
    );
  };

  const renderStatsSection = () => {
    const stats = Array.isArray(section.content_data) ? section.content_data : [];

    return (
      <section className={wrapperClasses} style={animationStyle}>
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            {section.title && <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{section.title}</h2>}
            {section.subtitle && <p className="text-xl text-muted-foreground max-w-3xl mx-auto">{section.subtitle}</p>}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat: any, i: number) => (
              <Card key={i} className="p-10 text-center hover:shadow-2xl transition-all hover:-translate-y-2 border-border/50 group bg-gradient-to-br from-card to-card/50">
                <div className="text-6xl mb-4 group-hover:scale-125 transition-transform">{stat.icon}</div>
                <p className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-3">{stat.count}</p>
                <h3 className="text-lg font-bold mb-2">{stat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{stat.subtitle}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderTimelineSection = () => {
    const items = Array.isArray(section.content_data) ? section.content_data : [];

    return (
      <section className={wrapperClasses} style={animationStyle}>
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            {section.title && <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{section.title}</h2>}
            {section.subtitle && <p className="text-xl text-muted-foreground max-w-3xl mx-auto">{section.subtitle}</p>}
          </div>

          <div className="space-y-12 relative">
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-transparent" />
            {items.map((item: any, i: number) => (
              <div key={i} className="flex gap-8 group relative">
                <div className="flex flex-col items-center relative z-10">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg group-hover:scale-125 transition-transform">
                    <span className="text-white font-bold">{item.year}</span>
                  </div>
                </div>
                <Card className="flex-1 p-8 hover:shadow-2xl transition-all hover:-translate-y-1 border-border/50">
                  <h3 className="text-2xl font-bold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed">{item.description}</p>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderTestimonialsSection = () => {
    const testimonials = section.content_data?.testimonials || [];

    return (
      <section className={wrapperClasses} style={animationStyle}>
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            {section.title && <h2 className="text-3xl font-bold mb-4">{section.title}</h2>}
            {section.subtitle && <p className="text-lg text-muted-foreground">{section.subtitle}</p>}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((item: any, i: number) => (
              <Card key={i} className="p-6 hover:shadow-lg transition-shadow">
                <Quote className="h-8 w-8 text-primary mb-4" />
                <p className="text-muted-foreground mb-4 italic">"{item.quote}"</p>
                <div className="flex items-center gap-3">
                  {item.photo_url && (
                    <img src={item.photo_url} alt={item.name} className="w-12 h-12 rounded-full object-cover" />
                  )}
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.role}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderFAQSection = () => {
    const faqs = Array.isArray(section.content_data) ? section.content_data : [];

    return (
      <section className={wrapperClasses} style={animationStyle}>
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            {section.title && <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{section.title}</h2>}
            {section.subtitle && <p className="text-xl text-muted-foreground max-w-3xl mx-auto">{section.subtitle}</p>}
          </div>

          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((item: any, i: number) => (
              <AccordionItem key={i} value={`item-${i}`} className="border border-border/50 rounded-lg px-6 hover:border-primary/30 transition-colors bg-card/50">
                <AccordionTrigger className="text-left text-lg font-semibold py-6 hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed pb-6">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    );
  };

  const renderGallerySection = () => {
    const images = section.content_data?.gallery_images || [];

    return (
      <section className={wrapperClasses} style={animationStyle}>
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            {section.title && <h2 className="text-3xl font-bold mb-4">{section.title}</h2>}
            {section.subtitle && <p className="text-lg text-muted-foreground">{section.subtitle}</p>}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((img: any, i: number) => (
              <div key={i} className="aspect-square overflow-hidden rounded-lg group cursor-pointer">
                <img
                  src={img.url}
                  alt={img.caption || `Gallery image ${i + 1}`}
                  className="w-full h-full object-cover transition-transform group-hover:scale-110"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderCTASection = () => {
    const gradientStyle = section.background_gradient 
      ? { background: `linear-gradient(${section.background_gradient.direction || 'to-br'}, ${section.background_gradient.from}, ${section.background_gradient.to})` }
      : {};

    return (
      <section className={wrapperClasses} style={{...animationStyle, ...gradientStyle}}>
        <div className="container mx-auto max-w-5xl text-center py-20">
          {section.title && <h2 className="text-4xl md:text-6xl font-bold mb-6 text-white drop-shadow-lg">{section.title}</h2>}
          {section.subtitle && <p className="text-xl md:text-2xl text-white/90 mb-6 max-w-3xl mx-auto">{section.subtitle}</p>}
          {section.description && <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">{section.description}</p>}
          {section.media_url && section.media_type === "image" && (
            <img src={section.media_url} alt={section.title || ""} className="w-full max-w-2xl mx-auto rounded-2xl shadow-2xl mb-8" />
          )}
          {renderButtons()}
        </div>
      </section>
    );
  };

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
    case "timeline":
      return renderTimelineSection();
    case "testimonials":
      return renderTestimonialsSection();
    case "faq":
      return renderFAQSection();
    case "gallery":
      return renderGallerySection();
    case "cta":
      return renderCTASection();
    default:
      return null;
  }
};
