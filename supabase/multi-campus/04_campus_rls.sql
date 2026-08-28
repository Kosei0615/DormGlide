-- DormGlide multi-campus: RLS campus isolation
-- Run FOURTH (last), after 03_tenant_columns.sql. This is the switch that
-- turns isolation on — run it only after the backfill in 03 has completed.

-- ---------------------------------------------------------------------------
-- products: campus-scoped reads replace the old world-readable policy.
-- NOTE: anonymous browsing intentionally ends here — an anon visitor has no
-- campus. Legacy rows with school_id null are invisible to everyone.
-- ---------------------------------------------------------------------------
drop policy if exists "products_read_public" on public.products;
drop policy if exists "products_select_public" on public.products;
drop policy if exists "products_select_campus" on public.products;
drop policy if exists "products_insert_authenticated" on public.products;
drop policy if exists "products_insert_campus" on public.products;
drop policy if exists "products_update_owner" on public.products;
drop policy if exists "products_delete_owner" on public.products;

create policy "products_select_campus"
on public.products
for select
to authenticated
using (school_id = public.current_school_id());

create policy "products_insert_campus"
on public.products
for insert
to authenticated
with check (
  auth.uid() = seller_id
  and school_id = public.current_school_id()
);

create policy "products_update_owner"
on public.products
for update
to authenticated
using (auth.uid() = seller_id and school_id = public.current_school_id())
with check (auth.uid() = seller_id and school_id = public.current_school_id());

create policy "products_delete_owner"
on public.products
for delete
to authenticated
using (auth.uid() = seller_id);

-- Legacy listings table, if present.
do $$
begin
  if to_regclass('public.listings') is not null then
    execute 'drop policy if exists "listings_read_public" on public.listings';
    execute 'drop policy if exists "listings_select_campus" on public.listings';
    execute 'drop policy if exists "listings_delete_owner" on public.listings';

    execute $policy$
      create policy "listings_select_campus"
      on public.listings
      for select
      to authenticated
      using (school_id = public.current_school_id())
    $policy$;

    execute $policy$
      create policy "listings_delete_owner"
      on public.listings
      for delete
      to authenticated
      using (auth.uid() = seller_id)
    $policy$;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- conversations: participants only, AND same campus.
-- ---------------------------------------------------------------------------
drop policy if exists "conversations_select_participants" on public.conversations;
drop policy if exists "conversations_insert_participants" on public.conversations;
drop policy if exists "conversations_update_participants" on public.conversations;

create policy "conversations_select_participants"
on public.conversations
for select
to authenticated
using (
  (auth.uid() = participant_a or auth.uid() = participant_b)
  and school_id = public.current_school_id()
);

create policy "conversations_insert_participants"
on public.conversations
for insert
to authenticated
with check (
  (auth.uid() = participant_a or auth.uid() = participant_b)
  and school_id = public.current_school_id()
  -- both participants must belong to the inserter's campus
  and exists (
    select 1 from public.profiles pa
    where pa.id = participant_a and pa.school_id = public.current_school_id()
  )
  and exists (
    select 1 from public.profiles pb
    where pb.id = participant_b and pb.school_id = public.current_school_id()
  )
);

create policy "conversations_update_participants"
on public.conversations
for update
to authenticated
using (
  (auth.uid() = participant_a or auth.uid() = participant_b)
  and school_id = public.current_school_id()
)
with check (
  (auth.uid() = participant_a or auth.uid() = participant_b)
  and school_id = public.current_school_id()
);

-- messages inherit campus isolation through their conversation: a message can
-- only be read/sent by conversation participants, and conversations are now
-- campus-locked. Tighten insert so the sender must be a participant of a
-- conversation they can see (which implies same campus).
drop policy if exists "messages_select_participants" on public.messages;
drop policy if exists "messages_insert_sender" on public.messages;

create policy "messages_select_participants"
on public.messages
for select
to authenticated
using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "messages_insert_sender"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (auth.uid() = c.participant_a or auth.uid() = c.participant_b)
      and c.school_id = public.current_school_id()
  )
);

-- ---------------------------------------------------------------------------
-- seller_ratings: readable within the seller's campus only.
-- ---------------------------------------------------------------------------
drop policy if exists "seller_ratings_select_public" on public.seller_ratings;
drop policy if exists "seller_ratings_select_campus" on public.seller_ratings;

create policy "seller_ratings_select_campus"
on public.seller_ratings
for select
to authenticated
using (school_id = public.current_school_id());

-- ---------------------------------------------------------------------------
-- wishlists / keyword_alerts / notifications stay own-rows-only (already
-- campus-safe: users only ever see their own rows, and the listings those rows
-- point at are campus-filtered by the products policies above).
--
-- BUT the keyword-alert trigger matched new listings against EVERY user's
-- alerts globally — a cross-campus leak. Re-create it campus-scoped:
-- ---------------------------------------------------------------------------
create or replace function public.create_keyword_notifications_for_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  search_text text;
begin
  search_text := lower(coalesce(new.title, '') || ' ' || coalesce(new.description, ''));

  insert into public.notifications (user_id, message, listing_id, is_read)
  select
    alerts.user_id,
    format(
      'A new listing matches your alert: "%s" - %s $%s',
      alerts.keyword,
      coalesce(new.title, 'New listing'),
      coalesce(new.price::text, '0')
    ),
    new.id,
    false
  from public.keyword_alerts as alerts
  join public.profiles as alert_owner on alert_owner.id = alerts.user_id
  where alerts.notify_in_app is true
    and length(trim(coalesce(alerts.keyword, ''))) > 0
    and position(lower(alerts.keyword) in search_text) > 0
    -- campus isolation: only notify users on the listing's campus
    and alert_owner.school_id = new.school_id
    and new.school_id is not null;

  return new;
end;
$$;

-- (The trigger itself, trg_products_keyword_notifications, already points at
-- this function name; create or replace above is sufficient.)
