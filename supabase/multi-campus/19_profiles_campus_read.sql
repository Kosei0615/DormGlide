-- 19: Let students see each other's names within their own campus.
-- Idempotent.
--
-- DormGlide is campus-exclusive and takes no commission, so buyers and
-- sellers are meant to know who they're dealing with. Until now profiles
-- were readable only by their owner (profiles_select_own), which made chat
-- headers and the Messages list fall back to "Buyer"/"Seller".
--
-- profiles holds no email or phone (those live in auth.users, which stays
-- private). Exposed campus-wide: name, campus_location, bio, timestamps.
-- Cross-campus reads remain impossible.

drop policy if exists "profiles_select_campus" on public.profiles;
create policy "profiles_select_campus"
on public.profiles
for select
to authenticated
using (school_id = public.current_school_id());
-- profiles_select_own stays; policies are OR'd.
