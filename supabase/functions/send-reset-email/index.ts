import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, token } = await req.json();

    if (!email || !token) {
      return new Response(
        JSON.stringify({ error: "Email and token are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get email settings
    const { data: settings } = await supabase
      .from("email_settings")
      .select("*")
      .single();

    const fromEmail = settings?.reset_from_email || 
                     settings?.default_from_email || 
                     Deno.env.get("EMAIL_FROM_DEFAULT") || 
                     "noreply@resend.dev";
    
    const subject = settings?.reset_subject || "Redefinição de senha – ProGenia";
    const bodyIntro = settings?.reset_body_intro || 
                     "Você solicitou a redefinição de senha na plataforma. Se não foi você, ignore este e-mail.";

    // Build reset URL - use the project's actual domain
    const appUrl = "https://progenia.com.br";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    // Send email using Resend
    const { error: emailError } = await resend.emails.send({
      from: `ProGenia <${fromEmail}>`,
      to: [email],
      subject,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">ProGenia</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">${bodyIntro}</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 15px 30px; 
                          text-decoration: none; 
                          border-radius: 5px; 
                          display: inline-block;
                          font-weight: bold;">
                  Redefinir Senha
                </a>
              </div>
              <p style="font-size: 14px; color: #666; margin-top: 30px;">
                Se você não solicitou a redefinição de senha, ignore este e-mail. Sua senha permanecerá inalterada.
              </p>
              <p style="font-size: 12px; color: #999; margin-top: 20px;">
                Este link expira em 1 hora.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("Error sending reset email:", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Reset email sent successfully to:", email);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-reset-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
