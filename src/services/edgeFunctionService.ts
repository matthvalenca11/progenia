import { Http } from "@capacitor-community/http";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/capacitor";
import { readEdgeFunctionErrorBody } from "@/lib/supabaseFunctionsErrors";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? SUPABASE_KEY;
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
  };
}

async function postEdgeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: Error | null }> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { data: null, error: new Error("Supabase não configurado no app.") };
  }

  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const headers = await getAuthHeaders();

  try {
    if (isNativeApp) {
      const response = await Http.post({
        url,
        headers,
        data: body,
        connectTimeout: 90_000,
        readTimeout: 90_000,
      });

      if (response.status < 200 || response.status >= 300) {
        const payload = response.data as { error?: string } | undefined;
        const message = payload?.error || `Erro HTTP ${response.status}`;
        return { data: null, error: new Error(message) };
      }

      return { data: response.data as T, error: null };
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => ({}))) as T & { error?: string };

    if (!response.ok) {
      const message = payload?.error || `Erro HTTP ${response.status}`;
      return { data: null, error: new Error(message) };
    }

    return { data: payload as T, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha na requisição";
    return { data: null, error: new Error(message) };
  }
}

export async function invokeEdgeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: Error | null }> {
  const direct = await postEdgeFunction<T>(name, body);
  if (!direct.error || !isNativeApp) {
    return direct;
  }

  // Fallback web path via supabase-js (útil se o plugin nativo falhar).
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const details = await readEdgeFunctionErrorBody(error);
    const message = details?.error || error.message || direct.error.message;
    return { data: null, error: new Error(message) };
  }

  return { data: data as T, error: null };
}
