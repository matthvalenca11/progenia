import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_PROMPT =
  "Você é um tutor de tecnologia médica na ProGenia. REGRAS: (1) Seja OBJETIVO e CONCISO. (2) Responda direto ao que o aluno perguntou. (3) SEMPRE que a pergunta se relacionar com algum módulo, aula, cápsula ou lab listado abaixo, INCLUA ao final da resposta 1–2 sugestões em Markdown, no formato [Nome do conteúdo](/caminho). Use APENAS o título descritivo no texto do link, nunca o path ou UUID. " +
  "IMPORTANTE — USE APENAS IDs E SLUGS EXATOS DO CATÁLOGO ABAIXO. NUNCA invente ou resuma URLs. " +
  "Formato exato: Aulas = /lesson/ID_COMPLETO. Cápsulas = /capsula/ID_COMPLETO. Labs = /labs/SLUG_EXATO. Módulos = /module/ID_COMPLETO. Copie o id ou slug EXATAMENTE como está no catálogo. " +
  "(4) MATRÍCULA: As aulas pertencem a módulos. Se a seção MATRÍCULAS DO USUÁRIO indicar que ele NÃO está matriculado no módulo da aula que você quer sugerir, NÃO sugira o link da aula diretamente. Em vez disso, sugira que ele se matricule no módulo: 'Para acessar esta aula, matricule-se no módulo: [Nome do módulo](/module/ID_DO_MODULO)'. Cápsulas e labs podem ser sugeridos normalmente (não exigem matrícula). " +
  "(5) Se houver conteúdo relevante no catálogo, é OBRIGATÓRIO sugerir — não termine a resposta sem indicar pelo menos um link quando existir correspondência. " +
  "(6) Tamanho da resposta: em qualquer caso, NÃO escreva respostas longas. Priorize 2–4 frases no máximo. " +
  "(7) Se você NÃO encontrar informação relevante no CONTEÚDO DA PROGENIA (ou se a pergunta exigir um tipo de informação que você não pode fornecer), responda de forma curta e segura com o template: \"Não encontrei informação confiável na ProGenia para responder isso agora.\" seguido de \"Se quiser, me diga seu objetivo e eu sugiro o conteúdo mais próximo.\". Não adicione explicações extensas. " +
  "(8) Não repita o enunciado. Não crie seções como 'Introdução'/'Conclusão'.";

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
      parts.push(`- **${m.title}** → URL: /module/${m.id}${m.description ? ` | ${m.description}` : ""}`);
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, title, description")
        .eq("module_id", m.id)
        .eq("is_published", true)
        .order("order_index", { ascending: true });
      if (lessons?.length) {
        for (const l of lessons) {
          parts.push(`  - Aula: **${l.title}** → URL: /lesson/${l.id}${l.description ? ` | ${l.description}` : ""}`);
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
          parts.push(`  - Cápsula: **${c.title}** → URL: /capsula/${c.id}${c.description ? ` | ${c.description}` : ""}`);
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
      parts.push(`- **${c.title}** → URL: /capsula/${c.id}${c.description ? ` | ${c.description}` : ""}`);
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
      parts.push(`- **${lab.title}** → URL: /labs/${lab.slug}${lab.description ? ` | ${lab.description}` : ""}`);
    }
  }

  if (parts.length === 0) return "";
  return "\n\n---\nCONTEÚDO DA PROGENIA (use para basear respostas e sugerir links):\n\n" + parts.join("\n");
}

async function fetchUserEnrollmentsContext(supabase: ReturnType<typeof createClient>, userId: string | null): Promise<string> {
  if (!userId) return "\n\nMATRÍCULAS DO USUÁRIO: Não identificado. Sugira módulos para matrícula quando relevante.\n";

  const { data: enrollments } = await supabase
    .from("module_enrollments")
    .select("module_id")
    .eq("user_id", userId);

  const moduleIds = (enrollments || []).map((e) => e.module_id).filter(Boolean);
  if (moduleIds.length === 0) {
    return "\n\nMATRÍCULAS DO USUÁRIO: O usuário NÃO está matriculado em nenhum módulo. Ao sugerir AULAS (que pertencem a módulos), sempre indique que ele deve se matricular no módulo primeiro: 'Para acessar esta aula, matricule-se no módulo: [Nome do módulo](/module/ID)'. Cápsulas e labs podem ser sugeridos normalmente.\n";
  }
  return `\n\nMATRÍCULAS DO USUÁRIO: O usuário está matriculado nos módulos com IDs: ${moduleIds.join(", ")}. Aulas desses módulos podem ser sugeridas diretamente. Aulas de módulos cujo ID NÃO está nesta lista: sugira matrícula no módulo primeiro com o link do módulo.\n`;
}

