-- 26: Courier console (no-login link) + founder delivery summary. Idempotent.
--
-- A courier gets ONE secret key. dormglide.com/courier/?k=KEY shows their live
-- orders with Accept / Decline / Picked up / On the way / Delivered buttons and
-- the Online switch, with no sign-in. Email buttons keep working: /d/ now
-- forwards to /courier/ with the per-order token, and delivery_decide returns
-- the courier's key so the page can stay open as the control panel.
--
--   delivery_console_keys            server-only (no grants, RLS, no policies)
--   courier_console(key)             anon-callable: provider + orders + totals
--   courier_console_online(key,bool) anon-callable: Online switch
--   delivery_decide(token, action)   unchanged behaviour + 'console_key'
--   delivery_console_key_issue(pid)  admin-only: create/return a key
--   delivery_console_key_rotate(pid) admin-only: replace the key (lost phone)
--   delivery_admin_summary()         admin-only: per-courier counts, fees, recent orders, console URLs

create table if not exists public.delivery_console_keys (
  provider_id uuid primary key references public.delivery_providers(id) on delete cascade,
  key text not null unique,
  created_at timestamptz not null default now(),
  rotated_at timestamptz null
);
alter table public.delivery_console_keys enable row level security;
revoke all on table public.delivery_console_keys from public, anon, authenticated;

create or replace function public.delivery_console_new_key()
returns text language sql volatile set search_path = public as $$
  select md5(random()::text || clock_timestamp()::text) || md5(gen_random_uuid()::text || random()::text);
$$;
revoke all on function public.delivery_console_new_key() from public, anon, authenticated;

create or replace function public.delivery_console_key_issue(p_provider uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_key text;
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then raise exception 'not authorized'; end if;
  select key into v_key from public.delivery_console_keys where provider_id = p_provider;
  if v_key is null then
    v_key := public.delivery_console_new_key();
    insert into public.delivery_console_keys (provider_id, key) values (p_provider, v_key);
  end if;
  return v_key;
end; $$;
revoke all on function public.delivery_console_key_issue(uuid) from public, anon;
grant execute on function public.delivery_console_key_issue(uuid) to authenticated;

create or replace function public.delivery_console_key_rotate(p_provider uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_key text := public.delivery_console_new_key();
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then raise exception 'not authorized'; end if;
  insert into public.delivery_console_keys (provider_id, key) values (p_provider, v_key)
  on conflict (provider_id) do update set key = excluded.key, rotated_at = now();
  return v_key;
end; $$;
revoke all on function public.delivery_console_key_rotate(uuid) from public, anon;
grant execute on function public.delivery_console_key_rotate(uuid) to authenticated;

-- Orders as the console shows them. Tokens are included because the page
-- drives each step through delivery_decide(token, action).
create or replace function public.delivery_console_orders(p_provider uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'status', o.status, 'items', o.items, 'pickup_spot', o.pickup_spot, 'deliver_to', o.deliver_to,
      'notes', o.notes, 'order_ref', o.order_ref, 'requested_for', o.requested_for, 'fee_cents', o.fee_cents,
      'expires_at', o.expires_at, 'created_at', o.created_at, 'updated_at', o.updated_at,
      'picked_up_at', o.picked_up_at, 'delivered_at', o.delivered_at,
      'customer', coalesce(nullif(pr.name, ''), 'Student'),
      'token', t.token
    ) order by o.created_at desc), '[]'::jsonb)
  from public.delivery_orders o
  left join public.profiles pr on pr.id = o.customer_id
  left join public.delivery_order_tokens t on t.order_id = o.id
  where o.provider_id = p_provider
    and (o.status in ('pending','accepted','picked_up','on_the_way') or o.updated_at > now() - interval '36 hours');
$$;
revoke all on function public.delivery_console_orders(uuid) from public, anon, authenticated;

