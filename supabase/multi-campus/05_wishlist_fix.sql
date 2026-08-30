-- DormGlide: reconcile the wishlists table + RLS
--
-- WHY: the repo historically contained TWO different definitions of
-- public.wishlists:
--   * supabase/migrations/03_wishlist.sql  -> (user_id, keyword, category, max_price)
--   * supabase/products/03_personalization.sql -> (user_id, listing_id)
-- Both use "create table if not exists", so whichever ran FIRST silently won.
-- The app's heart/save button writes (user_id, listing_id); if the keyword
-- variant won, every wishlist write fails and the old client code hid the
-- error by saving to localStorage instead.
--
-- This script is idempotent and converges either variant to the correct
-- listing-based schema, preserving keyword rows by moving them to
-- keyword_alerts. Run it once in the SQL Editor.

create extension if not exists pgcrypto;

-- 0) Diagnostic (optional): see which variant you currently have.
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'wishlists';

-- 1) If the legacy keyword variant is live, migrate its rows to keyword_alerts.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'wishlists' and column_name = 'keyword'
  ) then
    create table if not exists public.keyword_alerts (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      keyword text not null,
      notify_in_app boolean not null default true,
      notify_email boolean not null default true,
      created_at timestamptz not null default now()
    );

    insert into public.keyword_alerts (user_id, keyword, created_at)
    select w.user_id, w.keyword, coalesce(w.created_at, now())
    from public.wishlists w
    where w.user_id is not null
      and length(trim(coalesce(w.keyword, ''))) > 0
      and not exists (
        select 1 from public.keyword_alerts ka
        where ka.user_id = w.user_id
          and lower(ka.keyword) = lower(w.keyword)
      );

    alter table public.wishlists drop column keyword;
    alter table public.wishlists drop column if exists category;
    alter table public.wishlists drop column if exists max_price;
  end if;
end
$$;

-- 2) Ensure the listing-based schema the app writes to.
alter table public.wishlists
add column if not exists listing_id uuid references public.products(id) on delete cascade;

alter table public.wishlists
add column if not exists created_at timestamptz not null default now();

-- Rows without a listing (leftover keyword rows just migrated) are meaningless now.
delete from public.wishlists where listing_id is null or user_id is null;

alter table public.wishlists alter column listing_id set not null;
alter table public.wishlists alter column user_id set not null;

-- One heart per user per listing.
create unique index if not exists wishlists_user_listing_unique
  on public.wishlists (user_id, listing_id);

create index if not exists wishlists_user_id_idx on public.wishlists(user_id);
create index if not exists wishlists_listing_id_idx on public.wishlists(listing_id);

-- 3) RLS: own rows only (drop policies from BOTH historical definitions first).
alter table public.wishlists enable row level security;

drop policy if exists "Users manage their own wishlist" on public.wishlists;
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

-- 4) Verify: as a logged-in app user, hearting a listing should now produce a
-- row here (run as admin in the SQL editor to see all rows):
-- select u.email, w.listing_id, w.created_at
-- from public.wishlists w join auth.users u on u.id = w.user_id
-- order by w.created_at desc limit 20;
