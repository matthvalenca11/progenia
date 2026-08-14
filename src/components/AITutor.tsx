import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Send, X, Minimize2, Maximize2, ArrowRight, BookOpen, Compass, FlaskConical, Route } from "lucide-react";
import { AiDisclaimerPopover } from "@/components/ai/AiDisclaimerPopover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { invokeEdgeFunction } from "@/services/edgeFunctionService";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { CookiePreferencesButton } from "@/components/privacy/CookiePreferencesButton";
import {
  NUDGE_APPEAR_DELAY_MS,
  NUDGE_AUTO_HIDE_MS,
  canOfferNudge,
  hasPendingCompletionNudge,
  isCalmNudgeRoute,
  markTutorOpenedForNudge,
  nudgeKindLabel,
  rememberNudgeAccepted,
  rememberNudgeDismissed,
  rememberNudgeShown,
  shouldAttemptNudge,
  type TutorNudgePayload,
} from "@/lib/tutorNudge";

const isProGeniaLink = (href: string) =>
  /^\/(capsula|lesson|labs?|module)\//.test(href) || href === "/capsulas";

const normalizePath = (href: string) => {
  let path = href?.trim().startsWith("/") ? href.trim() : `/${(href || "").trim()}`;
  if (path.startsWith("/lab/") && !path.startsWith("/labs/")) path = path.replace("/lab/", "/labs/");
  return path;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function stripPrefix(s: string) {
  return s.replace(/^(Cápsula|Aula|Lab de|Lab):\s*/i, "").trim();
}

/** Remove path e prefixos do texto exibido no botão (ex: "Sugerido: /capsula/uuid Título" → "Título") */
function cleanLinkDisplayText(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/\s*\/capsula\/[0-9a-f-]+\s*/gi, " ")
    .replace(/\s*\/lesson\/[0-9a-f-]+\s*/gi, " ")
    .replace(/\s*\/module\/[0-9a-f-]+\s*/gi, " ")
    .replace(/\s*\/labs?\/[^\s]+\s*/gi, " ")
    .replace(/^Sugerido:\s*/i, "")
    .trim();
}

function findMatch<T extends { title: string }>(label: string, items: T[]): T | null {
  const n = norm(stripPrefix(label));
  for (const item of items) {
    const tn = norm(item.title);
    if (tn.includes(n) || n.includes(tn)) return item;
  }
  return null;
}

type Catalog = { capsulas: { id: string; title: string }[]; labs: { slug: string; title: string }[]; lessons: { id: string; title: string }[]; modules: { id: string; title: string }[] };

function fixProGeniaLinks(text: string, catalog: Catalog): string {
  return text
    .replace(/\[([^\]]*)\]\(\s*(\/capsula\/[^)\s]+)\s*\)/g, (_, label, path) => {
      const id = path.replace("/capsula/", "").trim();
      if (UUID_REGEX.test(id)) return `[${label}](${path})`;
      const m = findMatch(label, catalog.capsulas);
      return m ? `[${label}](/capsula/${m.id})` : `[${label}](${path})`;
    })
    .replace(/\[([^\]]*)\]\(\s*(\/labs?\/[^)\s]+)\s*\)/g, (_, label, path) => {
      const slug = path.replace(/\/labs?\//, "").trim();
      const exists = catalog.labs.some((l) => l.slug === slug);
      if (exists) return `[${label}](${path})`;
      const m = findMatch(label, catalog.labs);
      return m ? `[${label}](/labs/${m.slug})` : `[${label}](/labs/${slug})`;
    })
    .replace(/\[([^\]]*)\]\(\s*(\/lesson\/[^)\s]+)\s*\)/g, (_, label, path) => {
      const id = path.replace("/lesson/", "").trim();
      if (UUID_REGEX.test(id)) return `[${label}](${path})`;
      const m = findMatch(label, catalog.lessons);
      return m ? `[${label}](/lesson/${m.id})` : `[${label}](${path})`;
    })
    .replace(/\[([^\]]*)\]\(\s*(\/module\/[^)\s]+)\s*\)/g, (_, label, path) => {
      const id = path.replace("/module/", "").trim();
      if (UUID_REGEX.test(id)) return `[${label}](${path})`;
      const m = findMatch(label, catalog.modules);
      return m ? `[${label}](/module/${m.id})` : `[${label}](${path})`;
    });
}

