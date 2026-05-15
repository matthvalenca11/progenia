import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ConsentCategories = {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
};

export type ConsentPreferences = {
  categories: ConsentCategories;
  policyVersion: string;
  mode: "banner" | "preferences" | "migration";
  consentedAt: string;
};

type ConsentContextValue = {
  ready: boolean;
  hasDecision: boolean;
  preferences: ConsentPreferences;
  isPreferencesOpen: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
  acceptAll: () => Promise<void>;
  rejectOptional: () => Promise<void>;
  savePreferences: (categories: ConsentCategories) => Promise<void>;
};

const CONSENT_STORAGE_KEY = "progenia_cookie_consent";
const CONSENT_ID_KEY = "progenia_cookie_consent_key";
const POLICY_VERSION = "v1";
const DEFAULT_CATEGORIES: ConsentCategories = {
  essential: true,
  analytics: true,
  marketing: false,
};

const ConsentContext = createContext<ConsentContextValue | undefined>(undefined);

const createConsentKey = () => {
  if (typeof window === "undefined") return `server-${Date.now()}`;
  const existing = localStorage.getItem(CONSENT_ID_KEY);
  if (existing) return existing;
  const key = crypto.randomUUID();
  localStorage.setItem(CONSENT_ID_KEY, key);
  return key;
};

const initialPreferences: ConsentPreferences = {
  categories: DEFAULT_CATEGORIES,
  policyVersion: POLICY_VERSION,
  mode: "migration",
  consentedAt: new Date().toISOString(),
};

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [hasDecision, setHasDecision] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>(initialPreferences);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ConsentPreferences;
        if (parsed?.categories?.essential) {
          setPreferences(parsed);
          setHasDecision(true);
        }
      }
      createConsentKey();
    } catch {
      // ignore malformed local consent
    } finally {
      setReady(true);
    }
  }, []);

  const syncToDatabase = useCallback(async (prefs: ConsentPreferences) => {
    try {
      const consentKey = createConsentKey();
      await supabase.functions.invoke("save-cookie-consent", {
        body: {
          consentKey,
          policyVersion: prefs.policyVersion,
          categories: prefs.categories,
          mode: prefs.mode,
        },
      });
    } catch {
      // best-effort persistence only
    }
  }, []);

  const persistConsent = useCallback(
    async (categories: ConsentCategories, mode: ConsentPreferences["mode"]) => {
      const next: ConsentPreferences = {
        categories: {
          ...categories,
          essential: true,
        },
        policyVersion: POLICY_VERSION,
        mode,
        consentedAt: new Date().toISOString(),
      };

      setPreferences(next);
      setHasDecision(true);
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(
        new CustomEvent("progenia_consent_updated", {
          detail: next,
        }),
      );
      await syncToDatabase(next);
    },
    [syncToDatabase],
  );

  const acceptAll = useCallback(async () => {
    await persistConsent(
      {
        essential: true,
        analytics: true,
        marketing: true,
      },
      "banner",
    );
  }, [persistConsent]);

  const rejectOptional = useCallback(async () => {
    await persistConsent(
      {
        essential: true,
        analytics: false,
        marketing: false,
      },
      "banner",
    );
  }, [persistConsent]);

  const savePreferences = useCallback(
    async (categories: ConsentCategories) => {
      await persistConsent(categories, "preferences");
    },
    [persistConsent],
  );

  const value = useMemo<ConsentContextValue>(
    () => ({
      ready,
      hasDecision,
      preferences,
      isPreferencesOpen,
      openPreferences: () => setIsPreferencesOpen(true),
      closePreferences: () => setIsPreferencesOpen(false),
      acceptAll,
      rejectOptional,
      savePreferences,
    }),
    [acceptAll, hasDecision, isPreferencesOpen, preferences, ready, rejectOptional, savePreferences],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error("useConsent must be used within ConsentProvider");
  }
  return ctx;
}

