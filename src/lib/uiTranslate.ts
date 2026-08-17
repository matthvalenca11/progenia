import { getForcedPtEnOverride } from "@/lib/ptEnOverrides";

type AppLanguage = "pt" | "en";

/** Use for headlines and labels that must not rely on DOM auto-translation alone. */
export function uiText(language: AppLanguage, pt: string): string {
  if (language !== "en") return pt;
  return getForcedPtEnOverride(pt) ?? pt;
}

/** Welcome line with name — avoids "Welcome, Name" MT issues. */
export function welcomeLine(language: AppLanguage, firstName: string): string {
  if (language === "en") {
    return firstName ? `Welcome, ${firstName}.` : "Welcome.";
  }
  return firstName ? `Bem-vindo, ${firstName}.` : "Bem-vindo.";
}

/** Module title from CMS: apply known overrides (e.g. Diagnóstico por Imagem). */
export function translateModuleTitle(language: AppLanguage, title?: string): string {
  if (!title) return "";
  if (language !== "en") return title;
  const forced = getForcedPtEnOverride(title);
  if (forced) return forced;
  return title;
}
