import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM = 'NotreTab <noreply@notretab.app>'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  // Require authenticated caller
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
    const { groupName, fromMemberName, toMemberEmail, toMemberName, amount } = await req.json()

    if (!toMemberEmail) {
      return new Response(JSON.stringify({ error: 'Email destinataire requis' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const amountFormatted = Number(amount).toFixed(2)

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
        <div style="margin-bottom: 24px;">
          <div style="width: 44px; height: 44px; background: #22c55e; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; color: #fff;">N</div>
        </div>
        <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 8px;">Rappel de paiement</h2>
        <p style="color: #555; margin: 0 0 20px; line-height: 1.6;">
          Bonjour <strong>${esc(toMemberName)}</strong>,
        </p>
        <div style="background: #f9f9f9; border: 1px solid #eee; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 15px; color: #1a1a1a; line-height: 1.6;">
            Vous devez <strong style="color: #dc2626;">${esc(amountFormatted)} €</strong> à
            <strong>${esc(fromMemberName)}</strong> pour le groupe <strong>${esc(groupName)}</strong>.
          </p>
        </div>
        <p style="color: #555; margin: 0 0 20px; font-size: 13px; line-height: 1.6;">
          Connectez-vous à NotreTab pour régler cette dette ou effectuer un paiement directement.
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
        to: toMemberEmail,
        subject: `[NotreTab] Rappel de paiement — ${esc(groupName)}`,
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
    console.error('send-reminder error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
