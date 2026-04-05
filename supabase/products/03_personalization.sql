-- DormGlide personalization tables + RLS policies

create extension if not exists pgcrypto;

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);

create table if not exists public.keyword_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null,
  notify_in_app boolean not null default true,
  notify_email boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  listing_id uuid references public.products(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists wishlists_user_id_idx on public.wishlists(user_id);
create index if not exists wishlists_listing_id_idx on public.wishlists(listing_id);
create index if not exists keyword_alerts_user_id_idx on public.keyword_alerts(user_id);
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);

alter table if exists public.wishlists enable row level security;
alter table if exists public.keyword_alerts enable row level security;
alter table if exists public.notifications enable row level security;
alter table if exists public.products enable row level security;
alter table if exists public.listings enable row level security;

-- Wishlists: user can only manage their own rows.
drop policy if exists "wishlists_select_own" on public.wishlists;
drop policy if exists "wishlists_insert_own" on public.wishlists;
drop policy if exists "wishlists_delete_own" on public.wishlists;

create policy "wishlists_select_own"
on public.wishlists
for select
to authenticated
using (auth.uid() = user_id);

create policy "wishlists_insert_own"
on public.wishlists
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "wishlists_delete_own"
on public.wishlists
for delete
to authenticated
using (auth.uid() = user_id);

-- Keyword alerts: user can only manage their own rows.
drop policy if exists "keyword_alerts_select_own" on public.keyword_alerts;
drop policy if exists "keyword_alerts_insert_own" on public.keyword_alerts;
drop policy if exists "keyword_alerts_update_own" on public.keyword_alerts;
drop policy if exists "keyword_alerts_delete_own" on public.keyword_alerts;

create policy "keyword_alerts_select_own"
on public.keyword_alerts
for select
to authenticated
using (auth.uid() = user_id);

create policy "keyword_alerts_insert_own"
on public.keyword_alerts
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "keyword_alerts_update_own"
on public.keyword_alerts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "keyword_alerts_delete_own"
on public.keyword_alerts
for delete
to authenticated
using (auth.uid() = user_id);

-- Notifications: user can only read/update their own rows.
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_insert_service" on public.notifications;

create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- App clients can insert only for themselves.
create policy "notifications_insert_service"
on public.notifications
for insert
to authenticated
with check (auth.uid() = user_id);

-- Listings/products visibility and owner delete constraints.
drop policy if exists "products_read_public" on public.products;
drop policy if exists "products_delete_owner" on public.products;

do $$
begin
  if to_regclass('public.listings') is not null then
    execute 'drop policy if exists "listings_read_public" on public.listings';
    execute 'drop policy if exists "listings_delete_owner" on public.listings';
  end if;
end
$$;

create policy "products_read_public"
on public.products
for select
to anon, authenticated
using (true);

create policy "products_delete_owner"
on public.products
for delete
to authenticated
using (auth.uid() = seller_id);

do $$
begin
  if to_regclass('public.listings') is not null then
    execute $policy$
      create policy "listings_read_public"
      on public.listings
      for select
      to anon, authenticated
      using (true)
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
  where alerts.notify_in_app is true
    and length(trim(coalesce(alerts.keyword, ''))) > 0
    and position(lower(alerts.keyword) in search_text) > 0;

  return new;
end;
$$;

drop trigger if exists trg_products_keyword_notifications on public.products;
create trigger trg_products_keyword_notifications
after insert on public.products
for each row
execute function public.create_keyword_notifications_for_listing();
