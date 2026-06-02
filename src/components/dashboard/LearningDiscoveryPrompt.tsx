import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Compass,
  FlaskConical,
  Magnet,
  Search,
  Sun,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AiDisclaimerPopover } from "@/components/ai/AiDisclaimerPopover";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type TopicRefinement = {
  labelPt: string;
  labelEn: string;
  query: string;
};

type LearningTopic = {
  id: string;
  labelPt: string;
  labelEn: string;
  searchBase: string;
  icon: typeof Waves;
  refinements: TopicRefinement[];
};

const LEARNING_TOPICS: LearningTopic[] = [
  {
    id: "ultrassom",
    labelPt: "Ultrassom",
    labelEn: "Ultrasound",
    searchBase: "ultrassom",
    icon: Waves,
    refinements: [
      { labelPt: "Diagnóstico por imagem", labelEn: "Diagnostic imaging", query: "ultrassom diagnóstico" },
      { labelPt: "Ultrassom terapêutico", labelEn: "Therapeutic ultrasound", query: "ultrassom terapêutico" },
      { labelPt: "Parâmetros e segurança", labelEn: "Parameters and safety", query: "ultrassom parâmetros segurança" },
      { labelPt: "Laboratório virtual", labelEn: "Virtual lab", query: "ultrassom laboratório virtual" },
    ],
  },
  {
    id: "ressonancia",
    labelPt: "Ressonância magnética",
    labelEn: "Magnetic resonance",
    searchBase: "ressonância magnética",
    icon: Magnet,
    refinements: [
      { labelPt: "Sequências e contraste", labelEn: "Sequences and contrast", query: "ressonância magnética sequências contraste" },
      { labelPt: "Interpretação de imagens", labelEn: "Image interpretation", query: "ressonância magnética interpretação" },
      { labelPt: "Laboratório virtual de RM", labelEn: "MRI virtual lab", query: "ressonância magnética laboratório virtual" },
      { labelPt: "Explorar tudo sobre RM", labelEn: "Explore all MRI content", query: "ressonância magnética" },
    ],
  },
  {
    id: "eletroterapia",
    labelPt: "Eletroterapia / TENS",
    labelEn: "Electrotherapy / TENS",
    searchBase: "eletroterapia TENS",
    icon: Activity,
    refinements: [
      { labelPt: "Parâmetros de estimulação", labelEn: "Stimulation parameters", query: "eletroterapia parâmetros estimulação" },
      { labelPt: "Indicações clínicas", labelEn: "Clinical indications", query: "TENS indicações clínicas" },
      { labelPt: "Laboratório virtual TENS", labelEn: "TENS virtual lab", query: "TENS laboratório virtual" },
      { labelPt: "Explorar tudo", labelEn: "Explore all", query: "eletroterapia TENS" },
    ],
  },
  {
    id: "fotobiomodulacao",
    labelPt: "Fotobiomodulação",
    labelEn: "Photobiomodulation",
    searchBase: "fotobiomodulação",
    icon: Sun,
    refinements: [
      { labelPt: "Mecanismos biológicos", labelEn: "Biological mechanisms", query: "fotobiomodulação mecanismos" },
      { labelPt: "Parâmetros de aplicação", labelEn: "Application parameters", query: "fotobiomodulação parâmetros" },
      { labelPt: "Laboratório virtual", labelEn: "Virtual lab", query: "fotobiomodulação laboratório virtual" },
      { labelPt: "Explorar tudo", labelEn: "Explore all", query: "fotobiomodulação" },
    ],
  },
  {
    id: "labs",
    labelPt: "Laboratórios virtuais",
    labelEn: "Virtual labs",
    searchBase: "laboratório virtual",
    icon: FlaskConical,
    refinements: [
      { labelPt: "Simulações práticas", labelEn: "Practical simulations", query: "laboratório virtual simulação" },
      { labelPt: "Equipamentos e protocolos", labelEn: "Equipment and protocols", query: "laboratório virtual protocolos" },
      { labelPt: "Ver todos os labs", labelEn: "See all labs", query: "laboratório virtual" },
    ],
  },
];

type Step = "start" | "refine";

interface LearningDiscoveryPromptProps {
  capsulaInacabada?: { id: string; title: string } | null;
  className?: string;
}

