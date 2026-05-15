import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
import { getCorsHeaders } from "../_shared/privacy.ts";

// Generate a random secure token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find user by email in auth.users (source of truth) - profiles.email can be null for older users
    const { data: userId, error: rpcError } = await supabase.rpc("get_user_id_by_email", {
      p_email: email,
    });

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: "Failed to process request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Always return success to prevent email enumeration
    if (!userId) {
      return new Response(
        JSON.stringify({ success: true, message: "If the email exists, a reset link has been sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate reset token
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    // Store token in profiles (profile exists via handle_new_user trigger)
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        password_reset_token: token,
        password_reset_expires_at: expiresAt.toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to process request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send reset email (use request email, auth.users is source of truth for user existence)
    const { error: emailError } = await supabase.functions.invoke("send-reset-email", {
      body: { email, token },
    });

    if (emailError) {
      // Do not expose PII in logs.
    }

    return new Response(
      JSON.stringify({ success: true, message: "If the email exists, a reset link has been sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