function makeNoInfoResponseMoreConcise(text: string): string {
  const trimmed = (text || "").trim();
  if (!trimmed) return trimmed;

  // Detect refusal/no-info template in PT/EN and keep only the first 1-2 sentences.
  const normalized = norm(trimmed).replace(/’/g, "'");
  const looksLikeNoInfo =
    normalized.includes(norm("não encontrei informação confiável")) ||
    normalized.includes("couldn't find reliable information") ||
    normalized.includes("couldnt find reliable information");

  if (!looksLikeNoInfo) return trimmed;

  // Keep at most two sentences to avoid very long answers when the tutor can't help.
  const sentences = trimmed.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/);
  return sentences.slice(0, 2).join(" ").trim();
}

type TutorSuggestion = {
  title: string;
  path: string;
  kind?: string;
  reason?: string;
};

interface Message {
  role: "user" | "assistant";
  content: string;
  suggestions?: TutorSuggestion[];
}

type TutorIntent = "open" | "next" | "progress" | "explore" | "chat" | "nudge";

function suggestionIcon(kind?: string) {
  if (kind === "lab") return FlaskConical;
  if (kind === "module") return Compass;
  if (kind === "capsula") return BookOpen;
  return Route;
}

function kindFromPath(path: string): NonNullable<TutorSuggestion["kind"]> {
  const normalized = normalizePath(path);
  if (normalized.startsWith("/labs/") || normalized.startsWith("/lab/")) return "lab";
  if (normalized.startsWith("/capsula")) return "capsula";
  if (normalized.startsWith("/module")) return "module";
  return "lesson";
}

const PROGENIA_MD_LINK_RE = /\[([^\]]+)\]\(\s*(\/?(?:capsula|lesson|labs?|module)\/[^)\s]+)\s*\)/gi;

function extractTutorPresentation(content: string, extras?: TutorSuggestion[]) {
  const actions: TutorSuggestion[] = [];
  const seen = new Set<string>();

  const add = (item: TutorSuggestion) => {
    const path = normalizePath(item.path);
    if (!isProGeniaLink(path) || seen.has(path)) return;
    seen.add(path);
    actions.push({
      title: cleanLinkDisplayText(item.title) || item.title,
      path,
      kind: item.kind || kindFromPath(path),
      reason: item.reason,
    });
  };

  for (const item of extras || []) add(item);

  let prose = content.replace(PROGENIA_MD_LINK_RE, (_match, label, path) => {
    add({ title: String(label), path: String(path), kind: kindFromPath(path) });
    return "";
  });

  prose = prose
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([.!?])\s*\1+/g, "$1")
    .replace(/\s+\./g, ".")
    .replace(/\bé\s*\./gi, "está abaixo.")
    .replace(/\bis\s*\./gi, "is below.")
    .replace(/\bexperimente\s*\./gi, "experimente uma destas opções.")
    .replace(/\btry\s*\./gi, "try one of these.")
    .replace(/\babra\s*\./gi, "veja as opções abaixo.")
    .replace(/\bopen\s*\./gi, "see the options below.")
    .replace(/\bé\s*$/i, "está abaixo.")
    .replace(/\bis\s*$/i, "is below.")
    .trim();

  return { prose, actions: actions.slice(0, 3) };
}

