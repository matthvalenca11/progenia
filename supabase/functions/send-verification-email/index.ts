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

    // Build verification URL - use environment variable for flexibility
    const appUrl = Deno.env.get('APP_URL') || 'https://progenia.com.br';
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
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f5f5f5;">
            <div style="background-color: #ffffff; margin: 20px auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <!-- Header with Logo -->
              <div style="background: linear-gradient(135deg, #0B3B66 0%, #2D9B95 100%); padding: 40px 30px; text-align: center;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center">
                      <div style="width: 120px; margin: 0 auto 20px;">
                        <svg width="120" height="140" viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg">
                          <!-- Graduation Cap -->
                          <g transform="translate(10, 0)">
                            <!-- Cap base -->
                            <path d="M 50 25 L 90 35 L 90 50 L 50 60 L 10 50 L 10 35 Z" fill="#0B3B66"/>
                            <!-- Cap top -->
                            <ellipse cx="50" cy="35" rx="42" ry="12" fill="#0B3B66"/>
                            <!-- Tassel -->
                            <line x1="90" y1="35" x2="95" y2="55" stroke="#0B3B66" stroke-width="2"/>
                            <circle cx="95" cy="58" r="3" fill="#0B3B66"/>
                          </g>
                          
                          <!-- Medical Cross -->
                          <g transform="translate(35, 70)">
                            <rect x="15" y="0" width="20" height="50" rx="3" fill="#2D9B95"/>
                            <rect x="0" y="15" width="50" height="20" rx="3" fill="#2D9B95"/>
                          </g>
                        </svg>
                      </div>
                    </td>
                  </tr>
                </table>
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">ProGenia</h1>
              </div>
              
              <!-- Content -->
              <div style="padding: 40px 30px;">
                <h2 style="color: #0B3B66; font-size: 22px; margin-top: 0; margin-bottom: 20px;">Confirme seu e-mail</h2>
                <p style="font-size: 16px; margin-bottom: 25px; color: #555; line-height: 1.8;">${bodyIntro}</p>
                
                <div style="text-align: center; margin: 35px 0;">
                  <a href="${verificationUrl}" 
                     style="background: linear-gradient(135deg, #0B3B66 0%, #2D9B95 100%); 
                            color: white; 
                            padding: 16px 40px; 
                            text-decoration: none; 
                            border-radius: 8px; 
                            display: inline-block;
                            font-weight: 600;
                            font-size: 16px;
                            box-shadow: 0 4px 12px rgba(11, 59, 102, 0.3);
                            transition: all 0.3s ease;">
                    Confirmar E-mail
                  </a>
                </div>
                
                <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; border-left: 4px solid #2D9B95; margin-top: 30px;">
                  <p style="font-size: 14px; color: #666; margin: 0;">
                    <strong style="color: #0B3B66;">Importante:</strong> Se você não se cadastrou na plataforma ProGenia, ignore este e-mail com segurança.
                  </p>
                </div>
                
                <p style="font-size: 12px; color: #999; margin-top: 25px; text-align: center;">
                  ⏱️ Este link expira em 24 horas
                </p>
              </div>
              
              <!-- Footer -->
              <div style="background-color: #f9f9f9; padding: 25px 30px; text-align: center; border-top: 1px solid #e5e5e5;">
                <p style="margin: 0; font-size: 13px; color: #888;">
                  © 2025 ProGenia
                  Transformando a educação em saúde através da tecnologia
                </p>
              </div>
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
