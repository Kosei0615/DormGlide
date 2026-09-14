-- DormGlide: Terms of Service acceptance tracking
-- Run AFTER 11_reserve_listings.sql. Idempotent.
--
-- Records which Terms version each user accepted and when. The client keeps
-- the current version in window.DORMGLIDE_TERMS_VERSION (app.html); bumping
-- it re-prompts everyone via the in-app acceptance modal. Users may write
-- these fields on their own profile via the existing profiles_update_own
-- policy; school_id remains frozen by its trigger.

alter table public.profiles
add column if not exists terms_version text null,
add column if not exists terms_accepted_at timestamptz null;
