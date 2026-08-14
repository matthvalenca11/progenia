import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
import { getCorsHeaders } from "../_shared/privacy.ts";
import { composeGuideReply, composeNudge, fetchLearnerJourney, prioritizeSuggestions } from "./journey.ts";

const BASE_PROMPT =
  "Você é o guia de aprendizagem da ProGenia, não um FAQ passivo. Ajude o aluno a caminhar na trilha: o que já fez, o que falta e o que experimentar agora. " +
  "REGRAS: (1) Seja direto, humano e curto (2–4 frases). (2) Use a seção TRILHA DO ALUNO como verdade. Nunca invente progresso, notas ou conteúdos. " +
  "(3) Em cumprimentos, 'o que fazer agora', progresso ou quando o aluno parecer perdido, comece pelo próximo passo concreto. Não pergunte 'como posso ajudar?' se você já sabe o próximo passo. " +
  "(4) NÃO coloque links markdown no meio das frases e NÃO recorte a frase com URLs. Fale naturalmente. Os botões de sugestão são gerados à parte com os 'Próximos passos calculados'. " +
  "(5) MATRÍCULA: se a aula for de um módulo em que o aluno não está matriculado, sugira o módulo no texto, não a aula. Cápsulas e labs podem ser sugeridos direto. " +
  "(6) Prefira os 'Próximos passos calculados' da trilha. Cite o tema em uma frase, sem o título longo no meio do texto. " +
  "(7) Se a pergunta for de conteúdo clínico/técnico, responda e feche com o próximo passo na plataforma, sem link no meio da frase. " +
  "(8) Se não houver base na ProGenia, diga isso em uma frase e ofereça o conteúdo mais próximo da trilha. " +
  "(9) Evidência externa é só apoio educacional, nunca prescrição. Preserve links PubMed quando existirem. " +
  "(10) Não invente seções longas. Não recite o catálogo inteiro.";

const OPENEVIDENCE_BASE_URL = "https://api.openevidence.com/v1";
const NCBI_EUTILS_BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

const BIOMEDICAL_EVIDENCE_KEYWORDS = [
  "contraindicação",
  "contraindicacao",
  "evidência",
  "evidence",
  "guideline",
  "protocolo",
  "dose",
  "dosagem",
  "tratamento",
  "terapia",
  "diagnóstico",
  "diagnostico",
  "risco",
  "safety",
  "segurança",
  "seguranca",
  "dor",
  "inflamação",
  "inflamacao",
  "reabilitação",
  "reabilitacao",
  "ultrassom",
  "ultrasound",
  "tens",
  "eletroterapia",
  "electrotherapy",
  "fotobiomodulação",
  "fotobiomodulacao",
  "photobiomodulation",
  "laser",
  "mri",
  "ressonância",
  "ressonancia",
];

type SupabaseEdgeClient = ReturnType<typeof createClient<any>>;

async function fetchProGeniaContent(supabase: SupabaseEdgeClient): Promise<string> {
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

function looksLikeGuideIntent(message: string, intent?: string) {
  if (intent && ["open", "next", "progress", "explore"].includes(intent)) return true;
  const text = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /(^|\b)(ola|oi|hey|hello|hi)\b/.test(text) ||
    text.includes("proximo passo") ||
    text.includes("o que eu") ||
    text.includes("o que fazer") ||
    text.includes("meu progresso") ||
    text.includes("por onde") ||
    text.includes("me indica") ||
    text.includes("what should i") ||
    text.includes("next step") ||
    text.includes("my progress");
}

interface Catalog {
  capsulas: { id: string; title: string }[];
  lessons: { id: string; title: string }[];
  modules: { id: string; title: string }[];
  labs: { slug: string; title: string }[];
}

async function fetchCatalog(supabase: SupabaseEdgeClient): Promise<Catalog> {
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

function shouldQueryExternalEvidence(message: string): boolean {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return BIOMEDICAL_EVIDENCE_KEYWORDS.some((keyword) => {
    const k = keyword
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return normalized.includes(k);
  });
}

function stringifyOpenEvidenceValue(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyOpenEvidenceValue(item))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const preferred = obj.answer ?? obj.response ?? obj.summary ?? obj.text ?? obj.content;
    if (preferred) return stringifyOpenEvidenceValue(preferred);

    const title = stringifyOpenEvidenceValue(obj.title);
    const snippet = stringifyOpenEvidenceValue(obj.snippet ?? obj.abstract ?? obj.description);
    return [title, snippet].filter(Boolean).join(": ");
  }
  return String(value).trim();
}

