import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
import { getClientPrivacyHashes, getCorsHeaders } from "../_shared/privacy.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const consentKey = String(body?.consentKey || "");
    const categories = body?.categories || { essential: true, analytics: false, marketing: false };
    const policyVersion = String(body?.policyVersion || "v1");
    const consentMode = String(body?.mode || "banner");

    if (!consentKey) {
      return new Response(JSON.stringify({ error: "consentKey is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length);
      const { data } = await supabase.auth.getUser(token);
      userId = data.user?.id ?? null;
    }

    const { ipHash, userAgentHash } = await getClientPrivacyHashes(req);

    const { error } = await supabase.from("cookie_consents").upsert(
      {
        consent_key: consentKey,
        user_id: userId,
        policy_version: policyVersion,
        categories,
        consent_mode: consentMode,
        consented_at: new Date().toISOString(),
        revoked_at: categories.analytics || categories.marketing ? null : new Date().toISOString(),
        ip_hash: ipHash,
        user_agent_hash: userAgentHash,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "consent_key" },
    );

    if (error) {
      return new Response(JSON.stringify({ error: "failed to store consent" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

