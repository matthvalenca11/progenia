import { corsHeaders } from "../_shared/cors.ts";

/**
 * Renova token de longa duração do Instagram (Basic Display / ig_refresh_token).
 * Documentação: https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token
 *
 * Deve ser chamada periodicamente (ex.: cron antes de 60 dias).
 * Após sucesso, atualize o secret no Supabase com o access_token retornado.
 *
 * Não há App Secret neste fluxo: o endpoint só precisa do token atual ainda válido para renovação.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const currentToken = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");

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
      return new Response(
        JSON.stringify({
          error: "Erro ao renovar token",
          details: errorText,
          hint:
            "Se o token já passou do prazo ou foi revogado, gere um novo no Meta for Developers e defina INSTAGRAM_ACCESS_TOKEN.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: response.status },
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

    return new Response(
      JSON.stringify({
        success: true,
        access_token: data.access_token,
        expires_in: data.expires_in,
        token_type: data.token_type,
        message:
          "Token renovado. Atualize o secret INSTAGRAM_ACCESS_TOKEN no Supabase com o valor de access_token.",
        command: `supabase secrets set INSTAGRAM_ACCESS_TOKEN="${data.access_token}"`,
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
