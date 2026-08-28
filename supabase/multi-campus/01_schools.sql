-- DormGlide multi-campus: schools registry
-- Run FIRST in Supabase SQL Editor.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- One row per supported university.
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.schools drop constraint if exists schools_status_check;
alter table public.schools
add constraint schools_status_check check (status in ('active', 'waitlist', 'disabled'));

-- One row per email domain. A domain can belong to exactly one school (PK guarantees it).
-- Universities often have several domains (e.g. utexas.edu + mail.utexas.edu),
-- so this is a separate table rather than an array column on schools.
create table if not exists public.school_domains (
  domain citext primary key,
  school_id uuid not null references public.schools(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists school_domains_school_id_idx on public.school_domains(school_id);

-- RLS: everyone (including anon, for the signup form) can READ the registry.
-- Nobody can write from the client; new schools are added via SQL editor / service role.
alter table public.schools enable row level security;
alter table public.school_domains enable row level security;

drop policy if exists "schools_read_all" on public.schools;
create policy "schools_read_all"
on public.schools
for select
to anon, authenticated
using (true);

drop policy if exists "school_domains_read_all" on public.school_domains;
create policy "school_domains_read_all"
on public.school_domains
for select
to anon, authenticated
using (true);

-- Resolve a school from an email address (exact domain match, case-insensitive).
-- Returns null when the domain is not supported.
create or replace function public.school_id_for_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select sd.school_id
  from public.school_domains sd
  join public.schools s on s.id = sd.school_id
  where sd.domain = lower(split_part(coalesce(p_email, ''), '@', 2))
    and s.status = 'active'
  limit 1;
$$;

-- Seed: Denison (the founding campus).
insert into public.schools (name, slug, status)
values ('Denison University', 'denison', 'active')
on conflict (slug) do nothing;

insert into public.school_domains (domain, school_id, is_primary)
select 'denison.edu', id, true from public.schools where slug = 'denison'
on conflict (domain) do nothing;

-- ============================================================================
-- ADDING A NEW UNIVERSITY LATER: run these two inserts, nothing else.
--
--   insert into public.schools (name, slug) values ('Ohio State University', 'osu');
--   insert into public.school_domains (domain, school_id, is_primary)
--   select 'osu.edu', id, true from public.schools where slug = 'osu';
--
-- Signups from @osu.edu immediately start working and land in their own market.
-- Add extra domains for the same school (e.g. mail.osu.edu) as more rows in
-- school_domains pointing at the same school_id.
-- ============================================================================
