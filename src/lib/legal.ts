import type { SupabaseClient } from "@supabase/supabase-js";

type LegalBundle = {
  text: string;
  dpoEmail?: string;
  dpoChannel?: string;
  versions: {
    terms: string;
    privacy: string;
    cookies: string;
  };
};

const LEGAL_SETTINGS_ID = "00000000-0000-0000-0000-000000000002";

export async function loadLegalBundle(supabase: SupabaseClient): Promise<LegalBundle | null> {
  const [{ data: docs }, { data: settings }] = await Promise.all([
    supabase
      .from("legal_documents")
      .select("document_type,title,content,version,language,is_active,effective_at")
      .eq("is_active", true)
      .eq("language", "pt-BR")
      .order("effective_at", { ascending: false }),
    supabase
      .from("legal_settings")
      .select("terms_privacy_text,dpo_contact_email,dpo_contact_channel,terms_version,privacy_version,cookies_version")
      .eq("id", LEGAL_SETTINGS_ID)
      .maybeSingle(),
  ]);

  const getLatest = (docType: "terms_of_use" | "privacy_policy" | "cookie_policy") =>
    docs?.find((d) => d.document_type === docType);

  const terms = getLatest("terms_of_use");
  const privacy = getLatest("privacy_policy");
  const cookies = getLatest("cookie_policy");

  const sections: string[] = [];
  if (terms?.content) sections.push(`TERMOS DE USO (${terms.version})\n\n${terms.content}`);
  if (privacy?.content) sections.push(`POLITICA DE PRIVACIDADE (${privacy.version})\n\n${privacy.content}`);
  if (cookies?.content) sections.push(`POLITICA DE COOKIES (${cookies.version})\n\n${cookies.content}`);

  const fallback = settings?.terms_privacy_text ?? "";
  const text = sections.length ? sections.join("\n\n---------------------------------\n\n") : fallback;

  if (!text) return null;

  return {
    text,
    dpoEmail: settings?.dpo_contact_email ?? undefined,
    dpoChannel: settings?.dpo_contact_channel ?? undefined,
    versions: {
      terms: terms?.version ?? settings?.terms_version ?? "v1",
      privacy: privacy?.version ?? settings?.privacy_version ?? "v1",
      cookies: cookies?.version ?? settings?.cookies_version ?? "v1",
    },
  };
}

