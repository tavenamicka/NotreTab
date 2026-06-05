import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM = 'NotreTab <noreply@notretab.app>'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { name, email } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email requis' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
        <div style="margin-bottom: 24px;">
          <div style="width: 44px; height: 44px; background: #22c55e; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; color: #fff;">N</div>
        </div>
        <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 8px;">Bienvenue sur NotreTab, ${name || 'cher utilisateur'} !</h2>
        <p style="color: #555; margin: 0 0 20px; line-height: 1.6;">
          Votre compte a bien été créé. Pour commencer à partager vos dépenses en groupe,
          veuillez confirmer votre adresse email en cliquant sur le lien envoyé séparément par Supabase.
        </p>
        <p style="color: #555; margin: 0 0 20px; line-height: 1.6;">
          Une fois votre email confirmé, vous pourrez vous connecter et créer votre premier groupe.
        </p>
        <div style="border-top: 1px solid #eee; margin-top: 32px; padding-top: 16px; font-size: 12px; color: #999;">
          NotreTab — Partagez les dépenses simplement
        </div>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: email,
        subject: 'Bienvenue sur NotreTab',
        html,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend error:', data)
      return new Response(JSON.stringify({ error: data }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-welcome error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