function extractOpenEvidenceAnswer(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const obj = data as Record<string, unknown>;

  const direct = stringifyOpenEvidenceValue(
    obj.answer ?? obj.response ?? obj.summary ?? obj.text ?? obj.content ?? obj.result
  );
  if (direct) return direct;

  return stringifyOpenEvidenceValue(obj.results ?? obj.evidence ?? obj.items);
}

function extractOpenEvidenceCitations(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const obj = data as Record<string, unknown>;
  const citations = obj.citations ?? obj.references ?? obj.sources;
  if (!Array.isArray(citations)) return "";

  return citations
    .slice(0, 5)
    .map((citation, index) => {
      if (typeof citation === "string") return `${index + 1}. ${citation}`;
      if (!citation || typeof citation !== "object") return "";

      const c = citation as Record<string, unknown>;
      const title = stringifyOpenEvidenceValue(c.title ?? c.name);
      const journal = stringifyOpenEvidenceValue(c.journal ?? c.source);
      const year = stringifyOpenEvidenceValue(c.year ?? c.publication_year);
      const url = stringifyOpenEvidenceValue(c.url ?? c.link ?? c.doi);
      const meta = [journal, year].filter(Boolean).join(", ");

      const linkedTitle = url ? `[${title || "Fonte"}](${url})` : title;
      return [linkedTitle, meta ? `(${meta})` : ""].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join("\n");
}

async function fetchOpenEvidenceContext(message: string): Promise<string> {
  const apiKey = Deno.env.get("OPENEVIDENCE_API_KEY");
  if (!apiKey || !shouldQueryExternalEvidence(message)) return "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const baseUrl = (Deno.env.get("OPENEVIDENCE_BASE_URL") || OPENEVIDENCE_BASE_URL).replace(/\/$/, "");
    const specialty = Deno.env.get("OPENEVIDENCE_SPECIALTY");
    const body: Record<string, unknown> = {
      question: message,
      max_results: 5,
    };

    if (specialty) body.specialty = specialty;

    const response = await fetch(`${baseUrl}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("OpenEvidence API warning:", response.status);
      return "";
    }

    const data = await response.json();
    const answer = extractOpenEvidenceAnswer(data).slice(0, 3000);
    const citations = extractOpenEvidenceCitations(data).slice(0, 1200);

    if (!answer && !citations) return "";

    return [
      "\n\n---\nEVIDÊNCIA CLÍNICA EXTERNA (OpenEvidence; uso educacional, não prescritivo):",
      answer ? `\nResumo:\n${answer}` : "",
      citations ? `\nFontes/citações retornadas:\n${citations}` : "",
    ].filter(Boolean).join("\n");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn("OpenEvidence unavailable:", msg);
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

interface PubMedArticle {
  pmid: string;
  title: string;
  journal: string;
  pubdate: string;
  authors: string;
  url: string;
}

function buildPubMedQuery(message: string): string {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const mappedTerms: string[] = [];

  if (normalized.includes("fotobiomodul") || normalized.includes("laser")) {
    mappedTerms.push("(photobiomodulation OR low-level laser therapy OR low level light therapy)");
  }
  if (normalized.includes("ultrassom") || normalized.includes("ultrasound")) {
    mappedTerms.push("(ultrasound therapy OR therapeutic ultrasound OR diagnostic ultrasound)");
  }
  if (normalized.includes("tens") || normalized.includes("eletroterapia") || normalized.includes("electrotherapy")) {
    mappedTerms.push("(transcutaneous electrical nerve stimulation OR TENS OR electrotherapy)");
  }
  if (normalized.includes("ressonancia") || normalized.includes("mri") || normalized.includes("magnetic resonance")) {
    mappedTerms.push("(magnetic resonance imaging OR MRI)");
  }
  if (normalized.includes("dor")) mappedTerms.push("(pain)");
  if (normalized.includes("inflamacao")) mappedTerms.push("(inflammation)");
  if (normalized.includes("reabilitacao")) mappedTerms.push("(rehabilitation)");
  if (normalized.includes("contraindic")) mappedTerms.push("(contraindications OR safety)");
  if (normalized.includes("dose") || normalized.includes("dosagem")) mappedTerms.push("(dose OR dosage)");

  if (mappedTerms.length === 0) return message;

  return `${mappedTerms.join(" AND ")} AND (review[Publication Type] OR systematic review[Title/Abstract] OR guideline[Title/Abstract] OR clinical trial[Publication Type])`;
}

function getNcbiParams(): URLSearchParams {
  const params = new URLSearchParams({
    tool: Deno.env.get("NCBI_TOOL") || "ProGeniaAITutor",
  });
  const email = Deno.env.get("NCBI_EMAIL");
  if (email) params.set("email", email);

  const apiKey = Deno.env.get("NCBI_API_KEY");
  if (apiKey) params.set("api_key", apiKey);
  return params;
}

function formatPubMedAuthors(authors: unknown): string {
  if (!Array.isArray(authors)) return "";

  return authors
    .slice(0, 3)
    .map((author) => {
      if (!author || typeof author !== "object") return "";
      const name = (author as Record<string, unknown>).name;
      return typeof name === "string" ? name : "";
    })
    .filter(Boolean)
    .join(", ");
}

async function fetchPubMedContext(message: string): Promise<string> {
  if (!shouldQueryExternalEvidence(message)) return "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const baseUrl = (Deno.env.get("NCBI_EUTILS_BASE_URL") || NCBI_EUTILS_BASE_URL).replace(/\/$/, "");
    const retmax = Number(Deno.env.get("PUBMED_RETMAX") || 5);
    const query = buildPubMedQuery(message);
    const commonParams = getNcbiParams();

    const searchParams = new URLSearchParams(commonParams);
    searchParams.set("db", "pubmed");
    searchParams.set("retmode", "json");
    searchParams.set("retmax", String(Math.min(Math.max(retmax, 1), 8)));
    searchParams.set("sort", "relevance");
    searchParams.set("term", query);

    const searchResponse = await fetch(`${baseUrl}/esearch.fcgi?${searchParams.toString()}`, {
      signal: controller.signal,
    });

    if (!searchResponse.ok) {
      console.warn("PubMed ESearch warning:", searchResponse.status);
      return "";
    }

    const searchData = await searchResponse.json();
    const ids = searchData?.esearchresult?.idlist;
    if (!Array.isArray(ids) || ids.length === 0) return "";

    const summaryParams = new URLSearchParams(commonParams);
    summaryParams.set("db", "pubmed");
    summaryParams.set("retmode", "json");
    summaryParams.set("id", ids.join(","));

    const summaryResponse = await fetch(`${baseUrl}/esummary.fcgi?${summaryParams.toString()}`, {
      signal: controller.signal,
    });

    if (!summaryResponse.ok) {
      console.warn("PubMed ESummary warning:", summaryResponse.status);
      return "";
    }

    const summaryData = await summaryResponse.json();
    const result = summaryData?.result;
    if (!result || typeof result !== "object") return "";

    const articles: PubMedArticle[] = ids
      .map((id: string) => {
        const item = result[id];
        if (!item || typeof item !== "object") return null;
        const article = item as Record<string, unknown>;
        const title = typeof article.title === "string" ? article.title : "";
        if (!title) return null;

        const journal = typeof article.fulljournalname === "string"
          ? article.fulljournalname
          : typeof article.source === "string"
            ? article.source
            : "";
        const pubdate = typeof article.pubdate === "string" ? article.pubdate : "";
        const authors = formatPubMedAuthors(article.authors);

        return {
          pmid: id,
          title,
          journal,
          pubdate,
          authors,
          url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        };
      })
      .filter((article): article is PubMedArticle => Boolean(article));

    if (articles.length === 0) return "";

    const lines = articles.map((article, index) => {
      const meta = [article.authors, article.journal, article.pubdate].filter(Boolean).join(". ");
      return `${index + 1}. [${article.title}](${article.url})${meta ? ` — ${meta}` : ""}. PMID: ${article.pmid}.`;
    });

    return [
      "\n\n---\nEVIDÊNCIA CLÍNICA EXTERNA (PubMed/NCBI; uso educacional, não prescritivo):",
      `Consulta PubMed usada: ${query}`,
      "Artigos relevantes retornados:",
      lines.join("\n"),
    ].join("\n");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn("PubMed unavailable:", msg);
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchEvidenceContext(message: string): Promise<{ context: string; source: string }> {
  const openEvidenceContext = await fetchOpenEvidenceContext(message);
  if (openEvidenceContext) {
    return { context: openEvidenceContext, source: "openevidence" };
  }

  const pubMedContext = await fetchPubMedContext(message);
  if (pubMedContext) {
    return { context: pubMedContext, source: "pubmed" };
  }

  return { context: "", source: "progenia" };
}

function extractEvidenceReferences(context: string): string {
  if (!context) return "";

  return context
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+\[[^\]]+\]\(https?:\/\/[^)]+\)/.test(line))
    .slice(0, 3)
    .join("\n");
}

function ensureEvidenceReferences(text: string, evidenceContext: { context: string; source: string }): string {
  if (evidenceContext.source === "progenia") return text;
  if (/https?:\/\/(pubmed\.ncbi\.nlm\.nih\.gov|doi\.org|www\.ncbi\.nlm\.nih\.gov)/i.test(text)) return text;

  const references = extractEvidenceReferences(evidenceContext.context);
  if (!references) return text;

  return `${text.trim()}\n\nReferências:\n${references}`;
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

const GROQ_MODELS = [
  Deno.env.get("GROQ_MODEL"),
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "llama-3.1-70b-versatile",
].filter((model): model is string => Boolean(model));

async function completeWithGroq(
  apiKey: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
) {
  let lastStatus = 0;
  for (const model of GROQ_MODELS) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 420,
      }),
    });
    lastStatus = response.status;
    if (response.ok) {
      return { ok: true as const, data: await response.json() };
    }
    await response.text();
    console.error("Groq API error:", response.status, model);
    if (response.status === 401 || response.status === 403 || response.status === 429) {
      break;
    }
  }
  return { ok: false as const, status: lastStatus };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory, userId, intent, language } = await req.json();
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const lang = language === "en" ? "en" : "pt";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const journey = await fetchLearnerJourney(supabase, userId ?? null);
    journey.suggestions = prioritizeSuggestions(journey.suggestions, intent);
    const guideIntent = looksLikeGuideIntent(message || "", intent);

    if (intent === "nudge") {
      const nudge = composeNudge(journey, lang);
      return new Response(
        JSON.stringify({
          response: nudge?.prompt || "",
          suggestions: journey.suggestions.slice(0, 4),
          nudge,
          evidenceSource: "progenia",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!GROQ_API_KEY) {
      const fallback = composeGuideReply(journey, lang, intent);
      return new Response(
        JSON.stringify({
          response: fallback,
          suggestions: journey.suggestions,
          evidenceSource: "progenia",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contentContext = await fetchProGeniaContent(supabase);
    const evidenceContext = guideIntent
      ? { context: "", source: "progenia" }
      : await fetchEvidenceContext(message);
    const languageHint = lang === "en" ? "Answer in English." : "Responda em português do Brasil.";
    const intentHint =
      intent === "progress"
        ? "FOCO DESTA MENSAGEM: resuma o que o aluno já fez e o que falta, depois 1 próximo passo concreto."
        : intent === "explore"
          ? "FOCO DESTA MENSAGEM: sugira algo novo para experimentar, preferindo um laboratório virtual ainda não usado."
          : intent === "next" || intent === "open"
            ? "FOCO DESTA MENSAGEM: dê o próximo passo concreto agora. Não pergunte 'como posso ajudar?'."
            : "";
    const systemPrompt = `${BASE_PROMPT} ${languageHint} ${intentHint}`.trim() +
      journey.context + contentContext + evidenceContext.context;

    const history = conversationHistory || [];
    const messages = toGroqMessages(systemPrompt, history, message);

    const groq = await completeWithGroq(GROQ_API_KEY, messages);
    if (!groq.ok) {
      const fallback = composeGuideReply(journey, lang, intent);
      return new Response(
        JSON.stringify({
          response: fallback,
          suggestions: journey.suggestions,
          evidenceSource: "progenia",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = groq.data;
    let text = data?.choices?.[0]?.message?.content;

    if (!text) {
      text = composeGuideReply(journey, lang, intent);
    }

    const catalog = await fetchCatalog(supabase);
    text = fixProGeniaLinks(text, catalog);
    text = ensureEvidenceReferences(text, evidenceContext);

    return new Response(
      JSON.stringify({
        response: text,
        suggestions: journey.suggestions,
        evidenceSource: evidenceContext.source,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