create or replace function public.courier_console(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  k public.delivery_console_keys%rowtype;
  p public.delivery_providers%rowtype;
begin
  select * into k from public.delivery_console_keys where key = p_key;
  if k.provider_id is null then return jsonb_build_object('result','unknown'); end if;
  -- expire stale pending orders so the list is honest
  update public.delivery_orders set status = 'expired' where provider_id = k.provider_id and status = 'pending' and expires_at < now();
  select * into p from public.delivery_providers where id = k.provider_id;
  return jsonb_build_object(
    'result', 'ok',
    'provider', jsonb_build_object('id', p.id, 'display_name', p.display_name, 'is_online', p.is_online, 'is_active', p.is_active,
                                   'fee_cents', p.fee_cents, 'confirm_minutes', p.confirm_minutes, 'pickup_spots', p.pickup_spots),
    'orders', public.delivery_console_orders(p.id),
    'totals', (select jsonb_build_object(
        'delivered_all', count(*) filter (where status = 'delivered'),
        'fees_all_cents', coalesce(sum(fee_cents) filter (where status = 'delivered'), 0),
        'delivered_today', count(*) filter (where status = 'delivered' and delivered_at > date_trunc('day', now() at time zone p.timezone) at time zone p.timezone),
        'fees_today_cents', coalesce(sum(fee_cents) filter (where status = 'delivered' and delivered_at > date_trunc('day', now() at time zone p.timezone) at time zone p.timezone), 0))
      from public.delivery_orders where provider_id = p.id),
    'now', now());
end; $$;
revoke all on function public.courier_console(text) from public;
grant execute on function public.courier_console(text) to anon, authenticated;

create or replace function public.courier_console_online(p_key text, p_online boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k public.delivery_console_keys%rowtype;
begin
  select * into k from public.delivery_console_keys where key = p_key;
  if k.provider_id is null then return jsonb_build_object('result','unknown'); end if;
  update public.delivery_providers set is_online = coalesce(p_online, false), updated_at = now() where id = k.provider_id;
  return jsonb_build_object('result','ok','is_online', coalesce(p_online, false));
end; $$;
revoke all on function public.courier_console_online(text, boolean) from public;
grant execute on function public.courier_console_online(text, boolean) to anon, authenticated;

-- delivery_decide: same as 24, plus console_key in the reply.
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
  v_next text;
  v_summary text;
  v_key text;
begin
  if v_action not in ('accept','decline','picked_up','on_the_way','delivered','cancel') then
    return jsonb_build_object('result','bad_action');
  end if;
  select * into t from public.delivery_order_tokens where token = p_token;
  if t.order_id is null then return jsonb_build_object('result','unknown'); end if;
  select * into o from public.delivery_orders where id = t.order_id;
  select key into v_key from public.delivery_console_keys where provider_id = o.provider_id;
  v_summary := o.items || ' → ' || o.deliver_to;

  if o.status in ('declined','expired','cancelled','delivered') then
    return jsonb_build_object('result','already', 'status', o.status, 'summary', v_summary, 'console_key', v_key);
  end if;
  if o.status = 'pending' and o.expires_at < now() then
    update public.delivery_orders set status = 'expired' where id = o.id;
    return jsonb_build_object('result','expired', 'summary', v_summary, 'console_key', v_key);
  end if;

  v_next := case
    when o.status = 'pending'    and v_action = 'accept'     then 'accepted'
    when o.status = 'pending'    and v_action = 'decline'    then 'declined'
    when o.status = 'accepted'   and v_action = 'picked_up'  then 'picked_up'
    when o.status = 'accepted'   and v_action = 'cancel'     then 'cancelled'
    when o.status = 'picked_up'  and v_action = 'on_the_way' then 'on_the_way'
    when o.status = 'picked_up'  and v_action = 'delivered'  then 'delivered'
    when o.status = 'on_the_way' and v_action = 'delivered'  then 'delivered'
    else null end;
  if v_next is null then
    return jsonb_build_object('result','already', 'status', o.status, 'summary', v_summary, 'console_key', v_key);
  end if;

  update public.delivery_orders set status = v_next where id = o.id;
  if v_next in ('declined','cancelled','delivered') then
    update public.delivery_order_tokens set used_at = now() where order_id = o.id;
  end if;
  return jsonb_build_object('result','ok', 'status', v_next, 'summary', v_summary, 'console_key', v_key,
    'next', case v_next
      when 'accepted'   then jsonb_build_array(jsonb_build_object('a','picked_up','label','Picked up'), jsonb_build_object('a','cancel','label','Cancel this order'))
      when 'picked_up'  then jsonb_build_array(jsonb_build_object('a','on_the_way','label','On the way'), jsonb_build_object('a','delivered','label','Delivered'))
      when 'on_the_way' then jsonb_build_array(jsonb_build_object('a','delivered','label','Delivered'))
      else '[]'::jsonb end);
end; $$;
revoke all on function public.delivery_decide(uuid, text) from public;
grant execute on function public.delivery_decide(uuid, text) to anon, authenticated;

-- Founder view: every courier's numbers + the console link to hand them.
create or replace function public.delivery_admin_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then raise exception 'not authorized'; end if;
  return jsonb_build_object(
    'providers', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'display_name', p.display_name, 'is_online', p.is_online, 'is_active', p.is_active, 'fee_cents', p.fee_cents,
        'email', (select u.email from auth.users u where u.id = p.user_id),
        'console_url', (select 'https://dormglide.com/courier/?k=' || k.key from public.delivery_console_keys k where k.provider_id = p.id),
        'counts', (select jsonb_build_object(
            'total', count(*),
            'pending', count(*) filter (where status = 'pending'),
            'active', count(*) filter (where status in ('accepted','picked_up','on_the_way')),
            'delivered', count(*) filter (where status = 'delivered'),
            'declined', count(*) filter (where status = 'declined'),
            'cancelled', count(*) filter (where status = 'cancelled'),
            'expired', count(*) filter (where status = 'expired'),
            'delivered_7d', count(*) filter (where status = 'delivered' and delivered_at > now() - interval '7 days'),
            'fees_delivered_cents', coalesce(sum(fee_cents) filter (where status = 'delivered'), 0),
            'avg_accept_seconds', round(avg(extract(epoch from (decided_at - created_at))) filter (where status in ('accepted','declined')))::int,
            'avg_delivery_minutes', round(avg(extract(epoch from (delivered_at - decided_at)) / 60) filter (where status = 'delivered'))::int)
          from public.delivery_orders o where o.provider_id = p.id)
      ) order by p.created_at), '[]'::jsonb) from public.delivery_providers p),
    'recent', (select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb) from (
        select o.id, o.status, o.items, o.pickup_spot, o.deliver_to, o.fee_cents, o.created_at, o.decided_at, o.delivered_at,
               p.display_name as courier, coalesce(nullif(pr.name,''), 'Student') as customer
        from public.delivery_orders o
        join public.delivery_providers p on p.id = o.provider_id
        left join public.profiles pr on pr.id = o.customer_id
        order by o.created_at desc limit 40) r));
end; $$;
revoke all on function public.delivery_admin_summary() from public, anon;
grant execute on function public.delivery_admin_summary() to authenticated;
