import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Language = "pt" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
}

const STORAGE_KEY = "progenia_language";
const TRANSLATION_CACHE_KEY = "progenia_translation_cache_en";

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "CODE",
  "PRE",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "OPTION",
]);
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "aria-label", "title", "alt", "value"];
const FORCED_PT_EN_OVERRIDES: Record<string, string> = {
  entrar: "Sign In",
  "começar": "Sign Up",
  comecar: "Sign Up",
  sobre: "About",
};

const looksTranslatable = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length < 2) return false;
  if (/^[\d\s()[\]{}.,:;!@#$%^&*_\-+=/\\|'"`~<>?]+$/.test(trimmed)) return false;
  return /[A-Za-zÀ-ÿ]/.test(trimmed);
};
const normalizeText = (text: string) =>
  text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
const normalizeLookupKey = (text: string) => normalizeText(text).toLowerCase();
const preserveEdgeWhitespace = (original: string, translated: string) => {
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated.trim()}${trailing}`;
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "en" ? "en" : "pt";
  });

  const cacheRef = useRef<Map<string, string>>(new Map());
  const originalTextByNodeRef = useRef<Map<Text, string>>(new Map());
  const originalAttributesRef = useRef<WeakMap<Element, Map<string, string>>>(new WeakMap());
  const trackedAttributeElementsRef = useRef<Set<Element>>(new Set());
  const pendingTextsRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<number | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(TRANSLATION_CACHE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      cacheRef.current = new Map(Object.entries(parsed));
    } catch {
      cacheRef.current = new Map();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language === "en" ? "en" : "pt-BR";
  }, [language]);

  const flushCacheToStorage = () => {
    const obj = Object.fromEntries(cacheRef.current.entries());
    localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(obj));
  };

  const getCachedTranslation = (text: string) => {
    if (language === "en") {
      const forced = FORCED_PT_EN_OVERRIDES[normalizeLookupKey(text)];
      if (forced) {
        cacheRef.current.set(text, forced);
        const normalized = normalizeText(text);
        if (normalized && normalized !== text) {
          cacheRef.current.set(normalized, forced);
        }
        return forced;
      }
    }

    const direct = cacheRef.current.get(text);
    const normalized = normalizeText(text);
    if (direct) {
      // Evita cache antigo sem preservação de quebras de linha.
      if (text.includes("\n") && !direct.includes("\n")) {
        cacheRef.current.delete(text);
      } else
      // Evita reaproveitar cache antigo salvo com bug de normalização.
      if (!(direct === text && normalized !== text)) {
        return direct;
      }
    }
    const normalizedCached = cacheRef.current.get(normalized);
    if (normalizedCached && text.includes("\n") && !normalizedCached.includes("\n")) {
      cacheRef.current.delete(normalized);
      return undefined;
    }
    return normalizedCached;
  };

  const collectTextNodes = (root: Node): Text[] => {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current: Node | null = walker.nextNode();
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) {
        const textNode = current as Text;
        const parent = textNode.parentElement;
        if (!parent) {
          current = walker.nextNode();
          continue;
        }
        if (SKIP_TAGS.has(parent.tagName)) {
          current = walker.nextNode();
          continue;
        }
        if (parent.closest("[data-no-auto-translate='true']")) {
          current = walker.nextNode();
          continue;
        }
        if (parent.closest("input, textarea, select, option")) {
          current = walker.nextNode();
          continue;
        }
        if (looksTranslatable(textNode.data)) {
          nodes.push(textNode);
        }
      }
      current = walker.nextNode();
    }
    return nodes;
  };

  const collectAttributeTargets = (root: Node): Array<{ element: Element; attr: string; value: string }> => {
    const targets: Array<{ element: Element; attr: string; value: string }> = [];
    const elements: Element[] = [];

    if (root instanceof Element) {
      elements.push(root, ...Array.from(root.querySelectorAll("*")));
    } else if (root === document || root === document.body) {
      elements.push(...Array.from(document.body.querySelectorAll("*")));
    } else if (root.parentElement) {
      elements.push(root.parentElement, ...Array.from(root.parentElement.querySelectorAll("*")));
    }

    for (const element of elements) {
      if (SKIP_TAGS.has(element.tagName)) continue;
      if (element.closest("[data-no-auto-translate='true']")) continue;

      for (const attr of TRANSLATABLE_ATTRIBUTES) {
        if (!element.hasAttribute(attr)) continue;
        if (
          attr === "value" &&
          element instanceof HTMLInputElement &&
          !["button", "submit", "reset"].includes(element.type)
        ) {
          continue;
        }
        if (attr === "value" && (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
          continue;
        }
        const value = element.getAttribute(attr) || "";
        if (!looksTranslatable(value)) continue;
        targets.push({ element, attr, value });
      }
    }

    return targets;
  };

  const applyTranslationToNode = (node: Text, translated: string) => {
    if (!originalTextByNodeRef.current.has(node)) {
      originalTextByNodeRef.current.set(node, node.data);
    }
    node.data = translated;
  };

  const applyTranslationToAttribute = (element: Element, attr: string, translated: string) => {
    let attrMap = originalAttributesRef.current.get(element);
    if (!attrMap) {
      attrMap = new Map<string, string>();
      originalAttributesRef.current.set(element, attrMap);
    }
    if (!attrMap.has(attr)) {
      attrMap.set(attr, element.getAttribute(attr) || "");
    }
    trackedAttributeElementsRef.current.add(element);
    element.setAttribute(attr, translated);
  };

  const translateBatch = async (texts: string[]): Promise<Record<string, string>> => {
    const { data, error } = await supabase.functions.invoke("translate-text", {
      body: {
        source: "pt",
        target: "en",
        texts,
      },
    });

    if (error || !data?.translations) {
      return {};
    }

    return data.translations as Record<string, string>;
  };

  const processTranslations = async (
    nodes: Text[],
    attributes: Array<{ element: Element; attr: string; value: string }>,
  ) => {
    const toTranslate: string[] = [];

    for (const node of nodes) {
      const original = originalTextByNodeRef.current.get(node) ?? node.data;
      const cached = getCachedTranslation(original);
      if (cached) {
        applyTranslationToNode(node, preserveEdgeWhitespace(original, cached));
        continue;
      }
      if (!pendingTextsRef.current.has(original)) {
        pendingTextsRef.current.add(original);
        toTranslate.push(original);
      }
    }

    for (const target of attributes) {
      const attrMap = originalAttributesRef.current.get(target.element);
      const original = attrMap?.get(target.attr) ?? target.value;
      const cached = getCachedTranslation(original);
      if (cached) {
        applyTranslationToAttribute(target.element, target.attr, cached);
        continue;
      }
      if (!pendingTextsRef.current.has(original)) {
        pendingTextsRef.current.add(original);
        toTranslate.push(original);
      }
    }

    if (!toTranslate.length) return;

    const chunkSize = 50;
    for (let i = 0; i < toTranslate.length; i += chunkSize) {
      const chunk = toTranslate.slice(i, i + chunkSize);
      const translated = await translateBatch(chunk);
      for (const original of chunk) {
        pendingTextsRef.current.delete(original);
        const normalizedOriginal = normalizeText(original);
        const translatedText = translated[original] || translated[normalizedOriginal] || original;
        cacheRef.current.set(original, translatedText);
        if (normalizedOriginal && normalizedOriginal !== original) {
          cacheRef.current.set(normalizedOriginal, translatedText);
        }
      }
    }

    flushCacheToStorage();

    const refreshNodes = collectTextNodes(document.body);
    for (const node of refreshNodes) {
      const original = originalTextByNodeRef.current.get(node) ?? node.data;
      const cached = getCachedTranslation(original);
      if (cached) {
        applyTranslationToNode(node, preserveEdgeWhitespace(original, cached));
      }
    }

    const refreshAttributes = collectAttributeTargets(document.body);
    for (const target of refreshAttributes) {
      const attrMap = originalAttributesRef.current.get(target.element);
      const original = attrMap?.get(target.attr) ?? target.value;
      const cached = getCachedTranslation(original);
      if (cached) {
        applyTranslationToAttribute(target.element, target.attr, cached);
      }
    }
  };

  useEffect(() => {
    if (language !== "en") {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      for (const [node, original] of originalTextByNodeRef.current.entries()) {
        if (node.isConnected) {
          node.data = original;
        }
      }
      originalTextByNodeRef.current.clear();

      for (const element of trackedAttributeElementsRef.current) {
        const attrMap = originalAttributesRef.current.get(element);
        if (!attrMap || !element.isConnected) continue;
        for (const [attr, original] of attrMap.entries()) {
          element.setAttribute(attr, original);
        }
      }
      trackedAttributeElementsRef.current.clear();
      return;
    }

    const runTranslation = () => {
      const nodes = collectTextNodes(document.body);
      const attributes = collectAttributeTargets(document.body);
      void processTranslations(nodes, attributes);
    };

    runTranslation();

    observerRef.current = new MutationObserver(() => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        runTranslation();
      }, 250);
    });

    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [language]);

  const value = useMemo<LanguageContextType>(
    () => ({
      language,
      setLanguage: setLanguageState,
      toggleLanguage: () => setLanguageState((prev) => (prev === "pt" ? "en" : "pt")),
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};
