// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { event, listingId, buyerId, sellerId } = await req.json()

  const supabaseUrl =
    Deno.env.get('SUPABASE_URL') ||
    Deno.env.get('sUPABASE_URL') ||
    Deno.env.get('DORMGLIDE_SUPABASE_URL')
  const serviceRoleKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    Deno.env.get('sUPABASE_SERVICE_ROLE_KEY') ||
    Deno.env.get('DORMGLIDE_SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        error:
          'Missing Supabase function secrets. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or configured fallback names).'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey
  )
  const resendApiKey = Deno.env.get('RESEND_API_KEY') || Deno.env.get('resend_api_key')
  const resendFrom = Deno.env.get('RESEND_FROM_EMAIL') || 'DormGlide <onboarding@resend.dev>'

  // Fetch buyer and seller emails
  const { data: buyer } = await supabase.auth.admin.getUserById(buyerId)
  const { data: seller } = await supabase.auth.admin.getUserById(sellerId)

  // Fetch listing title
  const { data: listing } = await supabase
    .from('products')
    .select('title, price, seller_email')
    .eq('id', listingId)
    .single()

  const title = listing?.title || 'Item'
  const price = listing?.price ? `$${listing.price}` : ''

  const emails = []

  if (event === 'purchase_requested') {
    // Notify seller
    if (seller?.user?.email || listing?.seller_email) {
      emails.push({
        to: seller?.user?.email || listing?.seller_email,
        subject: `DormGlide: New purchase request for "${title}"`,
        html: `
          <h2>You have a new purchase request!</h2>
          <p>A buyer is interested in your listing: <strong>${title}</strong> (${price})</p>
          <p>Log in to DormGlide to review and confirm the purchase.</p>
          <a href="https://kosei0615.github.io/DormGlide/app.html" 
             style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;
                    text-decoration:none;display:inline-block;margin-top:16px">
            View on DormGlide
          </a>
          <p style="margin-top:24px;color:#6b7280;font-size:12px">
            DormGlide - Student Marketplace. 
            Stay safe: always meet in public campus locations.
          </p>
        `
      })
    }
    // Confirm to buyer
    if (buyer?.user?.email) {
      emails.push({
        to: buyer.user.email,
        subject: `DormGlide: Your request for "${title}" was sent`,
        html: `
          <h2>Purchase Request Sent!</h2>
          <p>Your request for <strong>${title}</strong> (${price}) has been sent to the seller.</p>
          <p>You'll be notified when the seller confirms.</p>
          <a href="https://kosei0615.github.io/DormGlide/app.html"
             style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;
                    text-decoration:none;display:inline-block;margin-top:16px">
            View on DormGlide
          </a>
          <p style="margin-top:24px;color:#6b7280;font-size:12px">
            Safety tip: Always meet in a public campus location to exchange items.
          </p>
        `
      })
    }
  }

  if (event === 'purchase_confirmed') {
    // Notify buyer
    if (buyer?.user?.email) {
      emails.push({
        to: buyer.user.email,
        subject: `DormGlide: Purchase confirmed for "${title}"!`,
        html: `
          <h2>Your purchase is confirmed!</h2>
          <p>The seller has confirmed the sale of <strong>${title}</strong> (${price}).</p>
          <p>Coordinate with the seller to arrange pickup.</p>
          <p style="margin-top:16px"><strong>Safety Tips:</strong></p>
          <ul>
            <li>Meet in a public campus location (library, student union)</li>
            <li>Bring a friend if possible</li>
            <li>Inspect the item before handing over payment</li>
          </ul>
          <a href="https://kosei0615.github.io/DormGlide/app.html"
             style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;
                    text-decoration:none;display:inline-block;margin-top:16px">
            View on DormGlide
          </a>
        `
      })
    }
    // Notify seller
    if (seller?.user?.email || listing?.seller_email) {
      emails.push({
        to: seller?.user?.email || listing?.seller_email,
        subject: `DormGlide: Sale confirmed for "${title}"`,
        html: `
          <h2>Sale confirmed!</h2>
          <p>You confirmed the sale of <strong>${title}</strong> (${price}).</p>
          <p>Coordinate with the buyer to arrange pickup. 
             The item has been marked as sold on DormGlide.</p>
        `
      })
    }
  }

  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY secret', queued: emails.length }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Send all emails directly through Resend
  let sent = 0
  const errors: string[] = []
  for (const email of emails) {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [email.to],
        subject: email.subject,
        html: email.html
      })
    })

    if (resp.ok) {
      sent += 1
      continue
    }

    const errorBody = await resp.text().catch(() => '')
    errors.push(`to=${email.to} status=${resp.status} body=${errorBody}`)
  }

  return new Response(JSON.stringify({ queued: emails.length, sent, failed: errors.length, errors }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
