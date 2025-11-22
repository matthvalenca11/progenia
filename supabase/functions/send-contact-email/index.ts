import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactRequest {
  name: string;
  email: string;
  phone: string;
  message: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, phone, message }: ContactRequest = await req.json();

    if (!name || !email || !phone || !message) {
      return new Response(
        JSON.stringify({ error: "Todos os campos são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enviar email para a ProGenia
    const { error: emailError } = await resend.emails.send({
      from: "Fale Conosco ProGenia <noreply@progenia.com.br>",
      to: ["matheusvalenca@progenia.com.br"],
      replyTo: email,
      subject: `Nova mensagem de contato - ${name}`,
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
                      <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <svg width="60" height="60" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                          <path d="M100 10 L160 50 L160 90 L100 130 L40 90 L40 50 Z" fill="#0B3B66"/>
                          <circle cx="100" cy="100" r="25" fill="#2D9B95"/>
                          <path d="M85 100 L95 110 L115 90" stroke="white" stroke-width="4" fill="none" stroke-linecap="round"/>
                        </svg>
                      </div>
                    </td>
                  </tr>
                </table>
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Nova Mensagem de Contato</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 14px;">Formulário ProGenia</p>
              </div>
              
              <!-- Content -->
              <div style="padding: 40px 30px;">
                <h2 style="color: #0B3B66; font-size: 20px; margin-top: 0; margin-bottom: 25px;">Dados do Contato</h2>
                
                <div style="background: #f9f9f9; padding: 25px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #2D9B95;">
                  <div style="margin-bottom: 15px;">
                    <strong style="color: #0B3B66; display: block; margin-bottom: 5px;">👤 Nome:</strong>
                    <span style="color: #555;">${name}</span>
                  </div>
                  <div style="margin-bottom: 15px;">
                    <strong style="color: #0B3B66; display: block; margin-bottom: 5px;">📧 Email:</strong>
                    <a href="mailto:${email}" style="color: #2D9B95; text-decoration: none;">${email}</a>
                  </div>
                  <div>
                    <strong style="color: #0B3B66; display: block; margin-bottom: 5px;">📱 Telefone:</strong>
                    <a href="tel:${phone}" style="color: #2D9B95; text-decoration: none;">${phone}</a>
                  </div>
                </div>

                <h3 style="color: #0B3B66; font-size: 18px; margin-bottom: 15px;">💬 Mensagem:</h3>
                <div style="background: white; padding: 25px; border-radius: 8px; border: 1px solid #e5e5e5; white-space: pre-wrap; line-height: 1.8; color: #555;">
${message}
                </div>
              </div>
              
              <!-- Footer -->
              <div style="background-color: #f9f9f9; padding: 25px 30px; text-align: center; border-top: 1px solid #e5e5e5;">
                <p style="margin: 0; font-size: 13px; color: #888;">
                  © 2025 ProGenia - Learn & Evolve<br/>
                  Enviado via formulário de contato ProGenia
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("Erro ao enviar email:", emailError);
      return new Response(
        JSON.stringify({ error: "Falha ao enviar email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email de contato enviado com sucesso:", { name, email });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro na função send-contact-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
