import { supabase } from "@/integrations/supabase/client";
import { getForcedPtEnOverride } from "@/lib/ptEnOverrides";
import { restoreProtectedAcronyms } from "@/lib/translationProtect";

export const TRANSLATION_CACHE_KEY = "progenia_translation_cache_en_v4";

export type Lang = "pt" | "en";

const normalizeText = (text: string) =>
  text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const stripDiacritics = (text: string) =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "");

const PT_SOURCE_HINT =
  /\b(entrar|sair|voltar|aulas|aula|capsulas|capsula|modulos|modulo|comecar|sobre|perfil|salvar|enviar|buscar|filtrar|concluir|progresso|trilha|laboratorio|laboratorios|inicio|conteudo|continuar|abrir|fechar|proximo|anterior|carregando|cadastrar|obrigado|voce|nao|minha|meu|nossos|bem-vindo|painel|conta|senha|glossario|explorar|experimentar|matricula|matricular|concluido|concluida|disponivel|necessaria|realizada|aprendidos|minutos|parametros|fundamentos|simulacao|protocolos|indicacoes|mecanismos|conquistas|relatar|excluir|desmatricular|refazer|iniciar|visualizar|nenhum|nenhuma|em alta|resumo)\b/i;

export function looksLikePortugueseSource(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(trimmed)) return true;
  if (getForcedPtEnOverride(trimmed)) return true;
  return PT_SOURCE_HINT.test(stripDiacritics(trimmed));
}

function loadCache(): Map<string, string> {
  try {
    const raw = localStorage.getItem(TRANSLATION_CACHE_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw) as Record<string, string>));
  } catch {
    return new Map();
  }
}

let memoryCache = loadCache();
const inflightBatches = new Map<string, Promise<Record<string, string>>>();
const cacheListeners = new Set<() => void>();

function flushCache() {
  try {
    localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(Object.fromEntries(memoryCache.entries())));
  } catch {
    // ignore quota errors
  }
  for (const listener of cacheListeners) listener();
}

export function subscribeTranslationCache(listener: () => void): () => void {
  cacheListeners.add(listener);
  return () => cacheListeners.delete(listener);
}

export function translateSync(text: string | null | undefined, language: Lang): string {
  if (!text) return "";
  if (language !== "en") return text;

  const forced = getForcedPtEnOverride(text);
  if (forced) return forced;

  const direct = memoryCache.get(text);
  if (direct) return restoreProtectedAcronyms(text, direct);

  const normalized = normalizeText(text);
  const normalizedCached = memoryCache.get(normalized);
  if (normalizedCached) return restoreProtectedAcronyms(text, normalizedCached);

  return text;
}

function storeTranslation(original: string, translated: string) {
  const repaired = restoreProtectedAcronyms(original, translated);
  memoryCache.set(original, repaired);
  const normalized = normalizeText(original);
  if (normalized && normalized !== original) {
    memoryCache.set(normalized, repaired);
  }
}

async function fetchTranslationsFromEdge(texts: string[]): Promise<Record<string, string>> {
  const { data, error } = await supabase.functions.invoke("translate-text", {
    body: { source: "pt", target: "en", texts },
  });

  if (error || !data?.translations) {
    throw error ?? new Error("translate-text returned no translations");
  }

  return data.translations as Record<string, string>;
}

async function translateTextDirectly(text: string): Promise<string> {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "pt");
  url.searchParams.set("tl", "en");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const response = await fetch(url);
  if (!response.ok) return text;

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return text;

  const translated = payload[0]
    .map((segment) => (Array.isArray(segment) && typeof segment[0] === "string" ? segment[0] : ""))
    .join("");

  return translated || text;
}

async function fetchTranslations(texts: string[]): Promise<Record<string, string>> {
  try {
    return await fetchTranslationsFromEdge(texts);
  } catch (error) {
    // Keep dynamic CMS content bilingual even if the Supabase Edge Function is
    // unavailable or rejects the current app session.
    console.warn("[translationClient] Edge translation unavailable; using direct fallback.", error);
    const values = await Promise.all(texts.map((text) => translateTextDirectly(text)));
    return Object.fromEntries(texts.map((text, index) => [text, values[index]]));
  }
}

export async function translateTexts(texts: string[]): Promise<Record<string, string>> {
  const unique = Array.from(
    new Set(
      texts
        .map((t) => t?.trim() ?? "")
        .filter((t) => t.length > 0),
    ),
  );

  const result: Record<string, string> = {};
  const toFetch: string[] = [];

  for (const original of unique) {
    const forced = getForcedPtEnOverride(original);
    if (forced) {
      result[original] = forced;
      storeTranslation(original, forced);
      continue;
    }

    const cached = translateSync(original, "en");
    if (cached !== original || !looksLikePortugueseSource(original)) {
      result[original] = cached;
      continue;
    }

    toFetch.push(original);
  }

  if (!toFetch.length) {
    flushCache();
    return result;
  }

  const batchKey = toFetch.sort().join("\u0001");
  let batchPromise = inflightBatches.get(batchKey);
  if (!batchPromise) {
    batchPromise = fetchTranslations(toFetch).finally(() => {
      inflightBatches.delete(batchKey);
    });
    inflightBatches.set(batchKey, batchPromise);
  }

  try {
    const translated = await batchPromise;
    for (const original of toFetch) {
      const normalized = normalizeText(original);
      const value =
        translated[original] ??
        translated[normalized] ??
        original;
      storeTranslation(original, value);
      result[original] = translateSync(original, "en");
    }
    flushCache();
  } catch (error) {
    console.warn("[translationClient] batch failed:", error);
    for (const original of toFetch) {
      result[original] = original;
    }
  }

  return result;
}

export function clearTranslationCache() {
  memoryCache.clear();
  try {
    localStorage.removeItem(TRANSLATION_CACHE_KEY);
  } catch {
    // ignore
  }
  for (const listener of cacheListeners) listener();
}
