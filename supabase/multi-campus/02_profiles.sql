-- DormGlide multi-campus: profiles + signup enforcement
-- Run SECOND, after 01_schools.sql.

-- The tenant anchor. school_id lives here (server-managed), NOT in user_metadata
-- (user_metadata is client-editable via auth.updateUser and cannot be trusted for RLS).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id),
  name text not null default '',
  campus_location text not null default '',
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_school_id_idx on public.profiles(school_id);

alter table public.profiles enable row level security;

-- Users can read their own profile (the app needs school_id + school name after login).
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

-- Users can update display fields of their own profile.
-- school_id is NOT protected by this policy alone; the trigger below freezes it.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- No insert/delete policies for clients: profiles are created by the signup
-- trigger (security definer) and removed via the auth.users FK cascade.

-- Freeze school_id: even through the update policy above, a client can never
-- move themselves to another campus.
create or replace function public.profiles_protect_school_id()
returns trigger
language plpgsql
as $$
begin
  if new.school_id is distinct from old.school_id and auth.uid() is not null then
    raise exception 'school_id cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_school_id on public.profiles;
create trigger trg_profiles_protect_school_id
before update on public.profiles
for each row execute function public.profiles_protect_school_id();

-- ---------------------------------------------------------------------------
-- Signup enforcement: only supported school domains may create accounts.
-- BEFORE INSERT on auth.users -> reject unknown domains at the source.
-- (The app also validates client-side for a friendly message; this is the
--  actual security boundary.)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_school_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.school_id_for_email(new.email) is null then
    raise exception 'DormGlide is only available with a supported school email address (domain %)',
      lower(split_part(coalesce(new.email, ''), '@', 2));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_school_email on auth.users;
create trigger trg_enforce_school_email
before insert on auth.users
for each row execute function public.enforce_school_email();

-- AFTER INSERT on auth.users -> create the profile with the derived school_id.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, school_id, name, campus_location, bio)
  values (
    new.id,
    public.school_id_for_email(new.email),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'campusLocation', ''),
    coalesce(new.raw_user_meta_data ->> 'bio', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_user_profile on auth.users;
create trigger trg_handle_new_user_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- ---------------------------------------------------------------------------
-- Backfill: create profiles for existing users whose email domain matches a
-- supported school. Users with unmatched domains (old test accounts) get no
-- profile; they will see an empty market until reviewed manually.
-- List them afterwards with:
--   select id, email from auth.users u
--   where not exists (select 1 from public.profiles p where p.id = u.id);
-- ---------------------------------------------------------------------------
insert into public.profiles (id, school_id, name, campus_location, bio)
select
  u.id,
  public.school_id_for_email(u.email),
  coalesce(u.raw_user_meta_data ->> 'name', ''),
  coalesce(u.raw_user_meta_data ->> 'campusLocation', ''),
  coalesce(u.raw_user_meta_data ->> 'bio', '')
from auth.users u
where public.school_id_for_email(u.email) is not null
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- IMPORTANT (dashboard, one-time): Authentication -> Providers -> Email ->
-- "Confirm email" must be ON. Domain checks only prove the address format;
-- email confirmation proves the student actually owns the .edu inbox.
-- ---------------------------------------------------------------------------
