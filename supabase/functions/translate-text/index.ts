import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

type TranslateRequest = {
  source?: string;
  target?: string;
  texts?: string[];
};

const normalizeText = (value: string) =>
  value
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type GlossaryItem = {
  source_text: string;
  target_text: string;
};
const FORCED_PT_EN_OVERRIDES: Record<string, string> = {
  "entrar": "Sign In",
  "começar": "Sign Up",
  "comecar": "Sign Up",
  "sobre": "About",
};
const normalizeLookupKey = (value: string) => normalizeText(value).toLowerCase();
const PROVIDER_MAX_CHARS = 900;
const LINE_BREAK_TOKEN = "[[__BR__]]";
const shouldBypassCachedTranslation = (sourceText: string, translatedText: string) => {
  const sourceLen = sourceText.length;
  if (sourceLen < 120) return false;
  if (!translatedText) return true;

  // Cache legado sem preservação de parágrafos.
  if (sourceText.includes("\n") && !translatedText.includes("\n")) return true;

  // Protege contra cache legado truncado (caso dos termos longos).
  return translatedText.length < Math.floor(sourceLen * 0.6);
};

const splitTextIntoChunks = (text: string, maxChars = PROVIDER_MAX_CHARS) => {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  const paragraphs = text.split(/(\n+)/);
  let current = "";

  const pushCurrent = () => {
    if (current) {
      chunks.push(current);
      current = "";
    }
  };

  for (const part of paragraphs) {
    if (!part) continue;

    // Se o parágrafo já é pequeno, tenta agregar.
    if (part.length <= maxChars) {
      if ((current + part).length > maxChars) {
        pushCurrent();
      }
      current += part;
      continue;
    }

    // Parágrafo muito grande: quebra por sentenças e, se necessário, por tamanho fixo.
    const sentences = part.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      if (!sentence) continue;
      if (sentence.length <= maxChars) {
        if ((current + sentence).length > maxChars) {
          pushCurrent();
        }
        current += sentence;
      } else {
        pushCurrent();
        for (let i = 0; i < sentence.length; i += maxChars) {
          chunks.push(sentence.slice(i, i + maxChars));
        }
      }
    }
  }

  pushCurrent();
  return chunks.length ? chunks : [text];
};

const translateViaProvider = async (source: string, target: string, text: string) => {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", source);
  url.searchParams.set("tl", target);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const response = await fetch(url.toString());
  if (!response.ok) return text;

  const payload = (await response.json()) as unknown;
  const translated = Array.isArray(payload) && Array.isArray(payload[0])
    ? payload[0]
      .map((segment) => (Array.isArray(segment) && typeof segment[0] === "string" ? String(segment[0]) : ""))
      .join("")
    : text;

  return translated || text;
};

const protectLineBreaks = (text: string) => text.replace(/\n/g, ` ${LINE_BREAK_TOKEN} `);
const restoreLineBreaks = (text: string) =>
  text
    .replace(new RegExp(`\\s*${escapeRegex(LINE_BREAK_TOKEN)}\\s*`, "g"), "\n")
    .replace(/\n{3,}/g, "\n\n");

const applyGlossaryProtection = (text: string, glossary: GlossaryItem[]) => {
  let protectedText = text;
  const tokenMap: Record<string, string> = {};
  let tokenIndex = 0;

  for (const item of glossary) {
    const sourceTerm = normalizeText(item.source_text);
    if (!sourceTerm) continue;
    const regex = new RegExp(escapeRegex(sourceTerm), "gi");

    protectedText = protectedText.replace(regex, () => {
      const token = `[[TERM_${tokenIndex++}]]`;
      tokenMap[token] = item.target_text;
      return token;
    });
  }

  return { protectedText, tokenMap };
};

const restoreGlossaryTokens = (text: string, tokenMap: Record<string, string>) => {
  let result = text;
  for (const [token, targetValue] of Object.entries(tokenMap)) {
    const regex = new RegExp(escapeRegex(token), "g");
    result = result.replace(regex, targetValue);
  }
  return result;
};

