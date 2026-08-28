-- DormGlide multi-campus: tenant columns + auto-assignment
-- Run THIRD, after 02_profiles.sql.

-- Current user's campus, used by RLS policies and column-default triggers.
-- security definer so it can read profiles regardless of profile RLS;
-- stable so it is evaluated once per statement, not once per row.
create or replace function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- products (+ legacy listings): the main market table.
-- school_id stays nullable at the SQL level: legacy rows whose seller has no
-- profile keep null and simply become invisible (null never equals a school).
-- ---------------------------------------------------------------------------
alter table if exists public.products
add column if not exists school_id uuid references public.schools(id);

alter table if exists public.listings
add column if not exists school_id uuid references public.schools(id);

-- Backfill from the seller's profile.
update public.products p
set school_id = pr.school_id
from public.profiles pr
where p.school_id is null and pr.id = p.seller_id;

do $$
begin
  if to_regclass('public.listings') is not null then
    execute '
      update public.listings l
      set school_id = pr.school_id
      from public.profiles pr
      where l.school_id is null and pr.id = l.seller_id';
  end if;
end
$$;

-- The browse query's index: campus first, then status/recency.
create index if not exists products_school_status_created_idx
  on public.products (school_id, status, created_at desc);

-- Server-side assignment: clients never send school_id; it is derived from the
-- authenticated seller's profile so it cannot be spoofed.
create or replace function public.set_row_school_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.school_id := coalesce(new.school_id, public.current_school_id());
  return new;
end;
$$;

drop trigger if exists trg_products_set_school on public.products;
create trigger trg_products_set_school
before insert on public.products
for each row execute function public.set_row_school_id();

do $$
begin
  if to_regclass('public.listings') is not null then
    execute 'drop trigger if exists trg_listings_set_school on public.listings';
    execute '
      create trigger trg_listings_set_school
      before insert on public.listings
      for each row execute function public.set_row_school_id()';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- conversations: campus stamp so a cross-campus DM is impossible even if a
-- conversation/product id leaks. messages inherit isolation via conversation FK.
-- ---------------------------------------------------------------------------
alter table if exists public.conversations
add column if not exists school_id uuid references public.schools(id);

-- Backfill from participant A's profile (participants are always same-campus).
update public.conversations c
set school_id = pr.school_id
from public.profiles pr
where c.school_id is null and pr.id = c.participant_a;

create index if not exists conversations_school_id_idx on public.conversations(school_id);

drop trigger if exists trg_conversations_set_school on public.conversations;
create trigger trg_conversations_set_school
before insert on public.conversations
for each row execute function public.set_row_school_id();

-- ---------------------------------------------------------------------------
-- seller_ratings: scope reads to the seller's campus.
-- ---------------------------------------------------------------------------
alter table if exists public.seller_ratings
add column if not exists school_id uuid references public.schools(id);

update public.seller_ratings r
set school_id = pr.school_id
from public.profiles pr
where r.school_id is null and pr.id = r.seller_id;

create index if not exists seller_ratings_school_id_idx on public.seller_ratings(school_id);

drop trigger if exists trg_seller_ratings_set_school on public.seller_ratings;
create trigger trg_seller_ratings_set_school
before insert on public.seller_ratings
for each row execute function public.set_row_school_id();
