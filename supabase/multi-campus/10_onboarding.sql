-- DormGlide: first-time onboarding tracking
-- Run AFTER 09_listing_photos.sql. Idempotent.
--
-- One timestamp on profiles so the welcome walkthrough shows exactly once
-- per account (across devices). Users may set it on their own profile via the
-- existing profiles_update_own policy; school_id stays frozen by its trigger.

alter table public.profiles
add column if not exists onboarded_at timestamptz null;
