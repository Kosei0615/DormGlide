-- 22: Campus Delivery (Glyde). Idempotent.
--
-- A student courier ("provider") takes delivery orders from other students on
-- the same campus: the customer has already ordered/paid the vendor, the
-- courier picks it up and brings it for a flat fee paid in person.
--
-- Pieces:
--   delivery_providers     one row per courier: online toggle, weekly hours,
--                          preorder lead time, fee, pickup spots
--   delivery_orders        the orders, with a status machine guarded by trigger
--   delivery_order_tokens  server-only secrets behind the Accept/Decline email
--                          links (no policies = clients can never read them)
--   delivery_decide(token, action)  the ONE anon-callable function: lets the
--                          courier accept/decline from Gmail without logging in.
--                          The token is a random uuid, single-use, and only
--                          works while the order is pending (<= confirm window).
--   expire_delivery_orders() + cron every minute: unanswered orders expire.
--   notify_delivery_event  bell + email for both sides (Resend via pg_net).

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Shared email helper (Resend key from Vault). Never raises.
-- ---------------------------------------------------------------------------
create or replace function public.send_email(p_to text, p_subject text, p_html text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_key text;
begin
  if p_to is null then return; end if;
  begin
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  exception when others then v_key := null; end;
  if v_key is null then return; end if;
  begin
    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object('from', 'DormGlide <noreply@dormglide.com>', 'to', p_to, 'subject', p_subject, 'html', p_html)
    );
  exception when others then
    raise notice '[DormGlide] send_email failed: %', sqlerrm;
  end;
end;
$$;
revoke all on function public.send_email(text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1) Providers
-- ---------------------------------------------------------------------------
create table if not exists public.delivery_providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id),
  display_name text not null default 'Campus Delivery',
  blurb text null,
  is_active boolean not null default true,
  is_online boolean not null default false,
  fee_cents integer not null default 300 check (fee_cents between 0 and 5000),
  schedule jsonb not null default '[]'::jsonb,          -- [{"dow":1,"start":"11:00","end":"20:00"}], dow 0=Sunday, campus local time
  preorder_minutes integer not null default 60 check (preorder_minutes between 0 and 240),
  confirm_minutes integer not null default 10 check (confirm_minutes between 2 and 60),
  pickup_spots jsonb not null default '["Slayter", "Curtis", "Huffman"]'::jsonb,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- school follows the courier's profile, and identity columns are frozen
create or replace function public.delivery_provider_protect()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.school_id := (select school_id from public.profiles where id = new.user_id);
    if new.school_id is null then raise exception 'Provider must have a campus profile'; end if;
  else
    new.user_id := old.user_id;
    new.school_id := old.school_id;
    if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
      new.is_active := old.is_active;   -- only admins switch providers on/off the platform
    end if;
  end if;
  new.updated_at := now();
  return new;
end; $$;
revoke all on function public.delivery_provider_protect() from public, anon, authenticated;
drop trigger if exists trg_delivery_provider_protect on public.delivery_providers;
create trigger trg_delivery_provider_protect
before insert or update on public.delivery_providers
for each row execute function public.delivery_provider_protect();

