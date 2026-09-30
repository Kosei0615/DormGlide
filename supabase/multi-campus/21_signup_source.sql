-- 21: Sign-up attribution. Idempotent.
-- The client remembers ?ref=instagram / ?utm_source=... (first touch) and sends
-- it as signup_source in the auth metadata; the profile trigger copies it.
-- dormglide.com/ig is the Instagram short link (bio + stories).

alter table public.profiles add column if not exists signup_source text null;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, school_id, name, campus_location, bio, signup_source)
  values (
    new.id,
    public.school_id_for_email(new.email),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'campusLocation', ''),
    coalesce(new.raw_user_meta_data ->> 'bio', ''),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'signup_source', ''), 40), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user_profile() from public, anon, authenticated;

-- Backfill: the 2026-09-27 tabling sign-ups (before attribution existed).
update public.profiles p
set signup_source = 'tabling-2026-09-27'
from auth.users u
where u.id = p.id and p.signup_source is null
  and u.created_at between timestamp '2026-09-27 15:30:00+00' and timestamp '2026-09-27 20:00:00+00';

-- Weekly readout (run any time):
--   select coalesce(signup_source,'unknown') as source, count(*) as signups,
--          count(*) filter (where onboarded_at is not null) as onboarded
--   from public.profiles p join auth.users u on u.id = p.id
--   where u.created_at > now() - interval '7 days' group by 1 order by 2 desc;