interface Catalog {
  capsulas: { id: string; title: string }[];
  lessons: { id: string; title: string }[];
  modules: { id: string; title: string }[];
  labs: { slug: string; title: string }[];
}

async function fetchCatalog(supabase: ReturnType<typeof createClient>): Promise<Catalog> {
  const catalog: Catalog = { capsulas: [], lessons: [], modules: [], labs: [] };

  const { data: modules } = await supabase.from("modules").select("id, title").eq("is_published", true);
  if (modules) catalog.modules = modules;

  const { data: lessons } = await supabase.from("lessons").select("id, title").eq("is_published", true);
  if (lessons) catalog.lessons = lessons;

  const { data: capsulas } = await supabase.from("capsulas").select("id, title").eq("is_published", true);
  if (capsulas) catalog.capsulas = capsulas;

  const { data: labs } = await supabase.from("virtual_labs").select("slug, title").eq("is_published", true);
  if (labs) catalog.labs = labs;

  return catalog;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeForMatch(s: string) {
  let t = s.replace(/^(Cápsula|Aula|Lab de|Lab):\s*/i, "").trim();
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function findBestMatch<T extends { title: string }>(title: string, items: T[]): T | null {
  const n = normalizeForMatch(title);
  for (const item of items) {
    if (normalizeForMatch(item.title).includes(n) || n.includes(normalizeForMatch(item.title))) return item;
  }
  return null;
}

function fixProGeniaLinks(text: string, catalog: Catalog): string {
  return text.replace(/\[([^\]]*)\](\s*\(\s*)(\/capsula\/[^)\s]+)(\s*\))/g, (_, label, p2, path, p4) => {
    const id = path.replace("/capsula/", "").trim();
    if (UUID_REGEX.test(id)) return `[${label}]${p2}${path}${p4}`;
    const match = findBestMatch(label, catalog.capsulas);
    return match ? `[${label}]${p2}/capsula/${match.id}${p4}` : `[${label}]${p2}${path}${p4}`;
  }).replace(/\[([^\]]*)\](\s*\(\s*)(\/lesson\/[^)\s]+)(\s*\))/g, (_, label, p2, path, p4) => {
    const id = path.replace("/lesson/", "").trim();
    if (UUID_REGEX.test(id)) return `[${label}]${p2}${path}${p4}`;
    const match = findBestMatch(label, catalog.lessons);
    return match ? `[${label}]${p2}/lesson/${match.id}${p4}` : `[${label}]${p2}${path}${p4}`;
  }).replace(/\[([^\]]*)\](\s*\(\s*)(\/module\/[^)\s]+)(\s*\))/g, (_, label, p2, path, p4) => {
    const id = path.replace("/module/", "").trim();
    if (UUID_REGEX.test(id)) return `[${label}]${p2}${path}${p4}`;
    const match = findBestMatch(label, catalog.modules);
    return match ? `[${label}]${p2}/module/${match.id}${p4}` : `[${label}]${p2}${path}${p4}`;
  }).replace(/\[([^\]]*)\](\s*\(\s*)(\/labs\/[^)\s]+)(\s*\))/g, (_, label, p2, path, p4) => {
    const slug = path.replace("/labs/", "").trim();
    const exists = catalog.labs.some((l) => l.slug === slug);
    if (exists) return `[${label}]${p2}${path}${p4}`;
    const match = findBestMatch(label, catalog.labs);
    return match ? `[${label}]${p2}/labs/${match.slug}${p4}` : `[${label}]${p2}${path}${p4}`;
  });
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
    const { message, conversationHistory, userId } = await req.json();
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const contentContext = await fetchProGeniaContent(supabase);
    const enrollmentsContext = await fetchUserEnrollmentsContext(supabase, userId ?? null);
    const systemPrompt = BASE_PROMPT + contentContext + enrollmentsContext;

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
        // Respostas mais curtas especialmente quando o modelo precisar recusar/limitar.
        max_tokens: 320,
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
    let text = data?.choices?.[0]?.message?.content;

    if (!text) {
      console.error("Unexpected Groq response:", data);
      throw new Error("Invalid response from AI service");
    }

    const catalog = await fetchCatalog(supabase);
    text = fixProGeniaLinks(text, catalog);

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
