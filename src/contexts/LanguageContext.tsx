import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Preferences } from "@capacitor/preferences";
import { isNativeMobile } from "@/lib/capacitor";
import { readPersistedAppLanguage } from "@/lib/nativeLanguageOnboarding";
import {
  clearTranslationCache,
  looksLikePortugueseSource,
  subscribeTranslationCache,
  translateSync,
  translateTexts,
} from "@/lib/translationClient";

type Language = "pt" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => Promise<void>;
}

const STORAGE_KEY = "progenia_language";

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

const looksTranslatable = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length < 2) return false;
  if (/^[\d\s()[\]{}.,:;!@#$%^&*_\-+=/\\|'"`~<>?]+$/.test(trimmed)) return false;
  return /[A-Za-zÀ-ÿ]/.test(trimmed);
};

const preserveEdgeWhitespace = (original: string, translated: string) => {
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated.trim()}${trailing}`;
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const lang: Language = saved === "en" ? "en" : "pt";
    document.documentElement.lang = lang === "en" ? "en" : "pt-BR";
    return lang;
  });
  const [languageHydrated, setLanguageHydrated] = useState(!isNativeMobile);

  useEffect(() => {
    if (!isNativeMobile) return;
    let cancelled = false;
    void readPersistedAppLanguage().then((saved) => {
      if (cancelled) return;
      if (saved) setLanguageState(saved);
      setLanguageHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const languageRef = useRef(language);
  languageRef.current = language;
  const originalTextByNodeRef = useRef<Map<Text, string>>(new Map());
  const originalAttributesRef = useRef<WeakMap<Element, Map<string, string>>>(new WeakMap());
  const trackedAttributeElementsRef = useRef<Set<Element>>(new Set());
  const debounceTimerRef = useRef<number | null>(null);
  const rafTimerRef = useRef<number | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const applyingRef = useRef(false);

  useEffect(() => {
    if (!languageHydrated) return;
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language === "en" ? "en" : "pt-BR";
    if (isNativeMobile) {
      void Preferences.set({ key: STORAGE_KEY, value: language });
    }
  }, [language, languageHydrated]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next === "en" ? "en" : "pt-BR";
      if (isNativeMobile) {
        void Preferences.set({ key: STORAGE_KEY, value: next });
      }
    } catch {
      // ignore
    }
  }, []);

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
        if (parent.closest("[data-no-auto-translate='true'], [data-i18n='react']")) {
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
      if (element.closest("[data-no-auto-translate='true'], [data-i18n='react']")) continue;

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

  /**
   * Warm the translation cache while the Portuguese UI remains on screen.
   * React-owned content is intentionally included here, even though the DOM
   * fallback does not mutate it directly.
   */
  const collectPagePortugueseTexts = () => {
    if (typeof document === "undefined" || !document.body) return [] as string[];

    const texts: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let current: Node | null = walker.nextNode();

    while (current) {
      const node = current as Text;
      const parent = node.parentElement;
      if (
        parent &&
        !SKIP_TAGS.has(parent.tagName) &&
        !parent.closest("[data-no-auto-translate='true']") &&
        !parent.closest("input, textarea, select, option") &&
        looksTranslatable(node.data) &&
        looksLikePortugueseSource(node.data)
      ) {
        texts.push(node.data);
      }
      current = walker.nextNode();
    }

    for (const target of collectAttributeTargets(document.body)) {
      if (looksLikePortugueseSource(target.value)) {
        texts.push(target.value);
      }
    }

    return Array.from(new Set(texts));
  };

  const applyTranslationToNode = (node: Text, original: string, translated: string) => {
    if (!originalTextByNodeRef.current.has(node)) {
      originalTextByNodeRef.current.set(node, original);
    }
    node.data = preserveEdgeWhitespace(original, translated);
  };

  const applyTranslationToAttribute = (element: Element, attr: string, original: string, translated: string) => {
    let attrMap = originalAttributesRef.current.get(element);
    if (!attrMap) {
      attrMap = new Map<string, string>();
      originalAttributesRef.current.set(element, attrMap);
    }
    if (!attrMap.has(attr)) {
      attrMap.set(attr, original);
    }
    trackedAttributeElementsRef.current.add(element);
    element.setAttribute(attr, translated);
  };

  const paintDomTranslations = () => {
    if (languageRef.current !== "en" || typeof document === "undefined" || !document.body) {
      return [] as string[];
    }

    const toFetch: string[] = [];
    const queueFetch = (original: string) => {
      if (!looksLikePortugueseSource(original)) return;
      toFetch.push(original);
    };

    for (const node of collectTextNodes(document.body)) {
      const original = originalTextByNodeRef.current.get(node) ?? node.data;
      const translated = translateSync(original, "en");
      if (translated !== original) {
        applyTranslationToNode(node, original, translated);
        continue;
      }
      if (!originalTextByNodeRef.current.has(node)) {
        originalTextByNodeRef.current.set(node, original);
      }
      queueFetch(original);
    }

    for (const target of collectAttributeTargets(document.body)) {
      const attrMap = originalAttributesRef.current.get(target.element);
      const original = attrMap?.get(target.attr) ?? target.value;
      const translated = translateSync(original, "en");
      if (translated !== original) {
        applyTranslationToAttribute(target.element, target.attr, original, translated);
        continue;
      }
      if (!originalAttributesRef.current.get(target.element)?.has(target.attr)) {
        let map = originalAttributesRef.current.get(target.element);
        if (!map) {
          map = new Map<string, string>();
          originalAttributesRef.current.set(target.element, map);
        }
        map.set(target.attr, original);
      }
      queueFetch(original);
    }

    return Array.from(new Set(toFetch));
  };

  const refreshTranslatedDom = () => {
    applyingRef.current = true;
    try {
      for (const [node, original] of originalTextByNodeRef.current.entries()) {
        if (!node.isConnected) continue;
        const translated = translateSync(original, "en");
        if (translated !== original) {
          applyTranslationToNode(node, original, translated);
        }
      }
      for (const element of trackedAttributeElementsRef.current) {
        const attrMap = originalAttributesRef.current.get(element);
        if (!attrMap || !element.isConnected) continue;
        for (const [attr, original] of attrMap.entries()) {
          const translated = translateSync(original, "en");
          if (translated !== original) {
            applyTranslationToAttribute(element, attr, original, translated);
          }
        }
      }
      paintDomTranslations();
    } finally {
      applyingRef.current = false;
    }
  };

  const scheduleDomTranslation = (texts: string[]) => {
    if (!texts.length) return;
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void translateTexts(texts).then(() => refreshTranslatedDom());
    }, 120);
  };

  const runTranslationPass = () => {
    applyingRef.current = true;
    try {
      const queued = paintDomTranslations();
      scheduleDomTranslation(queued);
    } finally {
      applyingRef.current = false;
    }
  };

  useLayoutEffect(() => {
    if (language !== "en") {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (rafTimerRef.current != null) {
        window.cancelAnimationFrame(rafTimerRef.current);
        rafTimerRef.current = null;
      }

      applyingRef.current = true;
      for (const [node, original] of originalTextByNodeRef.current.entries()) {
        if (node.isConnected) node.data = original;
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
      applyingRef.current = false;
      return;
    }

    const handleGlossaryUpdated = () => {
      for (const [node, original] of originalTextByNodeRef.current.entries()) {
        if (node.isConnected) node.data = original;
      }
      for (const element of trackedAttributeElementsRef.current) {
        const attrMap = originalAttributesRef.current.get(element);
        if (!attrMap || !element.isConnected) continue;
        for (const [attr, original] of attrMap.entries()) {
          element.setAttribute(attr, original);
        }
      }
      clearTranslationCache();
      runTranslationPass();
    };

    runTranslationPass();

    const onCacheUpdate = () => refreshTranslatedDom();
    const unsubCache = subscribeTranslationCache(onCacheUpdate);

    observerRef.current = new MutationObserver(() => {
      if (applyingRef.current) return;
      if (rafTimerRef.current != null) return;
      rafTimerRef.current = window.requestAnimationFrame(() => {
        rafTimerRef.current = null;
        runTranslationPass();
      });
    });

    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    window.addEventListener("progenia_translation_glossary_updated", handleGlossaryUpdated);

    return () => {
      unsubCache();
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (rafTimerRef.current != null) {
        window.cancelAnimationFrame(rafTimerRef.current);
        rafTimerRef.current = null;
      }
      window.removeEventListener("progenia_translation_glossary_updated", handleGlossaryUpdated);
    };
  }, [language]);

  useEffect(() => {
    if (language !== "pt") return;

    let debounceTimer: number | null = null;
    const prefetchVisibleText = () => {
      const texts = collectPagePortugueseTexts();
      if (texts.length) void translateTexts(texts);
    };

    // Start immediately after the Portuguese page paints. This makes the
    // language switch nearly instant without delaying the current UI.
    const frame = window.requestAnimationFrame(prefetchVisibleText);

    // Dashboard cards, CMS copy, and lazy routes can be inserted after the
    // first paint. Warm only the new visible content as it arrives.
    const observer = new MutationObserver(() => {
      if (debounceTimer != null) return;
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        prefetchVisibleText();
      }, 50);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      if (debounceTimer != null) window.clearTimeout(debounceTimer);
    };
  }, [language]);

  const toggleLanguage = useCallback(async () => {
    const next: Language = language === "pt" ? "en" : "pt";

    // Preload every visible string before activating English. This keeps the
    // current Portuguese screen intact until a fully translated reload is ready,
    // rather than showing a Portuguese → English flicker.
    if (next === "en") {
      const texts = collectPagePortugueseTexts();
      if (texts.length) await translateTexts(texts);
    }

    setLanguage(next);
    window.location.reload();
  }, [language, setLanguage]);

  const value = useMemo<LanguageContextType>(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
    }),
    [language, setLanguage, toggleLanguage],
  );

  if (!languageHydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};
