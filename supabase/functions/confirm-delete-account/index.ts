import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Exclui a conta usando um token de uso único.
 * O cliente gera o token após validar a senha (signInWithPassword) e insere em delete_requests.
 * Esta função não precisa validar JWT.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    let token: string | null = null
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        token = body?.token ?? body?.delete_token ?? null
      } catch {
        /* ignore */
      }
    }
    if (!token || typeof token !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Token de exclusão ausente.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const now = new Date().toISOString()
    const { data: row, error: fetchError } = await supabaseAdmin
      .from('delete_requests')
      .select('id, user_id')
      .eq('token', token)
      .gt('expires_at', now)
      .limit(1)
      .maybeSingle()

    if (fetchError) {
      console.error('confirm-delete-account: fetch error', fetchError)
      const msg = fetchError.message?.includes('relation') || fetchError.message?.includes('does not exist')
        ? 'Tabela delete_requests não existe. Rode: supabase db push'
        : 'Erro ao verificar token.'
      return new Response(
        JSON.stringify({ error: msg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }
    if (!row?.user_id) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado. Tente novamente.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const userId = row.user_id
    const { error: deleteRowError } = await supabaseAdmin
      .from('delete_requests')
      .delete()
      .eq('id', row.id)
    if (deleteRowError) {
      console.error('confirm-delete-account: delete row error', deleteRowError)
    }

    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteUserError) {
      console.error('confirm-delete-account: deleteUser failed', deleteUserError)
      return new Response(
        JSON.stringify({ error: deleteUserError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    console.error('confirm-delete-account:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
