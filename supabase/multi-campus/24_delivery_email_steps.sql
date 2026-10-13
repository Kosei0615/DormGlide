-- 24: Courier runs the whole order from email. Idempotent.
-- The per-order token (sent only to the courier) now works for every step:
--   pending  -> accept | decline
--   accepted -> picked_up | cancel
--   picked_up -> on_the_way | delivered
--   on_the_way -> delivered
-- Each step emails the courier the next button(s); the confirmation page at
-- /d/ also shows them, so a run can be done without opening the app.

create or replace function public.delivery_order_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
  is_customer boolean;
  is_courier boolean;
  ok boolean := false;
begin
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
    -- server side: delivery_decide (courier via email token) or the expiry cron
    ok := (old.status = 'pending' and new.status in ('accepted','declined','expired'))
       or (old.status = 'accepted' and new.status in ('picked_up','cancelled'))
       or (old.status = 'picked_up' and new.status in ('on_the_way','delivered'))
       or (old.status = 'on_the_way' and new.status = 'delivered');
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
  if new.status = 'cancelled' then
    new.cancelled_by := coalesce(actor, (select p.user_id from public.delivery_providers p where p.id = old.provider_id));
  end if;
  new.updated_at := now();
  return new;
end; $$;
revoke all on function public.delivery_order_guard() from public, anon, authenticated;

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
begin
  if v_action not in ('accept','decline','picked_up','on_the_way','delivered','cancel') then
    return jsonb_build_object('result','bad_action');
  end if;
  select * into t from public.delivery_order_tokens where token = p_token;
  if t.order_id is null then return jsonb_build_object('result','unknown'); end if;
  select * into o from public.delivery_orders where id = t.order_id;
  v_summary := o.items || ' → ' || o.deliver_to;

  if o.status in ('declined','expired','cancelled','delivered') then
    return jsonb_build_object('result','already', 'status', o.status, 'summary', v_summary);
  end if;
  if o.status = 'pending' and o.expires_at < now() then
    update public.delivery_orders set status = 'expired' where id = o.id;
    return jsonb_build_object('result','expired', 'summary', v_summary);
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
    return jsonb_build_object('result','already', 'status', o.status, 'summary', v_summary);
  end if;

  update public.delivery_orders set status = v_next where id = o.id;
  if v_next in ('declined','cancelled','delivered') then
    update public.delivery_order_tokens set used_at = now() where order_id = o.id;
  end if;
  return jsonb_build_object('result','ok', 'status', v_next, 'summary', v_summary,
    'next', case v_next
      when 'accepted'   then jsonb_build_array(jsonb_build_object('a','picked_up','label','Picked up'), jsonb_build_object('a','cancel','label','Cancel this order'))
      when 'picked_up'  then jsonb_build_array(jsonb_build_object('a','on_the_way','label','On the way'), jsonb_build_object('a','delivered','label','Delivered'))
      when 'on_the_way' then jsonb_build_array(jsonb_build_object('a','delivered','label','Delivered'))
      else '[]'::jsonb end);
end; $$;
revoke all on function public.delivery_decide(uuid, text) from public;
grant execute on function public.delivery_decide(uuid, text) to anon, authenticated;

-- Courier emails for the next step (customer emails unchanged from 22)
create or replace function public.notify_delivery_courier_step()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.delivery_providers%rowtype;
  v_email text; v_token uuid; v_base text := 'https://dormglide.com'; v_summary text; v_btn text;
begin
  if tg_op <> 'UPDATE' or new.status is not distinct from old.status then return new; end if;
  if new.status not in ('accepted','picked_up','on_the_way') then return new; end if;
  select * into p from public.delivery_providers where id = new.provider_id;
  select u.email into v_email from auth.users u where u.id = p.user_id;
  select token into v_token from public.delivery_order_tokens where order_id = new.id;
  if v_email is null or v_token is null then return new; end if;
  v_summary := replace(new.items, '<', '&lt;') || ' from ' || replace(new.pickup_spot, '<', '&lt;') || ' → ' || replace(new.deliver_to, '<', '&lt;');
  v_btn := case new.status
    when 'accepted' then format('<a href="%s/d/?t=%s&a=picked_up" style="background:#1d4ed8;color:#fff;padding:12px 26px;border-radius:50px;text-decoration:none;font-weight:bold;margin-right:10px">Picked up</a><a href="%s/d/?t=%s&a=cancel" style="background:#6b7280;color:#fff;padding:12px 26px;border-radius:50px;text-decoration:none;font-weight:bold">Cancel</a>', v_base, v_token, v_base, v_token)
    when 'picked_up' then format('<a href="%s/d/?t=%s&a=on_the_way" style="background:#1d4ed8;color:#fff;padding:12px 26px;border-radius:50px;text-decoration:none;font-weight:bold;margin-right:10px">On the way</a><a href="%s/d/?t=%s&a=delivered" style="background:#16a34a;color:#fff;padding:12px 26px;border-radius:50px;text-decoration:none;font-weight:bold">Delivered</a>', v_base, v_token, v_base, v_token)
    else format('<a href="%s/d/?t=%s&a=delivered" style="background:#16a34a;color:#fff;padding:12px 26px;border-radius:50px;text-decoration:none;font-weight:bold">Delivered</a>', v_base, v_token) end;
  perform public.send_email(v_email,
    case new.status when 'accepted' then 'Accepted — tap when you have picked it up' when 'picked_up' then 'Picked up — tap when you are on the way' else 'On the way — tap when delivered' end,
    format('<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937"><h2 style="color:#ea580c;margin:0 0 12px">🛼 %s</h2><p>%s</p><p style="margin:18px 0">%s</p><p style="color:#6b7280;font-size:12px">These buttons work without logging in. The customer sees each step right away.</p></div>',
      case new.status when 'accepted' then 'You accepted this order' when 'picked_up' then 'Picked up' else 'On the way' end, v_summary, v_btn));
  return new;
end; $$;
revoke all on function public.notify_delivery_courier_step() from public, anon, authenticated;
drop trigger if exists trg_delivery_courier_step on public.delivery_orders;
create trigger trg_delivery_courier_step
after update on public.delivery_orders
for each row execute function public.notify_delivery_courier_step();
