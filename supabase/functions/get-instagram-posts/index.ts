import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Busca posts do Instagram (Basic Display ou Graph API conectada à Page).
 * Filtra posts ocultos em `instagram_posts_visibility`.
 *
 * Secrets no Supabase:
 * - INSTAGRAM_ACCESS_TOKEN (obrigatório na primeira configuração)
 * - INSTAGRAM_ACCOUNT_ID (obrigatório, ID numérico da conta IG Business/Creator)
 * - INSTAGRAM_API_BASE (opcional): default `https://graph.instagram.com`.
 *
 * Tokens de longa duração expiram (~60 dias). A função tenta renovar e
 * guarda o último feed em `instagram_feed_cache` para o blog não cair.
 */

type MetaApiError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
};

type InstagramPost = {
  id: unknown;
  media_type: unknown;
  media_url: unknown;
  caption: string;
  permalink: unknown;
  timestamp: unknown;
  thumbnail_url: unknown;
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
        "Gere um token de longa duração no Meta for Developers e atualize INSTAGRAM_ACCESS_TOKEN no Supabase.",
      code: "INSTAGRAM_TOKEN_EXPIRED",
    };
  }
  if (meta?.code === 100 || status === 400) {
    return {
      message: "Requisição inválida para a API do Instagram.",
      hint: "Confira INSTAGRAM_ACCOUNT_ID e INSTAGRAM_API_BASE.",
      code: "INSTAGRAM_BAD_REQUEST",
    };
  }
  if (status === 403) {
    return {
      message: "Acesso negado pela API do Instagram.",
      hint: "Verifique permissões do app e se a conta é Business/Creator.",
      code: "INSTAGRAM_FORBIDDEN",
    };
  }
  return {
    message: meta?.message || "Erro ao buscar posts do Instagram.",
    hint: "Consulte os logs da Edge Function e o painel Meta for Developers.",
    code: "INSTAGRAM_GRAPH_ERROR",
  };
}

function createAdmin() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function loadStoredToken(admin: ReturnType<typeof createAdmin>) {
  const { data } = await admin
    .from("instagram_connection")
    .select("access_token")
    .eq("id", 1)
    .maybeSingle();
  return typeof data?.access_token === "string" && data.access_token ? data.access_token : null;
}

async function saveToken(admin: ReturnType<typeof createAdmin>, accessToken: string) {
  await admin.from("instagram_connection").upsert({
    id: 1,
    access_token: accessToken,
    updated_at: new Date().toISOString(),
  });
}

async function saveCache(admin: ReturnType<typeof createAdmin>, posts: InstagramPost[]) {
  await admin.from("instagram_feed_cache").upsert({
    id: 1,
    posts,
    fetched_at: new Date().toISOString(),
  });
}

async function loadCache(admin: ReturnType<typeof createAdmin>): Promise<InstagramPost[] | null> {
  const { data } = await admin
    .from("instagram_feed_cache")
    .select("posts")
    .eq("id", 1)
    .maybeSingle();
  return Array.isArray(data?.posts) ? (data.posts as InstagramPost[]) : null;
}

async function refreshAccessToken(token: string) {
  const url =
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = (await response.json()) as { access_token?: string };
  return data.access_token || null;
}

async function fetchMedia(apiBase: string, accountId: string, accessToken: string) {
  const fields = "id,media_type,media_url,caption,permalink,timestamp,thumbnail_url";
  const url =
    `${apiBase}/${accountId}/media?fields=${fields}&access_token=${encodeURIComponent(accessToken)}&limit=12`;
  const response = await fetch(url);
  const text = await response.text();
  return { response, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const admin = createAdmin();

  try {
    const envToken = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
    const instagramAccountId = Deno.env.get("INSTAGRAM_ACCOUNT_ID");
    const apiBase = (Deno.env.get("INSTAGRAM_API_BASE") ?? "https://graph.instagram.com").replace(/\/$/, "");
    let accessToken = (await loadStoredToken(admin)) || envToken || null;

    if (!accessToken) {
      const cached = await loadCache(admin);
      if (cached?.length) {
        return new Response(JSON.stringify({ posts: cached, stale: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({
          error: "Instagram não configurado.",
          hint: "Configure o secret INSTAGRAM_ACCESS_TOKEN no Supabase.",
          code: "INSTAGRAM_NOT_CONFIGURED",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    if (!instagramAccountId) {
      const cached = await loadCache(admin);
      if (cached?.length) {
        return new Response(JSON.stringify({ posts: cached, stale: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({
          error: "Instagram não configurado.",
          hint: "Configure o secret INSTAGRAM_ACCOUNT_ID.",
          code: "INSTAGRAM_NOT_CONFIGURED",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    let { response, text } = await fetchMedia(apiBase, instagramAccountId, accessToken);
    if (!response.ok) {
      const { meta } = parseMetaErrorBody(text);
      if (meta?.code === 190 || response.status === 401) {
        const refreshed = await refreshAccessToken(accessToken);
        if (refreshed) {
          accessToken = refreshed;
          await saveToken(admin, refreshed);
          ({ response, text } = await fetchMedia(apiBase, instagramAccountId, accessToken));
        }
      }
    }

    if (!response.ok) {
      const cached = await loadCache(admin);
      if (cached?.length) {
        return new Response(JSON.stringify({ posts: cached, stale: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      const { meta } = parseMetaErrorBody(text);
      console.error("Erro ao buscar posts do Instagram:", response.status, text.slice(0, 500));
      const { message, hint, code } = buildHint(meta, response.status);
      return new Response(
        JSON.stringify({ error: message, hint, code }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const data = JSON.parse(text) as { data?: Record<string, unknown>[]; error?: MetaApiError };
    if (data.error) {
      const cached = await loadCache(admin);
      if (cached?.length) {
        return new Response(JSON.stringify({ posts: cached, stale: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      const { message, hint, code } = buildHint(data.error, 400);
      return new Response(
        JSON.stringify({ error: message, hint, code }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const allPosts = (data.data || []).map((post) => ({
      id: post.id,
      media_type: post.media_type,
      media_url: post.media_url,
      caption: typeof post.caption === "string" ? post.caption : "",
      permalink: post.permalink,
      timestamp: post.timestamp,
      thumbnail_url: post.thumbnail_url,
    }));

    const { data: visibilityData } = await admin
      .from("instagram_posts_visibility")
      .select("instagram_post_id, is_visible");

    const visibilityMap: Record<string, boolean> = {};
    visibilityData?.forEach((item: { instagram_post_id: string; is_visible: boolean }) => {
      visibilityMap[item.instagram_post_id] = item.is_visible;
    });

    const visiblePosts = allPosts.filter((post) => visibilityMap[String(post.id)] !== false);
    await saveCache(admin, visiblePosts);
    if (accessToken !== envToken) {
      await saveToken(admin, accessToken);
    }

    return new Response(JSON.stringify({ posts: visiblePosts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Erro em get-instagram-posts:", err);
    const cached = await loadCache(admin).catch(() => null);
    if (cached?.length) {
      return new Response(JSON.stringify({ posts: cached, stale: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    return new Response(
      JSON.stringify({ error: (err as Error).message, code: "INTERNAL" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  }
});
