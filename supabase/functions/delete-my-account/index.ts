import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

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

    let jwt: string | null = null
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        jwt = body?.access_token ?? body?.token ?? null
      } catch {
        /* ignore */
      }
    }
    if (!jwt) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
      }
    }
    if (!jwt) {
      return new Response(
        JSON.stringify({ error: 'Token de autorização ausente.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 
        'Authorization': `Bearer ${jwt}`, 
        'apikey': anonKey,
        'Content-Type': 'application/json',
      },
    })
    
    if (!authRes.ok) {
      const authBody = await authRes.text()
      let errMsg = 'Token inválido ou expirado'
      try {
        const parsed = JSON.parse(authBody)
        errMsg = parsed.msg || parsed.error_description || parsed.error || errMsg
      } catch {
        if (authBody) errMsg = authBody.slice(0, 200)
      }
      console.log('delete-my-account: Auth API rejected', authRes.status, errMsg)
      return new Response(
        JSON.stringify({ error: errMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }
    
    const user = await authRes.json()
    const userId = user?.id
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Resposta do Auth inválida' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('delete-my-account: deleteUser failed', deleteError)
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    console.error('delete-my-account:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
