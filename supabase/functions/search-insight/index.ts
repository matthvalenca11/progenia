import { corsHeaders } from "../_shared/cors.ts";

type SearchInsightRequest = {
  query?: string;
  language?: "pt" | "en";
  counts?: {
    capsulas?: number;
    lessons?: number;
    modules?: number;
    total?: number;
  };
  topTitles?: string[];
};

const fallbackInsight = (
  query: string,
  language: "pt" | "en",
  counts: { capsulas: number; lessons: number; modules: number; total: number },
) => {
  if (language === "en") {
    if (counts.total === 0) {
      return `I searched for context related to "${query}", but no direct matches were found yet. Try broader terms and explore the sections below for nearby topics.`;
    }
    return `Your search for "${query}" points to practical concepts in this area. Explore the results below across capsules, lessons, and modules to deepen your understanding step by step.`;
  }

  if (counts.total === 0) {
    return `Busquei o contexto de "${query}", mas ainda não encontrei resultados diretos. Tente um termo mais amplo e explore as seções abaixo para conteúdos próximos.`;
  }
  return `Sua busca por "${query}" indica conceitos práticos importantes neste tema. Explore os resultados abaixo em cápsulas, aulas e módulos para aprofundar seu aprendizado.`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SearchInsightRequest;
    const query = (body.query || "").trim();
    const language = body.language === "en" ? "en" : "pt";

    const counts = {
      capsulas: Number(body.counts?.capsulas || 0),
      lessons: Number(body.counts?.lessons || 0),
      modules: Number(body.counts?.modules || 0),
      total: Number(body.counts?.total || 0),
    };

    if (!query) {
      return new Response(JSON.stringify({ insight: "" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ insight: fallbackInsight(query, language, counts), source: "fallback" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const topTitles = (body.topTitles || []).slice(0, 6).filter(Boolean);

    const systemPrompt = language === "en"
      ? "You are a medical-edtech assistant. Write ONE short paragraph (max 2 sentences), contextual, precise, and friendly. Mention the user query naturally and suggest exploring the results below. Do not fabricate facts."
      : "Você é um assistente de edtech em saúde. Escreva UM parágrafo curto (máx. 2 frases), contextual, preciso e amigável. Mencione naturalmente a busca do usuário e sugira explorar os resultados abaixo. Não invente fatos.";

    const userPrompt = language === "en"
      ? `Query: "${query}".
Counts: capsules=${counts.capsulas}, lessons=${counts.lessons}, modules=${counts.modules}, total=${counts.total}.
Top titles: ${topTitles.join(" | ") || "none"}.
Write only the paragraph.`
      : `Busca: "${query}".
Contagens: capsulas=${counts.capsulas}, aulas=${counts.lessons}, modulos=${counts.modules}, total=${counts.total}.
Títulos mais relevantes: ${topTitles.join(" | ") || "nenhum"}.
Escreva apenas o parágrafo.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0.3,
        max_tokens: 140,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ insight: fallbackInsight(query, language, counts), source: "fallback" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const insight = String(data?.choices?.[0]?.message?.content || "").trim();

    return new Response(
      JSON.stringify({
        insight: insight || fallbackInsight(query, language, counts),
        source: insight ? "groq" : "fallback",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch {
    return new Response(
      JSON.stringify({ insight: "" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