function TutorActionCards({
  items,
  onOpen,
}: {
  items: TutorSuggestion[];
  onOpen: (path: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="mt-3 flex flex-col gap-2 not-prose">
      {items.map((item) => {
        const Icon = suggestionIcon(item.kind);
        return (
          <button
            key={item.path}
            type="button"
            onClick={() => onOpen(item.path)}
            className="group flex w-full items-center gap-3 rounded-xl border border-border/80 bg-background px-3 py-2.5 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium leading-snug text-foreground">{item.title}</span>
              {item.reason ? (
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{item.reason}</span>
              ) : null}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>
        );
      })}
    </div>
  );
}

/** Cookie FAB (h-9) + gap below the tutor pill. */
type AITutorProps = {
  /** Empilha cookies abaixo do tutor no canto inferior direito. */
  stackCookieBelow?: boolean;
};

const AITutor = ({ stackCookieBelow = false }: AITutorProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [fabPortalReady, setFabPortalReady] = useState(false);
  const guidedOpenRef = useRef(false);
  const sendingRef = useRef(false);
  const [nudge, setNudge] = useState<TutorNudgePayload | null>(null);

  useEffect(() => {
    setFabPortalReady(true);
  }, []);

  const scrollToBottom = () => {
    const viewport = scrollRef.current?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  };

  useLayoutEffect(() => {
    if (!isOpen || isMinimized) return;
    scrollToBottom();
    const frame = window.requestAnimationFrame(scrollToBottom);
    const timeout = window.setTimeout(scrollToBottom, 80);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [messages, loading, isOpen, isMinimized]);

  const fetchCatalog = async () => {
    try {
      const [caps, labs, lessons, modules] = await Promise.all([
        supabase.from("capsulas").select("id, title").eq("is_published", true),
        supabase.from("virtual_labs").select("slug, title").eq("is_published", true),
        supabase.from("lessons").select("id, title").eq("is_published", true),
        supabase.from("modules").select("id, title").eq("is_published", true),
      ]);
      const c: Catalog = {
        capsulas: caps.data || [],
        labs: labs.data || [],
        lessons: lessons.data || [],
        modules: modules.data || [],
      };
      setCatalog(c);
      return c;
    } catch (error) {
      console.warn("AI Tutor catalog warning:", error);
      const emptyCatalog: Catalog = { capsulas: [], labs: [], lessons: [], modules: [] };
      setCatalog(emptyCatalog);
      return emptyCatalog;
    }
  };

  useEffect(() => {
    if (isOpen && !catalog) {
      void fetchCatalog();
    }
  }, [isOpen]);

  const sendTutorMessage = async (
    userMessage: string,
    intent: TutorIntent = "chat",
    options?: { hideUser?: boolean },
  ) => {
    if (!userMessage.trim() || sendingRef.current) return;

    sendingRef.current = true;
    if (!options?.hideUser) {
      setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    }
    setLoading(true);

    try {
      const currentCatalog = catalog ?? await fetchCatalog();
      const history = messages
        .filter((item) => item.content.trim())
        .slice(-5)
        .map(({ role, content }) => ({ role, content }));
      const { data, error } = await invokeEdgeFunction<{
        response?: string;
        error?: string;
        suggestions?: TutorSuggestion[];
      }>(
        "ai-tutor",
        {
          message: userMessage,
          conversationHistory: history,
          userId: user?.id ?? null,
          intent,
          language: isEnglish ? "en" : "pt",
        },
      );

      if (error) {
        console.error("AI Tutor error:", error);
        throw error;
      }

      if (data?.response) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: makeNoInfoResponseMoreConcise(fixProGeniaLinks(data.response, currentCatalog)),
            suggestions: data.suggestions?.slice(0, 3),
          },
        ]);
      } else if (data?.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Erro: ${data.error}` },
        ]);
        toast.error(data.error);
      }
    } catch (error: any) {
      console.error("Error calling AI tutor:", error);

      if (error.message?.includes("429") || error.status === 429) {
        toast.error("Limite de taxa atingido. Por favor, aguarde um momento antes de tentar novamente.");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Estou recebendo muitas solicitações agora. Por favor, tente novamente em um momento.",
          },
        ]);
      } else if (error.message?.includes("402") || error.status === 402) {
        toast.error("Créditos de IA esgotados. Por favor, adicione créditos para continuar usando o tutor de IA.");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "O serviço de IA requer créditos adicionais. Por favor, entre em contato com seu administrador.",
          },
        ]);
      } else {
        const raw = error?.message || error?.error || "Erro desconhecido";
        const errorMsg =
          /failed to fetch/i.test(raw)
            ? "Não consegui falar com o tutor agora. Recarregue a página e tente de novo."
            : raw;
        toast.error(errorMsg);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Peço desculpas, mas encontrei um erro: ${errorMsg}. Por favor, tente novamente.`,
          },
        ]);
      }
    } finally {
      sendingRef.current = false;
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sendingRef.current) return;
    const userMessage = input.trim();
    setInput("");
    await sendTutorMessage(userMessage, "chat");
  };

  const closeTutor = () => {
    setIsOpen(false);
    setIsMinimized(false);
    setMessages([]);
    setInput("");
    guidedOpenRef.current = false;
    sendingRef.current = false;
  };

  const openTutor = () => {
    if (user?.id) markTutorOpenedForNudge(user.id);
    setNudge(null);
    setIsOpen(true);
  };

  const dismissNudge = () => {
    if (user?.id) rememberNudgeDismissed(user.id);
    setNudge(null);
  };

  const acceptNudge = () => {
    if (!nudge) return;
    if (user?.id) rememberNudgeAccepted(user.id, nudge.path);
    const path = nudge.path;
    setNudge(null);
    navigate(normalizePath(path));
  };

  const openSuggestion = (path: string) => {
    closeTutor();
    navigate(normalizePath(path));
  };

  const quickPrompts = isEnglish
    ? [
        { intent: "next" as const, label: "What next?", message: "What should I do next on ProGenia?" },
        { intent: "progress" as const, label: "My progress", message: "Summarize my progress and what is still missing." },
        { intent: "explore" as const, label: "Try a lab", message: "Suggest a virtual lab I have not tried yet." },
      ]
    : [
        { intent: "next" as const, label: "Próximo passo", message: "O que eu deveria fazer agora na ProGenia?" },
        { intent: "progress" as const, label: "Meu progresso", message: "Resume o que eu já fiz e o que ainda falta." },
        { intent: "explore" as const, label: "Experimentar lab", message: "Me indica um laboratório virtual que eu ainda não experimentei." },
      ];

  useEffect(() => {
    if (!isOpen || authLoading) return;
    if (guidedOpenRef.current) return;
    guidedOpenRef.current = true;
    const opener = isEnglish
      ? "What should I do next on ProGenia based on what I already completed?"
      : "O que eu deveria fazer agora na ProGenia, com base no que eu já fiz?";
    void sendTutorMessage(opener, "open", { hideUser: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the chat is opened
  }, [isOpen, authLoading, user?.id]);

  useEffect(() => {
    if (isOpen || authLoading || !user?.id) {
      if (isOpen) setNudge(null);
      return;
    }
    if (!isCalmNudgeRoute(location.pathname) || !shouldAttemptNudge(user.id, location.pathname)) {
      setNudge(null);
      return;
    }

    let cancelled = false;
    const delay = hasPendingCompletionNudge() ? 5000 : NUDGE_APPEAR_DELAY_MS;
    const timer = window.setTimeout(async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const { data } = await invokeEdgeFunction<{
          nudge?: TutorNudgePayload | null;
          suggestions?: TutorNudgePayload[];
        }>("ai-tutor", {
          message: "nudge",
          conversationHistory: [],
          userId: user.id,
          intent: "nudge",
          language: isEnglish ? "en" : "pt",
        });
        if (cancelled) return;
        const candidates = [
          ...(data?.nudge ? [data.nudge] : []),
          ...(data?.suggestions || []),
        ];
        const pick = candidates.find((item) => item?.path && canOfferNudge(user.id, item.path, location.pathname));
        if (!pick) return;
        rememberNudgeShown(user.id, pick.path);
        setNudge({
          ...pick,
          prompt: pick.prompt || (isEnglish ? `Continue with ${pick.title}?` : `Continuar com ${pick.title}?`),
        });
      } catch (error) {
        console.warn("AI Tutor nudge skipped:", error);
      }
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, authLoading, user?.id, location.pathname, isEnglish]);

  useEffect(() => {
    if (!nudge) return;
    const timer = window.setTimeout(() => setNudge(null), NUDGE_AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [nudge]);

  if (!isOpen) {
    const nudgeBubble = nudge ? (
      <div
        className="pointer-events-auto mb-2 w-[min(17.5rem,calc(100vw-3.5rem))] origin-bottom-right animate-in fade-in zoom-in-95 slide-in-from-bottom-2 rounded-2xl border border-border/80 bg-card p-3 text-left shadow-lg duration-200"
        role="status"
      >
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Brain className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" data-no-auto-translate="true">
              {nudgeKindLabel(nudge.kind, isEnglish)}
            </p>
            <p className="mt-0.5 text-sm leading-snug text-foreground" data-no-auto-translate="true">
              {nudge.prompt || nudge.title}
            </p>
            <button
              type="button"
              onClick={acceptNudge}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              data-no-auto-translate="true"
            >
              {isEnglish ? "Open" : "Abrir"}
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <button
            type="button"
            onClick={dismissNudge}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={isEnglish ? "Dismiss suggestion" : "Dispensar sugestão"}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    ) : null;

    const tutorFabButton = (
      <Button
        onClick={openTutor}
        className={
          stackCookieBelow
            ? "inline-flex h-12 shrink-0 items-center gap-2 rounded-full gradient-accent px-4 text-sm text-white shadow-glow md:h-14 md:px-5 md:text-base"
            : "inline-flex h-12 shrink-0 items-center gap-2 rounded-full gradient-accent px-4 text-sm text-white shadow-glow md:h-14 md:px-5 md:text-base"
        }
      >
        <Brain className="h-5 w-5" />
        <span className="font-semibold" data-no-auto-translate="true">
          {isEnglish ? "AI Tutor" : "Tutor de IA"}
        </span>
      </Button>
    );

    if (stackCookieBelow) {
      if (!fabPortalReady || typeof document === "undefined") return null;
      return createPortal(
        <div
          className="pointer-events-none fixed z-50 flex flex-col items-end gap-1 bottom-[calc(var(--sab,env(safe-area-inset-bottom,0px))+0.75rem)] right-[calc(var(--sar,env(safe-area-inset-right,0px))+0.75rem)] md:bottom-6 md:right-6"
        >
          <CookiePreferencesButton variant="icon" embedded />
          <div className="pointer-events-auto flex flex-col items-end">
            {nudgeBubble}
            {tutorFabButton}
          </div>
        </div>,
        document.body,
      );
    }

    if (isMobile) {
      return (
        <div className="fixed z-50 bottom-[calc(var(--sab,env(safe-area-inset-bottom,0px))+0.75rem)] right-[calc(var(--sar,env(safe-area-inset-right,0px))+0.75rem)] flex flex-col items-end md:hidden">
          {nudgeBubble}
          {tutorFabButton}
        </div>
      );
    }

    return (
      <div className="fixed z-50 bottom-6 right-6 flex flex-col items-end">
        {nudgeBubble}
        {tutorFabButton}
      </div>
    );
  }

  return (
    <Card
      className={`fixed z-50 flex flex-col shadow-2xl transition-all ${
        isMobile
          ? isMinimized
            ? "bottom-[calc(var(--sab,env(safe-area-inset-bottom,0px))+0.75rem)] left-[calc(var(--sal,env(safe-area-inset-left,0px))+0.75rem)] right-[calc(var(--sar,env(safe-area-inset-right,0px))+0.75rem)] h-16"
            : "bottom-[calc(var(--sab,env(safe-area-inset-bottom,0px))+0.5rem)] left-[calc(var(--sal,env(safe-area-inset-left,0px))+0.5rem)] right-[calc(var(--sar,env(safe-area-inset-right,0px))+0.5rem)] h-[46dvh] max-h-[46dvh]"
          : isMinimized
            ? "bottom-6 right-6 w-80 h-16"
            : "bottom-6 right-6 w-96 h-[600px]"
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between border-b border-border gradient-primary rounded-t-lg ${isMobile ? "p-3" : "p-4"}`}>
        <div className="flex items-center gap-2 text-white">
          <Brain className="h-5 w-5" />
          <div className="min-w-0">
            <span className="font-semibold" data-no-auto-translate="true">
              {isEnglish ? "AI Tutor" : "Tutor de IA"}
            </span>
            <p className="text-[11px] leading-none text-white/80" data-no-auto-translate="true">
              {isEnglish ? "Your learning guide" : "Seu guia na trilha"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AiDisclaimerPopover />
          {!isMobile && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsMinimized(!isMinimized)}
              className="h-8 w-8 text-white hover:bg-white/20"
            >
              {isMinimized ? (
                <Maximize2 className="h-4 w-4" />
              ) : (
                <Minimize2 className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={closeTutor}
            className="h-8 w-8 text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <ScrollArea ref={scrollRef} className={`flex-1 ${isMobile ? "p-3" : "p-4"}`}>
            <div className="space-y-4">
              {messages.length === 0 && (
                <p className="text-xs text-muted-foreground" data-no-auto-translate="true">
                  {isEnglish
                    ? "Looking at your path to suggest the next step..."
                    : "Olhando sua trilha para indicar o próximo passo..."}
                </p>
              )}
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[94%] rounded-2xl ${isMobile ? "px-3.5 py-3" : "px-4 py-3"} ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-foreground border border-border/70 dark:bg-muted/30"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      (() => {
                        const source = catalog ? fixProGeniaLinks(message.content, catalog) : message.content;
                        const { prose, actions } = extractTutorPresentation(source, message.suggestions);
                        return (
                          <div className="text-sm leading-relaxed">
                            {prose ? (
                              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0 prose-a:text-primary">
                                <ReactMarkdown
                                  components={{
                                    a: ({ href, children }) => {
                                      const path = href ? normalizePath(href) : "";
                                      if (!path) return <span>{children}</span>;
                                      if (isProGeniaLink(path)) {
                                        return <span className="font-medium">{children}</span>;
                                      }
                                      return (
                                        <a href={path} target="_blank" rel="noopener noreferrer" className="underline">
                                          {children}
                                        </a>
                                      );
                                    },
                                  }}
                                >
                                  {prose}
                                </ReactMarkdown>
                              </div>
                            ) : null}
                            <TutorActionCards items={actions} onOpen={openSuggestion} />
                          </div>
                        );
                      })()
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce"></div>
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className={`border-t border-border ${isMobile ? "p-3" : "p-4"}`}>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt.intent}
                  type="button"
                  disabled={loading}
                  onClick={() => void sendTutorMessage(prompt.message, prompt.intent)}
                  className="rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                  data-no-auto-translate="true"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder={isEnglish ? "Ask, or request your next step..." : "Pergunte, ou peça o próximo passo..."}
                data-no-auto-translate="true"
                disabled={loading}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                size="icon"
                className="gradient-accent text-white"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};

export default AITutor;