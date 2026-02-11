import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Send, X, Minimize2, Maximize2, ArrowRight, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const isProGeniaLink = (href: string) =>
  /^\/(capsula|lesson|labs|module)\//.test(href) || href === "/capsulas";

const normalizePath = (href: string) => (href.startsWith("/") ? href : `/${href}`);

interface Message {
  role: "user" | "assistant";
  content: string;
}

const AITutor = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! Como posso te ajudar hoje?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-tutor", {
        body: { 
          message: userMessage,
          conversationHistory: messages.slice(-5), // Send last 5 messages for context
        },
      });

      if (error) {
        console.error("AI Tutor error:", error);
        throw error;
      }

      if (data?.response) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.response },
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
        className="fixed bottom-6 right-6 rounded-full h-16 w-16 shadow-glow gradient-accent text-white"
        size="icon"
      >
        <Brain className="h-7 w-7" />
      </Button>
    );
  }

  return (
    <Card
      className={`fixed bottom-6 right-6 shadow-2xl transition-all ${
        isMinimized ? "w-80 h-16" : "w-96 h-[600px]"
      } flex flex-col`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border gradient-primary rounded-t-lg">
        <div className="flex items-center gap-2 text-white">
          <Brain className="h-5 w-5" />
          <span className="font-semibold">Tutor de IA</span>
        </div>
        <div className="flex items-center gap-2">
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
                        : "bg-muted"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-a:no-underline">
                        <ReactMarkdown
                          components={{
                            a: ({ href, children }) => {
                              const path = href ? normalizePath(href) : "";
                              if (!path) return <span>{children}</span>;
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
                                    <span>{children}</span>
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
                          {message.content}
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
                placeholder="Pergunte-me qualquer coisa..."
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