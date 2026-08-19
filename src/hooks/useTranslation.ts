import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getForcedPtEnOverride } from "@/lib/ptEnOverrides";
import {
  subscribeTranslationCache,
  translateSync,
  translateTexts,
} from "@/lib/translationClient";

/** Synchronous UI label — glossary overrides only. */
export function useT() {
  const { language } = useLanguage();
  const isEnglish = language === "en";

  return useCallback(
    (pt: string) => {
      if (!isEnglish) return pt;
      return getForcedPtEnOverride(pt) ?? pt;
    },
    [isEnglish],
  );
}

/** CMS / dynamic copy — glossary first, then cached or API translation. */
export function useTranslatedText(source: string | null | undefined): string {
  const { language } = useLanguage();
  const trimmed = source?.trim() ?? "";

  const [text, setText] = useState(() => translateSync(trimmed, language));

  useEffect(() => {
    if (!trimmed) {
      setText("");
      return;
    }

    if (language !== "en") {
      setText(trimmed);
      return;
    }

    const sync = translateSync(trimmed, "en");
    setText(sync);

    if (sync !== trimmed) return;

    let cancelled = false;
    void translateTexts([trimmed]).then((map) => {
      if (!cancelled) setText(map[trimmed] ?? trimmed);
    });

    return () => {
      cancelled = true;
    };
  }, [trimmed, language]);

  useEffect(() => {
    if (language !== "en" || !trimmed) return;
    return subscribeTranslationCache(() => {
      setText(translateSync(trimmed, language));
    });
  }, [trimmed, language]);

  return text;
}

/** Batch translate many strings (e.g. card lists). */
export function useTranslatedTexts(sources: string[]): Record<string, string> {
  const { language } = useLanguage();
  const stableKey = useMemo(
    () =>
      Array.from(new Set(sources.map((s) => s?.trim() ?? "").filter(Boolean)))
        .sort()
        .join("\u0001"),
    [sources],
  );

  const [map, setMap] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const key of stableKey.split("\u0001").filter(Boolean)) {
      initial[key] = translateSync(key, language);
    }
    return initial;
  });

  useEffect(() => {
    const keys = stableKey.split("\u0001").filter(Boolean);
    if (!keys.length) {
      setMap({});
      return;
    }

    if (language !== "en") {
      setMap(Object.fromEntries(keys.map((k) => [k, k])));
      return;
    }

    const initial: Record<string, string> = {};
    const missing: string[] = [];
    for (const key of keys) {
      const sync = translateSync(key, "en");
      initial[key] = sync;
      if (sync === key) missing.push(key);
    }
    setMap(initial);

    if (!missing.length) return;

    let cancelled = false;
    void translateTexts(missing).then((result) => {
      if (!cancelled) setMap((prev) => ({ ...prev, ...result }));
    });

    return () => {
      cancelled = true;
    };
  }, [stableKey, language]);

  useEffect(() => {
    if (language !== "en") return;
    return subscribeTranslationCache(() => {
      const keys = stableKey.split("\u0001").filter(Boolean);
      if (!keys.length) return;
      setMap(Object.fromEntries(keys.map((k) => [k, translateSync(k, "en")])));
    });
  }, [stableKey, language]);

  return map;
}
