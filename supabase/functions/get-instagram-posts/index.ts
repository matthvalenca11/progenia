import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Busca posts do Instagram (Basic Display ou Graph API conectada à Page).
 * Filtra posts ocultos em `instagram_posts_visibility`.
 *
 * Secrets no Supabase:
 * - INSTAGRAM_ACCESS_TOKEN (obrigatório)
 * - INSTAGRAM_ACCOUNT_ID (obrigatório, ID numérico da conta IG Business/Creator ou user id Basic Display)
 * - INSTAGRAM_API_BASE (opcional): default `https://graph.instagram.com`.
 *   Para token de Page do Facebook use: `https://graph.facebook.com/v21.0` (ajuste a versão).
 *
 * Tokens de longa duração expiram (~60 dias). Renovar com refresh-instagram-token ou novo OAuth no Meta.
 */

type MetaApiError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
};

function parseMetaErrorBody(text: string): { meta?: MetaApiError } {
  try {
    const j = JSON.parse(text) as { error?: MetaApiError };
    if (j?.error && typeof j.error === "object") return { meta: j.error };
  } catch {
    /* ignore */
  }
  return {};
}

function buildHint(meta: MetaApiError | undefined, status: number): { message: string; hint: string; code: string } {
  const tokenLikelyInvalid = meta?.code === 190 || status === 401;
  if (tokenLikelyInvalid) {
    return {
      message: "Token do Instagram inválido ou expirado.",
      hint:
        "O access token do Meta expirou ou foi revogado. No Meta for Developers, gere um token de longa duração (ou troque o token curto por longo via oauth/access_token), depois atualize o secret INSTAGRAM_ACCESS_TOKEN no Supabase. Se ainda estiver na janela de renovação (~60 dias), faça deploy de refresh-instagram-token, chame a função e aplique o novo token com: supabase secrets set INSTAGRAM_ACCESS_TOKEN=\"...\"",
      code: "INSTAGRAM_TOKEN_EXPIRED",
    };
  }
  if (meta?.code === 100 || status === 400) {
    return {
      message: "Requisição inválida para a API do Instagram.",
      hint:
        "Confira INSTAGRAM_ACCOUNT_ID (deve ser o ID da conta Instagram Business/Creator ligada à Page). Se você usa token de Page do Facebook, defina INSTAGRAM_API_BASE=https://graph.facebook.com/v21.0 (versão conforme documentação Meta).",
      code: "INSTAGRAM_BAD_REQUEST",
    };
  }
  if (status === 403) {
    return {
      message: "Acesso negado pela API do Instagram.",
      hint:
        "Verifique permissões do app (instagram_basic, pages_read_engagement, etc.) e se a conta é Business/Creator.",
      code: "INSTAGRAM_FORBIDDEN",
    };
  }
  return {
    message: meta?.message || "Erro ao buscar posts do Instagram.",
    hint: "Consulte os logs da Edge Function e o painel Meta for Developers (status do app e tokens).",
    code: "INSTAGRAM_GRAPH_ERROR",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
    const instagramAccountId = Deno.env.get("INSTAGRAM_ACCOUNT_ID");
    const apiBase = (Deno.env.get("INSTAGRAM_API_BASE") ?? "https://graph.instagram.com").replace(/\/$/, "");

    if (!accessToken) {
      console.error("INSTAGRAM_ACCESS_TOKEN não configurado");
      return new Response(
        JSON.stringify({
          error: "Instagram não configurado.",
          hint: "Configure o secret INSTAGRAM_ACCESS_TOKEN no Supabase (Edge Functions → Secrets).",
          code: "INSTAGRAM_NOT_CONFIGURED",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    if (!instagramAccountId) {
      console.error("INSTAGRAM_ACCOUNT_ID não configurado");
      return new Response(
        JSON.stringify({
          error: "Instagram não configurado.",
          hint: "Configure o secret INSTAGRAM_ACCOUNT_ID (ID numérico da conta Instagram, não o @username).",
          code: "INSTAGRAM_NOT_CONFIGURED",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    const fields =
      "id,media_type,media_url,caption,permalink,timestamp,thumbnail_url";
    const url =
      `${apiBase}/${instagramAccountId}/media?fields=${fields}&access_token=${encodeURIComponent(accessToken)}&limit=12`;

    const response = await fetch(url);
    const errorText = await response.text();

    if (!response.ok) {
      const { meta } = parseMetaErrorBody(errorText);
      console.error("Erro ao buscar posts do Instagram:", response.status, errorText.slice(0, 500));
      const { message, hint, code } = buildHint(meta, response.status);
      return new Response(
        JSON.stringify({
          error: message,
          hint,
          code,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: response.status >= 500 ? 502 : response.status },
      );
    }

    const data = JSON.parse(errorText) as { data?: unknown[]; error?: MetaApiError };

    if (data.error) {
      const { message, hint, code } = buildHint(data.error, 400);
      return new Response(
        JSON.stringify({ error: message, hint, code }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const allPosts = (data.data || []).map((post: Record<string, unknown>) => ({
      id: post.id,
      media_type: post.media_type,
      media_url: post.media_url,
      caption: post.caption || "",
      permalink: post.permalink,
      timestamp: post.timestamp,
      thumbnail_url: post.thumbnail_url,
    }));

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: visibilityData, error: visibilityError } = await supabaseAdmin
      .from("instagram_posts_visibility")
      .select("instagram_post_id, is_visible");

    const visibilityMap: Record<string, boolean> = {};
    if (visibilityData && !visibilityError) {
      visibilityData.forEach((item: { instagram_post_id: string; is_visible: boolean }) => {
        visibilityMap[item.instagram_post_id] = item.is_visible;
      });
    }

    const visiblePosts = allPosts.filter((post: { id: string }) => visibilityMap[post.id] !== false);

    return new Response(JSON.stringify({ posts: visiblePosts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Erro em get-instagram-posts:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message, code: "INTERNAL" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
