import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Send, X, Minimize2, Maximize2, ArrowRight, BookOpen } from "lucide-react";
import { AiDisclaimerPopover } from "@/components/ai/AiDisclaimerPopover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

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

function findMatch(label: string, items: { title: string }[]) {
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

interface Message {
  role: "user" | "assistant";
  content: string;
}

const AITutor = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Olá! Como posso te ajudar hoje?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const fetchCatalog = async () => {
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
  };

  useEffect(() => {
    if (isOpen && !catalog) fetchCatalog();
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      await fetchCatalog();
      const { data, error } = await supabase.functions.invoke("ai-tutor", {
        body: { 
          message: userMessage,
          conversationHistory: messages.slice(-5),
          userId: user?.id ?? null,
        },
      });

      if (error) {
        console.error("AI Tutor error:", error);
        throw error;
      }

      if (data?.response) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: makeNoInfoResponseMoreConcise(data.response) },
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
            content: "Estou recebendo muitas solicitações agora. Por favor, tente novamente em um momento." 
          },
        ]);
      } else if (error.message?.includes("402") || error.status === 402) {
        toast.error("Créditos de IA esgotados. Por favor, adicione créditos para continuar usando o tutor de IA.");
        setMessages((prev) => [
          ...prev,
          { 
            role: "assistant", 
            content: "O serviço de IA requer créditos adicionais. Por favor, entre em contato com seu administrador." 
          },
        ]);
      } else {
        const errorMsg = error?.message || error?.error || "Erro desconhecido";
        toast.error(errorMsg);
        setMessages((prev) => [
          ...prev,
          { 
            role: "assistant", 
            content: `Peço desculpas, mas encontrei um erro: ${errorMsg}. Por favor, tente novamente.` 
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 rounded-full h-14 px-5 shadow-glow gradient-accent text-white inline-flex items-center gap-2"
      >
        <Brain className="h-5 w-5" />
        <span className="font-semibold" data-no-auto-translate="true">
          {isEnglish ? "AI Tutor" : "Tutor de IA"}
        </span>
      </Button>
    );
  }

  return (
    <Card
      className={`fixed bottom-6 right-6 z-50 shadow-2xl transition-all ${
        isMinimized ? "w-80 h-16" : "w-96 h-[600px]"
      } flex flex-col`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border gradient-primary rounded-t-lg">
        <div className="flex items-center gap-2 text-white">
          <Brain className="h-5 w-5" />
          <span className="font-semibold" data-no-auto-translate="true">
            {isEnglish ? "AI Tutor" : "Tutor de IA"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AiDisclaimerPopover />
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
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-orange-50 text-orange-900 border border-orange-200/70 dark:bg-orange-950/25 dark:text-orange-200 dark:border-orange-800/60"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-a:no-underline">
                        <ReactMarkdown
                          components={{
                            a: ({ href, children }) => {
                              const path = href ? normalizePath(href) : "";
                              if (!path) return <span>{children}</span>;
                              const rawText = typeof children === "string" ? children : (Array.isArray(children) ? children.map((c: any) => typeof c === "string" ? c : c?.props?.children ?? "").join("") : String(children ?? ""));
                              const displayText = cleanLinkDisplayText(rawText) || rawText;
                              if (isProGeniaLink(path)) {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsOpen(false);
                                      navigate(path);
                                    }}
                                    className="mt-2 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors text-left"
                                  >
                                    <BookOpen className="h-4 w-4 flex-shrink-0" />
                                    <span>{displayText}</span>
                                    <ArrowRight className="h-3.5 w-3.5 flex-shrink-0" />
                                  </button>
                                );
                              }
                              return (
                                <a href={path} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                                  {children}
                                </a>
                              );
                            },
                          }}
                        >
                          {catalog ? fixProGeniaLinks(message.content, catalog) : message.content}
                        </ReactMarkdown>
                      </div>
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
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder={isEnglish ? "Ask me anything..." : "Pergunte-me qualquer coisa..."}
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