export function LearningDiscoveryPrompt({ capsulaInacabada, className }: LearningDiscoveryPromptProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isEnglish = language === "en";

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("start");
  const [draft, setDraft] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<LearningTopic | null>(null);

  const resetFlow = () => {
    setStep("start");
    setDraft("");
    setSelectedTopic(null);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      window.setTimeout(resetFlow, 200);
    }
  };

  const goToSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleDraftSubmit = (event: FormEvent) => {
    event.preventDefault();
    goToSearch(draft);
  };

  const handleTopicSelect = (topic: LearningTopic) => {
    setSelectedTopic(topic);
    setStep("refine");
  };

  const handleRefinementSelect = (refinement: TopicRefinement) => {
    goToSearch(refinement.query);
  };

  const t = {
    heroTitle: isEnglish ? "What would you like to learn today?" : "O que você gostaria de aprender hoje?",
    heroSubtitle: isEnglish
      ? "Pick a topic or area to see content suggestions."
      : "Escolha um tema ou área e veja sugestões de conteúdo.",
    heroCta: isEnglish ? "Find content" : "Encontrar conteúdo",
    continueCapsule: isEnglish ? "Or continue where you left off" : "Ou continue de onde parou",
    dialogTitle: isEnglish ? "Discover ProGenia content" : "Descubra o conteúdo ProGenia",
    dialogSubtitle: isEnglish
      ? "Type a keyword or pick a topic to explore."
      : "Digite uma palavra-chave ou escolha um tema para explorar.",
    inputPlaceholder: isEnglish
      ? "E.g. therapeutic ultrasound, TENS, MRI sequences..."
      : "Ex.: ultrassom terapêutico, TENS, sequências de RM...",
    searchWithAi: isEnglish ? "Search content" : "Buscar conteúdos",
    orChoose: isEnglish ? "Or choose a topic" : "Ou escolha um tema",
    refineIntro: (topic: string) =>
      isEnglish
        ? `Great choice! "${topic}" is broad. What interests you most?`
        : `Ótimo! "${topic}" é amplo. O que te interessa mais?`,
    back: isEnglish ? "Back" : "Voltar",
    exploreTopic: isEnglish ? "Explore topic" : "Explorar tema",
    skipExplore: isEnglish ? "Browse all capsules" : "Ver catálogo de cápsulas",
  };

  return (
    <>
      <Card
        className={cn(
          "overflow-hidden border-border bg-muted/75 shadow-sm dark:bg-muted/50",
          className,
        )}
      >
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-snug sm:text-lg">{t.heroTitle}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.heroSubtitle}</p>
            {capsulaInacabada && (
              <button
                type="button"
                onClick={() => navigate(`/capsula/${capsulaInacabada.id}`)}
                className="mt-2.5 block text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {t.continueCapsule}: &ldquo;{capsulaInacabada.title}&rdquo;
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full shrink-0 gap-1.5 border-accent/50 bg-accent/10 font-semibold text-accent shadow-sm hover:bg-accent/20 hover:text-accent sm:w-auto"
            onClick={() => setOpen(true)}
          >
            <Compass className="h-4 w-4" />
            {t.heroCta}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-6">
              <Compass className="h-5 w-5 text-accent" />
              {t.dialogTitle}
            </DialogTitle>
            <DialogDescription className="flex items-start gap-1.5">
              <span className="flex-1">{t.dialogSubtitle}</span>
              <AiDisclaimerPopover language={isEnglish ? "en" : "pt"} />
            </DialogDescription>
          </DialogHeader>

          {step === "start" && (
            <div className="space-y-4">
              <form onSubmit={handleDraftSubmit} className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t.inputPlaceholder}
                    className="pl-9"
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={!draft.trim()}>
                  <Search className="h-4 w-4" />
                  {t.searchWithAi}
                </Button>
              </form>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.orChoose}</p>
                <div className="grid grid-cols-2 gap-2">
                  {LEARNING_TOPICS.map((topic) => {
                    const Icon = topic.icon;
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => handleTopicSelect(topic)}
                        className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-accent/40 hover:bg-muted/50"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-accent" />
                        <span className="text-sm font-medium leading-tight">
                          {isEnglish ? topic.labelEn : topic.labelPt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => navigate("/capsulas")}>
                {t.skipExplore}
              </Button>
            </div>
          )}

          {step === "refine" && selectedTopic && (
            <div className="space-y-4">
              <p className="rounded-lg bg-muted/60 p-3 text-sm leading-relaxed">
                {t.refineIntro(isEnglish ? selectedTopic.labelEn : selectedTopic.labelPt)}
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedTopic.refinements.map((refinement) => (
                  <Badge
                    key={refinement.query}
                    variant="secondary"
                    className="cursor-pointer px-3 py-1.5 text-sm font-normal hover:bg-accent/15 hover:text-accent-foreground"
                    onClick={() => handleRefinementSelect(refinement)}
                  >
                    {isEnglish ? refinement.labelEn : refinement.labelPt}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("start")}>
                  {t.back}
                </Button>
                <Button className="flex-1" onClick={() => goToSearch(selectedTopic.searchBase)}>
                  {t.exploreTopic}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
