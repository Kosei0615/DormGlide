-- DormGlide: email notifications for wishlist matches (via Resend + pg_net)
-- Run AFTER 06_wishlist_matching.sql. Idempotent.
--
-- When a new listing matches someone's wishlist alert, they already get an
-- in-app notification (06). This adds an email — sent straight from the
-- database via pg_net to Resend — throttled to at most ONE wishlist email
-- per user per 24 hours so it never feels like spam.
--
-- SETUP (one time, after running this file):
--   Store your Resend API key in Supabase Vault by running:
--     select vault.create_secret('re_YOUR_RESEND_API_KEY', 'resend_api_key');
--   (Same key you used for SMTP. Until the secret exists, emails are simply
--   skipped — in-app notifications keep working.)

create extension if not exists pg_net;

-- Throttle bookkeeping: when did we last email each user about a match?
create table if not exists public.wishlist_email_log (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_sent_at timestamptz not null default now()
);

-- Server-side only: RLS enabled with no policies = clients can't touch it.
alter table public.wishlist_email_log enable row level security;

-- Supersedes the 06 version: same in-app matching, plus the email step.
create or replace function public.create_keyword_notifications_for_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  search_text text;
  v_api_key text;
  v_rec record;
  v_safe_title text;
begin
  search_text := lower(coalesce(new.title, '') || ' ' || coalesce(new.description, ''));

  -- ------------------------------------------------------------------
  -- 1) In-app notifications (unchanged from 06)
  -- ------------------------------------------------------------------
  insert into public.notifications (user_id, message, listing_id, is_read)
  select
    alerts.user_id,
    format(
      'A new listing matches your wishlist%s: %s - $%s',
      case
        when length(trim(coalesce(alerts.keyword, ''))) > 0 then format(' ("%s")', alerts.keyword)
        else format(' (%s)', alerts.category)
      end,
      coalesce(new.title, 'New listing'),
      coalesce(new.price::text, '0')
    ),
    new.id,
    false
  from public.keyword_alerts as alerts
  join public.profiles as alert_owner on alert_owner.id = alerts.user_id
  where
    (
      (length(trim(coalesce(alerts.keyword, ''))) > 0
        and position(lower(alerts.keyword) in search_text) > 0)
      or
      (alerts.category is not null
        and lower(alerts.category) = lower(coalesce(new.category, '')))
    )
    and (alerts.max_price is null or coalesce(new.price, 0) <= alerts.max_price)
    and alerts.notify_in_app is true
    and alerts.user_id is distinct from new.seller_id
    and alert_owner.school_id = new.school_id
    and new.school_id is not null
    and not exists (
      select 1 from public.notifications n
      where n.user_id = alerts.user_id and n.listing_id = new.id
    );

  -- ------------------------------------------------------------------
  -- 2) Email notifications (new). Failures here must never block the
  --    listing insert, so everything is wrapped defensively.
  -- ------------------------------------------------------------------
  begin
    select decrypted_secret into v_api_key
    from vault.decrypted_secrets
    where name = 'resend_api_key'
    limit 1;
  exception when others then
    v_api_key := null;
  end;

  if v_api_key is null or new.school_id is null then
    return new; -- no key configured yet: in-app only
  end if;

  v_safe_title := replace(replace(coalesce(new.title, 'New listing'), '<', '&lt;'), '>', '&gt;');

  for v_rec in
    select distinct on (alerts.user_id)
      alerts.user_id,
      u.email,
      coalesce(nullif(trim(alerts.keyword), ''), alerts.category, 'your wishlist') as matched_label
    from public.keyword_alerts alerts
    join public.profiles alert_owner on alert_owner.id = alerts.user_id
    join auth.users u on u.id = alerts.user_id
    left join public.wishlist_email_log log on log.user_id = alerts.user_id
    where alerts.notify_email is true
      and (
        (length(trim(coalesce(alerts.keyword, ''))) > 0
          and position(lower(alerts.keyword) in search_text) > 0)
        or
        (alerts.category is not null
          and lower(alerts.category) = lower(coalesce(new.category, '')))
      )
      and (alerts.max_price is null or coalesce(new.price, 0) <= alerts.max_price)
      and alerts.user_id is distinct from new.seller_id
      and alert_owner.school_id = new.school_id
      and u.email is not null
      -- throttle: at most one wishlist email per user per 24h
      and (log.user_id is null or log.last_sent_at < now() - interval '24 hours')
  loop
    begin
      perform net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || v_api_key,
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'from', 'DormGlide <noreply@dormglide.com>',
          'to', v_rec.email,
          'subject', format('DormGlide: "%s" matches your wishlist — $%s',
                            coalesce(new.title, 'New listing'),
                            coalesce(new.price::text, '0')),
          'html', format(
            '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">' ||
            '<h2 style="color:#2563eb;margin:0 0 12px">Your wishlist has a match!</h2>' ||
            '<p style="color:#374151">A new listing matches <strong>%s</strong>:</p>' ||
            '<div style="background:#eff6ff;border:1px solid #bfdbfe;padding:16px;border-radius:10px;margin:16px 0">' ||
            '<h3 style="margin:0 0 6px;color:#1f2937">%s</h3>' ||
            '<p style="margin:0;color:#6b7280">%s &middot; <strong style="color:#2563eb">$%s</strong></p>' ||
            '</div>' ||
            '<p style="color:#374151">Good items go fast — open DormGlide to message the seller.</p>' ||
            '<a href="https://dormglide.com/app.html" style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:50px;text-decoration:none;display:inline-block;margin-top:12px;font-weight:bold">Open DormGlide</a>' ||
            '<p style="color:#9ca3af;font-size:12px;margin-top:24px">You get at most one match email per day. Manage alerts on your Wishlist page.</p>' ||
            '</div>',
            v_rec.matched_label,
            v_safe_title,
            coalesce(new.category, 'Listing'),
            coalesce(new.price::text, '0')
          )
        )
      );

      insert into public.wishlist_email_log (user_id, last_sent_at)
      values (v_rec.user_id, now())
      on conflict (user_id) do update set last_sent_at = now();
    exception when others then
      raise notice '[DormGlide] wishlist email failed for user %: %', v_rec.user_id, sqlerrm;
    end;
  end loop;

  return new;
end;
$$;

-- (Trigger trg_products_keyword_notifications already points at this function.)

-- VERIFY after setup:
-- 1) select vault.create_secret('re_...', 'resend_api_key');   -- one time
-- 2) Post a matching listing from a second account.
-- 3) Delivery status: select status, created from net._http_response
--    order by created desc limit 5;   -- 200 = Resend accepted it
-- 4) Throttle check: post a second matching listing right away -> in-app
--    notification arrives, but no second email.
