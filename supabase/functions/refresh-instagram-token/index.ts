import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Renova o token de longa duração do Instagram e grava em `instagram_connection`.
 * O blog lê esse valor automaticamente — não é preciso atualizar secrets no CLI.
 *
 * Chamar a cada ~15 dias enquanto o token ainda é válido. Se expirar de vez,
 * é preciso gerar um token novo no Meta uma única vez.
 */
function createAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function loadCurrentToken(admin: ReturnType<typeof createAdmin>) {
  const { data } = await admin
    .from("instagram_connection")
    .select("access_token")
    .eq("id", 1)
    .maybeSingle();
  if (typeof data?.access_token === "string" && data.access_token) {
    return data.access_token;
  }
  return Deno.env.get("INSTAGRAM_ACCESS_TOKEN") || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const admin = createAdmin();

  try {
    const currentToken = await loadCurrentToken(admin);

    if (!currentToken) {
      return new Response(JSON.stringify({ error: "INSTAGRAM_ACCESS_TOKEN não configurado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const url =
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(currentToken)}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro ao renovar token:", response.status, errorText.slice(0, 500));
      await admin.from("instagram_connection").upsert({
        id: 1,
        last_refresh_error: errorText.slice(0, 500),
        updated_at: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({
          error: "Erro ao renovar token",
          hint:
            "Se o token já expirou, gere um novo no Meta for Developers e defina INSTAGRAM_ACCESS_TOKEN uma vez.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      token_type?: string;
    };

    if (!data.access_token) {
      return new Response(JSON.stringify({ error: "Token não retornado na resposta" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null;

    await admin.from("instagram_connection").upsert({
      id: 1,
      access_token: data.access_token,
      updated_at: new Date().toISOString(),
      expires_at: expiresAt,
      last_refresh_error: null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        expires_in: data.expires_in,
        expires_at: expiresAt,
        message: "Token renovado e gravado. O blog passa a usar o novo valor sozinho.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    console.error("Erro em refresh-instagram-token:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
