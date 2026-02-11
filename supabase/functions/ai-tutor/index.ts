import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_PROMPT =
  "Você é um tutor de tecnologia médica na ProGenia. REGRAS: (1) Seja OBJETIVO e CONCISO. (2) Responda direto ao que o aluno perguntou. (3) SEMPRE que a pergunta se relacionar com algum módulo, aula, cápsula ou lab listado abaixo, INCLUA ao final da resposta 1–2 sugestões em Markdown, no formato [Nome do conteúdo](/caminho). Ex.: [Cápsula de ultrassom](/capsula/xxx), [Lab de TENS](/labs/tens). (4) Se houver conteúdo relevante no catálogo, é OBRIGATÓRIO sugerir — não termine a resposta sem indicar pelo menos um link quando existir correspondência.";

async function fetchProGeniaContent(supabase: ReturnType<typeof createClient>): Promise<string> {
  const parts: string[] = [];

  const { data: modules } = await supabase
    .from("modules")
    .select("id, title, description")
    .eq("is_published", true)
    .order("order_index", { ascending: true });

  if (modules?.length) {
    parts.push("## MÓDULOS\n");
    for (const m of modules) {
      parts.push(`- **${m.title}** (id: ${m.id})${m.description ? `: ${m.description}` : ""}`);
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, title, description")
        .eq("module_id", m.id)
        .eq("is_published", true)
        .order("order_index", { ascending: true });
      if (lessons?.length) {
        for (const l of lessons) {
          parts.push(`  - Aula: **${l.title}** (id: ${l.id})${l.description ? ` - ${l.description}` : ""}`);
        }
      }
      const { data: capsulas } = await supabase
        .from("capsulas")
        .select("id, title, description")
        .eq("module_id", m.id)
        .eq("is_published", true)
        .order("order_index", { ascending: true });
      if (capsulas?.length) {
        for (const c of capsulas) {
          parts.push(`  - Cápsula: **${c.title}** (id: ${c.id})${c.description ? ` - ${c.description}` : ""}`);
        }
      }
      parts.push("");
    }
  }

  const { data: capsulasGerais } = await supabase
    .from("capsulas")
    .select("id, title, description")
    .is("module_id", null)
    .eq("is_published", true)
    .order("order_index", { ascending: true });

  if (capsulasGerais?.length) {
    parts.push("## CÁPSULAS (sem módulo específico)\n");
    for (const c of capsulasGerais) {
      parts.push(`- **${c.title}** (id: ${c.id})${c.description ? ` - ${c.description}` : ""}`);
    }
    parts.push("");
  }

  const { data: labs } = await supabase
    .from("virtual_labs")
    .select("id, title, description, lab_type, slug")
    .eq("is_published", true);

  if (labs?.length) {
    parts.push("## LABS VIRTUAIS\n");
    for (const lab of labs) {
      parts.push(`- **${lab.title}** (slug: ${lab.slug}, tipo: ${lab.lab_type})${lab.description ? ` - ${lab.description}` : ""}`);
    }
  }

  if (parts.length === 0) return "";
  return "\n\n---\nCONTEÚDO DA PROGENIA (use para basear respostas e sugerir links):\n\n" + parts.join("\n");
}

function toGroqMessages(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string
) {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];
  for (const msg of history) {
    messages.push({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    });
  }
  messages.push({ role: "user", content: userMessage });
  return messages;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory } = await req.json();
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const contentContext = await fetchProGeniaContent(supabase);
    const systemPrompt = BASE_PROMPT + contentContext;

    const history = conversationHistory || [];
    const messages = toGroqMessages(systemPrompt, history, message);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API error:", response.status, errorText);

      return new Response(
        JSON.stringify({ error: `Groq API ${response.status}: ${errorText.slice(0, 200)}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
      console.error("Unexpected Groq response:", data);
      throw new Error("Invalid response from AI service");
    }

    return new Response(
      JSON.stringify({ response: text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error in ai-tutor:", msg);
    return new Response(
      JSON.stringify({ error: `ai-tutor: ${msg}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
