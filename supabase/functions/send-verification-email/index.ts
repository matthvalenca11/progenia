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

    const fromEmail = settings?.verification_from_email || 
                     settings?.default_from_email || 
                     Deno.env.get("EMAIL_FROM_DEFAULT") || 
                     "noreply@resend.dev";
    
    const subject = settings?.verification_subject || "Confirme seu e-mail – ProGenia";
    const bodyIntro = settings?.verification_body_intro || 
                     "Olá! Bem-vindo(a) à plataforma ProGenia. Clique no botão abaixo para confirmar seu e-mail.";

    // Build verification URL
    const appUrl = Deno.env.get("VITE_SUPABASE_URL")?.replace("/supabase.co", ".lovable.app") || "https://mouvai.com";
    const verificationUrl = `${appUrl}/verify-email?token=${token}`;

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
                <a href="${verificationUrl}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 15px 30px; 
                          text-decoration: none; 
                          border-radius: 5px; 
                          display: inline-block;
                          font-weight: bold;">
                  Confirmar E-mail
                </a>
              </div>
              <p style="font-size: 14px; color: #666; margin-top: 30px;">
                Se você não se cadastrou na plataforma, ignore este e-mail.
              </p>
              <p style="font-size: 12px; color: #999; margin-top: 20px;">
                Este link expira em 24 horas.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("Error sending verification email:", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Verification email sent successfully to:", email);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-verification-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
