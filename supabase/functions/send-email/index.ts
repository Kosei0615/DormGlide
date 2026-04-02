import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

type EmailPayload = {
  to: string
  subject: string
  html?: string
  text?: string
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const apiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'DormGlide <onboarding@resend.dev>'

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY secret' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const body = (await req.json()) as Partial<EmailPayload>
    const to = String(body.to || '').trim()
    const subject = String(body.subject || '').trim()
    const html = String(body.html || '').trim()
    const text = String(body.text || '').trim()

    if (!to || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload. Required: to, subject, and html or text.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html: html || undefined,
        text: text || undefined
      })
    })

    const resendJson = await resendResponse.json().catch(() => ({}))

    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Resend API request failed', details: resendJson }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(JSON.stringify({ ok: true, result: resendJson }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Unhandled send-email error', details: String(error) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})
