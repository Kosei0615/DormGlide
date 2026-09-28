-- One-off #2: finish the tabling follow-up for the 25 recipients that Resend
-- rejected with 429 (rate limit) on the first run. Requires migration 20.
--
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> paste -> Run ONCE.
-- It loads the 25 pending recipients into email_outbox and starts a cron job
-- that sends 8 per minute, then stops itself (~4 minutes total).
--
-- The 10 who already received it are excluded: they were queue positions
-- 1,2,3,4,7,8,9,13,15,17 in sign-up order of the 35-person batch, matched to
-- the pg_net responses with status 200 (request ids 5..39 <-> positions 1..35).
--
-- PROGRESS CHECK (run any time after):
--   select status, count(*) from public.email_outbox group by 1;
--   -- all 'sent' = done. 'failed' rows show last_error.

with ordered as (
  select u.email, row_number() over (order by u.created_at) as rn
  from auth.users u
  where u.email_confirmed_at is not null
    and u.email_confirmed_at <= timestamp '2026-09-28 16:53:34+00'
    and u.created_at > timestamp '2026-09-27 00:00:00+00'
    and u.email is not null
)
insert into public.email_outbox (to_email, subject, html)
select
  email,
  'You signed up for DormGlide. Here''s the 60-second next step',
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
  '</div>'
from ordered
where rn not in (1,2,3,4,7,8,9,13,15,17)
  and not exists (select 1 from public.email_outbox o where o.to_email = ordered.email);

-- Start the paced sender (8/minute, self-stops when the outbox is empty).
select cron.schedule('dormglide-email-outbox', '* * * * *', $$select public.send_email_outbox_batch(8)$$);

select count(*) as pending_loaded from public.email_outbox where status = 'pending';
