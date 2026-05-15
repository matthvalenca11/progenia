import type { ConsentPreferences } from "@/contexts/ConsentContext";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
    Sentry?: {
      setUser?: (user: Record<string, unknown> | null) => void;
      setTag?: (key: string, value: string) => void;
    };
  }
}

const GA_SCRIPT_ID = "progenia-ga-script";

function getGaId() {
  return import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
}

function ensureGaScript(measurementId: string) {
  if (document.getElementById(GA_SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = GA_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
}

function initGtag(measurementId: string) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args as unknown as Record<string, unknown>);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
}

export function applyTelemetryFromConsent(prefs: ConsentPreferences) {
  const gaId = getGaId();
  if (!gaId) return;

  const disableKey = `ga-disable-${gaId}`;
  const shouldEnableGa = prefs.categories.analytics;
  (window as unknown as Record<string, unknown>)[disableKey] = !shouldEnableGa;

  if (shouldEnableGa) {
    ensureGaScript(gaId);
    initGtag(gaId);
  }

  // Sentry hard gate (if Sentry is initialized externally).
  if (window.Sentry?.setTag) {
    window.Sentry.setTag("consent.analytics", String(prefs.categories.analytics));
    window.Sentry.setTag("consent.marketing", String(prefs.categories.marketing));
  }
  if (!prefs.categories.analytics && window.Sentry?.setUser) {
    window.Sentry.setUser(null);
  }
}

export function initConsentAwareTelemetry() {
  const applyFromEvent = (event: Event) => {
    const detail = (event as CustomEvent<ConsentPreferences>).detail;
    if (!detail) return;
    applyTelemetryFromConsent(detail);
  };

  window.addEventListener("progenia_consent_updated", applyFromEvent as EventListener);
}

