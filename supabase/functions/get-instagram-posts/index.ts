import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

/**
 * Busca posts do Instagram usando Instagram Graph API.
 * Filtra posts ocultos baseado na tabela instagram_posts_visibility.
 * Requer configuração no Facebook for Developers:
 * 1. Criar App no Facebook Developers
 * 2. Conectar conta Instagram Business/Creator
 * 3. Obter Access Token de longa duração
 * 4. Configurar variável de ambiente INSTAGRAM_ACCESS_TOKEN
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const accessToken = Deno.env.get('INSTAGRAM_ACCESS_TOKEN')
    const instagramAccountId = Deno.env.get('INSTAGRAM_ACCOUNT_ID') // ID da conta Instagram (não username)

    if (!accessToken) {
      console.error('INSTAGRAM_ACCESS_TOKEN não configurado')
      return new Response(
        JSON.stringify({ error: 'Instagram não configurado. Configure INSTAGRAM_ACCESS_TOKEN.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    if (!instagramAccountId) {
      console.error('INSTAGRAM_ACCOUNT_ID não configurado')
      return new Response(
        JSON.stringify({ error: 'Instagram não configurado. Configure INSTAGRAM_ACCOUNT_ID.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Buscar posts da conta Instagram
    // Endpoint: GET /{ig-user-id}/media
    const url = `https://graph.instagram.com/${instagramAccountId}/media?fields=id,media_type,media_url,caption,permalink,timestamp,thumbnail_url&access_token=${accessToken}&limit=12`

    const response = await fetch(url)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Erro ao buscar posts do Instagram:', response.status, errorText)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar posts do Instagram. Verifique as credenciais.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.status }
      )
    }

    const data = await response.json()

    // Formatar posts para o formato esperado pelo cliente
    const allPosts = (data.data || []).map((post: any) => ({
      id: post.id,
      media_type: post.media_type,
      media_url: post.media_url,
      caption: post.caption || '',
      permalink: post.permalink,
      timestamp: post.timestamp,
      thumbnail_url: post.thumbnail_url,
    }))

    // Buscar configurações de visibilidade do banco
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: visibilityData, error: visibilityError } = await supabaseAdmin
      .from('instagram_posts_visibility')
      .select('instagram_post_id, is_visible')

    // Criar mapa de visibilidade: se não existe na tabela, assume visível (true)
    const visibilityMap: Record<string, boolean> = {}
    if (visibilityData && !visibilityError) {
      visibilityData.forEach((item: { instagram_post_id: string; is_visible: boolean }) => {
        visibilityMap[item.instagram_post_id] = item.is_visible
      })
    }

    // Filtrar apenas posts visíveis
    const visiblePosts = allPosts.filter((post: any) => {
      // Se não está na tabela, assume visível (padrão)
      return visibilityMap[post.id] !== false
    })

    return new Response(
      JSON.stringify({ posts: visiblePosts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    console.error('Erro em get-instagram-posts:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
