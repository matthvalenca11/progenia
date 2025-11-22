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
          <h1 className="text-5xl md:text-6xl font-bold mb-6 gradient-text">
            {section.title}
          </h1>
        )}
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
        {renderButtons()}
      </div>
    </section>
  );

  const renderTextSection = () => (
    <section className={wrapperClasses} style={animationStyle}>
      <div className="container mx-auto max-w-4xl">
        {section.title && <h2 className="text-3xl font-bold mb-4">{section.title}</h2>}
        {section.subtitle && <p className="text-lg text-muted-foreground mb-6">{section.subtitle}</p>}
        {section.description && <p className="text-muted-foreground">{section.description}</p>}
        {renderButtons()}
      </div>
    </section>
  );

  const renderTextImageSection = () => {
    const isRightLayout = section.layout === "right";

    return (
      <section className={wrapperClasses} style={animationStyle}>
        <div className="container mx-auto max-w-6xl">
          <div className={`grid md:grid-cols-2 gap-12 items-center`}>
            <div className={isRightLayout ? "md:order-2" : ""}>
              {section.title && <h2 className="text-3xl font-bold mb-4">{section.title}</h2>}
              {section.subtitle && <p className="text-xl text-muted-foreground mb-4">{section.subtitle}</p>}
              {section.description && <p className="text-muted-foreground mb-6">{section.description}</p>}
              {renderButtons()}
            </div>
            <div className={isRightLayout ? "md:order-1" : ""}>
              {section.media_url && section.media_type === "image" && (
                <img src={section.media_url} alt={section.title || ""} className="w-full rounded-lg shadow-lg" />
              )}
              {section.media_url && section.media_type === "video" && (
                <video src={section.media_url} controls className="w-full rounded-lg shadow-lg" />
              )}
              {!section.media_url && (
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg" />
              )}
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderFeaturesSection = () => {
    const features = section.content_data?.features || [];

    return (
      <section className={wrapperClasses} style={animationStyle}>
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            {section.title && <h2 className="text-3xl font-bold mb-4">{section.title}</h2>}
            {section.subtitle && (
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{section.subtitle}</p>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature: any, i: number) => (
              <Card key={i} className="p-6 hover:shadow-lg transition-shadow hover-scale">
                <div className="mb-4">{renderIcon(feature.icon)}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
          {renderButtons()}
        </div>
      </section>
    );
  };

  const renderStatsSection = () => {
    const stats = section.content_data?.stats || [];

    return (
      <section className={wrapperClasses} style={animationStyle}>
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            {section.title && <h2 className="text-3xl font-bold mb-4">{section.title}</h2>}
            {section.subtitle && <p className="text-lg text-muted-foreground">{section.subtitle}</p>}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {stats.map((stat: any, i: number) => (
              <Card key={i} className="p-6 text-center hover:shadow-lg transition-shadow hover-scale">
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

  const renderTimelineSection = () => {
    const items = section.content_data?.timeline_items || [];

    return (
      <section className={wrapperClasses} style={animationStyle}>
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            {section.title && <h2 className="text-3xl font-bold mb-4">{section.title}</h2>}
            {section.subtitle && <p className="text-lg text-muted-foreground">{section.subtitle}</p>}
          </div>

          <div className="space-y-8">
            {items.map((item: any, i: number) => (
              <div key={i} className="flex gap-6 group">
                <div className="flex flex-col items-center">
                  <div className="w-4 h-4 rounded-full bg-primary group-hover:scale-150 transition-transform" />
                  {i < items.length - 1 && <div className="w-0.5 flex-1 bg-border mt-2" />}
                </div>
                <div className="flex-1 pb-8">
                  <span className="text-sm font-bold text-primary">{item.year}</span>
                  <h3 className="text-xl font-semibold mt-1 mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
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
    const faqs = section.content_data?.faq_items || [];

    return (
      <section className={wrapperClasses} style={animationStyle}>
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-12">
            {section.title && <h2 className="text-3xl font-bold mb-4">{section.title}</h2>}
            {section.subtitle && <p className="text-lg text-muted-foreground">{section.subtitle}</p>}
          </div>

          <Accordion type="single" collapsible className="w-full">
            {faqs.map((item: any, i: number) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
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

  const renderCTASection = () => (
    <section className={wrapperClasses} style={animationStyle}>
      <div className="container mx-auto max-w-4xl text-center">
        {section.title && <h2 className="text-4xl font-bold mb-6">{section.title}</h2>}
        {section.subtitle && <p className="text-xl text-muted-foreground mb-8">{section.subtitle}</p>}
        {section.media_url && section.media_type === "image" && (
          <img src={section.media_url} alt={section.title || ""} className="w-full max-w-2xl mx-auto rounded-lg shadow-xl mb-8" />
        )}
        {renderButtons()}
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
