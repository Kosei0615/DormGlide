-- DormGlide: Glyde services mode
-- Run AFTER 12_terms_acceptance.sql. Idempotent.
--
-- Services are products rows with listing_type = 'service'; bookings are
-- purchase_requests rows with kind = 'booking'. Campus isolation, RLS,
-- and the deal-flow guard apply unchanged. The only behavioral change is in
-- the listing-sync trigger: a service never becomes pending/sold.

-- 1) products: service columns + constraints
alter table public.products
add column if not exists listing_type text not null default 'goods',
add column if not exists service_category text null,
add column if not exists rate numeric null,
add column if not exists rate_unit text null,
add column if not exists availability_note text null,
add column if not exists location_note text null;

alter table public.products drop constraint if exists products_listing_type_check;
alter table public.products add constraint products_listing_type_check
check (listing_type in ('goods', 'service'));

-- v1 service categories — the ONLY allowed values. Excluded on purpose:
-- childcare/minors, medical or mental-health, licensed professions,
-- transporting people, academic work submitted as someone else's.
alter table public.products drop constraint if exists products_service_category_check;
alter table public.products add constraint products_service_category_check
check (
  service_category is null or service_category in (
    'Tutoring & academic help',
    'Hair & beauty',
    'Tech help',
    'Photography & video',
    'Moving & carrying help',
    'Pet sitting & dog walking',
    'Fitness & sports coaching',
    'Music lessons',
    'Other'
  )
);

alter table public.products drop constraint if exists products_rate_unit_check;
alter table public.products add constraint products_rate_unit_check
check (rate_unit is null or rate_unit in ('hour', 'session', 'flat'));

alter table public.products drop constraint if exists products_location_note_check;
alter table public.products add constraint products_location_note_check
check (location_note is null or location_note in ('on campus', 'my place', 'your place', 'remote'));

-- A service row must carry its service fields.
alter table public.products drop constraint if exists products_service_fields_check;
alter table public.products add constraint products_service_fields_check
check (
  listing_type = 'goods'
  or (service_category is not null and rate is not null and rate_unit is not null)
);

create index if not exists products_school_listing_type_idx
  on public.products (school_id, listing_type);

do $$
begin
  if to_regclass('public.listings') is not null then
    execute 'alter table public.listings add column if not exists listing_type text not null default ''goods''';
  end if;
end
$$;

-- 2) purchase_requests.kind: purchase (goods) | booking (service)
alter table public.purchase_requests
add column if not exists kind text not null default 'purchase';

alter table public.purchase_requests drop constraint if exists purchase_requests_kind_check;
alter table public.purchase_requests add constraint purchase_requests_kind_check
check (kind in ('purchase', 'booking'));

-- 3) Listing sync: services stay available through unlimited bookings.
create or replace function public.sync_listing_with_deal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_type text;
begin
  select listing_type into v_listing_type from public.products where id = new.listing_id;

  -- Services: no status changes, no rival auto-decline — many students can
  -- book the same provider concurrently.
  if v_listing_type = 'service' then
    return new;
  end if;

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

-- 4) Notifications: booking-flavored wording for services.
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
  is_booking boolean := (new.kind = 'booking');
  noun text;
begin
  select title into listing_title from public.products where id = new.listing_id;
  listing_title := coalesce(listing_title, 'your listing');
  noun := case when is_booking then 'booking' else 'request' end;

  if tg_op = 'INSERT' then
    recipient := new.seller_id;
    msg := case when is_booking
      then format('New booking request for "%s"! Open the listing to accept or decline.', listing_title)
      else format('New purchase request for "%s"! Open the listing to accept or decline.', listing_title) end;
  elsif new.status is distinct from old.status then
    if new.status = 'accepted' then
      recipient := new.buyer_id;
      msg := case when is_booking
        then format('Your booking for "%s" was accepted! Agree on a session time with the provider.', listing_title)
        else format('Your request for "%s" was accepted! Arrange a meetup with the seller.', listing_title) end;
    elsif new.status = 'declined' then
      recipient := new.buyer_id;
      msg := format('Your %s for "%s" was declined.', noun, listing_title);
    elsif new.status = 'meetup_arranged' then
      recipient := case when auth.uid() = new.buyer_id then new.seller_id else new.buyer_id end;
      msg := format('%s for "%s"%s',
        case when is_booking then 'Session scheduled' else 'Meetup arranged' end,
        listing_title,
        case when length(trim(coalesce(new.meetup_note, ''))) > 0
             then ': ' || left(new.meetup_note, 80) else '.' end);
    elsif new.status = 'completed' then
      recipient := case when auth.uid() = new.buyer_id then new.seller_id else new.buyer_id end;
      msg := case when is_booking
        then format('Session completed for "%s". Nice one!', listing_title)
        else format('Deal completed for "%s". Nice one!', listing_title) end;
    elsif new.status = 'cancelled' then
      recipient := case when new.cancelled_by = new.buyer_id then new.seller_id else new.buyer_id end;
      msg := format('The %s for "%s" was cancelled%s', noun, listing_title,
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
