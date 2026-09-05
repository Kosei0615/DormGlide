-- DormGlide: reserve-for-later listings ("Reserve now, pick up later")
-- Run AFTER 10_onboarding.sql. Idempotent.
--
-- A reserve listing is a normal listing with a future handoff date; a
-- reservation is a normal purchase request on it — the existing deal flow
-- carries it. This migration adds the date, reminder bookkeeping, and a
-- daily pg_cron job that reminds both parties as handoff day approaches.

-- 1) Columns
alter table public.products
add column if not exists available_from date null;

do $$
begin
  if to_regclass('public.listings') is not null then
    execute 'alter table public.listings add column if not exists available_from date null';
  end if;
end
$$;

alter table public.purchase_requests
add column if not exists reminder_3d_sent_at timestamptz null,
add column if not exists reminder_day_sent_at timestamptz null;

create index if not exists products_available_from_idx
  on public.products (available_from) where available_from is not null;

-- 2) Reminder job: in-app notifications + email to BOTH parties at
--    T-3 days and on handoff day, for active reservations only.
create or replace function public.send_handoff_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_api_key text;
  v_msg text;
begin
  begin
    select decrypted_secret into v_api_key
    from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  exception when others then
    v_api_key := null;
  end;

  for rec in
    select pr.id as request_id, pr.buyer_id, pr.seller_id,
           pr.reminder_3d_sent_at, pr.reminder_day_sent_at,
           p.id as listing_id, p.title, p.available_from,
           (p.available_from = current_date) as is_day_of,
           bu.email as buyer_email, se.email as seller_email
    from public.purchase_requests pr
    join public.products p on p.id = pr.listing_id
    left join auth.users bu on bu.id = pr.buyer_id
    left join auth.users se on se.id = pr.seller_id
    where p.available_from is not null
      and pr.status in ('accepted', 'meetup_arranged')
      and (
        (p.available_from = current_date and pr.reminder_day_sent_at is null)
        or
        (p.available_from > current_date
          and p.available_from - current_date <= 3
          and pr.reminder_3d_sent_at is null)
      )
  loop
    if rec.is_day_of then
      v_msg := format('It''s handoff day for "%s"! Confirm your meetup and mark the deal complete after the exchange.', rec.title);
    else
      v_msg := format('Handoff for "%s" is coming up on %s — confirm your meetup spot in the app.',
                      rec.title, to_char(rec.available_from, 'Mon DD'));
    end if;

    -- In-app notifications for both parties
    insert into public.notifications (user_id, message, listing_id, is_read)
    values (rec.buyer_id, v_msg, rec.listing_id, false),
           (rec.seller_id, v_msg, rec.listing_id, false);

    -- Email both parties (transactional reminder; separate from the
    -- wishlist marketing throttle). Failures never abort the loop.
    if v_api_key is not null then
      begin
        if rec.buyer_email is not null then
          perform net.http_post(
            url := 'https://api.resend.com/emails',
            headers := jsonb_build_object('Authorization', 'Bearer ' || v_api_key, 'Content-Type', 'application/json'),
            body := jsonb_build_object(
              'from', 'DormGlide <noreply@dormglide.com>',
              'to', rec.buyer_email,
              'subject', format('DormGlide reminder: "%s" handoff %s', rec.title,
                                case when rec.is_day_of then 'is today' else 'on ' || to_char(rec.available_from, 'Mon DD') end),
              'html', format('<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px"><h2 style="color:#2563eb">%s</h2><p style="color:#374151">%s</p><p style="color:#6b7280;font-size:13px">Remember: pay only at handoff, after seeing the item.</p><a href="https://dormglide.com/app.html" style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:50px;text-decoration:none;display:inline-block;font-weight:bold">Open DormGlide</a></div>',
                             case when rec.is_day_of then 'Handoff day!' else 'Handoff coming up' end, v_msg)
            )
          );
        end if;
        if rec.seller_email is not null then
          perform net.http_post(
            url := 'https://api.resend.com/emails',
            headers := jsonb_build_object('Authorization', 'Bearer ' || v_api_key, 'Content-Type', 'application/json'),
            body := jsonb_build_object(
              'from', 'DormGlide <noreply@dormglide.com>',
              'to', rec.seller_email,
              'subject', format('DormGlide reminder: "%s" handoff %s', rec.title,
                                case when rec.is_day_of then 'is today' else 'on ' || to_char(rec.available_from, 'Mon DD') end),
              'html', format('<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px"><h2 style="color:#2563eb">%s</h2><p style="color:#374151">%s</p><a href="https://dormglide.com/app.html" style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:50px;text-decoration:none;display:inline-block;font-weight:bold">Open DormGlide</a></div>',
                             case when rec.is_day_of then 'Handoff day!' else 'Handoff coming up' end, v_msg)
            )
          );
        end if;
      exception when others then
        raise notice '[DormGlide] handoff reminder email failed for request %: %', rec.request_id, sqlerrm;
      end;
    end if;

    if rec.is_day_of then
      update public.purchase_requests set reminder_day_sent_at = now() where id = rec.request_id;
    else
      update public.purchase_requests set reminder_3d_sent_at = now() where id = rec.request_id;
    end if;
  end loop;
end;
$$;

-- 3) Schedule daily at 15:00 UTC (~10-11am US Eastern).
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('dormglide-handoff-reminders');
exception when others then
  null; -- job did not exist yet
end
$$;

select cron.schedule(
  'dormglide-handoff-reminders',
  '0 15 * * *',
  $$select public.send_handoff_reminders()$$
);
