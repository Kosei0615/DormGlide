-- DormGlide: smarter want-alert matching (category + max price + back-match)
-- Run AFTER 05_wishlist_fix.sql. Idempotent.
--
-- Upgrades the want-alert system so an alert can match by keyword AND/OR
-- category, respect a max price, and never double-notify for the same listing.

-- 1) Alert criteria columns (the UI already collects these; now they persist).
alter table public.keyword_alerts
add column if not exists category text null,
add column if not exists max_price numeric null;

-- An alert must have at least a keyword or a category.
alter table public.keyword_alerts drop constraint if exists keyword_alerts_criteria_check;
alter table public.keyword_alerts
add constraint keyword_alerts_criteria_check
check (length(trim(coalesce(keyword, ''))) > 0 or category is not null);

-- 2) Matching trigger: keyword OR category, gated by price and campus.
create or replace function public.create_keyword_notifications_for_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  search_text text;
begin
  search_text := lower(coalesce(new.title, '') || ' ' || coalesce(new.description, ''));

  insert into public.notifications (user_id, message, listing_id, is_read)
  select
    alerts.user_id,
    format(
      'A new listing matches your wishlist%s: %s - $%s',
      case
        when length(trim(coalesce(alerts.keyword, ''))) > 0 then format(' ("%s")', alerts.keyword)
        else format(' (%s)', alerts.category)
      end,
      coalesce(new.title, 'New listing'),
      coalesce(new.price::text, '0')
    ),
    new.id,
    false
  from public.keyword_alerts as alerts
  join public.profiles as alert_owner on alert_owner.id = alerts.user_id
  where
    -- criteria: keyword substring OR exact category
    (
      (length(trim(coalesce(alerts.keyword, ''))) > 0
        and position(lower(alerts.keyword) in search_text) > 0)
      or
      (alerts.category is not null
        and lower(alerts.category) = lower(coalesce(new.category, '')))
    )
    -- price gate
    and (alerts.max_price is null or coalesce(new.price, 0) <= alerts.max_price)
    -- notification preferences
    and alerts.notify_in_app is true
    -- don't notify sellers about their own listing
    and alerts.user_id is distinct from new.seller_id
    -- campus isolation: only notify users on the listing's campus
    and alert_owner.school_id = new.school_id
    and new.school_id is not null
    -- never double-notify the same user about the same listing
    and not exists (
      select 1 from public.notifications n
      where n.user_id = alerts.user_id and n.listing_id = new.id
    );

  return new;
end;
$$;

-- (Trigger trg_products_keyword_notifications already points at this function.)

-- 3) Verify after a test:
-- insert a listing whose category matches an alert with no keyword match,
-- then: select message, created_at from public.notifications
--       order by created_at desc limit 5;
