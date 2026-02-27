import { corsHeaders } from '../_shared/cors.ts'

/**
 * Renova o token do Instagram automaticamente antes de expirar.
 * Tokens de longa duração expiram em 60 dias, mas podem ser renovados
 * se forem renovados pelo menos 24 horas antes do vencimento.
 * 
 * Esta função deve ser chamada periodicamente (ex: via cron job) para manter
 * o token sempre válido.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const currentToken = Deno.env.get('INSTAGRAM_ACCESS_TOKEN')
    const appId = Deno.env.get('INSTAGRAM_APP_ID') || '1442163880709941'
    const appSecret = Deno.env.get('INSTAGRAM_APP_SECRET') || 'ba503770dfd99ad6f76af10051a5fb7e'

    if (!currentToken) {
      return new Response(
        JSON.stringify({ error: 'INSTAGRAM_ACCESS_TOKEN não configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Endpoint para renovar token de longa duração
    // Documentação: https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token
    const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`

    const response = await fetch(url)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Erro ao renovar token:', response.status, errorText)
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao renovar token',
          details: errorText 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.status }
      )
    }

    const data = await response.json()

    if (!data.access_token) {
      return new Response(
        JSON.stringify({ error: 'Token não retornado na resposta' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // IMPORTANTE: Você precisa atualizar manualmente o secret no Supabase
    // Esta função apenas retorna o novo token - não atualiza automaticamente
    return new Response(
      JSON.stringify({ 
        success: true,
        access_token: data.access_token,
        expires_in: data.expires_in,
        token_type: data.token_type,
        message: 'Token renovado com sucesso. Atualize INSTAGRAM_ACCESS_TOKEN no Supabase com o novo token.',
        command: `supabase secrets set INSTAGRAM_ACCESS_TOKEN="${data.access_token}"`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    console.error('Erro em refresh-instagram-token:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