const translateLongText = async (source: string, target: string, original: string, glossary: GlossaryItem[]) => {
  const chunks = splitTextIntoChunks(original);
  const translatedChunks: string[] = [];

  for (const chunk of chunks) {
    const chunkWithBreakTokens = protectLineBreaks(chunk);
    const { protectedText, tokenMap } = applyGlossaryProtection(chunkWithBreakTokens, glossary);
    const translatedRaw = await translateViaProvider(source, target, protectedText);
    const restoredGlossary = restoreGlossaryTokens(translatedRaw, tokenMap);
    translatedChunks.push(restoreLineBreaks(restoredGlossary));
  }

  return translatedChunks.join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { source = "pt", target = "en", texts = [] } = (await req.json()) as TranslateRequest;

    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ translations: {} }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uniqueTexts = Array.from(
      new Set(
        texts
          .filter((item): item is string => typeof item === "string")
          .map((item) => normalizeText(item))
          .filter((item) => item.length > 0),
      ),
    );

    if (uniqueTexts.length === 0) {
      return new Response(JSON.stringify({ translations: {} }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const translations: Record<string, string> = {};
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const supabaseAdmin = supabaseUrl && serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
      : null;

    const glossary: GlossaryItem[] = [];

    if (supabaseAdmin) {
      const { data: glossaryRows } = await supabaseAdmin
        .from("translation_glossary")
        .select("source_text, target_text, priority")
        .eq("source_lang", source)
        .eq("target_lang", target)
        .eq("is_active", true)
        .order("priority", { ascending: true });

      if (glossaryRows?.length) {
        glossary.push(
          ...glossaryRows
            .map((row) => ({ source_text: row.source_text as string, target_text: row.target_text as string }))
            .sort((a, b) => b.source_text.length - a.source_text.length),
        );
      }

      const { data: cachedRows } = await supabaseAdmin
        .from("translation_cache")
        .select("source_text, translated_text")
        .eq("source_lang", source)
        .eq("target_lang", target)
        .in("source_text", uniqueTexts);

      if (cachedRows?.length) {
        for (const row of cachedRows) {
          const sourceText = row.source_text as string;
          const translatedText = row.translated_text as string;
          if (shouldBypassCachedTranslation(sourceText, translatedText)) {
            continue;
          }
          translations[sourceText] = translatedText;
        }
      }
    }

    const missingTexts = uniqueTexts.filter((text) => !translations[text]);
    const cacheRowsToUpsert: Array<{
      source_lang: string;
      target_lang: string;
      source_text: string;
      translated_text: string;
      updated_at: string;
    }> = [];

    await Promise.all(
      missingTexts.map(async (original) => {
        try {
          const forced = source === "pt" && target === "en"
            ? FORCED_PT_EN_OVERRIDES[normalizeLookupKey(original)]
            : undefined;
          if (forced) {
            translations[original] = forced;
            cacheRowsToUpsert.push({
              source_lang: source,
              target_lang: target,
              source_text: original,
              translated_text: forced,
              updated_at: new Date().toISOString(),
            });
            return;
          }

          const translated = await translateLongText(source, target, original, glossary);
          const finalText = translated || original;
          translations[original] = finalText;

          cacheRowsToUpsert.push({
            source_lang: source,
            target_lang: target,
            source_text: original,
            translated_text: finalText,
            updated_at: new Date().toISOString(),
          });
        } catch {
          translations[original] = original;
        }
      }),
    );

    // Corrige traduções forçadas mesmo quando vieram do cache.
    if (source === "pt" && target === "en") {
      for (const original of uniqueTexts) {
        const forced = FORCED_PT_EN_OVERRIDES[normalizeLookupKey(original)];
        if (!forced) continue;
        if (translations[original] !== forced) {
          translations[original] = forced;
          cacheRowsToUpsert.push({
            source_lang: source,
            target_lang: target,
            source_text: original,
            translated_text: forced,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    if (supabaseAdmin && cacheRowsToUpsert.length > 0) {
      await supabaseAdmin
        .from("translation_cache")
        .upsert(cacheRowsToUpsert, { onConflict: "source_lang,target_lang,source_text" });
    }

    return new Response(JSON.stringify({ translations }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to translate text",
        details: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
