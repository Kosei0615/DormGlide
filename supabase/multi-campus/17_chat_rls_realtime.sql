-- 17: Fix chat (conversation inserts always denied) and enable realtime.
-- Idempotent.
--
-- Bug: conversations_insert_participants checked the OTHER participant's profile
-- with a plain EXISTS on public.profiles. profiles RLS only lets a user read their
-- own row, so the check was always false and every conversation insert got 403.
-- Fix: a SECURITY DEFINER helper answers "is this user in my school?" as a boolean.
-- Follows the migration-15 rule: not callable by anon/public.

create or replace function public.profile_in_my_school(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user and school_id = public.current_school_id()
  );
$$;
revoke all on function public.profile_in_my_school(uuid) from public, anon;
grant execute on function public.profile_in_my_school(uuid) to authenticated;

drop policy if exists "conversations_insert_participants" on public.conversations;
create policy "conversations_insert_participants"
on public.conversations
for insert
to authenticated
with check (
  (auth.uid() = participant_a or auth.uid() = participant_b)
  and school_id = public.current_school_id()
  and public.profile_in_my_school(participant_a)
  and public.profile_in_my_school(participant_b)
);

-- Realtime: the supabase_realtime publication had no tables, so the in-app
-- notification bell, chat, and deal panel never received live events.
do $$
declare t text;
begin
  foreach t in array array['notifications','messages','conversations','purchase_requests'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
