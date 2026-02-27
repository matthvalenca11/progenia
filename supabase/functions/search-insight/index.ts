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
  topTitles: string[],
) => {
  const normalized = query.toLowerCase();
  const isUltrasound = /(ultrass|ultras|usg|ultrasound|sonograf)/.test(normalized);
  const isMri = /(\bmri\b|\brm\b|resson)/.test(normalized);
  const isElectro = /(eletro|electro|tens|corrente)/.test(normalized);
  const isResolution = /(resolu|resolution|frequen|frequency|ganho|gain|profund|depth)/.test(normalized);
  const isRisk = /(queim|burn|risco|safety|seguran|dano|lesao)/.test(normalized);
  const topA = topTitles[0];
  const topB = topTitles[1];

  if (language === "en") {
    if (counts.total === 0) {
      return `No direct match for "${query}". Try a technical term (frequency, gain, depth, safety) to retrieve focused results.`;
    }
    if (isUltrasound && isRisk) {
      return `For "${query}", prioritize thermal/mechanical safety and exposure control in ultrasound. Start with "${topA || "the top result"}".`;
    }
    if (isUltrasound && isResolution) {
      return `For "${query}", focus on the frequency–depth–resolution trade-off and its impact on interpretation. Start with "${topA || "the top result"}".`;
    }
    if (isMri) {
      return `For "${query}", focus on sequence parameters, contrast behavior, and SNR impact. Start with "${topA || "the top result"}".`;
    }
    if (isElectro) {
      return `For "${query}", review waveform, pulse-width, and stimulation safety limits. Start with "${topA || "the top result"}".`;
    }
    if (topA && topB) {
      return `For "${query}", compare technical criteria across "${topA}" and "${topB}" to refine parameter decisions.`;
    }
    if (topA) {
      return `For "${query}", use "${topA}" as a baseline and validate the parameter choices with the results below.`;
    }
    return `For "${query}", use the results below to compare technical criteria and practical application.`;
  }

  if (counts.total === 0) {
    return `Sem correspondência direta para "${query}". Tente um termo técnico (frequência, ganho, profundidade, segurança) para resultados mais precisos.`;
  }
  if (isUltrasound && isRisk) {
    return `Em "${query}", priorize segurança térmica/mecânica e controle de exposição no ultrassom. Comece por "${topA || "o resultado principal"}".`;
  }
  if (isUltrasound && isResolution) {
    return `Em "${query}", foque no trade-off frequência–profundidade–resolução e no impacto diagnóstico. Comece por "${topA || "o resultado principal"}".`;
  }
  if (isMri) {
    return `Em "${query}", foque em parâmetros de sequência, contraste e SNR. Comece por "${topA || "o resultado principal"}".`;
  }
  if (isElectro) {
    return `Em "${query}", revise forma de onda, largura de pulso e limites de segurança da estimulação. Comece por "${topA || "o resultado principal"}".`;
  }
  if (topA && topB) {
    return `Para "${query}", compare critérios técnicos entre "${topA}" e "${topB}" para orientar melhor a escolha de parâmetros.`;
  }
  if (topA) {
    return `Para "${query}", use "${topA}" como referência inicial e valide os parâmetros com os resultados abaixo.`;
  }
  return `Para "${query}", use os resultados abaixo para comparar critérios técnicos e aplicação prática.`;
};

const looksGeneric = (text: string) => {
  const normalized = text.toLowerCase();
  const genericSignals = [
    "variedade de conteúdos",
    "entender melhor o assunto",
    "nossa plataforma oferece",
    "explorar os resultados abaixo",
    "contexto de saúde",
  ];
  return genericSignals.some((signal) => normalized.includes(signal));
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
      const topTitles = (body.topTitles || []).slice(0, 6).filter(Boolean);
      return new Response(
        JSON.stringify({ insight: fallbackInsight(query, language, counts, topTitles), source: "fallback" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const topTitles = (body.topTitles || []).slice(0, 6).filter(Boolean);

    const systemPrompt = language === "en"
      ? "You are a medical-edtech assistant. Write exactly 1 short technical paragraph (max 2 sentences, max ~220 characters preferred). Be specific to the query, avoid generic platform wording, and vary phrasing across requests. Mention at least one provided title naturally. Do not fabricate facts."
      : "Você é um assistente de edtech em saúde. Escreva exatamente 1 parágrafo técnico curto (máx. 2 frases, ideal até ~220 caracteres). Seja específico para a busca, evite linguagem genérica de plataforma e varie a redação entre consultas. Mencione ao menos um título fornecido de forma natural. Não invente fatos.";

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
        temperature: 0.7,
        max_tokens: 120,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ insight: fallbackInsight(query, language, counts, topTitles), source: "fallback" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const insight = String(data?.choices?.[0]?.message?.content || "").trim();

    return new Response(
      JSON.stringify({
        insight: !insight || looksGeneric(insight)
          ? fallbackInsight(query, language, counts, topTitles)
          : insight,
        source: insight && !looksGeneric(insight) ? "groq" : "fallback",
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
