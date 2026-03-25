import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, Sparkles, CheckCircle2, ArrowRight, Quote, Target, Eye } from "lucide-react";
import { normalizeMvvContentData } from "@/data/aboutMvvDefaults";
import { normalizeJustificationContentData } from "@/data/aboutJustificationDefaults";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import * as LucideIcons from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import landingHeroVideoPoster from "@/assets/landing-hero-video-poster.png";

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
  const { language } = useLanguage();

  const resolveVideoSrc = (mediaUrl: string | null) => {
    if (!mediaUrl) return mediaUrl;

    // DB pode guardar apenas o path ou a URL pública completa do Supabase.
    if (mediaUrl.includes("landing/hero.mp4")) {
      return `/videos/${language === "en" ? "landing-hero-video-en.mp4" : "landing-hero-video-pt.mp4"}`;
    }

    return mediaUrl;
  };

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

  /** Fundos legíveis com `text-foreground` / `text-muted-foreground` (evita `bg-accent` em tela cheia nesta seção). */
  const getJustificationSurfaceClasses = (theme: string) => {
    const map: Record<string, string> = {
      default: "bg-background text-foreground",
      dark: "bg-gray-950 text-white",
      gradient: "bg-gradient-to-br from-primary/[0.07] via-background to-secondary/[0.07] text-foreground",
      accent: "bg-muted/40 text-foreground dark:bg-muted/25",
      minimal: "bg-background text-foreground",
      glass: "bg-background/85 backdrop-blur-md text-foreground",
    };
    return map[theme] || map.default;
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

    // Aliases: nomes usados em seeds/DB que não existem nesta versão do Lucide
    const lucideKey =
      iconName.trim() === "Globe2" ? "Globe" : iconName.trim();

    // Tenta renderizar ícone Lucide
    const IconComponent = (LucideIcons as any)[lucideKey];
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
          
          const handleClick = () => {
            console.log("Button clicked:", button);
            if (isExternal) {
              window.open(button.link, "_blank");
            } else {
              console.log("Navigating to:", button.link);
              navigate(button.link);
            }
          };

          return (
            <Button
              key={i}
              size="lg"
              className={variants[button.style] || variants.primary}
              onClick={handleClick}
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
          <video
            src={resolveVideoSrc(section.media_url)}
            controls
            className="w-full max-w-4xl mx-auto rounded-2xl shadow-2xl mb-8"
          />
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
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16 relative">
          {section.title && (
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 blur-3xl" />
              <h2 className="relative text-5xl md:text-7xl font-bold mb-8 bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent leading-tight drop-shadow-sm">
                {section.title}
              </h2>
            </div>
          )}
          {section.subtitle && (
            <p className="text-2xl md:text-3xl font-semibold text-foreground mb-4 max-w-4xl mx-auto leading-relaxed">
              {section.subtitle}
            </p>
          )}
        </div>
        {section.description && (
          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {section.description.split('\n').map((line: string, i: number) => {
              if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
                return null;
              }
              if (line.trim().startsWith('•')) {
                const text = line.replace('•', '').trim();
                const isBold = text.startsWith('**') && text.includes('**');
                const cleanText = text.replace(/\*\*/g, '');
                
                return (
                  <Card key={i} className="group relative p-8 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 border-primary/20 hover:border-primary/40 bg-gradient-to-br from-card via-card to-card/80 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative flex gap-4 items-start">
                      <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <CheckCircle2 className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-lg leading-relaxed text-foreground font-medium">
                          {isBold ? <strong className="text-xl">{cleanText}</strong> : cleanText}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              }
              return line.trim() ? (
                <p key={i} className="md:col-span-2 text-xl text-center text-muted-foreground leading-relaxed mb-6">
                  {line}
                </p>
              ) : null;
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
                <video src={resolveVideoSrc(section.media_url)} controls className="w-full rounded-2xl shadow-2xl" />
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

          <div className="space-y-16 relative">
            <div className="absolute left-20 md:left-24 top-0 bottom-0 w-px bg-gradient-to-b from-primary/30 via-primary/20 to-transparent" />
            {items.map((item: any, i: number) => (
              <div key={i} className="flex gap-8 md:gap-12 group relative">
                {/* Badge de Data Redesenhado */}
                <div className="relative z-10 flex-shrink-0">
                  <div className="relative">
                    {/* Badge de ano/data */}
                    <div className="w-32 md:w-40 bg-gradient-to-br from-primary via-primary to-primary/80 rounded-2xl p-4 shadow-xl group-hover:shadow-2xl group-hover:scale-105 transition-all">
                      <div className="text-center">
                        <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
                          {item.year.includes(' ') ? item.year.split(' ')[0] : ''}
                        </div>
                        <div className="text-3xl font-bold text-white leading-none">
                          {item.year.includes(' ') ? item.year.split(' ').slice(1).join(' ') : item.year}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card de Conteúdo */}
                <Card className="flex-1 p-8 hover:shadow-2xl transition-all hover:-translate-y-1 border-border/50 bg-gradient-to-br from-card to-card/50">
                  <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">{item.title}</h3>
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

  const renderJustificationSection = () => {
    const jd = normalizeJustificationContentData(section.content_data);
    const outer = [
      getSpacingClass(section.spacing_top),
      getSpacingClass(section.spacing_bottom),
      getJustificationSurfaceClasses(section.theme),
      getAnimationClass(section.animation_type),
      section.custom_css || "",
      "px-4",
    ]
      .join(" ")
      .trim();

    const hasIntroBlock =
      Boolean(section.title?.trim()) ||
      Boolean(section.description?.trim()) ||
      Boolean(section.media_url);

    return (
      <section className={outer} style={animationStyle}>
        <div className="container mx-auto max-w-6xl">
          {hasIntroBlock && (
            <div className="grid md:grid-cols-2 gap-10 lg:gap-14 items-center mb-12 md:mb-16">
              <div className="min-w-0">
                {section.title?.trim() ? (
                  <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">
                    {section.title}
                  </h2>
                ) : null}
                {section.description?.trim() ? (
                  <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                    {section.description}
                  </p>
                ) : null}
              </div>
              <div className="min-w-0">
                {section.media_url && section.media_type === "image" ? (
                  <img
                    src={section.media_url}
                    alt={section.title || ""}
                    className="w-full rounded-2xl border border-border/50 shadow-lg object-cover"
                  />
                ) : section.media_url && section.media_type === "video" ? (
                  <video
                    src={resolveVideoSrc(section.media_url)}
                    controls
                    className="w-full rounded-2xl border border-border/50 shadow-lg"
                  />
                ) : (
                  <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border/40 bg-muted/20 shadow-md">
                    <video
                      controls
                      playsInline
                      preload="metadata"
                      poster={landingHeroVideoPoster}
                      className="h-full w-full object-cover"
                      aria-label="Vídeo de apresentação da ProGenia"
                    >
                      <source
                        src={`/videos/${language === "en" ? "landing-hero-video-en.mp4" : "landing-hero-video-pt.mp4"}`}
                        type="video/mp4"
                      />
                    </video>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-6 md:gap-8">
            {jd.cards.map((card, i) => (
              <Card
                key={i}
                className="relative h-full overflow-hidden border-border/60 bg-card p-6 md:p-8 shadow-sm transition-all duration-300 hover:border-primary/25 hover:shadow-md"
              >
                <div
                  className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-primary/40"
                  aria-hidden
                />
                {card.label ? (
                  <Badge
                    variant="outline"
                    className="mb-4 w-fit border-primary/30 bg-primary/10 font-semibold uppercase tracking-wide text-primary"
                  >
                    {card.label}
                  </Badge>
                ) : null}
                <h3 className="text-lg md:text-xl font-bold text-foreground leading-snug mb-3">{card.title}</h3>
                <p className="text-base italic text-muted-foreground leading-relaxed">{card.description}</p>
              </Card>
            ))}
          </div>

          {renderButtons()}
        </div>
      </section>
    );
  };

  const renderMVVSection = () => {
    const mvv = normalizeMvvContentData(section.content_data);
    const valueFallbackIcons = ["Shield", "Microscope", "RefreshCw", "Brain", "Globe", "HeartHandshake"];

    return (
      <section className={wrapperClasses} style={animationStyle}>
        <div className="container mx-auto max-w-7xl relative">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[min(90vw,42rem)] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
          <div className="pointer-events-none absolute top-40 right-0 h-48 w-48 rounded-full bg-secondary/20 blur-3xl" />

          <div className="relative text-center mb-14 md:mb-16">
            {section.title && (
              <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-primary/85 to-primary/60 bg-clip-text text-transparent">
                {section.title}
              </h2>
            )}
            {section.subtitle && (
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                {section.subtitle}
              </p>
            )}
            {section.description && (
              <p className="mt-6 text-base md:text-lg text-muted-foreground/90 max-w-3xl mx-auto leading-relaxed">
                {section.description}
              </p>
            )}
          </div>

          <div className="relative grid lg:grid-cols-2 gap-6 lg:gap-8 mb-14 md:mb-16">
            <Card className="group relative overflow-hidden border border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.06] p-8 md:p-10 shadow-lg hover:shadow-xl hover:border-primary/35 transition-all duration-300">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/15 transition-colors" />
              <div className="relative flex items-start gap-4 mb-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-white shadow-lg">
                  <Target className="h-7 w-7" />
                </div>
                <div className="pt-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary/80 mb-1">Propósito</p>
                  <h3 className="text-2xl md:text-3xl font-bold text-foreground">{mvv.mission_title}</h3>
                </div>
              </div>
              <p className="relative text-muted-foreground leading-relaxed text-base md:text-lg">{mvv.mission_body}</p>
            </Card>

            <Card className="group relative overflow-hidden border border-secondary/25 bg-gradient-to-br from-card via-card to-secondary/[0.08] p-8 md:p-10 shadow-lg hover:shadow-xl hover:border-secondary/40 transition-all duration-300">
              <div className="absolute bottom-0 left-0 w-44 h-44 bg-secondary/15 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4 group-hover:bg-secondary/20 transition-colors" />
              <div className="relative flex items-start gap-4 mb-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground shadow-lg">
                  <Eye className="h-7 w-7" />
                </div>
                <div className="pt-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-secondary-foreground/80 mb-1">Horizonte</p>
                  <h3 className="text-2xl md:text-3xl font-bold text-foreground">{mvv.vision_title}</h3>
                </div>
              </div>
              <p className="relative text-muted-foreground leading-relaxed text-base md:text-lg">{mvv.vision_body}</p>
            </Card>
          </div>

          <div className="relative">
            <div className="text-center mb-10">
              <h3 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {mvv.values_title}
              </h3>
              <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-gradient-to-r from-primary to-secondary" />
            </div>

            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6">
              {mvv.values.map((item, i) => {
                const iconName = item.icon?.trim() || valueFallbackIcons[i % valueFallbackIcons.length];
                return (
                  <Card
                    key={i}
                    className="relative h-full border-l-4 border-l-primary/70 border-y border-r border-border/60 bg-card/80 backdrop-blur-sm p-6 md:p-7 hover:shadow-lg hover:border-l-primary hover:-translate-y-0.5 transition-all duration-300 group"
                  >
                    <div className="flex gap-4">
                      <div className="shrink-0 text-primary group-hover:scale-110 transition-transform duration-300 [&_svg]:h-9 [&_svg]:w-9 [&>span]:text-3xl">
                        {renderIcon(iconName)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-lg md:text-xl text-foreground mb-2 leading-snug">{item.title}</h4>
                        <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {renderButtons()}
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
          {section.title && <h2 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-white drop-shadow-xl">{section.title}</h2>}
          {section.subtitle && <p className="text-xl md:text-2xl text-gray-800 dark:text-white/90 mb-6 max-w-3xl mx-auto font-medium">{section.subtitle}</p>}
          {section.description && <p className="text-lg text-gray-700 dark:text-white/80 mb-10 max-w-2xl mx-auto font-medium">{section.description}</p>}
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
    case "justification":
      return renderJustificationSection();
    case "text_image":
    case "text+image":
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
    case "mvv":
      return renderMVVSection();
    default:
      return null;
  }
};