alter table public.delivery_providers enable row level security;
drop policy if exists "delivery_providers_select_campus" on public.delivery_providers;
create policy "delivery_providers_select_campus" on public.delivery_providers for select to authenticated
using (school_id = public.current_school_id());
drop policy if exists "delivery_providers_insert_admin" on public.delivery_providers;
create policy "delivery_providers_insert_admin" on public.delivery_providers for insert to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
drop policy if exists "delivery_providers_update_own_or_admin" on public.delivery_providers;
create policy "delivery_providers_update_own_or_admin" on public.delivery_providers for update to authenticated
using (user_id = auth.uid() or exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (user_id = auth.uid() or exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 2) Orders
-- ---------------------------------------------------------------------------
create table if not exists public.delivery_orders (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.delivery_providers(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id),
  status text not null default 'pending',
  pickup_spot text not null,
  order_ref text null,
  items text not null,
  deliver_to text not null,
  notes text null,
  requested_for timestamptz null,          -- null = as soon as possible
  fee_cents integer not null default 0,
  expires_at timestamptz null,
  decided_at timestamptz null,
  picked_up_at timestamptz null,
  delivered_at timestamptz null,
  cancelled_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.delivery_orders drop constraint if exists delivery_orders_status_check;
alter table public.delivery_orders add constraint delivery_orders_status_check
check (status in ('pending','accepted','declined','expired','cancelled','picked_up','on_the_way','delivered'));
create index if not exists delivery_orders_provider_status_idx on public.delivery_orders (provider_id, status, created_at desc);
create index if not exists delivery_orders_customer_idx on public.delivery_orders (customer_id, created_at desc);
create index if not exists delivery_orders_pending_expiry_idx on public.delivery_orders (expires_at) where status = 'pending';

create table if not exists public.delivery_order_tokens (
  order_id uuid primary key references public.delivery_orders(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  used_at timestamptz null
);
alter table public.delivery_order_tokens enable row level security;   -- no policies: server-only

-- Insert guard: server decides fee, status, expiry; checks the courier is taking orders.
create or replace function public.delivery_order_prepare()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.delivery_providers%rowtype;
begin
  select * into p from public.delivery_providers where id = new.provider_id;
  if p.id is null or not p.is_active then raise exception 'This courier is not taking orders right now'; end if;
  if p.user_id = new.customer_id then raise exception 'You cannot order a delivery from yourself'; end if;
  if not p.is_online and new.requested_for is null then
    raise exception 'The courier is offline right now. Choose a preorder time instead.';
  end if;
  if new.requested_for is not null and new.requested_for < now() - interval '5 minutes' then
    raise exception 'That delivery time is in the past';
  end if;
  new.school_id := p.school_id;
  new.status := 'pending';
  new.fee_cents := p.fee_cents;
  new.expires_at := now() + make_interval(mins => p.confirm_minutes);
  new.decided_at := null; new.picked_up_at := null; new.delivered_at := null; new.cancelled_by := null;
  new.pickup_spot := left(trim(new.pickup_spot), 80);
  new.items := left(trim(new.items), 300);
  new.deliver_to := left(trim(new.deliver_to), 160);
  new.order_ref := nullif(left(trim(coalesce(new.order_ref, '')), 60), '');
  new.notes := nullif(left(trim(coalesce(new.notes, '')), 300), '');
  if new.items = '' or new.deliver_to = '' or new.pickup_spot = '' then raise exception 'Pickup spot, items and delivery location are required'; end if;
  return new;
end; $$;
revoke all on function public.delivery_order_prepare() from public, anon, authenticated;
drop trigger if exists trg_delivery_order_prepare on public.delivery_orders;
create trigger trg_delivery_order_prepare
before insert on public.delivery_orders
for each row execute function public.delivery_order_prepare();

-- Update guard: only status moves along the allowed edges, by the right actor.
-- actor null = server side (delivery_decide / expiry cron).
create or replace function public.delivery_order_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
  is_customer boolean;
  is_courier boolean;
  ok boolean := false;
begin
  -- nothing but status (and notes by the customer while pending) may change from the client
  new.provider_id := old.provider_id; new.customer_id := old.customer_id; new.school_id := old.school_id;
  new.pickup_spot := old.pickup_spot; new.items := old.items; new.deliver_to := old.deliver_to;
  new.order_ref := old.order_ref; new.requested_for := old.requested_for; new.fee_cents := old.fee_cents;
  new.expires_at := old.expires_at; new.created_at := old.created_at;
  new.decided_at := old.decided_at; new.picked_up_at := old.picked_up_at; new.delivered_at := old.delivered_at;
  new.cancelled_by := old.cancelled_by;
  if new.status = old.status then
    if actor is not null and actor <> old.customer_id then new.notes := old.notes; end if;
    new.updated_at := now();
    return new;
  end if;

  is_customer := actor is not null and actor = old.customer_id;
  is_courier := actor is not null and exists (select 1 from public.delivery_providers p where p.id = old.provider_id and p.user_id = actor);

  if actor is null then
    ok := (old.status = 'pending' and new.status in ('accepted','declined','expired'));
  elsif is_courier then
    ok := (old.status = 'pending' and new.status in ('accepted','declined'))
       or (old.status = 'accepted' and new.status in ('picked_up','cancelled'))
       or (old.status = 'picked_up' and new.status in ('on_the_way','delivered'))
       or (old.status = 'on_the_way' and new.status = 'delivered');
  elsif is_customer then
    ok := (old.status in ('pending','accepted') and new.status = 'cancelled');
  end if;
  if not ok then raise exception 'Cannot move a delivery order from % to %', old.status, new.status; end if;

  if new.status in ('accepted','declined','expired') then new.decided_at := now(); end if;
  if new.status = 'picked_up' then new.picked_up_at := now(); end if;
  if new.status = 'delivered' then new.delivered_at := now(); if new.picked_up_at is null then new.picked_up_at := now(); end if; end if;
  if new.status = 'cancelled' then new.cancelled_by := actor; end if;
  new.updated_at := now();
  return new;
end; $$;
revoke all on function public.delivery_order_guard() from public, anon, authenticated;
drop trigger if exists trg_delivery_order_guard on public.delivery_orders;
create trigger trg_delivery_order_guard
before update on public.delivery_orders
for each row execute function public.delivery_order_guard();

alter table public.delivery_orders enable row level security;
drop policy if exists "delivery_orders_select_parties" on public.delivery_orders;
create policy "delivery_orders_select_parties" on public.delivery_orders for select to authenticated
using (customer_id = auth.uid() or exists (select 1 from public.delivery_providers p where p.id = provider_id and p.user_id = auth.uid()));
drop policy if exists "delivery_orders_insert_customer" on public.delivery_orders;
create policy "delivery_orders_insert_customer" on public.delivery_orders for insert to authenticated
with check (customer_id = auth.uid()
  and exists (select 1 from public.delivery_providers p where p.id = provider_id and p.school_id = public.current_school_id()));
drop policy if exists "delivery_orders_update_parties" on public.delivery_orders;
create policy "delivery_orders_update_parties" on public.delivery_orders for update to authenticated
using (customer_id = auth.uid() or exists (select 1 from public.delivery_providers p where p.id = provider_id and p.user_id = auth.uid()))
with check (customer_id = auth.uid() or exists (select 1 from public.delivery_providers p where p.id = provider_id and p.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 3) Notifications + emails
-- ---------------------------------------------------------------------------
create or replace function public.notify_delivery_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.delivery_providers%rowtype;
  v_token uuid;
  v_customer_email text;
  v_courier_email text;
  v_customer_name text;
  v_when text;
  v_summary text;
  v_fee text;
  v_base text := 'https://dormglide.com';
begin
  select * into p from public.delivery_providers where id = new.provider_id;
  select u.email into v_courier_email from auth.users u where u.id = p.user_id;
  select u.email into v_customer_email from auth.users u where u.id = new.customer_id;
  select coalesce(nullif(trim(name), ''), 'A student') into v_customer_name from public.profiles where id = new.customer_id;
  v_when := case when new.requested_for is null then 'as soon as possible'
                 else 'at ' || to_char(new.requested_for at time zone p.timezone, 'FMDy FMHH12:MI am') end;
  v_summary := new.items || ' from ' || new.pickup_spot || ' → ' || new.deliver_to || ' (' || v_when || ')';
  v_fee := '$' || to_char(new.fee_cents / 100.0, 'FM999990.00');

  if tg_op = 'INSERT' then
    insert into public.delivery_order_tokens (order_id) values (new.id) returning token into v_token;

    insert into public.notifications (user_id, message, listing_id, is_read)
    values (p.user_id, format('Delivery: new order — %s. Accept within %s min.', v_summary, p.confirm_minutes), null, false);
    insert into public.notifications (user_id, message, listing_id, is_read)
    values (new.customer_id, format('Delivery: order sent to %s. Waiting for them to accept (up to %s min).', p.display_name, p.confirm_minutes), null, false);

    perform public.send_email(v_courier_email,
      format('New delivery order: %s', left(new.items, 60)),
      format('<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937">'
          || '<h2 style="color:#ea580c;margin:0 0 12px">🛼 New delivery order</h2>'
          || '<p><strong>%s</strong> wants:</p>'
          || '<div style="background:#fff7ed;border:1px solid #fed7aa;padding:14px 16px;border-radius:10px;margin:12px 0">'
          || '<p style="margin:0 0 6px"><strong>Pick up:</strong> %s%s</p>'
          || '<p style="margin:0 0 6px"><strong>Items:</strong> %s</p>'
          || '<p style="margin:0 0 6px"><strong>Deliver to:</strong> %s</p>'
          || '<p style="margin:0 0 6px"><strong>When:</strong> %s</p>'
          || '<p style="margin:0"><strong>Your fee:</strong> %s, paid in person%s</p></div>'
          || '<p>You have <strong>%s minutes</strong> to answer, or the order expires automatically.</p>'
          || '<p style="margin:18px 0"><a href="%s/d/?t=%s&a=accept" style="background:#16a34a;color:#fff;padding:12px 26px;border-radius:50px;text-decoration:none;font-weight:bold;margin-right:10px">Accept</a>'
          || '<a href="%s/d/?t=%s&a=decline" style="background:#dc2626;color:#fff;padding:12px 26px;border-radius:50px;text-decoration:none;font-weight:bold">Decline</a></p>'
          || '<p style="color:#6b7280;font-size:12px">These buttons work without logging in and can be used once. You can also manage orders at dormglide.com → Campus Delivery.</p></div>',
          replace(v_customer_name, '<', '&lt;'), replace(new.pickup_spot, '<', '&lt;'),
          case when new.order_ref is not null then ' (order #' || replace(new.order_ref, '<', '&lt;') || ')' else '' end,
          replace(new.items, '<', '&lt;'), replace(new.deliver_to, '<', '&lt;'), v_when, v_fee,
          case when new.notes is not null then '. Note: ' || replace(new.notes, '<', '&lt;') else '' end,
          p.confirm_minutes, v_base, v_token, v_base, v_token));

    perform public.send_email(v_customer_email,
      format('Delivery order sent to %s', p.display_name),
      format('<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937">'
          || '<h2 style="color:#2563eb;margin:0 0 12px">Order sent</h2>'
          || '<p>%s has %s minutes to accept. We will email you either way.</p>'
          || '<div style="background:#eff6ff;border:1px solid #bfdbfe;padding:14px 16px;border-radius:10px;margin:12px 0">%s<br>Fee: <strong>%s</strong>, paid to the courier in person at delivery.</div>'
          || '<a href="%s/app.html" style="background:#2563eb;color:#fff;padding:12px 26px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">Track in DormGlide</a></div>',
          replace(p.display_name, '<', '&lt;'), p.confirm_minutes, replace(v_summary, '<', '&lt;'), v_fee, v_base));
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'accepted' then
      insert into public.notifications (user_id, message, listing_id, is_read) values (new.customer_id, format('Delivery: %s accepted your order. %s', p.display_name, v_summary), null, false);
      perform public.send_email(v_customer_email, format('%s accepted your delivery', p.display_name),
        format('<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937"><h2 style="color:#16a34a;margin:0 0 12px">Accepted ✓</h2><p>%s is on it: %s.</p><p>Have <strong>%s</strong> ready to pay in person at delivery. You will get another email when it is picked up and on the way.</p><a href="%s/app.html" style="background:#2563eb;color:#fff;padding:12px 26px;border-radius:50px;text-decoration:none;font-weight:bold;display:inline-block">Track in DormGlide</a></div>',
          replace(p.display_name, '<', '&lt;'), replace(v_summary, '<', '&lt;'), v_fee, v_base));
    elsif new.status = 'declined' then
      insert into public.notifications (user_id, message, listing_id, is_read) values (new.customer_id, format('Delivery: %s could not take your order this time.', p.display_name), null, false);
      perform public.send_email(v_customer_email, 'Your delivery order was declined',
        format('<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937"><h2 style="color:#dc2626;margin:0 0 12px">Not this time</h2><p>%s could not take this order: %s.</p><p>Nothing is owed. Try again later, or when they are back online.</p></div>',
          replace(p.display_name, '<', '&lt;'), replace(v_summary, '<', '&lt;')));
    elsif new.status = 'expired' then
      insert into public.notifications (user_id, message, listing_id, is_read) values (new.customer_id, format('Delivery: %s did not respond in time, so your order expired.', p.display_name), null, false);
      insert into public.notifications (user_id, message, listing_id, is_read) values (p.user_id, format('Delivery: an order expired unanswered — %s', v_summary), null, false);
      perform public.send_email(v_customer_email, 'Your delivery order expired',
        format('<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937"><h2 style="color:#dc2626;margin:0 0 12px">No answer in time</h2><p>%s did not respond within %s minutes, so this order expired: %s.</p><p>Nothing is owed. You can place a new order any time they are online.</p></div>',
          replace(p.display_name, '<', '&lt;'), p.confirm_minutes, replace(v_summary, '<', '&lt;')));
    elsif new.status = 'picked_up' then
      insert into public.notifications (user_id, message, listing_id, is_read) values (new.customer_id, format('Delivery: %s picked up your order.', p.display_name), null, false);
    elsif new.status = 'on_the_way' then
      insert into public.notifications (user_id, message, listing_id, is_read) values (new.customer_id, format('Delivery: %s is on the way to %s. Have %s ready.', p.display_name, new.deliver_to, v_fee), null, false);
      perform public.send_email(v_customer_email, format('%s is on the way', p.display_name),
        format('<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937"><h2 style="color:#2563eb;margin:0 0 12px">On the way 🛼</h2><p>%s is heading to <strong>%s</strong> with your order. Have <strong>%s</strong> ready, paid in person.</p></div>',
          replace(p.display_name, '<', '&lt;'), replace(new.deliver_to, '<', '&lt;'), v_fee));
    elsif new.status = 'delivered' then
      insert into public.notifications (user_id, message, listing_id, is_read) values (new.customer_id, format('Delivery: delivered by %s. Thanks for using Glyde!', p.display_name), null, false);
    elsif new.status = 'cancelled' then
      if new.cancelled_by = new.customer_id then
        insert into public.notifications (user_id, message, listing_id, is_read) values (p.user_id, format('Delivery: %s cancelled their order — %s', v_customer_name, v_summary), null, false);
        perform public.send_email(v_courier_email, 'Delivery order cancelled by the customer',
          format('<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937"><h2 style="color:#dc2626;margin:0 0 12px">Cancelled</h2><p>%s cancelled: %s.</p></div>', replace(v_customer_name, '<', '&lt;'), replace(v_summary, '<', '&lt;')));
      else
        insert into public.notifications (user_id, message, listing_id, is_read) values (new.customer_id, format('Delivery: %s had to cancel your order. Nothing is owed.', p.display_name), null, false);
        perform public.send_email(v_customer_email, 'Your delivery was cancelled',
          format('<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937"><h2 style="color:#dc2626;margin:0 0 12px">Cancelled</h2><p>%s had to cancel: %s. Nothing is owed.</p></div>', replace(p.display_name, '<', '&lt;'), replace(v_summary, '<', '&lt;')));
      end if;
    end if;
  end if;
  return new;
end; $$;
revoke all on function public.notify_delivery_event() from public, anon, authenticated;
drop trigger if exists trg_delivery_order_notify on public.delivery_orders;
create trigger trg_delivery_order_notify
after insert or update on public.delivery_orders
for each row execute function public.notify_delivery_event();

-- ---------------------------------------------------------------------------
-- 4) One-click accept/decline from email (the only anon-callable function)
-- ---------------------------------------------------------------------------
create or replace function public.delivery_decide(p_token uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.delivery_order_tokens%rowtype;
  o public.delivery_orders%rowtype;
  v_action text := lower(coalesce(p_action, ''));
begin
  if v_action not in ('accept','decline') then return jsonb_build_object('result','bad_action'); end if;
  select * into t from public.delivery_order_tokens where token = p_token;
  if t.order_id is null then return jsonb_build_object('result','unknown'); end if;
  select * into o from public.delivery_orders where id = t.order_id;
  if t.used_at is not null or o.status <> 'pending' then
    return jsonb_build_object('result','already', 'status', o.status);
  end if;
  if o.expires_at < now() then
    update public.delivery_orders set status = 'expired' where id = o.id;
    update public.delivery_order_tokens set used_at = now() where order_id = o.id;
    return jsonb_build_object('result','expired');
  end if;
  update public.delivery_orders set status = case when v_action = 'accept' then 'accepted' else 'declined' end where id = o.id;
  update public.delivery_order_tokens set used_at = now() where order_id = o.id;
  return jsonb_build_object('result','ok', 'status', case when v_action = 'accept' then 'accepted' else 'declined' end,
                            'summary', o.items || ' → ' || o.deliver_to);
end; $$;
revoke all on function public.delivery_decide(uuid, text) from public;
grant execute on function public.delivery_decide(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Expiry: unanswered orders expire (cron, every minute)
-- ---------------------------------------------------------------------------
create or replace function public.expire_delivery_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with x as (update public.delivery_orders set status = 'expired' where status = 'pending' and expires_at < now() returning 1)
  select count(*) into n from x;
  return n;
end; $$;
revoke all on function public.expire_delivery_orders() from public, anon, authenticated;
do $$ begin perform cron.unschedule('dormglide-delivery-expiry'); exception when others then null; end $$;
select cron.schedule('dormglide-delivery-expiry', '* * * * *', $$select public.expire_delivery_orders()$$);

-- ---------------------------------------------------------------------------
-- 6) Realtime for the console and the customer's tracking view
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['delivery_orders','delivery_providers'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- To enrol a courier (admin, one time), once they have signed up:
--   insert into public.delivery_providers (user_id, display_name, blurb, fee_cents, schedule, pickup_spots)
--   select id, 'Taran on skates', 'Campus delivery on roller skates', 300,
--          '[{"dow":1,"start":"11:00","end":"20:00"}]', '["Slayter","Curtis","Huffman"]'
--   from auth.users where email = 'xxx@denison.edu';
