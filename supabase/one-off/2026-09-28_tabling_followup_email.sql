-- One-off: tabling follow-up email to everyone who signed up at the 2026-09-27
-- event and has confirmed their email (34 people at time of writing).
-- Sends from noreply@dormglide.com via Resend using the key already in Vault.
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> paste -> Run.
-- The final SELECT tells you how many were queued. Run it ONCE.
-- Delivery check ~1 min later:
--   select status_code, count(*) from net._http_response
--   where created > now() - interval '10 minutes' group by 1;   -- 200 = accepted

do $$
declare
  v_key text;
  r record;
  n int := 0;
  v_html text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name='resend_api_key' limit 1;
  if v_key is null then raise exception 'no resend key'; end if;

  v_html :=
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937">' ||
    '<h2 style="color:#2563eb;margin:0 0 16px">You signed up for DormGlide. Here''s the 60-second next step.</h2>' ||
    '<p>Hi,</p>' ||
    '<p>Thanks for stopping by our table this weekend. You''re one of 43 Denison students who joined DormGlide in a single afternoon, so the market is real now.</p>' ||
    '<p>The fastest way to get value out of it: <strong>post one thing you''d sell before winter break.</strong> A mini fridge, a lamp, a textbook from a class you''re done with. It takes about a minute, and someone on campus is probably already looking for it.</p>' ||
    '<p>If you''d rather buy, set a <strong>Wishlist alert</strong> for what you need and we''ll email you the moment a match appears.</p>' ||
    '<div style="background:#eff6ff;border:1px solid #bfdbfe;padding:14px 16px;border-radius:10px;margin:18px 0">' ||
    '<p style="margin:0 0 6px"><strong>Two rules that keep it safe:</strong></p>' ||
    '<p style="margin:0">Only Denison students can see or message you.<br>Pay at pickup, after you''ve seen the item, never before.</p>' ||
    '</div>' ||
    '<a href="https://dormglide.com/app.html?auth=login" style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:50px;text-decoration:none;display:inline-block;margin-top:6px;font-weight:bold">Post your first item</a>' ||
    '<p style="margin-top:24px">Questions? Open the app and use the Messages tab, or find us at the next tabling event.</p>' ||
    '<p>Kosei and the DormGlide team</p>' ||
    '<p style="color:#9ca3af;font-size:12px;margin-top:24px">You''re receiving this because you signed up for DormGlide with this address.</p>' ||
    '</div>';

  for r in
    select u.email from auth.users u
    where u.email_confirmed_at is not null
      and u.created_at > timestamp '2026-09-27 00:00:00+00'
      and u.email is not null
    order by u.created_at
  loop
    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', 'DormGlide <noreply@dormglide.com>',
        'to', r.email,
        'subject', 'You signed up for DormGlide. Here''s the 60-second next step',
        'html', v_html
      )
    );
    n := n + 1;
  end loop;
  raise notice 'queued % emails', n;
end $$;

select count(*) as recipients_queued
from auth.users
where email_confirmed_at is not null
  and created_at > timestamp '2026-09-27 00:00:00+00'
  and email is not null;
