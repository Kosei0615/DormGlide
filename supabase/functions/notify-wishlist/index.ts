import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { userId, listingId, matchedKeyword } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: userData } = await supabase.auth.admin.getUserById(userId)
    const userEmail = userData?.user?.email
    if (!userEmail) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 })
    }

    const { data: listing } = await supabase
      .from('products')
      .select('title, price, category, description, id')
      .eq('id', listingId)
      .single()

    const title = listing?.title || 'New Item'
    const price = listing?.price ? `$${listing.price}` : 'Price not set'
    const category = listing?.category || ''

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'DormGlide <onboarding@resend.dev>',
        to: userEmail,
        subject: `DormGlide: New match for your wishlist - "${title}"`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#7c3aed">Wishlist Match Found</h2>
            <p>A new listing matches your wishlist keyword <strong>"${matchedKeyword}"</strong>:</p>
            <div style="background:#f5f3ff;border:1px solid #ddd6fe;padding:16px;border-radius:10px;margin:16px 0">
              <h3 style="margin:0 0 8px;color:#1f2937">${title}</h3>
              <p style="margin:0;color:#6b7280">${category} - <strong style="color:#4f46e5">${price}</strong></p>
            </div>
            <p>Popular items sell fast on DormGlide.</p>
            <a href="https://kosei0615.github.io/DormGlide/app.html" style="background:#7c3aed;color:#fff;padding:12px 28px;border-radius:50px;text-decoration:none;display:inline-block;margin-top:16px;font-weight:bold">
              View Listing
            </a>
            <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb">
            <p style="color:#9ca3af;font-size:12px">
              You received this because you added "${matchedKeyword}" to your DormGlide wishlist.
              <a href="https://kosei0615.github.io/DormGlide/app.html" style="color:#7c3aed">Manage your wishlist</a>
            </p>
          </div>
        `
      })
    })

    const result = await res.json()
    return new Response(JSON.stringify({ success: true, result }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('[notify-wishlist] Error:', err)
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
