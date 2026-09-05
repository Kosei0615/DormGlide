-- DormGlide: guided deal flow
-- Run AFTER 07_wishlist_email.sql. Idempotent.
--
-- Extends purchase_requests into a full deal lifecycle:
--   pending -> accepted -> meetup_arranged -> completed
--   (declined / cancelled as terminal exits)
-- The database owns all side effects (listing status sync, auto-declining
-- rival requests, counterparty notifications) via security-definer triggers,
-- because RLS correctly prevents buyers from updating products directly.

-- 1) Columns
alter table public.purchase_requests
add column if not exists meetup_note text null,
add column if not exists meetup_at timestamptz null,
add column if not exists cancelled_by uuid null,
add column if not exists cancel_reason text null,
add column if not exists completed_at timestamptz null;

alter table public.purchase_requests drop constraint if exists purchase_requests_status_check;
alter table public.purchase_requests add constraint purchase_requests_status_check
check (status in ('pending', 'accepted', 'declined', 'meetup_arranged', 'completed', 'cancelled'));

-- Sellers optionally list accepted payment apps per listing.
alter table public.products
add column if not exists payment_methods text[] not null default '{}';

do $$
begin
  if to_regclass('public.listings') is not null then
    execute 'alter table public.listings add column if not exists payment_methods text[] not null default ''{}''';
  end if;
end
$$;

-- 2) RLS: both participants may update (transitions guarded by trigger below).
drop policy if exists "Seller can update request" on public.purchase_requests;
drop policy if exists "purchase_requests_update_participants" on public.purchase_requests;

create policy "purchase_requests_update_participants"
on public.purchase_requests
for update
to authenticated
using (auth.uid() = buyer_id or auth.uid() = seller_id)
with check (auth.uid() = buyer_id or auth.uid() = seller_id);

-- 3) Transition guard: who may move a deal to which state.
create or replace function public.guard_purchase_request_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allow service-role / SQL-editor maintenance to bypass.
  if auth.uid() is null then
    return new;
  end if;

  if old.status in ('completed', 'cancelled', 'declined')
     and new.status is distinct from old.status then
    raise exception 'This deal is already % and cannot change', old.status;
  end if;

  if new.status is distinct from old.status then
    if new.status in ('accepted', 'declined') and auth.uid() <> old.seller_id then
      raise exception 'Only the seller can accept or decline a request';
    end if;
    if new.status = 'meetup_arranged' and old.status not in ('accepted', 'meetup_arranged') then
      raise exception 'A meetup can be arranged only after the seller accepts';
    end if;
    if new.status = 'completed' and old.status not in ('accepted', 'meetup_arranged') then
      raise exception 'A deal must be accepted before it can be completed';
    end if;
  end if;

  if new.status = 'cancelled' then
    new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
  end if;
  if new.status = 'completed' and new.completed_at is null then
    new.completed_at := now();
  end if;

  -- Identity fields are immutable.
  new.buyer_id := old.buyer_id;
  new.seller_id := old.seller_id;
  new.listing_id := old.listing_id;
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists trg_purchase_request_guard on public.purchase_requests;
create trigger trg_purchase_request_guard
before update on public.purchase_requests
for each row execute function public.guard_purchase_request_transition();

-- 4) Listing sync: the DB keeps products.status consistent with the deal.
--    (Buyers cannot update products under RLS, so this must run server-side.)
create or replace function public.sync_listing_with_deal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.products
    set status = 'pending', buyer_id = new.buyer_id, requested_at = now()
    where id = new.listing_id and status in ('available', 'active');
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'accepted' then
      update public.products
      set status = 'pending', buyer_id = new.buyer_id,
          requested_at = coalesce(requested_at, now())
      where id = new.listing_id;

      -- Auto-decline rival pending requests (their buyers get notified).
      update public.purchase_requests
      set status = 'declined', updated_at = now()
      where listing_id = new.listing_id and status = 'pending' and id <> new.id;

    elsif new.status = 'completed' then
      update public.products
      set status = 'sold', buyer_id = new.buyer_id,
          purchased_at = coalesce(purchased_at, now()),
          sold_at = coalesce(sold_at, now())
      where id = new.listing_id;

    elsif new.status in ('cancelled', 'declined') then
      -- Release the listing only if no other live deal exists for it.
      if not exists (
        select 1 from public.purchase_requests
        where listing_id = new.listing_id
          and status in ('pending', 'accepted', 'meetup_arranged')
          and id <> new.id
      ) then
        update public.products
        set status = 'available', buyer_id = null, requested_at = null
        where id = new.listing_id and status <> 'sold';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_purchase_request_sync_listing on public.purchase_requests;
create trigger trg_purchase_request_sync_listing
after insert or update on public.purchase_requests
for each row execute function public.sync_listing_with_deal();

-- 5) Counterparty notifications (clients can only insert notifications for
--    themselves under RLS, so the other party must be notified server-side).
create or replace function public.notify_deal_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_title text;
  recipient uuid := null;
  msg text := null;
begin
  select title into listing_title from public.products where id = new.listing_id;
  listing_title := coalesce(listing_title, 'your listing');

  if tg_op = 'INSERT' then
    recipient := new.seller_id;
    msg := format('New purchase request for "%s"! Open the listing to accept or decline.', listing_title);
  elsif new.status is distinct from old.status then
    if new.status = 'accepted' then
      recipient := new.buyer_id;
      msg := format('Your request for "%s" was accepted! Arrange a meetup with the seller.', listing_title);
    elsif new.status = 'declined' then
      recipient := new.buyer_id;
      msg := format('Your request for "%s" was declined.', listing_title);
    elsif new.status = 'meetup_arranged' then
      recipient := case when auth.uid() = new.buyer_id then new.seller_id else new.buyer_id end;
      msg := format('Meetup arranged for "%s"%s', listing_title,
        case when length(trim(coalesce(new.meetup_note, ''))) > 0
             then ': ' || left(new.meetup_note, 80) else '.' end);
    elsif new.status = 'completed' then
      recipient := case when auth.uid() = new.buyer_id then new.seller_id else new.buyer_id end;
      msg := format('Deal completed for "%s". Nice one!', listing_title);
    elsif new.status = 'cancelled' then
      recipient := case when new.cancelled_by = new.buyer_id then new.seller_id else new.buyer_id end;
      msg := format('The deal for "%s" was cancelled%s', listing_title,
        case when length(trim(coalesce(new.cancel_reason, ''))) > 0
             then ' (' || new.cancel_reason || ')' else '.' end);
    end if;
  end if;

  if recipient is not null and msg is not null then
    insert into public.notifications (user_id, message, listing_id, is_read)
    values (recipient, msg, new.listing_id, false);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_purchase_request_notify on public.purchase_requests;
create trigger trg_purchase_request_notify
after insert or update on public.purchase_requests
for each row execute function public.notify_deal_event();
