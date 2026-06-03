import { Preferences } from "@capacitor/preferences";
import { isNativeMobile } from "@/lib/capacitor";

export const NATIVE_LANGUAGE_ONBOARDING_KEY = "progenia_native_language_onboarding_done";
export const APP_LANGUAGE_STORAGE_KEY = "progenia_language";

export type AppLanguage = "pt" | "en";

export async function hasCompletedNativeLanguageOnboarding(): Promise<boolean> {
  if (!isNativeMobile) return true;

  try {
    const { value } = await Preferences.get({ key: NATIVE_LANGUAGE_ONBOARDING_KEY });
    if (value === "1") return true;
  } catch {
    // ignore
  }

  return localStorage.getItem(NATIVE_LANGUAGE_ONBOARDING_KEY) === "1";
}

export async function completeNativeLanguageOnboarding(language: AppLanguage): Promise<void> {
  localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
  localStorage.setItem(NATIVE_LANGUAGE_ONBOARDING_KEY, "1");
  document.documentElement.lang = language === "en" ? "en" : "pt-BR";

  if (!isNativeMobile) return;

  await Preferences.set({ key: NATIVE_LANGUAGE_ONBOARDING_KEY, value: "1" });
  await Preferences.set({ key: APP_LANGUAGE_STORAGE_KEY, value: language });
}

export async function readPersistedAppLanguage(): Promise<AppLanguage | null> {
  if (isNativeMobile) {
    try {
      const { value } = await Preferences.get({ key: APP_LANGUAGE_STORAGE_KEY });
      if (value === "en" || value === "pt") return value;
    } catch {
      // ignore
    }
  }

  const saved = localStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
  return saved === "en" || saved === "pt" ? saved : null;
}
