-- 20: Paced email outbox (Resend allows 10 requests/second; pg_net fires a
-- whole queue at once, so a 35-recipient blast got 25 x 429).
-- Idempotent. Infra only — nothing is sent until rows are inserted and the
-- cron job is scheduled (see supabase/one-off/*).
--
-- Usage:
--   insert into public.email_outbox (to_email, subject, html) values (...);
--   select cron.schedule('dormglide-email-outbox', '* * * * *',
--          $$select public.send_email_outbox_batch(8)$$);
-- The job sends up to 8 pending rows per minute, reconciles results from
-- net._http_response (retrying failures up to 3x), and unschedules itself
-- when the outbox is empty.

create table if not exists public.email_outbox (
  id bigserial primary key,
  to_email text not null,
  subject text not null,
  html text not null,
  status text not null default 'pending' check (status in ('pending','queued','sent','failed')),
  attempts int not null default 0,
  request_id bigint null,
  resend_id text null,
  last_error text null,
  created_at timestamptz not null default now(),
  sent_at timestamptz null
);
alter table public.email_outbox enable row level security; -- server-only, no policies
create index if not exists email_outbox_status_idx on public.email_outbox(status, id);

create or replace function public.send_email_outbox_batch(p_limit int default 8)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  r record;
  v_req bigint;
  n int := 0;
begin
  -- 1) Reconcile previously queued rows against pg_net responses.
  update public.email_outbox o
  set status = case when resp.status_code = 200 then 'sent'
                    when o.attempts >= 3 then 'failed'
                    else 'pending' end,
      sent_at = case when resp.status_code = 200 then now() else o.sent_at end,
      resend_id = case when resp.status_code = 200 then (resp.content::jsonb)->>'id' else o.resend_id end,
      last_error = case when resp.status_code <> 200 then left(resp.content, 300) else null end,
      request_id = case when resp.status_code = 200 then o.request_id else null end
  from net._http_response resp
  where o.status = 'queued' and resp.id = o.request_id;

  -- 2) Send the next batch.
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if v_key is null then
    raise notice '[DormGlide] outbox: no resend key';
    return 0;
  end if;

  for r in
    select * from public.email_outbox where status = 'pending' order by id limit p_limit
  loop
    v_req := net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', 'DormGlide <noreply@dormglide.com>',
        'to', r.to_email,
        'subject', r.subject,
        'html', r.html
      )
    );
    update public.email_outbox
    set status = 'queued', attempts = attempts + 1, request_id = v_req
    where id = r.id;
    n := n + 1;
  end loop;

  -- 3) Nothing left? Stop the cron job so it doesn't run forever.
  if not exists (select 1 from public.email_outbox where status in ('pending','queued')) then
    begin
      perform cron.unschedule('dormglide-email-outbox');
    exception when others then null; -- not scheduled
    end;
  end if;

  return n;
end;
$$;

revoke all on function public.send_email_outbox_batch(int) from public, anon, authenticated;
