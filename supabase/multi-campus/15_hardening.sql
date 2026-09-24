-- DormGlide: API hardening (Supabase security-linter findings)
-- Run AFTER 14_glyde_trust.sql. Idempotent. No app behavior changes.
--
-- Supabase exposes every public function as /rest/v1/rpc/<name>. Internal
-- trigger/cron helpers must not be callable that way. Trigger functions fire
-- regardless of the caller's EXECUTE privilege (PostgreSQL checks EXECUTE at
-- CREATE TRIGGER time, not at fire time), and pg_cron runs as postgres, so
-- revoking API access from these is safe.

-- 1) Internal-only functions: no API access for anon / authenticated / public.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.enforce_school_email()',
    'public.handle_new_user_profile()',
    'public.set_row_school_id()',
    'public.guard_purchase_request_transition()',
    'public.sync_listing_with_deal()',
    'public.notify_deal_event()',
    'public.create_keyword_notifications_for_listing()',
    'public.send_handoff_reminders()',
    'public.school_id_for_email(text)',
    'public.profiles_protect_school_id()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
  end loop;
end
$$;

-- 2) Functions the app legitimately calls: signed-in users only (never anon).
revoke execute on function public.current_school_id() from public, anon;
grant execute on function public.current_school_id() to authenticated;

revoke execute on function public.provider_stats(uuid) from public, anon;
grant execute on function public.provider_stats(uuid) to authenticated;

revoke execute on function public.glyde_admin_counts() from public, anon;
grant execute on function public.glyde_admin_counts() to authenticated;

-- 3) Pin search_path on the one remaining function without it.
alter function public.profiles_protect_school_id() set search_path = public;
